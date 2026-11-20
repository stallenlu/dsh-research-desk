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
import { canProceed } from '../lib/approval.mjs'

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
// 视觉能力检查：默认按模型名判定——名字含 vl 的算视觉模型，其余只有文本。
// 单个用例可临时改写它来覆盖「resolveModelInfo 抛错/不返回 inputModalities」分支。
let resolveModelInfoImpl = async (provider, model) => ({ inputModalities: (model && String(model).includes('vl')) ? ['text', 'image'] : ['text'] })

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
  resolveModelInfo: async (provider, model) => resolveModelInfoImpl(provider, model),
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

// ── Phase1 带队合作 / 安全闸门 ───────────────────────────────────────────────

test('collab_create 落库并带着角色与 library 视图返回', async () => {
  const { svc } = freshService()
  const r = await svc.run({ action: 'collab_create', title: '验证带队', goal: { text: '看机制能否跑通', source: 'human' }, kelinRole: 'engineer', autonomy: 'L2' })
  assert.equal(r.ok, true)
  assert.ok(r.collab && r.collab.id)
  assert.equal(r.collab.kelinRole, 'engineer')
  assert.equal(r.collab.autonomy, 'L2')
  assert.equal(r.collab.status, 'active')
  assert.equal(r.library.collaborations.length, 1)
  assert.equal(r.library.collaborations[0].title, '验证带队')
})

test('八个 collab action 名都在工具枚举里', () => {
  const registered = { tool: null }
  apply({
    get: ctx.get,
    effect: fn => { fn(); return () => {} },
    tools: { register: def => { registered.tool = def } },
    webServer: { register: () => {} },
  })
  const actions = registered.tool.parameters.properties.action.enum
  for (const a of ['collab_create','collab_step','collab_plan','collab_decision_ask','collab_decision_answer','collab_run','collab_evaluate','collab_list']) {
    assert.ok(actions.includes(a), '缺少 action: ' + a)
  }
  const props = registered.tool.parameters.properties
  for (const p of ['collabId','goal','step','point','choice','by','decisionId','payload','conclusion','kelinRole','autonomy']) {
    assert.ok(props[p], '缺少参数声明: ' + p)
  }
})

test('collab_plan 生成 team/environment/steps 并写入，明确标注降级不声称可用', async () => {
  const { svc } = freshService()
  const c = await svc.run({ action: 'collab_create', title: '计划测试', goal: { text: '目标X', source: 'human' } })
  const p = await svc.run({ action: 'collab_plan', collabId: c.collab.id })
  assert.equal(p.ok, true)
  assert.equal(p.plan.source, 'template')
  assert.match(p.plan.note, /未调用子 agent/)
  assert.ok(p.plan.team.length >= 4)
  assert.equal(p.plan.steps.length, 5)
  const row = p.library.collaborations[0]
  assert.equal(row.team.length, 4)
  assert.equal(row.steps.length, 5)
  assert.ok(Array.isArray(row.environment.packages))
})

test('L1 自主级别每步要先人工确认；L2 可直接记步骤', async () => {
  const { svc } = freshService()
  const c1 = await svc.run({ action: 'collab_create', title: 'L1', autonomy: 'L1' })
  const s1 = await svc.run({ action: 'collab_step', collabId: c1.collab.id, step: { phase: 'p', decision: 'd', reason: 'r', refs: [] } })
  assert.equal(s1.ok, false)
  assert.equal(s1.gate, 'waiting-human')
  const c2 = await svc.run({ action: 'collab_create', title: 'L2', autonomy: 'L2' })
  const s2 = await svc.run({ action: 'collab_step', collabId: c2.collab.id, step: { phase: 'p', decision: 'd', reason: 'r', refs: [] } })
  assert.equal(s2.ok, true)
  assert.equal(s2.library.collaborations.find(x => x.id === c2.collab.id).steps.length, 1)
})

