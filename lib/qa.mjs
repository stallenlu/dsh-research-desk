// Grounded reading: split a paper into chunks, retrieve the passages that
// answer a question, let the model write the answer, then verify every quote
// against the chunk it claims to come from.
//
// The verification step is the point of this file. A model answer that quotes
// text which is not in the retrieved source is a fabrication, and the research
// desk must never show one as if it were evidence.
import { cleanText, isObject, parseJsonLoose } from './util.mjs'

const CHARS = 1100
const OVERLAP = 160
const MIN_SCORE = 0.6

/** 兜底话术跟随提问语言：中文提问给中文，英文提问保留英文（英文单测依赖）。 */
function questionIsChinese(question) {
  return /[\u4e00-\u9fff]/.test(String(question || ''))
}

/** Words used for retrieval: lowercase latin words plus CJK single characters. */
export function tokenize(text) {
  const lower = String(text || '').toLowerCase()
  const latin = lower.match(/[a-z0-9][a-z0-9\-_.]*/g) || []
  const cjk = lower.match(/[\u4e00-\u9fff]/g) || []
  const stop = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is', 'are', 'was', 'were', 'be', 'with', 'that', 'this', 'by', 'as', 'at', 'from', 'it', 'its', 'we', 'our'])
  return latin.filter(word => word.length > 1 && !stop.has(word)).concat(cjk)
}

/** Split plain text into paragraph-aligned chunks with a little overlap. */
export function chunkText(text, options = {}) {
  const size = options.size || CHARS
  const overlap = options.overlap === undefined ? OVERLAP : options.overlap
  const body = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!body) return []
  const paragraphs = body.split(/\n{1,}/).map(line => line.trim()).filter(Boolean)
  const chunks = []
  let current = []
  let length = 0
  let heading = ''
  const flush = () => {
    if (!current.length) return
    const body2 = current.join('\n')
    chunks.push({
      index: chunks.length,
      heading: heading || guessHeading(body2),
      text: body2,
      chars: body2.length,
    })
    if (overlap > 0) {
      const tail = current[current.length - 1] || ''
      current = [tail.length > overlap ? tail.slice(-overlap) : tail]
      length = current[0].length
    } else {
      current = []
      length = 0
    }
  }
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 90 && /^[\d\s]*[A-Z][^.!?]{2,80}$/.test(paragraph)) heading = paragraph
    if (length + paragraph.length > size && current.length) flush()
    current.push(paragraph)
    length += paragraph.length + 1
  }
  flush()
  return chunks.map((chunk, index) => ({ ...chunk, index }))
}

function guessHeading(text) {
  const line = String(text || '').split('\n')[0] || ''
  return line.length > 90 ? line.slice(0, 90) : line
}

/** BM25 over the chunks of one or several papers. */
export function retrieve(question, documents, options = {}) {
  const limit = options.limit || 8
  const query = tokenize(question)
  if (!query.length) return []
  const pool = []
  for (const doc of documents) {
    for (const chunk of doc.chunks || []) {
      pool.push({ doc, chunk, tokens: tokenize(chunk.heading + ' ' + chunk.text) })
    }
  }
  if (!pool.length) return []
  const avgLen = pool.reduce((sum, row) => sum + row.tokens.length, 0) / pool.length || 1
  const df = new Map()
  for (const term of new Set(query)) {
    let count = 0
    for (const row of pool) if (row.tokens.includes(term)) count++
    df.set(term, count)
  }
  const k1 = 1.5
  const b = 0.75
  const scored = []
  for (const row of pool) {
    const counts = new Map()
    for (const token of row.tokens) counts.set(token, (counts.get(token) || 0) + 1)
    let score = 0
    for (const term of query) {
      const tf = counts.get(term) || 0
      if (!tf) continue
      const n = df.get(term) || 0
      const idf = Math.log(1 + (pool.length - n + 0.5) / (n + 0.5))
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (row.tokens.length / avgLen))))
    }
    if (score > 0) {
      scored.push({
        paperId: row.doc.paper.id,
        title: row.doc.paper.title,
        chunkId: row.doc.paper.id + '#' + row.chunk.index,
        heading: row.chunk.heading,
        text: row.chunk.text,
        score: Math.round(score * 1000) / 1000,
        quote: row.chunk.text.slice(0, 320),
      })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  const kept = scored.slice(0, limit)
  if (!kept.length) return []
  const best = kept[0].score
  const floor = options.minScore === undefined ? MIN_SCORE : Number(options.minScore)
  const ratio = isFinite(floor) && floor >= 0 && floor <= 1 ? floor : MIN_SCORE
  return kept.filter(row => row.score >= best * ratio)
}

