// 外部工具调用（实验验证组 G）。
//
// 三条硬规则，任何一条都不能破：
// 1. 只用 spawn 且 shell:false —— 用户代码永远不进命令行，解释器收到的参数只有一个文件路径。
// 2. 用户代码先落盘成 .py / .mjs，再把「文件路径」交给解释器，
//    所以 shell 元字符（; | & $() ）在代码里没有任何意义，无法逃逸出 spawn。
// 3. 任何落盘路径都必须在允许根目录内（resolveInside），工作目录之外的路径一律拒绝。
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dshHome } from './store.mjs'
import { truncate } from './util.mjs'

/** 允许的运行时白名单：命令白名单的第一层，其余一律拒绝。 */
export const RUNTIMES = ['python', 'node']

const MAX_CODE_CHARS = 200000
const MAX_OUTPUT_CHARS = 20000
const DEFAULT_TIMEOUT_SEC = 60
const MAX_TIMEOUT_SEC = 600
const MAX_PACKAGES = 20
const PROBE_TIMEOUT_MS = 2000
const DATA_DIR_NAME = 'research-desk'

// 包名字符集：名字、版本号、extras 都必须是「字母数字 @ . _ -」，
// extras 用方括号包住一串同样受限的字符。斜杠、分号、空格全部落在外头。
const PACKAGE_PATTERN = /^[A-Za-z0-9@._-]+(\[[^\]]+\])?(==[0-9A-Za-z.*-]+)?$/

// 常见解释器名。'py -3' 拆成 cmd='py' + argsPrefix=['-3']，
// 这样 spawn 收到的仍然是纯参数数组，不需要 shell。
const COMMON_CANDIDATES = {
  python: [
    { cmd: 'python', argsPrefix: [] },
    { cmd: 'python3', argsPrefix: [] },
    { cmd: 'py', argsPrefix: ['-3'] },
  ],
  node: [{ cmd: 'node', argsPrefix: [] }],
}

// DSH 自带运行时里的解释器相对位置（相对 <runtime>/dependencies）。
const DSH_CANDIDATES = {
  node: [
    path.join('node', 'bin', 'node.exe'),
    path.join('node', 'bin', 'node'),
  ],
  python: [
    path.join('python', 'python.exe'),
    path.join('python', 'python3'),
    path.join('python', 'bin', 'python3'),
  ],
}

/** 插件数据目录：DSH_HOME/research-desk，与 Store 的默认位置一致。 */
function defaultDataDir() {
  return path.join(dshHome(), DATA_DIR_NAME)
}

function isInside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target))
  if (rel === '') return true
  if (path.isAbsolute(rel)) return false
  return rel !== '..' && !rel.startsWith('..' + path.sep)
}

/**
 * 把路径解析到 root 内部，越界就抛错。
 * @param {string} root - 允许的根目录。
 * @param {...string} segments - 要拼接的相对片段。
 * @returns {string} 解析后的绝对路径。
 */
function resolveInside(root, ...segments) {
  const base = path.resolve(root)
  const target = path.resolve(base, ...segments)
  if (!isInside(base, target)) throw new Error('路径越界：' + target)
  return target
}

/** 允许的根目录：配置的工作目录、插件数据目录、配置的数据落地目录。 */
function allowedRoots(settings = {}, dataDir = '') {
  const roots = []
  const add = value => {
    const text = typeof value === 'string' ? value.trim() : ''
    if (text) roots.push(path.resolve(text))
  }
  add(settings['runner.workDir'])
  add(dataDir)
  add(settings['storage.dataDir'])
  if (!roots.length) roots.push(defaultDataDir())
  return Array.from(new Set(roots))
}

// ===== 加固三缺口（方案 v1.3 §3.2 阶段0）=====
// 凭据类环境变量特征：命中任意一个就一律排除，绝不泄漏给子进程。
const CREDENTIAL_MARKS = ['TOKEN', 'KEY', 'SECRET', 'AWS_', 'GH_']
// 代理相关环境变量名（大小写两套）。
const PROXY_KEYS = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'FTP_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'ftp_proxy', 'no_proxy',
]
// exec 模式注入的无效代理：127.0.0.1 上的越界端口（>65535），外网请求必定失败。
const EXEC_PROXY_URL = 'http://127.0.0.1:65536'

