// Unit tests for the research desk. Run with: node --test test/
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { cleanText, parseJsonLoose, isHttpUrl, toNumber } from '../lib/util.mjs'
import { applyOps, emptyState, migrateState, paperKey } from '../lib/desk.mjs'
import { Store, revertChange } from '../lib/store.mjs'
import { chunkText, retrieve, tokenize, ask } from '../lib/qa.mjs'

function fakeCtx(reply, finishKind = 'stop') {
  const llm = {
    prepareCall: async () => ({
      config: {},
      stream: async function* () {
        yield { type: 'block-end', index: 0, block: { type: 'text', text: reply } }
        yield { type: 'finish', reason: { kind: finishKind } }
      },
    }),
  }
  return { get: name => (name === 'llm' ? llm : undefined) }
}

test('util: cleanText collapses whitespace and truncates', () => {
  assert.equal(cleanText('  a\n\n b  ', 100), 'a b')
  assert.equal(cleanText('abcdef', 3).length, 3)
  assert.equal(cleanText(undefined), '')
})

test('util: parseJsonLoose handles prose and fences', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 })
  assert.deepEqual(parseJsonLoose('here it is: {"a":2} thanks'), { a: 2 })
  assert.deepEqual(parseJsonLoose('```json\n{"a":3}\n```'), { a: 3 })
  assert.equal(parseJsonLoose('no json here'), null)
})

test('util: isHttpUrl and toNumber', () => {
  assert.equal(isHttpUrl('https://arxiv.org/abs/2401.1'), true)
  assert.equal(isHttpUrl('javascript:alert(1)'), false)
  assert.equal(toNumber('12'), 12)
  assert.equal(toNumber('x'), undefined)
})

test('desk: add_paper dedupes on doi, arxiv id, then title', () => {
  const state = emptyState()
  const first = applyOps(state, [{ op: 'add_paper', paper: { title: 'A', doi: '10.1/x' } }])
  assert.equal(first.changed, true)
  assert.equal(state.papers.length, 1)
  const second = applyOps(state, [{ op: 'add_paper', paper: { title: 'A again', doi: '10.1/X' } }])
  assert.equal(second.changed, false)
  assert.equal(state.papers.length, 1)
  assert.match(second.errors[0], /已经有了/)
})

test('desk: unknown fields from the model are dropped, not merged', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_paper', paper: { title: 'A', evil: 'x' } }])
  assert.equal(state.papers[0].evil, undefined)
})

test('desk: paper without a title is refused', () => {
  const state = emptyState()
  const out = applyOps(state, [{ op: 'add_paper', paper: { abstract: 'no title' } }])
  assert.equal(out.changed, false)
  assert.match(out.errors[0], /没有标题/)
})

test('desk: hypothesis evidence only keeps known paper ids', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_paper', paper: { title: 'A', doi: '10.1/x' } }])
  const id = state.papers[0].id
  applyOps(state, [{ op: 'add_hypothesis', title: 'H1', evidence: [id, 'ghost-id'] }])
  assert.deepEqual(state.hypotheses[0].evidence, [id])
})

test('desk: remove_paper and set_paper_status', () => {
  const state = emptyState()
  applyOps(state, [{ op: 'add_paper', paper: { title: 'A', doi: '10.1/x' } }])
  const id = state.papers[0].id
  applyOps(state, [{ op: 'set_paper_status', id, status: 'read' }])
  assert.equal(state.papers[0].status, 'read')
  const bad = applyOps(state, [{ op: 'set_paper_status', id, status: 'nonsense' }])
  assert.equal(bad.changed, false)
  applyOps(state, [{ op: 'remove_paper', id }])
  assert.equal(state.papers.length, 0)
})

test('desk: paperKey prefers doi then arxiv then title', () => {
  assert.equal(paperKey({ doi: '10.1/A', title: 'x' }), 'doi:10.1/a')
  assert.equal(paperKey({ arxivId: '2401.1', title: 'x' }), 'arxiv:2401.1')
  assert.equal(paperKey({ title: 'Some Title' }), 'title:some title')
})

test('desk: migrateState repairs a broken state file', () => {
  const state = migrateState({ papers: 'not-a-list', hypotheses: null })
  assert.deepEqual(state.papers, [])
  assert.deepEqual(state.hypotheses, [])
  assert.ok(state.settings.maxResults > 0)
})

