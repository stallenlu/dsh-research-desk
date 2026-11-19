// provenance-lite 纯函数层单测。跑法：node --test test/provenance.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_TIMEOUT_MS,
  GRACE_MS,
  findByHash,
  inputHash,
  lineage,
  markOrphans,
  stable,
} from '../lib/provenance.mjs'

const ISO = ms => new Date(ms).toISOString()
const NOW = Date.parse('2026-01-01T00:00:00.000Z')

function baseSpec() {
  return {
    runtime: 'node',
    code: 'console.log(1)',
    params: { b: 2, a: 1 },
    packages: ['numpy', 'pandas'],
    solver: 's1',
    toolchain: 'node22',
  }
}

test('stable: 对象 key 顺序无关，输出按字典序排列', () => {
  assert.equal(stable({ b: 1, a: 2 }), stable({ a: 2, b: 1 }))
  assert.equal(stable({ b: 1, a: 2 }), '{"a":2,"b":1}')
})

test('stable: 嵌套对象与数组（数组顺序敏感）', () => {
  assert.equal(stable({ x: [2, { q: 1, p: 0 }] }), '{"x":[2,{"p":0,"q":1}]}')
  assert.notEqual(stable({ x: [1, 2] }), stable({ x: [2, 1] }))
  assert.equal(stable([]), '[]')
  assert.equal(stable({}), '{}')
})

test('stable: 标量按 JSON.stringify 处理', () => {
  assert.equal(stable(7), '7')
  assert.equal(stable('a'), '"a"')
  assert.equal(stable(null), 'null')
  assert.equal(stable(true), 'true')
})

test('inputHash: 相同输入得到相同 sha256 前缀指纹', () => {
  assert.equal(inputHash(baseSpec()), inputHash(baseSpec()))
  assert.match(inputHash(baseSpec()), /^sha256:[0-9a-f]{64}$/)
})

test('inputHash: 不受 id、时间戳、stdout 影响', () => {
  const base = baseSpec()
  const noisy = {
    ...base,
    id: 'run-1',
    createdAt: ISO(NOW),
    finishedAt: ISO(NOW + 1),
    stdout: '大量输出',
  }
  assert.equal(inputHash(noisy), inputHash(base))
})

test('inputHash: 最小输入集——无关字段不影响，关键字段变化才变化', () => {
  const base = baseSpec()
  assert.equal(inputHash({ ...base, tags: ['x'], score: 0.9 }), inputHash(base))
  assert.notEqual(inputHash({ ...base, code: 'different' }), inputHash(base))
  assert.notEqual(inputHash({ ...base, runtime: 'python' }), inputHash(base))
  assert.notEqual(inputHash({ ...base, solver: 's2' }), inputHash(base))
})

test('inputHash: params/packages 缺省补空对象与空数组', () => {
  const minimal = { runtime: 'node', code: 'x' }
  assert.equal(inputHash(minimal), inputHash({ ...minimal, params: {}, packages: [] }))
})

test('findByHash: 命中 done（缓存命中）', () => {
  const runs = [
    { id: 'r1', inputHash: 'sha256:A', status: 'failed' },
    { id: 'r2', inputHash: 'sha256:B', status: 'done' },
  ]
  assert.equal(findByHash('sha256:B', runs), runs[1])
})

test('findByHash: 命中 running（复用预留）', () => {
  const runs = [{ id: 'r1', inputHash: 'sha256:X', status: 'running' }]
  assert.equal(findByHash('sha256:X', runs), runs[0])
})

test('findByHash: 未命中或只有 failed/queued 时返回 null', () => {
  const runs = [
    { id: 'r1', inputHash: 'sha256:A', status: 'failed' },
    { id: 'r2', inputHash: 'sha256:B', status: 'queued' },
  ]
  assert.equal(findByHash('sha256:A', runs), null)
  assert.equal(findByHash('sha256:Z', runs), null)
  assert.equal(findByHash('sha256:A', []), null)
})

test('lineage: 沿 parentRunId 单父链回溯，起点在前', () => {
  const runs = [
    { id: 'A' },
    { id: 'B', parentRunId: 'A' },
    { id: 'C', parentRunId: 'B' },
  ]
  assert.deepEqual(lineage('C', runs).map(r => r.id), ['C', 'B', 'A'])
  assert.deepEqual(lineage('A', runs).map(r => r.id), ['A'])
  assert.deepEqual(lineage('missing', runs), [])
})

test('markOrphans: 超过 timeoutMs + 余量才判孤儿', () => {
  const total = DEFAULT_TIMEOUT_MS + GRACE_MS
  const runs = [
    { id: 'old', status: 'running', startedAt: ISO(NOW - total - 1) },
    { id: 'fresh', status: 'running', startedAt: ISO(NOW - total + 1000) },
    { id: 'done-old', status: 'done', startedAt: ISO(NOW - total - 999999) },
  ]
  assert.deepEqual(markOrphans(runs, ISO(NOW)), ['old'])
})

test('markOrphans: 自定义 timeoutMs 与毫秒 startedAt', () => {
  const runs = [
    { id: 'x', status: 'running', startedAt: NOW - 70000 },
    { id: 'y', status: 'running', startedAt: NOW - 1000 },
  ]
  assert.deepEqual(markOrphans(runs, ISO(NOW), 1000), ['x'])
})

test('markOrphans: 纯函数，不改入参，跳过无效 startedAt 与非 running', () => {
  const runs = [
    { id: 'a', status: 'running', startedAt: ISO(NOW - 9999999) },
    { id: 'b', status: 'done', startedAt: ISO(NOW - 9999999) },
    { id: 'c', status: 'running', startedAt: 'not-a-date' },
  ]
  const snapshot = JSON.stringify(runs)
  assert.deepEqual(markOrphans(runs, ISO(NOW)), ['a'])
  assert.equal(JSON.stringify(runs), snapshot)
})