function isCredentialKey(key) {
  const upper = String(key).toUpperCase()
  return CREDENTIAL_MARKS.some(mark => upper.includes(mark))
}

/**
 * 杀掉整棵进程树：Windows 上先用 taskkill /T /F 连孙进程一起杀，再 child.kill() 兜底。
 *
 * 局限：taskkill /T 只有在父 PID 还活着时才能遍历子进程树；如果父进程先退出、
 * 后代变成 detached 孤儿，这些孤儿可能残留（taskkill 遍历不到）。
 *
 * @param {import('node:child_process').ChildProcess} child - 目标子进程。
 */
function killTree(child) {
  if (!child) return
  if (process.platform === 'win32' && Number.isInteger(child.pid)) {
    try {
      // shell:false：PID 只作为参数传入，不拼进命令行，避免任何注入。
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      })
      // taskkill 自身失败（例如进程刚退出）也不能影响主流程。
      killer.on('error', () => {})
      if (typeof killer.unref === 'function') killer.unref()
    } catch {
      // spawn 同步失败也不抛错，交给下面的 child.kill() 兜底。
    }
  }
  // 非 Windows 没有等价的树杀工具，只能降级为 child.kill()：
  // 它只杀直接子进程，不会连带孙进程，detached 的孤儿可能残留（见上面局限）。
  try {
    child.kill()
  } catch {
    // 进程可能已经自己退出了
  }
}

/**
 * 生成最小环境变量白名单，供 host 层按执行路径选用（本模块不主动接线）。
 * - 基础键：PATH / SystemRoot / TEMP / TMP / APPDATA / LOCALAPPDATA /
 *   USERPROFILE / COMSPEC / PATHEXT / NUMBER_OF_PROCESSORS，以及所有 PYTHON*。
 * - 凭据类（TOKEN/KEY/SECRET/AWS_/GH_）一律排除。
 * - mode='install' 保留真实代理；mode='exec' 注入无效代理并把 NO_PROXY 置空（断网）。
 *
 * 中文示例：
 *   const runEnv = filteredEnv('exec')     // 跑用户代码：断网、无凭据
 *   const pipEnv = filteredEnv('install')  // 装包：保留代理以便下载
 *
 * @param {'exec'|'install'} [mode] - 模式，默认 'exec'。
 * @returns {Record<string, string>} 过滤后的环境变量。
 */
export function filteredEnv(mode = 'exec') {
  const src = process.env
  const baseKeys = [
    'PATH', 'SystemRoot', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA',
    'USERPROFILE', 'COMSPEC', 'PATHEXT', 'NUMBER_OF_PROCESSORS',
  ]
  const out = {}
  // 基础键（大小写不敏感匹配，输出用规范名）+ 所有 PYTHON*，都过一遍凭据过滤。
  for (const canonical of baseKeys) {
    const actual = Object.keys(src).find(k => k.toUpperCase() === canonical.toUpperCase())
    if (actual && !isCredentialKey(actual)) out[canonical] = src[actual]
  }
  for (const key of Object.keys(src)) {
    if (key.toUpperCase().startsWith('PYTHON') && !isCredentialKey(key)) out[key] = src[key]
  }
  if (mode === 'install') {
    // 装包需要真实代理才能下载，原样保留（同样排除凭据特征）。
    for (const key of PROXY_KEYS) {
      if (src[key] !== undefined && !isCredentialKey(key)) out[key] = src[key]
    }
  } else {
    // 跑用户代码：所有代理指向不可达地址，NO_PROXY 置空 → 全量断网。
    for (const key of PROXY_KEYS) {
      out[key] = (key === 'NO_PROXY' || key === 'no_proxy') ? '' : EXEC_PROXY_URL
    }
  }
  return out
}

/**
 * 跑一个子进程，收集输出，带超时与取消。
 * @param {object} options - 运行参数。
 * @param {string} options.cmd - 可执行文件路径或名字。
 * @param {string[]} options.args - 参数数组（永远不经过 shell）。
 * @param {string} options.cwd - 工作目录。
 * @param {number} options.timeoutMs - 超时毫秒数。
 * @param {AbortSignal} [options.signal] - 取消信号。
 * @param {number} [options.maxOutputChars] - 输出字符上限，默认 MAX_OUTPUT_CHARS；仅 killOnLimit=true 时生效。
 * @param {boolean} [options.killOnLimit] - 超限是否立即杀进程，默认 false（维持原行为）。
 * @param {Record<string,string>} [options.env] - 自定义环境变量（如 filteredEnv(...)）；默认 undefined 沿用完整 process.env。
 * @returns {Promise<{code: number|null, stdout: string, stderr: string, timedOut: boolean, aborted: boolean, error: string}>} 运行结果。
 */