test('决策闸门：ask 停 waiting-human，answer 需 human 且恢复 active', async () => {
  const { svc } = freshService()
  const c = await svc.run({ action: 'collab_create', title: '决策', autonomy: 'L3' })
  const cid = c.collab.id
  const ask = await svc.run({ action: 'collab_decision_ask', collabId: cid, point: '是否装包', payload: { pkg: 'numpy' } })
  assert.equal(ask.ok, true)
  assert.ok(ask.decisionId)
  let row = ask.library.collaborations[0]
  assert.equal(row.status, 'waiting-human')
  const noHuman = await svc.run({ action: 'collab_decision_answer', collabId: cid, decisionId: ask.decisionId, choice: 'approve', by: 'agent' })
  assert.equal(noHuman.ok, false)
  const answer = await svc.run({ action: 'collab_decision_answer', collabId: cid, decisionId: ask.decisionId, choice: 'approve', by: 'human' })
  assert.equal(answer.ok, true)
  row = answer.library.collaborations[0]
  assert.equal(row.status, 'active')
  const decided = row.decisions.find(d => d.id === ask.decisionId)
  assert.equal(decided.pending, false)
  assert.equal(decided.choice, 'approve')
  assert.equal(decided.by, 'human')
})

test('高风险装包闸门：无 approve 停住，approve 后才算放行（不触发真实装包）', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'settings', patch: { 'runner.enabled': true, 'runner.nodePath': process.execPath } })
  const c = await svc.run({ action: 'collab_create', title: '闸门', autonomy: 'L3' })
  const cid = c.collab.id
  const blocked = await svc.run({ action: 'collab_run', collabId: cid, title: 't', runtime: 'node', code: 'console.log(1)', packages: ['some-unique-pkg'] })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.gate, 'waiting-human')
  const row1 = blocked.library.collaborations[0]
  assert.equal(row1.status, 'waiting-human')
  const inst = row1.decisions.find(d => d.point.indexOf('risk:install:') === 0)
  assert.ok(inst, '应生成 install 待决')
  // 闸门状态机：approve 之前 install 不可放行。
  const lib = await svc.run({ action: 'library' })
  const before = lib.library.collaborations[0]
  assert.equal(canProceed(before, 'install').ok, false)
  assert.equal(before.decisions.find(d => d.id === inst.id).pending, true)
  await svc.run({ action: 'collab_decision_answer', collabId: cid, decisionId: inst.id, choice: 'approve', by: 'human' })
  const after = (await svc.run({ action: 'library' })).library.collaborations[0]
  assert.equal(after.decisions.find(d => d.id === inst.id).pending, false)
  assert.equal(canProceed(after, 'install').ok, true)
  // 执行前的 workspace 闸门独立生效：装包 approve 不等于执行 approve。
  assert.equal(canProceed(after, 'workspace').ok, false, '尚无 workspace 决策时不得执行')
  const asked = await svc.run({ action: 'collab_decision_ask', collabId: cid, point: 'risk:workspace:执行实验代码' })
  const waiting = (await svc.run({ action: 'library' })).library.collaborations[0]
  assert.equal(waiting.status, 'waiting-human')
  assert.equal(canProceed(waiting, 'workspace').ok, false, 'pending 时不得执行')
  await svc.run({ action: 'collab_decision_answer', collabId: cid, decisionId: asked.decisionId, choice: 'approve', by: 'human' })
  const ready = (await svc.run({ action: 'library' })).library.collaborations[0]
  assert.equal(canProceed(ready, 'install').ok, true)
  assert.equal(canProceed(ready, 'workspace').ok, true)
  assert.equal(ready.status, 'active')
})

test('collab_run 复用执行链并把 runId 写进合作与反向索引', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'settings', patch: { 'runner.enabled': true, 'runner.nodePath': process.execPath } })
  const c = await svc.run({ action: 'collab_create', title: '运行', autonomy: 'L3' })
  const cid = c.collab.id
  const first = await svc.run({ action: 'collab_run', collabId: cid, title: 'r', runtime: 'node', code: 'console.log(7)' })
  assert.equal(first.gate, 'waiting-human')
  const ws = first.library.collaborations[0].decisions.find(d => d.point.indexOf('risk:workspace:') === 0 && d.pending === true)
  assert.ok(ws, '执行前应有 workspace 待决')
  await svc.run({ action: 'collab_decision_answer', collabId: cid, decisionId: ws.id, choice: 'approve', by: 'human' })
  const r = await svc.run({ action: 'collab_run', collabId: cid, title: 'r', runtime: 'node', code: 'console.log(7)' })
  assert.equal(r.ok, true)
  assert.ok(r.runId)
  const row = r.library.collaborations[0]
  assert.ok(row.experimentIds.includes(r.runId))
  assert.equal(r.library.collabByExperiment[r.runId], cid)
})

