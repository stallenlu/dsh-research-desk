// dsh-research-desk — sidebar panel.
//
// No build step: this file is loaded as-is by the host module loader and
// written with React.createElement only. Every call goes to the same-origin
// bridge POST /api/research-desk/ that the host half serves, so the panel and
// the agent tool share one state file.
window.__ModuleLoader__.load({
  id: 'dsh-research-desk',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const NS = 'dsh-research-desk'
    const PANEL_ID = 'dsh-research-desk'
    // 路由不带前导斜杠：跟同门插件 dsh-better-sidebar 的做法一致，用页面自己的
    // base 解析，反向代理的目录前缀和桌面壳的 dsh-app:// 都留在前缀里。
    const ROUTE = 'api/research-desk/'

    // 把宿主路由解析到页面自己的 base 上：去掉 query（启动 token 在那儿）与 hash，
    // 补上尾部斜杠，再用相对路径拼，避免把请求打到源站的根目录。
    function hostRouteUrl(path) {
      const base = typeof document !== 'undefined' && typeof document.baseURI === 'string' ? document.baseURI : ''
      const url = new URL(base === '' ? 'http://dsh.internal/' : base, 'http://dsh.internal/')
      url.search = ''
      url.hash = ''
      if (!url.pathname.endsWith('/')) url.pathname += '/'
      return new URL(String(path).replace(/^\/+/, ''), url.href)
    }

    const CSS = "body, .rd-root {\n  --rd-surface: var(--dsw-alias-bg-layer-1, #ffffff);\n  --rd-surface-2: var(--dsw-alias-bg-layer-2, #fafafa);\n  --rd-surface-3: var(--dsw-alias-bg-layer-3, #f5f5f5);\n  --rd-line: var(--dsw-alias-border-l2, rgba(0,0,0,0.10));\n  --rd-text: var(--dsw-alias-label-primary, #0f1115);\n  --rd-text-2: var(--dsw-alias-label-secondary, #61666b);\n  --rd-text-3: var(--dsw-alias-label-caption, #adb2b8);\n  --rd-hover: var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,0.06));\n  --rd-inv-bg: var(--dsw-alias-label-primary, #0f1115);\n  --rd-inv-fg: var(--dsw-alias-label-primary-foreground, #ffffff);\n  --rd-accent: #3b82f6;\n  --rd-warn: #f59e0b;\n  --rd-error: #f43f5e;\n  --rd-ok: #22c55e;\n  --rd-radius: 12px;\n  --rd-radius-sm: 8px;\n  --rd-font: var(--dsw-font-family, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif);\n  --rd-mono: var(--ds-font-family-code, ui-monospace, Menlo, monospace);\n}\n.rd-root { font-family: var(--rd-font); color: var(--rd-text); padding: 12px; font-size: 13px; line-height: 1.6; }\n.rd-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }\n.rd-title { font-size: 14px; font-weight: 600; }\n.rd-sub { font-size: 11px; color: var(--rd-text-2); }\n.rd-tabs { display: flex; gap: 16px; border-bottom: 1px solid var(--rd-line); margin-bottom: 12px; }\n.rd-tab { padding: 7px 0 9px; border: 0; background: transparent; color: var(--rd-text-2); font: inherit; font-size: 12px; cursor: pointer; position: relative; }\n.rd-tab:hover { color: var(--rd-text); }\n.rd-tab[data-on='1'] { color: var(--rd-text); font-weight: 500; }\n.rd-tab[data-on='1']::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--rd-text); border-radius: 2px; }\n.rd-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }\n.rd-input { flex: 1 1 240px; min-width: 0; padding: 7px 10px; border: 1px solid var(--rd-line); border-radius: var(--rd-radius-sm); background: var(--rd-surface); color: var(--rd-text); font: inherit; font-size: 12px; }\n.rd-input:focus { outline: 2px solid color-mix(in srgb, var(--rd-accent) 40%, transparent); outline-offset: -1px; }\n.rd-btn { padding: 6px 12px; border: 1px solid var(--rd-line); border-radius: var(--rd-radius-sm); background: transparent; color: var(--rd-text); font: inherit; font-size: 12px; cursor: pointer; }\n.rd-btn:hover:not(:disabled) { background: var(--rd-hover); }\n.rd-btn:disabled { opacity: 0.45; cursor: default; }\n.rd-btn--primary { background: var(--rd-inv-bg); color: var(--rd-inv-fg); border-color: transparent; font-weight: 500; }\n.rd-btn--sm { padding: 3px 8px; font-size: 11px; }\n.rd-card { border: 1px solid var(--rd-line); border-radius: var(--rd-radius); background: var(--rd-surface); padding: 10px 12px; margin-bottom: 8px; }\n.rd-card h4 { margin: 0 0 4px; font-size: 13px; font-weight: 600; line-height: 1.45; }\n.rd-meta { font-size: 11px; color: var(--rd-text-2); }\n.rd-abs { font-size: 11px; color: var(--rd-text-2); margin-top: 4px; max-height: 54px; overflow: hidden; }\n.rd-chip { display: inline-block; padding: 1px 6px; border-radius: 9999px; background: var(--rd-surface-3); color: var(--rd-text-2); font-size: 10px; margin-right: 4px; }\n.rd-chip--ok { background: color-mix(in srgb, var(--rd-ok) 16%, transparent); color: var(--rd-ok); }\n.rd-chip--warn { background: color-mix(in srgb, var(--rd-warn) 16%, transparent); color: var(--rd-warn); }\n.rd-chip--err { background: color-mix(in srgb, var(--rd-error) 16%, transparent); color: var(--rd-error); }\n.rd-empty { padding: 26px 10px; text-align: center; color: var(--rd-text-2); font-size: 12px; }\n.rd-msg { font-size: 11px; color: var(--rd-text-2); white-space: pre-wrap; margin-top: 6px; }\n.rd-msg--err { color: var(--rd-error); }\n.rd-cite { border-left: 2px solid var(--rd-accent); padding: 2px 0 2px 8px; margin-top: 6px; font-size: 11px; color: var(--rd-text-2); }\n.rd-cite code { font-family: var(--rd-mono); font-size: 10px; color: var(--rd-text-3); }\n.rd-body { font-size: 12px; white-space: pre-wrap; max-height: 320px; overflow: auto; }\n.rd-hyp { border-left: 2px solid var(--rd-accent); padding-left: 8px; margin-bottom: 10px; }\n.rd-note { font-size: 11px; color: var(--rd-text-3); }\n.rd-area { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--rd-line); border-radius: var(--rd-radius-sm); background: var(--rd-surface); color: var(--rd-text); font-family: var(--rd-mono); font-size: 11px; line-height: 1.5; min-height: 120px; resize: vertical; }\n.rd-area:focus { outline: 2px solid color-mix(in srgb, var(--rd-accent) 40%, transparent); outline-offset: -1px; }\n.rd-tabs { flex-wrap: wrap; gap: 6px 16px; }"

    function injectStyles() {
      if (typeof document === 'undefined') return
      const existing = document.querySelector('style[data-rd="1"]')
      if (existing) return
      const style = document.createElement('style')
      style.dataset.rd = '1'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    async function call(payload) {
      const res = await fetch(hostRouteUrl(ROUTE).href, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal: AbortSignal.timeout(180000),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (!data || data.ok === false) {
        const err = new Error((data && data.message) || '请求失败')
        err.data = data
        throw err
      }
      return data
    }

    function chip(label, kind) {
      return h('span', { className: kind ? 'rd-chip rd-chip--' + kind : 'rd-chip' }, label)
    }

    function downloadText(filename, mime, content) {
      try {
        const blob = new Blob([content], { type: mime })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
        return true
      } catch (err) {
        return false
      }
    }

    function PanelIcon(props) {
      const size = (props && props.size) || 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
      }, [
        h('path', { key: 'a', d: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.5 1.5 0 0 0-1.5-1.5H4z' }),
        h('path', { key: 'b', d: 'M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.5 1.5 0 0 1 1.5-1.5H20z' }),
      ])
    }

    function Desk() {
      const [tab, setTab] = useState('search')
      const [busy, setBusy] = useState('')
      const [msg, setMsg] = useState(null)
      const [library, setLibrary] = useState({ papers: [], hypotheses: [], drafts: [], chat: [] })
      const [results, setResults] = useState([])
      const [query, setQuery] = useState('')
      const [sources, setSources] = useState({ arxiv: true, europepmc: true, openalex: true })
      const [question, setQuestion] = useState('')
      const [answer, setAnswer] = useState(null)
      const [instruction, setInstruction] = useState('')
      const [openDraft, setOpenDraft] = useState('')
      const [picked, setPicked] = useState({})
      const [reviewTopic, setReviewTopic] = useState('')
      const [perspectives, setPerspectives] = useState({ methodology: true, evidence: true, contradictions: true, gaps: true, applications: false })
      const [reviewOut, setReviewOut] = useState(null)
      const [expTitle, setExpTitle] = useState('')
      const [expRuntime, setExpRuntime] = useState('python')
      const [expCode, setExpCode] = useState('')
      const [expOut, setExpOut] = useState(null)
      const [exportFiles, setExportFiles] = useState([])
      const [settingRows, setSettingRows] = useState([])
      const [settingDraft, setSettingDraft] = useState({})
      const lastQuery = useRef('')

      const applyLibrary = useCallback(data => {
        if (data && data.library) setLibrary(data.library)
      }, [])

      const refresh = useCallback(async () => {
        try {
          const data = await call({ action: 'library' })
          applyLibrary(data)
        } catch (err) {
          setMsg({ text: String(err.message || err), error: true })
        }
      }, [applyLibrary])

      useEffect(() => {
        injectStyles()
        refresh()
      }, [refresh])

      const run = useCallback(async (label, payload) => {
        setBusy(label)
        setMsg(null)
        try {
          const data = await call(payload)
          applyLibrary(data)
          return data
        } catch (err) {
          setMsg({ text: String(err.message || err), error: true })
          return null
        } finally {
          setBusy('')
        }
      }, [applyLibrary])

      const doSearch = useCallback(async () => {
        const text = query.trim()
        if (!text) return
        lastQuery.current = text
        const pickedSources = Object.keys(sources).filter(key => sources[key])
        const data = await run('search', { action: 'search', query: text, sources: pickedSources, maxResults: 12 })
        if (data) setResults(Array.isArray(data.papers) ? data.papers : [])
      }, [query, sources, run])

      const addPapers = useCallback(async papers => {
        const data = await run('add', { action: 'add', papers })
        if (data) setResults(prev => prev.filter(row => !papers.some(item => item.title === row.title)))
      }, [run])

      const readPaper = useCallback(async paperId => {
        await run('read', { action: 'read', paperId })
      }, [run])

      const removePaper = useCallback(async paperId => {
        await run('remove', { action: 'remove', paperId })
      }, [run])

      const doAsk = useCallback(async () => {
        const text = question.trim()
        if (!text) return
        const ids = Object.keys(picked).filter(key => picked[key])
        const data = await run('ask', { action: 'ask', question: text, paperIds: ids })
        if (data) {
          setAnswer({ text: data.message, citations: data.citations || [], unverified: data.unverified || [] })
          setQuestion('')
        }
      }, [question, picked, run])

      const doHypothesis = useCallback(async () => {
        await run('hypothesis', { action: 'hypothesis' })
      }, [run])

      const doDraft = useCallback(async () => {
        const data = await run('draft', { action: 'draft', instruction })
        if (data) setInstruction('')
      }, [instruction, run])

      const doReview = useCallback(async () => {
        const keys = Object.keys(perspectives).filter(key => perspectives[key])
        const data = await run('review', { action: 'review', topic: reviewTopic, perspectives: keys })
        if (data && data.review) setReviewOut(data.review)
      }, [reviewTopic, perspectives, run])

      const doGaps = useCallback(async () => {
        const data = await run('gaps', { action: 'gaps', topic: reviewTopic })
        if (data && data.gaps) {
          setReviewOut({
            topic: (reviewTopic || '未命名主题') + ' · 研究缺口',
            sections: [{ key: 'gaps', label: '研究缺口', text: data.gaps.text, citations: data.gaps.citations || [] }],
          })
        }
      }, [reviewTopic, run])

      const doRun = useCallback(async () => {
        const data = await run('run', { action: 'run', title: expTitle, runtime: expRuntime, code: expCode })
        if (data && data.experiment) setExpOut(data.experiment)
      }, [expTitle, expRuntime, expCode, run])

      const doExport = useCallback(async () => {
        const data = await run('export', { action: 'export', formats: ['md', 'bib', 'json'] })
        if (data && data.files) setExportFiles(data.files)
      }, [run])

      const loadSettings = useCallback(async () => {
        try {
          const data = await call({ action: 'settings' })
          if (data && Array.isArray(data.rows)) {
            setSettingRows(data.rows)
            const draft = {}
            for (const row of data.rows) draft[row.key] = row.value
            setSettingDraft(draft)
          }
        } catch (err) {
          setMsg({ text: String(err.message || err), error: true })
        }
      }, [])

      useEffect(() => {
        loadSettings()
      }, [loadSettings])

      const saveSettings = useCallback(async () => {
        const patch = {}
        for (const row of settingRows) {
          const value = settingDraft[row.key]
          if (value === undefined) continue
          // 数字项留空表示「不改」，避免把空串送进校验当成非法值。
          if ((row.type === 'int' || row.type === 'float') && String(value).trim() === '') continue
          patch[row.key] = value
        }
        await run('settings', { action: 'settings', patch: patch })
        await loadSettings()
      }, [settingRows, settingDraft, run, loadSettings])

      const resetSettings = useCallback(async () => {
        await run('settings', { action: 'settings', reset: true })
        await loadSettings()
      }, [run, loadSettings])

      const tabs = [
        ['search', '检索'],
        ['library', '文献库'],
        ['ask', '问答'],
        ['hypothesis', '选题'],
        ['review', '综述'],
        ['experiment', '实验'],
        ['draft', '草稿'],
        ['export', '导出'],
        ['settings', '设置'],
      ]

      const renderSearch = () => h('div', null, [
        h('div', { className: 'rd-row', key: 'q' }, [
          h('input', {
            key: 'i', className: 'rd-input', value: query, placeholder: '检索式，例如：retrieval augmented generation evaluation',
            onChange: event => setQuery(event.target.value),
            onKeyDown: event => { if (event.key === 'Enter') doSearch() },
          }),
          h('button', { key: 'b', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: doSearch }, busy === 'search' ? '检索中…' : '检索'),
        ]),
        h('div', { className: 'rd-row', key: 's' }, Object.keys(sources).map(key => h('label', { key, className: 'rd-meta', style: { marginRight: '10px', cursor: 'pointer' } }, [
          h('input', {
            key: 'c', type: 'checkbox', checked: sources[key],
            onChange: event => setSources(prev => ({ ...prev, [key]: event.target.checked })),
          }),
          ' ' + key,
        ]))),
        results.length ? results.map((row, index) => h('div', { className: 'rd-card', key: 'r' + index }, [
          h('h4', { key: 't' }, row.title),
          h('div', { className: 'rd-meta', key: 'm' }, [
            chip(row.source || '?'),
            row.year ? chip(String(row.year)) : null,
            row.venue ? chip(String(row.venue).slice(0, 40)) : null,
            row.citedBy ? chip('被引 ' + row.citedBy) : null,
          ]),
          h('div', { className: 'rd-abs', key: 'a' }, row.abstract || '（无摘要）'),
          h('div', { className: 'rd-row', key: 'ac', style: { marginTop: '8px', marginBottom: '0' } }, [
            h('button', {
              key: 'add', className: 'rd-btn rd-btn--sm', disabled: busy !== '',
              onClick: () => addPapers([row]),
            }, '加入文献库'),
            row.url ? h('a', { key: 'u', className: 'rd-btn rd-btn--sm', href: row.url, target: '_blank', rel: 'noreferrer' }, '原文') : null,
          ]),
        ])) : h('div', { className: 'rd-empty' }, lastQuery.current ? '没有结果，换个检索式试试。' : '输入检索式开始。'),
      ])

      const renderLibrary = () => {
        const papers = library.papers || []
        if (!papers.length) return h('div', { className: 'rd-empty' }, '文献库是空的，先去检索并加入文献。')
        return h('div', null, papers.map(paper => h('div', { className: 'rd-card', key: paper.id }, [
          h('h4', { key: 't' }, paper.title),
          h('div', { className: 'rd-meta', key: 'm' }, [
            chip(paper.status, paper.status === 'read' ? 'ok' : paper.status === 'dropped' ? 'err' : ''),
            paper.year ? chip(String(paper.year)) : null,
            paper.venue ? chip(String(paper.venue).slice(0, 36)) : null,
            paper.chunks ? chip(paper.chunks + ' 段全文') : chip('仅摘要', 'warn'),
          ]),
          h('div', { className: 'rd-row', key: 'ac', style: { marginTop: '8px', marginBottom: '0' } }, [
            h('button', { key: 'r', className: 'rd-btn rd-btn--sm', disabled: busy !== '', onClick: () => readPaper(paper.id) }, busy === 'read' ? '抓取中…' : '抓取全文'),
            h('button', { key: 'd', className: 'rd-btn rd-btn--sm', disabled: busy !== '', onClick: () => removePaper(paper.id) }, '移出'),
            h('label', { key: 'p', className: 'rd-note', style: { marginLeft: '4px', cursor: 'pointer' } }, [
              h('input', {
                key: 'c', type: 'checkbox', checked: !!picked[paper.id],
                onChange: event => setPicked(prev => ({ ...prev, [paper.id]: event.target.checked })),
              }),
              ' 纳入问答',
            ]),
          ]),
        ])))
      }

      const renderAsk = () => h('div', null, [
        h('div', { className: 'rd-row', key: 'q' }, [
          h('input', {
            key: 'i', className: 'rd-input', value: question,
            placeholder: '针对已入库全文提问，答案只允许来自原文',
            onChange: event => setQuestion(event.target.value),
            onKeyDown: event => { if (event.key === 'Enter') doAsk() },
          }),
          h('button', { key: 'b', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: doAsk }, busy === 'ask' ? '回答中…' : '提问'),
        ]),
        h('div', { className: 'rd-note', key: 'h' }, '未勾选「纳入问答」时使用全部已入库全文；引文会逐条与原文核对，核对失败的会被剔除。'),
        answer ? h('div', { className: 'rd-card', key: 'a' }, [
          h('div', { className: 'rd-body', key: 'x' }, answer.text),
          answer.citations.length ? h('div', { key: 'c' }, [
            h('div', { className: 'rd-meta', key: 'h' }, '已核验引文 ' + answer.citations.length + ' 条'),
            ...answer.citations.map((cite, index) => h('div', { className: 'rd-cite', key: 'c' + index }, [
              h('code', { key: 'i' }, cite.chunkId),
              h('div', { key: 'q' }, '「' + cite.quote + '」'),
            ])),
          ]) : null,
          answer.unverified.length ? h('div', { className: 'rd-note', key: 'u', style: { color: 'var(--rd-warn)' } }, '剔除未通过核验的引文 ' + answer.unverified.length + ' 条。') : null,
        ]) : h('div', { className: 'rd-empty' }, '还没有问答记录。'),
      ])

      const renderHypothesis = () => {
        const rows = library.hypotheses || []
        return h('div', null, [
          h('div', { className: 'rd-row', key: 'b' }, [
            h('button', { key: 'g', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: doHypothesis }, busy === 'hypothesis' ? '生成中…' : '从文献库生成选题'),
          ]),
          rows.length ? rows.map(row => h('div', { className: 'rd-hyp', key: row.id }, [
            h('div', { key: 't', style: { fontWeight: '600' } }, row.title),
            h('div', { className: 'rd-meta', key: 's' }, chip(row.status, row.status === 'supported' ? 'ok' : row.status === 'rejected' ? 'err' : '')),
            row.rationale ? h('div', { className: 'rd-meta', key: 'r' }, row.rationale) : null,
            row.gap ? h('div', { className: 'rd-meta', key: 'g' }, '缺口：' + row.gap) : null,
            row.experiment ? h('div', { className: 'rd-meta', key: 'e' }, '实验：' + row.experiment) : null,
          ])) : h('div', { className: 'rd-empty' }, '还没有选题。'),
        ])
      }

      const renderDraft = () => {
        const rows = library.drafts || []
        return h('div', null, [
          h('div', { className: 'rd-row', key: 'i' }, [
            h('input', {
              key: 'x', className: 'rd-input', value: instruction,
              placeholder: '草稿要求，例如：写一段引言，聚焦方法学空白',
              onChange: event => setInstruction(event.target.value),
            }),
            h('button', { key: 'b', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: doDraft }, busy === 'draft' ? '生成中…' : '生成草稿'),
          ]),
          rows.length ? rows.map(row => h('div', { className: 'rd-card', key: row.id }, [
            h('h4', { key: 't' }, row.title),
            h('div', { className: 'rd-meta', key: 'm' }, (row.refs || []).length + ' 条引用 · ' + String(row.at || '').slice(0, 10)),
            h('button', {
              key: 'x', className: 'rd-btn rd-btn--sm', style: { marginTop: '6px' },
              onClick: () => setOpenDraft(openDraft === row.id ? '' : row.id),
            }, openDraft === row.id ? '收起' : '展开'),
            openDraft === row.id ? h('div', { className: 'rd-body', key: 'b' }, row.body) : null,
          ])) : h('div', { className: 'rd-empty' }, '还没有草稿。'),
        ])
      }

      const renderReview = () => {
        const rows = library.reviews || []
        const shown = reviewOut ? reviewOut : (rows.length ? rows[0] : null)
        return h('div', null, [
          h('div', { className: 'rd-row', key: 't' }, [
            h('input', {
              key: 'i', className: 'rd-input', value: reviewTopic,
              placeholder: '综述主题，留空则只按视角检索词检索',
              onChange: event => setReviewTopic(event.target.value),
            }),
            h('button', { key: 'g', className: 'rd-btn', disabled: busy !== '', onClick: doGaps }, busy === 'gaps' ? '找缺口中' : '只找研究缺口'),
            h('button', { key: 'r', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: doReview }, busy === 'review' ? '写作中' : '生成综述'),
          ]),
          h('div', { className: 'rd-row', key: 'p' }, Object.keys(perspectives).map(key => h('label', {
            key, className: 'rd-meta', style: { marginRight: '10px', cursor: 'pointer' },
          }, [
            h('input', {
              key: 'c', type: 'checkbox', checked: perspectives[key],
              onChange: event => setPerspectives(prev => ({ ...prev, [key]: event.target.checked })),
            }),
            ' ' + key,
          ]))),
          h('div', { className: 'rd-note', key: 'h' }, '每个视角只看到检索到的段落；模型给出的引文会逐字回原文核对，对不上的会被剔除。'),
          shown && Array.isArray(shown.sections) ? shown.sections.map((section, index) => h('div', { className: 'rd-card', key: 's' + index }, [
            h('h4', { key: 't' }, section.label || section.key),
            h('div', { className: 'rd-body', key: 'x' }, section.text),
            Array.isArray(section.citations) && section.citations.length ? h('div', { key: 'c' }, [
              h('div', { className: 'rd-meta', key: 'h' }, '已核验引文 ' + section.citations.length + ' 条'),
              ...section.citations.map((cite, citeIndex) => h('div', { className: 'rd-cite', key: 'c' + citeIndex }, [
                h('code', { key: 'i' }, cite.chunkId),
                h('div', { key: 'q' }, '「' + cite.quote + '」'),
              ])),
            ]) : null,
            Array.isArray(section.unverified) && section.unverified.length
              ? h('div', { className: 'rd-note', key: 'u' }, '剔除未通过核验的引文 ' + section.unverified.length + ' 条。')
              : null,
          ])) : h('div', { className: 'rd-empty' }, '还没有综述。先给文献抓全文，再来写。'),
          rows.length > 1 ? h('div', { className: 'rd-note', key: 'n' }, '库里共有 ' + rows.length + ' 篇综述，当前显示最新一篇。') : null,
        ])
      }
      const renderExperiment = () => {
        const rows = library.experiments || []
        return h('div', null, [
          h('div', { className: 'rd-row', key: 't' }, [
            h('input', {
              key: 'i', className: 'rd-input', value: expTitle,
              placeholder: '这次运行的名称',
              onChange: event => setExpTitle(event.target.value),
            }),
            h('select', {
              key: 'r', className: 'rd-input', style: { flex: '0 0 90px' }, value: expRuntime,
              onChange: event => setExpRuntime(event.target.value),
            }, [
              h('option', { key: 'p', value: 'python' }, 'Python'),
              h('option', { key: 'n', value: 'node' }, 'Node'),
            ]),
          ]),
          h('textarea', {
            key: 'c', className: 'rd-area', value: expCode,
            placeholder: 'print("hello") 或 console.log("hello")',
            onChange: event => setExpCode(event.target.value),
          }),
          h('div', { className: 'rd-row', key: 'b' }, [
            h('button', { key: 'g', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: doRun }, busy === 'run' ? '运行中' : '运行'),
            h('span', { key: 'n', className: 'rd-note' }, '需要先在设置里打开「允许调用外部工具」。代码只落在插件数据目录下的 runs 文件夹。'),
          ]),
          expOut ? h('div', { className: 'rd-card', key: 'o' }, [
            h('h4', { key: 't' }, expOut.title),
            h('div', { className: 'rd-meta', key: 'm' }, [
              chip(expOut.status, expOut.status === 'done' ? 'ok' : 'err'),
              chip(expOut.runtime || '?'),
              chip((expOut.durationMs || 0) + 'ms'),
              expOut.exitCode !== null && expOut.exitCode !== undefined ? chip('exit=' + expOut.exitCode) : null,
              expOut.timedOut ? chip('超时', 'warn') : null,
            ]),
            expOut.stdout ? h('div', { className: 'rd-body', key: 'so' }, expOut.stdout) : null,
            expOut.stderr ? h('div', { className: 'rd-body', key: 'se' }, expOut.stderr) : null,
          ]) : null,
          rows.length ? h('div', { key: 'l' }, [
            h('div', { className: 'rd-meta', key: 'h' }, '实验记录 ' + rows.length + ' 条'),
            ...rows.slice(0, 10).map(row => h('div', { className: 'rd-meta', key: row.id, style: { padding: '4px 0' } }, [
              chip(row.status, row.status === 'done' ? 'ok' : row.status === 'failed' ? 'err' : ''),
              row.title, ' · ', String(row.at || '').slice(0, 16),
            ])),
          ]) : null,
        ])
      }

      const renderExport = () => h('div', null, [
        h('div', { className: 'rd-row', key: 'b' }, [
          h('button', { key: 'g', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: doExport }, busy === 'export' ? '生成中' : '生成导出文件'),
          h('span', { key: 'n', className: 'rd-note' }, '导出的是当前文献库、选题、综述、草稿与实验记录；密钥只导出「是否已配置」。'),
        ]),
        exportFiles.length ? exportFiles.map(file => h('div', { className: 'rd-card', key: file.format }, [
          h('h4', { key: 't' }, file.filename),
          h('div', { className: 'rd-meta', key: 'm' }, file.mime + ' · ' + file.content.length + ' 字符'),
          h('button', {
            key: 'd', className: 'rd-btn rd-btn--sm', style: { marginTop: '6px' },
            onClick: function () { downloadText(file.filename, file.mime, file.content) },
          }, '下载'),
        ])) : h('div', { className: 'rd-empty' }, '还没有生成导出文件。'),
      ])
      const renderSettings = () => {
        const rows = settingRows
        if (!rows.length) return h('div', { className: 'rd-empty' }, '设置还没加载出来。')
        return h('div', null, [
          h('div', { className: 'rd-row', key: 'b' }, [
            h('button', { key: 's', className: 'rd-btn rd-btn--primary', disabled: busy !== '', onClick: saveSettings }, busy === 'settings' ? '保存中' : '保存设置'),
            h('button', { key: 'r', className: 'rd-btn', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
          ]),
          ...rows.map(row => {
            const value = settingDraft[row.key]
            const setValue = function (next) { setSettingDraft(prev => ({ ...prev, [row.key]: next })) }
            let input = null
            if (row.type === 'bool') {
              input = h('label', { key: 'i', className: 'rd-meta', style: { cursor: 'pointer' } }, [
                h('input', { key: 'c', type: 'checkbox', checked: !!value, onChange: event => setValue(event.target.checked) }),
                ' 开启',
              ])
            } else if (row.type === 'enum') {
              input = h('select', {
                key: 'i', className: 'rd-input', value: value === undefined ? '' : value,
                onChange: event => setValue(event.target.value),
              }, (row.options || []).map(option => h('option', { key: option, value: option }, option)))
            } else if (row.type === 'enumList') {
              input = h('div', { key: 'i', className: 'rd-row' }, (row.options || []).map(option => {
                const list = Array.isArray(value) ? value : []
                return h('label', { key: option, className: 'rd-meta', style: { marginRight: '10px', cursor: 'pointer' } }, [
                  h('input', {
                    key: 'c', type: 'checkbox', checked: list.includes(option),
                    onChange: function (event) {
                      const next = event.target.checked ? list.concat([option]) : list.filter(item => item !== option)
                      setValue(next)
                    },
                  }),
                  ' ' + option,
                ])
              }))
            } else if (row.type === 'int' || row.type === 'float') {
              input = h('input', {
                key: 'i', className: 'rd-input', type: 'number', value: value === undefined || value === null ? '' : value,
                onChange: event => setValue(event.target.value),
              })
            } else {
              input = h('input', {
                key: 'i', className: 'rd-input', value: value === undefined ? '' : value,
                placeholder: row.secret ? '环境变量名，例如 OPENALEX_API_KEY' : '',
                onChange: event => setValue(event.target.value),
              })
            }
            return h('div', { className: 'rd-card', key: row.key }, [
              h('div', { key: 'l', style: { fontWeight: '600', fontSize: '12px' } }, row.label),
              h('div', { key: 'k', className: 'rd-note' }, row.key),
              h('div', { key: 'w', style: { marginTop: '6px' } }, input),
              row.help ? h('div', { key: 'h', className: 'rd-note', style: { marginTop: '4px' } }, row.help) : null,
              row.secret ? h('div', { key: 's', className: 'rd-note' }, row.present ? '该环境变量已设置，插件会读取它的值。' : '只保存环境变量名，插件不保存密钥本身。') : null,
            ])
          }),
        ])
      }
      const bodies = {
        search: renderSearch,
        library: renderLibrary,
        ask: renderAsk,
        hypothesis: renderHypothesis,
        review: renderReview,
        experiment: renderExperiment,
        draft: renderDraft,
        export: renderExport,
        settings: renderSettings,
      }

      return h('div', { className: 'rd-root' }, [
        h('div', { className: 'rd-head', key: 'h' }, [
          h('div', { key: 't' }, [
            h('div', { className: 'rd-title' }, '科研工作台'),
            h('div', { className: 'rd-sub' }, (library.papers || []).length + ' 篇文献 · ' + (library.hypotheses || []).length + ' 条选题 · ' + (library.drafts || []).length + ' 篇草稿'),
          ]),
        ]),
        h('div', { className: 'rd-tabs', key: 'tabs' }, tabs.map(item => h('button', {
          key: item[0], className: 'rd-tab', 'data-on': tab === item[0] ? '1' : '0',
          onClick: () => setTab(item[0]),
        }, item[1]))),
        msg ? h('div', { className: 'rd-msg' + (msg.error ? ' rd-msg--err' : ''), key: 'm' }, msg.text) : null,
        h('div', { key: 'body' }, bodies[tab] ? bodies[tab]() : null),
      ])
    }

    function mount(ctx) {
      try {
        injectStyles()
        const register = function (slot, options, component, label) {
          return ctx.slots.inject(slot, function* () {
            try {
              yield ctx.slots.register(options, component)
            } catch (err) {
              console.error(NS + ': failed to register ' + label, err)
            }
          })
        }
        register('sidebar.panellist',
          { name: 'sidebar.panellist', id: PANEL_ID, order: 58, label: function () { return '科研工作台' } },
          function (props) { return h(PanelIcon, { size: props && props.size, active: props && props.active }) },
          'sidebar entry')
        register('main', { name: 'main', key: PANEL_ID }, function () { return h(Desk, {}) }, 'main page')
      } catch (err) {
        try { if (typeof console !== 'undefined') console.warn('[' + NS + '] apply failed', err) } catch (ignored) {}
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          mount(ctx)
        } catch (err) {
          try { if (typeof console !== 'undefined') console.warn('[' + NS + '] apply failed', err) } catch (ignored) {}
        }
      },
    }
  },
})
