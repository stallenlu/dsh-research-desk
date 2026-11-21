// Phase2 UI contract assertions for lib/client.js (source-level; no browser DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = await readFile(join(root, 'lib', 'client.js'), 'utf8')

test('image settings page exists with plain-language key/billing copy', () => {
  assert.ok(src.includes("settingsPage === 'image'"), 'image settings page branch must exist')
  assert.ok(src.includes('生图配置'), 'image settings entry label missing')
  assert.ok(src.includes('环境变量名，不是密钥本身'), 'secretRef label must say env-var-name not the key')
  assert.ok(src.includes('密钥不写进科灵台、不随导出带走；生图按张计费'), 'plain-language key/billing tip missing')
  assert.ok(src.includes("r.key.indexOf('image.') === 0"), 'image settings rows must be rendered')
})

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
  assert.ok(src.includes("F({ key: 'new', icon: 'plus', label: '新建对话'") && src.includes("F({ key: 'find', icon: 'search', label: '找历史对话'"), 'new/find buttons must be icon-only F buttons with tooltip labels')
  const desk = readFileSync(new URL('../lib/desk.mjs', import.meta.url), 'utf8')
  assert.ok(desk.includes('function autoTitleChat(row)'), 'server must auto-name sessions from first question')
  assert.ok(desk.includes('  autoTitleChat(row)\n'), 'syncActiveChat must apply auto-title on message write')
  assert.ok(desk.includes('state.chats.forEach(autoTitleChat)'), 'migration must name legacy 新对话 sessions')
})

test('assistant talk language: explicit choice wins; host档 truly follows DSH locale bridge', () => {
  const eff = src.slice(src.indexOf('function effectiveLang('), src.indexOf('function isIdentityChat('))
  assert.ok(eff.includes("if (localeId === 'en') return 'en'"), 'explicit English choice must still be honored')
  assert.ok(eff.includes("if (localeId === 'zh') return 'zh'"), 'explicit Chinese choice must be honored')
  assert.ok(eff.includes("return hostLang === 'en' ? 'en' : 'zh'"), 'host档 must follow the DSH host language, with a safe Chinese fallback')
  assert.ok(!/navigator\.language/.test(eff) && !/documentElement\.lang/.test(eff), 'no static html lang / browser-locale detection that misreads lang=en')
  assert.ok(src.includes('globalThis.__DSH_LOCALE__') && src.includes('.read()'), 'a bridge effect must read the authoritative DSH locale signal')
  assert.ok(src.includes("bridge.onChange"), 'bridge effect must subscribe to later DSH language switches')
  assert.ok(src.includes("effectiveLang(localeId, hostLang)"), 'both send and suggestion call sites must pass hostLang')
  assert.ok(src.includes("? ['梳理这个主题的综述'") && src.includes("? ['你能做什么'"), 'suggestion lists keep their Chinese branches')
})

test('L3 会话卡只渲染服务端算好的 summary/tags/outcomes，缺省优雅降级', () => {
  assert.ok(src.includes("const summary = String(c.summary || '')"), 'card must read server summary')
  assert.ok(src.includes("const tags = Array.isArray(c.tags) ? c.tags : []"), 'card must read server tags')
  assert.ok(src.includes("const outcomes = Array.isArray(c.outcomes) ? c.outcomes : []"), 'card must read server outcomes')
  assert.ok(src.includes('md-chatcard-title') && src.includes('md-chatcard-summary'), 'card must render title + summary lines')
  assert.ok(src.includes('md-chatcard-pill') && src.includes('OUTCOME_CLASS'), 'card must render colored outcome pills')
  assert.ok(src.includes('md-chatcard-tag'), 'card must render topic tags')
  assert.ok(src.includes('chatRelativeTime(c.updatedAt || c.createdAt)'), 'card must show humanized relative time')
  assert.ok(src.includes("(c.title || '新对话') + '（' + (c.messageCount || 0) + '）'"), 'missing fields degrade to legacy title + count')
})

test('L3 找历史入口只发 chat_search，results 原样渲染并可切换会话', () => {
  assert.ok(src.includes("icon: 'search', label: '找历史对话'"), 'chatbar must expose a 找历史 entry as F icon button + tooltip')
  assert.ok(src.includes("action: 'chat_search'"), 'search must call chat_search action')
  assert.ok(src.includes('setChatSearchResults(results)'), 'client must render server results verbatim')
  assert.ok(src.includes('visibleChatSearchResults.length'), 'search results list must be rendered (scope-filtered)')
  assert.ok(src.includes('onClick: () => openSearchHit(r)'), 'clicking a result must reuse openSearchHit (switch then locate)')
})

test('L3 会话卡与搜索样式仍走语义 token，无浅色兜底 HEX', () => {
  const bar = src.slice(src.indexOf('const CHATBAR_CSS = ['), src.indexOf('function injectStyles'))
  assert.ok(bar.includes('.md-chatsearch'), 'search panel CSS must live in CHATBAR_CSS')
  assert.ok(bar.includes('color-mix(in srgb, var(--accent)'), 'outcome pill colors must derive from theme tokens')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(bar), 'new chatbar CSS must not introduce any hardcoded HEX color')
  assert.ok(!bar.includes('--dsw-alias-'), 'must not bypass dock theme tokens')
})

