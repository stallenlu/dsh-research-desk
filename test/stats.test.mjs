// Tests for the built-in statistics.
//
// The t tail is checked against an independent method: numeric integration
// of the Student t density with Simpson's rule. The integration uses the
// Stirling series of the gamma function, so it shares no code with the
// incomplete beta implementation under test.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adjustPvalues,
  describe,
  oneSampleT,
  pairedT,
  parseNumbers,
  studentTwoSidedP,
  tCritical,
  twoSampleWelch,
} from '../lib/stats.mjs'

/**
 * log gamma by the Stirling series.
 * The series gives log gamma of a large argument directly; for a small
 * argument the recurrence shifts it up and the product is divided out.
 * @param {number} z - the argument, positive.
 * @returns {number} the natural log of gamma of z.
 */
function logGammaStirling(z) {
  let n = z
  let shift = 0
  while (n < 12) { n += 1; shift += 1 }
  const series = (n - 0.5) * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * n) - 1 / (360 * n * n * n)
  let correction = 0
  for (let i = 0; i < shift; i++) correction += Math.log(z + i)
  return series - correction
}

function tPdf(x, df) {
  const logDensity = logGammaStirling((df + 1) / 2) - logGammaStirling(df / 2) - 0.5 * Math.log(Math.PI * df) - ((df + 1) / 2) * Math.log(1 + (x * x) / df)
  return Math.exp(logDensity)
}

/** Two sided p value by integrating the density from t to infinity. */
function integratedP(t, df) {
  const start = Math.abs(t)
  const upper = start + 400
  const steps = 400000
  const h = (upper - start) / steps
  let sum = tPdf(start, df) + tPdf(upper, df)
  for (let i = 1; i < steps; i++) {
    const x = start + i * h
    sum += (i % 2 === 0 ? 2 : 4) * tPdf(x, df)
  }
  const area = (h / 3) * sum
  return Math.min(1, 2 * area)
}

test('the independent integrator reproduces a known p value', () => {
  const p = integratedP(0, 4)
  assert.ok(Math.abs(p - 1) < 1e-6, 'p=' + p)
})

test('studentTwoSidedP agrees with numeric integration', () => {
  const cases = [
    { t: 0, df: 4 },
    { t: 1, df: 4 },
    { t: 2.228138852, df: 10 },
    { t: 1.96, df: 1000 },
    { t: 3.5, df: 7 },
  ]
  for (const row of cases) {
    const got = studentTwoSidedP(row.t, row.df)
    const want = integratedP(row.t, row.df)
    assert.ok(Math.abs(got - want) < 1e-6, 't=' + row.t + ' df=' + row.df + ' got=' + got + ' want=' + want)
  }
})

test('studentTwoSidedP matches the published critical values', () => {
  const table = [
    { df: 1, crit: 12.706 },
    { df: 2, crit: 4.303 },
    { df: 5, crit: 2.571 },
    { df: 10, crit: 2.228 },
    { df: 30, crit: 2.042 },
    { df: 100, crit: 1.984 },
  ]
  for (const row of table) {
    const got = tCritical(row.df, 0.05)
    assert.ok(Math.abs(got - row.crit) < 1e-3, 'df=' + row.df + ' got=' + got + ' want~' + row.crit)
  }
})

test('oneSampleT reports the expected numbers for a known sample', () => {
  const xs = [1.1, 2.1, 3.1, 4.1, 5.1]
  const result = oneSampleT(xs, 3, 0.05)
  assert.equal(result.ok, true)
  assert.equal(result.df, 4)
  assert.ok(Math.abs(result.mean - 3.1) < 1e-12)
  assert.ok(Math.abs(result.sd - Math.sqrt(2.5)) < 1e-12)
  assert.ok(Math.abs(result.t - 0.1414213562373095) < 1e-12)
  assert.ok(Math.abs(result.p - 0.8943736167296364) < 1e-6, 'p=' + result.p)
  assert.ok(Math.abs(result.p - integratedP(result.t, 4)) < 1e-6)
  assert.equal(result.significant, false)
  assert.ok(result.ciLow < result.mean && result.ciHigh > result.mean)
  assert.ok(result.ciDiffLow < result.mean - 3)
  assert.ok(result.ciDiffHigh > result.mean - 3)
  assert.ok(result.ciDiffLow < result.ciDiffHigh)
  assert.equal(result.pAdjusted, result.p)
})

test('oneSampleT rejects samples that cannot support a test', () => {
  assert.equal(oneSampleT([1], 0).ok, false)
  assert.equal(oneSampleT([2, 2, 2], 2).ok, false)
})

test('twoSampleWelch finds a difference and does not assume equal variance', () => {
  const a = [10.2, 10.4, 10.1, 10.6, 10.3]
  const b = [8.1, 8.4, 7.9, 8.6, 8.2]
  const result = twoSampleWelch(a, b, 0.05)
  assert.equal(result.ok, true)
  assert.ok(result.p < 0.01, 'p=' + result.p)
  assert.equal(result.significant, true)
  assert.ok(result.ciLow > 0, 'ciLow=' + result.ciLow)
  assert.ok(Math.abs(result.p - studentTwoSidedP(result.t, result.df)) < 1e-12)
  assert.ok(Math.abs(result.p - integratedP(result.t, result.df)) < 1e-6)
})

test('twoSampleWelch refuses groups that are too small', () => {
  assert.equal(twoSampleWelch([1], [2, 3]).ok, false)
})

test('pairedT compares matched pairs', () => {
  const before = [5, 6, 7, 8]
  const after = [6, 7.5, 8, 9.5]
  const result = pairedT(before, after, 0.05)
  assert.equal(result.ok, true)
  assert.equal(result.kind, 'paired')
  assert.ok(Math.abs(result.mean + 1.25) < 1e-12)
  assert.ok(Math.abs(result.t + 8.660254037844387) < 1e-9)
  assert.ok(result.p < 0.05, 'p=' + result.p)
})

test('pairedT refuses pairs without variance and pairs of different length', () => {
  assert.equal(pairedT([1, 2, 3], [2, 3, 4]).ok, false)
  assert.equal(pairedT([1, 2], [2]).ok, false)
})

test('adjustPvalues keeps holm monotonic and never exceeds one', () => {
  const p = [0.01, 0.04, 0.03, 0.2]
  const holm = adjustPvalues(p, 'holm')
  assert.equal(holm.length, 4)
  assert.ok(Math.abs(holm[0] - 0.04) < 1e-12)
  assert.ok(Math.abs(holm[1] - 0.09) < 1e-12)
  assert.ok(Math.abs(holm[2] - 0.09) < 1e-12)
  assert.ok(Math.abs(holm[3] - 0.2) < 1e-12)
  const bonferroni = adjustPvalues(p, 'bonferroni')
  assert.ok(Math.abs(bonferroni[0] - 0.04) < 1e-12)
  assert.ok(Math.abs(bonferroni[3] - 0.8) < 1e-12)
  assert.deepEqual(adjustPvalues(p, 'none'), p)
})

test('describe and parseNumbers handle ordinary input', () => {
  const stats = describe([1, 2, 3, 4])
  assert.equal(stats.n, 4)
  assert.ok(Math.abs(stats.mean - 2.5) < 1e-12)
  assert.ok(Math.abs(stats.median - 2.5) < 1e-12)
  assert.deepEqual(parseNumbers('1, 2;3\n4  x'), [1, 2, 3, 4])
})