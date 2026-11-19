// 外部工具调用的单测。跑法：node --test test/runner.test.mjs
//
// 用真解释器跑真代码，不做假 spawn：
// 解释器固定为 process.execPath（当前这个 node），所以测试结果与本机 node 行为一致。
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'

import {
  RUNTIMES,
  filteredEnv,
  installPackages,
  probeRuntime,
  runProcess,
  runCode,
  validateCode,
  validatePackages,
  workDirFor,
} from '../lib/runner.mjs'

/** 造一个临时数据目录与工作目录，跑完就删。 */
async function withTempDir(fn) {
  const root = await mkdtemp(join(tmpdir(), 'rd-runner-'))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const NODE_SETTINGS = { 'runner.nodePath': process.execPath }

test('runner: 运行时白名单只有 python 与 node', () => {
  assert.deepEqual(RUNTIMES, ['python', 'node'])
})

test('runner: validateCode 拒绝空代码、超长代码与未知运行时', () => {
  assert.equal(validateCode('node', 'console.log(1)').ok, true)
  assert.equal(validateCode('node', '   ').ok, false)
  assert.equal(validateCode('node', '').error.includes('空的'), true)
  assert.equal(validateCode('node', 'x'.repeat(200001)).ok, false)
  assert.equal(validateCode('node', 'x'.repeat(200001)).error.includes('太长'), true)
  assert.equal(validateCode('node', 'x'.repeat(200000)).ok, true)
  assert.equal(validateCode('bash', 'ls').ok, false)
  assert.equal(validateCode('bash', 'ls').error.includes('不支持'), true)
})

test('runner: validatePackages 接受正常包名，拒绝恶意包名', () => {
  const good = validatePackages('python', ['numpy', 'scipy[extra]', 'pandas==2.2.0'])
  assert.equal(good.ok, true)
  assert.deepEqual(good.list, ['numpy', 'scipy[extra]', 'pandas==2.2.0'])

  // 目录穿越：绝不能进 pip 的参数里。
  assert.equal(validatePackages('python', ['../evil']).ok, false)
  assert.equal(validatePackages('python', ['../../etc/passwd']).ok, false)
  // 命令分隔符：分号与空格都不能被当成合法包名。
  assert.equal(validatePackages('python', ['a;b']).ok, false)
  assert.equal(validatePackages('python', ['a b']).ok, false)
  assert.equal(validatePackages('python', ['a && whoami']).ok, false)
  assert.equal(validatePackages('python', ['pkg|tee']).ok, false)
  // 绝对路径与命令替换。
  assert.equal(validatePackages('python', ['/usr/bin/python']).ok, false)
  assert.equal(validatePackages('python', ['$(whoami)']).ok, false)
  // 字符串输入只按逗号切分：分号会被整体拒掉，而不是拆成两个包。
  assert.equal(validatePackages('python', 'numpy,scipy').ok, true)
  assert.equal(validatePackages('python', 'numpy;whoami').ok, false)
  assert.equal(validatePackages('python', '').ok, false)
  // 数量上限。
  const many = Array.from({ length: 21 }, (_, i) => 'pkg' + i)
  assert.equal(validatePackages('python', many).ok, false)
  assert.equal(validatePackages('python', many.slice(0, 20)).ok, true)
})

test('runner: workDirFor 用设置里的工作目录，否则用数据目录下的 runs', () => {
  const configured = workDirFor({ 'runner.workDir': 'D:/tmp/rd' }, 'C:/data')
  assert.equal(isAbsolute(configured), true)
  assert.equal(configured.endsWith(join('tmp', 'rd')), true)
  assert.equal(workDirFor({}, 'C:/data').endsWith(join('runs')), true)
})

test('runner: probeRuntime 能找到 node 并报出版本', async () => {
  const probe = await probeRuntime('node', NODE_SETTINGS)
  assert.equal(probe.ok, true)
  assert.equal(probe.source, 'settings')
  assert.match(probe.version, /v\d+/)
})

test('runner: probeRuntime 拒绝未知运行时', async () => {
  const probe = await probeRuntime('bash', {})
  assert.equal(probe.ok, false)
  assert.equal(probe.error.includes('不支持'), true)
})

test('runner: runCode 真跑一段 node 代码，捕获 stdout 与退出码', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'node',
      code: 'console.log("hello-from-runner"); console.error("to-stderr"); process.exit(3)',
      settings: NODE_SETTINGS,
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.ok, false)
    assert.equal(result.exitCode, 3)
    assert.match(result.stdout, /hello-from-runner/)
    assert.match(result.stderr, /to-stderr/)
    assert.equal(result.timedOut, false)
    assert.equal(result.durationMs >= 0, true)
    // 代码落盘成 .mjs，解释器只拿到这个文件路径。
    assert.equal(result.files[0].endsWith('.mjs'), true)
    assert.equal(result.files[0].includes(root), true)
    // 完整日志另存。
    assert.equal(result.files.length, 3)
  })
})