test('L1 会话历史三字段由服务端现算并在各处落盘/透出/可搜', () => {
  const desk = readFileSync(new URL('../lib/desk.mjs', import.meta.url), 'utf8')
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  // 1) enrichChat 为导出纯函数，含中文注释
  assert.ok(desk.includes('export function enrichChat(row)'), 'desk must export enrichChat(row)')
  assert.ok(/\/\*|\/\//.test(desk.slice(desk.indexOf('export function enrichChat'), desk.indexOf('export function enrichChat') + 200)), 'enrichChat must carry a comment')
  // 2) syncActiveChat 写消息后调用 enrichChat(row)
  assert.ok(desk.includes('  enrichChat(row)\n'), 'syncActiveChat must call enrichChat(row) after messages normalized')
  // 3) migrate 惰性回填
  assert.ok(desk.includes('state.chats.forEach(enrichChat)'), 'migrate must backfill summary/tags/outcomes lazily')
  // 4) libraryView 透出三字段（含安全空值）
  assert.ok(/summary:\s*c\.summary\s*\|\|\s*''/.test(host), 'libraryView must expose summary with safe default')
  assert.ok(/tags:\s*Array\.isArray\(c\.tags\)/.test(host), 'libraryView must expose tags with safe default')
  assert.ok(/outcomes:\s*Array\.isArray\(c\.outcomes\)/.test(host), 'libraryView must expose outcomes with safe default')
  // 5) chat_search 在 ACTIONS 与 switch、schema 描述中登记
  assert.ok(/ACTIONS[\s\S]*?'chat_search'/.test(host), 'chat_search must be registered in ACTIONS')
  assert.ok(host.includes("case 'chat_search':"), 'chat_search must have a dispatch case')
  assert.ok(host.includes('chatSearch(args)'), 'chat_search must have a service method')
  assert.ok(/action=search and chat_search|chat_search =/.test(host), 'schema must describe chat_search')
})

test('L2 跨会话相关历史注入：服务端算人话、跳过当前会话、diag 自证钩子', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  const helperZone = host.slice(host.indexOf('// L2 跨会话检索的停用词'), host.indexOf('function memoryBlock('))
  // 1) 纯函数辅助：关键词抽取 + 相关度打分，带中文注释与停用词
  assert.ok(/function questionKeywords\(/.test(helperZone), 'must have deterministic keyword extractor')
  assert.ok(/function chatRelevanceScore\(/.test(helperZone), 'must have relevance scorer')
  assert.ok(/中文按 2-4 字滑窗|长中文串按 2\/3\/4 字滑窗/.test(helperZone), 'helper must document Chinese word segmentation')
  assert.ok(/KEYWORD_STOP_EN/.test(helperZone) && /KEYWORD_STOP_ZH/.test(helperZone), 'stopword sets for both languages must exist')
  assert.ok(/时间衰减/.test(helperZone) && /0\.6/.test(helperZone), 'time decay with old-value floor must exist')
  // 2) memoryBlock 本体：消费当前问题、遍历 state.chats、跳过 activeChatId、注入人话段
  const mb = host.slice(host.indexOf('function memoryBlock('), host.indexOf('function extractText('))
  assert.ok(/args\.question|args\.query/.test(mb), 'memoryBlock must consume the current question')
  assert.ok(/state\.chats/.test(mb), 'memoryBlock must scan state.chats across sessions')
  assert.ok(/c\.id !== state\.activeChatId/.test(mb), 'must skip the active session to avoid duplication')
  assert.ok(/相关历史对话（来自其他会话，供理解上下文，非硬约束）/.test(mb), 'must inject human-readable history section')
  assert.ok(/沉淀物：/.test(mb) && /标签：/.test(mb), 'history line must carry outcomes and tags')
  assert.ok(/HISTORY_CHAR_CAP/.test(mb) && /1400/.test(helperZone), 'history section must enforce a char cap')
  assert.ok(/\.slice\(-8\)/.test(mb), 'recent dialogue must be kept but shortened to 8')
  assert.ok(/最近对话：/.test(mb) && /在跟选题：/.test(mb) && /文献库/.test(mb), 'existing profile/topic/paper sections must stay')
  // 3) KELIN_CHAT_SYSTEM 语义未被改动：记忆只是背景，不是硬约束
  assert.ok(host.includes('但记忆只是背景，不是硬约束——对方问通用问题时正常用通用能力回答。'), 'system semantics must stay untouched')
  // 4) diag 自证钩子：at=memory + 三个历史统计字段
  assert.ok(/at: 'memory'/.test(host), 'diag hook must emit at=memory')
  for (const k of ['historySessions', 'historyChars', 'historyTitles']) {
    assert.ok(host.includes(k), 'diag hook must carry ' + k)
  }
  assert.ok(/statsOut\.historySessions/.test(mb) && /statsOut\.historyChars/.test(mb), 'memoryBlock must fill diag stats')
  // 5) 未引入客户端断言，也不碰 client.js（L2 块只读 host 源码，不引用 client.js 源变量 src）
  const l2 = host.slice(host.indexOf("test('L2 跨会话相关历史注入"))
  assert.ok(!l2.includes('src.includes') && !l2.includes('client.js'), 'L2 block must not add client.js assertions')
})

test('L4 画像蒸馏：会话标记触发人话提示，profileUpdated 只触发可见反馈', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  assert.ok(host.includes('[[KELIN_PROFILE]]'), 'server system prompt must instruct model to emit profile marker')
  assert.ok(src.includes('ev.profileUpdated'), 'client must consume the server profileUpdated signal')
  assert.ok(src.includes('科灵把画像蒸馏好了'), 'distillation feedback must be a plain-language notice')
  assert.ok(!/profileUpdated[\s\S]{0,160}?(innerHTML|dangerouslySetInnerHTML)/.test(src), 'feedback must not inject raw HTML')
})

test('L4 画像可纠：三组 chips 逐条可删、可追加，整组提交 update_profile', () => {
  assert.ok(src.includes('const editProfile = async next =>'), 'must have a single write helper for profile')
  assert.ok(src.includes("action: 'update_profile'"), 'must call the Chief-provided thin action')
  assert.ok(src.includes('focus: Array.isArray(next.focus)') && src.includes('sources: Array.isArray(next.sources)') && src.includes('habits: Array.isArray(next.habits)'), 'all three groups submitted together as string arrays')
  assert.ok(src.includes('...payload') && src.includes('applyLibrary(d)'), 'write result must rebuild library from server response')
  assert.ok(src.includes('const profileGroups = [') && src.includes("['focus', '关注方向'") && src.includes("['sources', '常用来源'") && src.includes("['habits', '研究习惯'"), 'three named profile groups with plain-language labels')
  assert.ok(src.includes('md-profile-chip-x') && src.includes("'移除' + String(x)"), 'each chip has an accessible remove button')
  assert.ok(src.includes('arr.filter((_, j) => j !== i)'), 'remove sends the whole group minus one item')
  assert.ok(src.includes('arr.concat([add])') && src.includes('arr.length >= 40'), 'add appends one item with a sane cap')
  assert.ok(src.includes("'清空画像'") && src.includes('focus: [], sources: [], habits: []'), 'clear-all sends empty arrays for every group')
})

test('L4 画像空数组可删净：客户端不本地补回缺省值', () => {
  const normalized = src.replace(/\s+/g, ' ')
  assert.ok(normalized.includes('arr.filter((_, j) => j !== i)'), 'last-item removal must go through with an empty group')
  assert.ok(!/next\.focus\s*\|\|/.test(src) && !/next\.sources\s*\|\|/.test(src) && !/next\.habits\s*\|\|/.test(src), 'write helper must not fall back to old array on empty input')
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  assert.ok(host.includes("case 'update_profile':"), 'host must register the thin action (Chief-owned)')
})

test('L4 画像 UI 样式走语义 token，无硬编码 HEX / --dsw-alias', () => {
  const css = src.slice(src.indexOf('const SMARTDESK_CSS = ['), src.indexOf('function call('))
  assert.ok(css.includes('.md-desk-profile-edit') && css.includes('.md-profile-chip-x'), 'profile edit styles live in SMARTDESK_CSS')
  assert.ok(css.includes('color-mix(in srgb,var(--primary)'), 'chip colors derive from theme tokens')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.slice(css.indexOf('/* L4 画像蒸馏与纠错 */'))), 'new L4 CSS must not introduce hardcoded HEX')
  assert.ok(!css.includes('--dsw-alias-'), 'must not bypass dock theme tokens')
})
test('C+E 语义召回：粗召回补位 + 同义词表 + 一行候选清单交给 LLM 自判', () => {
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  const helperZone = host.slice(host.indexOf('// L2 跨会话检索的停用词'), host.indexOf('function memoryBlock('))
  assert.ok(/KEYWORD_SYNONYMS/.test(helperZone) && /function expandSynonyms\(/.test(helperZone), 'must have research synonym table + expander')
  assert.ok(/代号/.test(helperZone) && /别名/.test(helperZone) && /命名/.test(helperZone), 'synonyms must cover alias/naming relations')
  assert.ok(!/咖啡|作息|手冲/.test(helperZone), 'synonym table must NOT include life words, to keep semantic test falsifiable')
  assert.ok(/C 方案/.test(helperZone) && /HISTORY_CANDIDATE_CAP = 12/.test(helperZone), 'must have coarse-recall candidate cap')
  const mb = host.slice(host.indexOf('function memoryBlock('), host.indexOf('function extractText('))
  assert.ok(/expandSynonyms\(questionKeywords\(question\)\)/.test(mb), 'keywords must be expanded through synonym table')
  assert.ok(/\.slice\(0, HISTORY_CANDIDATE_CAP\)/.test(mb), 'coarse recall must cap at candidate limit')
  assert.ok(/picked\.length < HISTORY_CANDIDATE_CAP/.test(mb) && /byRecent/.test(mb), 'zero-hit sessions must be backfilled by recency')
  assert.ok(/请自行判断哪些与当前问题相关，无关项忽略/.test(mb), 'header must delegate relevance judgment to the answering LLM')
  assert.ok(!/filter\(x => x\.score > 0\)[\s\S]{0,120}\.slice\(0, 4\)/.test(mb), 'must not keep the old hard top4 cutoff')
  assert.ok(/沉淀物：/.test(mb) && /标签：/.test(mb), 'one-line candidates must still carry plain-language outcomes/tags')
})

test('模型列表加载失败可重试，面板不误导显示科灵模型', () => {
  assert.ok(/const \[modelsStatus, setModelsStatus\] = useState\('loading'\)/.test(src), 'must track model load status')
  assert.ok(/const loadModels = useCallback\(async \(\) =>/.test(src), 'must have a reusable loadModels helper')
  assert.ok(/setSettingsPage\('model'\); loadModels\(\)/.test(src), 'opening the model page must reload the list')
  assert.ok(/modelsStatus === 'error'/.test(src) && src.includes('md-model-retry') && src.includes('重新读取'), 'failed load must offer a retry button')
  assert.ok(/modelsStatus === 'loading' \? '正在读取可用模型…'/.test(src), 'loading state must show honest loading copy')
  assert.ok(!src.includes("'科灵模型'"), 'fallback label must not pretend a 科灵模型 exists')
})
test('顶栏自检按钮：探活后端后就地重载，不重启主进程', () => {
  assert.ok(src.includes('const doSelfReload = useCallback'), 'must have a self-reload callback')
  assert.ok(src.includes("action: 'status'"), 'self-reload must probe backend liveness')
  assert.ok(src.includes('window.location.reload()'), 'self-reload must reload the webview in place')
  assert.ok(src.includes("key: 'selfreload', icon: 'bolt'"), 'self-reload must use bolt icon to avoid duplicate icons')
  assert.ok(src.includes('自检并就地重载'), 'self-reload button must carry a plain-language tooltip')
})
test('后端路由竞态：404 自动重试一次并把失败真相留痕，不只弹裸 HTTP 404', () => {
  assert.ok(src.includes('async function call(payload, attempt)'), 'call must accept attempt counter for retry')
  assert.ok(src.includes('res.status === 404 && tries === 0'), 'first 404 recognized as cold-start race')
  assert.ok(src.includes('setTimeout(r, 700)'), 'retry must wait 700ms like the official steward plugin')
  assert.ok(src.includes('return call(payload, tries + 1)'), 'retry must recurse with incremented attempt')
  assert.ok(src.includes('recordHostDiag'), 'requests must leave a diagnostic trail')
  assert.ok(src.includes('rd.hostDiag'), 'diagnostics persist to localStorage for self-check')
  assert.ok(src.includes('后端路由没挂上'), 'persistent 404 must show a plain-language cause')
  assert.ok(src.includes('baseURI'), 'diagnostic must capture the real page base')
})
test('装饰开关诚实化：识图已接入、协作已接入，权限标当前只读', () => {
  assert.ok(src.includes("className: 'md-ctool md-ctool-vision' + (images.length") && !src.includes('识图·未接入'), 'vision button must be enabled and no longer labeled 未接入')
  assert.ok(src.includes('让科灵看这张图') && src.includes('选图片给科灵看'), 'vision tooltip must explain how to use real image recognition')
  assert.ok(src.includes('智能体团队协作') && src.includes('已接入'), 'teamCollab must be shown as connected (real capability)')
  assert.ok(src.includes('md-settings-tip') && src.includes('靶心按钮'), 'teamCollab tip must point to the target button')
  assert.ok(src.includes("' · 当前只读'"), 'perm row must show it currently runs read-only')
  assert.ok(src.includes('不会立刻提权'), 'perm tip must say selecting a higher tier does not escalate')
  assert.ok(src.includes('高风险动作（装包、发包等）仍需在决策区拍板'), 'perm copy must scope high-risk to decision zone')
})

test('search-hit: 围栏内词也定位、单选自动跳、多条上一处/下一处导航', () => {
  assert.ok(src.includes("const [searchHitTerm, setSearchHitTerm] = useState('')"), 'search-hit state present')
  assert.ok(src.includes('const [hitNav, setHitNav] = useState({ index: 0, total: 0 })'), 'multi-hit nav state present')
  assert.ok(src.includes('ref: dockRef'), 'dock ref attached to scroll container')
  assert.ok(src.includes('const openSearchHit = useCallback(async (r, termOverride) =>'), 'unified open-hit callback present')
  assert.ok(src.includes('await chatSwitchOp(r.id)') && src.includes('setSearchHitTerm(term)'), 'waits for chat switch before setting hit term (no stale-msgs race)')
  assert.ok(src.includes('results.length === 1 && results[0] && results[0].id) openSearchHit(results[0], query)'), 'single hit auto-jumps to the matched session')
  assert.ok(src.includes("'data-hit': (searchHitTerm && String(m.text || '').indexOf(searchHitTerm) !== -1 ? '1' : '')"), 'data-hit uses raw message text so fenced-block terms match too')
  assert.ok(src.includes('querySelectorAll(') && src.includes('[data-hit='), 'effect queries all raw-text hits')
  assert.ok(src.includes('const idx = Math.min(hitNav.index, hits.length - 1)') && src.includes("target.classList.add('is-hit')"), 'effect highlights the indexed hit and scrolls to it')
  assert.ok(src.includes('target.scrollIntoView'), 'effect scrolls the hit into view')
  assert.ok(src.includes("className: 'md-hitnav'") && src.includes('上一处') && src.includes('下一处'), 'multi-hit nav UI with prev/next')
  assert.ok(src.includes("'命中 ' + hitNav.total + ' 处 · 第 ' + (hitNav.index + 1) + ' 处'"), 'nav label shows hit count and current index')
  assert.ok(src.includes('.md-msg.is-hit{') && src.includes('rd-hit-pulse'), 'highlight CSS uses semantic accent with pulse')
  assert.ok(/\.md-hitnav\{[^}]*position:sticky/.test(src), 'hit-nav bar is sticky so prev/next stays visible while scrolling hits')
})

test('搜索范围：默认搜全部会话，可勾选多个会话限定搜索结果', () => {
  assert.ok(src.includes('selectedSearchChats'), 'must track selected search-scope chat ids')
  assert.ok(src.includes('setSelectedSearchChats(null)') && src.includes("'全部'"), 'must offer an 全部 (all chats) option')
  assert.ok(src.includes('visibleChatSearchResults'), 'results must be filtered by selected scope before rendering')
  assert.ok(src.includes('selectedSearchChats.has(String(x && x.id))'), 'filter must match result chat ids against selection')
  assert.ok(src.includes('toggleSearchChat(c.id)') && src.includes('md-chatsearch-chip'), 'each chat must be a toggleable scope chip')
  assert.ok(src.includes('!selectedSearchChats && results.length === 1'), 'auto-jump only when scope is 全部, so scoped searches show the list first')
})

test('识图前端：识图按钮可用、不再标注未接入', () => {
  assert.ok(!src.includes("'识图·未接入'"), 'vision button text must not say 未接入')
  assert.ok(!src.includes('识图（尚未接入）'), 'vision aria-label must not say 尚未接入')
  assert.ok(!src.includes('图片识别还没接入'), 'vision title must not say not connected')
  assert.ok(src.includes("key: 'vision'") && src.includes("md-ctool-vision"), 'vision button must exist')
  assert.ok(src.includes("className: 'md-ctool md-ctool-vision' + (images.length"), 'vision button must not be hardcoded disabled')
  assert.ok(src.includes('visionInputRef.current && visionInputRef.current.click()'), 'vision button must open the image picker')
  assert.ok(src.includes("accept: 'image/png,image/jpeg,image/webp,image/gif'"), 'hidden image input must accept image types only')
  assert.ok(src.includes('FileReader') && src.includes('readAsDataURL'), 'images must be read as base64 data URL')
  assert.ok(src.includes('images: imagePayload'), 'send payload must carry images')
  assert.ok(src.includes('library.activeChatId])') && src.includes(', images, rdDocs,'), 'send deps must include images')
})

test('会话归属：发送前把服务端 activeChatId 对齐到界面显示的会话，避免回答落进旧会话', () => {
  assert.ok(src.includes("action: 'chat_switch', id: targetChatId"), 'send must re-assert server active chat to the chat shown in UI')
  assert.ok(src.includes('const targetChatId = library && library.activeChatId'), 'target must be the UI-shown active chat')
  assert.ok(src.includes("await call({ action: 'chat_switch', id: targetChatId })"), 'align must await before chat_stream sends (avoid race)')
  assert.ok(src.includes('library.activeChatId])'), 'send deps must include activeChatId so the aligned callback is fresh')
})

// 成稿页原生适配：媒体视频语义 → 科研写作语义（保留双栏/Bento/hero/进度/chips 骨架）
test('成稿页 studioView 已替换为科研写作语义，媒体视频语义清零', () => {
  const start = src.indexOf("const studioView = h('div'")
  assert.ok(start > 0, 'studioView must exist')
  const cssAt = src.indexOf('const CHAT_MD_CSS', start)
  const studio = src.slice(start, cssAt > 0 ? cssAt : start + 6000)
  for (const stale of ['分镜头脚本', '约 15 秒', '生成图片', '脚本骨架', '风格 · 默认', '一键成稿', '正在成稿']) {
    assert.ok(!studio.includes(stale), 'studioView must not contain stale media/video copy: ' + stale)
  }
  for (const fresh of ['写作脉络', '让科灵写成初稿', '科灵写成初稿', '研究快报', '从提纲、证据链到引用核验']) {
    assert.ok(studio.includes(fresh), 'studioView must contain research-writing copy: ' + fresh)
  }
  assert.ok(!src.includes('studioImages'), 'studioImages dead control and state must be gone')
})

test('成稿页体裁段是无障碍 radiogroup，主行动唯一且为 is-primary', () => {
  const start = src.indexOf("const studioView = h('div'")
  const cssAt = src.indexOf('const CHAT_MD_CSS', start)
  const studio = src.slice(start, cssAt > 0 ? cssAt : start + 6000)
  assert.ok(studio.includes("className: 'md-seg', role: 'radiogroup', 'aria-label': '成稿体裁'"), 'md-seg must be an accessible radiogroup labeled 成稿体裁')
  assert.equal((studio.match(/role: 'radio'/g) || []).length, 2, 'both genre buttons must be role=radio')
  assert.equal((studio.match(/'aria-checked':/g) || []).length, 2, 'both genre buttons must expose aria-checked')
  assert.equal((studio.match(/is-primary/g) || []).length, 1, 'studio must have exactly one primary action')
  assert.ok(studio.includes("className: 'md-pill is-primary'"), 'primary action must reuse md-pill is-primary')
  assert.ok(studio.includes("className: 'md-pill'"), 'verify action must be a secondary md-pill')
})

test('成稿页默认体裁为 article，后端 ask 调用链保持不变', () => {
  assert.ok(src.includes("const [studioFormat, setStudioFormat] = useState('article')"), 'default genre must be article/短文')
  assert.ok(src.includes("(studioFormat === 'article' ? '短文' : '研究快报')"), 'draftStudio ask prompt must keep 短文/研究快报 mapping verbatim')
  assert.ok(src.includes("'基于这份草稿继续修改（'+t+'）：'+studioDraft"), 'refineStudio ask prompt must stay verbatim')
  assert.ok(src.includes("'初稿 ' + studioDraft.length + ' 字'"), 'hero word count must come from real studioDraft.length')
})

// 粘贴附件：对齐 DSH 原生会话——Ctrl+V 把图/文件放到输入框上方，纯文本照常输入
test('粘贴入口：textarea 有 onPaste，仅剪贴板带文件时拦截，纯文本照常输入', () => {
  assert.ok(src.includes('onPaste: onComposerPaste'), 'textarea must wire the paste handler')
  assert.ok(src.includes("const onComposerPaste = e => {"), 'paste handler must exist')
  assert.ok(src.includes("const dt = e.clipboardData || (e.nativeEvent && e.nativeEvent.clipboardData)"), 'paste handler must read clipboardData')
  assert.ok(src.includes("const clipboardFiles = dataTransfer => {"), 'must extract File entries through a dedicated clipboard reader')
  assert.ok(src.includes("if (!it || it.kind !== 'file') continue"), 'non-file clipboard items (text/html) must be skipped')
  assert.ok(src.includes("if (!out.length && dataTransfer.files && dataTransfer.files.length)"), 'must fall back to dataTransfer.files')
  const handler = src.slice(src.indexOf("const onComposerPaste = e => {"), src.indexOf('const removeImage = id =>'))
  const returnAt = handler.indexOf('if (!files.length) return')
  const preventAt = handler.indexOf('e.preventDefault()')
  assert.ok(returnAt > 0 && preventAt > returnAt, 'plain-text paste must NOT be prevented: early return comes before preventDefault')
})

test('粘贴分流：图片进识图队列、文档进资料登记、不支持类型给克制提示', () => {
  assert.ok(src.includes("const intakeFiles = fileList => {"), 'must route pasted files by type')
  assert.ok(src.includes("if (IMAGE_MIME.indexOf(mt) >= 0) { imageFiles.push(f); continue }"), 'images must route to the image queue')
  assert.ok(src.includes("if (DOC_EXT[ext]) { docFiles.push(f); continue }"), 'documents must route to the pending-doc queue')
  assert.ok(src.includes("if (imageFiles.length) pickImages(imageFiles)"), 'image branch must feed pickImages')
  assert.ok(src.includes("if (docFiles.length) {"), 'doc branch must register docs as pending and stage their bytes')
  assert.ok(src.includes("ingestRdDocs(docFiles, true)"), 'doc branch must register docs as pending')
  assert.ok(src.includes("setPendingFiles(prev => added.concat(prev))"), 'doc branch must stage byte payloads into pendingFiles')
  assert.ok(src.includes("这类文件暂时放不进来，可用图片或 PDF / Word / PPT / Excel / txt / md。"), 'unsupported types must get one restrained plain-language hint')
  assert.ok(src.includes("...(markPending ? { composerPending: true } : {})"), 'pending marker must be added without changing the doc row shape')
})

test('附件条位置：图片缩略图与文件卡片都在输入框上方（对齐原生 DOM 顺序）', () => {
  const formAt = src.indexOf("h('form', { className: 'md-composer md-composer-native'")
  const textareaAt = src.indexOf("h('textarea', { key: 'ta'", formAt)
  const previewsAt = src.indexOf("h('div', { className: 'md-vision-previews'", formAt)
  const fileCardAt = src.indexOf("className: 'md-file-card'", formAt)
  assert.ok(formAt > 0 && textareaAt > formAt, 'composer form and textarea must exist')
  assert.ok(previewsAt > formAt && previewsAt < textareaAt, 'attachment rail must be rendered BEFORE the textarea, not below it')
  assert.ok(fileCardAt > previewsAt && fileCardAt < textareaAt, 'file cards must live inside that rail, above the textarea')
  assert.ok(src.includes("(images.length || rdDocs.some(x => x.composerPending))"), 'rail must show only when something is pending')
})

test('两阶段预览：选中即 blob 缩略图，发送才读字节，移除/完成释放 URL', () => {
  assert.ok(src.includes("previewUrl: (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(file) : ''"), 'selection must create a blob preview URL immediately')
  assert.ok(src.includes("src: img.previewUrl || ('data:' + img.mediaType + ';base64,' + img.data)"), 'thumbnail must prefer the blob URL, fall back to base64')
  assert.ok(src.includes("revokeObjectURL(hit.previewUrl)"), 'removeImage must revoke the blob URL')
  assert.ok(src.includes("images.forEach(x => { if (x.previewUrl && typeof URL !== 'undefined' && URL.revokeObjectURL)"), 'completed send must revoke all preview URLs')
  assert.ok(src.includes("h('button', { type: 'button', className: 'md-vision-remove'"), 'each attachment must carry a remove button')
  assert.ok(src.includes("onClick: () => removeRdDoc(doc.id)"), 'file cards must be removable')
  assert.ok(src.includes("setRdDocs(prev => prev.filter(x => x.id !== id))"), 'removeRdDoc must actually drop the row')
  assert.ok(src.includes("setPendingFiles(prev => prev.filter(x => x.name !== doc.name))"), 'removing a file card must also drop its staged bytes')
})

test('文件附件随消息发送：pendingFiles 字节入 payload，done 清理，移除同步', () => {
  assert.ok(src.includes("const [pendingFiles, setPendingFiles] = useState([])"), 'staged file bytes must be a dedicated non-persisted state')
  assert.ok(src.includes("const readFileBase64 = f => new Promise((resolve, reject) => {"), 'file bytes must be read via FileReader')
  assert.ok(src.includes("reader.readAsDataURL(f)"), 'file bytes must come from readAsDataURL')
  assert.ok(src.includes("resolve(i >= 0 ? s.slice(i + 1) : s)"), 'dataURL prefix must be stripped before staging')
  assert.ok(src.includes("files: (pendingFiles || []).map(x => ({ name: x.name, data: x.data })),"), 'chat_stream payload must carry staged file bytes')
  assert.ok(src.includes("setPendingFiles([])"), 'done must clear staged bytes so they are sent once')
  const payloadBlock = src.slice(src.indexOf('files: (pendingFiles'), src.indexOf('rules: (rules'))
  assert.ok(!payloadBlock.includes("'data:'"), 'file payload must never carry a data: prefix')
  assert.ok(src.includes("onChange: e => { intakeFiles(e.target.files); e.target.value = '' } }),"), 'main file input must route through intakeFiles so selected files show above the composer')
})

test('识图 payload：发送时读出的 data 是纯 base64，不带 data: 前缀', () => {
  assert.ok(src.includes("const readImageBase64 = img => new Promise(resolve => {"), 'byte reading must happen at send time')
  assert.ok(src.includes("resolve(comma >= 0 ? raw.slice(comma + 1) : '')"), 'must strip the dataURL prefix before sending')
  assert.ok(src.includes("const imagePayload = await Promise.all((images || []).map(async x => ({ name: x.name, mediaType: x.mediaType, data: await readImageBase64(x) })))"), 'send must await real bytes before building payload')
  assert.ok(src.includes("images: imagePayload,"), 'payload must carry the resolved image bytes')
  const block = src.slice(src.indexOf('const imagePayload ='), src.indexOf('images: imagePayload,'))
  assert.ok(!block.includes("'data:'"), 'image payload must never contain a data: prefix')
})

test('文件卡片：扩展徽标+文件名+大小，复用语义 class 且不新增硬编码色值', () => {
  assert.ok(src.includes("className: 'md-file-badge'"), 'card must show an extension badge')
  assert.ok(src.includes("String(doc.type || 'file').toUpperCase().slice(0, 4)"), 'badge must show the uppercase extension')
  assert.ok(src.includes("className: 'md-file-name'"), 'card must show the file name')
  assert.ok(src.includes("className: 'md-file-size'"), 'card must show the file size')
  const cssStart = src.indexOf("'.md-file-card{")
  assert.ok(cssStart > 0, 'file-card CSS must be defined')
  const cssEndName = src.indexOf("'.md-file-size{", cssStart)
  const cssEnd = src.indexOf("',\n", cssEndName)
  const css = src.slice(cssStart, cssEnd)
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'new card CSS must use semantic tokens, not hardcoded hex')
})

test('靠左修正：.md-composer-native 覆盖基类 align-items:flex-end，附件/输入条左对齐', () => {
  const at = src.indexOf('.md-composer-native{')
  assert.ok(at > 0, 'native composer rule must exist')
  const end = src.indexOf('}', at)
  const rule = src.slice(at, end)
  assert.ok(rule.includes('align-items:stretch'), 'column-direction cross axis is horizontal: must override inherited align-items:flex-end with stretch so the rail/textarea/tools align left')
  assert.ok(rule.includes('flex-direction:column'), 'native composer must remain a column flex layout')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule), 'CSS fix must not introduce hardcoded hex')
})

