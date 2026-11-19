// dsh-research-desk — host half.
//
// One agent tool (research_desk) plus one same-origin HTTP bridge for the
// sidebar panel. The panel talks to the bridge; the agent talks to the tool.
// Both go through the same service functions, so the UI and the agent can
// never drift apart.
//
// Written against the contracts shipped by the installed plugins:
//   tools.register      -> dsh-freebie-radar/lib/host.mjs
//   webServer.register  -> dsh-freebie-radar/lib/host.mjs
//   llm.prepareCall     -> agentero-dsh-host/lib/translate.js
import { randomUUID } from 'node:crypto'
import { Store } from './store.mjs'
import { applyOps, emptyState, migrateState, paperKey } from './desk.mjs'
import { fetchFullText, search } from './search.mjs'
import { ask as groundedAsk, chunkText } from './qa.mjs'
import { defaultRoute, listModels, streamText } from './llm.mjs'
import { cleanBlock, cleanText, isObject, parseJsonLoose } from './util.mjs'
import { coerceSettings, defaultSettings, describeSettings, readSettings, resolveSecret } from './settings.mjs'
import { adjustPvalues, oneSampleT, pairedT, parseNumbers, twoSampleWelch } from './stats.mjs'
import { generateReview, perspectiveKeys } from './review.mjs'
import { installPackages, RUNTIMES, runCode, workDirFor } from './runner.mjs'
import { exportBundle } from './export.mjs'
import { parseImport } from './import.mjs'
import { inputHash, findByHash, lineage, markOrphans } from './provenance.mjs'
import { extract as extractMetrics, judge as judgeCriteria, MAX_OUTPUT_CHARS } from './criteria.mjs'
import { filteredEnv } from './runner.mjs'
import { buildRegistry, describe as describeRegistry } from './toolRegistry.mjs'

export const name = 'dsh-research-desk'
export const inject = ['tools', 'webServer', 'agents']

const ROUTE_PREFIX = '/api/research-desk/'
const MAX_BODY = 512 * 1024
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1', '::ffff:127.0.0.1'])
const APP_SCHEME = 'dsh-app://'
const ACTIONS = ['status', 'search', 'add', 'library', 'read', 'ask', 'chat', 'chat_clear', 'hypothesis', 'review', 'gaps', 'draft', 'remove', 'undo', 'clear', 'models', 'settings', 'experiments', 'run', 'experiment_design', 'experiment_analyze', 'experiment_iterate', 'stats', 'export', 'import', 'history', 'restore']

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function sendJson(res, status, value) {
  const text = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-length', Buffer.byteLength(text))
  res.end(text)
}

function hostName(host) {
  if (!host) return ''
  return String(host).split(':')[0].replace(/^\[|\]$/g, '').toLowerCase()
}

function fromLoopback(req) {
  const peer = String((req.socket && req.socket.remoteAddress) || '').toLowerCase()
  if (peer && (LOOPBACK_HOSTS.has(peer) || peer.startsWith('127.') || peer.startsWith('::1') || peer.startsWith('::ffff:127.'))) return true
  const host = hostName(req.headers && req.headers.host)
  return LOOPBACK_HOSTS.has(host) || host === 'localhost'
}

function sameOrigin(req) {
  if (!fromLoopback(req)) return false
  const origin = req.headers && req.headers.origin
  if (!origin) return true
  const value = String(origin)
  if (value.toLowerCase().startsWith(APP_SCHEME)) return true
  const host = hostName(value.replace(/^[a-z]+:\/\//i, ''))
  return LOOPBACK_HOSTS.has(host) || host === 'localhost'
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { code: 'payload-too-large' }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) return resolve({})
      try {
        const value = JSON.parse(text)
        resolve(isObject(value) ? value : {})
      } catch {
        reject(Object.assign(new Error('invalid json'), { code: 'invalid-json' }))
      }
    })
    req.on('error', reject)
  })
}

// ── service ──────────────────────────────────────────────────────────────────

function publicPaper(paper) {
  return {
    id: paper.id,
    title: paper.title,
    abstract: (paper.abstract || '').slice(0, 1200),
    venue: paper.venue || '',
    year: paper.year || null,
    doi: paper.doi || '',
    arxivId: paper.arxivId || '',
    pmid: paper.pmid || '',
    url: paper.url || '',
    source: paper.source || '',
    authors: (paper.authors || []).slice(0, 12),
    citedBy: paper.citedBy === undefined ? null : paper.citedBy,
    tags: paper.tags || [],
    status: paper.status || 'new',
    note: paper.note || '',
    notes: paper.notes || [],
    chunks: (paper.chunks || []).length,
  }
}

function libraryView(state) {
  return {
    papers: (state.papers || []).map(publicPaper),
    hypotheses: (state.hypotheses || []).map(row => ({
      id: row.id,
      title: row.title,
      rationale: row.rationale || '',
      gap: row.gap || '',
      experiment: row.experiment || '',
      evidence: row.evidence || [],
      status: row.status || 'draft',
      at: row.at,
    })),
    drafts: (state.drafts || []).map(row => ({
      id: row.id,
      title: row.title,
      body: (row.body || '').slice(0, 20000),
      refs: row.refs || [],
      at: row.at,
    })),
    reviews: (state.reviews || []).map(row => ({
      id: row.id,
      topic: row.topic || '',
      sections: (row.sections || []).map(section => ({
        key: section.key || '',
        label: section.label || '',
        text: (section.text || '').slice(0, 20000),
        citations: section.citations || [],
      })),
      stats: row.stats || {},
      at: row.at,
    })),
    experiments: (state.experiments || []).map(row => ({
      id: row.id,
      title: row.title || '',
      runtime: row.runtime || '',
      status: row.status || 'planned',
      kind: row.kind || 'single',
      parentRunId: row.parentRunId || null,
      code: (row.code || '').slice(0, 8000),
      params: row.params || {},
      packages: row.packages || [],
      solver: row.solver || null,
      toolchain: row.toolchain || null,
      inputHash: row.inputHash || '',
      metrics: row.metrics || {},
      criteria: row.criteria || [],
      artifacts: row.artifacts || [],
      cacheHit: !!row.cacheHit,
      sourceRunId: row.sourceRunId || null,
      exitCode: row.exitCode === undefined ? null : row.exitCode,
      durationMs: row.durationMs === undefined ? null : row.durationMs,
      timedOut: !!row.timedOut,
      stdout: (row.stdout || '').slice(0, 4000),
      stderr: (row.stderr || '').slice(0, 4000),
      hypothesisId: row.hypothesisId || '',
      reason: row.reason || '',
      createdAt: row.createdAt || null,
      startedAt: row.startedAt || null,
      finishedAt: row.finishedAt || null,
      at: row.at,
    })),
    chat: (state.chat || []).slice(-50),
    profile: state.profile || { focus: [], sources: [], habits: [] },
    settings: state.settings,
    updatedAt: state.updatedAt,
  }
}

const HYPOTHESIS_SYSTEM = [
  'You turn a small reading library into falsifiable research questions.',
  'You may only use the abstracts and titles given to you.',
  'For every hypothesis, name the gap it fills and the cheapest experiment that could kill it.',
  'Prefer a question with a clear negative result over a broad direction.',
  'Never claim that a mechanism was demonstrated: the input is abstracts only.',
  'Return JSON only: {"hypotheses": [{"title": string, "rationale": string, "gap": string, "experiment": string, "evidence": [string]}]}',
  'where "evidence" holds the ids of the papers the hypothesis was derived from.',
].join('\n')

const DRAFT_SYSTEM = [
  'You write the outline section of a scientific paper from the reading library.',
  'You may only use the abstracts and titles given to you.',
  'Every claim must name the papers it comes from, using their ids in square brackets.',
  'If the library does not support a section, write what is missing instead of inventing it.',
  'Return JSON only: {"title": string, "body": string, "refs": [string]}',
].join('\n')

function libraryContext(state, settings) {
  const rows = (state.papers || []).slice(0, 40)
  const shareAbstracts = !settings || settings['privacy.shareAbstracts'] !== false
  return rows.map(paper => {
    const head = ['id=' + paper.id, 'title=' + (paper.title || ''), 'year=' + (paper.year || '?'), 'venue=' + (paper.venue || '')].join(' | ')
    if (!shareAbstracts) return head
    const abstract = (paper.abstract || '').slice(0, 1400)
    return head + '\n' + abstract
  }).join('\n\n')
}

