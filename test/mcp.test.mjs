// MCP server 的单测。跑法：node --test test/mcp.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { readFileSync } from 'node:fs'
import { dirname, join as joinPath } from 'node:path'
import { fileURLToPath } from 'node:url'

import { MCP_TOOLS, createMcpServer, runMcpStdio } from '../lib/mcp.mjs'

// The advertised version must track package.json, not a literal copy that goes stale on every bump.
const pkg = JSON.parse(readFileSync(joinPath(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))

async function withTempDir(fn) {
  const root = await mkdtemp(join(tmpdir(), 'rd-mcp-'))
  try {
    return await fn(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('mcp: MCP_TOOLS 是 8 个工具，每个都带完整 inputSchema', () => {
  assert.equal(MCP_TOOLS.length, 8)
  const names = MCP_TOOLS.map(tool => tool.name)
  assert.deepEqual(names.slice().sort(), [
    'research_experiment_analyze',
    'research_experiment_list',
    'research_experiment_run',
    'research_export',
    'research_library_add',
    'research_library_list',
    'research_library_remove',
    'research_search',
  ])
  for (const tool of MCP_TOOLS) {
    assert.equal(typeof tool.description, 'string')
    assert.equal(tool.description.length > 0, true)
    assert.equal(tool.inputSchema.type, 'object')
    assert.equal(tool.inputSchema.additionalProperties, false)
    assert.equal(typeof tool.inputSchema.properties, 'object')
    assert.ok(Array.isArray(tool.inputSchema.required))
  }
  const search = MCP_TOOLS.find(tool => tool.name === 'research_search')
  assert.deepEqual(search.inputSchema.required, ['query'])
  const add = MCP_TOOLS.find(tool => tool.name === 'research_library_add')
  assert.deepEqual(add.inputSchema.required, ['papers'])
})

test('mcp: initialize 返回正确的协议版本与服务信息', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }))
    assert.equal(res.jsonrpc, '2.0')
    assert.equal(res.id, 1)
    assert.equal(res.result.protocolVersion, '2024-11-05')
    assert.deepEqual(res.result.capabilities, { tools: {} })
    assert.equal(res.result.serverInfo.name, 'dsh-research-desk')
    assert.equal(res.result.serverInfo.version, pkg.version)
  })
})

test('mcp: notifications/initialized 不回包', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))
    assert.equal(res, null)
  })
})

test('mcp: tools/list 返回 8 个工具', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))
    assert.equal(res.id, 2)
    assert.equal(res.result.tools.length, 8)
    assert.equal(res.result.tools[0].name, 'research_search')
  })
})

test('mcp: 非法 JSON 返回 -32700', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine('{ this is not json ')
    assert.equal(res.jsonrpc, '2.0')
    assert.equal(res.error.code, -32700)
  })
})

test('mcp: 未知 method 返回 -32601', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'does/not/exist' }))
    assert.equal(res.id, 3)
    assert.equal(res.error.code, -32601)
    assert.equal(res.error.message.includes('不认识的方法'), true)
  })
})

test('mcp: tools/call research_search 返回结构化 JSON 文本', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'research_search', arguments: { query: 'retrieval augmented generation', sources: ['arxiv'], maxResults: 3 } },
    }))
    assert.equal(res.id, 4)
    assert.equal(res.result.isError, undefined)
    assert.equal(res.result.content[0].type, 'text')
    const payload = JSON.parse(res.result.content[0].text)
    assert.equal(payload.query, 'retrieval augmented generation')
    assert.equal(Array.isArray(payload.papers), true)
    assert.equal(Array.isArray(payload.errors), true)
    for (const paper of payload.papers) assert.equal(typeof paper.title, 'string')
  })
})

test('mcp: tools/call 参数缺失时返回中文错误而不是崩溃', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'research_search', arguments: { query: '   ' } },
    }))
    assert.equal(res.result.isError, true)
    assert.equal(res.result.content[0].text.includes('检索词是空的'), true)
  })
})

test('mcp: 未知工具名返回中文错误', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const res = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'research_nope', arguments: {} },
    }))
    assert.equal(res.result.isError, true)
    assert.equal(res.result.content[0].text.includes('不认识的工具'), true)
  })
})

test('mcp: 加文献 → 列表 → 导出 → 移除，数据落在同一个 store 里', async () => {
  await withTempDir(async root => {
    const server = createMcpServer({ dataDir: root })
    const add = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'research_library_add',
        arguments: { papers: [{ title: 'A Tiny Test Paper', doi: '10.1/tiny', year: 2024, authors: ['Smith J'] }] },
      },
    }))
    assert.equal(add.result.isError, undefined)
    assert.equal(JSON.parse(add.result.content[0].text).added, 1)

    const list = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'research_library_list', arguments: {} },
    }))
    const library = JSON.parse(list.result.content[0].text)
    assert.equal(library.count, 1)
    const paperId = library.papers[0].id
    assert.equal(library.papers[0].title, 'A Tiny Test Paper')

    const exportRes = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'research_export', arguments: { format: 'bibtex' } },
    }))
    assert.match(exportRes.result.content[0].text, /@article\{/)

    const remove = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'research_library_remove', arguments: { paperId: paperId } },
    }))
    assert.equal(remove.result.isError, undefined)

    const after = await server.handleLine(JSON.stringify({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'research_library_list', arguments: {} },
    }))
    assert.equal(JSON.parse(after.result.content[0].text).count, 0)
  })
})

test('mcp: runMcpStdio 每行一个 JSON 响应，通知不回包', async () => {
  await withTempDir(async root => {
    const input = [
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    ].join('\n') + '\n'
    const out = []
    const err = []
    await runMcpStdio({
      dataDir: root,
      input: Readable.from([input]),
      output: { write: text => out.push(text) },
      error: { write: text => err.push(text) },
    })
    const lines = out.map(text => text.trim()).filter(Boolean)
    assert.equal(lines.length, 2)
    const first = JSON.parse(lines[0])
    assert.equal(first.result.protocolVersion, '2024-11-05')
    const second = JSON.parse(lines[1])
    assert.equal(second.result.tools.length, 8)
  })
})
