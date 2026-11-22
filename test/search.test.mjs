// Unit tests for the query building and markup stripping in lib/search.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { arxivQuery, fetchFullText, search, searchDisclosure, stripHtml, WEB_UNTRUSTED_NOTICE } from '../lib/search.mjs'

test('arxivQuery joins terms with AND so a natural-language query still matches', () => {
  const q = arxivQuery('retrieval augmented generation')
  assert.equal(q, 'all:retrieval AND all:augmented AND all:generation')
})

test('arxivQuery keeps quoted phrases and drops stop punctuation', () => {
  const q = arxivQuery('"large language model" agents (RL)')
  assert.ok(q.includes('all:"large language model"'))
  assert.ok(q.includes('all:agents'))
  assert.ok(q.includes('all:RL'))
})

test('arxivQuery caps the term count and falls back to a wildcard', () => {
  const many = 'a b c d e f g h i j k'.split(' ')
  const q = arxivQuery(many.join(' '))
  assert.equal(q.split(' AND ').length, 8)
  assert.equal(arxivQuery('   '), 'all:*')
})

test('arxivQuery in or mode produces an OR chain', () => {
  const q = arxivQuery('retrieval augmented', { mode: 'or' })
  assert.equal(q, 'all:retrieval OR all:augmented')
})

test('stripHtml removes JATS metadata noise from an Europe PMC full text', () => {
  const xml = [
    '<article xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '<journal-meta><journal-title>Nature</journal-title><issn>0028-0836</issn></journal-meta>',
    '<contrib-group><contrib><name>Smith J</name></contrib></contrib-group>',
    '<body><p>Widgets were calibrated daily.</p><p>Second paragraph here.</p></body>',
    '<ref-list><ref><element-citation>Some reference</element-citation></ref></ref-list>',
    '</article>',
  ].join('')
  const text = stripHtml(xml)
  assert.ok(text.includes('Widgets were calibrated daily.'))
  assert.ok(text.includes('Second paragraph here.'))
  assert.ok(!text.includes('Smith J'))
  assert.ok(!text.includes('0028-0836'))
  assert.ok(!text.includes('Some reference'))
})

// ── fetchFullText 三源铁律与 web_fetch 回退 ─────────────────────────────────────
const LONG_TEXT = 'Widgets were calibrated daily with replicated measurements. '.repeat(60)

function mockCtx(result, calls) {
  return {
    get: name => name === 'tools' ? {
      executable: n => n === 'web_fetch' ? { name: 'web_fetch', parameters: { properties: { url: { type: 'string' } } } } : null,
      selectExecutor: () => ({ describe: () => ({ schemas: [{ name: 'web_fetch' }] }) }),
      execute: async payload => {
        calls.push(payload)
        const id = payload.calls[0].id
        return { results: [{ callId: id, result: typeof result === 'function' ? result(payload) : result }] }
      },
    } : undefined,
  }
}

test('fetchFullText 铁律：pmcid/arxivId 已有全文时不调 web_fetch', async () => {
  const calls = []
  const ctx = mockCtx({ isError: false, value: { content: LONG_TEXT } }, calls)
  const realFetch = global.fetch
  const fmCalls = []
  global.fetch = async (url, opts) => {
    fmCalls.push(String(url))
    return { ok: true, status: 200, text: async () => '<article><body><p>' + LONG_TEXT + '</p></body></article>' }
  }
  try {
    const pmc = await fetchFullText({ pmcid: 'PMC1234567', abstract: 'short abstract', url: 'https://example.org/article' }, { ctx })
    assert.equal(pmc.kind, 'fulltext')
    assert.ok(fmCalls.some(u => u.includes('ebi.ac.uk')), 'PMC 全文经由 EBI fullTextXML')
    const arxiv = await fetchFullText({ arxivId: '2401.00001', abstract: 'short abstract', url: 'https://arxiv.org/abs/2401.00001' }, { ctx })
    assert.equal(arxiv.kind, 'html')
    assert.ok(fmCalls.some(u => u.includes('arxiv.org/html/')), 'arXiv 全文经由 arxiv.org/html')
    assert.equal(calls.length, 0, '前两环已有全文时绝不调用 web_fetch')
  } finally {
    global.fetch = realFetch
  }
})

test('fetchFullText: 仅摘要 + 有 URL → web_fetch 成功入 chunk kind web', async () => {
  const calls = []
  const ctx = mockCtx({ isError: false, value: { content: '<p>' + LONG_TEXT + '</p>' } }, calls)
  const r = await fetchFullText({ abstract: 'short abstract', url: 'https://example.org/article' }, { ctx })
  assert.equal(r.kind, 'web')
  assert.equal(r.url, 'https://example.org/article')
  assert.ok(r.text.length > 1500)
  assert.ok(!r.text.includes('<p>'), 'HTML 标签应被 stripHtml 剥掉')
  assert.equal(calls.length, 1)
  const args = JSON.parse(calls[0].calls[0].arguments)
  assert.equal(args.url, 'https://example.org/article')
})

