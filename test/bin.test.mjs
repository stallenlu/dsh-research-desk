// The MCP entry point must be runnable: an agent launches it over stdio, so the
// handshake, the tool list and a tool call all have to work through a real pipe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

function runServer(messages) {
  return new Promise((resolve, reject) => {
    const home = mkdtempSync(join(tmpdir(), 'rd-bin-'))
    const child = spawn(process.execPath, [join(root, 'bin', 'dsh-research-desk-mcp.mjs')], {
      env: { ...process.env, DSH_HOME: home },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let out = ''
    let err = ''
    child.stdout.on('data', chunk => { out += chunk.toString() })
    child.stderr.on('data', chunk => { err += chunk.toString() })
    child.on('error', reject)
    child.on('close', code => {
      rmSync(home, { recursive: true, force: true })
      const replies = out.split('\n').filter(Boolean).map(line => JSON.parse(line))
      resolve({ code, replies, stderr: err })
    })
    for (const message of messages) child.stdin.write(JSON.stringify(message) + '\n')
    child.stdin.end()
  })
}

test('the bin entry point completes the MCP handshake over stdio', async () => {
  const { code, replies } = await runServer([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
  ])
  assert.equal(code, 0)
  assert.equal(replies.length, 2)
  assert.equal(replies[0].result.serverInfo.name, 'dsh-research-desk')
  assert.equal(replies[0].result.protocolVersion, '2024-11-05')
  assert.deepEqual(
    replies[1].result.tools.map(tool => tool.name),
    ['research_search', 'research_library_list', 'research_library_add', 'research_library_remove', 'research_export',
     'research_experiment_run', 'research_experiment_analyze', 'research_experiment_list']
  )
})

test('a notification gets no reply and an unknown method gets an error', async () => {
  const { replies } = await runServer([
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 9, method: 'nope/nope', params: {} }
  ])
  assert.equal(replies.length, 1)
  assert.equal(replies[0].id, 9)
  assert.equal(replies[0].error.code, -32601)
})

test('a tool call reaches the shared library, and stdout carries JSON-RPC only', async () => {
  const { replies, stderr } = await runServer([
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'research_library_list', arguments: { limit: 3 } } }
  ])
  assert.equal(replies.length, 1)
  assert.match(replies[0].result.content[0].text, /"papers"/)
  // Diagnostics are allowed on stderr; stdout must stay pure JSON-RPC.
  assert.match(stderr, /MCP stdio 服务已退出/)
})

test('an empty source list refuses the search instead of querying every source', async () => {
  const { replies } = await runServer([
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'research_search', arguments: { query: 'x', sources: [] } } }
  ])
  assert.equal(replies.length, 1)
  assert.match(replies[0].result.content[0].text, /没有选中任何数据源/)
})
