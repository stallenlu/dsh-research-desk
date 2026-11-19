// 判据引擎单元测试（node:test），全部说明使用中文。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extract, judge, OPS, lintRegex, MAX_OUTPUT_CHARS } from '../lib/criteria.mjs'

test('抽取：mode=last 取末值，mode=all 返回数组', () => {
  const text = '收益 3.5% 收益 4.1%'
  const got = extract(text, [
    { name: 'last', regex: '收益\\s*([\\d.]+)', type: 'float' },
    { name: 'all', regex: '收益\\s*([\\d.]+)', type: 'float', mode: 'all' },
  ])
  assert.equal(got.last, 4.1)
  assert.deepEqual(got.all, [3.5, 4.1])
})

test('抽取：group / type 转换与无匹配', () => {
  const got = extract('A=12 B=3.5 C=true D=no E=x', [
    { name: 'i', regex: 'A=(\\d+)', type: 'int' },
    { name: 'f', regex: 'B=([\\d.]+)', type: 'num' },
    { name: 'bt', regex: 'C=(\\w+)', type: 'bool' },
    { name: 'bf', regex: 'D=(\\w+)', type: 'bool' },
    { name: 's', regex: 'E=(\\w+)', type: 'str' },
    { name: 'none', regex: 'Z=(\\d+)' },
    { name: 'g0', regex: 'A=\\d+', group: 0 },
  ])
  assert.equal(got.i, 12)
  assert.equal(got.f, 3.5)
  assert.equal(got.bt, true)
  assert.equal(got.bf, false)
  assert.equal(got.s, 'x')
  assert.equal(got.none, null)
  assert.equal(got.g0, 'A=12')
})

test('抽取：文本先截断到 MAX_OUTPUT_CHARS', () => {
  assert.equal(MAX_OUTPUT_CHARS, 20000)
  const withTail = 'K=1' + 'X'.repeat(MAX_OUTPUT_CHARS) + 'K=2'
  assert.equal(extract(withTail, [{ name: 'k', regex: 'K=(\\d+)', type: 'int' }]).k, 1)
  const exact = 'X'.repeat(MAX_OUTPUT_CHARS - 3) + 'K=2'
  assert.equal(extract(exact, [{ name: 'k', regex: 'K=(\\d+)', type: 'int' }]).k, 2)
  const cut = 'X'.repeat(MAX_OUTPUT_CHARS - 2) + 'K=2'
  assert.equal(extract(cut, [{ name: 'k', regex: 'K=(\\d+)', type: 'int' }]).k, null)
})

test('固定算子：eq/neq/gt/gte/lt/lte/in 边界', () => {
  assert.equal(OPS.eq(1, 1), true)
  assert.equal(OPS.eq(1, 1.0000001), false)
  assert.equal(OPS.neq(1, 2), true)
  assert.equal(OPS.gt(2, 1), true)
  assert.equal(OPS.gt(1, 1), false)
  assert.equal(OPS.gte(1, 1), true)
  assert.equal(OPS.lt(1, 2), true)
  assert.equal(OPS.lt(2, 2), false)
  assert.equal(OPS.lte(2, 2), true)
  assert.equal(OPS.in(3, [1, 2, 3]), true)
  assert.equal(OPS.in('3', [1, 2, 3]), true)
  assert.equal(OPS.in(4, '1,2,3'), false)
})

test('固定算子：非有限数与空值一律不通过', () => {
  for (const op of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']) {
    assert.equal(OPS[op](NaN, 1), false, op)
    assert.equal(OPS[op](Infinity, 1), false, op)
    assert.equal(OPS[op](1, undefined), false, op)
    assert.equal(OPS[op](null, 1), false, op)
  }
})

test('converged：滑窗 + 容差 + 连续 N', () => {
  const flat = [1.0, 1.0005, 1.0009, 1.0002, 1.0001]
  assert.equal(OPS.converged(flat, null, { window: 3, tolerance: 1e-3, consecutive: 2 }), true)
  const spike = [1, 1.0001, 1.5, 1.0002, 1.0003, 1.0004]
  assert.equal(OPS.converged(spike, null, { window: 3, tolerance: 1e-3, consecutive: 2 }), false)
})

test('converged：默认参数与非法形状', () => {
  const seq = [1, 1.0004, 1.0008, 1.0001]
  assert.equal(OPS.converged(seq), true)
  assert.equal(OPS.converged([1, 1.0001]), false)
  assert.equal(OPS.converged('1,1,1'), false)
  assert.equal(OPS.converged([1, NaN, 1, 1, 1]), false)
  assert.equal(OPS.converged([1, 1.0001, 1, 1, 1], null, { tolerance: 0 }), false)
})

