// The research desk domain model and the only write path.
// Model output is untrusted input: every field goes through a type table and
// anything not on the whitelist is dropped instead of merged.
import { cleanList, cleanText, isHttpUrl, isObject, newId, nowIso, toNumber } from './util.mjs'
import { defaultSettings } from './settings.mjs'

export const SOURCES = ['arxiv', 'europepmc', 'openalex']
export const PAPER_STATUS = ['new', 'reading', 'read', 'kept', 'dropped']
export const HYPOTHESIS_STATUS = ['draft', 'testing', 'supported', 'rejected', 'held']
export const EXPERIMENT_STATUS = ['planned', 'running', 'done', 'failed', 'rejected']
export const COLLAB_STATUS = ['active', 'waiting-human', 'done', 'abandoned']

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
  refs: 'list'
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
    case 'estatus': return EXPERIMENT_STATUS.includes(value) ? value : undefined
    case 'cstatus': return COLLAB_STATUS.includes(value) ? value : undefined
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
    questions: [],
    hypotheses: [],
    drafts: [],
    reviews: [],
    experiments: [],
    collaborations: [],
    chat: [],
    profile: { focus: [], sources: [], habits: [], updatedAt: '' },
    settings: defaultSettings(),
    updatedAt: nowIso()
  }
}

export function migrateState(raw) {
  const base = emptyState()
  if (!isObject(raw)) return base
  const state = { ...base, ...raw }
  for (const key of ['papers', 'questions', 'hypotheses', 'drafts', 'reviews', 'experiments', 'collaborations', 'chat']) {
    if (!Array.isArray(state[key])) state[key] = []
  }
  if (!isObject(state.settings)) state.settings = base.settings
  if (!isObject(state.profile)) state.profile = base.profile
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
        const clean = v => (Array.isArray(v) ? v.map(x => cleanText(x, 160)).filter(Boolean).slice(0, 12) : [])
        const before = state.profile || {}
        state.profile = {
          focus: clean(op.focus).length ? clean(op.focus) : before.focus || [],
          sources: clean(op.sources).length ? clean(op.sources) : before.sources || [],
          habits: clean(op.habits).length ? clean(op.habits) : before.habits || [],
          updatedAt: nowIso(),
        }
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
