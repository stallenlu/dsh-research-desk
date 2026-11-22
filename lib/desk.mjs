// The research desk domain model and the only write path.
// Model output is untrusted input: every field goes through a type table and
// anything not on the whitelist is dropped instead of merged.
import { cleanList, cleanText, isHttpUrl, isObject, newId, nowIso, toNumber } from './util.mjs'
import { defaultSettings } from './settings.mjs'

const PROFILE_SECRET_RE = /(密码|口令|api[_-]?key|token|secret|credential|Bearer|sk-[A-Za-z0-9])/i

/** Pure filter: drop strings that look like secrets, keep legitimate research entries. */
export function cleanProfileList(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(x => cleanText(x, 160))
    .filter(Boolean)
    .filter(x => !PROFILE_SECRET_RE.test(x))
    .slice(0, 12)
}

const PROFILE_GROUPS = ['focus', 'sources', 'habits']
const DECLINED_MAX = 20

/** Pure diff: only entries present before but removed after are declined; newest last, deduped, bounded. */
export function diffDeclined(before, after, at) {
  const prior = isObject(before) ? before : {}
  const next = isObject(after) ? after : {}
  const out = []
  const seen = new Set()
  for (const group of PROFILE_GROUPS) {
    const previous = Array.isArray(prior[group]) ? prior[group] : []
    const kept = Array.isArray(next[group]) ? next[group] : []
    for (const raw of previous) {
      const item = cleanText(raw, 160)
      if (!item || kept.includes(item)) continue
      const key = group + '\u0000' + item
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ item, group, at: cleanText(at, 40) || nowIso() })
    }
  }
  return out.slice(-DECLINED_MAX)
}

/** Pure filter: drop writes that reintroduce an item the researcher already rejected. */
export function filterDeclined(values, declined, group) {
  if (!Array.isArray(values)) return []
  const blocked = (Array.isArray(declined) ? declined : [])
    .filter(row => isObject(row) && row.group === group)
    .map(row => row.item)
  return values.filter(value => !blocked.includes(value))
}

export const SOURCES = ['arxiv', 'europepmc', 'openalex']
export const PAPER_STATUS = ['new', 'reading', 'read', 'kept', 'dropped']
export const HYPOTHESIS_STATUS = ['draft', 'testing', 'supported', 'rejected', 'held']
export const DRAFT_STATUS = ['idea', 'outline', 'draft', 'ready', 'published']
export const EXPERIMENT_STATUS = ['planned', 'running', 'done', 'failed', 'rejected']
export const COLLAB_STATUS = ['active', 'waiting-human', 'done', 'abandoned']
// 灵感生命周期：spark 火花 → framed 成形 → pursued 在研 → shelved 搁置（终稿 §7.1）。
export const INSPIRATION_STATUS = ['spark', 'framed', 'pursued', 'shelved']

// 早期对话 handoff（检查点内核）：纯函数压出要点串；仅超阈值生成，总长由常量封顶。
export const HANDOFF_CHAR_CAP = 600
export const HANDOFF_MESSAGE_THRESHOLD = 30
const HANDOFF_Q_CHARS = 40
const HANDOFF_A_CHARS = 60

const PAPER_FIELDS = {
  title: 'text',
  abstract: 'text',
  venue: 'text',
  year: 'num',
  doi: 'text',
  arxivId: 'text',
  pmid: 'text',
  pmcid: 'text',
  url: 'url',
  source: 'text',
  authors: 'list',
  tags: 'list',
  status: 'status',
  citedBy: 'num',
  note: 'text',
}

const HYPOTHESIS_FIELDS = {
  title: 'text',
  rationale: 'text',
  gap: 'text',
  experiment: 'text',
  evidence: 'list',
  status: 'hstatus',
}

const DRAFT_FIELDS = {
  title: 'text',
  body: 'text',
  refs: 'list',
  status: 'dstatus'
}