function buildContext(hits) {
  return hits.map((hit, index) => {
    return '[S' + (index + 1) + '] paper=' + hit.paperId + ' chunk=' + hit.chunkId + ' heading=' + (hit.heading || '-') + '\n' + hit.text
  }).join('\n\n')
}

const ANSWER_SYSTEM = [
  'You are a research assistant that answers questions about scientific papers.',
  'You are given retrieved passages from one or more papers, each tagged [S1], [S2], ...',
  'Rules that are not negotiable:',
  '1. Use only the retrieved passages. Never add facts from memory.',
  '2. Every factual sentence must end with the tag of the passage it came from, like [S1].',
  '3. If the passages do not contain the answer, say so plainly and name what is missing.',
  '4. Quote the exact words you rely on. Do not paraphrase inside a quote.',
  '5. If two passages disagree, say that they disagree and cite both.',
  'Answer in the language of the question.',
].join('\n')

/**
 * Ask a question over the given documents.
 * The model answers in JSON: { answer, citations: [{ chunkId, quote }] }.
 * Every quote is checked against the chunk it names; a quote that does not
 * appear is dropped and reported as unverified.
 */
export async function ask(ctx, options) {
  const { streamText } = await import('./llm.mjs')
  const question = cleanText(options.question, 2000)
  const documents = Array.isArray(options.documents) ? options.documents : []
  const hits = retrieve(question, documents, { limit: options.limit || 8, minScore: options.minScore })
  if (!hits.length) {
    return {
      ok: false,
      answer: questionIsChinese(question)
        ? '资料库里没有找到能回答这个问题的段落。可以先加入相关文献并抓取全文，或把问题说得更贴近原文。'
        : 'No passage in the library answers this question. Add the relevant papers first, or ask in wording closer to the source text.',
      hits: [],
      citations: [],
      unverified: [],
    }
  }
  const context = buildContext(hits)
  const user = ['Question: ' + question, '', 'Retrieved passages:', context].join('\n')
  let raw = ''
  try {
    raw = await streamText(ctx, {
      system: ANSWER_SYSTEM + '\n\nReturn JSON only: {"answer": string, "citations": [{"chunkId": string, "quote": string}]}',
      user,
      signal: options.signal,
      temperature: 0.1,
      maxTokens: options.maxTokens || 3000,
      route: options.route,
    })
  } catch (err) {
    return {
      ok: false,
      answer: questionIsChinese(question)
        ? '模型这次没能完成作答，通常是连接中断或模型临时繁忙，请稍后再试。'
        : 'Model call failed: ' + (err && err.message ? err.message : String(err)),
      hits: hits.map(hit => ({ chunkId: hit.chunkId, title: hit.title, heading: hit.heading, score: hit.score })),
      citations: [],
      unverified: [],
    }
  }
  const parsed = parseJsonLoose(raw)
  const byId = new Map(hits.map(hit => [hit.chunkId, hit]))
  const answer = cleanText(parsed && parsed.answer, 20000)
  const citations = []
  const unverified = []
  const list = parsed && Array.isArray(parsed.citations) ? parsed.citations : []
  for (const item of list) {
    if (!isObject(item)) continue
    const chunkId = cleanText(item.chunkId, 120)
    const quote = cleanText(item.quote, 1200)
    const hit = byId.get(chunkId)
    if (!hit || !quote) {
      unverified.push({ chunkId: chunkId || '(empty)', quote: quote.slice(0, 120), reason: 'no matching chunk' })
      continue
    }
    if (!hit.text.includes(quote)) {
      unverified.push({ chunkId, quote: quote.slice(0, 120), reason: 'quote not present in source' })
      continue
    }
    citations.push({ chunkId, paperId: hit.paperId, title: hit.title, heading: hit.heading, quote })
  }
  return {
    ok: true,
    answer: answer || cleanText(raw, 8000),
    hits: hits.map(hit => ({ chunkId: hit.chunkId, title: hit.title, heading: hit.heading, score: hit.score })),
    citations,
    unverified,
  }
}
