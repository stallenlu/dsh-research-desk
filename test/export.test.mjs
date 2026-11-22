// Unit tests for the export helpers. Run with: node --test test/export.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { citeKey, exportBundle, toBibTeX, toJSON, toMarkdown, toTypst, toLatex } from '../lib/export.mjs'

const PAPER = {
  id: 'p1',
  title: 'Retrieval Augmented Generation for Science',
  year: 2024,
  authors: ['Li Ming', 'Wang Fang'],
  doi: '10.1/abc',
  venue: 'Journal of Widgets',
  source: 'europepmc',
  url: 'https://doi.org/10.1/abc',
}

test('export: citeKey is surname + year + first title word', () => {
  assert.equal(citeKey(PAPER, new Set()), 'Li2024Retrieval')
})

test('export: citeKey falls back to Anonymous and n.d.', () => {
  assert.equal(citeKey({ title: 'Retrieval Notes', year: 2020 }, new Set()), 'Anonymous2020Retrieval')
  assert.ok(citeKey({ authors: ['Li Ming'], title: 'Retrieval Notes' }, new Set()).includes('n.d.'))
})

test('export: a repeated key gets a letter suffix', () => {
  const used = new Set()
  assert.equal(citeKey(PAPER, used), 'Li2024Retrieval')
  assert.equal(citeKey(PAPER, used), 'Li2024Retrievala')
  assert.equal(citeKey(PAPER, used), 'Li2024Retrievalb')
  assert.equal(used.size, 3)
})