// ---- 批次1+2 client 侧 UI 契约：footer / 盾牌 / 命令目录 / 靠左回归 / 零新增 hex ----
const js = src

test('批次1 assistant footer: h(footer) 在正文下方，复制与用量仍在，m.at 时渲染 md-msg-time', () => {
  const aiAt = js.indexOf("h('div', { className: 'md-msg-ai', key: 'ai' }")
  assert.ok(aiAt > 0, 'assistant md-msg-ai block must exist')
  const block = js.slice(aiAt, js.indexOf('\n', aiAt))
  const footerAt = block.indexOf("h('footer', { key: 'foot' },")
  assert.ok(footerAt > 0, 'assistant message must render a real h(footer)')
  const bodyAt = block.indexOf('renderRichText(p.text)')
  assert.ok(bodyAt > 0 && bodyAt < footerAt, 'footer must sit after the splitFences body, below the message')
  assert.ok(block.indexOf("key: 'copy'") > footerAt, 'copy F must be moved into the footer')
  assert.ok(block.indexOf("key: 'usage'") > footerAt, 'usage div.md-muted must be moved into the footer')
  assert.ok(block.includes("m.at ? h('span', { className: 'md-msg-time', key: 'time' }, chatRelativeTime(m.at)) : null"), 'md-msg-time must render only when m.at exists')
  assert.ok(block.includes("key: 'reason'") && block.includes("key: 'tooltrace'"), 'reasoning/toolTrace details must remain')
  assert.ok(block.includes('navigator.clipboard.writeText(text)') && block.includes("document.execCommand('copy')"), 'clipboard+textarea fallback logic must remain untouched')
  const cssFooterAt = js.indexOf('.md-msg footer { display: flex;')
  assert.ok(cssFooterAt > 0, 'dead .md-msg footer CSS rule must be reused')
  assert.ok(js.slice(cssFooterAt, cssFooterAt + 180).includes('justify-content: space-between'), 'footer must split left copy / right usage·time')
})

