// Raw upstream probe: which query forms actually return rows from each source.
const UA = 'dsh-research-desk/0.1 (probe)'

async function get(url, asJson) {
  const t = Date.now()
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: asJson ? 'application/json' : '*/*' } })
    const body = await res.text()
    let n = -1
    if (asJson) { try { const j = JSON.parse(body); n = (j.results || j.response || []).length } catch {} }
    else { n = (body.match(/<entry>/g) || []).length }
    console.log(res.status, 'len', body.length, 'rows', n, 'ms', Date.now() - t, url.slice(0, 110))
    return body
  } catch (err) {
    console.log('ERR', err.message, url.slice(0, 110))
    return ''
  }
}

const terms = 'retrieval augmented generation scientific literature'
console.log('== arXiv variants ==')
await get('https://export.arxiv.org/api/query?search_query=' + encodeURIComponent('all:"' + terms + '"') + '&start=0&max_results=3', false)
await get('https://export.arxiv.org/api/query?search_query=' + encodeURIComponent('all:' + terms) + '&start=0&max_results=3', false)
await get('https://export.arxiv.org/api/query?search_query=' + encodeURIComponent('ti:' + terms) + '&start=0&max_results=3', false)
await get('https://export.arxiv.org/api/query?search_query=' + encodeURIComponent('all:retrieval AND all:augmented AND all:generation') + '&start=0&max_results=3', false)
await get('https://export.arxiv.org/api/query?search_query=' + encodeURIComponent('abs:retrieval+AND+abs:augmented') + '&start=0&max_results=3', false)

console.log('== Europe PMC ==')
await get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=' + encodeURIComponent(terms) + '&format=json&resultType=core&pageSize=3', true)
await get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=' + encodeURIComponent('(' + terms + ')') + '&format=json&pageSize=3', true)

console.log('== OpenAlex ==')
await get('https://api.openalex.org/works?search=' + encodeURIComponent(terms) + '&per-page=3', true)
await get('https://api.openalex.org/works?search=' + encodeURIComponent('retrieval augmented generation') + '&per-page=3', true)
