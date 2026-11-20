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
  assert.ok(src.includes("view === 'lab' ? collabView"))
  assert.ok(!src.includes("view === 'collab' ? collabView"), 'no duplicate collab dispatch')
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

test('tool-call frames are forwarded by both host streams', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  const matches = host.match(/c && c\.type === 'tool-call-delta'/g) || []
  assert.equal(matches.length, 2, 'both chat_stream and collab_stream onStream must detect tool-call-delta')
  // chatStream 用 toolText 变量渲染工具帧（还要累积 toolTrace），collabStream 仍内联；两种写法都算
  const writes = host.match(/(?:const toolText = |text: )'调用工具 ' \+ String\(c\.name/g) || []
  assert.equal(writes.length, 2, "both streams must emit humanized tool text with kind:'tool'")
  assert.ok(host.includes("toolTrace.push(toolText)"), 'chatStream must accumulate tool trace for persistence')
  assert.ok(host.includes("slice(0, 300)"), 'humanized tool text must truncate args')
})

test('tool frames are consumed by lab, collab and chat delta handlers', () => {
  assert.ok(src.includes("ev.kind === 'tool' ? 'tool'"), 'lab console must tag tool frames with k=tool')
  assert.ok((src.match(/t: ev\.text \|\| ''/g) || []).length >= 2, 'console lines must render server-authored humanized text')
  // both console consumers contain ev.kind==='tool'
  const kindChecks = src.match(/ev\.kind === 'tool'/g) || []
  assert.ok(kindChecks.length >= 2, 'both lab and collab delta consumers must branch on ev.kind')
  // chat accumulates to a separate toolTrace array
  assert.ok(src.includes("let toolTrace = []"), 'chat must keep a separate toolTrace accumulator')
  assert.ok(src.includes("ev.type === 'delta' && ev.kind === 'tool'"), 'chat delta handler must detect tool frames')
  assert.ok(src.includes("toolTrace = toolTrace.concat([ev.text || ''])"), 'chat must push humanized tool text into toolTrace')
  assert.ok(src.includes("toolTrace: toolTrace.slice()"), 'done must attach toolTrace to the ai message')
  assert.ok(src.includes("className: 'md-tooltrace', key: 'tooltrace'"), 'chat must render a collapsible tooltrace details block')
})

test('tool trace CSS classes exist', () => {
  assert.ok(src.includes('.md-lab-console .is-tool{color:#4176e6}'), 'console tool lines need a distinct style')
  assert.ok(src.includes('.md-tooltrace>summary{cursor:pointer'), 'tooltrace summary must be a collapsible toggle')
})

test('void-space run button ships lab code to the collab_run executor', () => {
  const line = src.split('\n').find(l => l.includes("'在虚空里跑实验'"))
  assert.ok(line, 'run button not found')
  assert.ok(line.includes('code: labDraft.code'), 'run button must pass labDraft.code to collab_run')
  assert.ok(line.includes("runtime: labDraft.runtime || 'python'"), 'run button must pass runtime')
  assert.ok(line.includes('先在实验台写一段验证代码，再点跑实验。'), 'empty-code guard toast missing')

  assert.ok(!/\{ title: collabGoalText\(selectedCollab\) \}/.test(line), 'run button must not send only title')
})

test('permission gate turns internal perm id into plain language (R4)', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  assert.ok(host.includes("const PERM_LABELS = { 'read-only': '仅可查看', 'workspace-write': '工作区修改', 'danger-full-access': '完全权限' }"), 'server-side PERM_LABELS missing')
  const line = host.split('\n').find(l => l.includes('申请的权限档「'))
  assert.ok(line, 'permission message not found')
  assert.ok(line.includes('PERM_LABELS[wantedPerm]'), 'wantedPerm must go through the label map')
  assert.ok(line.includes("PERM_LABELS['read-only']"), 'current tier must be plain language too')
  assert.ok(!/wantedPerm\s*\+\s*'/.test(line), 'bare enum id must not be concatenated into human text')
  assert.ok(line.includes("'自定义权限档'"), 'unknown tier fallback missing')
  assert.ok(line.includes('decisionId') && line.includes('collabId: targetId'), 'boundary id fields must stay')
})