export function runProcess({ cmd, args, cwd, timeoutMs, signal, maxOutputChars = MAX_OUTPUT_CHARS, killOnLimit = false, env }) {
  return new Promise(resolve => {
    let child
    try {
      child = spawn(cmd, args, {
        cwd: cwd || process.cwd(),
        shell: false,
        windowsHide: true,
        env: {
          // env 缺省时沿用完整 process.env，保持原有行为；Python 三件套始终注入。
          ...(env || process.env),
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          PYTHONUNBUFFERED: '1',
        },
      })
    } catch (err) {
      resolve({
        code: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        aborted: false,
        error: '启动失败：' + (err && err.message ? err.message : String(err)),
      })
      return
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let aborted = false
    let settled = false
    // 统一走进程树杀：超时/取消/输出超限都先 taskkill /T /F 再 child.kill() 兜底。
    const kill = () => killTree(child)
    const timer = setTimeout(() => {
      timedOut = true
      kill()
    }, timeoutMs)
    const onAbort = () => {
      aborted = true
      kill()
    }
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    const finish = (code, error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve({ code, stdout, stderr, timedOut, aborted, error: error || '' })
    }
    if (child.stdout) child.stdout.on('data', chunk => {
      stdout += chunk
      // 仅执行路径开启（runCode 传 true）：累计输出超过上限立即杀，防止失控输出。
      // installPackages 不传 killOnLimit（默认 false），verbose pip 刷屏不会被误杀。
      if (killOnLimit && stdout.length > maxOutputChars) kill()
    })
    if (child.stderr) child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', err => finish(null, '启动失败：' + (err && err.message ? err.message : String(err))))
    child.on('close', code => finish(code === undefined ? null : code))
  })
}

/** DSH 自带运行时里的解释器候选（用 readdir 扫，不写死运行时目录名）。 */
async function dshCandidates(runtime) {
  const base = path.join(dshHome(), 'dsh-runtimes')
  let entries = []
  try {
    entries = await readdir(base, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const entry of entries.filter(row => row.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const deps = path.join(base, entry.name, 'dependencies')
    for (const relative of DSH_CANDIDATES[runtime] || []) {
      out.push({ cmd: path.join(deps, relative), argsPrefix: [] })
    }
  }
  return out
}

/**
 * 探测一个解释器：跑 --version，2 秒内拿不到版本就算不可用。
 * @param {string} cmd - 可执行文件。
 * @param {string[]} argsPrefix - 固定前缀参数。
 * @returns {Promise<{ok: boolean, version: string, error: string}>} 探测结果。
 */
async function probeVersion(cmd, argsPrefix) {
  const res = await runProcess({
    cmd: cmd,
    args: [...argsPrefix, '--version'],
    cwd: process.cwd(),
    timeoutMs: PROBE_TIMEOUT_MS,
  })
  if (res.timedOut) return { ok: false, version: '', error: '探测超时' }
  if (res.error) return { ok: false, version: '', error: res.error }
  if (res.code !== 0) return { ok: false, version: '', error: '退出码 ' + res.code }
  const text = (res.stdout || res.stderr || '').split(/\r?\n/).find(line => line.trim())
  return { ok: true, version: text ? text.trim() : '', error: '' }
}

/**
 * 探测可用解释器。候选顺序：设置里配置的路径 → 常见名 → DSH 自带运行时。
 * @param {string} runtime - 'python' 或 'node'。
 * @param {object} [settings] - 当前设置。
 * @returns {Promise<{ok: boolean, cmd: string, argsPrefix: string[], version: string, source: string, error?: string}>} 探测结果。
 */
export async function probeRuntime(runtime, settings = {}) {
  const empty = { ok: false, cmd: '', argsPrefix: [], version: '', source: 'none' }
  if (!RUNTIMES.includes(runtime)) return { ...empty, error: '不支持的运行时：' + String(runtime) }
  const candidates = []
  const configured = typeof settings['runner.' + runtime + 'Path'] === 'string' ? settings['runner.' + runtime + 'Path'].trim() : ''
  if (configured) candidates.push({ cmd: configured, argsPrefix: [], source: 'settings' })
  for (const row of COMMON_CANDIDATES[runtime] || []) candidates.push({ ...row, source: 'common' })
  for (const row of await dshCandidates(runtime)) candidates.push({ ...row, source: 'dsh' })
  for (const candidate of candidates) {
    const res = await probeVersion(candidate.cmd, candidate.argsPrefix)
    if (res.ok) {
      return {
        ok: true,
        cmd: candidate.cmd,
        argsPrefix: candidate.argsPrefix.slice(),
        version: res.version,
        source: candidate.source,
      }
    }
  }
  return { ...empty, error: '没有找到可用的 ' + runtime + ' 解释器' }
}

/**
 * 校验一段用户代码。
 * @param {string} runtime - 运行时。
 * @param {string} code - 代码正文。
 * @returns {{ok: boolean, error: string}} 校验结果。
 */
export function validateCode(runtime, code) {
  if (!RUNTIMES.includes(runtime)) return { ok: false, error: '不支持的运行时：' + String(runtime) }
  const text = typeof code === 'string' ? code : ''
  if (!text.trim()) return { ok: false, error: '代码是空的' }
  if (text.length > MAX_CODE_CHARS) {
    return { ok: false, error: '代码太长：' + text.length + ' 字符（上限 ' + MAX_CODE_CHARS + '）' }
  }
  return { ok: true, error: '' }
}

/**
 * 校验一批包名。
 * @param {string} runtime - 运行时。
 * @param {string[]|string} packages - 包名数组或逗号分隔字符串。
 * @returns {{ok: boolean, error: string, list: string[]}} 校验结果与规范化后的包名。
 */
export function validatePackages(runtime, packages) {
  if (!RUNTIMES.includes(runtime)) return { ok: false, error: '不支持的运行时：' + String(runtime), list: [] }
  // 字符串只按逗号切分：分号和空格是 shell 的元字符，一旦被当成分隔符，
  // 'a;whoami' 就会被切成两个合法包名，绕过字符表。所以这里只认逗号。
  const raw = Array.isArray(packages)
    ? packages
    : (typeof packages === 'string' ? packages.split(',') : [])
  const list = []
  for (const item of raw) {
    const name = typeof item === 'string' ? item.trim() : ''
    if (!name) continue
    if (!PACKAGE_PATTERN.test(name)) return { ok: false, error: '包名不合法：' + name, list: [] }
    // 纯点的名字虽然能过字符表，但没有任何包长这样，直接挡掉。
    if (!/[A-Za-z0-9]/.test(name)) return { ok: false, error: '包名不合法：' + name, list: [] }
    if (list.includes(name)) continue
    list.push(name)
  }
  if (!list.length) return { ok: false, error: '没有要安装的包', list: [] }
  if (list.length > MAX_PACKAGES) return { ok: false, error: '一次最多安装 ' + MAX_PACKAGES + ' 个包', list: [] }
  return { ok: true, error: '', list }
}

/**
 * 算出调用工作目录：设置里配置的工作目录，或数据目录下的 runs。
 * @param {object} [settings] - 当前设置。
 * @param {string} [dataDir] - 插件数据目录。
 * @returns {string} 工作目录绝对路径。
 */
export function workDirFor(settings = {}, dataDir = '') {
  const configured = typeof settings['runner.workDir'] === 'string' ? settings['runner.workDir'].trim() : ''
  if (configured) return path.resolve(configured)
  const base = dataDir ? path.resolve(dataDir) : defaultDataDir()
  return path.join(base, 'runs')
}

function timeoutMsFor(settings = {}) {
  const raw = Number(settings['runner.timeoutSec'])
  const sec = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_SEC
  return Math.min(sec, MAX_TIMEOUT_SEC) * 1000
}

function stamp() {
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  const random = Math.random().toString(36).slice(2, 8)
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    '-',
    random,
  ].join('')
}

/** 在 PATH 里找绝对路径，用于定位 npm-cli.js 之类的同级文件。 */
function resolveOnPath(cmd) {
  if (path.isAbsolute(cmd)) return cmd
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean)
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext)
      if (existsSync(candidate)) return candidate
    }
  }
  return cmd
}

