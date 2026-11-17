// Unit tests for the query building and markup stripping in lib/search.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { arxivQuery, stripHtml } from '../lib/search.mjs'

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
