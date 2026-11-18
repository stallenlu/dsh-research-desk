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

    const CSS = "/* research-desk = media-desk platform shell, research scene. Tokens mirror dsh-media-desk. */\nbody, .rd-root {\n  --ink: var(--dsw-alias-label-primary, #0f1115);\n  --ink2: var(--dsw-alias-label-secondary, #61666b);\n  --ink3: var(--dsw-alias-label-tertiary, #8b9096);\n  --ink4: var(--dsw-alias-label-caption, #adb2b8);\n  --on-primary: var(--dsw-alias-label-primary-inverted, #ffffff);\n  --primary: var(--dsw-alias-button-primary-fill, var(--ink));\n  --primary-hover: var(--dsw-alias-button-primary-hover, var(--ink2));\n  --line: var(--dsw-alias-border-l2, rgba(0,0,0,0.10));\n  --line-strong: var(--dsw-alias-border-l4, rgba(0,0,0,0.18));\n  --hover: var(--dsw-alias-interactive-bg-hover, rgba(38,49,72,0.06));\n  --active: var(--dsw-alias-interactive-bg-active, rgba(38,49,72,0.10));\n  --bg: var(--dsw-alias-bg-base, #ffffff);\n  --card: var(--dsw-alias-bg-layer-2, #fafafa);\n  --accent: var(--dsw-alias-link, #3b82f6);\n  --glass: color-mix(in srgb, var(--card) 72%, transparent);\n  --r-sm: var(--dsw-radius-sm, 8px);\n  --r-md: var(--dsw-radius-md, 12px);\n  --r-lg: var(--dsw-radius-lg, 16px);\n  --r-xl: var(--dsw-radius-xl, 20px);\n  --r-panel: var(--dsw-radius-panel, 28px);\n  --dock-w: 336px;\n  --ease: cubic-bezier(.2, .8, .2, 1);\n  --shadow: var(--dsw-elevation-soft, 0 2px 10px rgba(0,0,0,0.06));\n  --shadow-hi: var(--dsw-elevation-prominent, 0 12px 28px -10px rgba(0,0,0,0.22));\n  --font: var(--dsw-font-family, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif);\n  --mono: var(--ds-font-family-code, ui-monospace, Menlo, monospace);\n  --serif: Georgia, 'Songti SC', 'Noto Serif SC', serif;\n  --rd-surface: var(--card);\n  --rd-surface-2: var(--hover);\n  --rd-surface-3: var(--active);\n  --rd-line: var(--line);\n  --rd-text: var(--ink);\n  --rd-text-2: var(--ink2);\n  --rd-text-3: var(--ink3);\n  --rd-hover: var(--hover);\n  --rd-inv-bg: var(--primary);\n  --rd-inv-fg: var(--on-primary);\n  --rd-accent: var(--accent);\n  --rd-warn: #d39a2c;\n  --rd-error: #d13c35;\n  --rd-ok: #2fa36c;\n  --rd-radius: var(--r-lg);\n  --rd-radius-sm: var(--r-md);\n  --rd-font: var(--font);\n  --rd-mono: var(--mono);\n}\nbody[data-ds-dark-theme] .rd-root { color-scheme: dark; }\n.rd-root *, .rd-root *::before, .rd-root *::after { box-sizing: border-box; }\n:where(.rd-root) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }\n:where(.rd-root) button:disabled { cursor: default; }\n:where(.rd-root) :is(h1,h2,h3,h4,p,dl,dd,ul,ol,blockquote) { margin: 0; padding: 0; }\n:where(.rd-root) :is(ul,ol) { list-style: none; }\n.rd-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n:where(.rd-root) :is(input,textarea,select) { font: inherit; color: inherit; }\nbody[data-ds-dark-theme] .rd-root :is(option,optgroup) { background-color: var(--card); color: var(--ink); }\n.rd-root { position: relative; display: flex; height: 100%; min-height: 0; width: 100%; overflow: clip; background: var(--bg); color: var(--ink); font-family: var(--font); font-size: 14px; line-height: 22px; -webkit-font-smoothing: antialiased; }\n/* ambient */\n.rd-ambient { position: absolute; inset: 0; overflow: clip; pointer-events: none; }\n.rd-ambient i { position: absolute; width: 56vmax; height: 56vmax; border-radius: 50%; corner-shape: round; filter: blur(70px); opacity: .5; animation: rd-drift 42s ease-in-out infinite alternate; }\n.rd-ambient i:nth-child(1) { left: -18vmax; top: -24vmax; background: radial-gradient(circle, color-mix(in srgb, #d9e4ff 42%, var(--bg)), transparent 68%); }\n.rd-ambient i:nth-child(2) { right: -14vmax; top: -8vmax; background: radial-gradient(circle, color-mix(in srgb, #f6e2ef 42%, var(--bg)), transparent 68%); animation-delay: -14s; }\n.rd-ambient i:nth-child(3) { left: 22vmax; bottom: -34vmax; background: radial-gradient(circle, color-mix(in srgb, #e2f3e0 42%, var(--bg)), transparent 68%); animation-delay: -28s; }\n@keyframes rd-drift { to { transform: translate3d(6vmax,4vmax,0) scale(1.12); } }\n/* main + topbar nav */\n.rd-main { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }\n.rd-topbar { position: absolute; z-index: 30; left: 0; right: var(--dock-w); top: 0; display: flex; align-items: center; gap: 8px; padding: 14px 18px; pointer-events: none; }\n.rd-topbar > * { pointer-events: auto; }\n.rd-nav { display: flex; gap: 2px; padding: 4px; border-radius: var(--r-lg); background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--shadow); overflow: auto; }\n.rd-nav button { height: 32px; padding: 0 13px; border-radius: var(--r-md); color: var(--ink2); font-size: 13px; line-height: 32px; white-space: nowrap; transition: background .18s var(--ease), color .18s var(--ease); }\n.rd-nav button:hover { background: var(--hover); color: var(--ink); }\n.rd-nav button.is-on { background: var(--primary); color: var(--on-primary); }\n.rd-top-title { font-family: var(--serif); font-size: 13px; color: var(--ink3); margin-left: 6px; white-space: nowrap; }\n/* stage / world / nodes */\n.rd-stage { position: absolute; inset: 0; overflow: clip; touch-action: none; cursor: grab; user-select: none; background-image: radial-gradient(circle, color-mix(in srgb, var(--ink) 11%, transparent) 1px, transparent 1.2px); background-size: var(--grid-size, 28px) var(--grid-size, 28px); background-position: var(--grid-x, 0) var(--grid-y, 0); }\n.rd-stage.is-panning { cursor: grabbing; }\n.rd-world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; will-change: transform; }\n.rd-node { position: absolute; z-index: 1; transform: translate(-50%,-50%) translate(calc(var(--px, 0px) * var(--d, 1)), calc(var(--py, 0px) * var(--d, 1))); transition: opacity .45s var(--ease); }\n.rd-node:hover, .rd-node:focus-within { z-index: 6; }\n/* buttons / chips / cards */\n.rd-root .rd-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: var(--r-md); border: .5px solid var(--line-strong); background: var(--card); font-size: 13px; line-height: 20px; white-space: nowrap; transition: background .15s, transform .25s var(--ease); }\n.rd-root .rd-btn:hover { background: var(--hover); }\n.rd-root .rd-btn:active { transform: scale(.97); }\n.rd-root .rd-btn:disabled { opacity: .5; }\n.rd-root .rd-btn.is-primary, .rd-btn--primary { background: var(--primary); color: var(--on-primary); border-color: transparent; }\n.rd-root .rd-btn.is-primary:hover, .rd-btn--primary:hover { background: var(--primary-hover); }\n.rd-btn--sm { height: 28px; padding: 0 10px; border-radius: var(--r-sm); font-size: 12px; }\n.rd-chip, .rd-root .rd-chip { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border-radius: 999px; corner-shape: round; border: .5px solid var(--line); background: var(--glass); color: var(--ink2); font-size: 12px; white-space: nowrap; }\n.rd-root .rd-card { position: relative; border-radius: var(--r-lg); border: .5px solid var(--line); background: var(--card); box-shadow: var(--shadow); padding: 12px; transition: transform .5s var(--ease), box-shadow .3s var(--ease); }\n.rd-node .rd-card { transform: rotate(var(--r, 0deg)); }\n.rd-node .rd-card:hover { transform: rotate(var(--r, 0deg)) translateY(-2px); box-shadow: var(--shadow-hi); }\n.rd-card h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }\n/* legacy utility classes still used by assistant result rendering */\n.rd-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n.rd-input, .rd-area { width: 100%; border: .5px solid var(--line-strong); border-radius: var(--r-sm); background: var(--bg); color: var(--ink); padding: 7px 10px; outline: none; }\n.rd-input:focus, .rd-area:focus { border-color: var(--accent); }\n.rd-area { resize: vertical; font: inherit; line-height: 20px; }\n.rd-meta { color: var(--ink3); font-size: 11px; line-height: 17px; }\n.rd-note { color: var(--ink3); font-size: 12px; }\n.rd-empty { padding: 18px; text-align: center; color: var(--ink3); font-size: 13px; border: .5px dashed var(--line); border-radius: var(--r-md); }\n.rd-msg { margin-top: 8px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--hover); font-size: 12px; }\n.rd-msg--err { color: var(--rd-error); background: color-mix(in srgb, var(--rd-error) 8%, transparent); }\n.rd-cite { margin: 6px 0; padding: 6px 8px; border-left: 2px solid var(--accent); background: var(--hover); border-radius: 0 var(--r-sm) var(--r-sm) 0; font-size: 12px; }\n.rd-body { white-space: pre-wrap; font-size: 13px; line-height: 21px; }\n.rd-hyp, .rd-note { font-size: 12px; }\n.rd-tag { display: inline-flex; padding: 1px 8px; border-radius: 999px; corner-shape: round; background: var(--active); color: var(--ink2); font-size: 11px; margin-right: 4px; }\n.rd-chip--ok { color: var(--rd-ok); border-color: color-mix(in srgb, var(--rd-ok) 40%, transparent); }\n.rd-chip--warn { color: var(--rd-warn); border-color: color-mix(in srgb, var(--rd-warn) 40%, transparent); }\n.rd-chip--err { color: var(--rd-error); border-color: color-mix(in srgb, var(--rd-error) 40%, transparent); }\n/* hero */\n.rd-hero { position: absolute; left: 32px; top: 84px; z-index: 2; max-width: 560px; pointer-events: none; }\n.rd-hero h1 { font-family: var(--serif); font-size: 30px; line-height: 1.35; font-weight: 600; letter-spacing: -.01em; }\n.rd-hero p { font-family: var(--serif); color: var(--ink2); font-size: 15px; margin-top: 8px; }\n.rd-hero .rd-stat { display: inline-flex; margin-top: 10px; gap: 14px; font-size: 12px; color: var(--ink3); }\n/* bottom tray */\n.rd-tray { position: absolute; z-index: 20; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; width: min(680px, calc(100% - 36px)); padding: 8px; border-radius: var(--r-panel); background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--shadow-hi); }\n.rd-tray-row { display: flex; align-items: center; gap: 8px; }\n.rd-tray .rd-seg { display: inline-flex; gap: 0; padding: 4px; border-radius: var(--r-md); background: var(--hover); }\n.rd-tray .rd-seg button { height: 26px; padding: 0 10px; border-radius: var(--r-sm); color: var(--ink3); font-size: 12px; }\n.rd-tray .rd-seg button.is-on { background: var(--card); color: var(--ink); box-shadow: var(--shadow); }\n.rd-tray .rd-search { flex: 1; height: 32px; border: .5px solid var(--line); border-radius: var(--r-md); background: var(--card); color: var(--ink); padding: 0 12px; outline: none; }\n.rd-tray .rd-search:focus { border-color: var(--accent); }\n.rd-round { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; corner-shape: round; flex: none; }\n.rd-round.is-primary { background: var(--primary); color: var(--on-primary); transition: transform .3s var(--ease); }\n.rd-round.is-primary:hover { transform: rotate(90deg); }\n/* right assistant dock */\n.rd-dock { position: relative; z-index: 10; width: var(--dock-w); flex: none; display: flex; flex-direction: column; min-height: 0; border-left: .5px solid var(--line); background: color-mix(in srgb, var(--card) 82%, transparent); backdrop-filter: blur(24px) saturate(140%); }\n.rd-dock-head { display: flex; align-items: center; gap: 8px; padding: 14px 14px 8px; }\n.rd-dock-head strong { font-size: 13px; font-weight: 600; }\n.rd-dock-head .rd-meta { margin-left: auto; }\n.rd-dock-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 14px 8px; }\n.rd-model-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; corner-shape: round; background: var(--active); color: var(--ink2); font-size: 11px; }\n.rd-suggest { display: block; width: 100%; text-align: left; padding: 9px 11px; border-radius: var(--r-md); border: .5px solid var(--line); background: var(--card); font-size: 13px; margin: 7px 0; transition: background .15s, transform .25s var(--ease); }\n.rd-suggest:hover { background: var(--hover); transform: translateY(-1px); }\n.rd-msgline { max-width: 92%; padding: 8px 11px; border-radius: var(--r-md); font-size: 13px; line-height: 20px; margin: 8px 0; white-space: pre-wrap; }\n.rd-msgline.me { margin-left: auto; background: var(--primary); color: var(--on-primary); border-bottom-right-radius: 4px; }\n.rd-msgline.ai { background: var(--card); border: .5px solid var(--line); border-bottom-left-radius: 4px; }\n.rd-dock-foot { border-top: .5px solid var(--line); padding: 10px 12px; background: var(--glass); }\n.rd-compose { display: flex; align-items: flex-end; gap: 8px; border-radius: var(--r-lg); border: .5px solid var(--line-strong); background: var(--card); padding: 7px 8px 7px 12px; }\n.rd-compose textarea { flex: 1; min-height: 22px; max-height: 120px; resize: none; border: 0; outline: none; background: transparent; color: var(--ink); font: inherit; line-height: 22px; }\n.rd-send { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; corner-shape: round; background: var(--primary); color: var(--on-primary); flex: none; }\n.rd-send:disabled { opacity: .28; }\n.rd-send:not(:disabled):hover { transform: translateY(-1px); }\n/* focus/kanban/list views */\n.rd-view { position: absolute; inset: 64px 0 92px 0; overflow-y: auto; padding: 8px 24px 24px; }\n.rd-view-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 12px; }\n.rd-columns { display: flex; gap: 14px; align-items: flex-start; min-height: 100%; }\n.rd-col { flex: 1; min-width: 190px; border-radius: var(--r-lg); background: color-mix(in srgb, var(--card) 70%, transparent); border: .5px solid var(--line); padding: 10px; }\n.rd-col h3 { font-size: 12px; color: var(--ink3); margin-bottom: 8px; }\n.rd-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }\n.rd-table { width: 100%; border-collapse: collapse; font-size: 13px; }\n.rd-table th, .rd-table td { text-align: left; padding: 7px 10px; border-bottom: .5px solid var(--line); }\n.rd-table th { color: var(--ink3); font-weight: 500; font-size: 12px; }\n@media (max-width: 760px) { .rd-hero h1 { font-size: 22px; } }\n.rd-root--narrow { flex-direction: column; }\n.rd-root--narrow .rd-main { flex: 1 1 auto; }\n.rd-root--narrow .rd-dock { width: 100%; height: 42%; flex: none; border-left: 0; border-top: .5px solid var(--line); }\n.rd-root--narrow .rd-topbar { right: 0; padding: 10px 12px; }\n.rd-root--narrow .rd-nav button { padding: 0 9px; font-size: 12px; }\n.rd-root--narrow .rd-top-title { display: none; }\n.rd-root--narrow .rd-hero { left: 14px; right: 14px; top: 52px; }\n.rd-root--narrow .rd-hero h1 { font-size: 14px; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.rd-root--narrow .rd-hero p, .rd-root--narrow .rd-hero .rd-stat { display: none; }\n.rd-root--narrow .rd-tray { width: calc(100% - 20px); bottom: 10px; }\n.rd-root--narrow .rd-dock-head { padding: 8px 12px 4px; }\n.rd-root--narrow .rd-dock-scroll { padding: 2px 12px 6px; }\n.rd-root--narrow .rd-dock-foot { padding: 8px 10px; }\\n/* top-right utility actions */\n.rd-top-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; pointer-events: auto; }\n.rd-root .rd-round { border: .5px solid var(--line-strong); background: var(--card); font-size: 15px; line-height: 1; }\n.rd-root .rd-round:hover { background: var(--hover); }\nbutton.rd-model-pill { border: .5px solid var(--line); cursor: pointer; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\nselect.rd-model-pill { border: .5px solid var(--line); cursor: pointer; max-width: 190px; }\n.rd-model-pill option { background: var(--card); color: var(--ink); }\n/* settings popover */\n.rd-settings-pop { position: absolute; z-index: 50; top: 56px; right: 14px; width: min(560px, calc(100% - 28px)); max-height: calc(100% - 72px); display: flex; flex-direction: column; border-radius: var(--r-lg); border: .5px solid var(--line-strong); background: var(--card); box-shadow: var(--shadow-hi); }\n.rd-settings-pop-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: .5px solid var(--line); }\n.rd-settings-pop-head strong { font-family: var(--serif); font-size: 16px; }\n.rd-settings-pop-head button { margin-left: auto; }\n.rd-settings-pop-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 10px; }\n.rd-settings-pop-foot { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 14px; border-top: .5px solid var(--line); }\n.rd-root--narrow .rd-settings-pop { top: 50px; right: 8px; width: calc(100% - 16px); max-height: calc(100% - 60px); }\n.rd-root--narrow .rd-top-actions { gap: 4px; }\n.rd-root--narrow .rd-top-actions .rd-btn { padding: 0 7px; font-size: 11px; }\n\n"

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
      const [view, setView] = useState('library')
      const [trayMode, setTrayMode] = useState('scatter')
      const [query, setQuery] = useState('')
      const [library, setLibrary] = useState({ papers: [], hypotheses: [], drafts: [], reviews: [], chat: [] })
      const [models, setModels] = useState([])
      const [msgs, setMsgs] = useState([])
      const [input, setInput] = useState('')
      const [busy, setBusy] = useState('')
      const [msg, setMsg] = useState(null)
      const [selected, setSelected] = useState(null)
      const [positions, setPositions] = useState({})
      const [pan, setPan] = useState({ x: 0, y: 0 })
      const [settingRows, setSettingRows] = useState([])
      const [settingDraft, setSettingDraft] = useState({})
      const [searchResults, setSearchResults] = useState([])
      const [showSettings, setShowSettings] = useState(false)
      const [model, setModel] = useState('')

      const applyLibrary = useCallback(data => { if (data && data.library) setLibrary(data.library) }, [])
      const refresh = useCallback(async () => {
        try { applyLibrary(await call({ action: 'library' })) }
        catch (err) { setMsg({ text: String(err.message || err), error: true }) }
      }, [applyLibrary])
      useEffect(() => { injectStyles(); refresh() }, [refresh])
      useEffect(() => {
        let alive = true
        call({ action: 'models' }).then(d => { if (alive && d && Array.isArray(d.models)) setModels(d.models) }).catch(() => {})
        call({ action: 'settings' }).then(d => {
          if (!alive || !d) return
          if (Array.isArray(d.rows)) {
            setSettingRows(d.rows)
            const draft = {}; for (const row of d.rows) draft[row.key] = row.value
            setSettingDraft(draft)
          }
          if (d.settings && d.settings['model.route']) setModel(d.settings['model.route'])
        }).catch(() => {})
        return () => { alive = false }
      }, [])

      const notify = (text, error) => setMsg(text ? { text, error: !!error } : null)
      const papers = library.papers || []
      const fullCount = papers.filter(p => p.chunks > 0).length
      const toRead = papers.filter(p => !(p.chunks > 0)).length
      const sourceOf = p => {
        const s = String(p.source || p.url || p.id || '')
        if (s.includes('arxiv')) return 'arXiv'
        if (s.includes('europepmc') || s.includes('pmc')) return 'Europe PMC'
        if (s.includes('openalex')) return 'OpenAlex'
        return '文献'
      }
      const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s }
      const modelRouteOf = m => (m && m.provider ? m.provider + '/' + m.model : (m && m.model ? m.model : ''))

      const doSearch = useCallback(async () => {
        const q = query.trim()
        if (!q || busy) return
        setBusy('search'); notify(null)
        try {
          const d = await call({ action: 'search', query: q, sources: ['arxiv', 'europepmc', 'openalex'], maxResults: 12 })
          const list = Array.isArray(d.papers) ? d.papers : []
          setSearchResults(list)
          setView('discover')
          if (!list.length) notify('没有检索到文献，换个主题试试。', true)
        } catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [query, busy])
      const addPapers = useCallback(async list => {
        if (!list.length || busy) return
        setBusy('add')
        try { applyLibrary(await call({ action: 'add', papers: list })); notify('已加入文献库 ' + list.length + ' 篇。') }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [busy, applyLibrary])
      const readPaper = useCallback(async id => {
        setBusy('read')
        try { applyLibrary(await call({ action: 'read', paperId: id })) }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [applyLibrary])
      const removePaper = useCallback(async id => {
        setBusy('remove')
        try { applyLibrary(await call({ action: 'remove', paperId: id })); setSelected(null) }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [applyLibrary])
      const doClear = useCallback(async () => {
        if (busy) return
        if (typeof window !== 'undefined' && window.confirm && !window.confirm('确定清空文献库和全部笔记？这一步可以用「撤销」恢复。')) return
        setBusy('clear')
        try { const d = await call({ action: 'clear' }); applyLibrary(d); setSelected(null); setPositions({}); notify(d.message || '已清空。') }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [busy, applyLibrary])
      const doExport = useCallback(async () => {
        setBusy('export')
        try {
          const d = await call({ action: 'export', formats: ['md', 'bib', 'json'] })
          const files = (d && d.files) || []
          for (const f of files) downloadText(f.filename, f.mime, f.content)
          notify('已生成 ' + files.length + ' 个导出文件。')
        } catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [])
      const doUndo = useCallback(async () => {
        setBusy('undo')
        try { const d = await call({ action: 'undo' }); notify(d.message || '已撤销。'); refresh() }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [refresh])

      const setModelRoute = useCallback(async value => {
        setModel(value)
        const next = Object.assign({}, settingDraft, { 'model.route': value })
        setSettingDraft(next)
        try { await call({ action: 'settings', patch: { 'model.route': value } }); notify('模型已切换。') }
        catch (err) { notify(String(err.message || err), true) }
      }, [settingDraft])

      const send = useCallback(async (text) => {
        const q = String(text || '').trim()
        if (!q || busy) return
        setInput('')
        setMsgs(prev => [...prev, { role: 'me', text: q }])
        setBusy('assistant'); notify(null)
        try {
          let d, answer
          if (/综述|review|进展|梳理/.test(q)) {
            d = await call({ action: 'review', topic: q, perspectives: ['methodology', 'evidence', 'contradictions', 'gaps'] })
            const secs = (d.review && d.review.sections) || []
            answer = secs.length ? secs.map(s => '【' + (s.label || s.key) + '】\n' + (s.text || '')).join('\n\n') : (d.message || '（无内容）')
          } else if (/缺口|gap|未解决|不足/.test(q)) {
            d = await call({ action: 'gaps', topic: q })
            answer = (d.gaps && d.gaps.text) || d.message || '（无内容）'
          } else if (/选题|假设|hypothesis|方向/.test(q)) {
            d = await call({ action: 'hypothesis' })
            const rows = (d.library && d.library.hypotheses) || []
            applyLibrary(d)
            answer = rows.length ? rows.map(r => '• ' + (r.title || '') + (r.gap ? '\n  缺口：' + r.gap : '')).join('\n') : '没有推出选题。'
          } else {
            if (!fullCount) { answer = '文献库里还没有全文。先在「发现」里检索并加入文献，点卡片抓取全文，再问我。' }
            else { d = await call({ action: 'ask', question: q }); answer = (d.message || '（无内容）') + ((d.citations || []).length ? '\n\n已核验引文 ' + d.citations.length + ' 条。' : '') }
          }
          setMsgs(prev => [...prev, { role: 'ai', text: answer || '（无内容）' }])
        } catch (err) { setMsgs(prev => [...prev, { role: 'ai', text: '出错：' + String(err.message || err) }]) }
        finally { setBusy('') }
      }, [busy, fullCount, applyLibrary])

      const saveSettings = useCallback(async () => {
        const patch = {}
        for (const row of settingRows) {
          const v = settingDraft[row.key]
          if (v === undefined) continue
          if ((row.type === 'int' || row.type === 'float') && String(v).trim() === '') continue
          patch[row.key] = v
        }
        setBusy('settings')
        try { await call({ action: 'settings', patch }); notify('设置已保存。') }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [settingRows, settingDraft])
      const resetSettings = useCallback(async () => {
        setBusy('settings')
        try { await call({ action: 'settings', reset: true }); notify('已恢复默认设置。'); window.location.reload() }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [])

      // ---- piece renderers ----
      const rootRef = useRef(null)
      const [narrow, setNarrow] = useState(false)
      useEffect(() => {
        const el = rootRef.current
        if (!el || typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(entries => {
          const w = (entries[0] && entries[0].contentRect && entries[0].contentRect.width) || 0
          setNarrow(w < 760)
        })
        ro.observe(el)
        return () => ro.disconnect()
      }, [])
      const NAV = [['library', '文献'], ['notes', '笔记'], ['plan', '计划'], ['discover', '发现'], ['style', '文风']]
      const modelLabel = (models.find(m => modelRouteOf(m) === model) && (models.find(m => modelRouteOf(m) === model).label || model)) || model || (models[0] && (models[0].label || modelRouteOf(models[0]))) || '选择模型'
      const topbar = h('div', { className: 'rd-topbar', key: 'top' }, [
        h('nav', { className: 'rd-nav', key: 'nav' }, NAV.map(([k, label]) => h('button', {
          key: k, className: view === k ? 'is-on' : '', onClick: () => setView(k),
        }, label))),
        h('div', { className: 'rd-top-actions', key: 'ta' }, [
          h('button', { className: 'rd-btn rd-btn--sm', key: 'seed', title: '示例：检索并加入一批文献', disabled: busy !== '', onClick: () => { setQuery('graph neural network'); setTimeout(doSearch, 0) } }, '示例数据'),
          h('button', { className: 'rd-btn rd-btn--sm', key: 'clear', title: '清空文献库与笔记（可撤销）', disabled: busy !== '' || !papers.length, onClick: doClear }, '清空'),
          h('button', { className: 'rd-round', key: 'set', title: '设置', onClick: () => setShowSettings(s => !s) }, '⚙'),
        ]),
      ])

      const hero = h('div', { className: 'rd-hero', key: 'hero' }, [
        h('h1', { key: 'h' }, '还有 ' + toRead + ' 篇文献待精读，' + papers.length + ' 篇在库，' + (library.hypotheses || []).length + ' 条选题待验证'),
        h('p', { key: 'p' }, '从检索、精读到写作核验，都在这里。先记一条线索，或让助手帮你梳理。'),
        h('div', { className: 'rd-stat', key: 's' }, [fullCount + ' 篇有全文', papers.length + ' 篇文献', (library.hypotheses || []).length + ' 条选题'].map(t => h('span', { key: t }, t))),
      ])

      const paperCard = (p, i) => {
        const key = p.id || String(i)
        const pos = positions[key] || (narrow
          ? { px: 110 + (i % 2) * 175, py: 300 + Math.floor(i / 2) * 120, r: ((i * 37) % 9) - 4, d: 0.72 }
          : { px: 150 + (i % 4) * 230, py: 320 + Math.floor(i / 4) * 150, r: ((i * 37) % 11) - 5, d: 1 })
        const style = { '--px': pos.px + 'px', '--py': pos.py + 'px', '--r': pos.r + 'deg', '--d': pos.d }
        const stageSize = 28
        const nodePointerDown = e => {
          if (e.button !== 0) return
          e.stopPropagation()
          const startX = e.clientX, startY = e.clientY
          const el = e.currentTarget
          const moved = { v: false }
          const move = ev => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY
            if (!moved.v && Math.abs(dx) + Math.abs(dy) < 4) return
            moved.v = true
            const base = positions[key] || pos
            const nd = base.d || 1
            setPositions(prev => Object.assign({}, prev, { [key]: Object.assign({}, base, { px: base.px + dx / nd, py: base.py + dy / nd }) }))
          }
          const up = () => {
            el.removeEventListener('pointermove', move)
            el.removeEventListener('pointerup', up)
            el.removeEventListener('pointercancel', up)
            if (!moved.v) setSelected(p)
          }
          try { el.setPointerCapture && el.setPointerCapture(e.pointerId) } catch (err) {}
          el.addEventListener('pointermove', move)
          el.addEventListener('pointerup', up)
          el.addEventListener('pointercancel', up)
        }
        return h('div', { className: 'rd-node', key, style }, [
          h('div', { className: 'rd-card', style: { width: narrow ? 150 : 210, minHeight: 118, cursor: 'grab', touchAction: 'none' }, onPointerDown: nodePointerDown }, [
            h('div', { key: 'src' }, [h('span', { className: 'rd-tag', key: 'b' }, sourceOf(p)), h('span', { className: 'rd-meta', key: 'y' }, ' ' + (p.year || ''))]),
            h('h4', { key: 't' }, short(p.title, 70)),
            h('div', { className: 'rd-meta', key: 'v' }, short(p.venue || p.abstract || '暂无摘要', 90)),
            h('div', { key: 'st', style: { marginTop: 8 } }, [
              h('span', { className: 'rd-chip ' + (p.chunks > 0 ? 'rd-chip--ok' : 'rd-chip--warn'), key: 'c' }, p.chunks > 0 ? p.chunks + ' 段全文' : '仅摘要'),
            ]),
          ]),
        ])
      }
      const stagePointerDown = e => {
        if (e.button !== 0 || e.target.closest('.rd-node')) return
        const el = e.currentTarget
        const startX = e.clientX, startY = e.clientY, base = pan
        el.classList.add('is-panning')
        const move = ev => setPan({ x: base.x + ev.clientX - startX, y: base.y + ev.clientY - startY })
        const up = () => {
          el.classList.remove('is-panning')
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerup', up)
          el.removeEventListener('pointercancel', up)
        }
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId) } catch (err) {}
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerup', up)
        el.addEventListener('pointercancel', up)
      }
      const scatter = h('div', {
        className: 'rd-stage', key: 'stage', onPointerDown: stagePointerDown,
        style: { '--grid-size': (28 * (narrow ? 0.72 : 1)) + 'px', '--grid-x': pan.x + 'px', '--grid-y': pan.y + 'px' },
      }, [
        h('div', { className: 'rd-world', key: 'world', style: { transform: 'translate(' + pan.x + 'px,' + pan.y + 'px)' } }, papers.slice(0, narrow ? 6 : 16).map(paperCard)),
      ])

      const tray = h('div', { className: 'rd-tray', key: 'tray' }, [
        h('div', { className: 'rd-tray-row', key: 'seg' }, [
          h('div', { className: 'rd-seg', key: 's' }, [['scatter', '散落'], ['stream', '信息流']].map(([k, l]) => h('button', {
            key: k, className: trayMode === k ? 'is-on' : '', onClick: () => setTrayMode(k),
          }, l))),
          h('input', { className: 'rd-search', key: 'q', value: query, placeholder: '搜索标题、主题、标签…', onChange: e => setQuery(e.target.value), onKeyDown: e => { if (e.key === 'Enter') doSearch() } }),
          h('button', { className: 'rd-btn is-primary', key: 'go', disabled: busy !== '' || !query.trim(), onClick: doSearch }, '搜'),
          h('button', { className: 'rd-round is-primary', key: 'add', title: '记一条线索（检索并入库）', disabled: busy !== '' || !query.trim(), onClick: doSearch }, '+'),
        ]),
        h('div', { className: 'rd-tray-row', key: 'h' }, [
          h('span', { className: 'rd-meta', key: 'm' }, '拖动卡片整理思路 · 拖动画布平移 · Ctrl/⌘+Enter 发给助手'),
        ]),
      ])

      const renderLibraryView = () => h('div', { className: 'rd-main', key: 'v' }, [
        hero, scatter, tray,
        selected ? h('div', { className: 'rd-view', style: { inset: 'auto 24px 108px auto', width: 320, maxHeight: '50%', overflowY: 'auto', zIndex: 9 }, key: 'detail' }, [
          h('div', { className: 'rd-card', key: 'c' }, [
            h('h4', { key: 't' }, selected.title),
            h('div', { className: 'rd-meta', key: 'm' }, (selected.venue || '') + ' ' + (selected.year || '')),
            h('div', { className: 'rd-body', key: 'a' }, short(selected.abstract, 500)),
            h('div', { className: 'rd-row', key: 'ac', style: { marginTop: 10 } }, [
              h('button', { className: 'rd-btn rd-btn--sm', key: 'r', disabled: busy !== '', onClick: () => readPaper(selected.id) }, '抓取全文'),
              h('button', { className: 'rd-btn rd-btn--sm', key: 'd', disabled: busy !== '', onClick: () => removePaper(selected.id) }, '移出'),
              h('button', { className: 'rd-btn rd-btn--sm', key: 'x', onClick: () => setSelected(null) }, '关闭'),
            ]),
          ]),
        ]) : null,
      ])

      const renderNotesView = () => {
        const notes = [
          ...(library.hypotheses || []).map(x => ({ kind: '选题', title: x.title, body: x.rationale || x.gap || '' })),
          ...(library.reviews || []).map(x => ({ kind: '综述', title: x.topic || '综述', body: '' })),
          ...(library.drafts || []).map(x => ({ kind: '草稿', title: x.title || '草稿', body: short(x.text, 200) })),
        ]
        return h('div', { className: 'rd-view', key: 'v' }, [
          h('div', { className: 'rd-toolbar', key: 'tb' }, [h('h2', { key: 'h', style: { fontFamily: 'var(--serif)', fontSize: 22 } }, '笔记 · 选题 / 综述 / 草稿')]),
          notes.length ? h('div', { className: 'rd-view-grid', key: 'g' }, notes.map((n, i) => h('div', { className: 'rd-card', key: i }, [
            h('span', { className: 'rd-tag', key: 'k' }, n.kind),
            h('h4', { key: 't', style: { marginTop: 8 } }, n.title),
            n.body ? h('div', { className: 'rd-body', key: 'b' }, n.body) : null,
          ]))) : h('div', { className: 'rd-empty', key: 'e' }, '还没有笔记。让助手提选题或写综述，成果会落在这里。'),
        ])
      }

      const renderPlanView = () => {
        const cols = [['待读', papers.filter(p => !(p.chunks > 0))], ['已读全文', papers.filter(p => p.chunks > 0)], ['已放弃', papers.filter(p => p.status === 'dropped')]]
        return h('div', { className: 'rd-view', key: 'v' }, [
          h('div', { className: 'rd-toolbar', key: 'tb' }, [h('h2', { key: 'h', style: { fontFamily: 'var(--serif)', fontSize: 22 } }, '计划 · 阅读看板')]),
          h('div', { className: 'rd-columns', key: 'cols' }, cols.map(([label, list], ci) => h('div', { className: 'rd-col', key: ci }, [
            h('h3', { key: 'h' }, label + ' (' + list.length + ')'),
            list.map(p => h('div', { className: 'rd-card', key: p.id, style: { marginBottom: 8, padding: 9, cursor: 'pointer' }, onClick: () => setSelected(p) }, [
              h('div', { key: 't', style: { fontSize: 12, fontWeight: 600 } }, short(p.title, 60)),
              h('span', { className: 'rd-tag', key: 'b' }, sourceOf(p)),
            ])),
          ]))),
        ])
      }

      const renderDiscoverView = () => h('div', { className: 'rd-view', key: 'v' }, [
        h('div', { className: 'rd-toolbar', key: 'tb' }, [
          h('h2', { key: 'h', style: { fontFamily: 'var(--serif)', fontSize: 22 } }, '发现 · 检索'),
          h('input', { className: 'rd-search', key: 'q', value: query, placeholder: '输入主题，检索 arXiv / Europe PMC / OpenAlex', onChange: e => setQuery(e.target.value), onKeyDown: e => { if (e.key === 'Enter') doSearch() } }),
          h('button', { className: 'rd-btn is-primary', key: 'go', disabled: busy !== '' || !query.trim(), onClick: doSearch }, busy === 'search' ? '检索中…' : '检索'),
        ]),
        searchResults.length ? h('div', { className: 'rd-view-grid', key: 'g' }, searchResults.map((p, i) => h('div', { className: 'rd-card', key: i }, [
          h('span', { className: 'rd-tag', key: 'b' }, sourceOf(p)),
          h('h4', { key: 't', style: { marginTop: 8 } }, short(p.title, 80)),
          h('div', { className: 'rd-meta', key: 'm' }, short(p.abstract, 120)),
          h('button', { className: 'rd-btn rd-btn--sm is-primary', key: 'a', style: { marginTop: 8 }, disabled: busy !== '', onClick: () => addPapers([p]) }, '+ 加入文献库'),
        ]))) : h('div', { className: 'rd-empty', key: 'e' }, '输入主题开始检索。检索结果可逐条加入文献库。'),
      ])

      const renderSettingCard = row => {
        const v = settingDraft[row.key]; const set = next => setSettingDraft(prev => ({ ...prev, [row.key]: next }))
        let input
        if (row.type === 'bool') input = h('label', { key: 'i', className: 'rd-meta' }, [h('input', { type: 'checkbox', checked: !!v, onChange: e => set(e.target.checked) }), ' 开启'])
        else if (row.type === 'enum') input = h('select', { className: 'rd-input', key: 'i', value: v == null ? '' : v, onChange: e => set(e.target.value) }, (row.options || []).map(o => h('option', { key: o, value: o }, o)))
        else if (row.type === 'enumList') input = h('div', { className: 'rd-row', key: 'i' }, (row.options || []).map(o => { const l = Array.isArray(v) ? v : []; return h('label', { key: o, className: 'rd-meta', style: { marginRight: 10 } }, [h('input', { type: 'checkbox', checked: l.includes(o), onChange: e => set(e.target.checked ? l.concat([o]) : l.filter(x => x !== o)) }), ' ' + o]) }))
        else input = h('input', { className: 'rd-input', key: 'i', type: row.type === 'int' || row.type === 'float' ? 'number' : 'text', value: v == null ? '' : v, placeholder: row.secret ? '环境变量名' : '', onChange: e => set(e.target.value) })
        return h('div', { className: 'rd-card', key: row.key }, [h('div', { style: { fontWeight: 600, fontSize: 12 }, key: 'l' }, row.label), h('div', { style: { marginTop: 6 }, key: 'w' }, input)])
      }

      const renderStyleView = () => h('div', { className: 'rd-view', key: 'v' }, [
        h('div', { className: 'rd-toolbar', key: 'tb' }, [
          h('h2', { key: 'h', style: { fontFamily: 'var(--serif)', fontSize: 22 } }, '文风 · 写作与模型设置'),
          h('button', { className: 'rd-btn rd-btn--sm', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
          h('button', { className: 'rd-btn rd-btn--sm', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
          h('button', { className: 'rd-btn rd-btn--sm', key: 'e', disabled: busy !== '', onClick: doExport }, '导出全部'),
        ]),
        h('div', { className: 'rd-view-grid', key: 'g' }, settingRows.map(renderSettingCard)),
      ])

      const settingsPopover = showSettings ? h('div', { className: 'rd-settings-pop', key: 'sp' }, [
        h('div', { className: 'rd-settings-pop-head', key: 'h' }, [
          h('strong', { key: 't' }, '设置'),
          h('button', { className: 'rd-btn rd-btn--sm', key: 'x', onClick: () => setShowSettings(false) }, '关闭'),
        ]),
        h('div', { className: 'rd-settings-pop-body', key: 'b' }, settingRows.map(renderSettingCard)),
        h('div', { className: 'rd-settings-pop-foot', key: 'f' }, [
          h('button', { className: 'rd-btn rd-btn--sm is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
          h('button', { className: 'rd-btn rd-btn--sm', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
        ]),
      ]) : null

      const views = { library: renderLibraryView, notes: renderNotesView, plan: renderPlanView, discover: renderDiscoverView, style: renderStyleView }

      const suggestions = [
        '梳理这个主题的综述', '找出还没解决的问题', '给我几个可做的选题',
      ]
      const dock = h('aside', { className: 'rd-dock', key: 'dock' }, [
        h('div', { className: 'rd-dock-head', key: 'h' }, [
          h('strong', { key: 't' }, '助手'),
          h('select', { className: 'rd-model-pill', key: 'm', value: model, title: '切换模型', onChange: e => setModelRoute(e.target.value) },
            (models.length ? models : [{ provider: '', model: model || '', label: model || '选择模型' }]).map((m, i) => {
              const val = modelRouteOf(m); return h('option', { key: i, value: val }, m.label || val || '默认')
            })),
          h('button', { className: 'rd-btn rd-btn--sm', key: 'u', title: '撤销上一步', disabled: busy !== '', onClick: doUndo }, '撤销'),
        ]),
        h('div', { className: 'rd-dock-scroll', key: 's' }, [
          h('div', { key: 'intro', style: { padding: '4px 0 10px' } }, [
            h('div', { key: 'a', style: { fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.4 } }, '说一个研究问题，剩下的我来补全。'),
            h('div', { className: 'rd-meta', key: 'b', style: { marginTop: 6 } }, '选题、检索、精读、写作标准，都可以直接说。每一步都能撤销。'),
          ]),
          ...suggestions.map((s, i) => h('button', { className: 'rd-suggest', key: 'sg' + i, disabled: busy !== '', onClick: () => send(s) }, s)),
          h('div', { key: 'thread' }, msgs.map((m, i) => h('div', { className: 'rd-msgline ' + (m.role === 'me' ? 'me' : 'ai'), key: 'm' + i }, m.text))),
          busy === 'assistant' ? h('div', { className: 'rd-msgline ai', key: 'busy' }, '处理中…') : null,
        ]),
        h('div', { className: 'rd-dock-foot', key: 'f' }, [
          h('div', { className: 'rd-compose', key: 'c' }, [
            h('textarea', { key: 'ta', value: input, placeholder: '想改什么，直接说', onChange: e => setInput(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } } }),
            h('button', { className: 'rd-send', key: 'send', disabled: busy !== '' || !input.trim(), onClick: () => send(input) }, '➤'),
          ]),
        ]),
      ])

      return h('div', { className: 'rd-root' + (narrow ? ' rd-root--narrow' : ''), ref: rootRef }, [
        h('div', { className: 'rd-ambient', key: 'amb' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 })]),
        topbar,
        (views[view] || renderLibraryView)(),
        dock,
        settingsPopover,
        msg ? h('div', { className: 'rd-msg' + (msg.error ? ' rd-msg--err' : ''), key: 'm', style: { position: 'absolute', zIndex: 40, left: '50%', bottom: 120, transform: 'translateX(-50%)', maxWidth: 460 } }, msg.text) : null,
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