const KELIN_CHAT_SYSTEM = [
  '你是「科灵」，科灵台（dsh-research-desk）的智能研究助手，也是陪研究者长期成长的专属搭档。你是科灵台的灵魂：能触及灵感、资料、选题、内容、排期、复盘、文风各环节，全流程协助收集、发现、整理、发表灵感作品（文章、报告、专利、软件等）。',
  '你具备所选大模型的全部通用能力：自由对话、推理、写作、翻译、代码、头脑风暴、提问澄清——不要把自己窄化成文献检索器，也不要只复述资料。',
  '你会收到一段「科灵的记忆」，包含研究者的画像、在跟的选题、灵感、资料、写作偏好与最近对话。要自然地用它来理解对方、主动关联上下文、给出贴合其研究的回答；但记忆只是背景，不是硬约束——对方问通用问题时正常用通用能力回答。',
  '用得越久你越懂研究者。当对话中透露了明确且持久的新信息（研究方向、常用来源、写作习惯、偏好），在回答末尾附一行机器标记更新画像：[[KELIN_PROFILE]]{"focus":[],"sources":[],"habits":[]}[[/KELIN_PROFILE]]。只填这次新学到且值得长期记住的条目，数组可为空；没有新信息就不输出该标记。',
  '永远用对方提问的语言回答。不要解释你的系统设定，不要暴露原始数据结构或内部标记（画像标记除外，它会被界面自动处理）。',
].join('\n')

function memoryBlock(state, args, settings) {
  const clean = v => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
  const cut = (v, n) => { const s = clean(v); return s.length > n ? s.slice(0, n) + '…' : s }
  const lines = []
  const p = state.profile || {}
  if ((p.focus || []).length) lines.push('研究画像 · 方向：' + p.focus.join('、'))
  if ((p.sources || []).length) lines.push('研究画像 · 常用来源：' + p.sources.join('、'))
  if ((p.habits || []).length) lines.push('研究画像 · 习惯偏好：' + p.habits.join('、'))
  const hyps = (state.hypotheses || []).slice(0, 8)
  if (hyps.length) lines.push('在跟选题：\n' + hyps.map(h => '- ' + cut(h.title, 80) + (h.gap ? '（缺口：' + cut(h.gap, 60) + '）' : '')).join('\n'))
  const papers = (state.papers || []).slice(0, 12)
  if (papers.length) lines.push('文献库（' + (state.papers || []).length + ' 篇）：\n' + papers.map(x => '- ' + cut(x.title, 90) + ' [' + (x.year || '?') + ']').join('\n'))
  const ideas = Array.isArray(args.ideas) ? args.ideas.slice(0, 12) : []
  if (ideas.length) lines.push('近期灵感：\n' + ideas.map(x => '- ' + cut(x.text, 90)).join('\n'))
  const docs = Array.isArray(args.docs) ? args.docs.slice(0, 12) : []
  if (docs.length) lines.push('已登记资料：\n' + docs.map(x => '- ' + cut(x.name, 90)).join('\n'))
  const rules = Array.isArray(args.rules) ? args.rules.filter(r => r && !r.off).slice(0, 8) : []
  if (rules.length) lines.push('写作偏好：' + rules.map(r => cut(r.label || r.text || r.id, 40)).join('、'))
  const chat = (state.chat || []).slice(-12)
  if (chat.length) lines.push('最近对话：\n' + chat.map(c => '用户：' + cut(c.q, 120) + '\n科灵：' + cut(c.a, 160)).join('\n'))
  return lines.length ? lines.join('\n\n') : '（目前还没有可注入的记忆，这是一次全新的对话。）'
}

function extractText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.filter(b => b && b.text && b.type === 'text').map(b => b.text).join('')
  return ''
}

function splitProfileMarker(text) {
  const raw = String(text || '')
  const re = /\[\[KELIN_PROFILE\]\]([\s\S]*?)\[\[\/KELIN_PROFILE\]\]/
  const m = raw.match(re)
  if (!m) return { message: raw.trim(), profile: null }
  let profile = null
  try {
    const parsed = JSON.parse(m[1].trim())
    if (parsed && typeof parsed === 'object') profile = parsed
  } catch (err) { profile = null }
  return { message: raw.replace(re, '').trim(), profile }
}

/**
 * Resolve the model route: the setting overrides the host default.
 * @param {object} ctx - the host context.
 * @param {object} settings - the settings in force.
 * @returns {object|undefined} a provider/model route, or undefined for the host default.
 */
function routeFor(ctx, settings) {
  const text = settings && settings['model.route'] ? String(settings['model.route']).trim() : ''
  if (!text) return undefined
  const slash = text.indexOf('/')
  if (slash <= 0 || slash === text.length - 1) return undefined
  return { provider: text.slice(0, slash), model: text.slice(slash + 1) }
}

/**
 * The papers that already carry full text: only these can back a citation.
 * @param {object} state - the workbench state.
 * @returns {Array<{paper: object, chunks: Array}>} the documents.
 */
function documentsWithText(state) {
  return (state.papers || [])
    .filter(paper => (paper.chunks || []).length)
    .map(paper => ({ paper, chunks: paper.chunks }))
}

/**
 * Turn one statistics result into a short Chinese report.
 * @param {object} result - the result of a test in lib/stats.mjs.
 * @param {number} alpha - the significance level in force.
 * @returns {string} the report.
 */