test('both agent stream handlers accumulate usage frames before done', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  assert.equal((host.match(/const t0 = Date\.now\(\)/g) || []).length, 2, 'each handler needs its own start time')
  assert.equal((host.match(/let usageAcc = \{ input: 0, output: 0, total: 0 \}/g) || []).length, 2, 'each handler needs its own accumulator')
  assert.equal((host.match(/if \(c && c\.type === 'usage' && c\.usage\)/g) || []).length, 2, 'both handlers must read usage frames')
  assert.equal((host.match(/usageAcc\.input \+= \(Number\(c\.usage\.inputTokens\) \|\| 0\)/g) || []).length, 2, 'both handlers accumulate input tokens')
  assert.equal((host.match(/usageAcc\.output \+= \(Number\(c\.usage\.outputTokens\) \|\| 0\)/g) || []).length, 2, 'both handlers accumulate output tokens')
  assert.equal((host.match(/usageAcc\.total \+= \(Number\(c\.usage\.totalTokens\) \|\| 0\)/g) || []).length, 2, 'both handlers accumulate total tokens')
})

test('both done frames carry server-composed usageText; elapsed always, tokens only when real', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  assert.equal((host.match(/const elapsedMs = Date\.now\(\) - t0/g) || []).length, 2, 'elapsed computed in both handlers')
  assert.equal((host.match(/let usageText = '耗时 '/g) || []).length, 2, 'plain-language usage string composed server-side twice')
  assert.ok(host.includes("if (usageAcc.input + usageAcc.output > 0) usageText +="), 'token text must be gated on real usage')
  assert.ok(host.includes("(usageAcc.total ? ' · 合计 ' + n(usageAcc.total) : '')"), 'total tokens optional')
  assert.ok(host.split('\n').some(l => l.includes('const n = v => String(v).replace(')), 'thousands separator formatter missing')
  const chatDone = host.split('\n').find(l => l.includes("stream.write('done'") && l.includes("action: 'chat'"))
  const collabDone = host.split('\n').find(l => l.includes("stream.write('done'") && l.includes("action: 'collab_stream'"))
  assert.ok(chatDone && chatDone.includes('usageText'), 'chat done must carry usageText')
  assert.ok(collabDone && collabDone.includes('usageText'), 'collab done must carry usageText')
  assert.ok(!/\busageText\s*=/.test(src), 'client must not compute usageText (server computes only)')
})

test('chat and collab consumers store the precomputed usageText and render it', () => {
  assert.ok(src.includes('reasoningAcc || toolTrace.length || ev.usageText'), 'chat done must handle ev.usageText')
  const at = src.indexOf('reasoningAcc || toolTrace.length || ev.usageText')
  assert.ok(src.slice(at, at + 700).includes('usageText: String(ev.usageText)'), 'chat message must store server value verbatim')
  const collabDone = src.split('\n').find(l => l.includes("else if (ev.type === 'done')") && l.includes('ev.collabId'))
  assert.ok(collabDone && collabDone.includes('ev.usageText'), 'collab done must surface usageText')
  const renderLine = src.split('\n').find(l => l.includes("className: 'md-msg-ai'"))
  assert.ok(renderLine && renderLine.includes('m.usageText'), 'AI message render must show stored usageText')
  assert.ok(renderLine.includes("'md-muted'"), 'usageText must use the existing muted class')
})

test('per-answer copy button reuses clipboard with execCommand fallback, no is-primary', () => {
  const renderLine = src.split('\n').find(l => l.includes("className: 'md-msg-ai'"))
  assert.ok(renderLine, 'AI message render line not found')
  assert.ok(renderLine.includes("label: '复制这条回答'"), 'per-answer copy affordance missing')
  assert.ok(renderLine.includes("icon: 'copy'"), 'copy icon must be reused')
  assert.ok(renderLine.includes("String(m.text || '')"), 'copy must take this message text')
  assert.ok(renderLine.includes('navigator.clipboard.writeText(text)'), 'clipboard API path missing')
  assert.ok(renderLine.includes("document.execCommand('copy')"), 'execCommand fallback missing for insecure context')
  assert.ok(renderLine.includes("notify('已复制回答')"), 'success feedback missing')
  const at = renderLine.indexOf("label: '复制这条回答'")
  assert.ok(!renderLine.slice(at, at + 1100).includes('is-primary'), 'dock icon button must not be is-primary (R3)')
  assert.ok(src.includes('function F(props)'), 'existing F helper must be reused')
  assert.ok(src.includes("copy:'M9 9h10v11H9zM5 15V4h10'"), 'existing copy icon must be reused')
})
test("dock collapse button aligns to top-right of title", () => {
  assert.ok(src.includes(".md-root .md-dock-head h2 + .md-icon-btn { margin-left: auto; }"), "dock close button must be pushed to right edge")
  assert.ok(src.includes(".md-dock-head { flex: none; display: flex; align-items: center;"), "dock head must be flex row with vertical centering")
  const dhAt = src.indexOf("'data-window-drag': '', key: 'dh'")
  const region = src.slice(dhAt, dhAt + 400)
  assert.ok(region.indexOf("'科灵'") < region.indexOf("label: '收起对话'"), "title before close button")
})