test('collab_evaluate 的 verdict 只读复制假说 status，传入 verdict 不生效', async () => {
  const seed = {
    papers: [], hypotheses: [{ id: 'h1', title: '假', status: 'supported', rationale: '', gap: '', experiment: '', evidence: [], at: null }],
    drafts: [], reviews: [],
    experiments: [{ id: 'e1', title: '实', hypothesisId: 'h1', status: 'done', runtime: 'node', code: '', params: {}, packages: [], artifacts: [], criteria: [], metrics: {}, createdAt: null }],
    collaborations: [], chat: [], settings: {},
  }
  const { svc } = freshService(seed)
  const c = await svc.run({ action: 'collab_create', title: '评估', autonomy: 'L3' })
  const e = await svc.run({ action: 'collab_evaluate', collabId: c.collab.id, runId: 'e1', conclusion: '结论', verdict: 'rejected' })
  assert.equal(e.ok, true)
  assert.equal(e.evaluation.verdict, 'supported')
  assert.notEqual(e.evaluation.verdict, 'rejected')
  assert.match(e.evaluation.verdictSource, /只读复制/)
  assert.equal(e.library.collaborations[0].evaluation.conclusion, '结论')
})

test('collab_list 返回 collaborations 与 library', async () => {
  const { svc } = freshService()
  await svc.run({ action: 'collab_create', title: 'A' })
  const r = await svc.run({ action: 'collab_list' })
  assert.equal(r.ok, true)
  assert.equal(r.collaborations.length, 1)
  assert.ok(r.library.collaborations)
})

test('approval 纯函数：风险判定与权限只降级不升级', async () => {
  const { canProceed, riskPoint, choosePermission, isHighRisk } = await import('../lib/approval.mjs')
  assert.equal(isHighRisk('install'), true)
  assert.equal(isHighRisk('library'), false)
  assert.match(riskPoint('install', '  a  b '), /^risk:install:a b$/)
  const noDec = { decisions: [] }
  assert.equal(canProceed(noDec, 'install').ok, false)
  const approved = { decisions: [{ point: 'risk:install:x', pending: false, choice: 'approve', by: 'human' }] }
  assert.equal(canProceed(approved, 'install').ok, true)
  assert.equal(canProceed(approved, 'workspace').ok, false)
  assert.deepEqual(choosePermission('read-only', 'danger-full-access'), { applied: 'read-only', upgraded: true })
  assert.deepEqual(choosePermission('read-only', 'workspace-write'), { applied: 'read-only', upgraded: true })
  assert.deepEqual(choosePermission('read-only', 'read-only'), { applied: 'read-only', upgraded: false })
  assert.deepEqual(choosePermission('workspace-write', 'read-only'), { applied: 'read-only', upgraded: false })
})

test('全局 kelin.role 声明存在；本次合作角色经边界消息注入而非 meta', async () => {
  assert.ok(SETTING_DEFS.some(d => d.key === 'kelin.role' && d.options && d.options.join(',') === 'lead,methodologist,engineer,analyst'))
  const injected = []
  const followups = []
  const appliedPerms = []
  const events = []
  const createMeta = []
  const agent = {
    inject: b => injected.push(b),
    followup: m => followups.push(m),
    whenIdle: async () => {},
    session: { deriveMessages: () => [] },
    // 无图片用例不应触发视觉检查；仍给出真实 API 形状以贴近线上 agent。
    model: { current: () => ({ provider: 'fake', model: 'fake/model' }) },
  }
  const chatCtx = {
    get: name => name === 'agents' ? { create: async opts => { createMeta.push(opts && opts.meta); if (opts && opts.setup) await opts.setup({ session: {} }); return { agent, dispose: () => {} } } } : ctx.get(name),
    on: () => () => {},
    permissionPresets: { set: async (sess, name) => { appliedPerms.push(name) } },
  }
  process.env.DSH_HOME = join(tempHome, 'case-chat-' + caseIndex++)
  const chatSvc = createService(chatCtx)
  const c = await chatSvc.run({ action: 'collab_create', title: '角色', kelinRole: 'analyst' })
  const stream = { write: (t, d) => events.push([t, d]), close: () => {} }
  await chatSvc.chatStream({ question: '你好', collabId: c.collab.id, perm: 'danger-full-access' }, stream)
  const boundary = injected.find(b => Array.isArray(b.content) && String(b.content[0].text).indexOf('本次科灵角色') >= 0)
  assert.ok(boundary, '应有角色边界消息')
  assert.match(boundary.content[0].text, /分析师/)
  assert.match(boundary.content[0].text, /来自本次合作设置/)
  assert.ok(createMeta.every(m => !m || (!m.kelinRole && !m.role)), '角色不得写进 meta')
  assert.deepEqual(appliedPerms, ['read-only'])
  assert.ok(events.some(e => e[0] === 'waiting-human'), '升级请求应产生 waiting-human')
  // 无图片：followup 内容与改造前一致，仍是单条纯文本块。
  assert.equal(followups.length, 1)
  assert.deepEqual(followups[0].content, [{ type: 'text', text: '你好' }])
  assert.ok(events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'vision' && e[1].imageCount === 0 && e[1].admitted === 0))
})

