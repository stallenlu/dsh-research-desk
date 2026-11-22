// Unit tests for the research desk. Run with: node --test test/
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { cleanText, parseJsonLoose, isHttpUrl, toNumber } from '../lib/util.mjs'
import { applyOps, cleanProfileList, diffDeclined, emptyState, filterDeclined, migrateState, paperKey, enrichChat, buildChatHandoff, HANDOFF_CHAR_CAP, HANDOFF_MESSAGE_THRESHOLD, INSPIRATION_STATUS } from '../lib/desk.mjs'
import { Store, revertChange } from '../lib/store.mjs'
import { chunkText, retrieve, tokenize, ask } from '../lib/qa.mjs'

function fakeCtx(reply, finishKind = 'stop') {
  const llm = {
    prepareCall: async () => ({
      config: {},
      stream: async function* () {
        yield { type: 'block-end', index: 0, block: { type: 'text', text: reply } }
        yield { type: 'finish', reason: { kind: finishKind } }
      },
    }),
  }
  return { get: name => (name === 'llm' ? llm : undefined) }
}

test('util: cleanText collapses whitespace and truncates', () => {
  assert.equal(cleanText('  a\n\n b  ', 100), 'a b')
  assert.equal(cleanText('abcdef', 3).length, 3)
  assert.equal(cleanText(undefined), '')
})

test('util: parseJsonLoose handles prose and fences', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJsonLoose('here it is: {"a":2} thanks'), { a: 2 })
  assert.deepEqual(parseJsonLoose('```json\n{"a":3}\n```'), { a: 3 })
  assert.equal(parseJsonLoose('no json here'), null)
})

test('util: isHttpUrl and toNumber', () => {
  assert.equal(isHttpUrl('https://arxiv.org/abs/2401.1'), true)
  assert.equal(isHttpUrl('javascript:alert(1)'), false)
  assert.equal(toNumber('12'), 12)
  assert.equal(toNumber('x'), undefined)
})

test('desk: add_paper dedupes on doi, arxiv id, then title', () => {
  const state = emptyState()
  const first = applyOps(state, [{ op: 'add_paper', paper: { title: 'A', doi: '10.1/x' } }])
  assert.equal(first.changed, true)
  assert.equal(state.papers.length, 1)
  const second = applyOps(state, [{ op: 'add_paper', paper: { title: 'A again', doi: '10.1/X' } }])
  assert.equal(second.changed, false)
  assert.equal(state.papers.length, 1)
  assert.match(second.errors[0], /已经有了/)
})

test('desk: unknown fields from the model are dropped, not merged', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_paper', paper: { title: 'A', evil: 'x' } }])
  assert.equal(state.papers[0].evil, undefined)
})

test('desk: paper without a title is refused', () => {
  const state = emptyState()
  const out = applyOps(state, [{ op: 'add_paper', paper: { abstract: 'no title' } }])
  assert.equal(out.changed, false)
  assert.match(out.errors[0], /没有标题/)
})

test('desk: hypothesis evidence only keeps known paper ids', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_paper', paper: { title: 'A', doi: '10.1/x' } }])
  const id = state.papers[0].id
  applyOps(state, [{ op: 'add_hypothesis', title: 'H1', evidence: [id, 'ghost-id'] }])
  assert.deepEqual(state.hypotheses[0].evidence, [id])
})

test('desk: remove_paper and set_paper_status', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_paper', paper: { title: 'A', doi: '10.1/x' } }])
  const id = state.papers[0].id
  applyOps(state, [{ op: 'set_paper_status', id, status: 'read' }])
  assert.equal(state.papers[0].status, 'read')
  const bad = applyOps(state, [{ op: 'set_paper_status', id, status: 'nonsense' }])
  assert.equal(bad.changed, false)
  applyOps(state, [{ op: 'remove_paper', id }])
  assert.equal(state.papers.length, 0)
})

test('desk: paperKey prefers doi then arxiv then title', () => {
  assert.equal(paperKey({ doi: '10.1/A', title: 'x' }), 'doi:10.1/a')
  assert.equal(paperKey({ arxivId: '2401.1', title: 'x' }), 'arxiv:2401.1')
  assert.equal(paperKey({ title: 'Some Title' }), 'title:some title')
})

test('desk: migrateState repairs a broken state file', () => {
  const state = migrateState({ papers: 'not-a-list', hypotheses: null })
  assert.deepEqual(state.papers, [])
  assert.deepEqual(state.hypotheses, [])
  assert.ok(state.settings.maxResults > 0)
})

