// host.test.mjs — 宿主层（服务 + 动作分发 + 工具注册）的集成测试。
//
// 跑法：
//   node --test E:/Research/dsh-research-desk/test/host.test.mjs
//
// 三条底线：
// 1. 不联网：全局替换 globalThis.fetch，任何真实网络请求都会被记下来并抛错。
// 2. 不碰真机：process.env.DSH_HOME 指向临时目录，跑完在 finally 里恢复原值。
// 3. 不调真模型：host.mjs 通过 ctx.get('llm') 取模型，这里给一个假实现，
//    协议与 lib/llm.mjs 逐字对应（block-end 文本块 + finish/stop）。
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply, createService } from '../lib/host.mjs'
import { SETTING_DEFS } from '../lib/settings.mjs'

// ── 网络闸门 ─────────────────────────────────────────────────────────────────
// 检索动作会打到 arXiv / Europe PMC / OpenAlex。测试里把 fetch 换成闸门：
// 每次调用都记账并抛错，于是「有没有发请求」是可断言的事实。

const networkCalls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async input => {
  const url = typeof input === 'string' ? input : (input && input.url) ? input.url : String(input)
  networkCalls.push(String(url))
  throw new Error('测试里禁止联网：' + String(url))
}

// ── 假模型 ───────────────────────────────────────────────────────────────────
// lib/llm.mjs 的协议：正文走 chunk.type === 'block-end' 且 chunk.block.type === 'text'，
// 按 chunk.index 聚合；流以 chunk.type === 'finish' 结束，reason.kind 必须是 'stop'。

let modelText = ''
const modelCalls = []

const llm = {
  prepareCall: async (config, signal) => ({
    config: Object.assign({}, config),
    stream: payload => {
      modelCalls.push(payload)
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'block-end', index: 0, block: { type: 'text', text: modelText } }
          yield { type: 'finish', reason: { kind: 'stop' } }
        },
      }
    },
  }),
  listProviders: () => [{ id: 'fake' }],
  listModels: providerId => [{ id: 'fake/model' }],
}

const ctx = {
  get: name => (name === 'llm'
    ? llm
    : name === 'agentDefaultModel'
      ? { currentSelection: () => ({ provider: 'fake', model: 'fake/model' }) }
      : undefined),
}

// ── 临时 HOME ───────────────────────────────────────────────────────────────
// 插件 Store 默认落在 join(dshHome(), 'research-desk')，所以整个文件期间
// DSH_HOME 都指向临时目录，测试跑完在 finally 里恢复原来的值。

const previousHome = process.env.DSH_HOME
const tempHome = mkdtempSync(join(tmpdir(), 'rd-host-'))
process.env.DSH_HOME = tempHome

