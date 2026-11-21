// Settings for the research desk.
//
// Two rules govern this file.
// 1. Every setting is declared in SETTING_DEFS. Unknown keys are dropped, so
//    nothing a model produces can create a field the user did not choose.
// 2. A secret is stored as the NAME of an environment variable, never as the
//    value. The plugin resolves the value from the environment at call time,
//    so the state file and every export stay free of credentials.

export const SETTING_DEFS = [
  {
    key: 'sources',
    label: '检索数据源',
    type: 'enumList',
    options: ['arxiv', 'europepmc', 'openalex'],
    default: ['arxiv', 'europepmc', 'openalex'],
    help: '留空则三个源都不检索。',
  },
  {
    key: 'maxResults',
    label: '单源最大条数',
    type: 'int',
    min: 1,
    max: 40,
    default: 15,
  },
  {
    key: 'model.route',
    label: '覆盖默认模型',
    type: 'model',
    default: '',
    help: '格式 provider/model；留空则用宿主默认模型。',
  },
  {
    key: 'kelin.role',
    label: '科灵默认角色',
    type: 'enum',
    options: ['lead', 'methodologist', 'engineer', 'analyst'],
    default: 'lead',
    help: '本次合作可用 collaborations.kelinRole 覆盖；角色通过边界消息注入 agent，不写进 meta。',
  },
  {
    key: 'qa.limit',
    label: '问答检索段落数',
    type: 'int',
    min: 1,
    max: 20,
    default: 8,
  },
  {
    key: 'qa.minScore',
    label: '检索命中相对阈值',
    type: 'float',
    min: 0,
    max: 1,
    default: 0.6,
  },
  {
    key: 'qa.shareFullText',
    label: '把全文片段送给模型',
    type: 'bool',
    default: true,
    help: '关闭后只用摘要检索与作答。',
  },
  {
    key: 'review.perspectives',
    label: '综述视角',
    type: 'enumList',
    options: ['methodology', 'evidence', 'contradictions', 'gaps', 'applications'],
    default: ['methodology', 'evidence', 'contradictions', 'gaps'],
  },
  {
    key: 'review.maxSections',
    label: '单篇综述视角上限',
    type: 'int',
    min: 1,
    max: 5,
    default: 4,
  },
  {
    key: 'runner.enabled',
    label: '允许调用外部工具',
    type: 'bool',
    default: false,
    help: '关闭后所有实验命令都会被拒绝。',
  },
  {
    key: 'runner.pythonPath',
    label: 'Python 解释器',
    type: 'path',
    default: '',
    help: '留空则自动探测。',
  },
  {
    key: 'runner.nodePath',
    label: 'Node 解释器',
    type: 'path',
    default: '',
    help: '留空则自动探测。',
  },
  {
    key: 'runner.timeoutSec',
    label: '单次调用超时（秒）',
    type: 'int',
    min: 5,
    max: 600,
    default: 60,
  },
  {
    key: 'runner.workDir',
    label: '调用工作目录',
    type: 'path',
    default: '',
    help: '留空则用插件数据目录下的 runs。',
  },
  {
    key: 'runner.allowInstall',
    label: '允许安装外部包',
    type: 'bool',
    default: false,
    help: '打开后只接受 pip install 与 npm install 形式，并校验包名。',
  },
  {
    key: 'runner.packages',
    label: '预装包名',
    type: 'string',
    default: '',
    help: '逗号分隔，例如 numpy,scipy。',
  },
  {
    key: 'stats.alpha',
    label: '显著性水平',
    type: 'float',
    min: 0.0001,
    max: 0.5,
    default: 0.05,
  },
  {
    key: 'stats.adjust',
    label: '多重比较校正',
    type: 'enum',
    options: ['none', 'holm', 'bonferroni'],
    default: 'holm',
  },
  {
    key: 'privacy.shareAbstracts',
    label: '把摘要送给模型',
    type: 'bool',
    default: true,
  },
  {
    key: 'storage.dataDir',
    label: '数据落地目录',
    type: 'path',
    default: '',
    help: '留空则用 DSH_HOME 数据目录。',
  },
  {
    key: 'secrets.openalexKey',
    label: 'OpenAlex 密钥环境变量名',
    type: 'secretRef',
    default: '',
  },
  {
    key: 'secrets.semanticScholarKey',
    label: 'Semantic Scholar 密钥环境变量名',
    type: 'secretRef',
    default: '',
  },
  {
    key: 'secrets.openalexMailto',
    label: 'OpenAlex 邮箱环境变量名',
    type: 'secretRef',
    default: '',
  },
  {
    key: 'image.protocol',
    label: '生图协议',
    type: 'enum',
    options: ['openai', 'bailian', 'wan'],
    default: 'openai',
    help: '三选一：openai 兼容接口、阿里百炼同步生图、万相异步生图；按你服务商给的方式填。',
  },
  {
    key: 'image.baseUrl',
    label: '生图接口地址',
    type: 'string',
    default: '',
    help: '接口根地址，例如 https://api.openai.com/v1；科灵会按协议自动剥掉多余的端点后缀；留空则不使用 HTTP 生图。',
  },
  {
    key: 'image.model',
    label: '生图模型',
    type: 'string',
    default: '',
    help: '接口接受的图片模型名，例如 gpt-image-1；留空则不使用 HTTP 生图。',
  },
  {
    key: 'image.size',
    label: '生图尺寸',
    type: 'string',
    default: '1536x1024',
    help: '传给接口的图片尺寸；不使用 HTTP 生图时可忽略。',
  },
  {
    key: 'image.quality',
    label: '生图质量',
    type: 'string',
    default: '',
    help: '要高清就填 hd 之类的质量档；服务商不支持就留空。',
  },
  {
    key: 'image.extra',
    label: '生图附加参数',
    type: 'string',
    default: '',
    help: '填一个 JSON 对象，例如 {"quality":"hd"}；同名参数会覆盖上面的设置，不填留空。',
  },
  {
    key: 'image.apiKeyRef',
    label: '生图密钥环境变量名',
    type: 'secretRef',
    default: '',
    help: '填环境变量名，不是密钥本身；密钥只从环境变量读取，不写进科灵台、不随导出带走。',
  },
]

