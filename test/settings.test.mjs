// Tests for the settings module.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SETTING_DEFS,
  coerceSettings,
  defaultSettings,
  describeSettings,
  normalizeImageBaseUrl,
  readSettings,
  resetSettings,
  resolveSecret,
} from '../lib/settings.mjs'

test('every setting has a label and a default', () => {
  for (const def of SETTING_DEFS) {
    assert.equal(typeof def.key, 'string')
    assert.equal(typeof def.label, 'string')
    assert.ok(def.label.length > 0, def.key)
    assert.ok('default' in def, def.key)
  }
})

test('unknown keys are dropped instead of stored', () => {
  const current = defaultSettings()
  const result = coerceSettings({ 'not.a.setting': 1, maxResults: 20 }, current)
  assert.equal(result.errors.length, 1)
  assert.equal(result.values.maxResults, 20)
  assert.equal(result.values['not.a.setting'], undefined)
  assert.deepEqual(result.changed, ['maxResults'])
})

test('numbers are clamped into the declared range', () => {
  const current = defaultSettings()
  assert.equal(coerceSettings({ maxResults: 999 }, current).values.maxResults, 40)
  assert.equal(coerceSettings({ maxResults: 0 }, current).values.maxResults, 1)
  assert.equal(coerceSettings({ maxResults: 'many' }, current).values.maxResults, 15)
  assert.equal(coerceSettings({ maxResults: 'many' }, current).errors.length, 1)
})

test('enum settings reject values outside the list', () => {
  const current = defaultSettings()
  const bad = coerceSettings({ 'stats.adjust': 'sidak' }, current)
  assert.equal(bad.errors.length, 1)
  assert.equal(bad.values['stats.adjust'], 'holm')
  const good = coerceSettings({ 'stats.adjust': 'bonferroni' }, current)
  assert.equal(good.values['stats.adjust'], 'bonferroni')
})

test('enumList settings keep only known options and drop duplicates', () => {
  const current = defaultSettings()
  const result = coerceSettings({ sources: ['arxiv', 'arxiv', 'scopus'] }, current)
  assert.equal(result.errors.length, 1)
  const good = coerceSettings({ sources: 'arxiv,openalex' }, current)
  assert.deepEqual(good.values.sources, ['arxiv', 'openalex'])
})

test('a secret is stored as the name of an environment variable', () => {
  const current = defaultSettings()
  const bad = coerceSettings({ 'secrets.openalexKey': 'not a name!' }, current)
  assert.equal(bad.errors.length, 1)
  const good = coerceSettings({ 'secrets.openalexKey': 'OPENALEX_API_KEY' }, current)
  assert.equal(good.values['secrets.openalexKey'], 'OPENALEX_API_KEY')
  const previous = process.env.OPENALEX_API_KEY
  process.env.OPENALEX_API_KEY = 'secret-value'
  const resolved = resolveSecret(good.values, 'secrets.openalexKey')
  assert.equal(resolved.value, 'secret-value')
  assert.equal(resolved.present, true)
  if (previous === undefined) delete process.env.OPENALEX_API_KEY
  else process.env.OPENALEX_API_KEY = previous
})

test('the settings panel never shows a secret value', () => {
  const settings = { ...defaultSettings(), 'secrets.openalexKey': 'OPENALEX_API_KEY' }
  const previous = process.env.OPENALEX_API_KEY
  process.env.OPENALEX_API_KEY = 'secret-value'
  const rows = describeSettings(settings)
  const row = rows.find(item => item.key === 'secrets.openalexKey')
  assert.equal(row.secret, true)
  assert.equal(row.value, 'OPENALEX_API_KEY')
  assert.ok(!JSON.stringify(rows).includes('secret-value'))
  if (previous === undefined) delete process.env.OPENALEX_API_KEY
  else process.env.OPENALEX_API_KEY = previous
})

test('stored settings merge over the defaults', () => {
  const state = { settings: { maxResults: 30, 'qa.limit': 4 } }
  const settings = readSettings(state)
  assert.equal(settings.maxResults, 30)
  assert.equal(settings['qa.limit'], 4)
  assert.equal(settings.sources.length, 3)
  assert.equal(settings['runner.enabled'], false)
})

test('a corrupt stored value falls back to the default', () => {
  const settings = readSettings({ settings: { maxResults: 'lots' } })
  assert.equal(settings.maxResults, 15)
})

test('resetSettings returns the defaults', () => {
  assert.deepEqual(resetSettings(), defaultSettings())
})

