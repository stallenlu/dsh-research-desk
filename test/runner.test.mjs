// 外部工具调用的单测。跑法：node --test test/runner.test.mjs
//
// 用真解释器跑真代码，不做假 spawn：
// 解释器固定为 process.execPath（当前这个 node），所以测试结果与本机 node 行为一致。
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  RUNTIMES,
  installPackages,
  probeRuntime,
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
  assert.equal(workDirFor({ 'runner.workDir': 'D:/tmp/rd' }, 'C:/data'), 'D:' + '\\tmp\\rd')
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