test('store: mutate writes to disk and undo restores the previous value', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rd-store-'))
  try {
    const store = new Store(root, migrateState)
    await store.mutate('add', draft => {
      applyOps(draft, [{ op: 'add_paper', paper: { title: 'First', doi: '10.1/x' } }])
    })
    let state = await store.read()
    assert.equal(state.papers.length, 1)
    const step = await store.undoStep()
    assert.equal(step.ok, true)
    state = await store.read()
    assert.equal(state.papers.length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('store: undo does not clobber a later edit of the same row', () => {
  const before = { papers: [{ id: 'a', title: 'old' }] }
  const after = { papers: [{ id: 'a', title: 'new' }] }
  const current = { papers: [{ id: 'a', title: 'newer' }] }
  const result = revertChange(before, after, current)
  assert.equal(result.papers[0].title, 'newer')
})

test('store: history lists steps and restore jumps back, dropping later steps as a branch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rd-hist-'))
  try {
    const store = new Store(root, migrateState)
    await store.mutate('add First', draft => { applyOps(draft, [{ op: 'add_paper', paper: { title: 'First' } }]) })
    await store.mutate('add Second', draft => { applyOps(draft, [{ op: 'add_paper', paper: { title: 'Second' } }]) })
    await store.mutate('add Third', draft => { applyOps(draft, [{ op: 'add_paper', paper: { title: 'Third' } }]) })
    const steps = store.history()
    assert.equal(steps.length, 3)
    assert.deepEqual(steps.map(s => s.label), ['add First', 'add Second', 'add Third'])
    assert.ok(steps[0].at)
    // 回到第 1 步（index 0）之后的状态：只剩 First
    const back = await store.restore(0)
    assert.equal(back.ok, true)
    assert.equal(back.label, 'add First')
    let state = await store.read()
    assert.equal(state.papers.length, 1)
    assert.equal(state.papers[0].title, 'First')
    // 后续步骤作为分支被丢弃
    assert.equal(store.history().length, 1)
    assert.equal((await store.restore(2)).ok, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('qa: tokenize keeps latin words and CJK characters', () => {
  const tokens = tokenize('Transformer 注意力 mechanism')
  assert.ok(tokens.includes('transformer'))
  assert.ok(tokens.includes('注'))
  assert.ok(tokens.includes('意'))
})

test('qa: chunkText splits long text into ordered chunks', () => {
  const body = Array.from({ length: 40 }, (_, i) => 'Paragraph ' + i + ' ' + 'x'.repeat(80)).join('\n')
  const chunks = chunkText(body)
  assert.ok(chunks.length > 3)
  assert.deepEqual(chunks.map(c => c.index), chunks.map((_, i) => i))
  assert.ok(chunks.every(c => typeof c.text === 'string' && c.text.length > 0))
})

test('qa: retrieve ranks the passage that matches the question first', () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [
      { index: 0, heading: 'Intro', text: 'This paper is about widget calibration in the lab.' },
      { index: 1, heading: 'Method', text: 'We train a widget language model on synthetic data.' },
      { index: 2, heading: 'Result', text: 'Unrelated results about soil chemistry.' },
    ],
  }
  const hits = retrieve('widget language model training', [doc])
  assert.ok(hits.length > 0)
  assert.equal(hits[0].chunkId, 'p1#1')
})

test('qa: a quote that is not in the source is reported as unverified', async () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [{ index: 0, heading: 'Intro', text: 'Widgets were calibrated daily.' }],
  }
  const reply = JSON.stringify({
    answer: 'Widgets were calibrated monthly [S1].',
    citations: [{ chunkId: 'p1#0', quote: 'Widgets were calibrated monthly.' }],
  })
  const result = await ask(fakeCtx(reply), {
    question: 'how often were widgets calibrated',
    documents: [doc],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.ok, true)
  assert.equal(result.citations.length, 0)
  assert.equal(result.unverified.length, 1)
  assert.equal(result.unverified[0].reason, 'quote not present in source')
})

test('qa: a quote that is in the source passes verification', async () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [{ index: 0, heading: 'Intro', text: 'Widgets were calibrated daily.' }],
  }
  const reply = JSON.stringify({
    answer: 'Widgets were calibrated daily [S1].',
    citations: [{ chunkId: 'p1#0', quote: 'Widgets were calibrated daily.' }],
  })
  const result = await ask(fakeCtx(reply), {
    question: 'how often were widgets calibrated',
    documents: [doc],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.citations.length, 1)
  assert.equal(result.unverified.length, 0)
})

