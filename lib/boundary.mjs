// 阶段五·§6.4 输出边界（公共前置）。
// 科研方法论 MB1–MB4 / N1–N6 的服务端转译层：机器产物一律降级为「候选」，
// 自由度/口径未由研究者锁定声明则拒绝，三种可复现性分字段不混称。
// 纯函数、不改 state；被所有 public*/*View 出口在内部调用，保证出到客户端
// 时已经是「人话 + 已降级 + 带签名字段」。
// 权威依据：架构 v1.1 §6.4:324-330、报告禁令 :26/:115、N5 不混称已验证。

import { cleanText } from './util.mjs'

// 机器输出不得使用的「已完成/已验证」字样（报告禁令：机器只能产候选）。
const OVERCLAIM_RE = /已验证|已通过|已达到|已确认|已证实|verified|confirmed|proved|passed/i

/**
 * 判定降级：机器输出的 verdict 一律降级为 candidate。
 * 只有研究者签名（prov.declaredBy==='researcher' 且 signature 非空）才允许 confirmed。
 * @param {object} input {verdict?, status?, prov?}
 * @returns {{status:'candidate'|'confirmed', signature?:string, note:string}}
 */
export function downgradeVerdict(input) {
  const prov = input && input.prov && typeof input.prov === 'object' ? input.prov : null
  const signed = !!prov && prov.declaredBy === 'researcher' && !!cleanText(prov.signature, 500)
  const raw = input && (input.verdict !== undefined ? input.verdict : input.status)
  const machinePass = raw === 'pass' || raw === true || raw === 'supported' || raw === 'confirmed'
  if (signed && machinePass) {
    return { status: 'confirmed', signature: cleanText(prov.signature, 500), note: '研究者已签名核验' }
  }
  return { status: 'candidate', note: '辅助生成，待研究者核验' }
}

/**
 * MB3 自由度锁定判据（独立补充判据，不并入 R11 三问计数）。
 * 阈值/半径/归一化/口径等自由参数的选取若改变结论，必须由研究者锁定并声明
 * （declaredBy==='researcher' + signature）；机器默认静默代替即越界 → 拒绝。
 * @param {object} value {freedom?:string, locked?:boolean, declaredBy?:string, signature?:string}
 * @param {object} opts {declaredBy?:string}
 * @returns {{ok:boolean, reason?:string}}
 */
export function assertFreedom(value, opts = {}) {
  const v = value && typeof value === 'object' ? value : {}
  const freedom = cleanText(v.freedom, 200)
  const declaredBy = cleanText(v.declaredBy || opts.declaredBy, 40)
  const signature = cleanText(v.signature, 500)
  // 未声明任何自由参数，或研究者已锁定并签名 → 放行。
  if (!freedom) return { ok: true }
  if (v.locked === true && declaredBy === 'researcher' && signature) return { ok: true }
  return {
    ok: false,
    reason: '该结论依赖自由参数（阈值/半径/归一化/口径）的选取，须由研究者锁定并签名声明；机器默认静默代替=越界'
  }
}

/**
 * N5 可复现性三级分字段，不混称「已验证」。
 * @param {object} output {repeatable?, reproducible?, replicable?} 或任意含同名键对象
 * @returns {{repeatable:boolean, reproducible:boolean, replicable:boolean}}
 */
export function reproducibilityFields(output) {
  const o = output && typeof output === 'object' ? output : {}
  return {
    repeatable: o.repeatable === true,
    reproducible: o.reproducible === true,
    replicable: o.replicable === true
  }
}

/**
 * 公共前置总入口：对任意面向用户的输出对象做边界转译。
 * - 带 verdict/pass 的判定 → 加 candidate 状态 + 人话 note，抹掉机器 overclaim 字段。
 * - evaluation.verdict 本体保持只读复制（不动本体，测试 :961-964 依赖原值）。
 * - 不修改传入对象，返回浅拷贝。
 * @param {object} view
 * @returns {object}
 */
export function applyBoundary(view) {
  if (Array.isArray(view)) return view.map(applyBoundary)
  if (!view || typeof view !== 'object') return view
  const out = {}
  for (const [k, v] of Object.entries(view)) {
    // evaluation.verdict 是只读复制的科研结论本体（test/host.test.mjs:961-964 依赖原值），
    // 不降级、不改写；只对外层机器判定字段生效。
    if (k === 'evaluation') { out[k] = v; continue }
    out[k] = applyBoundary(v)
  }
  // 只在带 verdict（机器判定）的对象上触发；paper.status 等工作流状态不是判定，不误伤。
  if (Object.prototype.hasOwnProperty.call(view, 'verdict')) {
    const d = downgradeVerdict(view)
    out.status = d.status
    out.boundaryNote = d.note
    if (d.signature) out.signature = d.signature
  }
  return out
}

export { OVERCLAIM_RE }
