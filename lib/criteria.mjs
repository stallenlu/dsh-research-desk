// 判据引擎：把「抽取 → 判定」拆成两段，固定算子表驱动，全程不使用动态执行。
// 零运行时依赖：唯一外部符号来自 Node 内置模块 node:perf_hooks。

import { performance } from 'node:perf_hooks'

/**
 * 文本截断上限。
 * 来源：lib/runner.mjs:19 的 MAX_OUTPUT_CHARS = 20000（该常量未导出；
 * 为遵守「只写两个文件」的约束，在此本地定义并注明出处）。
 */
export const MAX_OUTPUT_CHARS = 20000

// 单条正则抽取允许的最大毫秒数，超时即视为不可用（invalid-regex）。
const EXTRACT_TIMEOUT_MS = 50
// 正则源码编译后的长度上限。
const MAX_REGEX_LENGTH = 200
// 单条正则允许的捕获组上限。
const MAX_CAPTURE_GROUPS = 4
// 抽取诊断信息挂在非枚举属性上，不干扰 judge 读取指标。
const ISSUES_KEY = '__issues'

// 收敛类算子：只对 mode=all 得到的数组有效，标量一律 invalid-shape。
const CONVERGENCE_OPS = new Set(['converged', 'monotonic', 'stable'])

/** 有限数守卫：只有有限数字才进入数值比较。 */
function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x)
}

/** 正整数配置读取：非法值回落到默认值。 */
function positiveInt(value, fallback) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** 非负配置读取：非法值回落到默认值。 */
function nonNegative(value, fallback) {
  const n = Number(value)
  return isFiniteNumber(n) && n >= 0 ? n : fallback
}

/** 类型转换器：num/float/int/str/bool，未识别类型原样返回。 */
function convert(value, type) {
  switch (type) {
    case 'num':
    case 'float': {
      const n = Number(value)
      return isFiniteNumber(n) ? n : null
    }
    case 'int': {
      const n = Number.parseInt(String(value), 10)
      return isFiniteNumber(n) ? n : null
    }
    case 'str':
      return String(value)
    case 'bool': {
      const s = String(value).trim().toLowerCase()
      if (['true', '1', 'yes', 'y', 'on', '是', '真'].includes(s)) return true
      if (['false', '0', 'no', 'n', 'off', '否', '假'].includes(s)) return false
      return Boolean(value)
    }
    default:
      return value
  }
}

/** 统计捕获组数量：追加一个空分支，匹配结果的项数减一即捕获组数。 */
function countCaptureGroups(pattern) {
  try {
    const re = new RegExp(pattern + '|')
    const match = re.exec('')
    return match ? match.length - 1 : 0
  } catch {
    return 0
  }
}

/**
 * 静态识别嵌套量词，例如 (a+)+ 、(a{2,})* 、(?:ab){2,3}+ 。
 * 思路：每个组记录内部是否出现过量词；出组时若组内有量词且组后紧跟量词，即命中。
 */
function hasNestedQuantifier(pattern) {
  const stack = []
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]
    if (ch === '\\') { i += 1; continue }
    if (ch === '[') {
      let j = i + 1
      if (pattern[j] === '^') j += 1
      if (pattern[j] === ']') j += 1
      while (j < pattern.length && pattern[j] !== ']') {
        if (pattern[j] === '\\') j += 1
        j += 1
      }
      i = j
      continue
    }
    if (ch === '(') {
      let j = i + 1
      if (pattern[j] === '?') {
        const c = pattern[j + 1]
        if (c === ':' || c === '=' || c === '!') j += 2
        else if (c === '<') {
          if (pattern[j + 2] === '=' || pattern[j + 2] === '!') j += 3
          else {
            while (j < pattern.length && pattern[j] !== '>') j += 1
            if (pattern[j] === '>') j += 1
          }
        }
      }
      i = j - 1
      stack.push({ innerQuant: false })
      continue
    }
    if (ch === ')') {
      const frame = stack.pop()
      if (!frame) continue
      const parent = stack[stack.length - 1]
      if (frame.innerQuant && parent) parent.innerQuant = true
      const next = pattern[i + 1]
      if (frame.innerQuant && (next === '+' || next === '*' || next === '?' || next === '{')) return true
      continue
    }
    if (ch === '+' || ch === '*' || ch === '?') {
      if (stack.length) stack[stack.length - 1].innerQuant = true
      continue
    }
    if (ch === '{' && /^\{\d+(,\d*)?\}/.test(pattern.slice(i))) {
      if (stack.length) stack[stack.length - 1].innerQuant = true
    }
  }
  return false
}

