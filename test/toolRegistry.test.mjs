// 工具注册表的单测。跑法：node --test test/toolRegistry.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PERMISSION_BOUNDARY,
  RUNTIMES,
  buildRegistry,
  canInstall,
  describe,
  listPackages,
  listRuntimes,
  validateCapability,
  validateRegistry,
} from '../lib/toolRegistry.mjs'

const SETTINGS = {
  'runner.pythonPath': 'C:/py/python.exe',
  'runner.nodePath': 'C:/node/node.exe',
  'runner.packages': 'numpy,scipy,numpy',
  'runner.enabled': true,
  'runner.allowInstall': true,
}
const CAPS = {
  python: { ok: true, cmd: 'C:/py/python.exe', version: 'Python 3.11.9', source: 'settings' },
  node: { ok: false, cmd: '', version: '', source: 'none' },
}

test('注册表：权限边界声明覆盖三档权限与实验闸门', () => {
  for (const word of ['read-only', 'workspace-write', 'danger-full-access', 'runCode', 'installPackages',
    'runner.enabled', '路径白名单', 'L1-L3', '用户确认闸门']) {
    assert.equal(PERMISSION_BOUNDARY.includes(word), true, word)
  }
  assert.deepEqual(RUNTIMES, ['python', 'node'])
})

test('buildRegistry：从 settings + runnerCaps 读出解释器路径、版本与可用状态', () => {
  const reg = buildRegistry(SETTINGS, CAPS)
  const py = reg.runtimes.find(r => r.name === 'python')
  assert.equal(py.available, true)
  assert.equal(py.path, 'C:/py/python.exe')
  assert.equal(py.configuredPath, 'C:/py/python.exe')
  assert.equal(py.version, 'Python 3.11.9')
  assert.equal(py.source, 'settings')
  const node = reg.runtimes.find(r => r.name === 'node')
  assert.equal(node.available, false)
  assert.equal(reg.runnerEnabled, true)
  assert.equal(reg.install.enabled, true)
})

test('buildRegistry：runner.packages 逗号解析、去空去重，install 声明两种形式', () => {
  const reg = buildRegistry({ ...SETTINGS, 'runner.packages': ' numpy, ,scipy,numpy ' }, {})
  assert.deepEqual(reg.packages, ['numpy', 'scipy'])
  assert.deepEqual(reg.install.managers, { python: 'pip', node: 'npm' })
  assert.equal(reg.install.formats.length, 2)
  assert.match(reg.install.pattern, /A-Za-z0-9/)
  assert.equal(reg.runnerEnabled, true)
  assert.equal(reg.install.enabled, true)
})

test('buildRegistry：缺省设置下 runnerEnabled / install 均关闭', () => {
  const reg = buildRegistry({}, {})
  assert.equal(reg.runnerEnabled, false)
  assert.equal(reg.install.enabled, false)
  assert.deepEqual(reg.packages, [])
  assert.equal(reg.runtimes.every(r => r.available === false), true)
})

test('listRuntimes / listPackages 形状且返回副本', () => {
  const reg = buildRegistry(SETTINGS, CAPS)
  const runtimes = listRuntimes(reg)
  assert.equal(Array.isArray(runtimes), true)
  assert.equal(runtimes.length, 2)
  for (const row of runtimes) {
    for (const key of ['name', 'path', 'configuredPath', 'available', 'version', 'source']) {
      assert.ok(key in row, key)
    }
  }
  const packages = listPackages(reg)
  assert.deepEqual(packages, ['numpy', 'scipy'])
  runtimes[0].name = '篡改'
  packages.push('篡改')
  assert.equal(listRuntimes(reg)[0].name, 'python')
  assert.deepEqual(listPackages(reg), ['numpy', 'scipy'])
})

test('canInstall：合法包名 true', () => {
  for (const name of ['numpy', 'scipy[extra]', 'pandas==2.2.0', 'my_pkg.v2']) {
    assert.equal(canInstall(name), true, name)
  }
})

test('canInstall：含 shell 元字符/路径穿越的包名 false', () => {
  for (const name of ['a;whoami', 'a && b', '$(whoami)', '../evil', 'pkg|tee', 'a b', '', '...', '/usr/bin/python']) {
    assert.equal(canInstall(name), false, name)
  }
})

test('validateCapability：字符串与对象形式、合法性校验', () => {
  assert.equal(validateCapability('python').ok, true)
  assert.equal(validateCapability('numpy').ok, true)
  assert.equal(validateCapability('a;b').ok, false)
  assert.equal(validateCapability({ runtime: 'python', package: 'numpy' }).ok, true)
  assert.equal(validateCapability({ runtime: 'bash' }).ok, false)
  assert.equal(validateCapability({ runtime: 'python', package: '../evil' }).ok, false)
  assert.equal(validateCapability(null).ok, false)
})

test('validateCapability：带 registry 时核对可用性与已声明包', () => {
  const reg = buildRegistry(SETTINGS, CAPS)
  assert.equal(validateCapability('python', reg).ok, true)
  assert.equal(validateCapability('node', reg).ok, false) // 探测不可用
  assert.equal(validateCapability({ runtime: 'python', package: 'numpy' }, reg).ok, true)
  assert.equal(validateCapability({ runtime: 'python', package: 'torch' }, reg).ok, false)
})

test('validateRegistry：声明有实际无 → missing', () => {
  const reg = buildRegistry({ ...SETTINGS, 'runner.packages': 'numpy,missing' }, CAPS)
  const observed = { python: { ok: true, version: 'Python 3.11.9' }, node: { ok: false }, packages: ['numpy'] }
  const drifts = validateRegistry(reg, observed)
  assert.equal(drifts.some(d => d.kind === 'package' && d.name === 'missing' && d.status === 'missing'), true)
  // node 本就未声明可用，不算漂移；numpy 两边都有，也不算。
  assert.equal(drifts.some(d => d.kind === 'runtime'), false)
})

test('validateRegistry：实际有未声明 → undeclared', () => {
  const reg = buildRegistry({ 'runner.packages': 'numpy' }, { python: { ok: true }, node: { ok: false } })
  const observed = {
    runtimes: { python: { available: true }, node: { available: true } },
    packages: ['numpy', 'torch'],
  }
  const drifts = validateRegistry(reg, observed)
  assert.equal(drifts.some(d => d.kind === 'runtime' && d.name === 'node' && d.status === 'undeclared'), true)
  assert.equal(drifts.some(d => d.kind === 'package' && d.name === 'torch' && d.status === 'undeclared'), true)
})

test('validateRegistry：声明与探测一致时返回空数组', () => {
  const reg = buildRegistry({ ...SETTINGS, 'runner.packages': 'numpy' }, CAPS)
  const observed = { python: { ok: true }, node: { ok: false }, packages: 'numpy' }
  assert.deepEqual(validateRegistry(reg, observed), [])
})

test('describe：给出结构化摘要', () => {
  const reg = buildRegistry(SETTINGS, CAPS)
  const d = describe(reg)
  assert.equal(d.runtimeCount, 2)
  assert.deepEqual(d.availableRuntimes, ['python'])
  assert.equal(d.packageCount, 2)
  assert.equal(d.runnerEnabled, true)
  assert.equal(d.installEnabled, true)
  assert.equal(d.installFormats.length, 2)
})
