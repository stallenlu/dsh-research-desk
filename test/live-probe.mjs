// Live connectivity probe: real HTTP against arXiv / Europe PMC / OpenAlex,
// then real chunking + BM25 retrieval over a fetched full text. No model call.
import { search, fetchFullText } from '../lib/search.mjs'
import { chunkText, retrieve } from '../lib/qa.mjs'

const t0 = Date.now()
const res = await search('retrieval augmented generation scientific literature', { maxResults: 8 })
console.log('--- search ---')
console.log('elapsed_ms', Date.now() - t0)
console.log('papers', res.papers.length, 'errors', JSON.stringify(res.errors))
for (const p of res.papers.slice(0, 8)) {
  console.log(JSON.stringify({
    source: p.source, id: p.id || p.doi || p.arxivId, year: p.year,
    citedBy: p.citedBy, title: (p.title || '').slice(0, 70),
    hasAbstract: Boolean(p.abstract && p.abstract.length > 40),
  }))
}

const target = res.papers.find(p => p.source === 'arxiv' && p.arxivId) || res.papers.find(p => p.source === 'europepmc')
if (target) {
  const t1 = Date.now()
  const full = await fetchFullText(target)
  console.log('--- fulltext ---')
  console.log('source', target.source, 'kind', full.kind, 'chars', (full.text || '').length, 'elapsed_ms', Date.now() - t1)
  const chunks = chunkText(full.text || '')
  console.log('chunks', chunks.length, 'first_heading', chunks[0] && chunks[0].heading)
  const hits = retrieve('what method does the paper use for evaluation', [{ paper: { id: target.id, title: target.title }, chunks }])
  console.log('retrieval_hits', hits.length, hits[0] ? JSON.stringify({ id: hits[0].chunkId, score: Number(hits[0].score.toFixed(2)) }) : 'none')
  console.log('sample', (full.text || '').slice(0, 180).replace(/\n/g, ' '))
} else {
  console.log('--- fulltext --- no usable target')
}