test('qa: a failing model stream is reported, not thrown', async () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [{ index: 0, heading: 'Intro', text: 'Widgets were calibrated daily.' }],
  }
  const result = await ask(fakeCtx('partial', 'error'), {
    question: 'widgets',
    documents: [doc],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.ok, false)
  assert.match(result.answer, /Model call failed/)
})

test('qa: a question with no matching passage never calls the model', async () => {
  const result = await ask(fakeCtx('should not be used'), {
    question: 'zzzzz qqqqq',
    documents: [{ paper: { id: 'p1', title: 'Paper one' }, chunks: [{ index: 0, heading: 'I', text: 'widgets' }] }],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.ok, false)
  assert.match(result.answer, /No passage/)
})
test('desk: add_collab and update_collab keep structured fields', () => {
  const state = emptyState()
  const result = applyOps(state, [{
    op: 'add_collab',
    title: '虚拟实验室Phase0落地',
    goal: { text: '接通 collaborations', source: 'human', createdAt: '2026-01-01T00:00:00.000Z' },
    team: [{ role: 'engineer', kind: 'kelin', ref: 'kelin-1' }],
    autonomy: 'L2',
    kelinRole: 'methodologist',
    status: 'active',
    experimentIds: ['e_1'],
  }])
  assert.equal(result.errors.length, 0)
  const collab = state.collaborations[0]
  assert.ok(collab.id.startsWith('c_'))
  assert.equal(collab.status, 'active')
  assert.equal(collab.autonomy, 'L2')
  assert.equal(collab.kelinRole, 'methodologist')
  assert.equal(collab.goal.source, 'human')
  assert.equal(collab.goal.text, '接通 collaborations')
  assert.equal(collab.team[0].role, 'engineer')
  assert.deepEqual(collab.experimentIds, ['e_1'])
  assert.deepEqual(collab.steps, [])
  assert.deepEqual(collab.decisions, [])

  const upd = applyOps(state, [{ op: 'update_collab', id: collab.id, patch: { title: '改名后的合作', autonomy: 'L3' } }])
  assert.equal(upd.errors.length, 0)
  assert.equal(collab.title, '改名后的合作')
  assert.equal(collab.autonomy, 'L3')
  assert.ok(collab.updatedAt && typeof collab.updatedAt === 'string')
})

test('desk: add_collab_step and decide_collab append structured records', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_collab', title: '步骤测试' }])
  const collab = state.collaborations[0]
  const steps = [
    { phase: 'design', actor: 'kelin', decision: '定方案', reason: '先设计', refs: ['p1'] },
    { phase: 'build', actor: 'human', decision: '开工', reason: '按计划', refs: ['e1', 'e2'] },
    { phase: 'review', actor: 'kelin', decision: '复验', reason: '收尾', refs: [] },
  ]
  const sr = applyOps(state, steps.map(step => ({ op: 'add_collab_step', collabId: collab.id, step })))
  assert.equal(sr.errors.length, 0)
  assert.equal(collab.steps.length, 3)
  for (const [i, step] of collab.steps.entries()) {
    assert.ok(step.id.startsWith('s_'))
    assert.ok(step.at)
    assert.equal(step.phase, steps[i].phase)
    assert.deepEqual(step.refs, steps[i].refs)
  }

  const dr = applyOps(state, [{
    op: 'decide_collab',
    collabId: collab.id,
    decision: { point: '是否继续', choice: '继续', by: 'human', pending: true },
    status: 'waiting-human',
  }])
  assert.equal(dr.errors.length, 0)
  assert.equal(collab.status, 'waiting-human')
  assert.equal(collab.decisions.length, 1)
  assert.ok(collab.decisions[0].id.startsWith('d_'))
  assert.ok(collab.decisions[0].at)
  assert.equal(collab.decisions[0].point, '是否继续')
  assert.equal(collab.decisions[0].pending, true)
})

test('desk: emptyState and migrateState normalize collaborations array', () => {
  assert.deepEqual(emptyState().collaborations, [])
  assert.deepEqual(migrateState({}).collaborations, [])
  assert.deepEqual(migrateState({ collaborations: 'bad-value' }).collaborations, [])
})

