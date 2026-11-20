// 宿主外的 MCP server 暴露（集成组 J）。
//
// 目标：让 Claude Desktop / 任何 MCP 客户端直接用科研工作台，
// 而不必先装 DeepSeek Harness 宿主。协议面只做 JSON-RPC 2.0 的三个方法
// （initialize / tools/list / tools/call）加一个通知（notifications/initialized）。
//
// 数据层完全复用 lib/store.mjs + lib/desk.mjs + lib/search.mjs：
// 同一个 state.json、同一套字段白名单、同一套去重键，
// 所以 MCP 客户端写进去的文献，桌面宿主的面板里立刻看得到。
import path from 'node:path'
import { createInterface } from 'node:readline'

import { Store, dshHome } from './store.mjs'
import { applyOps, migrateState, paperKey } from './desk.mjs'
import { search } from './search.mjs'
import { cleanText, isObject } from './util.mjs'
import { readSettings } from './settings.mjs'
import { RUNTIMES, runCode, installPackages, filteredEnv, workDirFor } from './runner.mjs'
import { inputHash, findByHash, markOrphans } from './provenance.mjs'
import { extract as extractMetrics, judge as judgeCriteria } from './criteria.mjs'

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_NAME = 'dsh-research-desk'
const SERVER_VERSION = '0.3.4'
const DATA_DIR_NAME = 'research-desk'

/**
 * MCP 工具清单。inputSchema 用 JSON Schema draft-07，
 * additionalProperties:false 让客户端在参数拼错时立刻被拒，而不是静默忽略。
 */