test('runner: 退出码为 0 时 ok 为 true', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'node',
      code: 'console.log(6 * 7)',
      settings: NODE_SETTINGS,
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.ok, true)
    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /42/)
  })
})

test('runner: 死循环会被超时杀掉并标记 timedOut', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'node',
      code: 'while (true) {}',
      settings: { ...NODE_SETTINGS, 'runner.timeoutSec': 1 },
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.timedOut, true)
    assert.equal(result.ok, false)
    assert.equal(result.error.includes('超时'), true)
  })
})

test('runner: 超时上限是 600 秒，不会因为设置里的巨大值而永远等', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'node',
      code: 'console.log("quick")',
      settings: { ...NODE_SETTINGS, 'runner.timeoutSec': 999999 },
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.ok, true)
    assert.equal(result.timedOut, false)
  })
})

test('runner: 工作目录不在允许根目录内时拒绝落盘', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'node',
      code: 'console.log(1)',
      settings: NODE_SETTINGS,
      workDir: join(root, '..', 'outside-runs'),
      dataDir: root,
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.includes('不在允许范围'), true)
    assert.equal(result.files.length, 0)
  })
})

test('runner: 代码为空时直接拒绝，不启动进程', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'node',
      code: '   ',
      settings: NODE_SETTINGS,
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.includes('空的'), true)
    assert.equal(result.durationMs, 0)
  })
})

test('runner: 未知运行时直接拒绝', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'bash',
      code: 'echo hi',
      settings: NODE_SETTINGS,
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.includes('不支持'), true)
  })
})