test('monotonic / stable：方向与容差', () => {
  assert.equal(OPS.monotonic([1, 2, 2, 3]), true)
  assert.equal(OPS.monotonic([3, 2, 2, 1], null, { direction: 'down' }), true)
  assert.equal(OPS.monotonic([1, 3, 2]), false)
  assert.equal(OPS.monotonic([1, 2, 2, 3], null, { strict: true }), false)
  assert.equal(OPS.monotonic([1, 2, 3, 4], null, { direction: 'down' }), false)
  assert.equal(OPS.monotonic([1]), false)
  assert.equal(OPS.stable([1, 1.0005, 1.0009]), true)
  assert.equal(OPS.stable([1, 1.02, 1.0009]), false)
  assert.equal(OPS.stable([1]), false)
})

test('judge：missing / invalid-op / invalid-shape', () => {
  const out = judge({ a: 1, b: 5 }, [
    { id: 'm1', metric: 'x', op: 'gt', threshold: 0, required: true },
    { id: 'm2', metric: 'a', op: 'no-such-op', threshold: 0, required: false },
    { id: 'm3', metric: 'a', op: 'converged', convergence: {}, required: false },
    { id: 'm4', metric: 'b', op: 'gt', threshold: 4, required: true },
  ])
  assert.equal(out.passed, false)
  assert.deepEqual(out.results.map((r) => r.verdict), ['missing', 'invalid-op', 'invalid-shape', 'pass'])
  assert.deepEqual(out.results.map((r) => r.ok), [false, false, false, true])
})

test('judge：required 汇总与 convergence 字段', () => {
  const metrics = { score: 0.9, seq: [1, 1.0004, 1.0008, 1.0001] }
  const out = judge(metrics, [
    { id: 'r1', metric: 'score', op: 'gte', threshold: 0.95, required: true },
    { id: 'r2', metric: 'seq', op: 'converged', required: true, convergence: { window: 3, tolerance: 1e-3, consecutive: 2 } },
    { id: 'r3', metric: 'seq', op: 'stable', required: false, convergence: { tolerance: 1e-3 } },
  ])
  assert.equal(out.passed, false)
  assert.deepEqual(out.results, [
    { id: 'r1', verdict: 'fail', ok: false },
    { id: 'r2', verdict: 'pass', ok: true },
    { id: 'r3', verdict: 'pass', ok: true },
  ])
})

test('judge：threshold 与 convergence 各司其职', () => {
  const out = judge({ v: 5, arr: [1, 1.0001, 1, 1.0002, 1] }, [
    { id: 'a', metric: 'v', op: 'gt', threshold: 4, required: true, convergence: { tolerance: 999 } },
    { id: 'b', metric: 'arr', op: 'stable', threshold: 0, required: true, convergence: { tolerance: 1e-3 } },
  ])
  assert.equal(out.passed, true)
})

test('lintRegex：长度 / 嵌套量词 / 捕获组 / 编译四类规则', () => {
  assert.deepEqual(lintRegex('(\\d+)'), { ok: true, reason: null })
  const cases = [
    ['(' + 'a'.repeat(201) + ')', 'too-long'],
    ['(a+)+', 'nested-quantifier'],
    ['(a)(b)(c)(d)(e)', 'too-many-groups'],
    ['(', 'compile-error'],
  ]
  for (const [pattern, detail] of cases) {
    const r = lintRegex(pattern)
    assert.equal(r.ok, false, pattern)
    assert.equal(r.reason, 'invalid-regex', pattern)
    assert.equal(r.detail, detail, pattern)
  }
})

test('extract：非法正则被跳过并记录 __issues，且不污染指标对象', () => {
  const got = extract('abc', [
    { name: 'ok', regex: '(a)' },
    { name: 'bad', regex: '(a+)+' },
    { name: 'many', regex: '(a)(b)(c)(d)(e)' },
  ])
  assert.equal(got.ok, 'a')
  assert.equal(got.bad, null)
  assert.equal(got.many, null)
  assert.ok(Array.isArray(got.__issues))
  assert.deepEqual(got.__issues.map((i) => i.detail), ['nested-quantifier', 'too-many-groups'])
  assert.deepEqual(got, { ok: 'a', bad: null, many: null })
})

test('引擎不含动态执行，也不依赖第三方包', () => {
  const src = readFileSync(new URL('../lib/criteria.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /\beval\s*\(/)
  assert.doesNotMatch(src, /\bnew\s+Function\s*\(/)
  assert.doesNotMatch(src, /@deepseek-ai/)
  assert.match(src, /from 'node:perf_hooks'/)
})