test('批次1 composer 工具行有可见盾牌 indicator，文案含「当前只读」且只进权限页', () => {
  const toolsAt = js.indexOf("h('div', { className: 'md-composer-tools'")
  assert.ok(toolsAt > 0, 'composer tools row must exist')
  const block = js.slice(toolsAt, toolsAt + 3600)
  assert.ok(block.includes("key: 'permind'"), 'shield/perm indicator must live in the composer tools row')
  assert.ok(block.includes("' · 当前只读'"), 'indicator text must contain 当前只读')
  assert.ok(block.includes("I({ name: 'gear', size: 12 })"), 'must reuse existing gear icon, no new SVG')
  assert.ok(block.includes("setSettingsPage('perm'); setSettingsPanelOpen(v => !v)"), 'click must open perm settings page, never elevate')
  assert.ok(block.includes('不会立刻提权'), 'perm wording must preserve 选更高档只是记下偏好/不会立刻提权')
  assert.ok(js.includes('默认只能查看。选更高档只是记下你的偏好，不会立刻提权：科灵每次调用工具仍要你在决策区点头，实际按只读运行；高风险动作（装包、发包等）仍需在决策区拍板。'), 'settings perm tip must stay verbatim')
})

test('模型胶囊 onClick 直达 model 页做模型快切，不回 root', () => {
  const line = src.split('\n').find(l => l.includes("className: 'md-ctool md-ctool-model md-settings-trigger'"))
  assert.ok(line, '模型胶囊按钮缺失')
  assert.ok(line.includes("setSettingsPage('model')"), '点开须直达 model 页')
  assert.ok(line.includes('loadModels()'), '点开须刷新可用模型列表')
  assert.ok(line.includes('setSettingsPanelOpen(v => !v)'), '点开仍须切换浮层开合')
  assert.ok(!line.includes("setSettingsPage('root')"), '不得再回 root 页，模型快切须直达')
})