test('runner: stdout 超过 20000 字符时截断返回，完整日志仍落盘', async () => {
  await withTempDir(async root => {
    const result = await runCode({
      runtime: 'node',
      code: 'console.log("x".repeat(30000))',
      settings: NODE_SETTINGS,
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.stdout.length, 20000)
    assert.equal(result.truncated.stdout, true)
    // logs/ 里是完整输出。
    const full = await readFile(result.files[1], 'utf8')
    assert.equal(full.length, 30001)
  })
})

test('runner: allowInstall 为 false 时 installPackages 直接拒绝', async () => {
  await withTempDir(async root => {
    const result = await installPackages({
      runtime: 'python',
      packages: ['numpy'],
      settings: { 'runner.allowInstall': false },
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.ok, false)
    assert.equal(result.installed.length, 0)
    assert.equal(result.error.includes('allowInstall'), true)
    assert.equal(result.error.includes('设置面板'), true)
  })
})

test('runner: 包名不合法时即使允许安装也拒绝', async () => {
  await withTempDir(async root => {
    const result = await installPackages({
      runtime: 'python',
      packages: ['../evil'],
      settings: { 'runner.allowInstall': true },
      workDir: join(root, 'runs'),
      dataDir: root,
    })
    assert.equal(result.ok, false)
    assert.equal(result.error.includes('不合法'), true)
    assert.equal(result.installed.length, 0)
  })
})

// ===== 加固三缺口（方案 v1.3 §3.2 阶段0）的补充测试 =====

test('runner: filteredEnv 排除凭据类变量（TOKEN/KEY/SECRET/AWS_/GH_）', () => {
  // 临时往 process.env 注入若干凭据变量，验证一律不出现在白名单里。
  const injected = {
    DEEPSEEK_TOKEN: 'tok-secret',
    OPENAI_API_KEY: 'sk-secret',
    MY_SECRET_VALUE: 'shh',
    AWS_ACCESS_KEY_ID: 'AKIA-secret',
    GITHUB_TOKEN: 'ghp-secret',
    GH_TOKEN: 'ghp-secret-2',
    RD_SAFE_FLAG: 'keep-me-if-allowed',
  }
  const before = {}
  for (const key of Object.keys(injected)) {
    before[key] = process.env[key]
    process.env[key] = injected[key]
  }
  try {
    for (const mode of ['exec', 'install']) {
      const env = filteredEnv(mode)
      for (const key of Object.keys(injected)) {
        // 凭据特征命中者必须被排除；非凭据键本身也不在基础白名单里，同样不出现。
        assert.equal(env[key], undefined, mode + ' 模式不应包含 ' + key)
      }
      for (const value of Object.values(env)) {
        for (const secret of ['tok-secret', 'sk-secret', 'shh', 'AKIA-secret', 'ghp-secret', 'ghp-secret-2']) {
          assert.equal(String(value).includes(secret), false, mode + ' 模式泄漏了凭据值')
        }
      }
    }
  } finally {
    for (const key of Object.keys(injected)) {
      if (before[key] === undefined) delete process.env[key]
      else process.env[key] = before[key]
    }
  }
})

test('runner: filteredEnv 的 exec / install 代理行为不同（exec 断网、install 保真）', () => {
  // 只设一个可识别的真实代理值：Windows 上 process.env 大小写不敏感，
  // HTTP_PROXY 与 http_proxy 是同一个变量，不能给它们设不同的值。
  const before = process.env.HTTP_PROXY
  const beforeNo = process.env.NO_PROXY
  process.env.HTTP_PROXY = 'http://real-proxy.example:8080'
  process.env.NO_PROXY = 'localhost'
  try {
    const exec = filteredEnv('exec')
    const install = filteredEnv('install')
    // exec：所有代理指向 127.0.0.1:65536（无效端口），NO_PROXY 置空 → 全量断网。
    assert.equal(exec.HTTP_PROXY, 'http://127.0.0.1:65536')
    assert.equal(exec.HTTPS_PROXY, 'http://127.0.0.1:65536')
    assert.equal(exec.ALL_PROXY, 'http://127.0.0.1:65536')
    assert.equal(exec.FTP_PROXY, 'http://127.0.0.1:65536')
    assert.equal(exec.NO_PROXY, '')
    // install：保留真实代理与 NO_PROXY。
    assert.equal(install.HTTP_PROXY, 'http://real-proxy.example:8080')
    assert.equal(install.NO_PROXY, 'localhost')
    // 基础键始终保留（这里用 PATH 存在性验证）。
    assert.equal(typeof exec.PATH, 'string')
  } finally {
    if (before === undefined) delete process.env.HTTP_PROXY
    else process.env.HTTP_PROXY = before
    if (beforeNo === undefined) delete process.env.NO_PROXY
    else process.env.NO_PROXY = beforeNo
  }
})

test('runner: killOnLimit=true 超过 maxOutputChars 立即杀进程', async () => {
  // 子进程无限打印，若超限不杀会一直跑到超时（这里超时设很长，靠超限杀）。
  const res = await runProcess({
    cmd: process.execPath,
    args: ['-e', 'setInterval(() => process.stdout.write("x".repeat(1000)), 5)'],
    cwd: process.cwd(),
    timeoutMs: 30000,
    maxOutputChars: 5000,
    killOnLimit: true,
  })
  // 被杀：退出码非空、不是超时（在超时前就被杀）。
  assert.equal(res.timedOut, false)
  assert.notEqual(res.code, 0)
  assert.equal(res.stdout.length > 5000, true, '允许在触发杀之前多收一点，但应远超上限')
})

test('runner: killOnLimit=false 超量不杀（verbose pip 场景）', async () => {
  // 同样的无限输出，但不开启 killOnLimit，也不让它超时：让它跑短一点自然退出。
  // 用有限循环保证进程自行结束，输出量远超上限。
  const res = await runProcess({
    cmd: process.execPath,
    args: ['-e', 'for (let i = 0; i < 20; i++) process.stdout.write("y".repeat(1000))'],
    cwd: process.cwd(),
    timeoutMs: 10000,
    maxOutputChars: 1000,
    killOnLimit: false,
  })
  // 不杀：正常退出码 0，未标记为超时，输出全部收集（远超上限）。
  assert.equal(res.timedOut, false)
  assert.equal(res.code, 0)
  assert.equal(res.stdout.length, 20000)
})

