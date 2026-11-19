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
  assert.ok(src.includes('这里记录科灵带队的每一次虚拟实验合作，你可以看目标、过程、结果，并在需要时拍板'))
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
  assert.ok(src.includes("['lab', '合作空间']"))
  assert.ok(src.includes("view === 'collab' ? collabView"))
})

test('Phase3 evaluation flows back into content workflow as draft', () => {
  assert.ok(src.includes('回流成草稿'), 'missing flow-back button label')
  assert.ok(src.includes('flowBackToDraft'), 'missing flow-back helper')
  assert.ok(src.includes("action: 'draft', instruction: instruction"), 'draft action not wired with instruction')
})