// ── 识图：送图前对齐官方链路的模型能力检查 ────────────────────────────────────
const VISION_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

/**
 * 造一个带图片能力的 chatStream 上下文；current 是 agent.model.current() 的返回值。
 * 返回 followups/events/admittedCalls 供断言，不联网、不调真模型。
 */
function visionChat(current) {
  const injected = []
  const followups = []
  const events = []
  const admittedCalls = []
  const fileAdmitCalls = []
  const agent = {
    inject: b => injected.push(b),
    followup: m => followups.push(m),
    whenIdle: async () => {},
    session: { deriveMessages: () => [] },
    model: { current: () => current },
  }
  const chatCtx = {
    get: name => (name === 'agents'
      ? { create: async () => ({ agent, dispose: () => {} }) }
      : name === 'attachments'
        ? {
            admitPromptContent: async parts => { admittedCalls.push(parts); return parts.map((p, i) => ({ type: 'image', url: 'attachment://img' + i })) },
            admitEncodedFile: async payload => { fileAdmitCalls.push(payload); return { kind: 'file', digest: 'sha256:' + payload.name, name: payload.name } },
          }
        : ctx.get(name)),
    on: () => () => {},
    permissionPresets: { set: async () => {} },
  }
  process.env.DSH_HOME = join(tempHome, 'case-vision-' + caseIndex++)
  const svc = createService(chatCtx)
  const stream = { write: (t, d) => events.push([t, d]), close: () => {} }
  return { svc, stream, events, followups, admittedCalls, fileAdmitCalls, injected }
}

test('识图：非视觉模型拦截——报错 + diag，图片不提纯、不并入 followup，文字照常', async () => {
  const prev = resolveModelInfoImpl
  resolveModelInfoImpl = async (provider, model) => ({ inputModalities: ['text'] })
  try {
    const t = visionChat({ provider: 'fake', model: 'fake/model' })
    await t.svc.chatStream({ question: '看这张图', diag: true, perm: 'read-only', images: [{ mediaType: 'image/png', data: VISION_PNG }] }, t.stream)
    const err = t.events.find(e => e[0] === 'error' && /不支持看图/.test(String(e[1] && e[1].message)))
    assert.ok(err, '应产生「不支持看图」的 error 帧')
    assert.match(err[1].message, /图片未被发送/)
    assert.ok(t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'vision-model-unsupported' && e[1].provider === 'fake' && e[1].model === 'fake/model'), '应产生 vision-model-unsupported diag')
    assert.equal(t.admittedCalls.length, 0, '非视觉模型不得提纯图片')
    assert.equal(t.followups.length, 1)
    assert.deepEqual(t.followups[0].content, [{ type: 'text', text: '看这张图' }], 'followup 只有文字块，图片未发送')
    assert.ok(t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'vision' && e[1].imageCount === 1 && e[1].admitted === 0))
  } finally {
    resolveModelInfoImpl = prev
  }
})