export const MCP_TOOLS = [
  {
    name: 'research_search',
    description: '检索科研文献（arXiv / Europe PMC / OpenAlex，免密钥）。返回标题、作者、年份、摘要、DOI 与链接。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索词，支持自然语言；引号短语按精确短语匹配。' },
        sources: {
          type: 'array',
          description: '数据源，缺省三个都查。',
          items: { type: 'string', enum: ['arxiv', 'europepmc', 'openalex'] },
        },
        maxResults: { type: 'integer', description: '单个数据源最多返回条数（1-40，缺省 10）。', minimum: 1, maximum: 40 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'research_library_list',
    description: '列出文献库里的文献、选题与草稿。',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: '只列出某个状态的文献：new / reading / read / kept / dropped。' },
        limit: { type: 'integer', description: '最多返回多少篇文献（1-200，缺省 50）。', minimum: 1, maximum: 200 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'research_library_add',
    description: '把文献加入文献库。自动按 DOI → arXiv id → 标题去重，重复的会被跳过。',
    inputSchema: {
      type: 'object',
      properties: {
        papers: {
          type: 'array',
          description: '文献数组，每篇至少要有 title。',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '标题，必填。' },
              abstract: { type: 'string', description: '摘要。' },
              venue: { type: 'string', description: '发表 venue。' },
              year: { type: 'integer', description: '发表年份。' },
              doi: { type: 'string', description: 'DOI。' },
              arxivId: { type: 'string', description: 'arXiv 编号。' },
              pmid: { type: 'string', description: 'PubMed 编号。' },
              pmcid: { type: 'string', description: 'PubMed Central 编号。' },
              url: { type: 'string', description: '原文链接（http/https）。' },
              source: { type: 'string', description: '来源标记。' },
              authors: { type: 'array', description: '作者列表。', items: { type: 'string' } },
              tags: { type: 'array', description: '标签。', items: { type: 'string' } },
              status: { type: 'string', enum: ['new', 'reading', 'read', 'kept', 'dropped'] },
              note: { type: 'string', description: '备注。' },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
      },
      required: ['papers'],
      additionalProperties: false,
    },
  },
  {
    name: 'research_library_remove',
    description: '从文献库里移出一篇文献（按文献 id）。',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: { type: 'string', description: '文献 id，来自 research_library_list。' },
      },
      required: ['paperId'],
      additionalProperties: false,
    },
  },
  {
    name: 'research_export',
    description: '导出文献库：Markdown 清单、JSON 数据或 BibTeX 引文键。',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['markdown', 'json', 'bibtex'], description: '导出格式，缺省 markdown。' },
        paperIds: { type: 'array', description: '只导出这些文献 id；缺省导出全部。', items: { type: 'string' } },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'research_experiment_run',
    description: '运行一段验证性数值实验代码（python/node）。必须在设置里开启 runner.enabled；代码以解释器完整权限运行，代理指向不可达地址以断网。同步返回，无进度推送；较大实验请给足 hardTimeoutMs 并轮询 research_experiment_list。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '实验标题。' },
        runtime: { type: 'string', enum: RUNTIMES, description: '运行时，缺省 python。' },
        code: { type: 'string', description: '实验代码，必填。' },
        params: { type: 'object', description: '参数字典，参与输入哈希与缓存。' },
        packages: { type: 'array', items: { type: 'string' }, description: '要安装的包；需同时开启 runner.allowInstall。' },
        hypothesisId: { type: 'string', description: '关联假说 id，用于回写状态。' },
        parentRunId: { type: 'string', description: '父实验 id，建立血缘。' },
        kind: { type: 'string', enum: ['single', 'sweep', 'verify'], description: '实验类型，缺省 single。' },
        hardTimeoutMs: { type: 'integer', description: 'MCP 侧硬超时（毫秒），缺省 300000；到期自动取消子进程。', minimum: 1000 },
        force: { type: 'boolean', description: '为 true 时跳过相同输入缓存复用。' },
      },
      required: ['code'],
      additionalProperties: false,
    },
  },
  {
    name: 'research_experiment_analyze',
    description: '从实验输出抽取指标并按判据判定，写回该实验记录。判据用固定 op 枚举（eq/neq/gt/gte/lt/lte/in/converged/monotonic/stable），无 eval。',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '实验 id，缺省分析最近一条。' },
        extractors: {
          type: 'array',
          description: '正则抽取器数组，每项 {id, pattern, mode?}。',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              pattern: { type: 'string' },
              mode: { type: 'string', enum: ['all', 'last', 'first'], description: '缺省 all。' },
            },
            required: ['id', 'pattern'],
            additionalProperties: false,
          },
        },
        criteria: { type: 'array', description: '判据数组；缺省沿用实验记录已存的判据。', items: { type: 'object' } },
      },
      required: ['extractors'],
      additionalProperties: false,
    },
  },
  {
    name: 'research_experiment_list',
    description: '列出实验记录（含状态、指标、判据、血缘、输入哈希）；用来轮询运行中的实验。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: '最多返回条数（1-100，缺省 20）。', minimum: 1, maximum: 100 },
        status: { type: 'string', enum: ['planned', 'running', 'done', 'failed', 'rejected'], description: '只看某一状态。' },
      },
      required: [],
      additionalProperties: false,
    },
  },
]

/** 把日志写到诊断通道（stdio 模式下是 stderr），绝不写 stdout。 */
function makeLogger(logger) {
  if (typeof logger === 'function') {
    return { info: text => logger(text), error: text => logger(text) }
  }
  if (isObject(logger)) {
    return {
      info: text => {
        if (typeof logger.info === 'function') logger.info(text)
      },
      error: text => {
        if (typeof logger.error === 'function') logger.error(text)
        else if (typeof logger.info === 'function') logger.info(text)
      },
    }
  }
  return { info: () => {}, error: () => {} }
}

