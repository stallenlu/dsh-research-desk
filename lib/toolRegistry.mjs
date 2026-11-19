// 工具注册表 v1 —— 能力声明与自省（方案 v1.3 §3.6）。
//
// PERMISSION_BOUNDARY（权限边界，模块顶部声明）：
// read-only / workspace-write / danger-full-access 三档权限只约束 DSH agent
// 会话里的工具调用，完全不约束 runCode / installPackages 起的实验子进程。
// 实验代码真正受 runner.enabled、路径白名单、沙箱 L1-L3 与用户确认闸门约束。
// 本模块是纯声明/自省层：只读 settings 与传入的探测结果，不 spawn、不安装任何东西。
export const PERMISSION_BOUNDARY =
  'PERMISSION_BOUNDARY：read-only / workspace-write / danger-full-access 三档权限' +
  '只约束 DSH agent 会话的工具调用，完全不约束 runCode / installPackages 起的实验子进程；' +
  '实验代码由 runner.enabled、路径白名单、沙箱 L1-L3 与用户确认闸门约束。'

/** 允许的运行时白名单，与 lib/runner.mjs 的 RUNTIMES 保持一致。 */
export const RUNTIMES = ['python', 'node']

/**
 * 包名格式：名字、版本号、extras 只允许字母数字 @ . _ -；
 * extras 用方括号包住，版本用 == 钉住。斜杠、分号、空格、$() 全部落在外头。
 * 与 lib/runner.mjs 中的 PACKAGE_PATTERN 同源（此处内联，保持零运行时依赖）。
 */
const PACKAGE_PATTERN = /^[A-Za-z0-9@._-]+(\[[^\]]+\])?(==[0-9A-Za-z.*-]+)?$/

const str = value => (typeof value === 'string' ? value.trim() : '')

/** 单个包名是否合法（与 runner.validatePackages 的逐项判定一致）。 */
function isValidPackageName(name) {
  const text = str(name)
  if (!text || !PACKAGE_PATTERN.test(text)) return false
  return /[A-Za-z0-9]/.test(text) // 纯点名字能过字符表，但没有这种包
}

/** 解析 runner.packages（逗号分隔字符串或数组），去空、去重、保序。 */
function parsePackages(value) {
  const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : [])
  const out = []
  for (const item of raw) {
    const name = str(item)
    if (!name || out.includes(name)) continue
    out.push(name)
  }
  return out
}

/**
 * 构建工具注册表：把 settings 的声明能力与 runnerCaps 的探测结果拼成一张可读的表。
 *
 * @param {object} [settings] - 当前设置（runner.pythonPath / runner.nodePath /
 *   runner.packages / runner.enabled / runner.allowInstall）。
 * @param {object} [runnerCaps] - probeRuntime 的探测结果，形如
 *   { python: {ok, cmd, version, source}, node: {...} }。
 * @returns {object} 注册表。例：
 *   buildRegistry(
 *     { 'runner.pythonPath': 'C:/py/python.exe', 'runner.packages': 'numpy,scipy',
 *       'runner.enabled': true, 'runner.allowInstall': true },
 *     { python: { ok: true, cmd: 'C:/py/python.exe', version: 'Python 3.11', source: 'settings' },
 *       node: { ok: false } }
 *   ).install.enabled === true
 */
export function buildRegistry(settings = {}, runnerCaps = {}) {
  const s = settings && typeof settings === 'object' ? settings : {}
  const caps = runnerCaps && typeof runnerCaps === 'object' ? runnerCaps : {}
  const runtimes = RUNTIMES.map(name => {
    const configuredPath = str(s['runner.' + name + 'Path'])
    const cap = caps[name] && typeof caps[name] === 'object' ? caps[name] : {}
    const available = cap.ok === true
    return {
      name,
      path: str(cap.cmd) || configuredPath,
      configuredPath,
      available,
      version: str(cap.version),
      source: str(cap.source) || (configuredPath ? 'settings' : 'none'),
    }
  })
  return {
    version: 1,
    runtimes,
    packages: parsePackages(s['runner.packages']),
    install: Object.freeze({
      enabled: s['runner.allowInstall'] === true,
      managers: Object.freeze({ python: 'pip', node: 'npm' }),
      // 允许的两种安装形式；参数部分必须逐项过 PACKAGE_PATTERN。
      formats: Object.freeze(['pip install <包名>', 'npm install <包名>']),
      pattern: PACKAGE_PATTERN.source,
    }),
    runnerEnabled: s['runner.enabled'] === true,
  }
}

/** 列出全部运行时声明（返回副本，改动不影响注册表）。 */
export function listRuntimes(registry) {
  const rows = registry && Array.isArray(registry.runtimes) ? registry.runtimes : []
  return rows.map(row => ({ ...row }))
}

/** 列出声明已装包名（返回副本）。 */
export function listPackages(registry) {
  const rows = registry && Array.isArray(registry.packages) ? registry.packages : []
  return rows.slice()
}

/** 单个包名能否安装：只做字符格式校验，纯函数、同步。 */
export function canInstall(name) {
  return isValidPackageName(name)
}

/**
 * 能力自省：校验一个 capability spec 是否良构/可用。
 * spec 可以是字符串（运行时名或包名），也可以是
 * { runtime: 'python', package: 'numpy' } / { runtime, packages: [...] }。
 * 传入第二参 registry 时，还会核对注册表里该运行时是否可用、包是否已声明。
 *
 * @returns {{ok: boolean, error: string}}
 */
