// Literature discovery over three open sources that need no API key:
// arXiv, Europe PMC and OpenAlex. Everything is normalised into the paper
// shape that lib/desk.mjs accepts, so one query returns comparable rows.
import { cleanText, isObject, toNumber } from './util.mjs'

export const SOURCES = ['arxiv', 'europepmc', 'openalex']

const UA = 'dsh-research-desk/0.1 (DeepSeek Harness research desk)'
const TIMEOUT_MS = 25000

function link(signal, ms) {
  const timer = AbortSignal.timeout(ms || TIMEOUT_MS)
  return signal ? AbortSignal.any([signal, timer]) : timer
}

async function getJson(url, signal) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: link(signal) })
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url)
  return res.json()
}

async function getText(url, signal) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: link(signal) })
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url)
  return res.text()
}

function decodeEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
}

function textOf(block, tag) {
  const match = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'))
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : ''
}

/** Strip markup and keep paragraph breaks so chunk anchors stay readable. */
export function stripHtml(html) {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<journal-meta[\s\S]*?<\/journal-meta>/gi, ' ')
      .replace(/<contrib-group[\s\S]*?<\/contrib-group>/gi, ' ')
      .replace(/<author-notes[\s\S]*?<\/author-notes>/gi, ' ')
      .replace(/<aff[\s\S]*?<\/aff>/gi, ' ')
      .replace(/<history[\s\S]*?<\/history>/gi, ' ')
      .replace(/<permissions[\s\S]*?<\/permissions>/gi, ' ')
      .replace(/<funding-group[\s\S]*?<\/funding-group>/gi, ' ')
      .replace(/<ref-list[\s\S]*?<\/ref-list>/gi, ' ')
      .replace(/<article-id[^>]*>[\s\S]*?<\/article-id>/gi, ' ')
      .replace(/<pub-date[^>]*>[\s\S]*?<\/pub-date>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|tr|section|br)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