export const SECRET_TYPES = new Set(['secretRef'])

export function settingDefs() {
  return SETTING_DEFS.map(def => ({
    ...def,
    options: def.options ? def.options.slice() : undefined,
    default: Array.isArray(def.default) ? def.default.slice() : def.default,
  }))
}

export function defaultSettings() {
  const out = {}
  for (const def of SETTING_DEFS) out[def.key] = Array.isArray(def.default) ? def.default.slice() : def.default
  return out
}

export function isSecretKey(key) {
  const def = SETTING_DEFS.find(row => row.key === key)
  return !!def && SECRET_TYPES.has(def.type)
}

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * 生图接口地址归一化：按协议剥掉完整端点后缀，只存域名根；非空必须以 http(s) 开头。
 * openai 剥 /images/generations；bailian / wan 剥各自的完整端点与 /api/v1。
 */
export function normalizeImageBaseUrl(raw, protocol) {
  let url = String(raw == null ? '' : raw).trim().replace(/\/+$/, '')
  if (!url) return { value: '' }
  if (protocol === 'bailian') {
    url = url.replace(/\/api\/v1\/services\/aigc\/multimodal-generation\/generation$/i, '').replace(/\/api\/v1$/i, '')
  } else if (protocol === 'wan') {
    url = url.replace(/\/api\/v1\/(?:services\/aigc\/text2image\/image-synthesis|tasks\/[^/]+)$/i, '').replace(/\/api\/v1$/i, '')
  } else {
    url = url.replace(/\/images\/generations$/i, '')
  }
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return { error: '接口地址要以 http:// 或 https:// 开头' }
  return { value: url }
}