test('set_draft_status is fully wired server-side (ACTIONS/method/whitelist/schema)', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  const desk = readFileSync(new URL('../lib/desk.mjs', import.meta.url), 'utf8')
  assert.ok(desk.includes("export const DRAFT_STATUS = ['idea', 'outline', 'draft', 'ready', 'published']"), 'server whitelist must exist')
  assert.ok(desk.includes("status: 'dstatus'"), 'draft field whitelist must carry status')
  assert.ok(desk.includes("case 'dstatus': return DRAFT_STATUS.includes(value) ? value : undefined"), 'coerce must validate draft status')
  assert.ok(desk.includes("case 'set_draft_status':"), 'applyOps must handle set_draft_status')
  assert.ok(desk.includes('已把草稿《'), 'receipt text must be composed server-side')
  assert.ok(host.includes("'set_draft_status'"), 'action must be in ACTIONS')
  assert.ok(host.includes('async setDraftStatus'), 'service method must exist')
  assert.ok(host.includes("case 'set_draft_status': return await svc.setDraftStatus(payload)"), 'switch must dispatch the action')
  assert.ok(host.includes("store.mutate('更新成稿状态'"), 'status must be persisted through store.mutate')
  assert.ok(host.includes('DRAFT_STATUS.includes(status)'), 'method must validate status against whitelist')
  assert.ok(host.includes("status: row.status || 'draft'"), 'libraryView must surface persisted draft status')
  const schema = host.slice(host.indexOf('const PARAMETERS = {'), host.indexOf('const DESCRIPTION = ['))
  assert.ok(schema.includes("id: { type: 'string'"), 'schema must expose id')
  const statusSchema = schema.split('\n').find(l => l.trim().startsWith('status: { type: \'string\''))
  assert.ok(statusSchema, 'schema must expose status')
  for (const s of ['idea', 'outline', 'draft', 'ready', 'published']) assert.ok(statusSchema.includes("'" + s + "'"), 'status enum missing ' + s)
})

test('publish-lens drag persists via set_draft_status, not localStorage-only', () => {
  assert.ok(src.includes("action: 'set_draft_status', id, status: sid"), 'onDrop must call the server action')
  const dropAt = src.indexOf("action: 'set_draft_status', id, status: sid")
  assert.ok(dropAt >= 0, 'onDrop call site not found')
  const region = src.slice(dropAt, dropAt + 400)
  assert.ok(region.includes('.then(') && region.includes('applyLibrary(d)'), 'onDrop must apply server-returned library')
  assert.ok(region.includes('.catch(err => setToast('), 'onDrop must surface errors as toast')
  const afterRegion = src.slice(dropAt, dropAt + 200)
  assert.ok(!afterRegion.includes('setContentStatus('), 'published draft drag must not fall back to localStorage after server call')
  const adapt = src.split('\n').find(l => l.includes("(library.drafts || []).map(x => ADAPT("))
  assert.ok(adapt && adapt.includes("status: x.status || contentStatus[x.id] || 'draft'"), 'ADAPT must prefer server draft status, localStorage only fallback')
  assert.ok(!(adapt && adapt.includes("status: 'draft', source: '写作'")), 'draft status must not be hardcoded')
})