test('盾牌 indicator onClick 仍只进权限页，不提权', () => {
  const line = src.split('\n').find(l => l.includes("key: 'permind'"))
  assert.ok(line, '盾牌 indicator 缺失')
  assert.ok(line.includes("setSettingsPage('perm'); setSettingsPanelOpen(v => !v)"), '盾牌须保持进权限页')
})

test('齿轮 onClick 仍在根层开独立对话框，不碰 dock', () => {
  const gear = src.split('\n').find(l => l.includes("key: 'gear', icon: 'gear', label: '设置'"))
  assert.ok(gear, '顶栏齿轮按钮缺失')
  assert.ok(gear.includes("setSettingsPage('root')"), '齿轮须复位 root 页')
  assert.ok(gear.includes('setSettingsDialogOpen(true)'), '齿轮须开独立对话框')
  assert.ok(!gear.includes('setDockOpen'), '齿轮不得碰 dock 开合')
})

test('settingsBody() 仍恰好两处复用（浮层 + 对话框）', () => {
  const calls = (src.match(/settingsBody\(\)/g) || []).length
  assert.equal(calls, 2, 'settingsBody() 须恰好两处调用，实际=' + calls)
})

test('批次2 +号命令目录：渲染 status.commands，只读 action 直接 call，写 action 只填提示', () => {
  assert.ok(js.includes("const READONLY_CMDS = ['status', 'models', 'settings', 'stats', 'library', 'history', 'experiments', 'collab_list']"), 'read-only action whitelist must be explicit')
  assert.ok(js.includes("const r = await call({ action: 'status' })") && js.includes('Array.isArray(r && r.commands) ? r.commands : []'), 'catalog must read commands from status response')
  assert.ok(js.includes("F({ key: 'cmdcatalog', icon: 'plus', size: 13, className: 'md-ctool', label: '命令目录', onClick: openCommandMenu })"), 'composer + button must be distinct from top new-chat plus')
  assert.ok(js.includes("cmdCatalog.filter(function (c) { return c && c.action }).map(function (c, ci)"), 'every listed item must map to a real action')
  assert.ok(js.includes("className: 'md-chatmenu md-cmdmenu'") && js.includes('cmdMenuOpen ? h('), 'overlay must reuse md-chatmenu visual syntax')
  assert.ok(js.includes("style: { left: '0', right: 'auto', width: '272px', top: 'auto', bottom: 'calc(100% + 4px)', maxHeight: 'min(320px, calc(100vh - 120px))' }"), 'cmdmenu must flip upward (top:auto + bottom:calc(100% + 4px)) overriding base top:100%, and clamp maxHeight with calc(100vh')
  assert.ok(js.includes('if (READONLY_CMDS.indexOf(act) >= 0) {'), 'write actions must never be called directly')
  assert.ok(js.includes('【需参数】') && js.includes('不会直接执行，请补全后自行发送'), 'write/param actions must only fill a marked hint into composer')
  const toolsAt = js.indexOf("h('div', { className: 'md-composer-tools'")
  const block = js.slice(toolsAt, toolsAt + 4200)
  const visionAt = block.indexOf("key: 'vision'")
  const permAt = block.indexOf("key: 'permind'")
  const plusAt = block.indexOf("key: 'cmdcatalog'")
  assert.ok(plusAt >= 0 && permAt > plusAt && visionAt > permAt, 'tool row order must be +号｜权限设置｜插件功能 (DSH native left group)')
})