// 实验记录完整字段集（工程方案 v1.3 §3.1 唯一权威白名单，终审架构/事实核查确认）。
// 原有 10 字段之外扩容 provenance 字段；所有字段经 coerce 白名单校验，模型输出不可信。
const EXPERIMENT_FIELDS = {
  title: 'text',
  runtime: 'text',
  code: 'text',
  hypothesisId: 'text',
  status: 'estatus',
  exitCode: 'num',
  stdout: 'text',
  stderr: 'text',
  durationMs: 'num',
  timedOut: 'bool',
  kind: 'text',                    // single | sweep | verify
  parentRunId: 'text',             // 单父血缘链
  params: 'json',
  packages: 'json',
  solver: 'json',
  toolchain: 'json',
  inputHash: 'text',
  metrics: 'json',
  criteria: 'json',
  artifacts: 'json',
  cacheHit: 'bool',
  sourceRunId: 'text',
  createdAt: 'text',
  startedAt: 'text',
  finishedAt: 'text',
  reason: 'text',                 // 孤儿回收等原因
}

// 合作记录字段集（方案 v1.1 §4.2，字段命名以终审为准）。结构化字段必须绑 json：
// cleanList 只保留字符串元素，用 list 会吞掉对象元素；experimentIds 才是纯字符串数组。
// 合作 status 绑 COLLAB_STATUS，绝不复用 PAPER_STATUS。
const COLLAB_FIELDS = {
  title: 'text',
  goal: 'json',
  kelinRole: 'text',
  autonomy: 'text',
  team: 'json',
  steps: 'json',
  environment: 'json',
  experimentIds: 'list',
  decisions: 'json',
  evaluation: 'json',
  status: 'cstatus',
  createdAt: 'text',
  updatedAt: 'text',
  at: 'text',
}

const COLLAB_STEP_FIELDS = {
  phase: 'text',
  actor: 'text',
  decision: 'text',
  reason: 'text',
  refs: 'list',
}

const COLLAB_DECISION_FIELDS = {
  point: 'text',
  choice: 'text',
  by: 'text',
  pending: 'bool',
}

// 灵感实体字段集（阶段 A1，终稿 §7.1）：只收模型可控字段。
// id:newId('i') / createdAt:nowIso() 由服务端生成，绝不入白名单，
// 否则 pick 采信后 update Object.assign 会改写主键（与 add_draft 同构）。
// origin / confidence 等 D1/D9 字段属 refactor-D，A1 不越界。
const INSPIRATION_FIELDS = {
  text: 'text',
  status: 'istatus',
}

const LIMITS = {
  text: 40000,
  list: 64,
  title: 400,
  name: 200
}

function coerce(type, value, limit) {
  switch (type) {
    case 'text': return cleanText(value, limit || LIMITS.text)
    case 'title': return cleanText(value, LIMITS.title)
    case 'list': return cleanList(value, limit || LIMITS.list)
    case 'num': return toNumber(value)
    case 'url': return typeof value === 'string' && isHttpUrl(value) ? value.trim().slice(0, 2000) : undefined
    case 'status': return PAPER_STATUS.includes(value) ? value : undefined
    case 'hstatus': return HYPOTHESIS_STATUS.includes(value) ? value : undefined
    case 'dstatus': return DRAFT_STATUS.includes(value) ? value : undefined
    case 'estatus': return EXPERIMENT_STATUS.includes(value) ? value : undefined
    case 'cstatus': return COLLAB_STATUS.includes(value) ? value : undefined
    case 'istatus': return INSPIRATION_STATUS.includes(value) ? value : undefined
    case 'bool': return typeof value === 'boolean' ? value : undefined
    case 'json': {
      // 结构化字段：只接受纯对象/数组，做白名单深拷贝，拒绝函数与循环引用。
      if (!isObject(value) && !Array.isArray(value)) return undefined
      try {
        const seen = new WeakSet()
        const copy = v => {
          if (v === null || typeof v !== 'object') {
            if (typeof v === 'function' || typeof v === 'symbol') throw new Error('非法类型')
            return v
          }
          if (seen.has(v)) throw new Error('循环引用')
          seen.add(v)
          if (Array.isArray(v)) return v.map(copy)
          const out = {}
          for (const k of Object.keys(v)) {
            if (!/^[A-Za-z0-9_\u4e00-\u9fa5.-]{1,64}$/.test(k)) continue
            out[k] = copy(v[k])
          }
          return out
        }
        const result = copy(value)
        if (JSON.stringify(result).length > 40000) return undefined
        return result
      } catch (e) { return undefined }
    }
    default: return undefined
  }
}