/**
 * 正则静态检查：编译通过、长度不超过 200、无嵌套量词、捕获组不超过 4。
 * 失败时 reason 恒为 'invalid-regex'，具体规则放在 detail 便于排查。
 * @returns {{ok: boolean, reason: string|null, detail?: string}}
 */
export function lintRegex(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) {
    return { ok: false, reason: 'invalid-regex', detail: 'empty-pattern' }
  }
  let re
  try {
    re = new RegExp(pattern)
  } catch {
    return { ok: false, reason: 'invalid-regex', detail: 'compile-error' }
  }
  if (re.source.length > MAX_REGEX_LENGTH) {
    return { ok: false, reason: 'invalid-regex', detail: 'too-long' }
  }
  if (countCaptureGroups(pattern) > MAX_CAPTURE_GROUPS) {
    return { ok: false, reason: 'invalid-regex', detail: 'too-many-groups' }
  }
  if (hasNestedQuantifier(pattern)) {
    return { ok: false, reason: 'invalid-regex', detail: 'nested-quantifier' }
  }
  return { ok: true, reason: null }
}

/**
 * 按抽取器列表从文本提取指标。
 * 中文示例：extract('收益 3.5% 收益 4.1%',
 *   [{ name: 'ret', regex: '收益\\s*([\\d.]+)', type: 'float' }]) → { ret: 4.1 }
 * 返回普通对象（name → 值）；诊断信息放在非枚举的 __issues 上。
 */
export function extract(text, extractors) {
  const src = String(text == null ? '' : text).slice(0, MAX_OUTPUT_CHARS)
  const result = {}
  const issues = []
  for (const ex of Array.isArray(extractors) ? extractors : []) {
    const name = ex && ex.name
    if (!name) continue
    const lint = lintRegex(ex.regex)
    if (!lint.ok) {
      issues.push({ name, reason: lint.reason, detail: lint.detail })
      result[name] = null
      continue
    }
    let re
    try {
      re = new RegExp(ex.regex, 'g')
    } catch {
      issues.push({ name, reason: 'invalid-regex', detail: 'compile-error' })
      result[name] = null
      continue
    }
    const group = Number.isInteger(ex.group) && ex.group >= 0 ? ex.group : 1
    const started = performance.now()
    const values = []
    try {
      for (const match of src.matchAll(re)) {
        const raw = match[group]
        if (raw === undefined) continue
        values.push(convert(raw, ex.type))
      }
    } catch {
      issues.push({ name, reason: 'invalid-regex', detail: 'match-error' })
      result[name] = null
      continue
    }
    if (performance.now() - started > EXTRACT_TIMEOUT_MS) {
      issues.push({ name, reason: 'invalid-regex', detail: 'timeout' })
      result[name] = null
      continue
    }
    result[name] = ex.mode === 'all'
      ? values
      : (values.length ? values[values.length - 1] : null)
  }
  Object.defineProperty(result, ISSUES_KEY, { value: issues, enumerable: false })
  return result
}