test('批次2 输出侧靠左回归：注释锁定附件条靠左，不改 align-items:stretch，不新增输出侧回显', () => {
  const previewsAt = js.indexOf("className: 'md-vision-previews'")
  assert.ok(previewsAt > 0, 'md-vision-previews render site must exist')
  const around = js.slice(previewsAt - 320, previewsAt)
  assert.ok(around.includes('align-items:stretch') && around.includes('DSH 原生'), 'comment must note attach bar left-aligns to DSH native')
  const at = js.indexOf('.md-composer-native{')
  const rule = js.slice(at, js.indexOf('}', at))
  assert.ok(rule.includes('align-items:stretch'), 'align-items:stretch must remain untouched')
  const aiAt = js.indexOf("h('div', { className: 'md-msg-ai', key: 'ai' }")
  const aiBlock = js.slice(aiAt, js.indexOf('\n', aiAt))
  assert.ok(!aiBlock.includes('md-vision-previews') && !aiBlock.includes('md-file-card'), 'no output-side image/file echo in assistant message')
})

test('批次1+2 零新增硬编码 hex：本次新增片段不含任何 #RRGGBB 字面量', () => {
  const addedRanges = []
  const pushSlice = (startMarker, endMarker) => {
    const a = js.indexOf(startMarker)
    const b = js.indexOf(endMarker, a)
    if (a > 0 && b > a) addedRanges.push(js.slice(a, b))
  }
  pushSlice('// 命令目录（+号）', 'const [renameChatId')
  pushSlice('const READONLY_CMDS', '// 图片白名单')
  pushSlice('// 权限设置入口：盾牌 indicator', 'cmdMenuOpen ? h(')
  pushSlice('cmdMenuOpen ? h(', ']) : null,')
  assert.ok(addedRanges.length === 4, 'all four new code ranges must be located')
  for (const r of addedRanges) {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(r), 'new UI code must not add hardcoded hex color')
  }
})



