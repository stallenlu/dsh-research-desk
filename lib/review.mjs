// 多视角综述：先检索、再写、最后逐字核验引文。
//
// 这一层存在的意义是把「综述」和「幻觉」隔开：每个视角只能看到检索到的
// 段落，模型给出的每条引文都要回到原文里逐字比对，对不上的直接剔除并
// 记录下来，绝不当作证据展示出去。

import { cleanText, isObject, parseJsonLoose } from './util.mjs'
import { retrieve } from './qa.mjs'
import { streamText as defaultStreamText } from './llm.mjs'

/**
 * 五个综述视角：检索词决定找什么，写作指令决定怎么写。
 * 键的顺序就是默认顺序，和设置面板里的选项保持一致。
 */
export const PERSPECTIVES = {
  methodology: {
    label: '方法学',
    query: 'method methodology experiment dataset setup evaluation design protocol',
    instruction: '梳理这些研究用了什么方法、数据从哪里来、实验怎样设计和评估，并指出方法之间的差别。',
  },
  evidence: {
    label: '证据',
    query: 'evidence result finding measurement outcome significant',
    instruction: '汇总这些研究报告了哪些主要结果，说明每条结论背后有什么证据支撑，哪些结论的证据最弱。',
  },
  contradictions: {
    label: '矛盾与争议',
    query: 'contradiction conflict inconsistent disagree disagreement',
    instruction: '找出这些研究之间在结论、机制或数值上的分歧，直接说明冲突在哪里、各自的依据是什么。',
  },
  gaps: {
    label: '研究缺口',
    query: 'gap limitation unresolved future work challenge',
    instruction: '指出这些研究还没有回答的问题、被忽略的变量和缺失的实验，并说明补上它们需要什么条件。',
  },
  applications: {
    label: '应用与影响',
    query: 'application deployment clinical industry practical',
    instruction: '讨论这些研究成果能用在什么地方、落地需要什么条件、有哪些局限，以及对后续工作意味着什么。',
  },
}

/**
 * 视角键的顺序列表。
 * @returns {string[]} 五个视角的键。
 */
export function perspectiveKeys() {
  return Object.keys(PERSPECTIVES)
}

// 通用规则写在代码里：五个视角必须守同一条底线，否则会写出五种口径。
const COMMON_RULES = [
  '通用规则（不可违反）：',
  '1. 只能使用下面给出的段落，不要凭记忆补充任何事实。',
  '2. 每一条事实性句子末尾必须标出来源段落标签，例如 [S1]、[S2]。',
  '3. 引用原文必须逐字照抄，不得改写、翻译或拼接。',
  '4. 不许编造：段落里没有的内容不要写出来。',
  '5. 段落之间如果互相矛盾，直接指出冲突，并同时标出双方的标签。',
  '6. 材料不足以支撑本视角时，直接说明还缺什么，不要含糊其辞。',
  '7. 只输出 JSON，不要输出任何多余文字。',
].join('\n')

const JSON_CONTRACT = [
  '输出 JSON：{"text": string, "citations": [{"chunkId": string, "quote": string}]}',
  'text 是本视角的正文；citations 列出正文里每条事实所依赖的原文段落。',
  'chunkId 用段落里给出的原值，quote 必须逐字来自该段落。',
].join('\n')

/** 正文保留换行：综述是多段落的，折叠空白会把它压成一行。 */
function keepText(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n/g, '\n').trim().slice(0, max)
}