export function validateCapability(spec, registry) {
  const fail = error => ({ ok: false, error })
  if (typeof spec === 'string') {
    const text = str(spec)
    if (!text) return fail('能力描述是空的')
    if (RUNTIMES.includes(text)) {
      if (registry) {
        const row = listRuntimes(registry).find(r => r.name === text)
        if (!row) return fail('注册表未声明运行时：' + text)
        if (!row.available) return fail('运行时不可用：' + text)
      }
      return { ok: true, error: '' }
    }
    return canInstall(text) ? { ok: true, error: '' } : fail('包名不合法：' + text)
  }
  if (!spec || typeof spec !== 'object') return fail('能力描述格式不对')
  const runtime = spec.runtime === undefined ? '' : str(spec.runtime)
  if (runtime && !RUNTIMES.includes(runtime)) return fail('不支持的运行时：' + runtime)
  const raw = spec.packages !== undefined ? spec.packages : (spec.package !== undefined ? [spec.package] : [])
  const list = Array.isArray(raw) ? raw : [raw]
  const declared = registry ? listPackages(registry) : null
  for (const item of list) {
    const name = str(item)
    if (!name) continue
    if (!canInstall(name)) return fail('包名不合法：' + name)
    if (declared && !declared.includes(name)) return fail('注册表未声明该包：' + name)
  }
  if (registry && runtime) {
    const row = listRuntimes(registry).find(r => r.name === runtime)
    if (!row) return fail('注册表未声明运行时：' + runtime)
    if (!row.available) return fail('运行时不可用：' + runtime)
  }
  return { ok: true, error: '' }
}

/** 一句话摘要，便于日志/面板展示。 */
export function describe(registry) {
  const runtimes = listRuntimes(registry)
  const packages = listPackages(registry)
  return {
    version: registry && registry.version ? registry.version : 1,
    runtimeCount: runtimes.length,
    availableRuntimes: runtimes.filter(r => r.available).map(r => r.name),
    packageCount: packages.length,
    runnerEnabled: !!(registry && registry.runnerEnabled),
    installEnabled: !!(registry && registry.install && registry.install.enabled),
    installFormats: registry && registry.install && Array.isArray(registry.install.formats)
      ? registry.install.formats.slice()
      : [],
    packagePattern: registry && registry.install && registry.install.pattern
      ? registry.install.pattern
      : PACKAGE_PATTERN.source,
  }
}

/** 把多种 observed 形状归一成 { runtimes: {name:{available,version}}, packages:[] }。 */
function normalizeObserved(observed) {
  const out = { runtimes: {}, packages: [] }
  const o = observed && typeof observed === 'object' ? observed : {}
  const sources = o.runtimes && typeof o.runtimes === 'object' ? o.runtimes : o
  const set = (name, cap) => {
    const key = str(name)
    if (!key || !cap || typeof cap !== 'object') return
    out.runtimes[key] = {
      available: cap.available === true || cap.ok === true,
      version: str(cap.version),
    }
  }
  if (Array.isArray(sources)) {
    for (const row of sources) set(row && row.name, row)
  } else if (sources && typeof sources === 'object') {
    for (const name of RUNTIMES) set(name, sources[name])
    if (o.runtimes) {
      for (const [name, cap] of Object.entries(sources)) set(name, cap)
    }
  }
  const pkgs = o.packages !== undefined ? o.packages : sources.packages
  if (Array.isArray(pkgs)) out.packages = pkgs.map(p => str(p)).filter(Boolean)
  else if (typeof pkgs === 'string') out.packages = pkgs.split(',').map(p => str(p)).filter(Boolean)
  return out
}

/**
 * 漂移检测：比较注册表声明能力与探测到的真实能力，返回漂移项数组。
 * status='missing'    声明有 / 实际无；
 * status='undeclared' 实际有 / 未声明。
 *
 * @param {object} registry - buildRegistry 的结果。
 * @param {object} observed - 探测结果。支持两种形状：
 *   { python:{ok,version}, node:{ok,version}, packages:['numpy'] }
 *   或 { runtimes:{python:{available,version},...}, packages:[...] }。
 * @returns {{kind:'runtime'|'package', name:string, status:string, detail:string}[]}
 */
export function validateRegistry(registry, observed) {
  const drifts = []
  const obs = normalizeObserved(observed)
  const declaredRuntimes = listRuntimes(registry)

  for (const rt of declaredRuntimes) {
    if (!rt.available) continue
    const real = obs.runtimes[rt.name]
    if (!real || !real.available) {
      drifts.push({ kind: 'runtime', name: rt.name, status: 'missing', detail: '声明可用但探测不可用' })
    }
  }
  for (const [name, real] of Object.entries(obs.runtimes)) {
    if (!real.available) continue
    const declared = declaredRuntimes.find(r => r.name === name)
    if (!declared || !declared.available) {
      drifts.push({ kind: 'runtime', name, status: 'undeclared', detail: '探测可用但未声明' })
    }
  }

  const declaredPkgs = listPackages(registry)
  for (const pkg of declaredPkgs) {
    if (!obs.packages.includes(pkg)) {
      drifts.push({ kind: 'package', name: pkg, status: 'missing', detail: '声明已装但实际未检出' })
    }
  }
  for (const pkg of obs.packages) {
    if (!declaredPkgs.includes(pkg)) {
      drifts.push({ kind: 'package', name: pkg, status: 'undeclared', detail: '实际已装但未声明' })
    }
  }
  return drifts
}