test('识图：视觉模型放行——不报错，走提纯且图片块并入 followup', async () => {
  const prev = resolveModelInfoImpl
  resolveModelInfoImpl = async (provider, model) => ({ inputModalities: ['text', 'image'] })
  try {
    const t = visionChat({ provider: 'fake', model: 'fake/vl' })
    await t.svc.chatStream({ question: '看这张图', diag: true, perm: 'read-only', images: [{ mediaType: 'image/png', data: VISION_PNG }] }, t.stream)
    assert.ok(!t.events.some(e => e[0] === 'error' && /不支持看图/.test(String(e[1] && e[1].message))), '视觉模型不得报错')
    assert.ok(!t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'vision-model-unsupported'))
    assert.equal(t.admittedCalls.length, 1, '视觉模型应提纯图片')
    assert.equal(t.followups.length, 1)
    assert.equal(t.followups[0].content.length, 2)
    assert.deepEqual(t.followups[0].content[0], { type: 'image', url: 'attachment://img0' })
    assert.deepEqual(t.followups[0].content[1], { type: 'text', text: '看这张图' })
    assert.ok(t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'vision' && e[1].imageCount === 1 && e[1].admitted === 1))
  } finally {
    resolveModelInfoImpl = prev
  }
})

test('识图：resolveModelInfo 抛错只写 diag、不阻断，行为退化为照旧提纯', async () => {
  const prev = resolveModelInfoImpl
  resolveModelInfoImpl = async () => { throw new Error('resolve boom') }
  try {
    const t = visionChat({ provider: 'fake', model: 'fake/model' })
    await t.svc.chatStream({ question: '看这张图', diag: true, perm: 'read-only', images: [{ mediaType: 'image/png', data: VISION_PNG }] }, t.stream)
    assert.ok(t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'vision-model-check-fail'), '应记录 vision-model-check-fail diag')
    assert.ok(!t.events.some(e => e[0] === 'error' && /不支持看图/.test(String(e[1] && e[1].message))), '检查失败不得误报不支持看图')
    assert.equal(t.admittedCalls.length, 1, '检查失败仍照旧提纯')
    assert.equal(t.followups.length, 1)
    assert.equal(t.followups[0].content.length, 2)
  } finally {
    resolveModelInfoImpl = prev
  }
})

// ── 文件随消息进 agent：走 DSH 原生 attachments.admitEncodedFile ─────────────
const FILE_DATA = Buffer.from('hello research doc').toString('base64') // canonical base64，长度≥16

test('文件：随 chat_stream 的 files 经 admitEncodedFile 提纯，file 块并入 followup', async () => {
  const t = visionChat({ provider: 'fake', model: 'fake/model' })
  await t.svc.chatStream({ question: '分析这份文件', perm: 'read-only', files: [{ name: 'report.pdf', data: FILE_DATA }] }, t.stream)
  assert.equal(t.fileAdmitCalls.length, 1, '应调用一次 admitEncodedFile')
  assert.deepEqual(t.fileAdmitCalls[0], { data: FILE_DATA, name: 'report.pdf' }, '传给 attachment 服务的应是 {data,name}')
  assert.equal(t.followups.length, 1)
  assert.equal(t.followups[0].content.length, 2)
  assert.deepEqual(t.followups[0].content[0], { type: 'file', attachment: { kind: 'file', digest: 'sha256:report.pdf', name: 'report.pdf' } })
  assert.deepEqual(t.followups[0].content[1], { type: 'text', text: '分析这份文件' })
  assert.ok(t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'files' && e[1].count === 1))
})

test('文件：无 files 时行为与改造前完全一致，仍只发文本且不调用 admitEncodedFile', async () => {
  const t = visionChat({ provider: 'fake', model: 'fake/model' })
  await t.svc.chatStream({ question: '你好', perm: 'read-only' }, t.stream)
  assert.equal(t.fileAdmitCalls.length, 0, '无 files 不得调用 admitEncodedFile')
  assert.deepEqual(t.followups[0].content, [{ type: 'text', text: '你好' }])
  assert.ok(t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'files' && e[1].count === 0))
})

test('文件：非法 base64 跳过并 diag，不阻断文字对话', async () => {
  const t = visionChat({ provider: 'fake', model: 'fake/model' })
  await t.svc.chatStream({ question: '继续', perm: 'read-only', files: [{ name: 'bad.pdf', data: '!!!not-base64!!!' }] }, t.stream)
  assert.equal(t.fileAdmitCalls.length, 0, '非法字节不得提纯')
  assert.ok(t.events.some(e => e[0] === 'diag' && e[1] && e[1].at === 'file-bad-base64' && e[1].name === 'bad.pdf'))
  assert.deepEqual(t.followups[0].content, [{ type: 'text', text: '继续' }], '文字对话照常')
})