function describeStats(result, alpha) {
  const lines = []
  lines.push('检验类型：' + result.kind + '，样本量 n=' + result.n + '，alpha=' + alpha + '。')
  if (result.mean !== undefined) {
    lines.push('均值：' + Number(result.mean).toFixed(4) + (result.meanB !== undefined ? '，对照组均值：' + Number(result.meanB).toFixed(4) : ''))
  }
  if (result.t !== undefined) {
    lines.push('t=' + Number(result.t).toFixed(4) + '，df=' + (result.df === undefined ? '-' : Number(result.df).toFixed(2)) + '，p=' + (result.p === undefined ? '-' : Number(result.p).toExponential(3)))
  }
  if (result.ciLow !== undefined) {
    lines.push('置信区间：[' + Number(result.ciLow).toFixed(4) + ', ' + Number(result.ciHigh).toFixed(4) + ']')
  }
  if (result.cohensD !== undefined && isFinite(result.cohensD)) {
    lines.push('效应量 Cohen d：' + Number(result.cohensD).toFixed(3))
  }
  lines.push(result.significant ? '在给定 alpha 下达到统计显著。' : '在给定 alpha 下未达到统计显著。')
  return lines.join('\n')
}
export function createService(ctx) {
  const store = new Store(undefined, migrateState)
  let service = null

  const readState = () => store.read()

  const ensureService = () => {
    if (service) return service
    service = {
      async status() {
        const state = await readState()
        const route = defaultRoute(ctx)
        return {
          ok: true,
          action: 'status',
          message: [
            '文献库 ' + state.papers.length + ' 篇，选题 ' + state.hypotheses.length + ' 条，草稿 ' + state.drafts.length + ' 篇。',
            route ? ('默认模型：' + route.provider + '/' + route.model) : '没有默认模型，模型相关功能不可用。',
          ].join(' '),
          count: state.papers.length,
        }
      },
      async models() {
        const rows = await listModels(ctx)
        return { ok: true, action: 'models', message: '可用模型 ' + rows.length + ' 个：' + rows.slice(0, 12).map(row => row.provider + '/' + row.model).join('、'), models: rows }
      },
      async settingsView() {
        const state = await readState()
        const settings = readSettings(state)
        return {
          ok: true,
          action: 'settings',
          message: '当前设置 ' + Object.keys(settings).length + ' 项，改完即时生效。',
          settings,
          rows: describeSettings(settings),
        }
      },
      async updateSettings(args) {
        const state = await readState()
        const current = readSettings(state)
        const merged = coerceSettings(args.patch, current)
        if (merged.errors.length) {
          return { ok: false, action: 'settings', message: '设置没有保存：' + merged.errors.join('；'), settings: current, rows: describeSettings(current) }
        }
        await store.mutate('更新设置', draft => {
          draft.settings = merged.values
          draft.updatedAt = new Date().toISOString()
          return { receipts: merged.changed.map(key => ({ text: '已更新设置：' + key })), errors: [], changed: true }
        })
        const after = await readState()
        const settings = readSettings(after)
        return { ok: true, action: 'settings', message: merged.changed.length ? ('已更新 ' + merged.changed.length + ' 项设置。') : '设置没有变化。', settings, rows: describeSettings(settings), changed: merged.changed }
      },
      async resetSettings() {
        await store.mutate('恢复默认设置', draft => {
          draft.settings = defaultSettings()
          draft.updatedAt = new Date().toISOString()
          return { receipts: [{ text: '设置已恢复默认' }], errors: [], changed: true }
        })
        const after = await readState()
        const settings = readSettings(after)
        return { ok: true, action: 'settings', message: '设置已恢复默认。', settings, rows: describeSettings(settings) }
      },
      async runStats(args) {
        const state = await readState()
        const settings = readSettings(state)
        const alpha = Number(settings['stats.alpha']) || 0.05
        if (Array.isArray(args.pvalues) && args.pvalues.length) {
          const adjusted = adjustPvalues(args.pvalues.map(Number), settings['stats.adjust'] || 'holm')
          const lines = adjusted.map((p, index) => 'p' + (index + 1) + '：原始 ' + Number(args.pvalues[index]).toExponential(3) + ' → 校正后 ' + p.toExponential(3)).join('\n')
          return { ok: true, action: 'stats', message: '多重比较校正（' + (settings['stats.adjust'] || 'holm') + '）：\n' + lines, adjusted, raw: args.pvalues }
        }
        const kind = cleanText(args.kind, 20) || 'one-sample'
        const a = parseNumbers(args.groupA)
        const b = parseNumbers(args.groupB)
        let result = null
        if (kind === 'paired') result = pairedT(a, b, alpha)
        else if (kind === 'two-sample-welch' || kind === 'two-sample') result = twoSampleWelch(a, b, alpha)
        else {
          const mu0 = Number(args.mu0)
          result = oneSampleT(a, isFinite(mu0) ? mu0 : 0, alpha)
        }
        if (!result || !result.ok) {
          return { ok: false, action: 'stats', message: '算不出结果：' + ((result && result.error) || '数据不够'), stats: null }
        }
        return { ok: true, action: 'stats', message: describeStats(result, alpha), stats: result }
      },
      async doSearch(args) {
        const query = cleanText(args.query, 500)
        if (!query) return { ok: false, action: 'search', message: '检索词是空的。' }
        const settings = readSettings(await readState())
        // An explicitly empty list means "search no source at all". The settings
        // help text promises exactly that, so an empty array must not silently fall
        // back to the defaults. Only a missing argument falls back to the stored value.
        const picked = Array.isArray(args.sources) ? args.sources : settings['sources']
        const sources = Array.isArray(picked) ? picked : undefined
        if (Array.isArray(sources) && !sources.length) {
          return { ok: false, action: 'search', message: '没有选中任何数据源，检索没有执行。', papers: [], count: 0, errors: [] }
        }
        const maxResults = Math.min(Math.max(Number(args.maxResults) || Number(settings['maxResults']) || 12, 1), 40)
        const mailto = resolveSecret(settings, 'secrets.openalexMailto')
        const result = await search(query, { sources, maxResults, signal: args.signal, mailto: mailto ? mailto.value : '' })
        const papers = result.papers.map(row => ({
          title: row.title,
          abstract: row.abstract || '',
          venue: row.venue || '',
          year: row.year,
          doi: row.doi,
          arxivId: row.arxivId,
          pmid: row.pmid,
          pmcid: row.pmcid,
          url: row.url,
          source: row.source,
          authors: row.authors || [],
          tags: row.tags || [],
          citedBy: row.citedBy,
        }))
        const lines = ['检索「' + query + '」得到 ' + papers.length + ' 篇：']
        for (const paper of papers.slice(0, 12)) {
          lines.push('- [' + paper.source + '] ' + paper.title + (paper.year ? ' (' + paper.year + ')' : ''))
        }
        if (result.errors.length) lines.push('部分数据源失败：' + result.errors.join('；'))
        return { ok: true, action: 'search', message: lines.join('\n'), papers, count: papers.length, errors: result.errors }
      },
      async addPapers(args) {
        const input = Array.isArray(args.papers) ? args.papers : args.paper ? [args.paper] : []
        if (!input.length) return { ok: false, action: 'add', message: '没有要加入的文献。' }
        const ops = input.map(row => ({ op: 'add_paper', paper: row }))
        const outcome = await store.mutate('加入文献', draft => {
          const res = applyOps(draft, ops)
          draft.updatedAt = new Date().toISOString()
          return res
        })
        const state = await readState()
        const lines = outcome.receipts.map(row => row.text)
        if (outcome.errors.length) lines.push('未处理：' + outcome.errors.join('；'))
        return { ok: true, action: 'add', message: lines.join('\n') || '没有新增。', count: outcome.receipts.length, library: libraryView(state) }
      },
      async library() {
        const state = await readState()
        const papers = (state.papers || []).map(publicPaper)
        const lines = papers.length ? papers.map(p => '- [' + p.status + '] ' + p.title + (p.year ? ' (' + p.year + ')' : '') + ' · ' + (p.venue || '未知来源') + ' · ' + (p.chunks ? p.chunks + ' 段全文' : '仅摘要')) : ['文献库是空的。']
        return { ok: true, action: 'library', message: '文献库 ' + papers.length + ' 篇：\n' + lines.join('\n'), library: libraryView(state), count: papers.length }
      },
      async readPaper(args) {
        const state = await readState()
        const id = cleanText(args.paperId, 80)
        const paper = (state.papers || []).find(row => row.id === id)
        if (!paper) return { ok: false, action: 'read', message: '文献库里找不到这一篇。' }
        const fetched = await fetchFullText(paper, { signal: args.signal })
        const chunks = chunkText(fetched.text).map(chunk => ({ index: chunk.index, heading: chunk.heading, text: chunk.text }))
        await store.mutate('抓取全文', draft => {
          const target = (draft.papers || []).find(row => row.id === id)
          if (!target) return { receipts: [], errors: ['文献已被删除'], changed: false }
          target.chunks = chunks
          target.fulltextKind = fetched.kind
          target.fulltextUrl = fetched.url
          if (target.status === 'new') target.status = 'reading'
          draft.updatedAt = new Date().toISOString()
          return { receipts: [{ text: '已入库 ' + chunks.length + ' 段' }], errors: [], changed: true }
        })
        const after = await readState()
        const updated = (after.papers || []).find(row => row.id === id)
        return {
          ok: true,
          action: 'read',
          message: '已入库 ' + chunks.length + ' 段（' + fetched.kind + '），来自 ' + (fetched.url || '摘要') + '。',
          chunks: chunks.length,
          kind: fetched.kind,
          paper: updated ? publicPaper(updated) : null,
          library: libraryView(after),
        }
      },
      async askQuestion(args) {
        const state = await readState()
        const question = cleanText(args.question, 1000)
        if (!question) return { ok: false, action: 'ask', message: '问题是空的。' }
        const wanted = Array.isArray(args.paperIds) && args.paperIds.length ? new Set(args.paperIds.map(String)) : null
        const documents = (state.papers || [])
          .filter(paper => (paper.chunks || []).length)
          .filter(paper => !wanted || wanted.has(paper.id))
          .map(paper => ({ paper, chunks: paper.chunks }))
        if (!documents.length) {
          return { ok: false, action: 'ask', message: '还没有入库全文。先对文献执行 read，再提问。', library: libraryView(state) }
        }
        const settings = readSettings(state)
        const shareFullText = settings['qa.shareFullText'] !== false
        const scoped = shareFullText
          ? documents
          : documents
            .map(doc => ({ paper: doc.paper, chunks: [{ index: 0, heading: 'Abstract', text: doc.paper.abstract || '' }] }))
            .filter(doc => doc.chunks[0].text)
        if (!scoped.length) {
          return { ok: false, action: 'ask', message: '库里没有摘要，也没有全文，无法作答。', library: libraryView(state) }
        }
        const result = await groundedAsk(ctx, {
          question,
          documents: scoped,
          limit: Math.min(Math.max(Number(settings['qa.limit']) || 8, 1), 20),
          minScore: Number(settings['qa.minScore']),
          signal: args.signal,
          route: args.route || routeFor(ctx, settings),
        })
        const lines = [result.answer]
        if (result.citations.length) {
          lines.push('')
          lines.push('已核验引文 ' + result.citations.length + ' 条：')
          for (const cite of result.citations) lines.push('- ' + cite.chunkId + '「' + cite.quote.slice(0, 80) + '」')
        }
        if (result.unverified.length) {
          lines.push('')
          lines.push('未通过核验的引文 ' + result.unverified.length + ' 条（已剔除）：')
          for (const cite of result.unverified) lines.push('- ' + cite.chunkId + '：' + cite.reason)
        }
        await store.mutate('问答记录', draft => {
          draft.chat = (draft.chat || []).concat([{ q: question, a: result.answer, at: new Date().toISOString(), verified: result.citations.length }]).slice(-200)
          draft.updatedAt = new Date().toISOString()
          return { receipts: [], errors: [], changed: true }
        }, { undoable: false })
        // 检索无命中 / 模型没答成是正常业务结果，不是系统异常：服务端给人话，
        // 客户端照常渲染，不再走「ok:false → 抛异常 → 拼英文原文」路径。
        const noHit = result.ok === false
        return { ok: true, action: 'ask', message: lines.join('\n'), noHit, citations: result.citations, unverified: result.unverified, hits: result.hits }
      },

      async chatQuestion(args) {
        const state = await readState()
        const question = cleanText(args.question, 4000)
        if (!question) return { ok: false, action: 'chat', message: '问题是空的。' }
        const settings = readSettings(state)
        const memory = memoryBlock(state, args, settings)
        const system = KELIN_CHAT_SYSTEM + '\n\n—— 科灵的记忆 ——\n' + memory
        const preferred = args.route || routeFor(ctx, settings)
        const fallback = defaultRoute(ctx)
        const routes = []
        const addRoute = r => { if (r && r.provider && r.model && !routes.some(x => x.provider === r.provider && x.model === r.model)) routes.push(r) }
        addRoute(preferred)
        addRoute(fallback)
        // Last resort: any model the host actually lists, so 科灵 stays usable
        // even when the configured override or host default has no adapter/key.
        try {
          const catalog = await listModels(ctx)
          for (const m of catalog.slice(0, 6)) addRoute({ provider: m.provider, model: m.model })
        } catch (err) { /* catalog unavailable; keep explicit routes only */ }
        let raw = ''
        let lastErr = null
        for (const route of (routes.length ? routes : [undefined])) {
          try {
            raw = await streamText(ctx, {
              system,
              user: question,
              signal: args.signal,
              temperature: 0.5,
              maxTokens: 3000,
              effort: args.effort,
              route,
            })
            break
          } catch (err) {
            lastErr = err
          }
        }
        if (!raw) {
          return { ok: false, action: 'chat', message: '模型调用失败：' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)) }
        }
        const split = splitProfileMarker(raw)
        let outcome = { receipts: [], errors: [], changed: false }
        if (split.profile) {
          outcome = await store.mutate('更新科灵画像', draft => {
            const res = applyOps(draft, [Object.assign({ op: 'set_profile' }, split.profile)])
            return res
          }, { undoable: false })
        }
        const answer = split.message || '（无内容）'
        await store.mutate('对话记录', draft => {
          draft.chat = (draft.chat || []).concat([{ q: question, a: answer, at: new Date().toISOString(), verified: 0 }]).slice(-200)
          draft.updatedAt = new Date().toISOString()
          return { receipts: [], errors: [], changed: true }
        }, { undoable: false })
        const after = await readState()
        return { ok: true, action: 'chat', message: answer, library: libraryView(after), profileUpdated: !!(split.profile && outcome.changed) }
      },
      async makeHypothesis(args) {
        const state = await readState()
        if (!state.papers.length) return { ok: false, action: 'hypothesis', message: '文献库是空的，先检索并加入文献。' }
        const context = libraryContext(state, readSettings(state))
        let raw = ''
        try {
          raw = await streamText(ctx, {
            system: HYPOTHESIS_SYSTEM,
            user: ['Reading library:', '', context].join('\n'),
            signal: args.signal,
            temperature: 0.3,
            maxTokens: 3000,
            route: args.route || routeFor(ctx, readSettings(state)),
          })
        } catch (err) {
          return { ok: false, action: 'hypothesis', message: '模型调用失败：' + (err && err.message ? err.message : String(err)) }
        }
        const parsed = parseJsonLoose(raw)
        const list = parsed && Array.isArray(parsed.hypotheses) ? parsed.hypotheses : []
        if (!list.length) return { ok: false, action: 'hypothesis', message: '模型没有给出可用选题。' }
        const ids = new Set(state.papers.map(p => p.id))
        const ops = list.map(item => ({
          op: 'add_hypothesis',
          title: item && item.title,
          rationale: item && item.rationale,
          gap: item && item.gap,
          experiment: item && item.experiment,
          evidence: Array.isArray(item && item.evidence) ? item.evidence.filter(id => ids.has(String(id))) : [],
        }))
        const outcome = await store.mutate('生成选题', draft => {
          const res = applyOps(draft, ops)
          draft.updatedAt = new Date().toISOString()
          return res
        })
        const after = await readState()
        const lines = outcome.receipts.map(row => row.text)
        if (outcome.errors.length) lines.push('未处理：' + outcome.errors.join('；'))
        return { ok: true, action: 'hypothesis', message: lines.join('\n') || '没有新增选题。', library: libraryView(after), count: outcome.receipts.length }
      },
      async makeDraft(args) {
        const state = await readState()
        if (!state.papers.length) return { ok: false, action: 'draft', message: '文献库是空的，先检索并加入文献。' }
        const context = libraryContext(state, readSettings(state))
        const instruction = cleanText(args.instruction, 2000) || '写一个结构完整的论文大纲。'
        let raw = ''
        try {
          raw = await streamText(ctx, {
            system: DRAFT_SYSTEM,
            user: ['Instruction: ' + instruction, '', 'Reading library:', '', context].join('\n'),
            signal: args.signal,
            temperature: 0.3,
            maxTokens: 4000,
            route: args.route || routeFor(ctx, readSettings(state)),
          })
        } catch (err) {
          return { ok: false, action: 'draft', message: '模型调用失败：' + (err && err.message ? err.message : String(err)) }
        }
        const parsed = parseJsonLoose(raw)
        // The model often answers in prose, or returns JSON that was cut off by the
        // token limit. Salvage prose instead of dropping the whole answer, and echo
        // the raw head when nothing usable is left.
        const jsonBody = parsed && typeof parsed.body === 'string' ? parsed.body : ''
        const fence = raw.indexOf('```')
        const prose = fence >= 0 ? raw.slice(raw.indexOf('\n', fence) + 1, raw.lastIndexOf('```')) : raw
        const usableProse = /^[[{]/.test(prose.trim()) ? '' : prose.trim()
        const title = cleanText(parsed && parsed.title, 400) || cleanText(usableProse.split('\n')[0], 80) || instruction.slice(0, 60)
        const body = cleanBlock(jsonBody || usableProse, 60000)
        if (!body) {
          return { ok: false, action: 'draft', message: '模型没有给出正文。原始输出开头：' + (raw.slice(0, 200) || '（空）') }
        }
        const outcome = await store.mutate('生成草稿', draft => {
          const res = applyOps(draft, [{ op: 'add_draft', title, body, refs: (parsed && Array.isArray(parsed.refs)) ? parsed.refs : [] }])
          draft.updatedAt = new Date().toISOString()
          return res
        })
        const after = await readState()
        return { ok: true, action: 'draft', message: outcome.receipts.map(row => row.text).join('\n') || '草稿已存。', library: libraryView(after) }
      },
      async makeReview(args) {
        const state = await readState()
        const documents = documentsWithText(state)
        if (!documents.length) {
          return { ok: false, action: 'review', message: '还没有入库全文。先对文献执行 read，再生成综述。', library: libraryView(state) }
        }
        const settings = readSettings(state)
        const wanted = Array.isArray(args.perspectives) && args.perspectives.length
          ? args.perspectives.filter(key => perspectiveKeys().includes(key))
          : (Array.isArray(settings['review.perspectives']) ? settings['review.perspectives'].slice() : perspectiveKeys())
        const limit = Math.min(Math.max(Number(args.limit) || Number(settings['review.maxSections']) || 4, 1), 20)
        const topic = cleanText(args.topic, 500)
        const result = await generateReview(ctx, {
          documents,
          perspectives: wanted,
          topic,
          limit,
          signal: args.signal,
          route: routeFor(ctx, settings),
        })
        const sections = (result.sections || []).map(section => ({
          key: section.key,
          label: section.label,
          text: section.text,
          citations: section.citations || [],
          unverified: section.unverified || [],
        }))
        const usable = sections.filter(section => section.text && section.text !== '文献库中没有可支撑的段落。')
        if (!usable.length) {
          return { ok: false, action: 'review', message: '检索不到可支撑的段落，没有生成综述。换个主题，或给更多文献抓全文。', library: libraryView(state) }
        }
        const outcome = await store.mutate('生成综述', draft => {
          const res = applyOps(draft, [{ op: 'add_review', topic: topic || '未命名主题', sections, stats: result.stats }])
          draft.updatedAt = new Date().toISOString()
          return res
        })
        const after = await readState()
        const lines = outcome.receipts.map(row => row.text)
        if (outcome.errors.length) lines.push('未处理：' + outcome.errors.join('；'))
        const failed = sections.filter(section => section.error)
        if (failed.length) lines.push('有 ' + failed.length + ' 个视角没完成：' + failed.map(section => section.label).join('、'))
        return { ok: true, action: 'review', message: lines.join('\n') || '综述已存。', review: { topic, sections, stats: result.stats }, library: libraryView(after) }
      },
      async makeGaps(args) {
        const state = await readState()
        const documents = documentsWithText(state)
        if (!documents.length) {
          return { ok: false, action: 'gaps', message: '还没有入库全文。先对文献执行 read，再找研究缺口。', library: libraryView(state) }
        }
        const settings = readSettings(state)
        const topic = cleanText(args.topic, 500)
        const result = await generateReview(ctx, {
          documents,
          perspectives: ['gaps'],
          topic,
          limit: Math.min(Math.max(Number(args.limit) || 8, 1), 20),
          signal: args.signal,
          route: routeFor(ctx, settings),
        })
        const section = (result.sections || [])[0]
        if (!section || !section.text || section.text === '文献库中没有可支撑的段落。') {
          return { ok: false, action: 'gaps', message: '检索不到可支撑的段落，找不出研究缺口。', library: libraryView(state) }
        }
        const outcome = await store.mutate('生成研究缺口', draft => {
          const res = applyOps(draft, [{ op: 'add_review', topic: (topic || '未命名主题') + ' · 研究缺口', sections: [{ key: 'gaps', label: '研究缺口', text: section.text, citations: section.citations || [] }], stats: result.stats }])
          draft.updatedAt = new Date().toISOString()
          return res
        })
        const after = await readState()
        const lines = outcome.receipts.map(row => row.text)
        if (outcome.errors.length) lines.push('未处理：' + outcome.errors.join('；'))
        return { ok: true, action: 'gaps', message: lines.join('\n') || '研究缺口已存。', gaps: { text: section.text, citations: section.citations || [] }, library: libraryView(after) }
      },
      async listExperiments() {
        const state = await readState()
        const rows = state.experiments || []
        const lines = rows.length
          ? rows.map(row => '- [' + row.status + '] ' + row.title + ' · ' + (row.runtime || '?') + ' · ' + (row.durationMs || 0) + 'ms' + (row.timedOut ? ' · 超时' : '') + (row.exitCode !== undefined && row.exitCode !== null ? ' · exit=' + row.exitCode : ''))
          : ['还没有实验记录。']
        return { ok: true, action: 'experiments', message: '实验记录 ' + rows.length + ' 条：\n' + lines.join('\n'), experiments: libraryView(state).experiments, count: rows.length }
      },
      async runExperiment(args) {
        const emit = typeof args.emit === 'function' ? args.emit : () => {}
        const onStream = typeof args.onStream === 'function' ? args.onStream : null
        const state0 = await readState()
        const settings = readSettings(state0)
        if (settings['runner.enabled'] !== true) {
          return { ok: false, action: 'run', message: '没有开启外部工具调用。请在设置面板把「允许调用外部工具」（runner.enabled）打开后再试。' }
        }
        const runtime = RUNTIMES.includes(args.runtime) ? args.runtime : 'python'
        const code = typeof args.code === 'string' ? args.code : ''
        if (!code.trim()) return { ok: false, action: 'run', message: '代码是空的。' }
        const dataDir = settings['storage.dataDir'] || ''
        const workDir = workDirFor(settings, dataDir)
        const title = cleanText(args.title, 200) || ('运行 ' + new Date().toISOString().slice(0, 16))
        const packages = Array.isArray(args.packages) ? args.packages : []
        const params = isObject(args.params) ? args.params : {}
        const solver = isObject(args.solver) ? args.solver : null
        const parentRunId = cleanText(args.parentRunId, 80) || null
        const force = args.force === true
        const toolchain = { runtime, version: runtime === 'python' ? (settings['runner.pythonVersion'] || 'unknown') : process.version }
        const hash = inputHash({ runtime, code, params, packages, solver, toolchain })
        const now = new Date().toISOString()

        await store.mutate('回收超时实验预留', draft => {
          const orphans = markOrphans(draft.experiments || [], now)
          for (const row of (draft.experiments || [])) {
            if (orphans.includes(row.id)) { row.status = 'failed'; row.reason = 'orphan: 执行被中断或超时，已由启动回收标记'; row.finishedAt = now }
          }
          return { receipts: [], errors: [], changed: false }
        }, { undoable: false })

        const reservation = await store.mutate('预留实验槽位', draft => {
          if (!force) {
            const found = findByHash(hash, draft.experiments || [])
            if (found) return { hit: found.status === 'done' ? 'done' : 'running', run: found }
          }
          const res = applyOps(draft, [{
            op: 'add_experiment', title, runtime, code, params, packages, solver, toolchain,
            hypothesisId: cleanText(args.hypothesisId, 80), parentRunId,
            kind: cleanText(args.kind, 20) || 'single',
            inputHash: hash, status: 'running', startedAt: now, createdAt: now, cacheHit: false,
          }])
          const newRow = (draft.experiments || [])[0]
          return { hit: 'new', runId: newRow && newRow.id, errs: res.errors }
        })
        if (reservation.hit === 'done') {
          const done = reservation.run
          return { ok: true, action: 'run', message: '相同输入已运行过，直接复用缓存结果（' + (done.title || title) + '）。', experiment: libraryView(await readState()).experiments.find(r => r.id === done.id) || null, cacheHit: true, library: libraryView(await readState()) }
        }
        if (reservation.hit === 'running') {
          return { ok: true, action: 'run', message: '相同输入正在运行中，复用已有任务（runId: ' + reservation.run.id + '）。请稍后用 experiments 查看结果。', experiment: libraryView(await readState()).experiments.find(r => r.id === reservation.run.id) || null, reused: true }
        }
        const runId = reservation.runId
        if (!runId) return { ok: false, action: 'run', message: '无法创建实验预留记录。' }
        emit('prepared', { runId: runId })

        let installNote = ''
        if (packages.length) {
          emit('install', { packages: packages })
          const install = await installPackages({ runtime, packages, settings, workDir, signal: args.signal, dataDir, env: filteredEnv('install'), onStream: onStream ? (k, t) => onStream('install-' + k, t) : null })
          if (!install.ok) {
            await store.mutate('实验装包失败', draft => { const row = (draft.experiments || []).find(r => r.id === runId); if (row) { row.status = 'failed'; row.reason = '装包失败'; row.finishedAt = new Date().toISOString() } return { receipts: [], errors: [], changed: false } }, { undoable: false })
            return { ok: false, action: 'run', message: '装包失败：' + (install.error || '未知原因'), experiment: { title, runtime, status: 'failed' } }
          }
          installNote = '已安装：' + install.installed.join('、')
        }
        emit('run', { runtime: runtime })
        const result = await runCode({ runtime, code, settings, workDir, signal: args.signal, dataDir, env: filteredEnv('exec'), onStream })
        const status = result.ok ? 'done' : 'failed'
        const finishedAt = new Date().toISOString()
        await store.mutate('落库实验结果', draft => {
          const row = (draft.experiments || []).find(r => r.id === runId)
          if (row) {
            row.status = status; row.exitCode = result.exitCode === null ? undefined : result.exitCode;
            row.stdout = result.stdout || ''; row.stderr = result.stderr || '';
            row.durationMs = result.durationMs; row.timedOut = !!result.timedOut;
            row.finishedAt = finishedAt;
          }
          draft.updatedAt = finishedAt
          return { receipts: [{ text: '实验已落库：' + title.slice(0, 40) }], errors: [], changed: true }
        })
        const after = await readState()
        const lines = []
        if (installNote) lines.push(installNote)
        lines.push((result.ok ? '运行成功' : '运行失败') + '：' + title + '（' + runtime + '，' + (result.durationMs || 0) + 'ms）')
        if (result.error) lines.push('原因：' + result.error)
        if (result.stdout) lines.push('标准输出：\n' + String(result.stdout).slice(0, 4000))
        if (result.stderr) lines.push('错误输出：\n' + String(result.stderr).slice(0, 4000))
        return { ok: result.ok, action: 'run', message: lines.join('\n'), experiment: libraryView(after).experiments.find(r => r.id === runId) || null, runId, library: libraryView(after) }
      },
      async exportData(args) {
        const state = await readState()
        const formats = Array.isArray(args.formats) && args.formats.length ? args.formats : ['md', 'bib', 'json']
        const bundle = exportBundle(state, formats)
        if (!bundle.length) return { ok: false, action: 'export', message: '没有可导出的格式（md / bib / json / typst / latex）。' }
        const lines = bundle.map(file => '- ' + file.filename + '（' + file.mime + '，' + file.content.length + ' 字符）')
        return { ok: true, action: 'export', message: '已生成 ' + bundle.length + ' 个文件：\n' + lines.join('\n'), files: bundle, count: bundle.length }
      },
      async importData(args) {
        const parsed = parseImport(args.text || args.content, args.format)
        if (!parsed.papers.length) return { ok: false, action: 'import', message: parsed.error || '没有可导入的文献。', imported: 0, skipped: 0, format: parsed.format }
        let outcome = { receipts: [], errors: [], changed: false }
        await store.mutate('导入文献', draft => {
          outcome = applyOps(draft, parsed.papers.map(paper => ({ op: 'add_paper', paper })))
          draft.updatedAt = new Date().toISOString()
          return outcome
        })
        const imported = outcome.receipts.length
        const skipped = outcome.errors.length
        const after = await readState()
        return {
          ok: true, action: 'import',
          message: '已导入 ' + imported + ' 篇' + (skipped ? '，跳过 ' + skipped + ' 篇（重复或无效）。' : '。'),
          imported, skipped, format: parsed.format, errors: outcome.errors, library: libraryView(after),
        }
      },
      async removePaper(args) {
        const id = cleanText(args.paperId, 80)
        const outcome = await store.mutate('移出文献', draft => {
          const res = applyOps(draft, [{ op: 'remove_paper', id }])
          draft.updatedAt = new Date().toISOString()
          return res
        })
        const after = await readState()
        return { ok: true, action: 'remove', message: outcome.receipts.map(row => row.text).join('\n') || '未处理。', library: libraryView(after) }
      },
      async clearAll() {
        let removed = 0
        await store.mutate('清空数据', draft => {
          removed = (draft.papers || []).length
          draft.papers = []
          draft.questions = []
          draft.hypotheses = []
          draft.drafts = []
          draft.reviews = []
          draft.experiments = []
          draft.chat = []
          draft.updatedAt = new Date().toISOString()
          return { receipts: [{ text: '已清空 ' + removed + ' 篇文献及全部笔记。' }], errors: [], changed: true }
        })
        const after = await readState()
        return { ok: true, action: 'clear', message: '已清空 ' + removed + ' 篇文献及全部笔记，可点撤销恢复。', count: removed, library: libraryView(after) }
      },
      async clearChat(args) {
        // 只清对话，不动文献/选题/画像。last=true 时删最后一条问答（供「重新生成」用）。
        const lastOnly = !!(args && args.last)
        const before = await readState()
        const old = (before.chat || []).length
        await store.mutate(lastOnly ? '重答上一问' : '清空对话', draft => {
          const rows = draft.chat || []
          draft.chat = lastOnly ? rows.slice(0, Math.max(0, rows.length - 1)) : []
          draft.updatedAt = new Date().toISOString()
          return { receipts: [], errors: [], changed: true }
        }, { undoable: false })
        const after = await readState()
        return { ok: true, action: 'chat_clear', message: lastOnly ? '已删除上一回答。' : '已清空 ' + old + ' 条对话。', library: libraryView(after) }
      },
      async undo() {
        const step = await store.undoStep()
        const after = await readState()
        return { ok: step.ok, action: 'undo', message: step.ok ? '已撤销：' + step.label : '没有可撤销的操作。', library: libraryView(after) }
      },
      async history() {
        const steps = store.history()
        return { ok: true, action: 'history', message: steps.length ? '共有 ' + steps.length + ' 个可回溯的历史节点。' : '还没有可回溯的历史节点。', steps, count: steps.length }
      },
      async restore(args) {
        const index = Number(args.index)
        const step = await store.restore(index)
        const after = await readState()
        return { ok: step.ok, action: 'restore', message: step.ok ? '已回到节点：' + step.label : '这个历史节点不存在。', library: libraryView(after) }
      },
      async experimentDesign(args) {
        const state = await readState()
        const hypothesisId = cleanText(args.hypothesisId, 80) || null
        const hyp = (state.hypotheses || []).find(h => h.id === hypothesisId) || null
        const title = cleanText(args.title, 200) || (hyp ? ('验证：' + (hyp.title || '').slice(0, 40)) : '新实验设计')
        const code = typeof args.code === 'string' ? args.code : ''
        const runtime = RUNTIMES.includes(args.runtime) ? args.runtime : 'python'
        const params = isObject(args.params) ? args.params : {}
        const criteria = Array.isArray(args.criteria) ? args.criteria.slice(0, 50) : []
        const spec = { title, runtime, hypothesisId, code, params, packages: Array.isArray(args.packages) ? args.packages : [], criteria, design: isObject(args.design) ? args.design : { variables: [], control: '', grid: [] } }
        return { ok: true, action: 'experiment_design', message: '实验设计已生成：' + title + '。确认后可用 run 执行（带上 code/params/hypothesisId）。', spec, registry: describeRegistry(buildRegistry(state)), library: libraryView(state) }
      },
      async experimentAnalyze(args) {
        const runId = cleanText(args.runId, 80) || null
        const state = await readState()
        const row = runId ? (state.experiments || []).find(r => r.id === runId) : (state.experiments || [])[0]
        if (!row) return { ok: false, action: 'experiment_analyze', message: '找不到要分析的实验记录。' }
        const extractors = Array.isArray(args.extractors) ? args.extractors.slice(0, 50) : []
        const criteria = Array.isArray(args.criteria) ? args.criteria.slice(0, 50) : ((row.criteria && row.criteria.length) ? row.criteria : [])
        const metrics = extractMetrics(row.stdout || '', extractors)
        const judged = judgeCriteria(metrics, criteria)
        const outcome = await store.mutate('分析实验结果', draft => {
          const target = (draft.experiments || []).find(r => r.id === row.id)
          if (target) { target.metrics = metrics; target.criteria = judged.results || [] }
          draft.updatedAt = new Date().toISOString()
          return { receipts: [{ text: '已分析实验：' + (row.title || row.id).slice(0, 40) }], errors: [], changed: true }
        })
        const lines = ['实验分析：' + (row.title || row.id), '判据：' + (judged.passed ? '全部通过' : '未全部通过')]
        for (const res of (judged.results || [])) lines.push('- ' + res.id + '：' + res.verdict + (res.ok ? '' : '（不满足）'))
        return { ok: true, action: 'experiment_analyze', message: lines.join('\n'), runId: row.id, metrics, criteria: judged.results || [], passed: judged.passed, library: libraryView(await readState()) }
      },
      async experimentIterate(args) {
        const runId = cleanText(args.runId, 80) || null
        const state = await readState()
        const row = runId ? (state.experiments || []).find(r => r.id === runId) : (state.experiments || [])[0]
        if (!row) return { ok: false, action: 'experiment_iterate', message: '找不到作为基准的实验记录。' }
        const nextParams = isObject(args.params) ? args.params : (isObject(row.params) ? { ...row.params } : {})
        const verdict = typeof args.verdict === 'string' ? args.verdict : ((row.criteria || []).length && (row.criteria || []).every(c => c.ok) ? 'supported' : 'held')
        const next = { op: 'add_experiment', title: '迭代：' + (row.title || '').slice(0, 36), runtime: row.runtime || 'python', code: row.code || '', params: nextParams, packages: row.packages || [], solver: row.solver || null, parentRunId: row.id, hypothesisId: row.hypothesisId || '', kind: 'verify', status: 'planned', createdAt: new Date().toISOString() }
        let wrote = null
        if (row.hypothesisId && ['supported', 'rejected', 'held'].includes(verdict)) {
          wrote = await store.mutate('回写假说状态', draft => {
            const res = applyOps(draft, [{ op: 'update_hypothesis', id: row.hypothesisId, patch: { status: verdict } }])
            return res
          })
        }
        await store.mutate('生成下一轮实验', draft => { applyOps(draft, [next]); draft.updatedAt = new Date().toISOString(); return { receipts: [{ text: '已生成下一轮实验设计' }], errors: [], changed: true } })
        const msg = '已生成下一轮实验设计（父记录 ' + row.id + '）。' + (wrote ? '关联假说状态已更新为 ' + verdict + '。' : (row.hypothesisId ? '' : ' 该实验未关联假说，未回写状态。'))
        return { ok: true, action: 'experiment_iterate', message: msg, parentRunId: row.id, hypothesisStatus: wrote ? verdict : null, library: libraryView(await readState()) }
      },
    }
    return service
  }

  const run = async (args, signal, extra) => {
    const svc = ensureService()
    const action = cleanText(args && args.action, 40) || 'status'
    if (!ACTIONS.includes(action)) return { ok: false, action, message: '不认识的操作：' + action }
    const payload = isObject(args) ? Object.assign({}, args, extra || {}, { signal }) : Object.assign({ signal }, extra || {})
    try {
      switch (action) {
        case 'status': return await svc.status(payload)
        case 'models': return await svc.models(payload)
        case 'settings': return args.reset ? await svc.resetSettings(payload) : (args.patch ? await svc.updateSettings(payload) : await svc.settingsView(payload))
        case 'stats': return await svc.runStats(payload)
        case 'search': return await svc.doSearch(payload)
        case 'add': return await svc.addPapers(payload)
        case 'library': return await svc.library(payload)
        case 'read': return await svc.readPaper(payload)
        case 'ask': return await svc.askQuestion(payload)
        case 'chat': return await svc.chatQuestion(payload)
        case 'chat_clear': return await svc.clearChat(payload)
        case 'hypothesis': return await svc.makeHypothesis(payload)
        case 'draft': return await svc.makeDraft(payload)
        case 'review': return await svc.makeReview(payload)
        case 'gaps': return await svc.makeGaps(payload)
        case 'experiments': return await svc.listExperiments(payload)
        case 'run': return await svc.runExperiment(payload)
        case 'experiment_design': return await svc.experimentDesign(payload)
        case 'experiment_analyze': return await svc.experimentAnalyze(payload)
        case 'experiment_iterate': return await svc.experimentIterate(payload)
        case 'export': return await svc.exportData(payload)
        case 'import': return await svc.importData(payload)
        case 'remove': return await svc.removePaper(payload)
        case 'undo': return await svc.undo(payload)
        case 'history': return await svc.history(payload)
        case 'restore': return await svc.restore(payload)
        case 'clear': return await svc.clearAll(payload)
        default: return { ok: false, action, message: '不认识的操作：' + action }
      }
    } catch (err) {
      return { ok: false, action, message: '操作失败：' + (err && err.message ? err.message : String(err)) }
    }
  }

  const chatStream = async (payload, stream) => {
    const question = cleanText(payload && payload.question, 4000)
    if (!question) { stream.write('error', { message: '问题是空的。' }); stream.close(); return }
    const agents = ctx.get && ctx.get('agents')
    if (!agents || !agents.create) { stream.write('error', { message: '当前环境不支持 Agent 调度，科灵暂时无法调用工具。' }); stream.close(); return }
    const state = await readState()
    const settings = readSettings(state)
    const memory = memoryBlock(state, payload, settings)
    // 配置里的 model.route 可能是无 adapter 的项（如 workbuddy-vision/hy4flash-free）：
    // agent 只吃单一 route 且调用失败时静默，不像 streamText 有回退链。
    // 用真实模型目录校验，不在目录里就回退到 host 默认 / 目录首项。
    const configured = routeFor(ctx, settings)
    let route = configured
    try {
      const catalog = await listModels(ctx)
      const inCatalog = r => !!(r && catalog.some(m => m.provider === r.provider && m.model === r.model))
      if (!inCatalog(route)) {
        const fb = defaultRoute(ctx)
        route = inCatalog(fb) ? fb : (catalog.length ? { provider: catalog[0].provider, model: catalog[0].model } : route)
      }
    } catch (e) {}
    const effort = payload.effort ? String(payload.effort) : ''
    const agentOptions = {}
    if (route) { agentOptions.provider = route.provider; agentOptions.model = route.model }
    if (effort) agentOptions.reasoningEffort = effort === 'mid' ? 'medium' : effort
    if (payload.diag) stream.write('diag', Object.assign({ at: "options" }, { route, agentOptions, effort }))
      const sessionId = randomUUID()
    const wantedPerm = payload.perm || 'read-only'
    let agent = null, dispose = null, offStream = null, permApplied = '', deltaText = ''
    try {
      const mk = opts => agents.create(Object.assign({
        sessionId,
        meta: { origin: 'subagent', plugin: 'dsh-research-desk' },
        setup: async agentCtx => {
          try {
            const pp = ctx.permissionPresets
            const sess = agentCtx && agentCtx.session
            if (pp && pp.set && sess) {
              for (const name of [wantedPerm, 'read-only', 'workspace-write', 'danger-full-access']) {
                try { await pp.set(sess, name); permApplied = name; break } catch (e) {}
              }
            }
          } catch (e) {}
        },
      }, opts))
      let created
      try {
        created = await mk({ agentOptions, signal: stream.signal })
      } catch (e) {
        const retry = Object.assign({}, agentOptions)
        delete retry.reasoningEffort
        created = await mk({ agentOptions: retry, signal: stream.signal })
      }
      if (payload.diag) stream.write('diag', Object.assign({ at: "created" }, { hasAgent: !!created.agent, keys: Object.keys(created) }))
      agent = created.agent
      dispose = created.dispose
      if (stream.signal && stream.signal.addEventListener) {
        stream.signal.addEventListener('abort', () => { try { if (agent && agent.cancel) agent.cancel('user stopped') } catch (e) {} }, { once: true })
      }
      const onStream = ev => {
        try {
          const evAgent = ev && ev.agent
          if (agent && evAgent !== agent) {
            const sid = evAgent && evAgent.session && evAgent.session.id
            if (sid !== sessionId) return
          }
          const frame = ev && ev.frame
          if (frame && frame.type === 'chunk') {
            const c = frame.chunk
            if (c && c.text && (c.type === 'text-delta' || c.type === 'reasoning-delta')) {
              const reasoning = c.type === 'reasoning-delta'
              if (!reasoning) deltaText += c.text
              stream.write('delta', { text: c.text, reasoning })
            }
          }
        } catch (e) {}
      }
      offStream = ctx.on('agent/assistant-stream', onStream, { global: true })
      const boundary = { role: 'user', content: [{ type: 'text', text: KELIN_CHAT_SYSTEM + '\n\n—— 科灵的记忆 ——\n' + memory + '\n\n（以上是本次对话的背景记忆与协作准则，请据此回答用户接下来的问题。）' }], source: { kind: 'plugin:dsh-research-desk' }, id: randomUUID() }
      if (agent.inject) agent.inject(boundary)
      if (agent.followup) agent.followup({ role: 'user', content: [{ type: 'text', text: question }], source: { kind: 'user' }, id: randomUUID() })
      if (agent.whenIdle) await agent.whenIdle()
      if (payload.diag) stream.write('diag', Object.assign({ at: "idle" }, { deltaLen: deltaText.length }))
      let answer = ''
      try {
        const msgs = agent.session && agent.session.deriveMessages ? agent.session.deriveMessages() : []
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i] && msgs[i].role === 'assistant') { answer = extractText(msgs[i].content); if (answer) break }
        }
      } catch (e) {}
      if (payload.diag) stream.write('diag', Object.assign({ at: "derived" }, { answerLen: answer.length, deltaLen: deltaText.length }))
      if (!answer) answer = deltaText
      if (!answer) answer = '（本轮没有产生可显示的回答。）'
      const split = splitProfileMarker(answer)
      let changedProfile = false
      if (split.profile) {
        const outcome = await store.mutate('更新科灵画像', draft => applyOps(draft, [Object.assign({ op: 'set_profile' }, split.profile)]), { undoable: false })
        changedProfile = !!(outcome && outcome.changed)
      }
      const finalAnswer = split.message || answer
      await store.mutate('对话记录', draft => {
        draft.chat = (draft.chat || []).concat([{ q: question, a: finalAnswer, at: new Date().toISOString(), verified: 0 }]).slice(-200)
        draft.updatedAt = new Date().toISOString()
        return { receipts: [], errors: [], changed: true }
      }, { undoable: false })
      const after = await readState()
      stream.write('done', { ok: true, action: 'chat', message: finalAnswer, library: libraryView(after), profileUpdated: changedProfile, perm: permApplied, viaAgent: true })
    } catch (err) {
      stream.write('error', { message: '科灵调用工具时出错：' + (err && err.message ? err.message : String(err)) })
    } finally {
      if (offStream) offStream()
      if (dispose) { try { await dispose() } catch (e) {} }
      stream.close()
    }
  }

  const experimentStream = async (payload, stream) => {
    const emit = (type, data) => stream.write(type, data || {})
    try {
      emit('phase', { phase: 'start', message: '正在准备实验…' })
      const inner = Object.assign({}, payload, { action: 'run' })
      const result = await run(inner, stream.signal, {
        emit,
        onStream: (kind, text) => emit('delta', { kind: kind, text: String(text).slice(0, 4000) }),
      })
      emit('done', { ok: !!result.ok, action: result.action, message: result.message || '', experiment: result.experiment || null, runId: result.runId || null, library: result.library || null })
    } catch (err) {
      emit('error', { message: '运行实验时出错：' + (err && err.message ? err.message : String(err)) })
    } finally {
      stream.close()
    }
  }

  return { run, store, chatStream, experimentStream }
}