function pick(fields, input) {
  const out = {}
  if (!isObject(input)) return out
  for (const [key, type] of Object.entries(fields)) {
    if (!(key in input)) continue
    const value = coerce(type, input[key])
    if (value !== undefined && value !== '') out[key] = value
  }
  return out
}


/**
 * Sanitize the sections of a review before they are stored.
 * A review comes from a model, so every field is checked: a section without
 * text is dropped, and a citation keeps only the fields a reader can check.
 * @param {any} value - the raw sections from the model.
 * @returns {Array<object>} the cleaned sections.
 */
export function sanitizeSections(value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value.slice(0, 12)) {
    if (!isObject(item)) continue
    const text = cleanText(item.text, 20000)
    if (!text) continue
    const citations = []
    for (const cite of Array.isArray(item.citations) ? item.citations.slice(0, 64) : []) {
      if (!isObject(cite)) continue
      const chunkId = cleanText(cite.chunkId, 120)
      const quote = cleanText(cite.quote, 1200)
      if (!chunkId || !quote) continue
      citations.push({
        chunkId,
        quote,
        paperId: cleanText(cite.paperId, 80),
        title: cleanText(cite.title, 300),
        heading: cleanText(cite.heading, 200)
      })
    }
    out.push({
      key: cleanText(item.key, 40) || 'section',
      label: cleanText(item.label, 120),
      text,
      citations
    })
  }
  return out
}

/**
 * Sanitize the counters of a review.
 * @param {any} value - the raw stats from the model.
 * @returns {object} the cleaned counters.
 */
export function sanitizeStats(value) {
  if (!isObject(value)) return {}
  const out = {}
  for (const key of ['sections', 'citationCount', 'unverifiedCount', 'paperCount']) {
    const n = toNumber(value[key])
    if (n !== undefined) out[key] = n
  }
  return out
}
export function emptyState() {
  return {
    version: 1,
    papers: [],
    inspirations: [],
    questions: [],
    hypotheses: [],
    drafts: [],
    reviews: [],
    experiments: [],
    collaborations: [],
    chat: [],
    chats: [],
    activeChatId: '',
    activeInspirationId: '',
    profile: { focus: [], sources: [], habits: [], updatedAt: '' },
    profileJournal: [],
    profileDeclined: [],
    settings: defaultSettings(),
    updatedAt: nowIso()
  }
}

function normalizeChatRow(row) {
  if (!isObject(row)) return null
  const out = Object.assign({}, row)
  if (typeof out.q !== 'string') out.q = ''
  if (typeof out.a !== 'string') out.a = ''
  if (typeof out.at !== 'string') out.at = ''
  if (typeof out.reasoning !== 'string') out.reasoning = ''
  if (Array.isArray(out.toolTrace)) out.toolTrace = out.toolTrace.filter(function (t) { return typeof t === 'string' })
  else out.toolTrace = out.toolTrace ? [String(out.toolTrace)] : []
  if (typeof out.usageText !== 'string') out.usageText = ''
  // handoff 属会话级字段；若随行进入，也按字符串白名单收口，避免类型污染被后续白名单丢掉。
  if (out.handoff !== undefined) out.handoff = typeof out.handoff === 'string' ? cleanText(out.handoff, HANDOFF_CHAR_CAP) : ''
  return out
}

/** Name a session from its first real question so sessions are distinguishable. */
function autoTitleChat(row) {
  if (!row || !Array.isArray(row.messages) || !row.messages.length) return
  if (row.title && row.title !== '新对话') return
  const first = row.messages.find(function (m) { return m && m.q }) || row.messages[0]
  const q = cleanText(first && first.q, 40)
  if (q) row.title = q
}

// ── 会话长期记忆：三字段全部服务端现算，纯函数、无模型调用 ──────────────
// 停用词字符：中文虚词与常见问答套话，避免把"怎么/什么/科灵"当成主题标签。
const CHAT_STOP_CHARS = new Set('的了和是在我你他她它们这那什么怎么是否需要应该已经还是但是因为所以如果就是不是告诉请帮是否吗呢吧啊把被给让从到与及等上下里后前现在些')
// 英文停用词，仅用于拉丁词标签。
const CHAT_STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'how', 'what', 'why', 'are', 'was', 'were', 'you', 'your', 'our', 'can', 'should', 'would', 'about', 'into', 'from'])