test('schedule page has page head and a single 科灵 primary action; streak is real not hardcoded', () => {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // 排期页改为文字型 md-page，带页头 + hero + 唯一主行动（不再是裸 md-board-page）
  const svAt = src.indexOf("const scheduleView = h('div', { className: 'md-page'")
  assert.ok(svAt > 0, 'scheduleView must be a text-type md-page')
  const sv = src.slice(svAt, svAt + 1800)
  assert.ok(sv.includes("className: 'md-page-head'"), 'schedule page must have a page head')
  assert.ok(sv.includes("'排期'"), 'schedule page head must title 排期')
  assert.ok(sv.includes('md-i-hero') && sv.includes('nextHint'), 'schedule hero must show 科灵 next-step hint')
  assert.equal((sv.match(/is-primary/g) || []).length, 1, 'schedule page must have exactly one primary action')
  assert.ok(sv.includes('让科灵安排节奏'), 'primary action must be a 科灵 verb')
  // 无 TDZ：scheduleView 必须定义在 nextHint 之后
  const nhAt = src.indexOf('const nextHint =')
  assert.ok(nhAt > 0 && svAt > nhAt, 'scheduleView must be defined after nextHint (no TDZ)')
  // streak 两处 hero 写死 '0' 已改为真实 streak
  const heroStreaks = src.split('\n').filter(l => l.includes("className: 'md-hero-streak'") && l.includes(' 天。'))
  assert.equal(heroStreaks.length, 2, 'two hero 连续记录-天 badges exist')
  assert.ok(heroStreaks.every(l => l.includes('String(streak)')), 'both streak-day badges show real streak, not hardcoded 0')
  assert.ok(!heroStreaks.some(l => l.includes("}, '0')")), 'no streak-day badge hardcodes 0')
})

test('custom style actually applies and note capture stores text', () => {
  const styleLine = src.split('\n').find(l => l.includes('ALL_STYLES.concat(customStyles).find'))
  assert.ok(styleLine, 'send() must resolve custom styles, not only presets')
  const depsLine = src.split('\n').find(l => l.includes('[busy, fullCount, applyLibrary, activeStyle, customStyles,'))
  assert.ok(depsLine, 'send() deps must include customStyles so newly added styles take effect')
  const noteLine = src.split('\n').find(l => l.includes("value: captureText, onChange: e => setCaptureText(e.target.value)"))
  assert.ok(noteLine, 'note textarea must bind captureText state')
  assert.ok(!noteLine.includes('papers[0]'), 'note textarea must not fake-prefill with a paper title')
})

test('collab has a single tab mapping and dead view code is gone', () => {
  assert.ok(!src.includes("setView('collab')"), 'no跳转到不存在的 collab Tab')
  assert.ok(!src.includes("view === 'collab' ? collabView"), 'no duplicate collab dispatch branch')
  assert.ok(src.includes("view === 'lab' ? collabView : styleView"), 'single lab→collabView dispatch remains')
  for (const name of ['feed', 'notesView', 'planView', 'contentView']) {
    assert.ok(!src.includes('const ' + name + ' ='), 'dead code ' + name + ' should be removed')
  }
  assert.ok(src.includes("['lab', '虚空']"), '虚空 lab tab retained')
})

test('human approval resumes collab only when approve clears all pending decisions', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  // 服务端算好 needResume 信号：approve 且无其它 pending 才续跑
  assert.ok(host.includes("const needResume = choice === 'approve' && !stillPending"), 'server must gate resume on approve + no pending')
  assert.ok(host.includes('needResume, resumeMessage:'), 'server must return needResume + human resumeMessage to client')
  assert.ok(host.includes('status: stillPending ? \'waiting-human\' : \'active\''), 'status must stay waiting-human while other decisions pending')
  // 客户端只渲染人话 + 触发既有续跑路径（不改 agent 编排）
  assert.ok(src.includes('needResume = !!(d && d.needResume)'), 'client must read server resume signal')
  assert.ok(src.includes('if (needResume) collabLead(resumeGoal, collabId)'), 'client must call existing collabLead resume path')
  assert.ok(src.includes('resumeGoal = collabGoalText(row)'), 'client must reuse collab goal for resume')
})

test('schedule hero has bottom spacing before calendar area', () => {
  const svAt = src.indexOf("const scheduleView = h('div', { className: 'md-page'")
  const heroLine = src.slice(svAt, svAt + 400).split('\n').find(l => l.includes("key: 'hero'"))
  assert.ok(heroLine && heroLine.includes('marginBottom: 24'), 'schedule hero must have bottom margin so it does not touch calendar area')
})

