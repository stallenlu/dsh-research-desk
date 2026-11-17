#!/usr/bin/env node
// dsh-research-desk — stdio MCP server.
//
// Usage: dsh-research-desk-mcp
//
// Reads JSON-RPC lines on stdin and writes JSON-RPC responses to stdout.
// Diagnostics go to stderr only: stdout carries JSON-RPC messages.
//
// The server reads and writes the same state file as the desktop panel, so a
// library built in the panel is visible to any agent attached to this server.
import { runMcpStdio } from '../lib/mcp.mjs'

runMcpStdio().catch((err) => {
  const message = err && err.message ? err.message : String(err)
  process.stderr.write('dsh-research-desk-mcp failed: ' + message + '\n')
  process.exitCode = 1
})