/** 从回答文字里取候选主题词：拉丁词整词 + 中文连续片段（去首尾虚词）。 */
function chatTopicTokens(text) {
  const tokens = []
  const latin = String(text || '').toLowerCase().match(/[a-z][a-z0-9-]{1,}/g) || []
  for (const word of latin) if (word.length >= 2 && !CHAT_STOP_WORDS.has(word)) tokens.push(word)
  const cjk = String(text || '').match(/[\u4e00-\u9fff]{2,}/g) || []
  for (const run of cjk) {
    let term = run
    while (term.length > 2 && CHAT_STOP_CHARS.has(term[0])) term = term.slice(1)
    while (term.length > 2 && CHAT_STOP_CHARS.has(term[term.length - 1])) term = term.slice(0, -1)
    if (term.length >= 2 && !Array.from(term).every(ch => CHAT_STOP_CHARS.has(ch))) tokens.push(term)
  }
  return tokens
}

/**
 * 纯函数：把最旧的一批问答压成保留语义的要点串（问/答各取前若干字），总长封顶。
 * 无模型调用、无网络、无依赖；同一输入永远同一输出。未超阈值返回空串，不写字段。
 */
export function buildChatHandoff(messages) {
  if (!Array.isArray(messages) || messages.length <= HANDOFF_MESSAGE_THRESHOLD) return ''
  const parts = []
  let used = 0
  for (const m of messages.slice(0, HANDOFF_MESSAGE_THRESHOLD)) {
    if (!isObject(m)) continue
    const q = cleanText(m.q, HANDOFF_Q_CHARS)
    const a = cleanText(m.a, HANDOFF_A_CHARS)
    if (!q && !a) continue
    const piece = (q ? '问：' + q : '') + (q && a ? '；答：' + a : (a ? '答：' + a : ''))
    const extra = parts.length ? 1 : 0 // 分隔符 '；'
    if (used + extra + piece.length > HANDOFF_CHAR_CAP) break
    parts.push(piece)
    used += extra + piece.length
  }
  return parts.join('；')
}

/**
 * 给一条会话现算「一句摘要 / 主题标签 / 沉淀物类型」。
 * 只读 row.messages，不调模型、不发网络；同一个输入永远得到同一个输出。
 * 结果写回 row（调用方负责保存），缺省为安全空值，不破坏旧会话。
 */
export function enrichChat(row) {
  if (!isObject(row)) return row
  const messages = Array.isArray(row.messages) ? row.messages : []

  // 摘要：取最后一条有问有答的消息，压成"讨论了X，结论Y"，最多 60 字。
  let last = null
  for (const m of messages) {
    if (isObject(m) && typeof m.q === 'string' && m.q.trim()) last = m
  }
  const q = last ? cleanText(last.q, 26) : ''
  const a = last && typeof last.a === 'string' ? cleanText(last.a, 26) : ''
  let summary = ''
  if (q && a) summary = '讨论了' + q + '，结论' + a
  else if (q) summary = '讨论了' + q
  else if (a) summary = '结论' + a
  row.summary = cleanText(summary, 60)

  // 标签：全量消息里的高频主题词，去停用词、去重，最多 6 个。
  const allText = messages.map(function (m) {
    if (!isObject(m)) return ''
    return [typeof m.q === 'string' ? m.q : '', typeof m.a === 'string' ? m.a : ''].join(' ')
  }).join(' ')
  const freq = new Map()
  for (const token of chatTopicTokens(allText)) freq.set(token, (freq.get(token) || 0) + 1)
  const ranked = Array.from(freq.entries()).sort(function (x, y) { return y[1] - x[1] || x[0].localeCompare(y[0]) })
  row.tags = ranked.slice(0, 6).map(function (entry) { return entry[0] })

  // 沉淀物：按固定词表认信号，输出顺序锁定为四个枚举值的子集。
  const outcomes = []
  if (/选题|假设|研究方向|问题意识|题目/.test(allText)) outcomes.push('选题')
  if (/验证|实验|复现|检验|测试|跑一下|代码/.test(allText)) outcomes.push('实验')
  if (/定稿|成文|草稿|写作|论文|初稿|撰写|段落/.test(allText)) outcomes.push('草稿')
  if (/拍板|决定|敲定|确定采用|结论是|我们选|就选|定下来/.test(allText)) outcomes.push('决策')
  row.outcomes = outcomes

  // 检查点：超阈值才从最早的问答现算 handoff（纯函数，无模型调用）。
  row.handoff = buildChatHandoff(messages)

  return row
}

