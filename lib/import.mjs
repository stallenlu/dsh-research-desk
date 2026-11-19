// 导入：把 md / bib / json 回灌成文献库条目。
// 解析只在服务端做，客户端只读文件文本并渲染结果（服务端算好人话）。
// 所有字段最终仍走 desk.applyOps 的白名单写入，重复项由 paperKey 去重。
import { cleanText, isHttpUrl, isObject } from './util.mjs'

const MAX_TEXT = 5 * 1024 * 1024

/** 把任意候选对象收敛成干净、可被 add_paper 接受的文献数组。 */
function cleanPapers(list) {
  const out = []
  for (const row of (Array.isArray(list) ? list : [])) {
    if (!isObject(row)) continue
    const title = cleanText(row.title, 400)
    if (!title) continue
    const paper = { title }
    for (const key of ['abstract', 'venue', 'doi', 'arxivId', 'pmid', 'pmcid', 'source', 'note']) {
      if (row[key]) paper[key] = cleanText(row[key], key === 'abstract' ? 20000 : 500)
    }
    if (row.year) {
      const match = String(row.year).match(/\d{4}/)
      if (match) { const year = Number(match[0]); if (year > 1500 && year < 2200) paper.year = year }
    }
    if (Array.isArray(row.authors)) {
      paper.authors = row.authors.map(a => cleanText(a, 120)).filter(Boolean).slice(0, 64)
    } else if (typeof row.authors === 'string') {
      paper.authors = row.authors.split(/\s+and\s+|、/).map(a => cleanText(a, 120)).filter(Boolean).slice(0, 64)
    }
    if (Array.isArray(row.tags)) paper.tags = row.tags.map(t => cleanText(t, 60)).filter(Boolean).slice(0, 64)
    const url = row.url || row.link
    if (url && isHttpUrl(String(url))) paper.url = String(url)
    if (['new', 'reading', 'read', 'kept', 'dropped'].includes(row.status)) paper.status = row.status
    out.push(paper)
  }
  return out
}

/** 解析 JSON：兼容 { papers:[...] }、裸数组，以及我们 toJSON 导出的形状。 */
export function parseJsonImport(text) {
  const data = JSON.parse(text)
  const list = Array.isArray(data) ? data : (isObject(data) ? (data.papers || data.items || []) : [])
  return cleanPapers(list)
}

/** 解析 BibTeX：逐 @ 条目扫字段，title / author / year 是必需的最小信息。 */
export function parseBibtexImport(text) {
  const out = []
  const src = String(text || '')
  const entryRe = /@(\w+)\s*\{/g
  let entry
  while ((entry = entryRe.exec(src))) {
    // 从开头花括号逐字符数深度，找到与它配对的闭合括号（字段值里可嵌套花括号）。
    let depth = 1
    let i = entryRe.lastIndex
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
    }
    if (depth !== 0) break
    const body = src.slice(entryRe.lastIndex, i - 1)
    entryRe.lastIndex = i
    const comma = body.indexOf(',')
    const fields = {}
    const fieldSrc = comma >= 0 ? body.slice(comma + 1) : ''
    const fieldRe = /(\w+)\s*=\s*\{/g
    let field
    while ((field = fieldRe.exec(fieldSrc))) {
      let d = 1
      let j = fieldRe.lastIndex
      for (; j < fieldSrc.length && d > 0; j++) {
        if (fieldSrc[j] === '{') d++
        else if (fieldSrc[j] === '}') d--
      }
      if (d !== 0) break
      fields[field[1].toLowerCase()] = fieldSrc.slice(fieldRe.lastIndex, j - 1).trim()
      fieldRe.lastIndex = j
    }
    if (!fields.title) continue
    out.push({
      title: fields.title,
      authors: fields.author || '',
      year: fields.year || '',
      venue: fields.journal || fields.booktitle || '',
      doi: fields.doi || '',
      url: fields.url || '',
      arxivId: fields.eprint || '',
      pmid: fields.pmid || '',
      source: 'bibtex',
    })
  }
  return cleanPapers(out)
}

/** 解析 Markdown：既认我们 MCP 导出的「## 标题 + meta」逐篇格式，也认 toMarkdown 的表格格式。 */
export function parseMarkdownImport(text) {
  const lines = String(text).split(/\r?\n/)
  const out = []
  let section = ''
  let cur = null
  const flush = () => { if (cur && cur.title) out.push(cur); cur = null }
  for (const raw of lines) {
    const line = raw.trim()
    const h2 = raw.match(/^##\s+(.+?)\s*$/)
    if (h2) {
      flush()
      section = h2[1]
      // 逐篇格式：## 论文标题（不是「## 文献库（N 篇）」这类小节标题）
      if (!/文献库|选题|综述|草稿|实验记录/.test(section)) cur = { title: section, source: 'markdown' }
      continue
    }
    if (/^#/.test(raw) && !/^##/.test(raw)) continue
    if (section.includes('文献库') && /^\|/.test(raw)) {
      const cells = raw.split('|').slice(1, -1).map(s => s.trim().replace(/<br>/g, ' '))
      if (cells[0] === '标题' || /^-{3,}$/.test(cells[0] || '')) continue
      if (cells[0]) out.push({ title: cells[0], year: cells[1], source: 'markdown', doi: cells[4] || '' })
      continue
    }
    if (!cur) continue
    if (!line) {
      // 空行不结束当前篇，meta 与摘要之间常有空行
      continue
    }
    if (/^https?:\/\//.test(line)) { cur.url = line; continue }
    if (/·/.test(line) && !cur.venue) {
      for (const part of line.split(/\s+·\s+/)) {
        const doi = part.match(/^doi:\s*(.+)$/i)
        if (doi) { cur.doi = doi[1].trim(); continue }
        if (/^\d{4}$/.test(part)) { cur.year = part; continue }
        if (/[、,]/.test(part) && !cur.authors) { cur.authors = part.split(/[、,]/).map(s => s.trim()).filter(Boolean); continue }
        if (!cur.venue) cur.venue = part
      }
      continue
    }
    if (!cur.abstract) cur.abstract = line
  }
  flush()
  return cleanPapers(out)
}

/** 自动识别格式：JSON → BibTeX → Markdown。也可显式指定。 */
export function parseImport(text, format) {
  const src = String(text == null ? '' : text)
  if (!src.trim()) return { papers: [], format: format || '', error: '导入内容是空的。' }
  if (src.length > MAX_TEXT) return { papers: [], format: format || '', error: '文件太大了，导入上限 5 MB。' }
  let kind = format || ''
  if (!['json', 'bibtex', 'markdown'].includes(kind)) {
    const head = src.trim()
    kind = head.startsWith('{') || head.startsWith('[') ? 'json'
      : /@\w+\s*\{/.test(src) ? 'bibtex' : 'markdown'
  }
  try {
    const papers = kind === 'json' ? parseJsonImport(src)
      : kind === 'bibtex' ? parseBibtexImport(src) : parseMarkdownImport(src)
    return { papers, format: kind, error: papers.length ? '' : '没有从文件里认出任何文献（至少需要标题）。' }
  } catch (err) {
    return { papers: [], format: kind, error: '解析失败：' + (err && err.message ? err.message : String(err)) }
  }
}
