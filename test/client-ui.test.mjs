// Phase2 UI contract assertions for lib/client.js (source-level; no browser DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = await readFile(join(root, 'lib', 'client.js'), 'utf8')

test('four-zone testids and empty-state copy present', () => {
  for (const id of ['collab-goal', 'collab-stage', 'collab-needs-decision', 'collab-timeline', 'collab-overview', 'collab-decisions']) {
    assert.ok(src.includes("'data-testid': '" + id + "'"), 'missing testid ' + id)
  }
  assert.ok(src.includes('这里记录科灵在虚空里带队的每一次虚拟实验：看目标、看过程、看结果，需要时你拍板'))
})

test('all 8 contract collab_* actions are called by the UI', () => {
  for (const name of ['collab_create', 'collab_list', 'collab_step', 'collab_plan', 'collab_decision_ask', 'collab_decision_answer', 'collab_run', 'collab_evaluate']) {
    assert.ok(src.includes(name), 'missing action ' + name)
  }
})

test('contract field names and reverse index used, not renamed', () => {
  for (const k of ['experimentIds', 'collabByExperiment', 'pending === true', 'collaborations', 'kelinRole', 'autonomy']) {
    assert.ok(src.includes(k), 'missing field ' + k)
  }
})

test('three on-demand triggers are clickable affordances', () => {
  for (const t of ['让科灵验证', '验证这个论点', '交给科灵验证']) {
    assert.ok(src.includes(t), 'missing trigger ' + t)
  }
})

test('lab total entry preserved and collab view dispatched', () => {
  assert.ok(src.includes("['lab', '虚空']"))
  assert.ok(src.includes("view === 'collab' ? collabView"))
  assert.ok(src.includes("'在虚空里验证'"))
})

test('void space: no object Object leak and md-seg role controls', () => {
  assert.ok(!/collabTerm\([^)]*\)\s*\+/.test(src), 'collabTerm must be a child, not string-concatenated')
  assert.ok(src.includes('md-collab-gear-row'), 'missing gear row')
  assert.ok(src.includes("role: 'radiogroup'"), 'missing md-seg radiogroup')
  assert.ok(src.includes('md-collab-body'), 'missing unified body wrapper')
  assert.ok(src.includes('md-hero-copy'), 'missing hero copy wrapper')
})

test('Phase3 evaluation flows back into content workflow as draft', () => {
  assert.ok(src.includes('回流成草稿'), 'missing flow-back button label')
  assert.ok(src.includes('flowBackToDraft'), 'missing flow-back helper')
  assert.ok(src.includes("action: 'draft', instruction: instruction"), 'draft action not wired with instruction')
})

test('void space: advanced lab embeds inline and quick tasks keep gutters', () => {
  assert.ok(src.includes("className: 'md-lab-embed', key: 'lab'"), 'labView root must be inline embed, not md-board-page')
  assert.ok(src.includes('.md-lab-embed{display:block;position:relative'), 'missing inline embed CSS')
  assert.ok(src.includes('.md-collab .md-desk-tasks{padding:0 16px 16px}'), 'quick task cards must keep tile gutters')
  assert.ok(!src.includes("className: 'md-board-page', key: 'lab'"), 'labView must not be a full-page absolute container')
})