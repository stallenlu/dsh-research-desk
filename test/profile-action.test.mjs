// profile-action.test.mjs — update_profile 薄 action 服务端语义（独立文件，不碰 client-ui.test.mjs）
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createService } from '../lib/host.mjs'

const prev = process.env.DSH_HOME
const home = mkdtempSync(join(tmpdir(), 'rd-profile-'))
process.env.DSH_HOME = home
after(() => { try { if (prev === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = prev } finally { rmSync(home, { recursive: true, force: true }) } })

const ctx = { get: () => undefined }

test('update_profile 整体赋值：允许空数组覆盖，删掉某组最后一项真的生效', async () => {
  const svc = createService(ctx)
  const seeded = { profile: { focus: ['图神经网络'], sources: ['arXiv'], habits: ['先综述'], updatedAt: '2020-01-01T00:00:00.000Z' } }
  const fsMod = await import('node:fs')
  fsMod.mkdirSync(join(home, 'research-desk'), { recursive: true })
  fsMod.writeFileSync(join(home, 'research-desk', 'state.json'), JSON.stringify(seeded))

  // 只传 focus:[] —— 应把 focus 清空，sources/habits 保持不变（部分更新不误删其他组）。
  const r = await svc.run({ action: 'update_profile', focus: [] })
  assert.equal(r.ok, true)
  assert.equal(r.action, 'update_profile')
  assert.deepEqual(r.library.profile.focus, [])
  assert.deepEqual(r.library.profile.sources, ['arXiv'])
  assert.deepEqual(r.library.profile.habits, ['先综述'])

  // 三组全空也要生效（set_profile 的回退做不到这点）。
  const r2 = await svc.run({ action: 'update_profile', focus: [], sources: [], habits: [] })
  assert.deepEqual(r2.library.profile.focus, [])
  assert.deepEqual(r2.library.profile.sources, [])
  assert.deepEqual(r2.library.profile.habits, [])
})

test('update_profile 走白名单清洗：非字符串/超长/超量被过滤，switch 分发可达', async () => {
  const svc = createService(ctx)
  const long = 'x'.repeat(200)
  const r = await svc.run({ action: 'update_profile', focus: ['  正常方向  ', '', 123, long], habits: ['a', 'b'] })
  assert.equal(r.ok, true, 'switch 应分发到 updateProfile')
  assert.equal(r.action, 'update_profile')
  assert.equal(r.library.profile.focus.length, 2, 'cleanText 是截断：超长串截到 160 保留，非字符串被丢弃')
  assert.equal(r.library.profile.focus[0], '正常方向')
  assert.equal(r.library.profile.focus[1].length, 160, '超长串截到 160')
  assert.deepEqual(r.library.profile.habits, ['a', 'b'])
})
