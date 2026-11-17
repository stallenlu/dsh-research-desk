// Tests for the settings module.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SETTING_DEFS,
  coerceSettings,
  defaultSettings,
  describeSettings,
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