after(() => {
  try {
    globalThis.fetch = originalFetch
    rmSync(tempHome, { recursive: true, force: true })
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
})

let caseIndex = 0

/**
 * 每个用例一个独立的插件数据目录（状态文件互不干扰）。
 * @param {object} [seed] - 预先写好的状态，用来造「已经入库全文」的文献。
 * @returns {{svc: object, dir: string}} 服务与数据目录。
 */
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

// ── 素材 ─────────────────────────────────────────────────────────────────────

const MARKER = 'unique marker phrase Xylophone Delta'

const CHUNK_ZERO = 'The evaluation protocol uses a fixed method and the same public dataset for every experiment, so the setup is comparable across runs and the result can be replicated.'
const CHUNK_ONE = 'The evaluation protocol uses a fixed method with the same public dataset, so the setup stays comparable across runs and every experiment is repeated. This paragraph holds the ' + MARKER + ' inside the stored full text.'

// 一篇「已经入库全文」的文献：两段 chunk，标记句只在第二段里。
const SEEDED_PAPER = {
  id: 'p_seed0001',
  title: 'A seeded paper with stored chunks',
  abstract: 'A study of a fixed evaluation method on a public dataset. It reports the ' + MARKER + ' as the marker used by the harness.',
  venue: 'Journal of Seeded Studies',
  year: 2024,
  doi: '10.1234/seeded',
  source: 'arxiv',
  authors: ['Ada Lovelace'],
  status: 'reading',
  notes: [],
  chunks: [
    { index: 0, heading: 'Introduction', text: CHUNK_ZERO },
    { index: 1, heading: 'Results', text: CHUNK_ONE },
  ],
}

// 一篇普通文献：摘要里覆盖四个综述视角的检索词。
const FIXTURE_PAPER = {
  title: 'A grounded evaluation protocol for literature research',
  abstract: 'A grounded evaluation protocol for a literature research desk is described here. The method fixes one public dataset and one setup before any experiment runs, so every result stays comparable across runs and the evidence can be replicated by another laboratory. We report the measurement of each outcome together with the significant differences found between the two setups, and we mark a finding as supported only when the evidence is repeatable. The protocol also records a conflict between two datasets whose evaluation differs, and this inconsistency is reported as an open limitation rather than hidden. The gap we leave open is the unresolved question of which future design should be the standard challenge, and the protocol suggests the missing work a replication study should cover.',
  venue: 'Journal of Grounded Evaluation',
  year: 2024,
  doi: '10.1234/grounded',
  source: 'arxiv',
  authors: ['Grace Hopper', 'Alan Turing'],
  tags: ['evaluation'],
}

const REVIEW_QUOTE = 'method fixes one public dataset and one setup before any experiment runs'
const QUESTION = 'Which method and dataset setup does the evaluation protocol use?'

// ── 基础动作 ─────────────────────────────────────────────────────────────────

test('status 与 models 两个动作都返回 ok', async () => {
  const { svc } = freshService()

  const status = await svc.run({ action: 'status' })
  assert.equal(status.ok, true)
  assert.equal(status.action, 'status')
  assert.equal(status.count, 0)
  assert.match(status.message, /fake\/fake\/model/)

  const models = await svc.run({ action: 'models' })
  assert.equal(models.ok, true)
  assert.equal(models.action, 'models')
  assert.deepEqual(models.models, [{ provider: 'fake', model: 'fake/model', label: 'fake/model' }])
})

test('不认识的动作被拒绝，不会走进任何分支', async () => {
  const { svc } = freshService()
  const result = await svc.run({ action: 'nope' })
  assert.equal(result.ok, false)
  assert.match(result.message, /不认识/)
})

// ── 设置 ─────────────────────────────────────────────────────────────────────

test('settings 描述覆盖全部声明的设置项，补丁能落盘，reset 恢复默认', async () => {
  const { svc, dir } = freshService()

  const view = await svc.run({ action: 'settings' })
  assert.equal(view.ok, true)
  assert.equal(view.rows.length, SETTING_DEFS.length)
  const keys = view.rows.map(row => row.key)
  for (const def of SETTING_DEFS) assert.ok(keys.includes(def.key), def.key)

  const patched = await svc.run({ action: 'settings', patch: { maxResults: 22, 'stats.adjust': 'bonferroni' } })
  assert.equal(patched.ok, true)
  assert.deepEqual(patched.changed.slice().sort(), ['maxResults', 'stats.adjust'])
  assert.equal(patched.settings.maxResults, 22)
  assert.equal(patched.settings['stats.adjust'], 'bonferroni')

  // 值真的写进了状态文件，不只是回显。
  const stored = JSON.parse(readFileSync(statePath(dir), 'utf8'))
  assert.equal(stored.settings.maxResults, 22)
  assert.equal(stored.settings['stats.adjust'], 'bonferroni')

  const reset = await svc.run({ action: 'settings', reset: true })
  assert.equal(reset.ok, true)
  assert.equal(reset.settings.maxResults, 15)
  assert.equal(reset.settings['stats.adjust'], 'holm')
})

test('密钥设置只存环境变量名，设置视图里不会出现密钥的值', async () => {
  const { svc, dir } = freshService()
  process.env.RD_TEST_OPENALEX_KEY = 'super-secret-value'
  try {
    const patched = await svc.run({ action: 'settings', patch: { 'secrets.openalexKey': 'RD_TEST_OPENALEX_KEY' } })
    assert.equal(patched.ok, true)
    // 存下来的是环境变量名，不是值。
    assert.equal(patched.settings['secrets.openalexKey'], 'RD_TEST_OPENALEX_KEY')

    const view = await svc.run({ action: 'settings' })
    const row = view.rows.find(item => item.key === 'secrets.openalexKey')
    assert.equal(row.secret, true)
    assert.equal(row.present, true)
    // 面板只回变量名，密钥值永远不出现。
    assert.equal(row.value, 'RD_TEST_OPENALEX_KEY')
    assert.ok(!JSON.stringify(view.rows).includes('super-secret-value'))

    const stored = readFileSync(statePath(dir), 'utf8')
    assert.ok(stored.includes('RD_TEST_OPENALEX_KEY'))
    assert.ok(!stored.includes('super-secret-value'))
  } finally {
    delete process.env.RD_TEST_OPENALEX_KEY
  }
})

test('非法设置值被拒绝，旧值保留', async () => {
  const { svc } = freshService()
  const result = await svc.run({ action: 'settings', patch: { 'stats.adjust': 'sidak' } })
  assert.equal(result.ok, false)
  assert.equal(result.settings['stats.adjust'], 'holm')
})

// ── 检索 ─────────────────────────────────────────────────────────────────────

test('search 的数据源列表里没有可用源时返回零结果，而且一次网络请求都没有', async () => {
  const { svc } = freshService()
  const before = networkCalls.length
  const result = await svc.run({ action: 'search', query: 'retrieval augmented generation', sources: ['scopus'] })
  assert.equal(result.ok, true)
  assert.equal(result.action, 'search')
  assert.equal(result.count, 0)
  assert.deepEqual(result.papers, [])
  assert.deepEqual(result.errors, [])
  assert.equal(networkCalls.length, before)
})

test('search: maxResults 真的传到了检索器（URL 里的条数参数）', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'settings', patch: { maxResults: 3 } })

  const before = networkCalls.length
  const result = await svc.run({ action: 'search', query: 'retrieval augmented generation' })
  const calls = networkCalls.slice(before)
  assert.equal(result.ok, true)
  assert.equal(calls.length, 3)
  assert.ok(calls.some(url => url.includes('export.arxiv.org/api/query') && url.includes('max_results=3')), calls.join('\n'))
  assert.ok(calls.some(url => url.includes('europepmc') && url.includes('pageSize=3')), calls.join('\n'))
  assert.ok(calls.some(url => url.includes('openalex') && url.includes('per-page=3')), calls.join('\n'))

  // 调用参数里的 maxResults 覆盖设置。
  const before2 = networkCalls.length
  await svc.run({ action: 'search', query: 'retrieval augmented generation', maxResults: 5 })
  const calls2 = networkCalls.slice(before2)
  assert.ok(calls2.some(url => url.includes('max_results=5')), calls2.join('\n'))
})