test('export: BibTeX carries the fields a reference needs', () => {
  const text = toBibTeX([PAPER])
  assert.match(text, /@article\{Li2024Retrieval,/)
  assert.match(text, /author = \{Li, Ming and Wang, Fang\}/)
  assert.match(text, /title = \{Retrieval Augmented Generation for Science\}/)
  assert.ok(!text.includes('{{'), '字段值不应多套一层花括号')
  assert.match(text, /year = \{2024\}/)
  assert.match(text, /journal = \{Journal of Widgets\}/)
  assert.match(text, /doi = \{10\.1\/abc\}/)
  assert.match(text, /url = \{https:\/\/doi\.org\/10\.1\/abc\}/)
})

test('export: entry type follows the venue and the source', () => {
  const conf = toBibTeX([{ ...PAPER, venue: 'International Conference on Widgets' }])
  assert.match(conf, /@inproceedings\{/)
  const misc = toBibTeX([{ ...PAPER, doi: '', venue: '', source: 'arxiv', url: 'https://arxiv.org/abs/2401.1' }])
  assert.match(misc, /@misc\{/)
})

test('export: JSON drops chunk text and never carries a secret', () => {
  const state = {
    papers: [{
      id: 'p1',
      title: 'Paper one',
      year: 2024,
      chunks: [{ index: 0, heading: 'Intro', text: 'CONFIDENTIAL BODY TEXT' }],
    }],
    settings: { maxResults: 15, 'secrets.openalexKey': 'MY_SECRET_ENV_NAME' },
  }
  const json = toJSON(state)
  assert.ok(!json.includes('CONFIDENTIAL BODY TEXT'), '默认不得导出全文片段')
  assert.ok(!json.includes('MY_SECRET_ENV_NAME'), '不得导出密钥环境变量名')
  const parsed = JSON.parse(json)
  assert.equal(parsed.papers[0].chunks.length, 1)
  assert.equal(parsed.papers[0].chunks[0].index, 0)
  assert.equal(parsed.papers[0].chunks[0].heading, 'Intro')
  assert.equal(parsed.papers[0].chunks[0].text, undefined)
  assert.equal(parsed.settings.maxResults, 15)
  assert.equal(parsed.settings['secrets.openalexKey'].configured, true)
  const full = JSON.parse(toJSON(state, { includeFullText: true }))
  assert.equal(full.papers[0].chunks[0].text, 'CONFIDENTIAL BODY TEXT')
})

test('export: bundle returns md, bib and json files', () => {
  const files = exportBundle({ papers: [PAPER] }, ['md', 'bib', 'json'])
  assert.equal(files.length, 3)
  assert.deepEqual(files.map(file => file.format), ['md', 'bib', 'json'])
  assert.deepEqual(files.map(file => file.filename), [
    'research-desk-library.md',
    'research-desk-library.bib',
    'research-desk-library.json',
  ])
  assert.ok(files[0].content.includes('# 科研工作台导出'))
  assert.ok(files[1].content.includes('@article{'))
  assert.ok(files[2].content.includes('"papers"'))
  assert.ok(files[0].mime.includes('markdown'))
  assert.ok(files[1].mime.includes('bibtex'))
  assert.ok(files[2].mime.includes('json'))
})

test('export: Markdown carries the library, the questions, the review and the drafts', () => {
  const state = {
    papers: [PAPER],
    hypotheses: [{ id: 'h1', title: 'Widget drift', status: 'draft', gap: '缺少长期数据', experiment: '跟踪一年漂移' }],
    review: {
      topic: 'Widget calibration',
      sections: [{
        key: 'methodology',
        label: '方法学',
        text: '正文一段。',
        citations: [{ chunkId: 'p1#0', quote: 'quote text' }],
        unverified: [{ chunkId: 'p1#1', reason: '引用与原文不一致' }],
      }],
    },
    drafts: [{ id: 'd1', title: 'Intro draft', body: '草稿正文。', refs: ['p1'] }],
    experiments: [{ title: 'Run 1', at: '2026-01-01', status: 'done', note: 'ok' }],
  }
  const md = toMarkdown(state)
  assert.ok(md.includes('Retrieval Augmented Generation for Science'))
  assert.ok(md.includes('Widget drift'))
  assert.ok(md.includes('方法学'))
  assert.ok(md.includes('正文一段。'))
  assert.ok(md.includes('引用与原文不一致'))
  assert.ok(md.includes('Intro draft'))
  assert.ok(md.includes('草稿正文。'))
  assert.ok(md.includes('Run 1'))
})

test('export: Typst 导出含表格、中文标题与转义，特殊字符不破坏语法', () => {
  const state = { papers: [{ title: 'A #tag_1 {x}', year: 2024, authors: ['Li Ming'], source: 'arxiv', doi: '10.1/a_b' }], updatedAt: '2026-11-19' }
  const typ = exportBundle(state, ['typst'])[0]
  assert.equal(typ.format, 'typst')
  assert.match(typ.filename, /\.typ$/)
  assert.ok(typ.content.includes('= 科研工作台导出'))
  assert.ok(typ.content.includes('#table(columns: 5,'))
  assert.ok(typ.content.includes('\\#tag\\_1 \\{x\\}'), 'Typst 特殊字符必须转义: ' + typ.content.slice(typ.content.indexOf('#table')))
  assert.ok(typ.content.includes('导出时间：2026-11-19'))
})

test('export: LaTeX 导出含导言区、longtable 与转义，特殊字符不破坏语法', () => {
  const state = { papers: [{ title: 'A $tag_1 & x', year: 2024, authors: ['Li Ming'], source: 'arxiv', doi: '10.1/a_b' }] }
  const tex = exportBundle(state, ['latex'])[0]
  assert.equal(tex.format, 'latex')
  assert.match(tex.filename, /\.tex$/)
  assert.ok(tex.content.includes('\\documentclass{article}'))
  assert.ok(tex.content.includes('\\usepackage[UTF8]{ctex}'))
  assert.ok(tex.content.includes('\\begin{longtable}'))
  assert.ok(tex.content.includes('\\$tag\\_1 \\& x'), 'LaTeX 特殊字符必须转义: ' + tex.content.slice(tex.content.indexOf('longtable')))
  assert.ok(tex.content.includes('\\end{document}'))
})

test('export: bundle 五格式齐全且顺序稳定', () => {
  const files = exportBundle({ papers: [PAPER] }, ['md', 'bib', 'json', 'typst', 'latex'])
  assert.deepEqual(files.map(f => f.format), ['md', 'bib', 'json', 'typst', 'latex'])
  assert.deepEqual(files.map(f => f.filename), [
    'research-desk-library.md', 'research-desk-library.bib', 'research-desk-library.json',
    'research-desk-library.typ', 'research-desk-library.tex',
  ])
})

// ── 阶段 A4：导出血缘 V6（终稿 §7.5，关2 C16） ─────────────────────────────
test('A4/V6: 五格式导出元数据含 inspirationId 与灵感标题（或已删占位）', () => {
  const state = {
    inspirations: [{ id: 'i_line', text: '导出血缘灵感' }],
    papers: [{ ...PAPER, inspirationId: 'i_line' }],
    updatedAt: '2026-11-22',
  }
  const files = exportBundle(state, ['md', 'bib', 'json', 'typst', 'latex'])
  const by = Object.fromEntries(files.map(f => [f.format, f.content]))
  for (const fmt of ['md', 'bib', 'json', 'typst', 'latex']) {
    // BibTeX/Typst/LaTeX 会把下划线转义成 \\_，属格式规范，信息未丢失。
    const normalized = by[fmt].replace(/\\_/g, '_')
    assert.ok(normalized.includes('i_line'), fmt + ' 应含 inspirationId')
    assert.ok(by[fmt].includes('导出血缘灵感'), fmt + ' 应含灵感标题')
  }
  // 已删灵感：成果仍带 inspirationId，标题位置显示「灵感已删」占位。
  const orphan = exportBundle({ papers: [{ ...PAPER, inspirationId: 'i_gone' }] }, ['md'])[0].content
  assert.ok(orphan.includes('i_gone'))
  assert.ok(orphan.includes('灵感已删'))
  // 关4 note1：来源与灵感合并进同一条 note，不能被后者覆盖丢失（蓝图判断4「在 note 追加」）。
  const both = exportBundle({
    inspirations: [{ id: 'i_line', text: '导出血缘灵感' }],
    papers: [{ ...PAPER, source: '生态检索', inspirationId: 'i_line' }],
  }, ['bib'])[0].content
  const noteLines = both.split('\n').filter(l => /^\s*note\s*=/.test(l))
  assert.equal(noteLines.length, 1, '来源与灵感须合并为单条 note，不得重复字段')
  assert.ok(noteLines[0].includes('来源：生态检索'), '单条 note 仍须保留来源注记')
  assert.ok(noteLines[0].includes('灵感：'), '单条 note 仍须保留灵感注记')
})

// ── D7 主体间可检验：导出复用固化核验信号，不重跑 verifyCitations ────────────
test('D7 导出核验状态：memory 灵感标未核验 + unverifiedCount 汇总 + 引文带 paperId', () => {
  const state = {
    updatedAt: '2026-11-22T00:00:00.000Z',
    inspirations: [
      { id: 'i_m', text: '纯模型记忆的猜想', origin: { type: 'memory', ref: '', verified: false }, confidence: 0.3, confidenceSource: 'model' },
      { id: 'i_d', text: '带 DOI 的锚定灵感', origin: { type: 'doi', ref: '10.1/abc', verified: true }, confidence: 0.8, confidenceSource: 'human' },
    ],
    questions: [
      { id: 'q1', inspirationId: 'i_m', paperId: '', chunkId: '', quote: 'never', verified: false },
      { id: 'q2', inspirationId: 'i_m', paperId: 'p1', chunkId: 'c1', quote: 'MATCH', verified: true },
    ],
    reviews: [{
      id: 'r1', topic: '综述', inspirationId: 'i_m',
      sections: [{ key: 's1', label: '方法', text: '正文', citations: [{ paperId: 'p1', chunkId: 'c1', quote: 'MATCH' }], unverified: [{ chunkId: 'c9', reason: 'not found' }] }],
      stats: { sections: 1, citationCount: 0, unverifiedCount: 1, paperCount: 0 },
    }],
    papers: [{ ...PAPER, inspirationId: 'i_d' }],
  }
  const md = toMarkdown(state)
  assert.ok(md.includes('## 核验状态（主体间可检验）'), '导出含核验状态区块')
  assert.ok(md.includes('未核验引文节点合计：2'), 'unverifiedCount = reviews 1 + questions 1')
  assert.ok(md.includes('无外部锚点或未核验灵感'), '有未锚定灵感提示')
  assert.ok(md.includes('纯模型记忆的猜想'), 'memory 灵感被列出')
  assert.ok(md.includes('origin.type=memory'), 'memory 灵感标注来源类型')
  assert.ok(md.includes('→ 未核验'), 'memory 灵感标未核验')
  assert.ok(md.includes('已核验引文：'), '综述引文披露区块存在')
  assert.ok(md.includes('[p1]'), '已核验引文带 paperId（export.mjs:305 渲染路径）')
  assert.ok(md.includes('c1「MATCH」'), '已核验引文带 chunkId+quote')
})