function coerce(def, value, protocol) {
  switch (def.type) {
    case 'int': {
      const parsed = Number(value)
      if (!isFinite(parsed)) return { error: '不是数字' }
      const min = def.min === undefined ? -Infinity : def.min
      const max = def.max === undefined ? Infinity : def.max
      return { value: Math.min(Math.max(Math.round(parsed), min), max) }
    }
    case 'float': {
      const parsed = Number(value)
      if (!isFinite(parsed)) return { error: '不是数字' }
      const min = def.min === undefined ? -Infinity : def.min
      const max = def.max === undefined ? Infinity : def.max
      return { value: Math.min(Math.max(parsed, min), max) }
    }
    case 'bool': {
      if (typeof value === 'boolean') return { value }
      if (value === 'true' || value === '1' || value === 1) return { value: true }
      if (value === 'false' || value === '0' || value === 0) return { value: false }
      return { error: '不是布尔值' }
    }
    case 'enum': {
      const text = String(value == null ? '' : value).trim()
      if (!def.options.includes(text)) return { error: '不在可选范围内' }
      return { value: text }
    }
    case 'enumList': {
      const list = Array.isArray(value) ? value : String(value == null ? '' : value).split(',')
      const out = []
      for (const item of list) {
        const text = String(item == null ? '' : item).trim()
        if (!text) continue
        if (!def.options.includes(text)) return { error: '含未知选项：' + text }
        if (!out.includes(text)) out.push(text)
      }
      return { value: out }
    }
    case 'model': {
      const text = String(value == null ? '' : value).trim()
      if (!text) return { value: '' }
      if (!text.includes('/')) return { error: '需要 provider/model 格式' }
      return { value: text.slice(0, 200) }
    }
    case 'secretRef': {
      const text = String(value == null ? '' : value).trim()
      if (!text) return { value: '' }
      if (!ENV_NAME.test(text)) return { error: '环境变量名不合法' }
      return { value: text }
    }
    case 'path': {
      const text = String(value == null ? '' : value).trim()
      return { value: text.slice(0, 500) }
    }
    case 'string': {
      const text = String(value == null ? '' : value)
      if (def.key === 'image.baseUrl') return normalizeImageBaseUrl(text, protocol)
      if (def.key === 'image.extra') {
        const trimmed = text.trim()
        if (trimmed) {
          let parsed = null
          try { parsed = JSON.parse(trimmed) } catch {}
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: '附加参数要是一个 JSON 对象' }
        }
        return { value: trimmed }
      }
      return { value: text.slice(0, 500) }
    }
    default: {
      const text = String(value == null ? '' : value)
      return { value: text.slice(0, 500) }
    }
  }
}

/**
 * Merge a patch into the current settings.
 * Unknown keys are dropped. Values that fail validation keep the old value.
 * @param {object} patch - the values the user submitted.
 * @param {object} current - the settings in force right now.
 * @returns {{values: object, errors: string[], changed: string[]}} the merged settings.
 */
export function coerceSettings(patch, current) {
  const values = { ...current }
  const errors = []
  const changed = []
  if (!patch || typeof patch !== 'object') return { values, errors, changed }
  // 地址归一化要看协议：本次补丁改了协议就以新协议为准，否则沿用当前协议。
  const protocolPatch = patch['image.protocol']
  const protocolResult = protocolPatch === undefined ? null : coerce(SETTING_DEFS.find(row => row.key === 'image.protocol'), protocolPatch)
  const effectiveProtocol = protocolResult && !protocolResult.error ? protocolResult.value : values['image.protocol']
  for (const [key, raw] of Object.entries(patch)) {
    const def = SETTING_DEFS.find(row => row.key === key)
    if (!def) {
      errors.push('不认识的设置项：' + key)
      continue
    }
    const result = coerce(def, raw, effectiveProtocol)
    if (result.error) {
      errors.push(def.label + '：' + result.error)
      continue
    }
    const before = JSON.stringify(values[key])
    const after = JSON.stringify(result.value)
    if (before !== after) changed.push(key)
    values[key] = result.value
  }
  return { values, errors, changed }
}

/** Merge stored settings over the defaults so a new release adds new keys safely. */
export function readSettings(state) {
  const values = defaultSettings()
  const stored = state && state.settings && typeof state.settings === 'object' ? state.settings : {}
  for (const def of SETTING_DEFS) {
    if (!(def.key in stored)) continue
    const result = coerce(def, stored[def.key], values['image.protocol'])
    if (!result.error) values[def.key] = result.value
  }
  return values
}

/**
 * Resolve one secret setting to its environment value.
 * @param {object} settings - the settings in force.
 * @param {string} key - the setting key.
 * @returns {{name: string, value: string, present: boolean}|null} the secret or null.
 */
export function resolveSecret(settings, key) {
  if (!isSecretKey(key)) return null
  const name = settings && settings[key] ? String(settings[key]) : ''
  if (!name) return null
  const value = process.env[name]
  return { name, value: value === undefined ? '' : String(value), present: value !== undefined && value !== '' }
}

/** Rows for the settings panel: never the secret value, only whether it resolves. */
export function describeSettings(settings) {
  const rows = []
  for (const def of SETTING_DEFS) {
    const value = settings ? settings[def.key] : def.default
    const row = {
      key: def.key,
      label: def.label,
      type: def.type,
      help: def.help || '',
      value: SECRET_TYPES.has(def.type) ? '' : value,
      options: def.options ? def.options.slice() : undefined,
      secret: false,
    }
    if (SECRET_TYPES.has(def.type)) {
      const secret = resolveSecret(settings, def.key)
      row.secret = true
      row.value = secret ? secret.name : ''
      row.present = !!(secret && secret.present)
    }
    rows.push(row)
  }
  return rows
}

export function resetSettings() {
  return defaultSettings()
}