test('search: sources 为空数组时一个源都不检索，也不发任何请求', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'settings', patch: { sources: [] } })

  const before = networkCalls.length
  const result = await svc.run({ action: 'search', query: 'retrieval augmented generation', sources: [] })
  const calls = networkCalls.slice(before)
  assert.equal(result.ok, false)
  assert.equal(result.count, 0)
  assert.match(result.message, /没有选中任何数据源/)
  // 设置文案承诺「留空则三个源都不检索」，所以这里必须一次请求都不发。
  assert.equal(calls.length, 0)
})

// ── 文献库 ───────────────────────────────────────────────────────────────────

test('add 存下文献并在 library 视图里列得出来，read 把正文切块入库', async () => {
  const { svc } = freshService()

  const added = await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })
  assert.equal(added.ok, true)
  assert.equal(added.count, 1)
  assert.equal(added.library.papers.length, 1)
  assert.equal(added.library.papers[0].title, FIXTURE_PAPER.title)
  assert.equal(added.library.papers[0].chunks, 0)

  const id = added.library.papers[0].id
  assert.equal(typeof id, 'string')
  assert.ok(id.length > 0)

  const read = await svc.run({ action: 'read', paperId: id })
  assert.equal(read.ok, true)
  assert.equal(read.action, 'read')
  assert.ok(read.chunks >= 1)
  assert.equal(read.paper.id, id)
  assert.ok(read.library.papers[0].chunks >= 1)
})

