// Persistence for the research desk.
// State lives in $DSH_HOME/research-desk/state.json so the desktop app and the
// web app share one copy. Two host processes may run at once, so every write
// re-reads the file when its mtime moved.
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { AsyncLocalStorage } from 'node:async_hooks'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isObject } from './util.mjs'

const MAX_UNDO = 30
const UNDO_STDOUT_LIMIT = 2000   // 内存 undo 快照里 stdout/stderr 只留预览，持久化 state 不受影响

// 给内存 undo 快照瘦身：experiments 的大 stdout/stderr 截短，避免 30 份全量快照吃内存。
// 只作用于 this.undo 里的副本，state.json 与当前 state 保留完整 20000 字上限内容。
function slimUndoSnapshot(state) {
  if (!state || !Array.isArray(state.experiments)) return state
  const copy = { ...state, experiments: state.experiments.map(row => ({ ...row })) }
  for (const row of copy.experiments) {
    if (typeof row.stdout === 'string' && row.stdout.length > UNDO_STDOUT_LIMIT) row.stdout = row.stdout.slice(0, UNDO_STDOUT_LIMIT)
    if (typeof row.stderr === 'string' && row.stderr.length > UNDO_STDOUT_LIMIT) row.stderr = row.stderr.slice(0, UNDO_STDOUT_LIMIT)
  }
  return copy
}

export function dshHome(env = process.env) {
  return env.DSH_HOME || join(homedir(), '.dsh')
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isKeyed(list) {
  return list.every(row => isObject(row) && typeof row.id === 'string')
}

/**
 * Undo one keyed list step: rows added by the step are dropped, rows changed by
 * the step are rolled back field by field, rows deleted by the step are put
 * back. Rows changed later by somebody else are left alone.
 * (Same three-way merge strategy dsh-media-desk uses; written from scratch here.)
 */
function revertList(before, after, current) {
  const was = new Map(before.map(row => [row.id, row]))
  const now = new Map(after.map(row => [row.id, row]))
  const result = current
    .filter(row => !(now.has(row.id) && !was.has(row.id)))
    .map(row => (was.has(row.id) && now.has(row.id) ? revertChange(was.get(row.id), now.get(row.id), row) : row))
  const present = new Set(result.map(row => row.id))
  before.forEach((row, index) => {
    if (now.has(row.id) || present.has(row.id)) return
    result.splice(Math.min(index, result.length), 0, structuredClone(row))
    present.add(row.id)
  })
  return result
}

/**
 * Undo one value change: only the part this step actually changed, and only
 * if nothing else touched it afterwards.
 */
export function revertChange(before, after, current) {
  if (same(before, after)) return current
  if (same(current, after)) return before === undefined ? undefined : structuredClone(before)
  if (isObject(before) && isObject(after) && isObject(current)) {
    const result = { ...current }
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const value = revertChange(before[key], after[key], current[key])
      if (value === undefined) delete result[key]
      else result[key] = value
    }
    return result
  }
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
    if (isKeyed(before) && isKeyed(after) && isKeyed(current) && (before.length || after.length)) {
      return revertList(before, after, current)
    }
    if (before.length === after.length && after.length === current.length) {
      return current.map((row, index) => revertChange(before[index], after[index], row))
    }
  }
  return current
}

export class Store {
  constructor(root = join(dshHome(), 'research-desk'), createState) {
    this.root = root
    this.file = join(root, 'state.json')
    this.createState = createState
    this.state = null
    this.mtimeMs = 0
    this.undo = []
    this.queue = Promise.resolve()
    this._mutateALS = new AsyncLocalStorage()
  }

  async read() {
    await mkdir(this.root, { recursive: true })
    let info = null
    try {
      info = await stat(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    if (!info) {
      this.state = this.createState()
      await this.persist()
      return this.state
    }
    if (this.state && info.mtimeMs === this.mtimeMs) return this.state
    const raw = await readFile(this.file, 'utf8')
    const parsed = JSON.parse(raw)
    this.state = this.createState(parsed)
    this.mtimeMs = info.mtimeMs
    return this.state
  }

  async persist() {
    const tmp = this.file + '.tmp'
    await writeFile(tmp, JSON.stringify(this.state, null, 2), 'utf8')
    await rename(tmp, this.file)
    const info = await stat(this.file)
    this.mtimeMs = info.mtimeMs
  }

  /**
   * Change the state through one function and record an undo entry.
   * Writes are serialized so two callers cannot interleave a read and a write.
   */
  mutate(label, fn, options = {}) {
    const undoable = options.undoable !== false
    const run = async () => {
      if (this._mutateALS.getStore()) {
        throw new Error('禁止在 mutate.fn 内嵌套调用 store.mutate（会死锁）：请把多次写入合并为一次 mutate')
      }
      return this._mutateALS.run(true, async () => {
        const before = await this.read()
        const draft = structuredClone(before)
        const result = await fn(draft)
        const after = structuredClone(draft)
        this.state = after
        await this.persist()
        if (undoable) {
          this.undo.push({ label, before: slimUndoSnapshot(before), after: slimUndoSnapshot(after), at: new Date().toISOString() })
          if (this.undo.length > MAX_UNDO) this.undo.shift()
        }
        return result
      })
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => {})
    return next
  }

  async undoStep() {
    const entry = this.undo.pop()
    if (!entry) return { ok: false, label: null }
    const current = await this.read()
    this.state = revertChange(entry.before, entry.after, current)
    await this.persist()
    return { ok: true, label: entry.label, state: this.state }
  }

  async canUndo() {
    return this.undo.length > 0
  }

  /** List reversible steps oldest-first. Each entry is a snapshot of a completed change. */
  history() {
    return this.undo.map((entry, index) => ({
      index,
      label: entry.label,
      at: entry.at || null,
    }))
  }

  /**
   * Jump back to the state right after step #index. Later steps are dropped as
   * an abandoned branch, so a following undo walks back from this point.
   */
  async restore(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.undo.length) {
      return { ok: false, label: null }
    }
    const entry = this.undo[index]
    this.state = structuredClone(entry.after)
    await this.persist()
    this.undo.length = index + 1
    return { ok: true, label: entry.label, state: this.state }
  }
}

export { MAX_UNDO }