test('chat reasoning/toolTrace/usageText persist across library rebuild', () => {
  // 客户端重建必须携带服务端持久化的三字段（刷新后恢复的来源）
  const aiLine = src.split('\n').find(l => l.includes("rebuilt.push({ role: 'ai', text: String(row.a)"))
  assert.ok(aiLine, 'applyLibrary must rebuild ai message from chat row')
  for (const field of ['row.reasoning', 'row.toolTrace', 'row.usageText', 'row.at']) {
    assert.ok(aiLine.includes(field), 'applyLibrary ai row must carry ' + field)
  }
  assert.ok(aiLine.includes('Array.isArray(row.toolTrace)'), 'toolTrace must be guarded as array')
  // 服务端必须把三字段落库
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  const persistLine = host.split('\n').find(l => l.includes("verified: 0, reasoning: reasoningAcc, toolTrace: toolTrace.slice(), usageText"))
  assert.ok(persistLine, 'chat_stream must persist reasoning/toolTrace/usageText into chat row')
  assert.ok(host.includes("reasoningAcc += c.text") && host.includes('toolTrace.push(toolText)'), 'server must accumulate reasoning and tool trace')
  // desk.mjs 迁移对旧记录补空字段，不破坏历史 chat
  const desk = readFileSync(new URL('../lib/desk.mjs', import.meta.url), 'utf8')
  assert.ok(desk.includes("out.reasoning = ''"), 'migrate must backfill reasoning on old chat rows')
  assert.ok(desk.includes("out.toolTrace = out.toolTrace ?"), 'migrate must backfill toolTrace on old chat rows')
  assert.ok(desk.includes("out.usageText = ''"), 'migrate must backfill usageText on old chat rows')
})
test('chat sessions: server actions, mirror sync, and dock session bar are wired', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  const desk = readFileSync(new URL('../lib/desk.mjs', import.meta.url), 'utf8')
  for (const a of ['chat_list', 'chat_new', 'chat_switch', 'chat_rename', 'chat_delete']) {
    assert.ok(host.includes("'" + a + "'"), 'host ACTIONS must contain ' + a)
    assert.ok(host.includes("action: '" + a + "'"), 'host must return human message for ' + a)
  }
  assert.ok(desk.includes('chats: []'), 'emptyState must include chats array')
  assert.ok(desk.includes("activeChatId: ''"), 'emptyState must include activeChatId')
  assert.ok(desk.includes('export function syncActiveChat'), 'desk must export syncActiveChat')
  const syncCount = (host.match(/syncActiveChat\(draft\)/g) || []).length
  assert.ok(syncCount >= 9, 'all chat write points must call syncActiveChat(draft), got ' + syncCount)
  assert.ok(src.includes("action: 'chat_new'") && src.includes("action: 'chat_switch'"), 'client must call chat_new/chat_switch')
  assert.ok(src.includes("action: 'chat_rename'") && src.includes("action: 'chat_delete'"), 'client must call chat_rename/chat_delete')
  assert.ok(src.includes("className: 'md-chatbar'"), 'dock must render chat session bar')
  assert.ok(src.includes('chatMenuOpen') && src.includes('renameChatId'), 'dock must have session menu + rename state')
  assert.ok(src.includes('(library.chats || [])'), 'session bar must read chats from library (server), not local state')
})

test('chat sessions bar matches dock theme, has visible labels and distinguishable titles', () => {
  const bar = src.slice(src.indexOf('const CHATBAR_CSS = ['), src.indexOf('function injectStyles'))
  assert.ok(bar.includes('var(--card)') && bar.includes('var(--ink)'), 'chatbar must use .md-root theme tokens (--card/--ink)')
  assert.ok(!/#(fff|f1f5f9|e2e8f0|cbd5e1|e4eaf2)/i.test(bar), 'chatbar must not hardcode light color fallbacks')
  assert.ok(!bar.includes('--dsw-alias-'), 'chatbar must not bypass dock theme via --dsw-alias variables')
  assert.ok(src.includes("onClick: chatNewOp }, [I({ name: 'plus', size: 14 }), '新建'])"), 'new-session button must show a visible 新建 label')
  const desk = readFileSync(new URL('../lib/desk.mjs', import.meta.url), 'utf8')
  assert.ok(desk.includes('function autoTitleChat(row)'), 'server must auto-name sessions from first question')
  assert.ok(desk.includes('  autoTitleChat(row)\n'), 'syncActiveChat must apply auto-title on message write')
  assert.ok(desk.includes('state.chats.forEach(autoTitleChat)'), 'migration must name legacy 新对话 sessions')
})


