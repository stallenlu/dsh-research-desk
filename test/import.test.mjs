// 导入解析单测。跑法：node --test test/import.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseImport, parseJsonImport, parseBibtexImport, parseMarkdownImport } from '../lib/import.mjs'

test('import: JSON 兼容 {papers:[...]} 与裸数组，丢掉无标题项', () => {
  const json = JSON.stringify({ papers: [
    { title: 'Paper One', year: 2024, authors: ['Li Ming'], doi: '10.1/one' },
    { title: '   ' },
    { title: 'Paper Two', year: '2023', url: 'https://example.org/p2', tags: ['x'] },
  ] })
  const rows = parseJsonImport(json)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].title, 'Paper One')
  assert.equal(rows[0].year, 2024)
  assert.deepEqual(rows[0].authors, ['Li Ming'])
  assert.equal(rows[1].year, 2023)
  assert.equal(rows[1].url, 'https://example.org/p2')
})

test('import: BibTeX 提取字段并识别 and 分隔的作者', () => {
  const bib = '@article{li2024rag,\n  title = {Retrieval Augmented Generation},\n  author = {Li, Ming and Wang, Fang},\n  year = {2024},\n  journal = {Journal of X},\n  doi = {10.1/rag},\n  url = {https://doi.org/10.1/rag}\n}'
  const rows = parseBibtexImport(bib)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Retrieval Augmented Generation')
  assert.deepEqual(rows[0].authors, ['Li, Ming', 'Wang, Fang'])
  assert.equal(rows[0].year, 2024)
  assert.equal(rows[0].venue, 'Journal of X')
  assert.equal(rows[0].source, 'bibtex')
})

test('import: Markdown 逐篇格式（MCP 导出）可回灌', () => {
  const md = '# 文献库（2 篇）\n\n## Probe Paper Beta\nRoe John · 2024\n\nhttps://arxiv.org/abs/9999\n\n## Probe Paper Alpha\nDoe Jane · 2023 · doi:10.99/alpha'
  const rows = parseMarkdownImport(md)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].title, 'Probe Paper Beta')
  assert.equal(rows[0].year, 2024)
  assert.equal(rows[0].url, 'https://arxiv.org/abs/9999')
  assert.equal(rows[1].doi, '10.99/alpha')
})

test('import: Markdown 表格格式（toMarkdown 导出）可回灌', () => {
  const md = '# 科研工作台导出\n\n## 文献库（1 篇）\n\n| 标题 | 年份 | 来源 | 状态 | DOI |\n| --- | --- | --- | --- | --- |\n| Table Paper | 2022 | arxiv | new | 10.2/t |\n\n## 选题（0 条）'
  const rows = parseMarkdownImport(md)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Table Paper')
  assert.equal(rows[0].year, 2022)
  assert.equal(rows[0].doi, '10.2/t')
})

test('import: auto 识别三种格式，空内容与坏 JSON 有中文错误', () => {
  assert.equal(parseImport('{"papers":[]}', 'auto').format, 'json')
  assert.equal(parseImport('@article{x,title={Y}}', 'auto').format, 'bibtex')
  assert.equal(parseImport('## A Title\nSome text', 'auto').format, 'markdown')
  assert.match(parseImport('   ').error, /空的/)
  assert.match(parseImport('{bad json').error, /解析失败/)
})
