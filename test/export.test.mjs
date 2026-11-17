// Unit tests for the export helpers. Run with: node --test test/export.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { citeKey, exportBundle, toBibTeX, toJSON, toMarkdown } from '../lib/export.mjs'

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