function arxivIdFrom(url) {
  const match = String(url || '').match(/abs\/([^\s/?#]+)/)
  if (!match) return ''
  return match[1].replace(/v\d+$/, '')
}

function parseAtom(xml) {
  const rows = []
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
  for (const block of entries) {
    const id = textOf(block, 'id')
    const arxivId = arxivIdFrom(id)
    const published = textOf(block, 'published')
    const authors = (block.match(/<name>[\s\S]*?<\/name>/g) || []).map(name => decodeEntities(name.replace(/<[^>]+>/g, ' ')).trim())
    const doi = textOf(block, 'arxiv:doi')
    const journalRef = textOf(block, 'arxiv:journal_ref')
    const primary = (block.match(/<arxiv:primary_category[^>]*term="([^"]+)"/) || [])[1] || ''
    const comment = textOf(block, 'arxiv:comment')
    rows.push({
      title: textOf(block, 'title'),
      abstract: textOf(block, 'summary'),
      venue: journalRef || primary,
      year: toNumber(published.slice(0, 4)),
      doi: doi,
      arxivId: arxivId,
      pmid: '',
      pmcid: '',
      url: arxivId ? 'https://arxiv.org/abs/' + arxivId : id,
      source: 'arxiv',
      authors: authors,
      citedBy: undefined,
      tags: primary ? [primary] : [],
      note: comment
    })
  }
  return rows
}

async function searchArxiv(query, options) {
  const max = options.maxResults || 10
  const url = new URL('https://export.arxiv.org/api/query')
  url.searchParams.set('start', '0')
  url.searchParams.set('max_results', String(max))
  url.searchParams.set('sortBy', 'relevance')
  url.searchParams.set('sortOrder', 'descending')
  const strict = arxivQuery(query, { mode: 'and' })
  url.searchParams.set('search_query', strict)
  let rows = parseAtom(await getText(url.toString(), options.signal))
  if (!rows.length) {
    const loose = arxivQuery(query, { mode: 'or' })
    if (loose && loose !== strict) {
      url.searchParams.set('search_query', loose)
      rows = parseAtom(await getText(url.toString(), options.signal))
    }
  }
  return rows
}

/**
 * arXiv does not read a bare multi-word query as a keyword list: all:"a b c"
 * only matches records containing that exact phrase, so a natural-language
 * query returns nothing (measured: 0 rows for all:"retrieval augmented
 * generation scientific literature", 3 rows for the AND form). Terms joined
 * with AND behave like a keyword query; the OR form is the fallback used
 * when the AND form matches no record.
 */
export function arxivQuery(query, options = {}) {
  const mode = options.mode || 'and'
  const text = String(query || '').trim()
  if (!text) return 'all:*'
  const phrases = text.match(/"[^"]+"/g) || []
  const terms = text
    .replace(/"[^"]+"/g, ' ')
    .split(/[\s,;]+/)
    .map(term => term.replace(/[()]/g, '').trim())
    .filter(Boolean)
  const parts = phrases.map(phrase => 'all:' + phrase)
  for (const term of terms.slice(0, 8)) parts.push('all:' + term)
  if (!parts.length) return 'all:*'
  if (mode === 'or') return parts.slice(0, 5).join(' OR ')
  return parts.join(' AND ')
}

async function searchEuropePmc(query, options) {
  const max = options.maxResults || 10
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search')
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('pageSize', String(max))
  url.searchParams.set('resultType', 'core')
  const data = await getJson(url.toString(), options.signal)
  const list = (isObject(data) && data.resultList && Array.isArray(data.resultList.result)) ? data.resultList.result : []
  return list.map(row => {
    const doi = cleanText(row.doi)
    const pmid = cleanText(row.pmid)
    const pmcid = cleanText(row.pmcid)
    const journal = row.journalInfo && row.journalInfo.journal ? row.journalInfo.journal.title : ''
    return {
      title: cleanText(row.title),
      abstract: cleanText(row.abstractText),
      venue: cleanText(journal || (row.bookOrReportDetails && row.bookOrReportDetails.publisher) || ''),
      year: toNumber(row.pubYear),
      doi: doi,
      arxivId: '',
      pmid: pmid,
      pmcid: pmcid,
      url: doi ? 'https://doi.org/' + doi : (pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/' : ''),
      source: 'europepmc',
      authors: cleanText(row.authorString).split(/,\s*/).filter(Boolean).slice(0, 40),
      citedBy: toNumber(row.citedByCount),
      tags: cleanText(row.pubType).split(/[,;]/).map(t => t.trim()).filter(Boolean).slice(0, 6)
    }
  })
}

function reconstructAbstract(index) {
  if (!isObject(index)) return ''
  const words = []
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue
    for (const position of positions) words.push([position, word])
  }
  if (!words.length) return ''
  words.sort((a, b) => a[0] - b[0])
  return words.map(item => item[1]).join(' ').slice(0, 40000)
}

async function searchOpenAlex(query, options) {
  const max = options.maxResults || 10
  const url = new URL('https://api.openalex.org/works')
  url.searchParams.set('search', query)
  url.searchParams.set('per-page', String(max))
  const mailto = String(options.mailto || '').trim()
  if (mailto) url.searchParams.set('mailto', mailto)
  const data = await getJson(url.toString(), options.signal)
  const list = isObject(data) && Array.isArray(data.results) ? data.results : []
  return list.map(row => {
    const doi = String(row.doi || '').replace('https://doi.org/', '')
    const source = row.primary_location && row.primary_location.source ? row.primary_location.source.display_name : ''
    return {
      title: cleanText(row.title),
      abstract: reconstructAbstract(row.abstract_inverted_index),
      venue: cleanText(source || ''),
      year: toNumber(row.publication_year),
      doi: doi,
      arxivId: '',
      pmid: '',
      pmcid: '',
      url: row.doi || row.id,
      source: 'openalex',
      authors: (Array.isArray(row.authorships) ? row.authorships : [])
        .map(item => item && item.author ? cleanText(item.author.display_name) : '')
        .filter(Boolean)
        .slice(0, 40),
      citedBy: toNumber(row.cited_by_count),
      tags: cleanText(row.type)
    }
  })
}

const RUNNERS = { arxiv: searchArxiv, europepmc: searchEuropePmc, openalex: searchOpenAlex }

/**
 * Run one query against the requested sources.
 * A failing source never kills the whole search: its error is reported and the
 * other sources still return rows.
 */
export async function search(query, options = {}) {
  const text = String(query || '').trim()
  if (!text) return { papers: [], errors: ['检索词是空的'] }
  // An explicitly empty source list is honoured: it means "query nothing".
  // Only a missing option falls back to every source.
  const requested = Array.isArray(options.sources) ? options.sources : SOURCES
  const sources = requested.filter(name => RUNNERS[name])
  const max = Math.min(Math.max(Number(options.maxResults) || 10, 1), 40)
  const settled = await Promise.all(sources.map(async name => {
    try {
      const rows = await RUNNERS[name](text, { maxResults: max, signal: options.signal, mailto: options.mailto })
      return { name, rows: rows.filter(row => row && row.title) }
    } catch (err) {
      return { name, rows: [], error: err && err.message ? err.message : String(err) }
    }
  }))
  const papers = []
  const errors = []
  const seen = new Set()
  for (const result of settled) {
    if (result.error) {
      errors.push(result.name + ' 检索失败：' + result.error)
      continue
    }
    for (const row of result.rows) {
      const key = (row.doi ? 'doi:' + row.doi.toLowerCase() : row.arxivId ? 'arxiv:' + row.arxivId : 't:' + row.title.toLowerCase().slice(0, 80))
      if (seen.has(key)) continue
      seen.add(key)
      papers.push(row)
    }
  }
  return { papers, errors }
}

/**
 * Pull readable full text when the source offers it.
 * Returns { text, kind, url }; kind is 'fulltext', 'html' or 'abstract'.
 */
export async function fetchFullText(paper, options = {}) {
  if (!isObject(paper)) throw new Error('没有这篇文献')
  if (paper.pmcid) {
    try {
      const url = 'https://www.ebi.ac.uk/europepmc/webservices/rest/' + encodeURIComponent(paper.pmcid) + '/fullTextXML'
      const xml = await getText(url, options.signal)
      const text = stripHtml(xml)
      if (text.length > 800) return { text, kind: 'fulltext', url: url }
    } catch (err) {
      // fall through to the next source
    }
  }
  if (paper.arxivId) {
    try {
      const url = 'https://arxiv.org/html/' + paper.arxivId
      const html = await getText(url, options.signal)
      const text = stripHtml(html)
      if (text.length > 1500) return { text, kind: 'html', url: url }
    } catch (err) {
      // fall through to the abstract
    }
  }
  const abstract = cleanText(paper.abstract)
  return { text: abstract, kind: 'abstract', url: paper.url || '' }
}
