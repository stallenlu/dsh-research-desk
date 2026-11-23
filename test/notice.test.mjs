// notice.test.mjs — 阶段8·缺口一（主动提醒/排期）+ 缺口二（配合偏好）真行为测试。
//
// 跑法：
//   node --test E:/Research/dsh-research-desk/test/notice.test.mjs
//
// 取证纪律（与全队一致）：
// 1. 只断言后端已落地的真值锚点，不凭接口设计稿空写预期；
// 2. 断言不弱于缺陷层：既查正向触发，也查裸 id / suggestedAction 不外泄、
//    空悬空证据丢弃、library 只读、不碰三道闸门、非法反馈被拒、幂等；
// 3. 不联网、不碰真机、不调真模型；process.env.DSH_HOME 指向临时目录，finally 恢复。
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createService, scanOpportunities, toPublicNotices } from '../lib/host.mjs'

// ── 假模型：本文件动作不调 llm，给最小可用协议防止 createService 初始化报错 ──────
const llm = {
  prepareCall: async config => ({
    config,
    stream: () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'block-end', index: 0, block: { type: 'text', text: '' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    }),
  }),
  listProviders: () => [{ id: 'fake' }],
  listModels: () => [{ id: 'fake/model' }],
  resolveModelInfo: async () => ({ inputModalities: ['text'] }),
}
const ctx = {
  get: name => (name === 'llm'
    ? llm
    : name === 'agentDefaultModel'
      ? { currentSelection: () => ({ provider: 'fake', model: 'fake/model' }) }
      : undefined),
}

// ── 临时 HOME ─────────────────────────────────────────────────────────────────
const previousHome = process.env.DSH_HOME
const tempHome = mkdtempSync(join(tmpdir(), 'rd-notice-'))
process.env.DSH_HOME = tempHome