test('library 动作在库非空时正确列出文献', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })

  // 曾经在这里崩过：host.mjs 先把 papers.map(...).join('\n') 算成了字符串，
  // 下一行又对这个字符串调用 lines.join('\n')。现在 lines 保持数组。
  const library = await svc.run({ action: 'library' })
  assert.equal(library.ok, true)
  assert.equal(library.count, 1)
  assert.match(library.message, /文献库 1 篇/)
  assert.match(library.message, new RegExp(FIXTURE_PAPER.title.slice(0, 12)))

  // 库为空时同一个动作给出提示语。
  const empty = freshService()
  const emptyLibrary = await empty.svc.run({ action: 'library' })
  assert.equal(emptyLibrary.ok, true)
  assert.equal(emptyLibrary.count, 0)
  assert.match(emptyLibrary.message, /文献库是空的/)
})

test('read 找不到这篇文献时直接拒绝', async () => {
  const { svc } = freshService()
  const result = await svc.run({ action: 'read', paperId: 'p_nope' })
  assert.equal(result.ok, false)
  assert.match(result.message, /找不到/)
})

// ── 实验 ─────────────────────────────────────────────────────────────────────

test('runner.enabled=false 时 run 动作拒绝执行，也不留实验记录', async () => {
  const { svc } = freshService()
  const result = await svc.run({ action: 'run', runtime: 'node', code: 'console.log(1)' })
  assert.equal(result.ok, false)
  assert.match(result.message, /runner\.enabled/)

  const experiments = await svc.run({ action: 'experiments' })
  assert.equal(experiments.count, 0)
})

test('runner.enabled=true 时 run 真的跑起来，实验记录存下状态、退出码与耗时', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'settings', patch: { 'runner.enabled': true, 'runner.nodePath': process.execPath } })

  const result = await svc.run({
    action: 'run',
    runtime: 'node',
    code: 'console.log("hello-desk")',
    title: '冒烟实验',
  })
  assert.equal(result.ok, true)
  assert.equal(result.action, 'run')
  assert.match(result.experiment.stdout, /hello-desk/)
  assert.equal(result.experiment.status, 'done')
  assert.equal(result.experiment.exitCode, 0)
  assert.equal(typeof result.experiment.durationMs, 'number')
  assert.ok(result.experiment.durationMs >= 0)

  const list = await svc.run({ action: 'experiments' })
  assert.equal(list.ok, true)
  assert.equal(list.count, 1)
  assert.equal(list.experiments[0].title, '冒烟实验')
  assert.equal(list.experiments[0].exitCode, 0)
  assert.equal(list.experiments[0].runtime, 'node')
})

// ── 问答 ─────────────────────────────────────────────────────────────────────

test('ask: 核验通过的引文留下，对不上的引文记成未核验', async () => {
  const { svc } = freshService({ papers: [SEEDED_PAPER], settings: {} })

  modelText = JSON.stringify({
    answer: 'The protocol uses a fixed method and the same dataset.',
    citations: [
      { chunkId: 'p_seed0001#1', quote: MARKER },
      { chunkId: 'p_seed0001#0', quote: MARKER },
      { chunkId: 'p_seed0001#1', quote: 'a sentence nobody ever wrote' },
    ],
  })
  const result = await svc.run({ action: 'ask', question: QUESTION })
  assert.equal(result.ok, true)
  assert.equal(result.action, 'ask')
  assert.equal(result.citations.length, 1)
  assert.equal(result.citations[0].chunkId, 'p_seed0001#1')
  assert.equal(result.citations[0].quote, MARKER)
  assert.equal(result.unverified.length, 2)
  for (const cite of result.unverified) assert.match(cite.reason, /not present in source/)
})