/** 比对引文时统一空白：模型常把换行压成空格，但字符本身仍要求逐字一致。 */
function normalizeWs(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

/** 命中段落编号成 [S1][S2]，模型才知道每句话该标哪一个。 */
function buildContext(hits) {
  return hits.map((hit, index) => {
    return '[S' + (index + 1) + '] paper=' + hit.paperId + ' chunk=' + hit.chunkId + ' heading=' + (hit.heading || '-') + '\n' + hit.text
  }).join('\n\n')
}

/**
 * 每篇最多取两段，总数再由 limit 收口。
 * 综述要覆盖多篇文献，而不是把一篇写透。
 * @param {Array} hits - 检索到的命中，按相关性排序。
 * @param {number} limit - 最多用多少段。
 * @returns {Array} 裁剪后的命中。
 */
function capHits(hits, limit) {
  const perPaper = new Map()
  const out = []
  for (const hit of hits) {
    const used = perPaper.get(hit.paperId) || 0
    if (used >= 2) continue
    perPaper.set(hit.paperId, used + 1)
    out.push(hit)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 逐条核验引文：quote 必须逐字出现在它所声称的那个 chunk 里。
 * @param {Array} list - 模型给出的引文列表。
 * @param {Array} hits - 本视角用到的命中段落。
 * @returns {{citations: Array, unverified: Array}} 通过核验的引文与被剔除的引文。
 */
function verifyCitations(list, hits) {
  const byId = new Map(hits.map(hit => [hit.chunkId, hit]))
  const citations = []
  const unverified = []
  for (const item of list) {
    if (!isObject(item)) continue
    const chunkId = cleanText(item.chunkId, 120)
    // 引文保留内部空白：cleanText 会折叠换行，反而让多行引用对不上原文。
    const quote = typeof item.quote === 'string' ? item.quote.trim().slice(0, 1200) : ''
    const hit = byId.get(chunkId)
    if (!hit) {
      unverified.push({ chunkId: chunkId || '(空)', quote: quote.slice(0, 120), reason: '找不到对应段落' })
      continue
    }
    if (!quote) {
      unverified.push({ chunkId, quote: '', reason: '引文是空的' })
      continue
    }
    if (!hit.text.includes(quote) && !normalizeWs(hit.text).includes(normalizeWs(quote))) {
      unverified.push({ chunkId, quote: quote.slice(0, 120), reason: '引用与原文不一致' })
      continue
    }
    citations.push({ chunkId, paperId: hit.paperId, title: hit.title, heading: hit.heading, quote })
  }
  return { citations, unverified }
}

/**
 * 取出要写的视角：只认已知的键，去重；一个都没给就写全部。
 * @param {string[]} requested - 请求的视角键。
 * @returns {string[]} 实际要写的视角键。
 */
function pickPerspectives(requested) {
  const list = Array.isArray(requested) ? requested : []
  const out = []
  for (const key of list) {
    const name = typeof key === 'string' ? key.trim() : ''
    if (!name || !(name in PERSPECTIVES) || out.includes(name)) continue
    out.push(name)
  }
  return out.length ? out : perspectiveKeys()
}

/**
 * 生成一篇多视角综述。
 * 视角是顺序执行的，不并发：同一个模型路由同时跑多个请求容易被限流。
 * @param {object} ctx - 宿主上下文，原样交给模型调用。
 * @param {object} options - 生成参数。
 * @param {Array<{paper: object, chunks: Array}>} options.documents - 已入库全文的文献。
 * @param {string[]} options.perspectives - 要写的视角键，留空表示全部。
 * @param {string} options.topic - 综述主题，只用来补充检索词。
 * @param {number} options.limit - 每个视角最多用多少段，默认 6。
 * @param {AbortSignal} options.signal - 取消信号。
 * @param {object} options.route - 模型路由，provider/model。
 * @param {Function} options.streamText - 可注入的模型调用，测试用假实现。
 * @returns {Promise<object>} 综述结果，含各视角正文、引文与统计。
 */
export async function generateReview(ctx, options = {}) {
  const opts = isObject(options) ? options : {}
  const documents = Array.isArray(opts.documents) ? opts.documents : []
  const topic = cleanText(opts.topic, 500)
  const limit = Math.min(Math.max(Number(opts.limit) || 6, 1), 20)
  const call = typeof opts.streamText === 'function' ? opts.streamText : defaultStreamText
  const keys = pickPerspectives(opts.perspectives)
  const sections = []

  for (const key of keys) {
    const spec = PERSPECTIVES[key]
    const section = { key, label: spec.label, text: '', citations: [], unverified: [], hits: [] }
    try {
      const query = [spec.query, topic].filter(Boolean).join(' ')
      // 多取一些再按篇数裁剪：先裁剪会把相关性高但排序靠后的段落切掉。
      const found = retrieve(query, documents, { limit: Math.max(limit * 3, 8) })
      const hits = capHits(found, limit)
      section.hits = hits.map((hit, index) => ({
        tag: '[S' + (index + 1) + ']',
        chunkId: hit.chunkId,
        paperId: hit.paperId,
        title: hit.title,
        heading: hit.heading,
        score: hit.score,
      }))
      if (!hits.length) {
        // 没有段落就没有模型调用：让模型凭题目编一段只会产出假综述。
        section.text = '文献库中没有可支撑的段落。'
        sections.push(section)
        continue
      }
      const rawText = await call(ctx, {
        system: [spec.instruction, '', COMMON_RULES, '', JSON_CONTRACT].join('\n'),
        user: [
          '主题：' + (topic || '未指定'),
          '视角：' + spec.label + '（' + key + '）',
          '检索词：' + query,
          '',
          '可用段落：',
          buildContext(hits),
        ].join('\n'),
        signal: opts.signal,
        temperature: 0.2,
        maxTokens: 4000,
        route: opts.route,
      })
      const parsed = parseJsonLoose(rawText)
      if (!isObject(parsed)) {
        section.text = keepText(rawText, 20000)
        section.error = '模型没有返回可解析的 JSON。'
        sections.push(section)
        continue
      }
      section.text = keepText(parsed.text, 20000) || keepText(rawText, 20000)
      const list = Array.isArray(parsed.citations) ? parsed.citations : []
      const checked = verifyCitations(list, hits)
      section.citations = checked.citations
      section.unverified = checked.unverified
    } catch (err) {
      // 单个视角失败不能作废整篇综述：把原因记在这一段上，其余视角继续。
      const message = err && err.message ? err.message : String(err)
      section.error = '模型调用失败：' + message
      if (!section.text) section.text = '这个视角没有完成：' + message
    }
    sections.push(section)
  }

  const citationCount = sections.reduce((sum, section) => sum + section.citations.length, 0)
  const unverifiedCount = sections.reduce((sum, section) => sum + section.unverified.length, 0)
  const paperIds = new Set()
  for (const section of sections) {
    for (const cite of section.citations) paperIds.add(cite.paperId)
  }
  return {
    ok: sections.some(section => !section.error),
    topic,
    sections,
    stats: {
      sections: sections.length,
      citationCount,
      unverifiedCount,
      paperCount: paperIds.size,
    },
  }
}
