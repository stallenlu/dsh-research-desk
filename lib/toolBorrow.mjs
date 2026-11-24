// dsh-research-desk — 生态能力借用的通用管道（第一方纯函数层）。
//
// 只承载三处借用能力（配图 draftImageTool / 论文下载 scihubTool / 抓全文 webFetchTool）
// 逐字同构的固定骨架：取工具集 → 三件套探测 → selectExecutor → 按名取定义 →
// 调调用方注入的验真 → 适配返回形态；以及拼 id → execute → 按 callId 回流。
//
// 职责边界（红线，勿越）：
//   - 不读被借工具自报的安全注解（readOnlyHint/destructiveHint 等），验真策略由调用方
//     以第一方纯函数注入，安全放行仍落 lib/approval.mjs 的真人拍板。
//   - 不做模型自选工具，不写 state，不碰三道闸门（ensureRiskApproval/collabStep/
//     collabDecisionAnswer），不决定失败文案，不做结果提纯。
//   - 失败透明（2026-11-23 根因修复）：严格区分"正常降级"与"真故障"——
//       * 唯一合法降级（返回 null → UNAVAILABLE）：候选工具确实一个都没注册
//         （executable 对所有候选返回 undefined/null）。这是"这版没有这个能力"。
//       * 必须原样外抛（带真实原因，可查）：selectExecutor / executable / verify（含其
//         内部 describe）任一环节抛异常；以及"工具有注册、但验真全没通过"。原来的空
//         catch 把这些统统吞成 UNAVAILABLE，正是用户说的"装了工具却用不了还被搪塞"
//         的机制根源。异常原样抛出保留 message/堆栈，不静默、不打印凭据。

/**
 * 工具发现 + 探测 + 按名取定义 + 注入验真 + 适配返回形态。
 *
 * @param ctx 宿主上下文，内部仅用 ctx.get('tools')
 * @param opts.names 科灵第一方候选工具名数组（白名单，由调用方给定）
 * @param opts.verify(def, executor, name) 第一方纯函数验真，严格返回 true 表示此名可用；
 *        返回非 true = 此候选策略拒绝（继续下一个）；抛异常 = 真故障（原样外抛）
 * @param opts.pack({ tools, name, def }) 返回形态适配，由调用方决定最终返回值
 * @returns 调用方 pack 的返回值；所有候选确实没注册 → null；
 *          有注册但全被验真拒绝 → 抛"验真未通过"；任一环节抛异常 → 原样外抛
 */
export function borrowTool(ctx, opts) {
  const options = opts && typeof opts === 'object' ? opts : {}
  const tools = ctx && typeof ctx.get === 'function' ? ctx.get('tools') : null
  if (typeof tools?.executable !== 'function' || typeof tools?.execute !== 'function' || typeof tools?.selectExecutor !== 'function') return null
  const names = Array.isArray(options.names) ? options.names : []
  if (typeof options.verify !== 'function' || typeof options.pack !== 'function') return null

  // 选执行器抛错是真故障，原样外抛（保留 message/堆栈），不再吞成 UNAVAILABLE。
  const executor = tools.selectExecutor()
  if (typeof executor?.describe !== 'function') throw new Error('借用工具失败：执行器缺少 describe 能力')

  let rejectedButRegistered = false
  for (const name of names) {
    // 查找抛错原样外抛；返回 undefined/null 才是"这个候选没注册"，继续试下一个。
    const def = tools.executable(name)
    if (def === undefined || def === null) continue
    // 验真抛错（含 describe 抛错）原样外抛；返回非 true 是策略拒绝，继续下一个候选。
    const ok = options.verify(def, executor, name)
    if (ok === true) return options.pack({ tools, name, def })
    rejectedButRegistered = true
  }
  // 有注册却全被验真拒绝 = "装了工具却用不了"，必须可查，绝不静默成 UNAVAILABLE。
  if (rejectedButRegistered) throw new Error('借用工具失败：候选工具已注册但验真未通过（' + names.join('/') + '）')
  // 所有候选确实没注册 → 唯一合法降级。
  return null
}

/**
 * 调用工具并按 callId 回流原始 result。id 形态与三处现状逐字一致：
 * '<idPrefix>:' + Date.now() + '-' + Math.random().toString(36).slice(2)。
 * 只返回原始 result，提纯/错误分类/人话翻译文案全部留各 service。
 *
 * execute 失败本就向外抛出真实错误（此处无 try/catch 吞错），service 层各自转成 ok:false 文案。
 *
 * @param tools 已验真的执行器集（borrowTool 返回值里的 tools）
 * @param opts.name 工具名
 * @param opts.args 调用参数对象（内部 JSON.stringify）
 * @param opts.idPrefix 幂等键前缀（draft-image / scihub-download / web-fetch / verify-origin）
 * @param opts.signal 中止信号
 * @returns 原始 result；无回流结果返回 undefined
 */
export async function invokeTool(tools, opts) {
  const options = opts && typeof opts === 'object' ? opts : {}
  const id = String(options.idPrefix || 'tool') + ':' + Date.now() + '-' + Math.random().toString(36).slice(2)
  const batch = await tools.execute({ calls: [{ type: 'tool-call', id, name: options.name, arguments: JSON.stringify(options.args) }], signal: options.signal })
  return batch && Array.isArray(batch.results) ? batch.results.find(e => e && e.callId === id)?.result : undefined
}