/** BibTeX 字段里的特殊字符必须转义，否则 LaTeX 编译会炸。 */
function bibEscape(text) {
  return String(text == null ? '' : text)
    .replace(/[{}]/g, '')
    .replace(/&/g, '\&')
    .replace(/%/g, '\%')
    .replace(/$/g, '\$')
    .replace(/#/g, '\#')
    .replace(/_/g, '\_')
    .replace(/~/g, '\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 生成引文键：作者姓 + 年份 + 标题首词，全小写去标点。 */
function citationKey(paper, index) {
  const author = (paper.authors && paper.authors[0]) || 'anon'
  const family = String(author).split(/\s+/).slice(-1)[0] || 'anon'
  const year = paper.year || 'nd'
  const word = String(paper.title || '').split(/\s+/)[0] || 'paper'
  const key = (family + year + word).toLowerCase().replace(/[^a-z0-9]/g, '')
  return key || 'ref' + index
}

function toPublicPaper(paper) {
  return {
    id: paper.id,
    title: paper.title || '',
    abstract: (paper.abstract || '').slice(0, 1200),
    venue: paper.venue || '',
    year: paper.year || null,
    doi: paper.doi || '',
    arxivId: paper.arxivId || '',
    pmid: paper.pmid || '',
    url: paper.url || '',
    source: paper.source || '',
    authors: (paper.authors || []).slice(0, 20),
    tags: paper.tags || [],
    status: paper.status || 'new',
    note: paper.note || '',
  }
}

/**
 * 创建 MCP server：给出一个 handleLine(line) 就能逐行处理 JSON-RPC。
 * @param {object} [options] - 选项。
 * @param {string} [options.dataDir] - 插件数据目录；缺省用 DSH_HOME/research-desk。
 * @param {Function|object} [options.logger] - 诊断日志通道。
 * @returns {{handleLine: Function, tools: Array}} 服务器。
 */
export function createMcpServer({ dataDir, logger } = {}) {
  const log = makeLogger(logger)
  const root = dataDir ? path.resolve(dataDir) : path.join(dshHome(), DATA_DIR_NAME)
  const store = new Store(root, migrateState)

  const toolResult = (value) => ({
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  })
  const toolError = (message) => ({
    content: [{ type: 'text', text: String(message) }],
    isError: true,
  })

  async function doSearch(args) {
    const query = cleanText(args.query, 500)
    if (!query) return toolError('检索词是空的。')
    // An explicitly empty list means "query no source"; only a missing argument
    // means "use every source".
    if (Array.isArray(args.sources) && !args.sources.length) return toolError('没有选中任何数据源，检索没有执行。')
    const sources = Array.isArray(args.sources) ? args.sources.map(String) : undefined
    const maxResults = Math.min(Math.max(Number(args.maxResults) || 10, 1), 40)
    const result = await search(query, { sources, maxResults })
    return toolResult({
      query: query,
      count: result.papers.length,
      papers: result.papers.map(row => ({
        title: row.title,
        abstract: (row.abstract || '').slice(0, 1200),
        venue: row.venue || '',
        year: row.year || null,
        doi: row.doi || '',
        arxivId: row.arxivId || '',
        pmid: row.pmid || '',
        url: row.url || '',
        source: row.source || '',
        authors: (row.authors || []).slice(0, 12),
        citedBy: row.citedBy === undefined ? null : row.citedBy,
      })),
      errors: result.errors,
    })
  }

  async function doList(args) {
    const state = await store.read()
    const status = cleanText(args.status, 30)
    const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200)
    let papers = (state.papers || []).map(toPublicPaper)
    if (status) papers = papers.filter(row => row.status === status)
    papers = papers.slice(0, limit)
    return toolResult({
      count: papers.length,
      papers: papers,
      hypotheses: (state.hypotheses || []).map(row => ({
        id: row.id,
        title: row.title,
        rationale: row.rationale || '',
        gap: row.gap || '',
        experiment: row.experiment || '',
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
    })
  }

  async function doAdd(args) {
    const input = Array.isArray(args.papers) ? args.papers : []
    if (!input.length) return toolError('没有要加入的文献：papers 是空的。')
    const ops = input.map(row => ({ op: 'add_paper', paper: isObject(row) ? row : {} }))
    const outcome = await store.mutate('MCP 加入文献', draft => {
      const res = applyOps(draft, ops)
      draft.updatedAt = new Date().toISOString()
      return res
    })
    const lines = outcome.receipts.map(row => row.text)
    if (outcome.errors.length) lines.push('未处理：' + outcome.errors.join('；'))
    return toolResult({
      added: outcome.receipts.length,
      messages: lines,
    })
  }

  async function doRemove(args) {
    const id = cleanText(args.paperId, 80)
    if (!id) return toolError('缺少 paperId。')
    const outcome = await store.mutate('MCP 移出文献', draft => {
      const res = applyOps(draft, [{ op: 'remove_paper', id: id }])
      draft.updatedAt = new Date().toISOString()
      return res
    })
    if (!outcome.changed) return toolError('文献库里找不到这一篇：' + id)
    return toolResult({ removed: id, messages: outcome.receipts.map(row => row.text) })
  }

  async function doExport(args) {
    const format = ['markdown', 'json', 'bibtex'].includes(args.format) ? args.format : 'markdown'
    const state = await store.read()
    const wanted = Array.isArray(args.paperIds) && args.paperIds.length ? new Set(args.paperIds.map(String)) : null
    const papers = (state.papers || []).filter(row => !wanted || wanted.has(row.id)).map(toPublicPaper)
    if (format === 'json') {
      return toolResult({ count: papers.length, papers: papers })
    }
    if (format === 'bibtex') {
      const lines = []
      papers.forEach((paper, index) => {
        const fields = [
          '  title = {' + bibEscape(paper.title) + '}',
          '  author = {' + bibEscape((paper.authors || []).join(' and ')) + '}',
          '  year = {' + (paper.year || '') + '}',
        ]
        if (paper.venue) fields.push('  journal = {' + bibEscape(paper.venue) + '}')
        if (paper.doi) fields.push('  doi = {' + bibEscape(paper.doi) + '}')
        if (paper.url) fields.push('  url = {' + bibEscape(paper.url) + '}')
        lines.push('@article{' + citationKey(paper, index) + ',\n' + fields.join(',\n') + '\n}')
      })
      return toolResult(lines.join('\n\n') + (lines.length ? '\n' : ''))
    }
    const lines = ['# 文献库（' + papers.length + ' 篇）', '']
    for (const paper of papers) {
      lines.push('## ' + paper.title)
      const meta = []
      if (paper.authors && paper.authors.length) meta.push(paper.authors.slice(0, 6).join('、'))
      if (paper.year) meta.push(String(paper.year))
      if (paper.venue) meta.push(paper.venue)
      if (paper.doi) meta.push('doi:' + paper.doi)
      if (meta.length) lines.push(meta.join(' · '))
      if (paper.url) lines.push(paper.url)
      if (paper.abstract) lines.push('', paper.abstract)
      lines.push('')
    }
    return toolResult(lines.join('\n'))
  }

  async function doExperimentRun(args) {
    const state = await store.read()
    const settings = readSettings(state)
    if (settings['runner.enabled'] !== true) return toolError('没有开启外部工具调用：请在设置面板打开 runner.enabled。')
    const code = typeof args.code === 'string' ? args.code : ''
    if (!code.trim()) return toolError('代码是空的。')
    const runtime = RUNTIMES.includes(args.runtime) ? args.runtime : 'python'
    const dataDir = settings['storage.dataDir'] || ''
    const workDir = workDirFor(settings, dataDir)
    const title = cleanText(args.title, 200) || ('MCP 实验 ' + new Date().toISOString().slice(0, 16))
    const params = isObject(args.params) ? args.params : {}
    const packages = Array.isArray(args.packages) ? args.packages.map(String) : []
    const hypothesisId = cleanText(args.hypothesisId, 80)
    const parentRunId = cleanText(args.parentRunId, 80)
    const kind = ['single', 'sweep', 'verify'].includes(args.kind) ? args.kind : 'single'
    const force = args.force === true
    const toolchain = { runtime, version: runtime === 'python' ? (settings['runner.pythonVersion'] || 'unknown') : process.version }
    const hash = inputHash({ runtime, code, params, packages, toolchain })
    const now = new Date().toISOString()
    // 与 host 同一套库：先回收孤儿，再单 mutate 查重+预留（查 done||running，禁止嵌套 mutate）。
    await store.mutate('MCP 回收超时预留', draft => {
      const orphans = markOrphans(draft.experiments || [], now)
      for (const row of (draft.experiments || [])) {
        if (orphans.includes(row.id)) { row.status = 'failed'; row.reason = 'orphan: 执行被中断或超时，已由启动回收标记'; row.finishedAt = now }
      }
      return { receipts: [], errors: [], changed: false }
    })
    const reservation = await store.mutate('MCP 预留实验', draft => {
      if (!force) {
        const found = findByHash(hash, draft.experiments || [])
        if (found) return { hit: found.status === 'done' ? 'done' : 'running', run: found }
      }
      const res = applyOps(draft, [{
        op: 'add_experiment', title, runtime, code, params, packages, toolchain,
        hypothesisId, parentRunId, kind, inputHash: hash, status: 'running',
        startedAt: now, createdAt: now, cacheHit: false,
      }])
      return { hit: 'new', runId: (draft.experiments || [])[0] && draft.experiments[0].id, errs: res.errors }
    })
    if (reservation.hit === 'done' || reservation.hit === 'running') {
      const row = reservation.run
      return toolResult({ reused: reservation.hit === 'running', cacheHit: reservation.hit === 'done', runId: row.id, status: row.status, message: reservation.hit === 'done' ? '相同输入已运行过，直接复用。' : '相同输入正在运行，请用 research_experiment_list 轮询。' })
    }
    const runId = reservation.runId
    if (!runId) return toolError('无法创建实验预留记录。')
    if (packages.length) {
      const install = await installPackages({ runtime, packages, settings, workDir, dataDir, env: filteredEnv('install') })
      if (!install.ok) {
        await store.mutate('MCP 装包失败', draft => { const row = (draft.experiments || []).find(r => r.id === runId); if (row) { row.status = 'failed'; row.reason = '装包失败'; row.finishedAt = new Date().toISOString() } return { receipts: [], errors: [], changed: false } })
        return toolError('装包失败：' + (install.error || '未知原因'))
      }
    }
    const hardTimeoutMs = Math.max(1000, Number(args.hardTimeoutMs) || 300000)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), hardTimeoutMs)
    let result
    try {
      result = await runCode({ runtime, code, settings, workDir, signal: ac.signal, dataDir, env: filteredEnv('exec') })
    } finally {
      clearTimeout(timer)
    }
    const status = result.ok ? 'done' : 'failed'
    await store.mutate('MCP 落库实验结果', draft => {
      const row = (draft.experiments || []).find(r => r.id === runId)
      if (row) {
        row.status = status; row.exitCode = result.exitCode === null ? undefined : result.exitCode;
        row.stdout = result.stdout || ''; row.stderr = result.stderr || '';
        row.durationMs = result.durationMs; row.timedOut = !!result.timedOut;
        row.finishedAt = new Date().toISOString();
      }
      draft.updatedAt = new Date().toISOString()
      return { receipts: [], errors: [], changed: true }
    })
    return toolResult({ ok: result.ok, runId, status, message: result.error || (result.ok ? '运行成功' : '运行失败'), stdout: (result.stdout || '').slice(0, 4000), stderr: (result.stderr || '').slice(0, 4000), durationMs: result.durationMs, timedOut: !!result.timedOut })
  }

  async function doExperimentAnalyze(args) {
    const state = await store.read()
    const runId = cleanText(args.runId, 80)
    const row = runId ? (state.experiments || []).find(r => r.id === runId) : (state.experiments || [])[0]
    if (!row) return toolError('找不到要分析的实验记录。')
    const extractors = Array.isArray(args.extractors) ? args.extractors.slice(0, 50) : []
    if (!extractors.length) return toolError('缺少 extractors：至少给一个正则抽取器 {id, pattern}。')
    const criteria = Array.isArray(args.criteria) && args.criteria.length ? args.criteria.slice(0, 50) : ((row.criteria && row.criteria.length) ? row.criteria : [])
    const metrics = extractMetrics(row.stdout || '', extractors)
    const judged = judgeCriteria(metrics, criteria)
    await store.mutate('MCP 分析实验', draft => {
      const target = (draft.experiments || []).find(r => r.id === row.id)
      if (target) { target.metrics = metrics; target.criteria = judged.results || [] }
      draft.updatedAt = new Date().toISOString()
      return { receipts: [], errors: [], changed: true }
    })
    return toolResult({ runId: row.id, passed: judged.passed, metrics, criteria: judged.results || [] })
  }

  async function doExperimentList(args) {
    const state = await store.read()
    const status = cleanText(args.status, 30)
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100)
    let rows = (state.experiments || []).map(row => ({
      id: row.id, title: row.title, runtime: row.runtime, status: row.status,
      kind: row.kind || 'single', hypothesisId: row.hypothesisId || '', parentRunId: row.parentRunId || '',
      inputHash: row.inputHash || '', cacheHit: !!row.cacheHit,
      metrics: row.metrics || {}, criteria: row.criteria || [],
      exitCode: row.exitCode === undefined ? null : row.exitCode, durationMs: row.durationMs || 0,
      createdAt: row.createdAt || row.at || null, startedAt: row.startedAt || null, finishedAt: row.finishedAt || null,
      reason: row.reason || '',
    }))
    if (status) rows = rows.filter(row => row.status === status)
    rows = rows.slice(0, limit)
    return toolResult({ count: rows.length, experiments: rows })
  }

  const TOOL_IMPL = {
    research_search: doSearch,
    research_library_list: doList,
    research_library_add: doAdd,
    research_library_remove: doRemove,
    research_export: doExport,
    research_experiment_run: doExperimentRun,
    research_experiment_analyze: doExperimentAnalyze,
    research_experiment_list: doExperimentList,
  }

  async function callTool(name, args) {
    const impl = TOOL_IMPL[name]
    if (!impl) return toolError('不认识的工具：' + String(name))
    try {
      return await impl(isObject(args) ? args : {})
    } catch (err) {
      const message = err && err.message ? err.message : String(err)
      log.error('MCP 工具 ' + name + ' 执行失败：' + message)
      return toolError('工具执行失败：' + message)
    }
  }

  /**
   * 处理一行 JSON-RPC 输入。
   * @param {string} line - 一行 JSON 文本。
   * @returns {Promise<object|null>} 响应对象；通知（无 id）返回 null。
   */
  async function handleLine(line) {
    const text = typeof line === 'string' ? line : String(line == null ? '' : line)
    if (!text.trim()) return null
    let message
    try {
      message = JSON.parse(text)
    } catch {
      return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON 解析失败：这一行不是合法的 JSON。' } }
    }
    if (!isObject(message)) {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: '请求格式不对：需要一个 JSON 对象。' } }
    }
    const id = message.id === undefined ? null : message.id
    const method = typeof message.method === 'string' ? message.method : ''
    const isNotification = message.id === undefined
    // 通知（无 id）按 JSON-RPC 规范不回复任何东西。
    if (isNotification) {
      if (method === 'notifications/initialized') log.info('MCP 客户端已初始化。')
      return null
    }
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        },
      }
    }
    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } }
    }
    if (method === 'tools/call') {
      const params = isObject(message.params) ? message.params : {}
      const result = await callTool(params.name, params.arguments)
      return { jsonrpc: '2.0', id, result }
    }
    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} }
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: '不认识的方法：' + (method || '(空)') } }
  }

  return { handleLine, tools: MCP_TOOLS }
}