/** Keep the compatibility mirror state.chat in sync with the active session. */
export function syncActiveChat(state) {
  if (!isObject(state) || !Array.isArray(state.chats)) return
  const row = state.chats.find(function (c) { return c && c.id === state.activeChatId })
  if (!row) return
  row.messages = (Array.isArray(state.chat) ? state.chat : []).map(normalizeChatRow).filter(Boolean)
  autoTitleChat(row)
  // 服务端现算会话记忆三字段（纯函数，无模型调用）
  enrichChat(row)
  row.updatedAt = nowIso()
}

export function migrateState(raw) {
  const base = emptyState()
  if (!isObject(raw)) return base
  const state = { ...base, ...raw }
  for (const key of ['papers', 'inspirations', 'questions', 'hypotheses', 'drafts', 'reviews', 'experiments', 'collaborations', 'chat']) {
    if (!Array.isArray(state[key])) state[key] = []
  }
  // 灵感状态位：activeInspirationId 必须指向一条真实存在的灵感，否则回退空串。
  if (typeof state.activeInspirationId !== 'string') state.activeInspirationId = ''
  if (state.activeInspirationId && !state.inspirations.some(row => isObject(row) && row.id === state.activeInspirationId)) {
    state.activeInspirationId = ''
  }
  state.chat = (Array.isArray(state.chat) ? state.chat : []).map(normalizeChatRow).filter(Boolean)
  // 会话管理：chats 是单一真相源，state.chat 只是活跃会话的兼容镜像。
  if (!Array.isArray(state.chats)) state.chats = []
  state.chats = state.chats.filter(isObject).map(function (c) {
    return {
      id: cleanText(c.id, 80) || newId('c'),
      title: cleanText(c.title, 200) || '新对话',
      createdAt: cleanText(c.createdAt, 40) || nowIso(),
      updatedAt: cleanText(c.updatedAt, 40) || nowIso(),
      messages: (Array.isArray(c.messages) ? c.messages : []).map(normalizeChatRow).filter(Boolean),
      summary: cleanText(c.summary, 60),
      tags: Array.isArray(c.tags) ? c.tags.map(function (t) { return cleanText(t, 40) }).filter(Boolean).slice(0, 6) : [],
      outcomes: Array.isArray(c.outcomes) ? c.outcomes.filter(function (o) { return ['选题', '实验', '草稿', '决策'].indexOf(o) !== -1 }).slice(0, 4) : [],
      handoff: cleanText(c.handoff, HANDOFF_CHAR_CAP),
    }
  })
  if (!state.chats.length) {
    state.chats.push({ id: newId('c'), title: '新对话', createdAt: nowIso(), updatedAt: nowIso(), messages: state.chat.slice() })
  }
  state.chats.forEach(autoTitleChat)
  // 惰性回填历史会话的摘要/标签/沉淀物（纯函数，无模型调用）
  state.chats.forEach(enrichChat)
  if (!state.chats.some(function (c) { return c.id === state.activeChatId })) state.activeChatId = state.chats[0].id
  const activeChat = state.chats.find(function (c) { return c.id === state.activeChatId })
  state.chat = (activeChat.messages || []).map(function (m) { return Object.assign({}, m) })
  for (const draft of state.drafts) {
    if (!isObject(draft) || (draft.status !== undefined && DRAFT_STATUS.includes(draft.status))) continue
    draft.status = 'draft'
  }
  if (!isObject(state.settings)) state.settings = base.settings
  if (!isObject(state.profile)) state.profile = base.profile
  if (!Array.isArray(state.profileJournal)) state.profileJournal = []
  if (!Array.isArray(state.profileDeclined)) state.profileDeclined = []
  state.profileDeclined = state.profileDeclined.filter(isObject).filter(row =>
    PROFILE_GROUPS.includes(row.group) && typeof row.item === 'string' && !!row.item
  ).slice(-DECLINED_MAX)
  return state
}