test('fetchFullText: web_fetch 验真失败/不可用 → 保摘要不标 web', async () => {
  const calls = []
  const noTools = { get: () => undefined }
  const r1 = await fetchFullText({ abstract: 'short abstract', url: 'https://example.org/article' }, { ctx: noTools })
  assert.equal(r1.kind, 'abstract')
  assert.equal(r1.text, 'short abstract')
  assert.equal(calls.length, 0)
  // def 在场但 execute 失败
  const ctxErr = mockCtx({ isError: true, error: { message: 'blocked' } }, calls)
  const r2 = await fetchFullText({ abstract: 'short abstract', url: 'https://example.org/article' }, { ctx: ctxErr })
  assert.equal(r2.kind, 'abstract')
  assert.equal(r2.text, 'short abstract')
})

test('fetchFullText: 质量阈值不足/壳页 → 保摘要', async () => {
  const calls = []
  const short = mockCtx({ isError: false, value: { content: '<p>too short</p>' } }, calls)
  const r1 = await fetchFullText({ abstract: 'short abstract', url: 'https://example.org/article' }, { ctx: short })
  assert.equal(r1.kind, 'abstract')
  const shellCalls = []
  const shell = mockCtx({ isError: false, value: { content: '<p>Please sign in to continue. ' + LONG_TEXT + '</p>' } }, shellCalls)
  const r2 = await fetchFullText({ abstract: 'short abstract', url: 'https://example.org/article' }, { ctx: shell })
  assert.equal(r2.kind, 'abstract')
})

test('fetchFullText: 无可用 URL → 直接摘要，不调 web_fetch', async () => {
  const calls = []
  const ctx = mockCtx({ isError: false, value: { content: LONG_TEXT } }, calls)
  const r = await fetchFullText({ abstract: 'short abstract' }, { ctx })
  assert.equal(r.kind, 'abstract')
  assert.equal(r.text, 'short abstract')
  assert.equal(calls.length, 0)
})

test('WEB_UNTRUSTED_NOTICE 是不可信数据边界标记', () => {
  assert.ok(WEB_UNTRUSTED_NOTICE.includes('仅作证据'))
  assert.ok(WEB_UNTRUSTED_NOTICE.includes('忽略'))
  assert.ok(WEB_UNTRUSTED_NOTICE.includes('web_fetch'))
})

// ── D8 议程透明：结构化披露（纯函数，不发网络请求） ─────────────────────────
test('D8 议程透明：searchDisclosure 披露 queriedSources/query/perSourceErrors/declinedCount/limitations', () => {
  const settled = [
    { name: 'arxiv', rows: [] },
    { name: 'europepmc', rows: [], error: '连接超时' },
  ]
  const d = searchDisclosure('  连续确信度  ', ['arxiv', 'europepmc', 'bogus'], ['arxiv', 'europepmc'], settled)
  assert.deepEqual(d.queriedSources, ['arxiv', 'europepmc'])
  assert.equal(d.query, '  连续确信度  ')
  assert.deepEqual(d.perSourceErrors, [{ source: 'europepmc', error: '连接超时' }])
  assert.equal(d.declinedCount, 1, '请求了无 runner 的源 bogus，declinedCount=1')
  assert.ok(Array.isArray(d.limitations) && d.limitations.length > 0)
  assert.ok(d.limitations.some(function (x) { return x.includes('逐字核验') }))
})

test('D8 议程透明：declinedCount 不是 errors 条数，失败源同时进 perSourceErrors 和 queriedSources', () => {
  const settled = [{ name: 'arxiv', rows: [], error: 'A' }, { name: 'openalex', rows: [], error: 'B' }]
  const d = searchDisclosure('q', ['arxiv', 'openalex'], ['arxiv', 'openalex'], settled)
  assert.equal(d.declinedCount, 0, '两源都有 runner，declinedCount=0')
  assert.equal(d.perSourceErrors.length, 2)
  assert.deepEqual(d.queriedSources, ['arxiv', 'openalex'])
})


test('D8 search 空 query 端到端回执带披露五字段', async () => {
  const r = await search('   ')
  assert.deepEqual(r.queriedSources, [], 'queriedSources 为空数组')
  assert.equal(r.query, '', 'query 经 trim 后为空串')
  assert.deepEqual(r.perSourceErrors, [], 'perSourceErrors 为空数组')
  assert.equal(r.declinedCount, 0, '空 query 无 declined 源')
  assert.ok(r.limitations.some(x => x.includes('未执行任何数据源')), 'limitations 说明未执行数据源')
})