test('image settings coerce: size default, apiKeyRef env-name only', () => {
  const current = defaultSettings()
  assert.equal(current['image.size'], '1536x1024')
  assert.equal(current['image.baseUrl'], '')
  assert.equal(current['image.model'], '')
  assert.equal(current['image.apiKeyRef'], '')
  const good = coerceSettings({ 'image.apiKeyRef': 'RD_IMAGE_KEY' }, current)
  assert.equal(good.values['image.apiKeyRef'], 'RD_IMAGE_KEY')
  const badRef = coerceSettings({ 'image.apiKeyRef': 'not a name!' }, current)
  assert.equal(badRef.errors.length, 1)
})


test('生图协议枚举只收三选一，默认 openai', () => {
  const current = defaultSettings()
  assert.equal(current['image.protocol'], 'openai')
  assert.equal(coerceSettings({ 'image.protocol': 'bailian' }, current).values['image.protocol'], 'bailian')
  const bad = coerceSettings({ 'image.protocol': 'other' }, current)
  assert.equal(bad.errors.length, 1)
  assert.equal(bad.values['image.protocol'], 'openai')
})

test('生图地址按协议归一化且只收 http(s)', () => {
  assert.deepEqual(normalizeImageBaseUrl('https://api.example.test/v1/images/generations/', 'openai'), { value: 'https://api.example.test/v1' })
  assert.deepEqual(normalizeImageBaseUrl('https://dash.test/api/v1/services/aigc/multimodal-generation/generation', 'bailian'), { value: 'https://dash.test' })
  assert.deepEqual(normalizeImageBaseUrl('https://dash.test/api/v1/tasks/123', 'wan'), { value: 'https://dash.test' })
  assert.match(normalizeImageBaseUrl('ftp://example.test', 'openai').error, /http/)
  const current = defaultSettings()
  const bad = coerceSettings({ 'image.baseUrl': 'ftp://example.test' }, current)
  assert.equal(bad.errors.length, 1)
})

test('生图附加参数只收 JSON 对象，quality 走普通字符串', () => {
  const current = defaultSettings()
  const good = coerceSettings({ 'image.extra': '{"style":"vivid"}', 'image.quality': 'hd' }, current)
  assert.equal(good.errors.length, 0)
  assert.equal(good.values['image.extra'], '{"style":"vivid"}')
  assert.equal(good.values['image.quality'], 'hd')
  for (const value of ['not json', '[1,2]', 'null']) {
    const bad = coerceSettings({ 'image.extra': value }, current)
    assert.equal(bad.errors.length, 1)
  }
})

test('image.apiKeyRef secret never leaks its environment value in exports', () => {
  const settings = { ...defaultSettings(), 'image.apiKeyRef': 'RD_TEST_IMAGE_KEY' }
  const previous = process.env.RD_TEST_IMAGE_KEY
  process.env.RD_TEST_IMAGE_KEY = 'super-secret-image-key'
  const resolved = resolveSecret(settings, 'image.apiKeyRef')
  assert.equal(resolved.present, true)
  assert.equal(resolved.value, 'super-secret-image-key')
  const rows = describeSettings(settings)
  const row = rows.find(item => item.key === 'image.apiKeyRef')
  assert.equal(row.secret, true)
  assert.equal(row.value, 'RD_TEST_IMAGE_KEY')
  assert.ok(!JSON.stringify(rows).includes('super-secret-image-key'))
  assert.ok(!JSON.stringify(settings).includes('super-secret-image-key'))
  if (previous === undefined) delete process.env.RD_TEST_IMAGE_KEY
  else process.env.RD_TEST_IMAGE_KEY = previous
})

test('image.source 默认值为自动，coerce 接受三档并拒绝未知值', () => {
  const def = SETTING_DEFS.find(row => row.key === 'image.source')
  assert.ok(def, 'image.source 定义必须存在')
  assert.equal(def.type, 'enum')
  assert.deepEqual(def.options, ['auto', 'http', 'tool'])
  assert.equal(def.default, 'auto')
  assert.equal(defaultSettings()['image.source'], 'auto')
  assert.equal(readSettings({ settings: {} })['image.source'], 'auto')
  for (const value of ['auto', 'http', 'tool']) {
    const res = coerceSettings({ 'image.source': value }, defaultSettings())
    assert.deepEqual(res.errors, [], value)
    assert.equal(res.values['image.source'], value)
    if (value === 'auto') assert.ok(!res.changed.includes('image.source'), value)
    else assert.ok(res.changed.includes('image.source'), value)
  }
  const bad = coerceSettings({ 'image.source': 'cloud' }, defaultSettings())
  assert.equal(bad.errors.length, 1)
  assert.equal(bad.values['image.source'], 'auto')
})