// ── tool definition ──────────────────────────────────────────────────────────

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    ok: { type: 'boolean', description: 'Whether the action succeeded.' },
    action: { type: 'string', description: 'The action that ran.' },
    message: { type: 'string', description: 'Human readable summary.' },
    count: { type: 'integer', description: 'Number of affected rows, when applicable.' },
  },
  required: ['ok', 'action'],
}

const PAPER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Paper title.' },
    abstract: { type: 'string', description: 'Abstract text.' },
    venue: { type: 'string', description: 'Journal or conference.' },
    year: { type: 'integer', description: 'Publication year.' },
    doi: { type: 'string', description: 'DOI without prefix.' },
    arxivId: { type: 'string', description: 'arXiv id such as 2401.01234.' },
    pmid: { type: 'string', description: 'PubMed id.' },
    url: { type: 'string', description: 'Landing page URL.' },
    source: { type: 'string', description: 'Where it came from: arxiv, europepmc, openalex.' },
    authors: { type: 'array', items: { type: 'string' }, description: 'Author names.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Topic tags.' },
  },
}

const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      enum: ACTIONS,
      description: [
        'status = library counts and the default model.',
        'models = list the models the host can call.',
        'search = search arXiv, Europe PMC and OpenAlex for a query (no API key needed).',
        'add = put papers into the library.',
        'library = list the library.',
        'read = fetch the full text of one paper and store it as retrievable chunks.',
        'ask = answer a question from the stored full text; every quote is checked against the source.',
        'hypothesis = derive falsifiable research questions from the library.',
        'draft = write a paper outline from the library.',
        'review = write a multi-perspective review from the stored full text, every quote checked.',
        'gaps = list the research gaps the library still leaves open.',
        'experiments = list the experiment records.',
        'run = run a python or node snippet in a sandboxed work directory (needs runner.enabled).',
        'experiment_design = build an experiment design (variables/control/grid/criteria) from a hypothesis.',
        'experiment_analyze = extract metrics from a run and judge structured criteria; writes back.',
        'experiment_iterate = produce the next run from results and write back the hypothesis status.',
        'export = export the library as markdown, bibtex, json, typst or latex.',
        'import = import papers into the library from markdown, bibtex or json text.',
        'remove = drop one paper from the library.',
        'undo = revert the last change.',
        'history = list reversible steps; restore = jump back to one step (drops later steps as a branch).',
        'clear = remove all papers and notes from the library (undoable).',
      ].join(' '),
    },
    query: { type: 'string', description: 'Search query. Used by action=search.' },
    question: { type: 'string', description: 'Question to answer. Used by action=ask.' },
    instruction: { type: 'string', description: 'What the draft should be. Used by action=draft.' },
    paperId: { type: 'string', description: 'Library paper id. Used by action=read and action=remove.' },
    paperIds: { type: 'array', items: { type: 'string' }, description: 'Restrict action=ask to these paper ids.' },
    papers: { type: 'array', items: PAPER_SCHEMA, description: 'Papers to add. Used by action=add.' },
    sources: {
      type: 'array',
      items: { type: 'string', enum: ['arxiv', 'europepmc', 'openalex'] },
      description: 'Which sources to search. Default: all three.',
    },
    maxResults: { type: 'integer', description: 'Maximum hits per source for action=search (1-40, default 12).' },
    topic: { type: 'string', description: 'Topic of the review. Used by action=review and action=gaps.' },
    perspectives: {
      type: 'array',
      items: { type: 'string', enum: ['methodology', 'evidence', 'contradictions', 'gaps', 'applications'] },
      description: 'Perspectives for action=review. Default: all configured ones.',
    },
    patch: { type: 'object', additionalProperties: true, description: 'Setting values to apply. Used by action=settings.' },
    reset: { type: 'boolean', description: 'Restore the default settings. Used by action=settings.' },
    kind: { type: 'string', enum: ['one-sample', 'two-sample-welch', 'paired'], description: 'Statistical test for action=stats.' },
    groupA: { type: 'string', description: 'Numbers of the first group, separated by commas or spaces. Used by action=stats.' },
    groupB: { type: 'string', description: 'Numbers of the second group. Used by action=stats.' },
    mu0: { type: 'number', description: 'Reference value for a one sample t test. Used by action=stats.' },
    pvalues: { type: 'array', items: { type: 'number' }, description: 'Raw p values for a multiple comparison correction. Used by action=stats.' },
    runtime: { type: 'string', enum: ['python', 'node'], description: 'Interpreter for action=run. Default: python.' },
    code: { type: 'string', description: 'Source code to run. Used by action=run.' },
    title: { type: 'string', description: 'Title of the experiment record. Used by action=run.' },
    hypothesisId: { type: 'string', description: 'Link the experiment to a hypothesis id. Used by action=run.' },
    packages: { type: 'array', items: { type: 'string' }, description: 'Packages to install before running. Used by action=run; needs runner.allowInstall.' },
    formats: { type: 'array', items: { type: 'string', enum: ['md', 'bib', 'json', 'typst', 'latex'] }, description: 'Export formats. Used by action=export. Default: md, bib, json.' },
    text: { type: 'string', description: 'File text to import. Used by action=import.' },
    format: { type: 'string', enum: ['auto', 'json', 'bibtex', 'markdown'], description: 'Import format hint. Used by action=import. Default: auto.' },
    index: { type: 'integer', description: 'History step index to restore. Used by action=restore.' },
    runId: { type: 'string', description: 'Experiment run id. Used by experiment_analyze/iterate.' },
    extractors: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Metric extractors {name,regex,group,type,mode}. Used by experiment_analyze.' },
    criteria: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Structured criteria {id,metric,op,threshold,required}. Used by experiment_design/analyze.' },
    params: { type: 'object', additionalProperties: true, description: 'Experiment parameter grid/values. Used by experiment_design/iterate/run.' },
    solver: { type: 'object', additionalProperties: true, description: 'Solver {name,method,precision} recorded into provenance. Used by run.' },
    parentRunId: { type: 'string', description: 'Parent run id for lineage. Used by run/iterate.' },
    kind: { type: 'string', enum: ['single', 'sweep', 'verify'], description: 'Experiment kind. Used by run/iterate.' },
    force: { type: 'boolean', description: 'Bypass input-hash cache and force a fresh run. Used by run.' },
    design: { type: 'object', additionalProperties: true, description: 'Design spec {variables,control,grid}. Used by experiment_design.' },
    verdict: { type: 'string', enum: ['supported', 'rejected', 'held'], description: 'Hypothesis status to write back. Used by experiment_iterate.' },
  },
  required: ['action'],
}

