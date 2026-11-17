// Small helpers shared by the host half. No dependencies on purpose:
// the plugin must keep working when the host has no network to npm.
import { randomBytes } from 'node:crypto'

export function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + randomBytes(4).toString('hex')
}

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function cleanList(value, max) {
  if (!Array.isArray(value)) return []
  return value.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean).slice(0, max)
}

export function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Parse JSON out of a model answer: plain JSON, fenced JSON, or JSON with prose around it. */
export function parseJsonLoose(text) {
  if (typeof text !== 'string') return null
  const body = text.trim()
  try {
    return JSON.parse(body)
  } catch {
    // fall through: the model usually wrapped it in prose or a code fence
  }
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(body.slice(start, end + 1))
    } catch {
      return null
    }
  }
  return null
}

export function nowIso() {
  return new Date().toISOString()
}

export function truncate(text, max) {
  const value = typeof text === 'string' ? text : ''
  return value.length <= max ? value : value.slice(0, max - 1) + '…'
}

export function dedupe(list) {
  return Array.from(new Set(list))
}
