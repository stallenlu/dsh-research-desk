// toolBorrow.test.mjs — 生态能力借用公共管道（lib/toolBorrow.mjs）的真行为单测。
//
// 纪律：
//   1. 只 import 纯函数 borrowTool / invokeTool，不 import host.mjs / search.mjs，
//      避免它们的 global fetch 替换、DSH_HOME 写在文件加载期污染本文件。
//   2. 【2026-11-23 二次订正 · 据 KeLinTai 根因调查】旧版 makeTools 是无脑 fake
//      （永远返回工具、describe 恒给空 schemas、无 scope/executor 语义），11 条全绿是
//      "假绿"——真实宿主 ToolsService 是 scope-aware、executor 分 native/PTC。
//      本版 makeScopeTools 复刻真实语义：executable(name,scope) 无 scope 只查 global 层、
//      native describe 带 name 无 reject / PTC describe 只给 run_code 且具名调用被 reject。
//      核心断言：只有"executable 真返回 undefined（没注册）"才能静默 null→UNAVAILABLE；
//      selectExecutor 抛 / describe 抛 / executable 抛 / execute 抛 / 注册了却验真不过
//      一律抛带真实原因的 Error，不装死。
//   3. 全部纯内存 mock，不联网、不碰真机、不写真实 state。

import test from 'node:test'
import assert from 'node:assert/strict'
import { borrowTool, invokeTool } from '../lib/toolBorrow.mjs'

// ── 复刻三处真实 verify 契约（不 import host.mjs，避免加载期副作用）──────────

const scihubVerify = name => (def, executor) => {
  if (!def) return false
  const props = def?.parameters?.properties
  if (name === 'scihub_pdf' && (props?.doi?.type !== 'string' || props?.url?.type !== 'string')) return false
  if (name === 'scihub_batch' && props?.dois?.type !== 'array') return false
  executor.describe([def])?.schemas?.some(s => s.name === name) // describe 抛错会外抛
  return true
}

const PDF_DEF = { name: 'scihub_pdf', parameters: { properties: { doi: { type: 'string' }, url: { type: 'string' } } }, output: { schema: { properties: {} } } }

/**
 * 真实语义 fake：模拟 ToolsService（scope-aware）+ native/PTC executor。
 * registered = global 层可见工具；executable 返回 undefined 表示没注册。
 */
function makeScopeTools({ mode = 'native', registered = {}, describeThrow, execThrow } = {}) {
  const calls = { executable: [], describe: [], execute: [], selectExecutor: [] }
  const ptc = mode === 'ptc'
  const executor = {
    kind: mode,
    describe: defs => {
      calls.describe.push(defs)
      if (describeThrow) throw describeThrow
      if (ptc) return { schemas: [{ name: 'run_code' }] } // PTC 只暴露 run_code（据后端 asar 实证 @119298118）
      return { schemas: defs.filter(Boolean).map(d => ({ name: d.name, parameters: d.parameters })) }
    },
  }
  const tools = {
    executable: (name, scope) => { calls.executable.push({ name, scope }); return registered[name] },
    selectExecutor: scope => { calls.selectExecutor.push(scope); return executor },
    execute: async payload => {
      calls.execute.push(payload)
      if (execThrow) throw execThrow
      if (ptc) {
        const n = payload?.calls?.[0]?.name
        throw Object.assign(new Error('only run_code is callable directly (got ' + n + ')'), { code: 'ToolNotFoundError' })
      }
      return { results: payload.calls.map(c => ({ callId: c.id, result: { ok: true, value: { title: 'ok' } } })) }
    },
  }
  return { tools, calls, executor }
}
const ctxOf = tools => ({ get: n => (n === 'tools' ? tools : undefined) })

// ── borrowTool：唯一合法降级 = 真没注册（executable 返回 undefined）──────────

test('borrowTool：executable 对所有 name 返回 undefined（真没注册）→ null 静默降级（唯一合法 UNAVAILABLE）', () => {
  const { tools, calls } = makeScopeTools({ registered: {} })
  const r = borrowTool(ctxOf(tools), { names: ['scihub_pdf', 'scihub_batch'], verify: scihubVerify('scihub_pdf'), pack: ({ name }) => name })
  assert.equal(r, null)
  assert.deepEqual(calls.executable.map(c => c.name), ['scihub_pdf', 'scihub_batch'], '应逐个探测完所有候选才降级')
})

test('borrowTool：selectExecutor 抛错 → 外抛带真实原因，不再静默 null、不打印', () => {
  const boom = new Error('ToolExecutorUnavailableError: root executor missing')
  const { tools } = makeScopeTools({})
  tools.selectExecutor = () => { throw boom }
  const printed = []
  const orig = [console.log, console.error, console.warn]
  console.log = console.error = console.warn = (...a) => printed.push(a.join(' '))
  try {
    assert.throws(
      () => borrowTool(ctxOf(tools), { names: ['scihub_pdf'], verify: scihubVerify('scihub_pdf'), pack: () => 1 }),
      /root executor missing/,
      '必须外抛真实原因，不得吞成 null 装死'
    )
  } finally {
    ;[console.log, console.error, console.warn] = orig
  }
  assert.equal(printed.length, 0, '不得打印任何内容（含凭据）')
})