after(() => {
  try {
    rmSync(tempHome, { recursive: true, force: true })
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
})

let caseIndex = 0
function freshService(seed) {
  caseIndex += 1
  const dir = join(tempHome, 'case-' + caseIndex)
  mkdirSync(dir, { recursive: true })
  if (seed) {
    mkdirSync(join(dir, 'research-desk'), { recursive: true })
    writeFileSync(join(dir, 'research-desk', 'state.json'), JSON.stringify(seed, null, 2), 'utf8')
  }
  process.env.DSH_HOME = dir
  return { svc: createService(ctx), dir }
}
function statePath(dir) {
  return join(dir, 'research-desk', 'state.json')
}

// ── 日期工具：动态生成，避免写死日期导致「本周判定」随时间漂移而漏测 ──────────────
const isoDaysAgo = d => new Date(Date.now() - d * 86400000).toISOString()
const todayIso = () => new Date().toISOString()

/** 四类机会都能触发的种子；evidenceRefs 指向的都是真实行 id。 */
function opportunitySeed() {
  return {
    profile: { focus: [], sources: [], habits: [], updatedAt: '2020-01-01T00:00:00.000Z' },
    inspirations: [
      { id: 'i_sched', text: '本周要推的灵感', status: 'spark', scheduledAt: todayIso(), createdAt: todayIso() },
      { id: 'i_stale', text: '搁置很久的灵感', status: 'spark', createdAt: isoDaysAgo(20) },
    ],
    hypotheses: [{ id: 'h_stall', title: '卡住的假设', status: 'testing', at: isoDaysAgo(20) }],
    experiments: [{ id: 'e_done', title: '跑完没复盘的实验', finishedAt: isoDaysAgo(10) }],
    activeInspirationId: 'i_sched',
  }
}

// ── 1. 机会扫描真触发 + 人话下发 + 动作只留反馈语义 ────────────────────────────────
test('机会扫描：四类真实触发、text 是中文人话、裸 id/verdict/suggestedAction 不外泄', async () => {
  const { svc } = freshService(opportunitySeed())
  const r = await svc.run({ action: 'library' })
  assert.equal(r.ok, true)
  const notices = r.library.notices
  assert.ok(Array.isArray(notices) && notices.length >= 4, '四类机会都应触发')
  const kinds = notices.map(n => n.kind)
  for (const k of ['schedule', 'stale-inspiration', 'hypothesis-stalled', 'unreviewed-result']) {
    assert.ok(kinds.includes(k), '应含 ' + k)
  }
  const sched = notices.find(n => n.kind === 'schedule')
  assert.ok(typeof sched.text === 'string' && sched.text.includes('本周'), 'text 是中文人话：' + sched.text)
  // 负向反例：任何内部裸 id / 动作执行码 / verdict / runId 都不得外泄（断言强于「正向查存在」）
  const allText = JSON.stringify(notices)
  for (const leak of ['i_sched', 'i_stale', 'h_stall', 'e_done',
    'review-schedule', 'advance-inspiration', 'revisit-hypothesis', 'review-result',
    'verdict', 'runId']) {
    assert.ok(!allText.includes(leak), '不得外泄内部字段：' + leak)
  }
  // 按钮只有「以后少提醒这类」反馈语义，绝无被提醒动作执行码
  assert.deepEqual(sched.action, { id: 'dismiss', label: '以后少提醒这类' })
})

// ── 2. 空/悬空/未知证据一律丢弃（纯函数直测，锚点 host.mjs:730/:740-742） ──────────
test('toPublicNotices：空证据/悬空证据/未知 kind 一律丢弃，只留真实候选', () => {
  const state = {
    inspirations: [{ id: 'real_1', text: 'x' }],
    hypotheses: [], experiments: [], drafts: [], reviews: [],
  }
  const mk = (id, kind, refs) => ({
    id, kind, humanText: '本周有小事', whyText: '原因',
    suggestedAction: 'review-schedule', evidenceRefs: refs,
  })
  const out = toPublicNotices([
    mk('a', 'schedule', []),              // 空证据 → 丢弃
    mk('b', 'schedule', ['ghost_999']),   // 悬空证据 → 丢弃
    mk('c', 'unknown_kind', ['real_1']),  // 未知 kind → 丢弃
    mk('d', 'schedule', ['real_1']),      // 合法 → 保留
  ], state)
  assert.equal(out.length, 1, '只有合法候选保留')
  assert.equal(out[0].id, 'd')
  assert.ok(!JSON.stringify(out).includes('review-schedule'), 'suggestedAction 不外泄')
  assert.deepEqual(out[0].action, { id: 'dismiss', label: '以后少提醒这类' })
})

// ── 3. scanOpportunities 纯只读，可独立调用不改 state ───────────────────────────────
test('scanOpportunities：独立纯函数只读，四类候选带真实 evidenceRefs', () => {
  const state = opportunitySeed()
  const snapshot = JSON.stringify(state)
  const cands = scanOpportunities(state)
  assert.equal(JSON.stringify(state), snapshot, '扫描不改入参 state')
  assert.equal(cands.length, 4)
  for (const c of cands) {
    assert.ok(Array.isArray(c.evidenceRefs) && c.evidenceRefs.length >= 1, '每类候选带证据')
    assert.ok(typeof c.suggestedAction === 'string' && c.suggestedAction, '内部带动作执行码（但下发时被剥离）')
  }
})

// ── 4. library 只读：调前后 state.json 逐字不变、无新增拍板 ──────────────────────────
test('library 只读：反复调 state.json 逐字不变、不伪造 pending:false/by:human', async () => {
  const { svc, dir } = freshService(opportunitySeed())
  await svc.run({ action: 'library' }) // 预热：吸收 createService 首次 migrate 的任何写盘
  const before = readFileSync(statePath(dir), 'utf8')
  await svc.run({ action: 'library' })
  await svc.run({ action: 'library' })
  const after = readFileSync(statePath(dir), 'utf8')
  assert.equal(after, before, 'library 绝不写 state.json')
  const s = JSON.parse(after)
  const decisions = (s.collaborations || []).flatMap(c => c.decisions || [])
  assert.ok(!decisions.some(d => d.pending === false && d.by === 'human'), 'library 不伪造已批准拍板')
})

// ── 5. notice_action 纯反馈：只记 nudge_preferences、不碰业务/闸门、回执 message ──────
test('notice_action：accept 只记 nudge_preferences、不改业务对象/不新增拍板、回执 message', async () => {
  const { svc, dir } = freshService(opportunitySeed())
  const lib = await svc.run({ action: 'library' })
  const sched = lib.library.notices.find(n => n.kind === 'schedule')
  assert.ok(sched, '存在 schedule 提醒')
  const before = JSON.parse(readFileSync(statePath(dir), 'utf8'))
  const r = await svc.run({ action: 'notice_action', id: sched.id, actionId: 'accept' })
  assert.equal(r.ok, true)
  assert.equal(typeof r.message, 'string', '回执字段是 message（非 receipt）')
  assert.ok(r.message.includes('多提醒'), '回执是人话：' + r.message)
  const after = JSON.parse(readFileSync(statePath(dir), 'utf8'))
  assert.equal(after.profile.nudge_preferences.byKind.schedule.accepted, 1, '记入 byKind.schedule.accepted')
  assert.deepEqual(after.inspirations, before.inspirations, '不改业务对象 inspirations')
  assert.deepEqual(after.hypotheses, before.hypotheses, '不改业务对象 hypotheses')
  // 比较拍板决策条数而非整字段：种子无 collaborations，写盘规范化会补 []，那不是新增拍板。
  const beforeDecisions = (before.collaborations || []).flatMap(c => c.decisions || [])
  const afterDecisions = (after.collaborations || []).flatMap(c => c.decisions || [])
  assert.equal(afterDecisions.length, beforeDecisions.length, '不新增拍板记录')
  // library 回执的人话摘要不露裸统计
  const summary = r.library.profile.nudgeSummary
  assert.ok(summary.includes('你更关心') && summary.includes('科研排期'), '人话摘要：' + summary)
  assert.ok(!/accepted|dismissed|\d/.test(summary), '不露裸统计数字/字段名')
  // 负向反例：非法 actionId / 未知类别必须拒绝
  const bad = await svc.run({ action: 'notice_action', id: sched.id, actionId: 'execute' })
  assert.equal(bad.ok, false, 'actionId 只接受 accept/dismiss，反馈语义不可当执行码')
  const badKind = await svc.run({ action: 'notice_action', id: 'bogus:1', actionId: 'accept' })
  assert.equal(badKind.ok, false, '未知类别必须拒绝')
})

// ── 6. sync_schedule：白名单过滤假 id、幂等、count 正确 ──────────────────────────────
test('sync_schedule：只写真 id 的 scheduledAt、过滤假 id、幂等、count=写入条数', async () => {
  const { svc, dir } = freshService(opportunitySeed())
  const items = [
    { id: 'i_sched', scheduledAt: '2026-12-01' },
    { id: 'i_stale', scheduledAt: '2026-12-02' },
    { id: 'ghost_999', scheduledAt: '2026-12-03' }, // 假 id → 过滤
  ]
  const r1 = await svc.run({ action: 'sync_schedule', items })
  assert.equal(r1.ok, true)
  assert.equal(r1.count, 2, '只算两个真实 id，假 id 被过滤')
  assert.ok(r1.message.includes('2'), '回执人话含条数：' + r1.message)
  const s1 = JSON.parse(readFileSync(statePath(dir), 'utf8'))
  assert.equal(s1.inspirations.find(x => x.id === 'i_sched').scheduledAt, '2026-12-01', '真实 id 写入')
  assert.ok(!s1.inspirations.some(x => x.id === 'ghost_999'), '假 id 不写入')
  const beforeCount = s1.inspirations.length
  // 幂等：同参数再跑，不追加条目、值不变、count 一致
  const r2 = await svc.run({ action: 'sync_schedule', items })
  assert.equal(r2.count, 2, '幂等 count 一致')
  const s2 = JSON.parse(readFileSync(statePath(dir), 'utf8'))
  assert.equal(s2.inspirations.length, beforeCount, '幂等：不追加条目')
  assert.equal(s2.inspirations.find(x => x.id === 'i_sched').scheduledAt, '2026-12-01', '幂等：值不漂移')
  assert.deepEqual(s2.collaborations, s1.collaborations, '不碰拍板记录')
})

// ── 7. 配合偏好：dismissed>accepted 的类别不再主动提醒 ────────────────────────────────
test('配合偏好：用户明确少提醒的类别（dismissed>accepted）不再主动推', async () => {
  const seed = opportunitySeed()
  seed.profile.nudge_preferences = {
    byKind: { schedule: { accepted: 0, dismissed: 2, lastAt: 'x' } },
    writingStyle: '', updatedAt: 'x',
  }
  const { svc } = freshService(seed)
  const lib = await svc.run({ action: 'library' })
  const kinds = lib.library.notices.map(n => n.kind)
  assert.ok(!kinds.includes('schedule'), '用户少提醒排期后不再推 schedule')
  assert.ok(kinds.includes('stale-inspiration'), '其他类别仍照常提醒')
})

// ── 8. writingStyle 落盘读回 ──────────────────────────────────────────────────────────
test('writingStyle：随画像写 state.json、library.profile 读回', async () => {
  const { svc, dir } = freshService(opportunitySeed())
  const r = await svc.run({ action: 'update_profile', writingStyle: '严谨' })
  assert.equal(r.ok, true)
  const s = JSON.parse(readFileSync(statePath(dir), 'utf8'))
  assert.equal(s.profile.nudge_preferences.writingStyle, '严谨', '写进 state.json')
  assert.equal(r.library.profile.writingStyle, '严谨', 'library 读回')
})
