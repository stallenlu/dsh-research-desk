// provenance-lite：实验数据模型的纯函数层（工程实施方案 v1.3 §3.1）。
// 零运行时依赖：只使用 node 内置模块，绝不引入任何 @deepseek-ai 包。
//
// 中文示例：
//   const s = { runtime: 'node', code: 'print(1)', params: { a: 1 },
//               packages: [], solver: 'v1', toolchain: 'node22' }
//   inputHash(s) // 'sha256:<64 位十六进制>'
import { createHash } from 'node:crypto'

/** 孤儿任务默认超时（毫秒）：10 分钟。 */
export const DEFAULT_TIMEOUT_MS = 600000
/** 额外余量（毫秒）：1 分钟，避免与运行器自身超时抢跑。 */
export const GRACE_MS = 60000

/** 判定是否为「普通对象」：非 null 的 object，且不是数组。 */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 递归稳定序列化：对象按 key 排序，数组保留顺序，其余交给 JSON.stringify。
 * 目的：同一份输入无论属性书写顺序如何，都得到逐字节一致的字符串。
 *
 * 中文示例：
 *   stable({ b: 1, a: 2 }) === '{"a":2,"b":1}'
 *   stable({ x: [2, { q: 1, p: 0 }] }) === '{"x":[2,{"p":0,"q":1}]}'
 */
export function stable(v) {
  if (Array.isArray(v)) {
    return '[' + v.map(stable).join(',') + ']'
  }
  if (isObject(v)) {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

/**
 * 计算运行的输入指纹：只取最小输入集，绝不纳入 id / 时间戳 / stdout。
 * 规则：v 固定为 1，随后 stable 化并做 sha256，结果加 'sha256:' 前缀。
 */
export function inputHash(s) {
  const minimal = {
    v: 1,
    runtime: s.runtime,
    code: s.code,
    params: s.params || {},
    packages: s.packages || [],
    solver: s.solver,
    toolchain: s.toolchain,
  }
  return 'sha256:' + createHash('sha256').update(stable(minimal)).digest('hex')
}

/**
 * 按输入指纹查找可复用的运行：done 表示缓存命中，running 表示复用预留。
 * 这是纯查找：不判断锁、不改状态，调用方自行决定后续动作。
 */
export function findByHash(h, runs) {
  return runs.find(r => r.inputHash === h && (r.status === 'done' || r.status === 'running')) || null
}

/**
 * 沿 parentRunId 单父链回溯。
 * 顺序：起点（id 对应的 run）在前，逐层向上游祖先推进，越靠后越久远。
 * 找不到的 id 返回空数组；遇到断链即停止；visited 防止异常闭环导致死循环。
 */
export function lineage(id, runs) {
  const byId = new Map(runs.map(r => [r.id, r]))
  const chain = []
  const visited = new Set()
  let cur = byId.get(id)
  while (cur && !visited.has(cur.id)) {
    chain.push(cur)
    visited.add(cur.id)
    cur = cur.parentRunId ? byId.get(cur.parentRunId) : undefined
  }
  return chain
}

/**
 * 扫描卡死的 running 记录，返回应当被标成 failed 的 id 数组。
 * 判定：nowIso - startedAt > timeoutMs + 余量（默认 10 分钟 + 1 分钟）。
 * 纯函数：只读 runs，不改入参；startedAt / now 均可为 ISO 字符串或毫秒数。
 */
export function markOrphans(runs, nowIso, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const now = typeof nowIso === 'number' ? nowIso : Date.parse(nowIso)
  const threshold = timeoutMs + GRACE_MS
  const ids = []
  for (const r of runs) {
    if (r.status !== 'running') continue
    const started = typeof r.startedAt === 'number' ? r.startedAt : Date.parse(r.startedAt)
    if (!Number.isFinite(now) || !Number.isFinite(started)) continue
    if (now - started > threshold) ids.push(r.id)
  }
  return ids
}