test('borrowTool：executable 抛错 → 外抛带真实原因（原 message 被保留）', () => {
  const boom = new Error('executable view() failed')
  const { tools } = makeScopeTools({})
  tools.executable = () => { throw boom }
  assert.throws(
    () => borrowTool(ctxOf(tools), { names: ['scihub_pdf'], verify: () => true, pack: () => 1 }),
    /executable view\(\) failed/,
    '查找环节抛错必须外抛，原 message 保留供排查'
  )
})

test('borrowTool：verify 内部 describe 抛错 → 外抛带真实原因（原空 catch 吞掉是缺陷）', () => {
  const boom = new Error('describe() boom with real cause')
  const { tools } = makeScopeTools({ registered: { scihub_pdf: PDF_DEF }, describeThrow: boom })
  assert.throws(
    () => borrowTool(ctxOf(tools), { names: ['scihub_pdf'], verify: scihubVerify('scihub_pdf'), pack: () => 1 }),
    /describe\(\) boom with real cause/,
    '验真环节抛错必须外抛，不可静默 UNAVAILABLE'
  )
})

test('borrowTool：executor 无 describe → 抛错（不可静默 null 让 service 误报未找到工具）', () => {
  const { tools } = makeScopeTools({})
  tools.selectExecutor = () => ({ kind: 'broken' })
  assert.throws(
    () => borrowTool(ctxOf(tools), { names: ['scihub_pdf'], verify: () => true, pack: () => 1 }),
    /describe/i
  )
})

test('borrowTool：候选工具已注册但验真未过 → 抛错（用户抱怨的"装了用不了"必须可查）', () => {
  const { tools } = makeScopeTools({ registered: { scihub_pdf: { name: 'scihub_pdf' } } })
  assert.throws(
    () => borrowTool(ctxOf(tools), { names: ['scihub_pdf'], verify: () => false, pack: () => 1 }),
    /验真未通过/,
    '注册了但验真失败必须抛错，不得降级成 UNAVAILABLE'
  )
})

// ── borrowTool：native / PTC 两执行器语义（替换假绿的核心）───────────────────

test('native 执行器：具名工具已注册 + describe 带 name → 借用成功（可用路径对外行为保持）', () => {
  const { tools, calls } = makeScopeTools({ mode: 'native', registered: { scihub_pdf: PDF_DEF } })
  const r = borrowTool(ctxOf(tools), {
    names: ['scihub_pdf'], verify: scihubVerify('scihub_pdf'), pack: ({ tools, name }) => ({ tools, name }),
  })
  assert.equal(r?.name, 'scihub_pdf', 'native 下应借到具名工具')
  assert.ok(calls.describe.length > 0, 'verify 应真的调用 describe 做列名核验')
})

test('borrowTool 正向：按 names 顺序探测，验真通过即 pack 原样透传', () => {
  const defA = { name: 'toolA' }
  const defB = { name: 'toolB' }
  const { tools, calls } = makeScopeTools({ registered: { toolA: defA, toolB: defB } })
  let packed = null
  const result = borrowTool(ctxOf(tools), {
    names: ['toolA', 'toolB'],
    verify: (def, executor, name) => def === defB && name === 'toolB',
    pack: p => { packed = p; return { ok: p.name } },
  })
  assert.deepEqual(result, { ok: 'toolB' })
  assert.deepEqual(calls.executable.map(c => c.name), ['toolA', 'toolB'], '必须按名字白名单顺序逐个探测')
  assert.equal(packed.def, defB)
  assert.equal(packed.tools, tools)
  assert.equal(packed.name, 'toolB')
})

test('borrowTool 验真必须严格返回 true，truthy 值（字符串/数字）不算通过（注册了→须抛错）', () => {
  const { tools } = makeScopeTools({ registered: { t: { name: 't' } } })
  const ctx = ctxOf(tools)
  assert.throws(() => borrowTool(ctx, { names: ['t'], verify: () => 'yes', pack: () => 'packed' }), /验真未通过/)
  assert.throws(() => borrowTool(ctx, { names: ['t'], verify: () => 1, pack: () => 'packed' }), /验真未通过/)
  assert.equal(borrowTool(ctx, { names: ['t'], verify: () => true, pack: () => 'packed' }), 'packed')
})

test('borrowTool：executable/execute/selectExecutor 三件套缺任一返回 null', () => {
  const full = makeScopeTools().tools
  for (const key of ['executable', 'execute', 'selectExecutor']) {
    const broken = { ...full, [key]: undefined }
    assert.equal(borrowTool(ctxOf(broken), { names: ['x'], verify: () => true, pack: () => 1 }), null, key + ' 缺失须返回 null')
  }
})