test('desk: invalid collab status is coerced away and falls back to active', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_collab', title: '非法状态测试', status: 'nonsense' }])
  assert.equal(state.collaborations.length, 1)
  assert.equal(state.collaborations[0].status, 'active')
})

// ── 检查点内核：早期对话 handoff（纯函数） ────────────────────────────────
// 常量必须保持可断言的确定值，防手滑改阈值/上限后历史会话静默丢失要点。
test('desk: handoff 常量取值为 30 条阈值与 600 字封顶', () => {
  assert.equal(HANDOFF_MESSAGE_THRESHOLD, 30)
  assert.equal(HANDOFF_CHAR_CAP, 600)
})

test('desk: buildChatHandoff 短会话与未超阈值不生成，超阈值才压出早期要点', () => {
  const msg = i => ({ q: '问题' + i, a: '回答' + i })
  assert.equal(buildChatHandoff([]), '', '空数组无要点')
  assert.equal(buildChatHandoff(Array.from({ length: HANDOFF_MESSAGE_THRESHOLD }, (_, i) => msg(i))), '', '恰好等于阈值不生成')
  const over = Array.from({ length: HANDOFF_MESSAGE_THRESHOLD + 3 }, (_, i) => msg(i))
  const h = buildChatHandoff(over)
  assert.ok(h.length > 0, '超阈值生成非空要点')
  assert.ok(h.indexOf('问：问题0') !== -1, '含最早一条问')
  assert.ok(h.indexOf('答：回答0') !== -1, '含最早一条答')
  assert.ok(h.indexOf('问题' + (HANDOFF_MESSAGE_THRESHOLD + 2)) === -1, '不取被 slice(-200) 挤掉之后的新增消息')
})

test('desk: buildChatHandoff 纯函数确定性，且总长不超 HANDOFF_CHAR_CAP', () => {
  const messages = Array.from({ length: 40 }, (_, i) => ({ q: '研究问题' + i + '：' + '甲'.repeat(20), a: '结论' + i + '：' + '乙'.repeat(30) }))
  const a = buildChatHandoff(messages)
  const b = buildChatHandoff(messages)
  assert.equal(a, b, '同输入必须同输出')
  assert.ok(a.length > 0)
  assert.ok(a.length <= HANDOFF_CHAR_CAP, 'handoff 总长必须封顶')
})

test('desk: enrichChat 现算 handoff，短会话不写、长会话写入', () => {
  const short = { messages: Array.from({ length: 5 }, (_, i) => ({ q: '短问' + i, a: '短答' + i })) }
  enrichChat(short)
  assert.equal(short.handoff, '', '短会话 handoff 为空串')
  const long = { messages: Array.from({ length: HANDOFF_MESSAGE_THRESHOLD + 2 }, (_, i) => ({ q: '长问' + i, a: '长答' + i })) }
  enrichChat(long)
  assert.ok(long.handoff.length > 0)
  assert.ok(long.handoff.indexOf('问：长问0') !== -1)
})

test('desk: migrateState 白名单保留 handoff，chats[] 仍是单一真相源', () => {
  const messages = Array.from({ length: HANDOFF_MESSAGE_THRESHOLD + 2 }, (_, i) => ({ q: '白名单问' + i, a: '白名单答' + i }))
  const handoff = buildChatHandoff(messages)
  const state = migrateState({
    activeChatId: 'c_handoff',
    chats: [{ id: 'c_handoff', title: '白名单会话', messages, handoff }],
  })
  assert.equal(state.chats.length, 1)
  assert.equal(state.activeChatId, 'c_handoff')
  assert.equal(state.chats[0].handoff, handoff, 'handoff 必须过 schema 白名单保留')
  assert.equal(state.chats[0].outcomes.length >= 0, true, 'outcomes 四枚举字段仍存在')
})

test('desk: cleanProfileList 过滤疑似秘密串，保留合法研究项', () => {
  const legit = ['图神经网络', 'arXiv', '先综述']
  const secrets = ['密码 hunter2', 'api_key=abcd1234', 'Bearer abc', 'sk-abcdef']
  const all = legit.concat(secrets)
  const out = cleanProfileList(all)
  assert.deepEqual(out, legit, '合法研究偏好必须保留，秘密串必须丢弃')
  assert.deepEqual(cleanProfileList('not an array'), [], '非数组输入返回空数组')
})