const DESCRIPTION = [
  'A research desk for literature work: search open sources, build a reading library,',
  'pull full text, ask questions answered only from that full text, derive falsifiable',
  'hypotheses and draft a paper outline.',
  'Use it for the research loop: discover (search) -> curate (add, library) -> read (read)',
  ' -> interrogate (ask) -> frame (hypothesis) -> write (draft).',
  'Every quote the desk returns has been checked against the source text, so an answer',
  'without a matching passage is reported as a miss rather than a fact.',
  'It also writes multi-perspective reviews, runs python or node snippets in a',
  'sandboxed work directory, checks statistics, and exports the library as markdown,',
  'bibtex, json, typst or latex.',
].join(' ')

function renderResult(args, value) {
  const lines = []
  const v = value || {}
  lines.push(typeof v.message === 'string' && v.message ? v.message : JSON.stringify(v).slice(0, 2000))
  if (v.count !== undefined) lines.push('（条目数：' + v.count + '）')
  if (Array.isArray(v.unverified) && v.unverified.length) {
    lines.push('未核验引文：' + v.unverified.length + ' 条')
  }
  return [{ type: 'text', text: lines.join('\n') }]
}

// ── registration ─────────────────────────────────────────────────────────────

export function apply(ctx) {
  const { run, chatStream, experimentStream } = createService(ctx)

  const handle = async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, action: '', message: 'method not allowed' })
      return
    }
    if (!sameOrigin(req)) {
      sendJson(res, 403, { ok: false, action: '', message: 'origin rejected' })
      return
    }
    try {
      const payload = await readBody(req)
      if (payload && payload.action === 'chat_stream') {
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' })
        const ac = new AbortController()
        req.on('close', () => ac.abort())
        const stream = {
          signal: ac.signal,
          write(type, data) { try { res.write('data: ' + JSON.stringify(Object.assign({ type }, data || {})) + '\n\n') } catch (e) {} },
          close() { try { res.end() } catch (e) {} },
        }
        await chatStream(payload, stream)
        return
      }
      if (payload && payload.action === 'experiment_stream') {
        res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' })
        const ac = new AbortController()
        req.on('close', () => ac.abort())
        const stream = {
          signal: ac.signal,
          write(type, data) { try { res.write('data: ' + JSON.stringify(Object.assign({ type }, data || {})) + '\n\n') } catch (e) {} },
          close() { try { res.end() } catch (e) {} },
        }
        await experimentStream(payload, stream)
        return
      }
      const result = await run(payload)
      sendJson(res, 200, result)
    } catch (error) {
      const code = error && typeof error.code === 'string' ? error.code : 'internal'
      sendJson(res, 400, { ok: false, action: '', message: error instanceof Error ? error.message : String(error), code })
    }
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: handle }), 'dsh-research-desk: routes')

  ctx.tools.register({
    name: 'research_desk',
    description: DESCRIPTION,
    parameters: PARAMETERS,
    timeoutMs: 300000,
    isConcurrencySafe: () => true,
    presentCall: args => ({
      card: 'generic',
      title: '科研工作台 · ' + String((args && args.action) || 'status'),
      kind: 'fetch',
      rawInput: args,
    }),
    output: {
      schema: RESULT_SCHEMA,
      render: (args, value) => renderResult(args, value),
    },
    async execute(args, exec) {
      const signal = exec && exec.signal
      if (signal && signal.aborted) return { ok: false, action: String((args && args.action) || ''), message: 'Aborted.' }
      return run(args, signal)
    },
  })
}

export { emptyState, paperKey }