test('borrowTool：放行/拒绝完全由注入 verify 决定，不读被借工具自报安全注解', () => {
  const dangerous = { name: 'danger', destructiveHint: true, readOnlyHint: false }
  const safe = { name: 'safe', destructiveHint: false, readOnlyHint: true }
  const { tools } = makeScopeTools({ registered: { danger: dangerous, safe } })
  const ctx = ctxOf(tools)
  assert.equal(borrowTool(ctx, { names: ['danger'], verify: () => true, pack: () => 'allow' }), 'allow')
  assert.throws(() => borrowTool(ctx, { names: ['safe'], verify: () => false, pack: () => 'allow' }), /验真未通过/)
})

test('borrowTool：只访问 ctx.get("tools")，不碰三道闸门', () => {
  const { tools } = makeScopeTools({ registered: { x: {} } })
  const accessed = []
  const ctx = { get: name => { accessed.push(name); return name === 'tools' ? tools : undefined } }
  borrowTool(ctx, { names: ['x'], verify: () => true, pack: () => 1 })
  assert.deepEqual(accessed, ['tools'], '不得访问 ensureRiskApproval/collabStep/collabDecisionAnswer 等任何其它上下文')
})

test('borrowTool：防御性输入（非对象 opts / 非数组 names / 非函数 verify,pack / 无 get）一律返回 null 不抛', () => {
  const { tools } = makeScopeTools({ registered: { x: {} } })
  const ctx = ctxOf(tools)
  assert.equal(borrowTool(ctx, null), null)
  assert.equal(borrowTool(ctx, { names: 'x', verify: () => true, pack: () => 1 }), null)
  assert.equal(borrowTool(ctx, { names: ['x'], verify: 'yes', pack: () => 1 }), null)
  assert.equal(borrowTool(ctx, { names: ['x'], verify: () => true, pack: 'no' }), null)
  assert.equal(borrowTool({}, { names: ['x'], verify: () => true, pack: () => 1 }), null)
})

// ── invokeTool ────────────────────────────────────────────────────────────────

test('invokeTool：payload 形态正确，signal 顶层透传，按 callId 精确回流 result', async () => {
  const signal = { aborted: false }
  let captured
  const tools = {
    execute: async payload => {
      captured = payload
      const call = payload.calls[0]
      return { results: [
        { callId: 'WRONG_ID', result: '错误 id 的结果应被忽略' },
        { callId: call.id, result: '正确结果' },
      ] }
    },
  }
  const result = await invokeTool(tools, { name: 'web_fetch', args: { url: 'https://x' }, idPrefix: 'web-fetch', signal })
  assert.equal(result, '正确结果', '必须按本次生成的 callId 精确匹配，不能被其它结果串味')
  assert.equal(captured.calls.length, 1)
  const call = captured.calls[0]
  assert.equal(call.type, 'tool-call')
  assert.equal(call.name, 'web_fetch')
  assert.deepEqual(JSON.parse(call.arguments), { url: 'https://x' }, 'args 必须 JSON.stringify')
  assert.equal(call.signal, undefined, 'signal 应在 payload 顶层而非 call 内')
  assert.equal(captured.signal, signal, 'signal 原样透传')
})

test('invokeTool：id 前缀形态与三处现状一致（默认前缀 tool）', async () => {
  let captured
  const tools = { execute: async p => { captured = p; return { results: [] } } }
  await invokeTool(tools, { name: 'x', args: {}, idPrefix: 'scihub-download' })
  assert.match(captured.calls[0].id, /^scihub-download:\d+-/, '须含idPrefix+时间戳段')
  await invokeTool(tools, { name: 'x', args: {} })
  assert.match(captured.calls[0].id, /^tool:\d+-/, '无 idPrefix 时默认 tool')
})

test('invokeTool：无匹配 callId / batch 无 results / results 非数组一律返回 undefined', async () => {
  assert.equal(await invokeTool({ execute: async () => ({ results: [{ callId: 'OTHER', result: 1 }] }) }, { name: 'x', args: {} }), undefined)
  assert.equal(await invokeTool({ execute: async () => ({}) }, { name: 'x', args: {} }), undefined)
  assert.equal(await invokeTool({ execute: async () => ({ results: 'no' }) }, { name: 'x', args: {} }), undefined)
})

test('PTC 执行器：execute 对具名工具 reject → invokeTool 外抛真实错误，不装死不返回 undefined', async () => {
  const { tools } = makeScopeTools({ mode: 'ptc', registered: { scihub_pdf: PDF_DEF } })
  await assert.rejects(
    invokeTool(tools, { name: 'scihub_pdf', args: { doi: '10.x' }, idPrefix: 'scihub-download' }),
    /only run_code is callable directly|ToolNotFound/i,
    'PTC reject 必须外抛，让 service 报明确错误，而不是静默 UNAVAILABLE'
  )
})

test('invokeTool：execute 普通失败（网络/工具异常）外抛真实原因，不吞', async () => {
  const boom = new Error('scihub mirror timeout with real cause')
  await assert.rejects(
    invokeTool({ execute: async () => { throw boom } }, { name: 'scihub_pdf', args: { doi: '10.x' } }),
    e => e === boom
  )
})