/**
 * 以 stdio 传输跑 MCP server：读 stdin 每行 JSON，只把 JSON-RPC 响应写 stdout。
 * 诊断信息一律走 stderr —— stdio 传输的 stdout 只能有 JSON-RPC 消息。
 * @param {object} [options] - 选项。
 * @param {string} [options.dataDir] - 插件数据目录。
 * @param {Function|object} [options.logger] - 诊断日志通道。
 * @param {NodeJS.ReadableStream} [options.input] - 输入流，缺省 process.stdin。
 * @param {NodeJS.WritableStream} [options.output] - 输出流，缺省 process.stdout。
 * @param {NodeJS.WritableStream} [options.error] - 诊断流，缺省 process.stderr。
 * @returns {Promise<void>} 读到输入流结束为止。
 */
export async function runMcpStdio(options = {}) {
  const server = createMcpServer(options)
  const input = options.input || process.stdin
  const output = options.output || process.stdout
  const error = options.error || process.stderr
  // stdio 传输的 stdout 只能有 JSON-RPC 消息，诊断信息一律落到 stderr。
  const log = options.logger ? makeLogger(options.logger) : { info: text => error.write(text + '\n'), error: text => error.write(text + '\n') }
  const reader = createInterface({ input, crlfDelay: Infinity })
  for await (const line of reader) {
    const response = await server.handleLine(line)
    // null = 通知，不回包。
    if (response === null) continue
    output.write(JSON.stringify(response) + '\n')
  }
  log.info('MCP stdio 服务已退出。')
}
