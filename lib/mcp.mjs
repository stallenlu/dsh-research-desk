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

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_NAME = 'dsh-research-desk'
const SERVER_VERSION = '0.2.0'
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
    .replace(/^/g, '\textasciicircum{}')
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
    const sources = Array.isArray(args.sources) && args.sources.length ? args.sources.map(String) : undefined
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

  const TOOL_IMPL = {
    research_search: doSearch,
    research_library_list: doList,
    research_library_add: doAdd,
    research_library_remove: doRemove,
    research_export: doExport,
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
