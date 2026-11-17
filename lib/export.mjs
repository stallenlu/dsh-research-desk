// 导出：把工作台状态变成可以带走的文件。
//
// 两条底线：
// 1. 导出的 JSON 默认不含全文片段，文献库太大且可能涉及未发表内容。
// 2. 密钥设置只输出「配没配」，绝不输出环境变量名，更不输出变量值。

import { cleanText, isObject } from './util.mjs'
import { isSecretKey } from './settings.mjs'

const MAX_BODY = 60000

/**
 * 表格单元格里的换行和竖线会破坏 Markdown 表格。
 * @param {*} value - 单元格原始值。
 * @returns {string} 可以直接放进表格的文本。
 */
function cell(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\r\n/g, '\n')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, '<br>')
    .trim()
}

// 常见中文姓的拼音。数据源里的中文作者多是「姓 + 名」的拼音写法
// （Wang Fang），不看这张表就会把它当成西式的「名 + 姓」而取错姓。
const CHINESE_SURNAMES = new Set([
  'bai', 'bao', 'cao', 'chen', 'cheng', 'chu', 'cui', 'dai', 'deng', 'ding', 'dong', 'du', 'duan',
  'fan', 'fang', 'fei', 'feng', 'fu', 'gao', 'gu', 'guo', 'han', 'he', 'hou', 'hu', 'huang', 'ji',
  'jia', 'jiang', 'jin', 'jing', 'kang', 'ke', 'kong', 'kuang', 'lai', 'lei', 'li', 'lian', 'liang',
  'lin', 'liu', 'long', 'lu', 'luo', 'ma', 'mao', 'meng', 'ming', 'mo', 'ni', 'pan', 'peng', 'qian',
  'qin', 'qu', 'ren', 'shang', 'shao', 'shen', 'shi', 'song', 'su', 'sun', 'tan', 'tang', 'tao',
  'tian', 'wang', 'wei', 'wen', 'weng', 'wu', 'xi', 'xia', 'xiang', 'xiao', 'xie', 'xin', 'xu',
  'xue', 'yan', 'yang', 'yao', 'ye', 'yi', 'yin', 'yong', 'you', 'yu', 'yuan', 'zeng', 'zhang',
  'zhao', 'zheng', 'zhou', 'zhu', 'zhuo', 'zong',
])

/**
 * 作者姓的猜测规则。
 * 中文姓名和中文拼音姓氏按「姓在前」处理，其余按英文习惯取末词。
 * @param {string} author - 作者全名。
 * @returns {string} 姓。
 */
function surnameOf(author) {
  const name = cleanText(author, 120)
  if (!name) return ''
  const parts = name.split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (/[\u4e00-\u9fff]/.test(name)) return parts[0]
  const first = parts[0].toLowerCase()
  if (CHINESE_SURNAMES.has(first)) return parts[0]
  return parts[parts.length - 1]
}

/**
 * 标题里的第一个英文词，用作引用键的后半截。
 * @param {string} title - 论文标题。
 * @returns {string} 英文词；没有英文词时给一个占位。
 */
function titleWord(title) {
  const match = String(title || '').match(/[A-Za-z][A-Za-z0-9]*/)
  if (!match) return 'Untitled'
  return match[0].charAt(0).toUpperCase() + match[0].slice(1)
}

/**
 * 生成一个 BibTeX 引用键。
 * @param {object} paper - 论文记录。
 * @param {Set<string>} used - 已经用过的键，用来避让冲突。
 * @returns {string} 引用键，形如 Li2024Retrieval。
 */
export function citeKey(paper, used) {
  const set = used instanceof Set ? used : new Set()
  const row = isObject(paper) ? paper : {}
  const author = Array.isArray(row.authors) ? row.authors[0] : ''
  let surname = surnameOf(author)
  surname = surname.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, '')
  if (!surname) surname = 'Anonymous'
  const yearValue = Number(row.year)
  const year = Number.isFinite(yearValue) && yearValue > 0 ? String(Math.trunc(yearValue)) : 'n.d.'
  const base = surname + year + titleWord(row.title)
  if (!set.has(base)) {
    set.add(base)
    return base
  }
  // 冲突时依次加 a、b、c 后缀，直到不再撞车。
  for (let i = 0; i < 26; i += 1) {
    const candidate = base + String.fromCharCode(97 + i)
    if (!set.has(candidate)) {
      set.add(candidate)
      return candidate
    }
  }
  let n = 27
  while (set.has(base + n)) n += 1
  const key = base + n
  set.add(key)
  return key
}

/**
 * 判断条目类型：有会议性质的刊名算会议论文，有 DOI/PMID 算期刊文章，
 * 其余按数据源预印本处理成 misc。
 * @param {object} paper - 论文记录。
 * @returns {string} BibTeX 条目类型，不带 @。
 */
function entryType(paper) {
  const venue = String(paper.venue || '').toLowerCase()
  if (/conference|proceedings|symposium|workshop|congress|symposium/.test(venue)) return 'inproceedings'
  const source = String(paper.source || '').toLowerCase()
  if (source === 'europepmc' || source === 'openalex') return 'article'
  if (source === 'arxiv') return paper.doi ? 'article' : 'misc'
  if (paper.doi || paper.pmid) return 'article'
  return 'misc'
}