/**
 * 找 npm 的 JS 入口：Windows 上 npm.cmd 不能直接 spawn（.cmd 必须走 shell），
 * 所以改成用 node 跑 npm-cli.js。
 * 候选来源有两处：node 可执行文件旁边的 npm，以及 PATH 里的 npm.cmd 旁边。
 * @param {string} nodeCmd - 用的 node 可执行文件。
 * @returns {string} npm-cli.js 绝对路径；找不到返回空串。
 */
function findNpmCli(nodeCmd) {
  const bases = [path.dirname(resolveOnPath(nodeCmd))]
  const npmOnPath = resolveOnPath('npm')
  if (npmOnPath && npmOnPath !== 'npm') bases.push(path.dirname(npmOnPath))
  const candidates = []
  for (const base of bases) {
    candidates.push(path.join(base, 'node_modules', 'npm', 'bin', 'npm-cli.js'))
    candidates.push(path.join(base, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'))
    candidates.push(path.join(base, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'))
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return path.resolve(candidate)
  }
  return ''
}

/**
 * 跑一段用户代码：落盘 → spawn → 收输出 → 完整日志另存。
 * @param {object} options - 调用参数。
 * @param {string} options.runtime - 'python' 或 'node'。
 * @param {string} options.code - 代码正文。
 * @param {object} [options.settings] - 当前设置。
 * @param {string} [options.workDir] - 工作目录。
 * @param {AbortSignal} [options.signal] - 取消信号。
 * @param {string} [options.dataDir] - 插件数据目录（用于路径白名单）。
 * @returns {Promise<object>} 运行结果。
 */
export async function runCode({ runtime, code, settings = {}, workDir, signal, dataDir } = {}) {
  const started = Date.now()
  const check = validateCode(runtime, code)
  if (!check.ok) {
    return { ok: false, exitCode: null, stdout: '', stderr: '', durationMs: 0, timedOut: false, workDir: workDir || '', files: [], error: check.error }
  }
  const roots = allowedRoots(settings, dataDir)
  const target = typeof workDir === 'string' && workDir.trim() ? path.resolve(workDir) : workDirFor(settings, dataDir)
  // 工作目录必须在允许根目录内（配置的工作目录或数据目录），否则拒绝落盘。
  if (!roots.some(root => isInside(root, target))) {
    return { ok: false, exitCode: null, stdout: '', stderr: '', durationMs: 0, timedOut: false, workDir: target, files: [], error: '工作目录不在允许范围内：' + target }
  }
  const probe = await probeRuntime(runtime, settings)
  if (!probe.ok) {
    return { ok: false, exitCode: null, stdout: '', stderr: '', durationMs: 0, timedOut: false, workDir: target, files: [], error: probe.error }
  }
  await mkdir(target, { recursive: true })
  const scriptName = 'run-' + stamp() + (runtime === 'python' ? '.py' : '.mjs')
  const scriptPath = resolveInside(target, scriptName)
  await writeFile(scriptPath, code, 'utf8')
  // 解释器只拿到文件路径，绝不拿到代码本身。
  const res = await runProcess({
    cmd: probe.cmd,
    args: [...probe.argsPrefix, scriptPath],
    cwd: target,
    timeoutMs: timeoutMsFor(settings),
    signal: signal,
    // 执行用户代码：输出超限立即杀，防止失控输出（装包路径不传，保持 false）。
    killOnLimit: true,
  })
  const logsDir = resolveInside(target, 'logs')
  await mkdir(logsDir, { recursive: true })
  const base = scriptName.replace(/\.[^.]+$/, '')
  const stdoutLog = resolveInside(logsDir, base + '.stdout.log')
  const stderrLog = resolveInside(logsDir, base + '.stderr.log')
  await writeFile(stdoutLog, res.stdout, 'utf8')
  await writeFile(stderrLog, res.stderr, 'utf8')
  const timedOut = res.timedOut
  const aborted = res.aborted
  return {
    ok: res.code === 0 && !timedOut && !aborted,
    exitCode: res.code,
    stdout: truncate(res.stdout, MAX_OUTPUT_CHARS),
    stderr: truncate(res.stderr, MAX_OUTPUT_CHARS),
    durationMs: Date.now() - started,
    timedOut: timedOut,
    aborted: aborted,
    truncated: { stdout: res.stdout.length > MAX_OUTPUT_CHARS, stderr: res.stderr.length > MAX_OUTPUT_CHARS },
    workDir: target,
    files: [scriptPath, stdoutLog, stderrLog],
    runtime: runtime,
    cmd: probe.cmd,
    error: res.error || (timedOut ? '执行超时，已终止' : (aborted ? '已取消' : '')),
  }
}

/**
 * 安装外部包：默认关闭，打开后只接受 pip install / npm install 形式。
 * @param {object} options - 调用参数。
 * @param {string} options.runtime - 'python' 或 'node'。
 * @param {string[]|string} options.packages - 包名。
 * @param {object} [options.settings] - 当前设置。
 * @param {string} [options.workDir] - 工作目录。
 * @param {AbortSignal} [options.signal] - 取消信号。
 * @param {string} [options.dataDir] - 插件数据目录。
 * @returns {Promise<object>} 安装结果。
 */
export async function installPackages({ runtime, packages, settings = {}, workDir, signal, dataDir } = {}) {
  const started = Date.now()
  const fail = (message) => ({
    ok: false,
    exitCode: null,
    stdout: '',
    stderr: '',
    durationMs: Date.now() - started,
    timedOut: false,
    installed: [],
    workDir: workDir || '',
    files: [],
    error: message,
  })
  // 安装默认关闭：用户没打开开关就不该有包被装进机器。
  if (settings['runner.allowInstall'] !== true) {
    return fail('没有开启安装权限。请在设置面板把「允许安装外部包」（runner.allowInstall）打开后再试。')
  }
  const check = validatePackages(runtime, packages)
  if (!check.ok) return fail(check.error)
  const probe = await probeRuntime(runtime, settings)
  if (!probe.ok) return fail(probe.error)
  const roots = allowedRoots(settings, dataDir)
  const target = typeof workDir === 'string' && workDir.trim() ? path.resolve(workDir) : workDirFor(settings, dataDir)
  if (!roots.some(root => isInside(root, target))) {
    return fail('工作目录不在允许范围内：' + target)
  }
  await mkdir(target, { recursive: true })
  let cmd = probe.cmd
  let args = []
  if (runtime === 'python') {
    // 优先 python -m pip：它一定跟着这个解释器走，不会串到别的 Python。
    args = [...probe.argsPrefix, '-m', 'pip', 'install', ...check.list]
  } else {
    const npmCli = findNpmCli(probe.cmd)
    if (!npmCli) {
      return fail('找不到 npm：这个 Node 目录里没有 node_modules/npm/bin/npm-cli.js。')
    }
    // Windows 上 npm.cmd 不能直接 spawn（.cmd 需要 shell），所以用 node 跑 npm-cli.js。
    args = [...probe.argsPrefix, npmCli, 'install', ...check.list]
  }
  const res = await runProcess({
    cmd: cmd,
    args: args,
    cwd: target,
    timeoutMs: timeoutMsFor(settings),
    signal: signal,
  })
  const logsDir = resolveInside(target, 'logs')
  await mkdir(logsDir, { recursive: true })
  const base = 'install-' + stamp()
  const stdoutLog = resolveInside(logsDir, base + '.stdout.log')
  const stderrLog = resolveInside(logsDir, base + '.stderr.log')
  await writeFile(stdoutLog, res.stdout, 'utf8')
  await writeFile(stderrLog, res.stderr, 'utf8')
  return {
    ok: res.code === 0 && !res.timedOut && !res.aborted,
    exitCode: res.code,
    stdout: truncate(res.stdout, MAX_OUTPUT_CHARS),
    stderr: truncate(res.stderr, MAX_OUTPUT_CHARS),
    durationMs: Date.now() - started,
    timedOut: res.timedOut,
    aborted: res.aborted,
    installed: res.code === 0 ? check.list : [],
    packages: check.list,
    workDir: target,
    files: [stdoutLog, stderrLog],
    runtime: runtime,
    error: res.error || (res.timedOut ? '安装超时，已终止' : (res.aborted ? '已取消' : '')),
  }
}