// ── 场景化配图：成稿页借订阅生图（关3） ─────────────────────────────────────
test('成稿页有场景化配图按钮：复用 md-pill、中文文案、不新增独立主行动', () => {
  const start = src.indexOf("const studioView = h('div'")
  assert.ok(start > 0, 'studioView must exist')
  const cssAt = src.indexOf('const CHAT_MD_CSS', start)
  const studio = src.slice(start, cssAt > 0 ? cssAt : start + 9000)
  assert.ok(studio.includes("key: 'illustrate'"), 'studio must have the illustrate button')
  assert.ok(studio.includes('配一张图'), 'button label must be 中文 配一张图')
  assert.ok(studio.includes("className: 'md-pill'"), 'illustrate button must reuse md-pill')
  assert.ok(/studioDraft \? h\('button', \{ key: 'illustrate'/.test(studio), 'button only appears when studioDraft exists')
  assert.equal((studio.match(/is-primary/g) || []).length, 1, 'still exactly one primary action')
})
test('配图接线：先问桥拍板落盘，拍板同意后才带决策 id 再调用', () => {
  assert.ok(src.includes("action: 'draft_image'"), 'client must call draft_image')
  assert.ok(/approved: !!approved/.test(src), 'approved intent flag must be forwarded')
  assert.ok(/decisionId: decisionId \|\| undefined/.test(src), 'decisionId must be forwarded to server')
  assert.ok(/runDraftImage\(prompt, false\)/.test(src), 'first call must NOT be approved')
  assert.ok(/runDraftImage\(prompt, true, decisionId\)/.test(src), 'approval handler must call again with approved:true + decisionId')
  assert.ok(src.includes("d.gate === 'waiting-human'"), 'must handle waiting-human gate')
  assert.ok(/risk:outbound:给这份初稿配一张图/.test(src), 'decision point must carry outbound risk prefix')
  assert.ok(/await answerDecision\(collabId, decisionId, 'approve'\)/.test(src), 'human approve must land before generating')
  assert.ok(/pendingIllustrationRef\.current/.test(src), 'must remember which decision is the illustration gate')
  const yesAt = src.indexOf("key: 'yes'")
  assert.ok(yesAt > 0 && /approveIllustration\(/.test(src.slice(yesAt, yesAt + 900)), '共用 同意 按钮接线')
})
test('配图不可用如实展示服务端 message，且边界文案不替代证据核验', () => {
  assert.ok(/notify\(String\(\(d && d\.message\) \|\| '配图暂时做不了。'\), true\)/.test(src), 'must show server message on !ok')
  assert.ok(src.includes('配图不替代证据核验'), 'must state illustration does not replace evidence verification')
  assert.ok(!src.includes('突出核心结论与证据链'), 'must not claim illustration covers evidence chain')
  assert.ok(!/plugin_tools|plugin_call/.test(src.replace(/不建通用工具面板/g, '')), 'no generic tool panel')
})
test('场景化配图新增片段零新增硬编码 hex', () => {
  const pick = (marker, len) => { const i = src.indexOf(marker); return i < 0 ? '' : src.slice(i, i + len) }
  const sendAt = src.indexOf('const send = useCallback(async (text, opts)')
  const reqAt = src.indexOf('const requestIllustration')
  const regions = [
    pick("const [studioIllustration", 200),
    pick("const runDraftImage", 300),
    reqAt > 0 && sendAt > reqAt ? src.slice(reqAt, sendAt) : '',
    pick("key: 'illustrate'", 500),
    pick("key: 'illus'", 500),
    pick("const pend = pendingIllustrationRef.current", 900),
  ].join('\n')
  assert.ok(regions.length > 200, 'found the added fragments')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(regions), 'new UI code must not add hardcoded hex color')
})

// 批次3关3：跑验证链透明度与能力边界上屏（1.3 四条 + 1.2 双轨标注）
test('four capability boundaries are on screen verbatim in plain language', () => {
  for (const t of [
    '三档权限开关只管科灵调用工具，管不到实验里跑的子程序',
    '实验代码以解释器完整权限运行',
    '只拦代理层的外网 HTTP(S) 请求，不等于机器断网',
    '当前没有静态代码扫描，代码只查了长度和空值',
    'runner.enabled 总开关和路径白名单约束',
    '沙箱与确认闸门还在实现中',
  ]) assert.ok(src.includes(t), 'missing boundary fact: ' + t)
  assert.ok(!src.includes('扫描未命中不等于安全'), 'forbidden false-security sentence must not appear')
})

test('same capability boundary block is shown in both lab and void surfaces', () => {
  assert.ok((src.match(/capabilityBoundary\(/g) || []).length >= 2, 'shared boundary helper must exist and be mounted in both surfaces')
  assert.ok((src.match(/className: 'md-collab-boundary'/g) || []).length >= 1, 'reuse existing boundary class')
  const at = src.indexOf("const labView = h('div'")
  const end = src.indexOf('const collabView = h(', at)
  const labSlice = src.slice(at, end)
  assert.ok(labSlice.includes("capabilityBoundary('boundary')"), 'lab surface must carry the boundary block')
  assert.ok(src.includes("capabilityBoundary('b')"), 'void surface must carry the same block')
})

test('two run tracks are labelled honestly in plain words', () => {
  assert.ok(src.includes('这一轨是你自己主动执行：点一下就等于授权，只受 runner.enabled 总开关管，不经合作决策区拍板。'), 'direct lab track label missing')
  assert.ok(src.includes('这一轨是科灵代替你执行：装包和工作区改动都要你在决策区拍板，跑完计入合作证据链。'), 'collab-led track label missing')
  assert.ok(src.includes('onClick: runLab'), 'lab run button onClick unchanged')
  assert.ok(src.includes("runCollabAction('collab_run', selectedCollab.id"), 'collab run button onClick unchanged')
})


test('image.source 三档开关与九家服务商预设真值逐字落地', () => {
  const settingsSrc = readFileSync(new URL('../lib/settings.mjs', import.meta.url), 'utf8')
  assert.ok(settingsSrc.includes("key: 'image.source'"), 'image.source 定义缺失')
  assert.ok(settingsSrc.includes("options: ['auto', 'http', 'tool']"), '三档选项缺失')
  assert.ok(settingsSrc.includes("default: 'auto'"), '缺省必须为 auto')
  const at = src.indexOf('const IMAGE_PRESETS = [')
  const block = src.slice(at, src.indexOf('const applyImagePreset', at))
  assert.ok(block, 'IMAGE_PRESETS 区块缺失')
  const expect = [
    ['OpenAI', { protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1', size: '1536x1024', quality: 'medium' }],
    ['xAI', { protocol: 'openai', baseUrl: 'https://api.x.ai/v1', model: 'grok-2-image', size: '' }],
    ['火山方舟', { protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', size: '1024x1024' }],
    ['智谱', { protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'cogview-4', size: '1024x1024' }],
    ['硅基流动', { protocol: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: '', size: '', extra: '{"image_size":"1024x1024"}' }],
    ['阿里云百炼', { protocol: 'bailian', baseUrl: 'https://dashscope.aliyuncs.com', model: 'qwen-image-2.0-pro', size: '2688x1536' }],
    ['百炼Token Plan', { protocol: 'bailian', baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com', model: 'qwen-image-3.0-pro', size: '1024x1024' }],
    ['百炼万相异步', { protocol: 'wan', baseUrl: 'https://dashscope.aliyuncs.com', model: 'wan2.5-t2i-preview', size: '1280x1280' }],
  ]
  for (const [label, fields] of expect) {
    const line = block.split('\n').find(l => l.includes("label: '" + label + "'"))
    assert.ok(line, '预设缺失：' + label)
    for (const [k, v] of Object.entries(fields)) assert.ok(line.includes("'image." + k + "': '" + v + "'"), label + ' 的 ' + k + ' 不真')
  }
  const custom = block.split('\n').find(l => l.includes("label: '其他自定义'"))
  assert.ok(custom, '其他自定义预设缺失')
  assert.ok(!custom.includes("'image.protocol'"), '其他自定义不得改协议')
  assert.ok(custom.includes("'image.baseUrl': ''"))
  assert.ok(custom.includes("'image.model': ''"))
  assert.ok(custom.includes("'image.size': '1024x1024'"))
})

test('点一次预填只写草稿：一次 setSettingDraft 写多字段，保存才落盘', () => {
  assert.ok(src.includes('const applyImagePreset = patch => setSettingDraft(prev => ({ ...prev, ...patch }))'), '预填必须一次调用写多字段')
  assert.ok(src.includes('onClick: () => applyImagePreset(preset.patch)'), '按钮必须调用预填 handler')
  assert.ok(src.includes("className: 'md-presets', key: 'presets'"), '预填按钮要复用 md-presets 样式')
  assert.ok(src.includes("'生图服务商一键预填'"), '预填行白话标签缺失')
})

test('image 页渲染订阅生图工具可用性小字，且提示诚实', () => {
  const at = src.indexOf("settingsPage === 'image'")
  const page = src.slice(at, src.indexOf("settingsPage === 'effort'", at))
  assert.ok(page.includes('imageToolTip'), 'image 页必须渲染工具可用性小字')
  assert.ok(src.includes('const imageToolTip = imageToolAvailable'), '提示必须由状态驱动')
  assert.ok(src.includes('检测到订阅生图工具'), '有工具提示缺失')
  assert.ok(src.includes('未检测到订阅生图工具'), '无工具提示缺失')
  assert.ok(src.includes('选只用订阅生图工具会生成失败'), '无工具时的诚实失败提示缺失')
  assert.ok(src.includes('const [imageToolAvailable, setImageToolAvailable] = useState(false)'), '状态缺失')
  assert.ok(src.includes('setImageToolAvailable(d.imageToolAvailable === true)'), '设置返回必须喂给状态')
  const host = readFileSync(new URL('../lib/host.mjs', import.meta.url), 'utf8')
  assert.ok(host.includes('imageToolAvailable: Boolean(draftImageTool(ctx))'), 'settingsView 必须暴露探测结果')
})

// ---- 关3：两个设置入口统一到单一面板渲染源（齿轮 → 科灵栏设置面板） ----
test('齿轮入口在根层开独立设置对话框，不强制展开科灵栏', () => {
  const gear = src.split('\n').find(l => l.includes("key: 'gear', icon: 'gear', label: '设置'"))
  assert.ok(gear, '顶栏齿轮按钮缺失')
  assert.ok(!gear.includes('setDockOpen'), '齿轮不得再强制展开科灵栏（过程可见：改设置不打断工作区）')
  assert.ok(gear.includes("setSettingsPage('root')"), '齿轮必须把面板复位到 root 页')
  assert.ok(gear.includes('setSettingsDialogOpen(true)'), '齿轮必须打开独立设置对话框')
  assert.ok(!gear.includes('setSettingsPanelOpen'), '齿轮不得再就地打开 dock 内浮层')
  assert.ok(gear.includes("setSettingsPage('root')"), '齿轮必须把设置复位到 root 页')
})

test('旧 showSettings 死代码已清除，设置对话框改走复用 Dialog 的 settingsDialog', () => {
  assert.ok(!src.includes('showSettings'), 'showSettings 状态残留')
  assert.ok(!src.includes('setShowSettings'), 'setShowSettings 引用残留')
  assert.ok(src.includes('const settingsDialog = settingsDialogOpen ?'), 'settingsDialog 须用现成 Dialog 定义')
  assert.ok(src.includes("key: 'setdlg'"), '设置对话框 key 必须存在')
})

test('other 子页存在并承接 30 项 settingRows 单一渲染', () => {
  assert.ok(src.includes("settingsPage === 'other'"), 'other 子页分支缺失')
  const at = src.indexOf("settingsPage === 'other'")
  const page = src.slice(at, src.indexOf("key: 'effort'", at))
  assert.ok(page.includes("...settingRows.filter(r => r.key !== 'model.route').map(renderField)"), 'other 页必须渲染 30 项设置')
  assert.ok(page.includes('md-settings-body') && page.includes('md-settings-back'), 'other 页须复用既有面板样式与返回按钮')
  assert.ok(page.includes('saveSettings') && page.includes('resetSettings'), 'other 页须保留保存设置/恢复默认')
})

test('root 页含「其他与界面偏好」入口行且复用 chevR 同构样式', () => {
  const rootAt = src.indexOf("className: 'md-settings-body', key: 'root'")
  const root = src.slice(rootAt, src.indexOf("settingsPage === 'model'", rootAt))
  assert.ok(root.includes("key: 'other', className: 'md-settings-row'"), 'root 页缺少「其他与界面偏好」入口行')
  assert.ok(root.includes('其他与界面偏好'), '入口行 label 缺失')
  assert.ok(root.includes("setSettingsPage('other')"), '入口行必须跳到 other 页')
  assert.ok(root.includes("I({ name: 'chevR', size: 14 })"), '入口行须复用 chevR 箭头')
})

test('四项界面偏好处理函数源码仍在，零功能倒退', () => {
  for (const fn of ['setLocaleId', 'setBgStyle', 'setDockDefault', 'setScatterAnim']) {
    assert.ok(src.includes(fn + '('), '界面偏好处理函数丢失：' + fn)
  }
  assert.ok(src.includes("localStorage.setItem('rd.dockDefault'"), '默认显示科灵的持久化逻辑丢失')
  assert.ok(src.includes("role: 'radiogroup'") && src.includes("'aria-label': '语言'"), '语言 segment 语义丢失')
})

test('image.* 字段仅在 image 子页单一渲染，不再与 other 页重复', () => {
  const renderLines = src.split('\n').filter(l => l.includes("settingRows.filter(r => r.key.indexOf('image.') === 0).map(renderField)"))
  assert.equal(renderLines.length, 1, 'image.* 渲染必须只有一处')
  const otherAt = src.indexOf("settingsPage === 'other'")
  const other = src.slice(otherAt, src.indexOf("key: 'effort'", otherAt))
  assert.ok(!other.includes("r.key.indexOf('image.')"), 'other 页不得重复渲染 image.* 字段')
})
// ---- 齿轮设置不再强制展开科灵 dock：独立 Dialog + 内容单一渲染源 ----
test('齿轮 onClick 不再 setDockOpen，改为在根层开独立设置对话框', () => {
  const gear = src.split('\n').find(l => l.includes("key: 'gear', icon: 'gear', label: '设置'"))
  assert.ok(gear, '顶栏齿轮按钮缺失')
  assert.ok(!gear.includes('setDockOpen'), '齿轮不得再强制展开科灵栏（过程可见：改设置不打断工作区）')
  assert.ok(gear.includes("setSettingsPage('root')"), '齿轮须把设置复位到 root 页')
  assert.ok(gear.includes('setSettingsDialogOpen(true)'), '齿轮须打开独立设置对话框')
})

test('settingsBody 单一渲染源：dock 内浮层与根层 Dialog 两处都调用 settingsBody()', () => {
  assert.ok(src.includes('const settingsBody = () => ('), 'settingsBody 闭包定义缺失')
  const calls = (src.match(/settingsBody\(\)/g) || []).length
  assert.equal(calls, 2, 'settingsBody() 须恰好被浮层与 Dialog 两处复用，实际=' + calls)
  assert.ok(src.includes("const settingsPanel = (settingsPanelOpen && dockOpen) ? h('div', { className: 'md-settings-pop', key: 'setpop' }, settingsBody()) : null"), '浮层须用 settingsBody() 替换原内联表达式')
  assert.ok(src.includes('}, settingsBody()) : null'), 'Dialog 须用 settingsBody() 作为 children')
})

test('settingsDialog 挂渲染根层、不受 dockOpen 约束，复用现有 Dialog/md-dialog', () => {
  assert.ok(src.includes("const settingsDialog = settingsDialogOpen ? h(Dialog, { key: 'setdlg', title: '设置', onClose: () => setSettingsDialogOpen(false), width: 560 }, settingsBody()) : null"), 'settingsDialog 须复用 Dialog 组件')
  const defAt = src.indexOf('const settingsDialog = settingsDialogOpen ?')
  const defLine = src.slice(defAt, src.indexOf('\n', defAt))
  assert.ok(!defLine.includes('dockOpen'), 'dialog 定义不得依赖 dockOpen')
  const themeAt = src.indexOf('        themeDialog,')
  const mountAt = src.indexOf('        settingsDialog,', themeAt)
  assert.ok(themeAt > 0 && mountAt > themeAt, 'settingsDialog 须挂在 themeDialog 之后的渲染根层')
  assert.ok(src.includes('function Dialog(props)') && src.includes("className: 'md-dialog-mask'") && src.includes("className: 'md-dialog-head'"), '须复用现成 Dialog 与 md-dialog 系列 class')
})

test('closeSettings 同时关闭浮层与对话框；内容块关闭动作改造后仍在', () => {
  assert.ok(src.includes('const closeSettings = () => { setSettingsPanelOpen(false); setSettingsDialogOpen(false) }'), 'closeSettings 须同时调两个 setter')
  const useAt = src.indexOf('const closeSettings = () =>')
  const panelAt = src.indexOf('const settingsPanel = (settingsPanelOpen')
  const block = src.slice(useAt, panelAt)
  assert.equal((block.match(/closeSettings\(\)/g) || []).length, 5, '内容块 5 处关闭动作须改调 closeSettings()')
  assert.ok(!block.slice(block.indexOf('\n')).includes('setSettingsPanelOpen(false)'), '内容块内不得残留直接 setSettingsPanelOpen(false)（closeSettings 定义本身除外）')
  const effAt = src.indexOf('if (!settingsPanelOpen) return')
  const effBlock = src.slice(effAt, src.indexOf('}, [settingsPanelOpen])', effAt))
  assert.equal((effBlock.match(/setSettingsPanelOpen\(false\)/g) || []).length, 2, 'useEffect 两处关闭须保持原样')
  for (const t of ['模型', '推理等级', '权限模式', '生图配置', '智能体团队协作', '其他与界面偏好', '跟随默认', '推理等级越高，回答越审慎，耗时也更长。']) {
    assert.ok(src.includes(t), '设置项文案丢失：' + t)
  }
})

test('齿轮改造新增片段零新增硬编码 hex', () => {
  const pick = (marker, len) => { const i = src.indexOf(marker); return i < 0 ? '' : src.slice(i, i + len) }
  const regions = [
    pick('const [settingsDialogOpen', 120),
    pick('const closeSettings = () =>', 120),
    pick('const settingsDialog = settingsDialogOpen ?', 260),
    pick('const settingsPanel = (settingsPanelOpen && dockOpen)', 180),
    src.split('\n').find(l => l.includes("key: 'gear', icon: 'gear', label: '设置'")) || '',
  ].join('\n')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(regions), '本次新增片段不得引入硬编码 hex')
})