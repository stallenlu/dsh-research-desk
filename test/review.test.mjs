// Unit tests for the multi-perspective review. Run with: node --test test/review.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { PERSPECTIVES, generateReview, perspectiveKeys } from '../lib/review.mjs'

const DOCS = [
  {
    paper: { id: 'p1', title: 'Widget calibration', year: 2024, authors: ['Li Ming'] },
    chunks: [
      { index: 0, heading: 'Method', text: 'We used a controlled method to calibrate widgets. The evaluation covered three datasets.' },
      { index: 1, heading: 'Result', text: 'Calibration improved the widget accuracy by four percent on every dataset.' },
    ],
  },
]

// 假模型：记录每次调用，方便断言「没有段落时一次都不该调」。
function fakeStream(reply) {
  const calls = []
  const fn = async (ctx, options) => {
    calls.push(options)
    return typeof reply === 'function' ? await reply(options, calls.length) : reply
  }
  fn.calls = calls
  return fn
}

test('review: the five perspectives are defined', () => {
  assert.deepEqual(perspectiveKeys(), ['methodology', 'evidence', 'contradictions', 'gaps', 'applications'])
  for (const key of perspectiveKeys()) {
    assert.ok(PERSPECTIVES[key].label, key + ' 缺少中文名')
    assert.ok(PERSPECTIVES[key].query, key + ' 缺少检索词')
    assert.ok(PERSPECTIVES[key].instruction, key + ' 缺少写作指令')
  }
})

test('review: a quote that is in the source passes verification', async () => {
  const stream = fakeStream(JSON.stringify({
    text: '研究用受控方法校准了 widget。',
    citations: [{ chunkId: 'p1#0', quote: 'We used a controlled method to calibrate widgets.' }],
  }))
  const result = await generateReview({}, {
    documents: DOCS,
    perspectives: ['methodology'],
    topic: 'widget calibration',
    streamText: stream,
  })
  assert.equal(result.ok, true)
  assert.equal(result.sections.length, 1)
  const section = result.sections[0]
  assert.equal(section.key, 'methodology')
  assert.equal(section.label, PERSPECTIVES.methodology.label)
  assert.equal(section.citations.length, 1)
  assert.equal(section.unverified.length, 0)
  assert.equal(section.citations[0].chunkId, 'p1#0')
  assert.equal(section.citations[0].paperId, 'p1')
  assert.equal(section.citations[0].title, 'Widget calibration')
  assert.equal(section.citations[0].heading, 'Method')
  assert.equal(stream.calls.length, 1)
})

test('review: a quote that is not in the source is dropped into unverified', async () => {
  const stream = fakeStream(JSON.stringify({
    text: 'widget 每月校准一次。',
    citations: [{ chunkId: 'p1#0', quote: 'Widgets were calibrated monthly.' }],
  }))
  const result = await generateReview({}, {
    documents: DOCS,
    perspectives: ['methodology'],
    topic: 'widget calibration',
    streamText: stream,
  })
  const section = result.sections[0]
  assert.equal(section.citations.length, 0)
  assert.equal(section.unverified.length, 1)
  assert.equal(section.unverified[0].chunkId, 'p1#0')
  assert.ok(section.unverified[0].reason, '未核验引文必须写明原因')
  assert.equal(result.stats.citationCount, 0)
  assert.equal(result.stats.unverifiedCount, 1)
})

test('review: a quote naming an unknown chunk is dropped into unverified', async () => {
  const stream = fakeStream(JSON.stringify({
    text: '一条引文。',
    citations: [{ chunkId: 'p9#7', quote: 'Whatever.' }],
  }))
  const result = await generateReview({}, {
    documents: DOCS,
    perspectives: ['methodology'],
    topic: 'widget calibration',
    streamText: stream,
  })
  assert.equal(result.sections[0].citations.length, 0)
  assert.equal(result.sections[0].unverified.length, 1)
  assert.equal(result.sections[0].unverified[0].chunkId, 'p9#7')
})

test('review: no matching passage means the model is never called', async () => {
  const stream = fakeStream('这段绝不该被用到')
  const result = await generateReview({}, {
    documents: [{
      paper: { id: 'p2', title: 'Soil chemistry' },
      chunks: [{ index: 0, heading: 'Intro', text: 'Rhizosphere chemistry under drought.' }],
    }],
    perspectives: ['methodology'],
    topic: '',
    streamText: stream,
  })
  assert.equal(stream.calls.length, 0, '没有命中段落时不能调用模型')
  assert.equal(result.sections.length, 1)
  const section = result.sections[0]
  assert.match(section.text, /文献库中没有可支撑的段落/)
  assert.equal(section.citations.length, 0)
  assert.equal(section.hits.length, 0)
})

test('review: a failing perspective does not stop the other ones', async () => {
  const stream = fakeStream((options, n) => {
    if (n === 1) throw new Error('provider exploded')
    return JSON.stringify({ text: '第二个视角照常完成。', citations: [] })
  })
  const result = await generateReview({}, {
    documents: DOCS,
    perspectives: ['methodology', 'evidence'],
    topic: 'widget calibration',
    streamText: stream,
  })
  assert.equal(result.sections.length, 2)
  assert.ok(result.sections[0].error, '失败的视角必须记录 error')
  assert.match(result.sections[0].error, /provider exploded/)
  assert.equal(result.sections[1].error, undefined)
  assert.ok(result.sections[1].text.includes('第二个视角照常完成'))
  assert.equal(stream.calls.length, 2)
})

test('review: stats count sections, citations, unverified quotes and papers', async () => {
  const stream = fakeStream(JSON.stringify({
    text: '两条引文。',
    citations: [
      { chunkId: 'p1#0', quote: 'We used a controlled method to calibrate widgets.' },
      { chunkId: 'p1#1', quote: 'Calibration improved the widget accuracy by four percent on every dataset.' },
    ],
  }))
  const result = await generateReview({}, {
    documents: DOCS,
    perspectives: ['methodology'],
    topic: 'widget calibration',
    streamText: stream,
  })
  assert.equal(result.stats.sections, 1)
  assert.equal(result.stats.citationCount, 2)
  assert.equal(result.stats.unverifiedCount, 0)
  assert.equal(result.stats.paperCount, 1)
  assert.equal(result.stats.sections, result.sections.length)
})

test('review: perspectives are written one after another, not in parallel', async () => {
  let running = 0
  let maxRunning = 0
  const stream = fakeStream(async () => {
    running += 1
    maxRunning = Math.max(maxRunning, running)
    await new Promise(resolve => setTimeout(resolve, 5))
    running -= 1
    return JSON.stringify({ text: '好。', citations: [] })
  })
  await generateReview({}, {
    documents: DOCS,
    topic: 'widget calibration',
    streamText: stream,
  })
  assert.equal(maxRunning, 1, '视角必须顺序执行，避免模型限流')
})
