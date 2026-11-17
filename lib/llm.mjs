// Thin wrapper over the host LLM service.
// The stream contract was copied from the installed agentero host half:
//   call = await llm.prepareCall(config, signal, configure)
//   for await (const chunk of call.stream({ ...call.config, system, messages, signal }))
// Text arrives as 'block-end' chunks keyed by index; 'finish' carries the reason.
import { randomUUID } from 'node:crypto'

/**
 * A plugin that calls the model outside a chat session must carry its own
 * session id: some gateways reject a call with no session header.
 */
export const PLUGIN_SESSION_ID = 'dsh-research-desk-' + randomUUID()

export function defaultRoute(ctx) {
  try {
    const service = ctx.get('agentDefaultModel')
    const selection = service && typeof service.currentSelection === 'function' ? service.currentSelection() : null
    if (selection && selection.provider && selection.model) return { provider: selection.provider, model: selection.model }
  } catch (err) {
    // fall through to the error below
  }
  return null
}

export async function listModels(ctx) {
  const llm = ctx.get('llm')
  if (!llm || typeof llm.listProviders !== 'function') return []
  const providers = llm.listProviders() || []
  const rows = []
  for (const provider of providers) {
    if (!provider || typeof provider.id !== 'string') continue
    let models = []
    try {
      // The host catalog is asynchronous: listModels() resolves a promise.
      models = (await llm.listModels(provider.id)) || []
    } catch (err) {
      models = []
    }
    for (const model of models) {
      if (!model || typeof model.id !== 'string') continue
      rows.push({ provider: provider.id, model: model.id, label: model.label || model.name || model.id })
    }
  }
  return rows
}

/**
 * Run one model call and return the full text.
 * Throws when the stream ends early or the provider reports an error reason.
 */
export async function streamText(ctx, options) {
  const llm = ctx.get('llm')
  if (!llm || typeof llm.prepareCall !== 'function') {
    throw new Error('host has no usable model service (llm)')
  }
  const route = options.route || defaultRoute(ctx)
  if (!route) {
    throw new Error('no default model found; pick a default model in Harness first')
  }
  const signal = options.signal
  const call = await llm.prepareCall({
    provider: route.provider,
    model: route.model,
    temperature: options.temperature === undefined ? 0.2 : options.temperature,
    maxTokens: options.maxTokens || 4096,
  }, signal, (controls, info) => {
    const effort = info && info.reasoning && info.reasoning.efforts && info.reasoning.efforts[0]
    const effortId = effort && effort.id
    return effortId === undefined ? controls : { ...controls, reasoningEffort: effortId }
  })
  const blocks = new Map()
  let finished = false
  for await (const chunk of call.stream({
    ...call.config,
    system: options.system,
    messages: [{ role: 'user', content: [{ type: 'text', text: options.user }] }],
    sessionId: options.sessionId || PLUGIN_SESSION_ID,
    signal,
  })) {
    if (signal && signal.aborted) throw new Error('request aborted')
    if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text' && typeof chunk.block.text === 'string' && typeof chunk.index === 'number') {
      blocks.set(chunk.index, chunk.block.text)
    }
    if (chunk.type === 'finish') {
      const kind = chunk.reason && chunk.reason.kind
      if (kind && kind !== 'stop') {
        const message = (chunk.reason && chunk.reason.failure && chunk.reason.failure.message) || ('model call did not complete: ' + kind)
        throw new Error(message)
      }
      finished = true
    }
  }
  if (!finished) throw new Error('model stream ended early; please retry')
  const text = [...blocks.entries()].sort((a, b) => a[0] - b[0]).map(item => item[1]).join('\n').trim()
  if (!text) throw new Error('model returned no text')
  return text
}