/** Stable key used to recognise the same paper across sources. */
export function paperKey(paper) {
  if (!isObject(paper)) return ''
  if (paper.doi) return 'doi:' + String(paper.doi).toLowerCase()
  if (paper.arxivId) return 'arxiv:' + String(paper.arxivId).toLowerCase()
  if (paper.pmid) return 'pmid:' + String(paper.pmid)
  const title = cleanText(paper.title, 200).toLowerCase()
  return title ? 'title:' + title : ''
}

function findPaper(state, id) {
  return state.papers.find(row => row.id === id) || null
}

/**
 * Apply a list of operations to the state.
 * @param {object} state - mutable draft state.
 * @param {Array} ops - operations coming from the UI or from the model.
 * @returns {{receipts: Array<{text: string}>, errors: string[], changed: boolean}} receipts and errors.
 */
export function applyOps(state, ops) {
  const receipts = []
  const errors = []
  let changed = false
  const list = Array.isArray(ops) ? ops : []

  for (const op of list) {
    if (!isObject(op) || typeof op.op !== 'string') {
      errors.push('忽略了一条无法识别的操作')
      continue
    }
    switch (op.op) {
      case 'add_inspiration': {
        const insp = pick(INSPIRATION_FIELDS, op.inspiration)
        if (!insp.text) {
          errors.push('这条灵感是空的，跳过')
          break
        }
        const row = {
          ...insp,
          id: newId('i'),
          createdAt: nowIso(),
          status: insp.status || 'spark',
        }
        state.inspirations.unshift(row)
        // 灵感先于归属：新建即成为当前活跃灵感（A2 的盖章依赖此状态位）。
        state.activeInspirationId = row.id
        receipts.push({ text: '已记下一条灵感：' + insp.text.slice(0, 40) })
        changed = true
        break
      }
      case 'update_inspiration': {
        const row = state.inspirations.find(r => r.id === op.id)
        if (!row) { errors.push('找不到这条灵感'); break }
        const patch = pick(INSPIRATION_FIELDS, op.patch)
        // 白名单只含 text/status，id/createdAt 不可能被改写（Chief 微调 1）。
        Object.assign(row, patch)
        receipts.push({ text: '已更新灵感' })
        changed = true
        break
      }
      case 'remove_inspiration': {
        const index = state.inspirations.findIndex(r => r.id === op.id)
        if (index < 0) { errors.push('找不到这条灵感'); break }
        state.inspirations.splice(index, 1)
        // 删掉的是活跃灵感则清空状态位，绝不悬空指向。
        if (state.activeInspirationId === op.id) state.activeInspirationId = ''
        receipts.push({ text: '已删除这条灵感' })
        changed = true
        break
      }
      case 'add_paper': {
        const paper = pick(PAPER_FIELDS, op.paper)
        if (!paper.title) {
          errors.push('这篇文献没有标题，跳过')
          break
        }
        const key = paperKey(paper)
        if (state.papers.some(row => paperKey(row) === key)) {
          errors.push('文献库里已经有了：' + paper.title.slice(0, 40))
          break
        }
        const row = {
          ...paper,
          id: newId('p'),
          key,
          status: paper.status || 'new',
          addedAt: nowIso(),
          notes: [],
          chunks: []
        }
        state.papers.unshift(row)
        receipts.push({ text: '已加入文献库：' + paper.title.slice(0, 40) })
        changed = true
        break
      }
      case 'update_paper': {
        const row = findPaper(state, op.id)
        if (!row) { errors.push('文献库里找不到这一篇'); break }
        const patch = pick(PAPER_FIELDS, op.patch)
        Object.assign(row, patch)
        receipts.push({ text: '已更新：' + row.title.slice(0, 40) })
        changed = true
        break
      }
      case 'remove_paper': {
        const index = state.papers.findIndex(row => row.id === op.id)
        if (index < 0) { errors.push('文献库里找不到这一篇'); break }
        const [removed] = state.papers.splice(index, 1)
        receipts.push({ text: '已移出文献库：' + removed.title.slice(0, 40) })
        changed = true
        break
      }
      case 'set_paper_status': {
        const row = findPaper(state, op.id)
        if (!row) { errors.push('文献库里找不到这一篇'); break }
        if (!PAPER_STATUS.includes(op.status)) { errors.push('状态不认得：' + String(op.status)); break }
        row.status = op.status
        receipts.push({ text: '状态改为：' + op.status })
        changed = true
        break
      }
      case 'add_note': {
        const row = findPaper(state, op.paperId)
        if (!row) { errors.push('文献库里找不到这一篇'); break }
        const text = cleanText(op.text, 20000)
        if (!text) { errors.push('笔记是空的'); break }
        row.notes = row.notes || []
        row.notes.push({ id: newId('n'), at: nowIso(), text })
        receipts.push({ text: '已记笔记' })
        changed = true
        break
      }
      case 'add_hypothesis': {
        const fields = pick(HYPOTHESIS_FIELDS, op)
        if (!fields.title) { errors.push('选题需要一个标题'); break }
        const row = {
          ...fields,
          id: newId('h'),
          status: fields.status || 'draft',
          evidence: (fields.evidence || []).filter(id => state.papers.some(p => p.id === id)),
          at: nowIso()
        }
        state.hypotheses.unshift(row)
        receipts.push({ text: '已记录选题：' + fields.title.slice(0, 40) })
        changed = true
        break
      }
      case 'update_hypothesis': {
        const row = state.hypotheses.find(item => item.id === op.id)
        if (!row) { errors.push('找不到这条选题'); break }
        const patch = pick(HYPOTHESIS_FIELDS, op.patch)
        Object.assign(row, patch)
        receipts.push({ text: '已更新选题' })
        changed = true
        break
      }
      case 'add_draft': {
        const fields = pick(DRAFT_FIELDS, op)
        if (!fields.title || !fields.body) { errors.push('草稿需要标题和正文'); break }
        const row = {
          ...fields,
          id: newId('d'),
          at: nowIso()
        }
        state.drafts.unshift(row)
        receipts.push({ text: '已存草稿：' + fields.title.slice(0, 40) })
        changed = true
        break
      }
      case 'set_draft_status': {
        const id = cleanText(op.id, 200)
        const status = cleanText(op.status, 40)
        if (!id || !status || !DRAFT_STATUS.includes(status)) { errors.push('草稿状态无效'); break }
        const draft = state.drafts.find(row => row.id === id)
        if (!draft) { errors.push('找不到这篇草稿'); break }
        draft.status = status
        receipts.push({ text: '已把草稿《' + String(draft.title || '未命名').slice(0, 40) + '》设为' + ({ idea: '想法', outline: '提纲', draft: '初稿', ready: '待发布', published: '已发布' }[status] || status) })
        changed = true
        break
      }
      case 'remove_draft': {
        const index = state.drafts.findIndex(row => row.id === op.id)
        if (index < 0) { errors.push('找不到这篇草稿'); break }
        state.drafts.splice(index, 1)
        receipts.push({ text: '已删除草稿' })
        changed = true
        break
      }
      case 'add_review': {
        const topic = cleanText(op.topic, 400)
        const sections = sanitizeSections(op.sections)
        if (!sections.length) { errors.push('综述没有可用的段落'); break }
        const row = {
          id: newId('r'),
          topic,
          sections,
          stats: sanitizeStats(op.stats),
          at: nowIso()
        }
        state.reviews.unshift(row)
        receipts.push({ text: '已存综述：' + (topic || '未命名').slice(0, 40) })
        changed = true
        break
      }
      case 'remove_review': {
        const index = state.reviews.findIndex(row => row.id === op.id)
        if (index < 0) { errors.push('找不到这篇综述'); break }
        state.reviews.splice(index, 1)
        receipts.push({ text: '已删除综述' })
        changed = true
        break
      }
      case 'add_experiment': {
        const fields = pick(EXPERIMENT_FIELDS, op)
        if (!fields.title) { errors.push('实验记录需要一个标题'); break }
        const row = {
          ...fields,
          id: newId('e'),
          status: fields.status || 'planned',
          at: nowIso()
        }
        state.experiments.unshift(row)
        receipts.push({ text: '已记录实验：' + fields.title.slice(0, 40) })
        changed = true
        break
      }
      case 'update_experiment': {
        const row = state.experiments.find(item => item.id === op.id)
        if (!row) { errors.push('找不到这条实验记录'); break }
        Object.assign(row, pick(EXPERIMENT_FIELDS, op.patch))
        receipts.push({ text: '已更新实验记录' })
        changed = true
        break
      }
      case 'remove_experiment': {
        const index = state.experiments.findIndex(row => row.id === op.id)
        if (index < 0) { errors.push('找不到这条实验记录'); break }
        state.experiments.splice(index, 1)
        receipts.push({ text: '已删除实验记录' })
        changed = true
        break
      }
      case 'add_collab': {
        const fields = pick(COLLAB_FIELDS, op)
        if (!fields.title) { errors.push('合作需要一个标题'); break }
        const now = nowIso()
        const row = {
          ...fields,
          id: newId('c'),
          status: fields.status || 'active',
          autonomy: fields.autonomy || 'L1',
          kelinRole: fields.kelinRole || 'lead',
          goal: fields.goal || { text: fields.title, source: 'human', createdAt: now },
          team: fields.team || [],
          steps: fields.steps || [],
          environment: fields.environment || {},
          decisions: fields.decisions || [],
          experimentIds: fields.experimentIds || [],
          createdAt: fields.createdAt || now,
          updatedAt: now,
          at: fields.at || now,
        }
        state.collaborations.unshift(row)
        receipts.push({ text: '已建立合作：' + fields.title.slice(0, 40) })
        changed = true
        break
      }
      case 'update_collab': {
        const row = state.collaborations.find(item => item.id === op.id)
        if (!row) { errors.push('找不到这条合作记录'); break }
        const patch = pick(COLLAB_FIELDS, op.patch)
        Object.assign(row, patch)
        if (Object.keys(patch).length) row.updatedAt = nowIso()
        receipts.push({ text: '已更新合作' })
        changed = true
        break
      }
      case 'add_collab_step': {
        const row = state.collaborations.find(item => item.id === op.collabId)
        if (!row) { errors.push('找不到这条合作记录'); break }
        const step = { ...pick(COLLAB_STEP_FIELDS, op.step), id: newId('s'), at: nowIso() }
        row.steps = Array.isArray(row.steps) ? row.steps : []
        row.steps.push(step)
        if (row.steps.length > 200) row.steps = row.steps.slice(-200)
        row.updatedAt = nowIso()
        receipts.push({ text: '已记录协作步骤' })
        changed = true
        break
      }
      case 'decide_collab': {
        const row = state.collaborations.find(item => item.id === op.collabId)
        if (!row) { errors.push('找不到这条合作记录'); break }
        const decision = { ...pick(COLLAB_DECISION_FIELDS, op.decision), id: newId('d'), at: nowIso() }
        row.decisions = Array.isArray(row.decisions) ? row.decisions : []
        row.decisions.push(decision)
        if (COLLAB_STATUS.includes(op.status)) row.status = op.status
        row.updatedAt = nowIso()
        receipts.push({ text: '已记录决策' })
        changed = true
        break
      }
      case 'set_profile': {
        const before = state.profile || {}
        const declined = Array.isArray(state.profileDeclined) ? state.profileDeclined : []
        const write = (value, group) => {
          const cleaned = cleanProfileList(value)
          const allowed = filterDeclined(cleaned, declined, group)
          return allowed.length ? allowed : (before[group] || [])
        }
        state.profile = {
          focus: write(op.focus, 'focus'),
          sources: write(op.sources, 'sources'),
          habits: write(op.habits, 'habits'),
          updatedAt: nowIso(),
        }
        if (!Array.isArray(state.profileDeclined)) state.profileDeclined = []
        const rejected = diffDeclined(before, state.profile, state.profile.updatedAt)
        if (rejected.length) {
          const keys = new Set(state.profileDeclined.map(row => row.group + '\u0000' + row.item))
          for (const row of rejected) {
            const key = row.group + '\u0000' + row.item
            if (keys.has(key)) continue
            keys.add(key)
            state.profileDeclined.push(row)
          }
          state.profileDeclined = state.profileDeclined.slice(-DECLINED_MAX)
        }
        if (!Array.isArray(state.profileJournal)) state.profileJournal = []
        state.profileJournal = state.profileJournal.concat([{
          before: Object.assign({}, before),
          after: Object.assign({}, state.profile),
          at: state.profile.updatedAt,
        }]).slice(-20)
        receipts.push({ text: '已更新科灵记住的研究画像' })
        changed = true
        break
      }
      default:
        errors.push('不认识的操作：' + op.op)
    }
  }
  return { receipts, errors, changed }
}