// 固定算子表：键即 criterion.op，绝不接受外部传入的可执行表达式。
export const OPS = Object.freeze({
  eq: (v, t) => isFiniteNumber(v) && isFiniteNumber(t) && v === t,
  neq: (v, t) => isFiniteNumber(v) && isFiniteNumber(t) && v !== t,
  gt: (v, t) => isFiniteNumber(v) && isFiniteNumber(t) && v > t,
  gte: (v, t) => isFiniteNumber(v) && isFiniteNumber(t) && v >= t,
  lt: (v, t) => isFiniteNumber(v) && isFiniteNumber(t) && v < t,
  lte: (v, t) => isFiniteNumber(v) && isFiniteNumber(t) && v <= t,
  in: (v, t) => {
    if (v == null || t == null) return false
    const list = Array.isArray(t) ? t : String(t).split(',')
    return list.some((item) => {
      if (isFiniteNumber(v) && isFiniteNumber(item)) return v === item
      return String(item).trim() === String(v).trim()
    })
  },
  // 滑窗 + 容差 + 连续 N 个窗口满足：window=3 / tolerance=1e-3 / consecutive=2。
  converged: (v, _t, cfg = {}) => {
    if (!Array.isArray(v) || !v.every(isFiniteNumber)) return false
    const w = positiveInt(cfg.window, 3)
    const tol = nonNegative(cfg.tolerance, 1e-3)
    const need = positiveInt(cfg.consecutive, 2)
    if (v.length < w + need - 1) return false
    let streak = 0
    for (let i = 0; i + w <= v.length; i += 1) {
      const slice = v.slice(i, i + w)
      if (Math.max(...slice) - Math.min(...slice) <= tol) {
        streak += 1
        if (streak >= need) return true
      } else {
        streak = 0
      }
    }
    return false
  },
  // 单调性：direction=up|down，tolerance 允许微小回撤，strict=true 要求严格单调。
  monotonic: (v, _t, cfg = {}) => {
    if (!Array.isArray(v) || v.length < 2 || !v.every(isFiniteNumber)) return false
    const dir = cfg.direction === 'down' ? -1 : 1
    const tol = nonNegative(cfg.tolerance, 0)
    for (let i = 1; i < v.length; i += 1) {
      const delta = (v[i] - v[i - 1]) * dir
      if (cfg.strict ? delta <= tol : delta < -tol) return false
    }
    return true
  },
  // 稳定性：全序列极差不超过容差（默认 1e-3）。
  stable: (v, _t, cfg = {}) => {
    if (!Array.isArray(v) || v.length < 2 || !v.every(isFiniteNumber)) return false
    const tol = nonNegative(cfg.tolerance, 1e-3)
    return Math.max(...v) - Math.min(...v) <= tol
  },
})

/**
 * 按判据列表判定指标。
 * 返回 { passed, results }；passed 仅由 required 项决定。
 * 中文示例：judge({ score: 0.9 }, [{ id: 'a', metric: 'score', op: 'gte', threshold: 0.8, required: true }])
 *   → { passed: true, results: [{ id: 'a', verdict: 'pass', ok: true }] }
 */
export function judge(metrics, criteria) {
  const m = metrics && typeof metrics === 'object' ? metrics : {}
  const results = []
  let passed = true
  for (const c of Array.isArray(criteria) ? criteria : []) {
    if (!c || typeof c !== 'object') continue
    const v = m[c.metric]
    let verdict
    let ok
    if (v == null) {
      verdict = 'missing'
      ok = false
    } else if (typeof OPS[c.op] !== 'function') {
      verdict = 'invalid-op'
      ok = false
    } else if (CONVERGENCE_OPS.has(c.op) && !Array.isArray(v)) {
      verdict = 'invalid-shape'
      ok = false
    } else {
      const cfg = CONVERGENCE_OPS.has(c.op) ? (c.convergence || {}) : undefined
      ok = OPS[c.op](v, c.threshold, cfg) === true
      verdict = ok ? 'pass' : 'fail'
    }
    results.push({ id: c.id, verdict, ok })
    if (c.required && !ok) passed = false
  }
  return { passed, results }
}