test('desk: set_profile 写入有界画像变更留痕（before/after/at）', () => {
  const state = emptyState()
  for (let i = 0; i < 22; i++) {
    const res = applyOps(state, [{ op: 'set_profile', focus: ['方向' + i], sources: [], habits: [] }])
    assert.equal(res.errors.length, 0)
  }
  assert.equal(state.profileJournal.length, 20, '画像留痕必须封顶 20 条')
  const last = state.profileJournal[state.profileJournal.length - 1]
  assert.equal(last.before.focus[0], '方向20', '最后一条留痕的 before 是上一版画像')
  assert.equal(last.after.focus[0], '方向21', '最后一条留痕的 after 是本版画像')
  assert.ok(typeof last.at === 'string' && last.at.length > 0, 'at 必须是时间戳字符串')
})

test('desk: migrateState 把非法 profileJournal 归一为空数组', () => {
  const state = migrateState({ profileJournal: '乱码' })
  assert.deepEqual(state.profileJournal, [])
  assert.deepEqual(emptyState().profileJournal, [])
})

test('desk: diffDeclined 纯函数仅抽被删条目、去重且有界（slice(-20)）', () => {
  const before = { focus: ['被删甲', '保留乙'], sources: ['旧源'], habits: [] }
  const after = { focus: ['保留乙', '新增丙'], sources: [], habits: [] }
  const rows = diffDeclined(before, after, '2026-01-01T00:00:00.000Z')
  assert.deepEqual(rows.map(row => row.item).sort(), ['旧源', '被删甲'], '只记被删项，不记新增/保留项')
  assert.deepEqual(rows.map(row => row.group).sort(), ['focus', 'sources'])
  assert.equal(rows[0].at, '2026-01-01T00:00:00.000Z')
  const dup = diffDeclined({ focus: ['重复', '重复'], sources: [], habits: [] }, { focus: [], sources: [], habits: [] }, 't')
  assert.equal(dup.length, 1, '同组重复条目只记一次')
  const many = Array.from({ length: 25 }, (_, i) => '方向' + i)
  const big = diffDeclined({ focus: many, sources: [], habits: [] }, { focus: [], sources: [], habits: [] }, 't')
  assert.equal(big.length, 20, '有界 slice(-20) 与 ds-bot declinedMax 对齐')
  assert.deepEqual(big[19].item, '方向24', '保留最近被删的 20 条')
})

test('desk: set_profile 真实删除写入 profileDeclined，新增不记', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'set_profile', focus: ['弃用方向'], sources: ['旧库'], habits: ['旧习惯'] }])
  // set_profile 的 [] 回退语义无法清空（clear 靠 update_profile），故用「替换」制造真实删除。
  const res = applyOps(state, [{ op: 'set_profile', focus: ['新方向'], sources: ['旧库'], habits: ['新习惯'] }])
  assert.equal(res.errors.length, 0)
  const items = state.profileDeclined.map(row => row.item).sort()
  assert.deepEqual(items, ['弃用方向', '旧习惯'], '被替换掉的旧项入册，新增项不入册')
  assert.deepEqual(state.profileDeclined.map(row => row.group), ['focus', 'habits'], '三组按 focus/sources/habits 顺序记录')
})

test('desk: 命中 declined 的新画像写入被剔除，合法项保留', () => {
  const state = emptyState()
  state.profile = { focus: ['保留'], sources: [], habits: [], updatedAt: '' }
  state.profileDeclined = [{ item: '禁提', group: 'focus', at: 't' }]
  const res = applyOps(state, [{ op: 'set_profile', focus: ['禁提', '合法'], sources: [], habits: [] }])
  assert.equal(res.errors.length, 0)
  assert.deepEqual(state.profile.focus, ['合法'], '被否决项不得重新写入')
  assert.deepEqual(filterDeclined(['禁提', '合法'], state.profileDeclined, 'focus'), ['合法'])
})

test('desk: migrateState 归一非法 profileDeclined 并封顶 20', () => {
  const state = migrateState({ profileDeclined: '乱码' })
  assert.deepEqual(state.profileDeclined, [])
  assert.deepEqual(emptyState().profileDeclined, [])
  const rows = Array.from({ length: 25 }, (_, i) => ({ item: '项' + i, group: 'focus', at: 't' }))
  assert.equal(migrateState({ profileDeclined: rows }).profileDeclined.length, 20)
  const dirty = migrateState({ profileDeclined: [
    { item: '好的', group: 'sources', at: 't' },
    { item: '坏的', group: 'other', at: 't' },
    { item: 42, group: 'focus', at: 't' },
    'not-an-object',
  ] })
  assert.deepEqual(dirty.profileDeclined.map(row => row.item), ['好的'], '非白名单组/非字符串被丢弃')
})

