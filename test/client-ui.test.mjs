// Phase2 UI contract assertions for lib/client.js (source-level; no browser DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
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
  for (const t of ['让科灵验证', '验证这个论点', '虚空验证']) {
    assert.ok(src.includes(t), 'missing trigger ' + t)
  }
})

test('topics and content tabs merged into one research desk with dual lenses', () => {
  assert.ok(src.includes("['research', '选题']"), 'NAV must have single research entry')
  assert.ok(!src.includes("['topics', '选题']") && !src.includes("['content', '内容']"), 'old two tabs must be gone')
  assert.ok(src.includes("view === 'research' ? researchView"), 'dispatch must route to researchView')
  assert.ok(src.includes("const researchView = h('div'"), 'researchView must exist')
  assert.ok(src.includes("'验证视角'") && src.includes("'发布视角'"), 'dual lens seg must exist')
  assert.ok(src.includes('同一条选题：验证视角看验证结论'), 'plain-language disambiguation must be on screen')
  assert.ok(src.includes("action: 'set_hypothesis_status'"), 'verify-lens drag must call the new action')
  assert.ok(src.includes('写作: '), 'publish-lens cards must prefix writing dimension')
  assert.ok(!src.includes("status: 'outline', source: '选题'"), 'hypothesis must not be hardcoded to outline')
})
test('NAV order follows the product funnel: 灵感→资料→选题→虚空→文风→排期→复盘', () => {
  const m = src.match(/const NAV = (\[.*\])/)
  assert.ok(m, 'NAV declaration not found')
  const ids = [...m[1].matchAll(/\['([a-z]+)', '[^']+'\]/g)].map(x => x[1])
  assert.deepEqual(ids, ['home', 'discover', 'research', 'lab', 'style', 'schedule', 'insights'])
})
test('set_hypothesis_status action is fully wired in host', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  assert.ok(host.includes("'set_hypothesis_status'"), 'action must be in ACTIONS')
  assert.ok(host.includes('async setHypothesisStatus'), 'service method must exist')
  assert.ok(host.includes('HYPOTHESIS_STATUS.includes(status)'), 'status must be enum-validated')
  assert.ok(host.includes("id: { type: 'string', description: 'Hypothesis id"), 'schema must expose id')
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


test('insights hero follows the discover/void page paradigm', () => {
  assert.ok(src.includes("className: 'md-page', key: 'insights'"), 'insights root must be md-page')
  assert.ok(src.includes("className: 'md-page-head', key: 'ph'"), 'insights needs page head')
  assert.ok(src.includes('md-i-line') && src.includes('正在成形'), 'insights hero headline missing')
  assert.ok(src.includes('科灵把你记下的灵感、资料与文献'), 'insights hero needs md-muted explainer')
  assert.ok(src.includes('md-insights-toolshead'), 'system actions must live in a secondary row')
  assert.ok(src.includes('md-metrics'), 'metrics strip on insights hero')
})

test('collab verify button uses target icon, not raw CJK text', () => {
  assert.ok(src.includes("key: 'askcollab', className: 'md-ctool',"), 'verify button must be plain md-ctool icon button')
  assert.ok(src.includes("I({ name: 'target', size: 13 })"), 'verify button needs target icon')
  assert.ok(!src.includes("'交给科灵验证'"), 'raw text label must be gone')
})
test('high-impact papers use the same card row as to-read list', () => {
  assert.ok(src.includes("const topLi = (p) => h('div', { className: 'md-desk-feed-row', key: p.id }"), 'topLi must be feed-row card, not ol rank list')
  assert.ok(src.includes("className: 'md-desk-feed-list', key: 'l' }, topPapers.map(topLi)"), 'top list container must be feed-list')
  assert.ok(!src.includes("className: 'md-top-rank', key: 'r'"), 'legacy big rank span must be gone')
  assert.ok(src.includes('.md-i-top .md-desk-feed-row .md-top-title{flex:1;min-width:0}'), 'feed-row title needs ellipsis CSS')
  assert.ok(src.includes('.md-i-top .md-desk-feed-list{flex:1;min-height:0;overflow-y:auto'), 'top feed list must scroll internally')
})

test('dsh-ui spec guard actually rejects malformed cards and passes good ones', () => {
  const fm = src.match(/function isValidGenuiSpec\(spec\) \{[\s\S]*?\n    \}/)
  assert.ok(fm, 'guard function source not found')
  const cm = src.match(/const GENUI_TYPES = [^\n]*\n    const GENUI_TONES = [^\n]*/)
  assert.ok(cm, 'guard constants not found')
  const guardFn = new Function(cm[0] + '\n' + fm[0] + '\nreturn isValidGenuiSpec')()
  const bad = { title: 'x', gap: 12, items: [{ type: 'callout', content: 'a', tone: 'warning' }], type: 'stack', children: [{ type: 'steps', items: [{ label: 'x', status: 'done' }] }] }
  const good = { title: 'x', gap: 12, items: [{ type: 'steps', steps: ['a', 'b'] }, { type: 'callout', content: 'c', tone: 'success' }] }
  assert.equal(guardFn(bad), false, 'mixed-DSL card from the report must be rejected')
  assert.equal(guardFn(good), true, 'well-formed card must pass')
  assert.ok(src.includes('if (!isValidGenuiSpec(spec)) { setFailed(true); return }'), 'guard must run before mount')
  assert.ok(src.includes('卡片渲染失败，已收起原始内容'), 'fallback must use friendly copy')
  assert.ok(src.includes("h('details', { key: 'd' }"), 'fallback must collapse raw JSON')
  assert.ok(!src.includes("h('pre', { className: 'md-genui-fallback' }, raw)"), 'raw JSON must not be dumped directly')
})

test('reasoning frames are streamed, accumulated and rendered collapsibly', () => {
  assert.ok(src.includes('let reasoningAcc = \'\''), 'send must accumulate reasoning frames')
  assert.ok(src.includes('if (ev.reasoning) reasoningAcc += ev.text'), 'delta handler must collect reasoning text')
  assert.ok(src.includes("k: ev.reasoning ? 'reason' :"), 'lab console must tag reasoning frames')
  assert.ok(src.includes("className: 'md-reason', key: 'reason'"), 'chat must render a collapsible reasoning block')
  assert.ok(src.includes('.md-reason>summary{cursor:pointer'), 'reasoning summary must be a collapsible toggle')
  assert.ok(src.includes('is-reason'), 'console reasoning lines need a distinct style')
})
test('boundary copy is plain-language, home surfaces next step, decision point humanized', () => {
  assert.ok(src.includes('这里的边界你要知道'), 'boundary facts must be reworded in user perspective')
  assert.ok(!src.includes('代码不会外传数据'), 'false security guarantee must be removed')
  assert.ok(!src.includes('由服务端从假设状态同步'), 'internal sync mechanism must be hidden')
  assert.ok(src.includes("PERM_LABELS[permMode] || '自定义'"), 'raw perm id fallback must be humanized')
  assert.ok(src.includes('高风险动作（装包、发包等）仍需在决策区拍板'), 'permission copy must scope high-risk to decision zone')
  assert.ok(src.includes('const nextHint ='), 'next-step hint must be computed once')
  assert.ok(src.includes('科灵建议的下一步：'), 'home hero must surface next step in plain words')
  assert.ok(src.includes('让科灵把灵感长成选题'), 'home hero must have a single Kelin-facing primary action')
  assert.ok(src.includes("'交给科灵，到选题发布视角挑一个进成稿工作室', 'publish'"), 'draft suggestion must route to publish lens')
  assert.ok(src.includes("ev.status === 'waiting-human' ?"), 'done toast must not claim completion when awaiting human')
  assert.ok(!src.includes("'开始带队…（' + ev.collabId + '）'"), 'prepared line must not leak raw collab id')
  assert.ok(src.includes('const humanDecisionText ='), 'decision point must be humanized before display')
  assert.ok(src.includes("install: '安装依赖包（会联网）'"), 'risk:install: must map to plain-language label')
  assert.ok(src.includes('humanDecisionText(d.point)'), 'decision zone must render humanized point')
})