// Pure-JS statistics for the verification side of the desk.
//
// The desk must be able to re-check a p value on a machine that has nothing
// but Node, so nothing here depends on an external package. The numbers are
// computed the way scipy does: Student t tail from the regularized
// incomplete beta function, and the critical value by bisection on that tail.

export function mean(xs) {
  if (!xs.length) return NaN
  let sum = 0
  for (const x of xs) sum += x
  return sum / xs.length
}

export function variance(xs) {
  const n = xs.length
  if (n < 2) return NaN
  const m = mean(xs)
  let sum = 0
  for (const x of xs) sum += (x - m) * (x - m)
  return sum / (n - 1)
}

export function stdev(xs) {
  const v = variance(xs)
  return isFinite(v) ? Math.sqrt(v) : NaN
}

export function quantile(xs, q) {
  if (!xs.length) return NaN
  const sorted = xs.slice().sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted.length === 1) return sorted[0]
  if (rest === 0) return sorted[base]
  return sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

export function describe(xs) {
  const n = xs.length
  if (!n) return { n: 0 }
  const sd = stdev(xs)
  return {
    n,
    mean: mean(xs),
    sd,
    sem: isFinite(sd) ? sd / Math.sqrt(n) : NaN,
    median: quantile(xs, 0.5),
    q1: quantile(xs, 0.25),
    q3: quantile(xs, 0.75),
    min: Math.min.apply(null, xs),
    max: Math.max.apply(null, xs),
  }
}

export function erf(x) {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - poly * Math.exp(-ax * ax))
}

export function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

function logGamma(x) {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y += 1
    ser += cof[j] / y
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}

function betaContinuedFraction(a, b, x) {
  const tiny = 1e-300
  const eps = 3e-12
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < tiny) d = tiny
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < tiny) d = tiny
    c = 1 + aa / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < eps) break
  }
  return h
}

export function regularizedIncompleteBeta(a, b, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b
}

/** Two sided p value of a Student t statistic. */
export function studentTwoSidedP(t, df) {
  if (!isFinite(t) || !isFinite(df) || df <= 0) return NaN
  const x = df / (df + t * t)
  return regularizedIncompleteBeta(df / 2, 0.5, x)
}

/** Critical value of the Student t distribution by bisection on the tail. */
export function tCritical(df, alpha) {
  let lo = 0
  let hi = 400
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (studentTwoSidedP(mid, df) > alpha) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function confidenceInterval(estimate, se, df, alpha) {
  const crit = tCritical(df, alpha)
  return { low: estimate - crit * se, high: estimate + crit * se, crit }
}

/**
 * One sample t test against a reference value.
 * @param {number[]} xs - the observations.
 * @param {number} mu0 - the reference value, default 0.
 * @param {number} alpha - the significance level, default 0.05.
 * @returns {object} the test result.
 */
export function oneSampleT(xs, mu0, alpha) {
  const a = alpha === undefined ? 0.05 : alpha
  const n = xs.length
  if (n < 2) return { ok: false, error: '至少需要两个观测' }
  const m = mean(xs)
  const sd = stdev(xs)
  if (!isFinite(sd) || sd === 0) return { ok: false, error: '数据没有方差' }
  const se = sd / Math.sqrt(n)
  const t = (m - mu0) / se
  const df = n - 1
  const p = studentTwoSidedP(t, df)
  // The interval is for the mean, not for the distance from mu0: readers ask
  // where the true mean sits, and the distance from the reference is the
  // statistic that already carries the t value.
  const ci = confidenceInterval(m, se, df, a)
  const ciDiff = confidenceInterval(m - mu0, se, df, a)
  return {
    ok: true,
    kind: 'one-sample',
    n,
    mean: m,
    sd,
    se,
    mu0,
    t,
    df,
    p,
    pAdjusted: p,
    alpha: a,
    significant: p < a,
    ciLow: ci.low,
    ciHigh: ci.high,
    ciDiffLow: ciDiff.low,
    ciDiffHigh: ciDiff.high,
    cohensD: sd === 0 ? NaN : (m - mu0) / sd,
  }
}

/**
 * Welch two sample t test, which does not assume equal variances.
 * @param {number[]} a - the first group.
 * @param {number[]} b - the second group.
 * @param {number} alpha - the significance level, default 0.05.
 * @returns {object} the test result.
 */
export function twoSampleWelch(a, b, alpha) {
  const level = alpha === undefined ? 0.05 : alpha
  const na = a.length
  const nb = b.length
  if (na < 2 || nb < 2) return { ok: false, error: '每组至少需要两个观测' }
  const ma = mean(a)
  const mb = mean(b)
  const va = variance(a)
  const vb = variance(b)
  const se2 = va / na + vb / nb
  const se = Math.sqrt(se2)
  if (!isFinite(se) || se === 0) return { ok: false, error: '两组没有可分辨的差异' }
  const diff = ma - mb
  const t = diff / se
  const df = (se2 * se2) / ((va * va) / (na * na * (na - 1)) + (vb * vb) / (nb * nb * (nb - 1)))
  const p = studentTwoSidedP(t, df)
  const ci = confidenceInterval(diff, se, df, level)
  const pooled = Math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2))
  return {
    ok: true,
    kind: 'two-sample-welch',
    n: na + nb,
    nA: na,
    nB: nb,
    mean: ma,
    meanB: mb,
    sd: Math.sqrt(va),
    sdB: Math.sqrt(vb),
    se,
    diff,
    t,
    df,
    p,
    pAdjusted: p,
    alpha: level,
    significant: p < level,
    ciLow: ci.low,
    ciHigh: ci.high,
    cohensD: pooled === 0 ? NaN : diff / pooled,
  }
}

/**
 * Paired t test on two matched series.
 * The differences are taken as first minus second, the same order as the
 * two sample test, so a positive difference always means the first group is
 * the larger one.
 */
export function pairedT(a, b, alpha) {
  const level = alpha === undefined ? 0.05 : alpha
  if (a.length !== b.length) return { ok: false, error: '两组长度不同' }
  const diffs = []
  for (let i = 0; i < a.length; i++) diffs.push(a[i] - b[i])
  const result = oneSampleT(diffs, 0, level)
  if (!result.ok) return result
  return { ...result, kind: 'paired' }
}

/**
 * Adjust a family of p values.
 * @param {number[]} pvalues - the raw p values.
 * @param {string} method - none, holm or bonferroni.
 * @returns {number[]} the adjusted p values in the same order.
 */
export function adjustPvalues(pvalues, method) {
  const list = (Array.isArray(pvalues) ? pvalues : []).map(Number)
  const n = list.length
  if (!n) return []
  if (method === 'bonferroni') return list.map(p => Math.min(1, p * n))
  if (method !== 'holm') return list.slice()
  const order = list.map((p, index) => ({ p, index })).sort((x, y) => x.p - y.p)
  const out = new Array(n).fill(1)
  let running = 0
  for (let i = 0; i < n; i++) {
    const scaled = (n - i) * order[i].p
    running = Math.max(running, scaled)
    out[order[i].index] = Math.min(1, running)
  }
  return out
}

/** Parse a pasted block of numbers, ignoring anything that is not a number. */
export function parseNumbers(text) {
  const out = []
  const parts = String(text == null ? '' : text).split(/[,;\s]+/)
  for (const part of parts) {
    if (!part) continue
    const value = Number(part)
    if (isFinite(value)) out.push(value)
  }
  return out
}