// ── 阶段 A1：灵感实体数据层（终稿 §7.1，关2 追溯表 C1–C9） ──────────────────
// 断言全部走真实 applyOps / migrateState / emptyState 行为，不比对源码字符串。

test('A1: emptyState 含 inspirations 与 activeInspirationId 两个新字段', () => {
  const s = emptyState()
  assert.deepEqual(s.inspirations, [])
  assert.equal(s.activeInspirationId, '')
})

test('A1: migrateState 归一 inspirations，悬空 activeInspirationId 回退空串', () => {
  const s = migrateState({})
  assert.deepEqual(s.inspirations, [])
  assert.equal(s.activeInspirationId, '')
  assert.equal(migrateState({ activeInspirationId: 'i-ghost' }).activeInspirationId, '')
  const ok = migrateState({ inspirations: [{ id: 'i-1', text: 'x', status: 'spark' }], activeInspirationId: 'i-1' })
  assert.equal(ok.activeInspirationId, 'i-1', '指向真实灵感的状态位应保留')
})

test('A1: add_inspiration 服务端生成 id/createdAt/status 并设为活跃灵感', () => {
  const s = emptyState()
  const out = applyOps(s, [{ op: 'add_inspiration', inspiration: { text: '一条火花' } }])
  assert.equal(out.errors.length, 0)
  assert.equal(s.inspirations.length, 1)
  const row = s.inspirations[0]
  assert.ok(typeof row.id === 'string' && row.id.startsWith('i_'), 'id 由 newId(i) 生成')
  assert.ok(row.createdAt, 'createdAt 由服务端生成')
  assert.equal(row.status, 'spark', '默认灵感状态为 spark')
  assert.equal(s.activeInspirationId, row.id, '新建即成为活跃灵感')
})

test('A1: add_inspiration 采信合法 status，拒绝白名单外的 id/createdAt', () => {
  const s = emptyState()
  applyOps(s, [{ op: 'add_inspiration', inspiration: { text: '成形', status: 'framed', id: 'hacked', createdAt: '1999' } }])
  const row = s.inspirations[0]
  assert.equal(row.status, 'framed')
  assert.notEqual(row.id, 'hacked')
  assert.ok(row.id.startsWith('i_'))
  assert.notEqual(row.createdAt, '1999')
})

test('A1: add_inspiration 空 text 报错且不写入（不设活跃位）', () => {
  const s = emptyState()
  const out = applyOps(s, [{ op: 'add_inspiration', inspiration: { text: '' } }])
  assert.equal(out.errors.length, 1)
  assert.equal(s.inspirations.length, 0)
  assert.equal(s.activeInspirationId, '')
})

test('A1: update_inspiration 只改白名单字段，不改写主键', () => {
  const s = emptyState()
  applyOps(s, [{ op: 'add_inspiration', inspiration: { text: '原' } }])
  const id = s.inspirations[0].id
  const createdAt = s.inspirations[0].createdAt
  const out = applyOps(s, [{ op: 'update_inspiration', id, patch: { text: '改', id: 'evil', createdAt: '2000' } }])
  assert.equal(out.errors.length, 0)
  assert.equal(s.inspirations[0].id, id, '主键不可被更新改写')
  assert.equal(s.inspirations[0].createdAt, createdAt, 'createdAt 不可被更新改写')
  assert.equal(s.inspirations[0].text, '改')
})

test('A1: remove_inspiration 删除活跃灵感后清空状态位，不悬空', () => {
  const s = emptyState()
  applyOps(s, [{ op: 'add_inspiration', inspiration: { text: 'x' } }])
  const id = s.activeInspirationId
  const out = applyOps(s, [{ op: 'remove_inspiration', id }])
  assert.equal(out.errors.length, 0)
  assert.equal(s.inspirations.length, 0)
  assert.equal(s.activeInspirationId, '', '删除活跃灵感后状态位清空')
})

test('A1: 灵感状态枚举固定为四态，不受 PAPER_STATUS 污染', () => {
  assert.deepEqual(INSPIRATION_STATUS, ['spark', 'framed', 'pursued', 'shelved'])
})