test('store: mutate writes to disk and undo restores the previous value', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rd-store-'))
  try {
    const store = new Store(root, migrateState)
    await store.mutate('add', draft => {
      applyOps(draft, [{ op: 'add_paper', paper: { title: 'First', doi: '10.1/x' } }])
    })
    let state = await store.read()
    assert.equal(state.papers.length, 1)
    const step = await store.undoStep()
    assert.equal(step.ok, true)
    state = await store.read()
    assert.equal(state.papers.length, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('store: undo does not clobber a later edit of the same row', () => {
  const before = { papers: [{ id: 'a', title: 'old' }] }
  const after = { papers: [{ id: 'a', title: 'new' }] }
  const current = { papers: [{ id: 'a', title: 'newer' }] }
  const result = revertChange(before, after, current)
  assert.equal(result.papers[0].title, 'newer')
})

test('store: history lists steps and restore jumps back, dropping later steps as a branch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rd-hist-'))
  try {
    const store = new Store(root, migrateState)
    await store.mutate('add First', draft => { applyOps(draft, [{ op: 'add_paper', paper: { title: 'First' } }]) })
    await store.mutate('add Second', draft => { applyOps(draft, [{ op: 'add_paper', paper: { title: 'Second' } }]) })
    await store.mutate('add Third', draft => { applyOps(draft, [{ op: 'add_paper', paper: { title: 'Third' } }]) })
    const steps = store.history()
    assert.equal(steps.length, 3)
    assert.deepEqual(steps.map(s => s.label), ['add First', 'add Second', 'add Third'])
    assert.ok(steps[0].at)
    // 回到第 1 步（index 0）之后的状态：只剩 First
    const back = await store.restore(0)
    assert.equal(back.ok, true)
    assert.equal(back.label, 'add First')
    let state = await store.read()
    assert.equal(state.papers.length, 1)
    assert.equal(state.papers[0].title, 'First')
    // 后续步骤作为分支被丢弃
    assert.equal(store.history().length, 1)
    assert.equal((await store.restore(2)).ok, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('qa: tokenize keeps latin words and CJK characters', () => {
  const tokens = tokenize('Transformer 注意力 mechanism')
  assert.ok(tokens.includes('transformer'))
  assert.ok(tokens.includes('注'))
  assert.ok(tokens.includes('意'))
})

test('qa: chunkText splits long text into ordered chunks', () => {
  const body = Array.from({ length: 40 }, (_, i) => 'Paragraph ' + i + ' ' + 'x'.repeat(80)).join('\n')
  const chunks = chunkText(body)
  assert.ok(chunks.length > 3)
  assert.deepEqual(chunks.map(c => c.index), chunks.map((_, i) => i))
  assert.ok(chunks.every(c => typeof c.text === 'string' && c.text.length > 0))
})

test('qa: retrieve ranks the passage that matches the question first', () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [
      { index: 0, heading: 'Intro', text: 'This paper is about widget calibration in the lab.' },
      { index: 1, heading: 'Method', text: 'We train a widget language model on synthetic data.' },
      { index: 2, heading: 'Result', text: 'Unrelated results about soil chemistry.' },
    ],
  }
  const hits = retrieve('widget language model training', [doc])
  assert.ok(hits.length > 0)
  assert.equal(hits[0].chunkId, 'p1#1')
})

test('qa: a quote that is not in the source is reported as unverified', async () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [{ index: 0, heading: 'Intro', text: 'Widgets were calibrated daily.' }],
  }
  const reply = JSON.stringify({
    answer: 'Widgets were calibrated monthly [S1].',
    citations: [{ chunkId: 'p1#0', quote: 'Widgets were calibrated monthly.' }],
  })
  const result = await ask(fakeCtx(reply), {
    question: 'how often were widgets calibrated',
    documents: [doc],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.ok, true)
  assert.equal(result.citations.length, 0)
  assert.equal(result.unverified.length, 1)
  assert.equal(result.unverified[0].reason, 'quote not present in source')
})

test('qa: a quote that is in the source passes verification', async () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [{ index: 0, heading: 'Intro', text: 'Widgets were calibrated daily.' }],
  }
  const reply = JSON.stringify({
    answer: 'Widgets were calibrated daily [S1].',
    citations: [{ chunkId: 'p1#0', quote: 'Widgets were calibrated daily.' }],
  })
  const result = await ask(fakeCtx(reply), {
    question: 'how often were widgets calibrated',
    documents: [doc],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.citations.length, 1)
  assert.equal(result.unverified.length, 0)
})

test('qa: a failing model stream is reported, not thrown', async () => {
  const doc = {
    paper: { id: 'p1', title: 'Paper one' },
    chunks: [{ index: 0, heading: 'Intro', text: 'Widgets were calibrated daily.' }],
  }
  const result = await ask(fakeCtx('partial', 'error'), {
    question: 'widgets',
    documents: [doc],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.ok, false)
  assert.match(result.answer, /Model call failed/)
})

test('qa: a question with no matching passage never calls the model', async () => {
  const result = await ask(fakeCtx('should not be used'), {
    question: 'zzzzz qqqqq',
    documents: [{ paper: { id: 'p1', title: 'Paper one' }, chunks: [{ index: 0, heading: 'I', text: 'widgets' }] }],
    route: { provider: 'test', model: 'test-model' },
  })
  assert.equal(result.ok, false)
  assert.match(result.answer, /No passage/)
})