test('ask: qa.shareFullText=false 时只用摘要作答', async () => {
  const { svc } = freshService({ papers: [SEEDED_PAPER], settings: {} })
  await svc.run({ action: 'settings', patch: { 'qa.shareFullText': false } })

  modelText = JSON.stringify({
    answer: 'The abstract carries the marker.',
    citations: [
      { chunkId: 'p_seed0001#0', quote: MARKER },
      { chunkId: 'p_seed0001#1', quote: MARKER },
    ],
  })
  const result = await svc.run({ action: 'ask', question: QUESTION })
  assert.equal(result.ok, true)
  // 摘要里的标记句核验通过；全文那一段根本没送进去，所以找不到对应段落。
  assert.equal(result.citations.length, 1)
  assert.equal(result.citations[0].chunkId, 'p_seed0001#0')
  assert.equal(result.unverified.length, 1)
  assert.equal(result.unverified[0].reason, 'no matching chunk')
})

test('ask: 没有入库全文时直接拒绝', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })
  const result = await svc.run({ action: 'ask', question: QUESTION })
  assert.equal(result.ok, false)
  assert.match(result.message, /全文/)
})

// ── 选题与草稿 ───────────────────────────────────────────────────────────────

test('hypothesis 与 draft 会落库，并出现在 library 视图里', async () => {
  const { svc } = freshService()
  const added = await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })
  const id = added.library.papers[0].id

  modelText = JSON.stringify({
    hypotheses: [{
      title: '检索基线可以更小',
      rationale: '摘要里提到方法固定',
      gap: '缺少跨库比较',
      experiment: '跑一遍基线',
      evidence: [id],
    }],
  })
  const hypothesis = await svc.run({ action: 'hypothesis' })
  assert.equal(hypothesis.ok, true)
  assert.equal(hypothesis.count, 1)
  assert.equal(hypothesis.library.hypotheses.length, 1)
  assert.equal(hypothesis.library.hypotheses[0].title, '检索基线可以更小')
  assert.deepEqual(hypothesis.library.hypotheses[0].evidence, [id])

  modelText = JSON.stringify({ title: '论文大纲', body: '引言部分来自文献库。', refs: [id] })
  const draft = await svc.run({ action: 'draft' })
  assert.equal(draft.ok, true)
  assert.equal(draft.library.drafts.length, 1)
  assert.equal(draft.library.drafts[0].title, '论文大纲')
  assert.deepEqual(draft.library.drafts[0].refs, [id])
})

// ── 综述与缺口 ───────────────────────────────────────────────────────────────

test('review 存下综述段落，核验通过的引文一起入库', async () => {
  const { svc } = freshService()
  const added = await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })
  const id = added.library.papers[0].id
  await svc.run({ action: 'read', paperId: id })

  modelText = JSON.stringify({
    text: '这些研究都用同一套评估协议 [S1]。',
    citations: [{ chunkId: id + '#0', quote: REVIEW_QUOTE }],
  })
  const review = await svc.run({ action: 'review', topic: '评估协议' })
  assert.equal(review.ok, true)
  assert.equal(review.action, 'review')
  assert.ok(review.review.sections.length >= 1)
  assert.equal(review.library.reviews.length, 1)

  const stored = review.library.reviews[0]
  assert.equal(stored.topic, '评估协议')
  assert.ok(stored.sections.length >= 1)
  const cited = stored.sections.filter(section => section.citations.length > 0)
  assert.ok(cited.length >= 1)
  assert.equal(cited[0].citations[0].chunkId, id + '#0')
  assert.equal(cited[0].citations[0].quote, REVIEW_QUOTE)
  assert.ok(stored.stats.sections >= 1)
})

test('gaps 动作产出一个研究缺口段落', async () => {
  const { svc } = freshService()
  const added = await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })
  const id = added.library.papers[0].id
  await svc.run({ action: 'read', paperId: id })

  modelText = JSON.stringify({
    text: '缺口在于跨库比较还没有做过 [S1]。',
    citations: [{ chunkId: id + '#0', quote: REVIEW_QUOTE }],
  })
  const gaps = await svc.run({ action: 'gaps', topic: '评估协议' })
  assert.equal(gaps.ok, true)
  assert.equal(gaps.action, 'gaps')
  assert.ok(gaps.gaps.text.length > 0)
  assert.equal(gaps.library.reviews[0].sections[0].key, 'gaps')
  assert.equal(gaps.library.reviews[0].sections[0].citations.length, 1)
})