/**
 * 作者名转 BibTeX 写法：姓在前，名在后。
 * @param {string} name - 作者全名。
 * @returns {string} BibTeX 作者名。
 */
function bibAuthor(name) {
  const parts = cleanText(name, 120).split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  const surname = surnameOf(name)
  const rest = parts.filter(part => part !== surname)
  if (!rest.length) return surname
  return surname + ', ' + rest.join(' ')
}

/**
 * BibTeX 字段值里的特殊字符需要转义，否则会破坏条目语法。
 * @param {string} value - 字段值。
 * @returns {string} 转义后的值。
 */
function bibValue(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[{}]/g, '')
    .replace(/[\\]/g, '\\textbackslash{}')
    .replace(/([&%$#_])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 生成整份 BibTeX 文本。
 * @param {Array<object>} papers - 论文记录列表。
 * @returns {string} BibTeX 文本。
 */
export function toBibTeX(papers) {
  const list = Array.isArray(papers) ? papers : []
  const used = new Set()
  const blocks = []
  for (const paper of list) {
    if (!isObject(paper)) continue
    const title = cleanText(paper.title, 400)
    if (!title) continue
    const key = citeKey(paper, used)
    const type = entryType(paper)
    const fields = []
    const authors = (Array.isArray(paper.authors) ? paper.authors : []).map(bibAuthor).filter(Boolean)
    if (authors.length) fields.push(['author', authors.join(' and ')])
    // 字段值本身的花括号就是 BibTeX 的大小写保护，再套一层会变成多余的花括号。
    fields.push(['title', bibValue(title)])
    if (paper.year) fields.push(['year', bibValue(paper.year)])
    if (type === 'article' && paper.venue) fields.push(['journal', bibValue(paper.venue)])
    if (type === 'inproceedings' && paper.venue) fields.push(['booktitle', bibValue(paper.venue)])
    if (paper.doi) fields.push(['doi', bibValue(paper.doi)])
    if (paper.url) fields.push(['url', bibValue(paper.url)])
    if (paper.arxivId) fields.push(['eprint', bibValue(paper.arxivId)])
    if (paper.pmid) fields.push(['pmid', bibValue(paper.pmid)])
    if (paper.source) fields.push(['note', bibValue('来源：' + paper.source)])
    blocks.push('@' + type + '{' + key + ',\n' + fields.map(row => '  ' + row[0] + ' = {' + row[1] + '}').join(',\n') + '\n}')
  }
  return blocks.join('\n\n') + (blocks.length ? '\n' : '')
}

/**
 * 把若干条记录渲染成一个 Markdown 表格。
 * @param {string[]} headers - 表头。
 * @param {Array<Array<*>>} rows - 数据行。
 * @returns {string} Markdown 表格文本。
 */
function mdTable(headers, rows) {
  if (!rows.length) return ''
  const head = '| ' + headers.join(' | ') + ' |'
  const sep = '| ' + headers.map(() => '---').join(' | ') + ' |'
  const body = rows.map(row => '| ' + row.map(cell).join(' | ') + ' |').join('\n')
  return [head, sep, body].join('\n')
}

/**
 * 找出状态里所有综述记录，兼容单个 review 与 reviews 列表两种放法。
 * @param {object} state - 工作台状态。
 * @returns {Array<object>} 综述列表。
 */
function reviewList(state) {
  const out = []
  if (isObject(state.review)) out.push(state.review)
  if (Array.isArray(state.reviews)) {
    for (const row of state.reviews) if (isObject(row)) out.push(row)
  }
  return out
}

/**
 * 找出状态里的实验记录，兼容几种常见字段名。
 * @param {object} state - 工作台状态。
 * @returns {Array<object>} 实验记录列表。
 */
function experimentList(state) {
  for (const key of ['experiments', 'experimentLog', 'experimentlog', 'runs']) {
    if (Array.isArray(state[key])) return state[key]
  }
  return []
}

/**
 * 把工作台状态导出成一份 Markdown。
 * @param {object} state - 工作台状态。
 * @returns {string} Markdown 文本。
 */
export function toMarkdown(state) {
  const row = isObject(state) ? state : {}
  const papers = Array.isArray(row.papers) ? row.papers : []
  const hypotheses = Array.isArray(row.hypotheses) ? row.hypotheses : []
  const drafts = Array.isArray(row.drafts) ? row.drafts : []
  const reviews = reviewList(row)
  const experiments = experimentList(row)
  const lines = ['# 科研工作台导出', '']
  if (row.updatedAt) lines.push('导出时间：' + row.updatedAt, '')
  lines.push('## 文献库（' + papers.length + ' 篇）', '')
  lines.push(mdTable(['标题', '年份', '来源', '状态', 'DOI'], papers.map(paper => [
    paper.title || '', paper.year || '', paper.source || '', paper.status || '', paper.doi || '',
  ])) || '文献库是空的。')
  lines.push('', '## 选题（' + hypotheses.length + ' 条）', '')
  lines.push(mdTable(['标题', '状态', '研究缺口', '实验'], hypotheses.map(item => [
    item.title || '', item.status || '', item.gap || '', item.experiment || '',
  ])) || '还没有选题。')
  lines.push('', '## 综述（' + reviews.length + ' 篇）', '')
  if (!reviews.length) lines.push('还没有综述。')
  for (const review of reviews) {
    lines.push('### ' + (review.topic || '未命名主题'))
    const sections = Array.isArray(review.sections) ? review.sections : []
    if (!sections.length) lines.push('', '（没有正文）')
    for (const section of sections) {
      lines.push('', '#### ' + (section.label || section.key || '视角'))
      lines.push('', section.text || '')
      const citations = Array.isArray(section.citations) ? section.citations : []
      if (citations.length) {
        lines.push('', '已核验引文：')
        for (const cite of citations) lines.push('- ' + cite.chunkId + '「' + String(cite.quote || '').slice(0, 120) + '」')
      }
      const unverified = Array.isArray(section.unverified) ? section.unverified : []
      if (unverified.length) {
        lines.push('', '未通过核验的引文（已剔除）：')
        for (const cite of unverified) lines.push('- ' + cite.chunkId + '：' + cite.reason)
      }
    }
    lines.push('')
  }
  lines.push('## 草稿（' + drafts.length + ' 篇）', '')
  if (!drafts.length) lines.push('还没有草稿。')
  for (const draft of drafts) {
    lines.push('### ' + (draft.title || '未命名草稿'))
    lines.push('')
    lines.push(String(draft.body || '').slice(0, MAX_BODY))
    const refs = Array.isArray(draft.refs) ? draft.refs : []
    if (refs.length) lines.push('', '引用：' + refs.join('、'))
    lines.push('')
  }
  lines.push('## 实验记录（' + experiments.length + ' 条）', '')
  lines.push(mdTable(['名称', '时间', '状态', '说明'], experiments.map(item => [
    item.title || item.name || item.label || '', item.at || item.time || '', item.status || '', item.note || item.result || '',
  ])) || '还没有实验记录。')
  lines.push('')
  return lines.join('\n')
}

/**
 * 判断一个设置项是否是密钥引用。
 * 已知设置项查定义表，查不到的 secrets.* 一律按密钥处理：宁可少输出，
 * 也不能把不该输出的东西带出去。
 * @param {string} key - 设置项键名。
 * @returns {boolean} 是否是密钥引用。
 */
function looksSecret(key) {
  if (isSecretKey(key)) return true
  return String(key).startsWith('secrets.')
}

/**
 * 把状态序列化成 JSON 字符串。
 * @param {object} state - 工作台状态。
 * @param {object} options - 导出选项。
 * @param {boolean} options.includeFullText - 是否保留全文片段，默认 false。
 * @returns {string} JSON 文本。
 */
export function toJSON(state, options = {}) {
  const row = isObject(state) ? state : {}
  const opts = isObject(options) ? options : {}
  const includeFullText = opts.includeFullText === true
  const out = { ...row }
  if (Array.isArray(row.papers)) {
    out.papers = row.papers.map(paper => {
      const copy = { ...paper }
      if (Array.isArray(paper.chunks)) {
        copy.chunks = paper.chunks.map(chunk => {
          if (includeFullText) return { ...chunk }
          // 全文片段体积大且可能含未发表内容，导出时只留定位信息。
          const { text, ...rest } = isObject(chunk) ? chunk : {}
          return rest
        })
      }
      return copy
    })
  }
  if (isObject(row.settings)) {
    const settings = {}
    for (const [key, value] of Object.entries(row.settings)) {
      if (looksSecret(key)) {
        // 只说配没配：环境变量名和变量值都不导出。
        settings[key] = { configured: typeof value === 'string' && value.trim() !== '' }
      } else {
        settings[key] = value
      }
    }
    out.settings = settings
  }
  return JSON.stringify(out, null, 2)
}

/**
 * 打包导出文件。
 * @param {object} state - 工作台状态。
 * @param {string[]} formats - 需要的格式，'md'、'bib'、'json'。
 * @returns {Array<{format: string, filename: string, mime: string, content: string}>} 文件列表。
 */
export function exportBundle(state, formats) {
  const list = Array.isArray(formats) ? formats : []
  const row = isObject(state) ? state : {}
  const out = []
  for (const format of list) {
    if (format === 'md') {
      out.push({ format: 'md', filename: 'research-desk-library.md', mime: 'text/markdown; charset=utf-8', content: toMarkdown(row) })
    } else if (format === 'bib') {
      out.push({ format: 'bib', filename: 'research-desk-library.bib', mime: 'application/x-bibtex; charset=utf-8', content: toBibTeX(row.papers) })
    } else if (format === 'json') {
      out.push({ format: 'json', filename: 'research-desk-library.json', mime: 'application/json; charset=utf-8', content: toJSON(row) })
    }
  }
  return out
}
