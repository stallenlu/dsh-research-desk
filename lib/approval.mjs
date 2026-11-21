// 高风险确认闸门的纯函数判定（接口契约 §5 / 重构方案 §6）。
// 本模块不碰 store、不 spawn、不确认；只回答「这一步现在能不能往下走」。
export const HIGH_RISK_KINDS = ['install', 'workspace', 'outbound']

export const RISK_LABELS = {
  install: '安装依赖包（会联网）',
  workspace: '改动工作区',
  outbound: '对外发包（会把数据送出去）',
}

export function isHighRisk(kind) {
  return HIGH_RISK_KINDS.includes(String(kind || ''))
}

// 把风险种类写进 decision.point，避免新增未被 desk 白名单接受的字段。
export function riskPoint(kind, text) {
  const label = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300)
  return 'risk:' + String(kind || '') + ':' + label
}

function matchesRisk(point, kind) {
  return typeof point === 'string' && point.indexOf('risk:' + String(kind) + ':') === 0
}

/**
 * canProceed(collab, riskKind) -> { ok, reason }
 * 高风险三类必须有同一点位、已拍板（pending=false）、choice=approve、by=human 的记录。
 * 其余动作不属于本闸门的强制范围，直接放行。
 */
export function canProceed(collab, riskKind) {
  const kind = String(riskKind || '')
  if (!isHighRisk(kind)) return { ok: true, reason: '非高风险动作，不在强制确认范围内' }
  if (!collab || !Array.isArray(collab.decisions)) return { ok: false, reason: '没有合作记录，无法确认' }
  const approved = collab.decisions.some(d =>
    d && d.pending === false && String(d.choice) === 'approve' && String(d.by) === 'human' && matchesRisk(d.point, kind))
  if (approved) return { ok: true, reason: '已有人工 approve 记录' }
  const pending = collab.decisions.some(d => d && d.pending === true && matchesRisk(d.point, kind))
  return { ok: false, reason: pending ? '对应决策仍在等待人工拍板（waiting-human）' : '尚无对应的人工 approve 记录' }
}

/** 依次检查多个风险，返回第一个拦住流程的种类；都不拦则返回 null。 */
export function blockingRisk(collab, kinds) {
  for (const kind of (Array.isArray(kinds) ? kinds : [])) {
    if (!canProceed(collab, kind).ok) return kind
  }
  return null
}

// 选档真正生效（关2决策冻结）：用户已显式确认 desired 时允许升档，sandbox 只按该档放行。
// 升档不免除人工审批：HIGH_RISK_KINDS 与 canProceed 三类硬闸逐字保留，装包/发包/改工作区仍须决策区拍板；
// 完全权限的 approval=never 按 DSH 语义是一律拒绝审批请求，不是免审批。
export function choosePermission(current, desired) {
  const ORDER = ['read-only', 'workspace-write', 'danger-full-access']
  const c = Math.max(0, ORDER.indexOf(current))
  const d = ORDER.indexOf(desired)
  return { applied: d >= 0 ? desired : ORDER[c], upgraded: d > c }
}