// ── 导出 ─────────────────────────────────────────────────────────────────────

test('export 一次给全 md / bib / json，json 里没有密钥值也没有环境变量名', async () => {
  const { svc } = freshService()
  process.env.RD_EXPORT_OPENALEX_KEY = 'super-secret-value'
  try {
    await svc.run({ action: 'settings', patch: { 'secrets.openalexKey': 'RD_EXPORT_OPENALEX_KEY' } })
    await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })

    const result = await svc.run({ action: 'export' })
    assert.equal(result.ok, true)
    assert.equal(result.action, 'export')
    assert.deepEqual(result.files.map(file => file.format), ['md', 'bib', 'json'])

    const json = result.files.find(file => file.format === 'json').content
    assert.ok(json.includes(FIXTURE_PAPER.title))
    assert.ok(!json.includes('super-secret-value'))
    assert.ok(!json.includes('RD_EXPORT_OPENALEX_KEY'))

    const md = result.files.find(file => file.format === 'md').content
    assert.ok(md.includes(FIXTURE_PAPER.title))

    const bib = result.files.find(file => file.format === 'bib').content
    assert.ok(bib.includes('10.1234/grounded'))
  } finally {
    delete process.env.RD_EXPORT_OPENALEX_KEY
  }
})

// ── 删除与撤销 ───────────────────────────────────────────────────────────────

test('remove 删掉文献，undo 把它恢复回来', async () => {
  const { svc } = freshService()
  const added = await svc.run({ action: 'add', papers: [FIXTURE_PAPER] })
  const id = added.library.papers[0].id

  const removed = await svc.run({ action: 'remove', paperId: id })
  assert.equal(removed.ok, true)
  assert.equal(removed.library.papers.length, 0)

  const undone = await svc.run({ action: 'undo' })
  assert.equal(undone.ok, true)
  assert.equal(undone.library.papers.length, 1)
  assert.equal(undone.library.papers[0].id, id)
  assert.equal(undone.library.papers[0].title, FIXTURE_PAPER.title)
})

// ── 工具注册 ─────────────────────────────────────────────────────────────────

test('apply 注册 research_desk 工具，action 枚举覆盖全部动作', () => {
  const registered = { tool: null, routes: [] }
  const toolCtx = {
    get: ctx.get,
    effect: fn => {
      fn()
      return () => {}
    },
    tools: { register: def => { registered.tool = def } },
    webServer: { register: def => { registered.routes.push(def) } },
  }
  apply(toolCtx)

  assert.ok(registered.tool)
  assert.equal(registered.tool.name, 'research_desk')
  assert.equal(registered.routes.length, 1)
  const actions = registered.tool.parameters.properties.action.enum
  for (const action of ['status', 'search', 'add', 'library', 'read', 'ask', 'hypothesis', 'review', 'gaps', 'draft', 'remove', 'undo', 'models', 'settings', 'experiments', 'run', 'stats', 'export']) {
    assert.ok(actions.includes(action), action)
  }

  const rendered = registered.tool.output.render({}, { ok: true, action: 'status', message: 'hello', count: 2 })
  assert.equal(rendered[0].type, 'text')
  assert.match(rendered[0].text, /hello/)
  assert.match(rendered[0].text, /2/)
})

test('工具的 execute 走的是同一套服务', async () => {
  const registered = { tool: null }
  const toolCtx = {
    get: ctx.get,
    effect: fn => {
      fn()
      return () => {}
    },
    tools: { register: def => { registered.tool = def } },
    webServer: { register: () => {} },
  }
  apply(toolCtx)

  const result = await registered.tool.execute({ action: 'status' }, { signal: undefined })
  assert.equal(result.ok, true)
  assert.equal(result.action, 'status')
})
