// dsh-research-desk — sidebar panel, v1: faithful media-desk platform shell.
// The UI layer is a 1:1 transplant of dsh-media-desk's design system (all CSS
// selectors, DOM structure and icons). Only the data and labels are research.
// Every call goes to the same-origin bridge POST /api/research-desk/ so the panel
// and the agent tool share one state file.
window.__ModuleLoader__.load({
  id: 'dsh-research-desk',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const NS = 'dsh-research-desk'
    const PANEL_ID = 'dsh-research-desk'
    const ROUTE = 'api/research-desk/'

    function hostRouteUrl(path) {
      const base = typeof document !== 'undefined' && typeof document.baseURI === 'string' ? document.baseURI : ''
      const url = new URL(base === '' ? 'http://dsh.internal/' : base, 'http://dsh.internal/')
      url.search = ''
      url.hash = ''
      if (!url.pathname.endsWith('/')) url.pathname += '/'
      return new URL(String(path).replace(/^\/+/, ''), url.href)
    }

    const CSS = "/* 所有颜色走 DSH 语义 token，明暗主题由宿主负责。圆角遵循 DSH 统一圆角规范。 */\n.md-root {\n  --ink: var(--dsw-alias-label-primary);\n  --ink2: var(--dsw-alias-label-secondary);\n  --ink3: var(--dsw-alias-label-tertiary);\n  --ink4: var(--dsw-alias-label-caption);\n  --on-primary: var(--dsw-alias-label-primary-inverted);\n  --primary: var(--dsw-alias-button-primary-fill);\n  --primary-hover: var(--dsw-alias-button-primary-hover);\n  --line: var(--dsw-alias-border-l2);\n  --line-strong: var(--dsw-alias-border-l4);\n  --hover: var(--dsw-alias-interactive-bg-hover);\n  --active: var(--dsw-alias-interactive-bg-active);\n  --bg: var(--dsw-alias-bg-base);\n  --card: var(--dsw-alias-bg-layer-2);\n  --accent: var(--dsw-alias-link);\n  --glass: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 72%, transparent);\n  --serif: \"Songti SC\", \"STSong\", \"Noto Serif SC\", \"Source Han Serif SC\", Georgia, serif;\n  --latin-serif: \"Iowan Old Style\", \"Palatino\", Georgia, \"Songti SC\", serif;\n  --ease: cubic-bezier(.2, .8, .2, 1);\n  --r-xs: var(--dsw-radius-xs, 4px);\n  --r-sm: var(--dsw-radius-sm, 8px);\n  --r-md: var(--dsw-radius-md, 12px);\n  --r-lg: var(--dsw-radius-lg, 16px);\n  --r-xl: var(--dsw-radius-xl, 20px);\n  --r-panel: var(--dsw-radius-panel, 28px);\n  --dock-w: 336px;\n  position: relative;\n  display: flex;\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  overflow: clip;\n  background: var(--bg);\n  color: var(--ink);\n  font-family: var(--dsw-font-family);\n  font-size: 14px;\n  line-height: 22px;\n  -webkit-font-smoothing: antialiased;\n}\n.md-root *, .md-root *::before, .md-root *::after { box-sizing: border-box; }\n:where(.md-root) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }\n:where(.md-root) button:disabled { cursor: default; }\n:where(.md-root) :is(h1, h2, h3, p, dl, dd, ul, ol, blockquote) { margin: 0; padding: 0; }\n:where(.md-root) :is(ul, ol) { list-style: none; }\n.md-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n:where(.md-root) :is(input, textarea, select) { font: inherit; color: inherit; }\n/* 下拉框弹出的选项列表由系统绘制，不认页面颜色：跟着 DSH 的深色主题切换配色方案，再给选项本身上色兜底 */\nbody[data-ds-dark-theme] .md-root { color-scheme: dark; }\n.md-root :is(option, optgroup) { background-color: var(--card); color: var(--ink); }\n.md-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }\n.md-muted { color: var(--ink3); }\n.md-nowrap { white-space: nowrap; }\n\n/* 背景氛围：很淡的彩色光斑，缓慢漂移 */\n.md-ambient { position: absolute; inset: 0; overflow: clip; pointer-events: none; }\n.md-ambient i { position: absolute; width: 56vmax; height: 56vmax; border-radius: 50%; corner-shape: round; filter: blur(70px); opacity: .5; animation: md-drift 42s ease-in-out infinite alternate; }\n.md-ambient i:nth-child(1) { left: -18vmax; top: -24vmax; background: radial-gradient(circle, color-mix(in srgb, #d9e4ff 42%, var(--bg)), transparent 68%); }\n.md-ambient i:nth-child(2) { right: -14vmax; top: -8vmax; background: radial-gradient(circle, color-mix(in srgb, #f6e2ef 42%, var(--bg)), transparent 68%); animation-delay: -14s; }\n.md-ambient i:nth-child(3) { left: 22vmax; bottom: -34vmax; background: radial-gradient(circle, color-mix(in srgb, #e2f3e0 42%, var(--bg)), transparent 68%); animation-delay: -28s; }\n@keyframes md-drift { to { transform: translate3d(6vmax, 4vmax, 0) scale(1.12); } }\n\n.md-main { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }\n.md-topbar {\n  position: absolute; z-index: 30; left: 0; right: 0; top: 0;\n  display: flex; align-items: center; gap: 8px;\n  padding: 14px 18px 14px max(18px, var(--dsh-frame-leading-clearance, 0px));\n  pointer-events: none;\n}\n.md-topbar > * { pointer-events: auto; }\n.md-nav { display: flex; gap: 2px; padding: 4px; border-radius: var(--r-lg); background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--dsw-elevation-soft); }\n.md-nav button { height: 32px; padding: 0 13px; border-radius: var(--r-md); color: var(--ink2); font-size: 13px; line-height: 32px; transition: background .18s var(--ease), color .18s var(--ease); white-space: nowrap; }\n.md-nav button:hover { background: var(--hover); color: var(--ink); }\n.md-nav button.is-on { background: var(--primary); color: var(--on-primary); }\n.md-sample { height: 28px; padding: 0 11px; border-radius: var(--r-sm); color: var(--ink3); font-size: 12px; line-height: 28px; background: var(--glass); backdrop-filter: blur(24px); box-shadow: var(--dsw-elevation-soft); white-space: nowrap; }\n.md-sample:hover { color: var(--ink); }\n.md-open-dock { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border-radius: var(--r-md); background: var(--glass); backdrop-filter: blur(24px); box-shadow: var(--dsw-elevation-soft); white-space: nowrap; font-size: 13px; }\n.md-open-dock:hover { background: var(--card); }\n\n.md-content { flex: 1; min-height: 0; position: relative; animation: md-rise .45s var(--ease) both; }\n@keyframes md-rise { from { opacity: 0; transform: translateY(8px); } }\n.md-loading { height: 100%; display: flex; align-items: center; justify-content: center; color: var(--ink3); }\n.md-shimmer { background: linear-gradient(100deg, var(--ink3) 30%, var(--ink) 50%, var(--ink3) 70%); background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: md-shimmer 1.6s linear infinite; }\n@keyframes md-shimmer { to { background-position: -220% 0; } }\n\n/* 按钮与基础控件 */\n.md-icon-btn { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; border-radius: var(--r-md); color: var(--ink2); transition: background .15s, color .15s; }\n.md-icon-btn:hover { background: var(--hover); color: var(--ink); }\n.md-icon-btn.is-active { background: var(--active); color: var(--ink); }\n.md-topbar .md-icon-btn { background: var(--glass); backdrop-filter: blur(24px); box-shadow: var(--dsw-elevation-soft); width: 36px; height: 36px; }\n.md-root .md-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: var(--r-md); border: .5px solid var(--line-strong); background: var(--card); font-size: 13px; line-height: 20px; white-space: nowrap; transition: background .15s, transform .25s var(--ease), border-color .15s; }\n.md-root .md-btn:hover { background: var(--hover); }\n.md-root .md-btn:active { transform: scale(.97); }\n.md-root .md-btn:disabled { opacity: .5; }\n.md-root .md-btn.is-primary { background: var(--primary); color: var(--on-primary); border-color: transparent; }\n.md-root .md-btn.is-primary:hover { background: var(--primary-hover); }\n.md-root .md-btn.is-small { height: 28px; padding: 0 10px; border-radius: var(--r-sm); font-size: 12px; }\n.md-root .md-btn.is-wide { width: 100%; }\n.md-root .md-btn.is-danger { color: #d13c35; border-color: color-mix(in srgb, #d13c35 40%, transparent); }\n.md-root .md-btn.is-open { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent); }\n.md-root .md-btn.is-busy { opacity: .7; }\n.md-round { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; corner-shape: round; flex: none; }\n.md-root .md-round.is-primary { background: var(--primary); color: var(--on-primary); transition: transform .3s var(--ease), background .15s; }\n.md-root .md-round.is-primary:hover { background: var(--primary-hover); transform: rotate(90deg); }\n.md-send { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; corner-shape: round; flex: none; }\n.md-root .md-send { background: var(--primary); color: var(--on-primary); transition: opacity .15s, transform .2s var(--ease); }\n.md-root .md-send:disabled { opacity: .28; }\n.md-root .md-send:not(:disabled):hover { transform: translateY(-1px); }\n.md-seg { display: inline-flex; gap: 0; padding: 4px; border-radius: var(--r-md); background: var(--hover); flex: none; }\n.md-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 28px; min-width: 32px; padding: 0 10px; border-radius: var(--r-sm); color: var(--ink3); font-size: 12px; transition: background .2s var(--ease), color .2s; white-space: nowrap; }\n.md-seg button:hover { color: var(--ink); }\n.md-topbar .md-seg { background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--dsw-elevation-soft); }\n.md-seg button.is-on { background: var(--card); color: var(--ink); box-shadow: var(--dsw-elevation-soft); }\n\n/* 画布 */\n.md-home { position: absolute; inset: 0; }\n.md-stage {\n  position: absolute; inset: 0; overflow: clip; touch-action: none; cursor: grab; user-select: none;\n  background-image: radial-gradient(circle, color-mix(in srgb, var(--ink) 11%, transparent) 1px, transparent 1.2px);\n  background-size: var(--grid-size, 28px) var(--grid-size, 28px);\n  background-position: var(--grid-x, 0) var(--grid-y, 0);\n}\n.md-stage.is-panning { cursor: grabbing; }\n.md-world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; will-change: transform; }\n.md-links { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; }\n.md-links path { fill: none; stroke: var(--line-strong); stroke-width: 1.2; stroke-dasharray: 1; stroke-dashoffset: 1; animation: md-draw .9s var(--ease) .1s forwards; vector-effect: non-scaling-stroke; }\n.md-links path.is-active { stroke: var(--ink); stroke-width: 1.6; }\n@keyframes md-draw { to { stroke-dashoffset: 0; } }\n.md-link-label { position: absolute; transform: translate(-50%, -50%); padding: 1px 9px; border-radius: 999px; corner-shape: round; background: var(--card); box-shadow: var(--dsw-elevation-soft); color: var(--ink2); font-size: 11px; line-height: 19px; white-space: nowrap; pointer-events: none; animation: md-fade .5s .4s both; z-index: 2; }\n@keyframes md-fade { from { opacity: 0; } }\n\n.md-node {\n  position: absolute; z-index: 1;\n  transform: translate(-50%, -50%) translate(calc(var(--px, 0px) * var(--d, 0)), calc(var(--py, 0px) * var(--d, 0)));\n  transition: opacity .45s var(--ease), filter .45s var(--ease), left .6s var(--ease), top .6s var(--ease);\n}\n.md-node:hover, .md-node:focus-within { z-index: 6; }\n.md-node.is-selected { z-index: 8; }\n.md-node.is-dragging { z-index: 20; transition: none; }\n.md-node.is-dim { opacity: .13; filter: saturate(.4); }\n.md-node.is-dim:hover { opacity: .85; filter: none; }\n.md-pop { will-change: transform; }\n\n.md-node .md-card { transform: rotate(var(--r, 0deg)); transition: transform .5s cubic-bezier(.2, 1.3, .4, 1), box-shadow .3s var(--ease); }\n.md-node:hover .md-card { transform: rotate(0deg) translateY(-4px) scale(1.025); }\n.md-node.is-dragging .md-card { transform: rotate(calc(var(--r, 0deg) * .4)) scale(1.05); box-shadow: 0 0 0 .5px var(--line-strong), 0 24px 48px -12px rgb(0 0 0 / .32); cursor: grabbing; }\n.md-node.is-selected .md-card { transform: none; box-shadow: 0 0 0 1.5px var(--ink), 0 22px 54px -14px rgb(0 0 0 / .28); }\n\n.md-card {\n  position: relative; display: block; width: 100%; border-radius: var(--r-xl); background: var(--card);\n  box-shadow: var(--dsw-elevation-soft); overflow: hidden; cursor: pointer; user-select: none;\n}\n.md-card-media { position: relative; margin: 6px 6px 0; border-radius: 14px; overflow: hidden; background: var(--hover); line-height: 0; }\n.md-media { display: block; width: 100%; height: auto; object-fit: cover; }\n.md-media-fallback { display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; font-family: var(--serif); font-size: 48px; line-height: 1; color: var(--ink3); }\n.md-card-play { position: absolute; left: 8px; bottom: 8px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; corner-shape: round; background: rgb(0 0 0 / .45); backdrop-filter: blur(8px); color: #fff; }\n.md-card-caption { padding: 10px 14px 0; }\n.md-card h3 { font-size: 13px; line-height: 19px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.md-card-quote { padding: 22px 20px 8px; font-family: var(--serif); font-size: 20px; line-height: 30px; font-weight: 500; letter-spacing: .01em; }\n.md-card-note { padding: 16px 16px 2px; }\n.md-card-note h3 { font-size: 14px; line-height: 21px; font-weight: 600; -webkit-line-clamp: 3; }\n.md-card-note p { margin-top: 6px; color: var(--ink2); font-size: 12.5px; line-height: 20px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }\n.md-card-rel { display: inline-block; margin-bottom: 6px; padding: 0 8px; border-radius: 999px; corner-shape: round; background: var(--hover); color: var(--ink2); font-size: 11px; line-height: 19px; }\n.md-card-foot { display: flex; align-items: center; gap: 6px; padding: 8px 14px 12px; color: var(--ink3); font-size: 11.5px; line-height: 16px; min-height: 36px; }\n.md-card-source { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-card-count { display: inline-flex; align-items: center; gap: 2px; margin-left: 2px; }\n.md-card-time { margin-left: auto; white-space: nowrap; }\n.md-card-actions { position: absolute; right: 8px; top: 8px; display: flex; gap: 4px; opacity: 0; transform: translateY(-3px); transition: opacity .2s, transform .3s var(--ease); z-index: 2; }\n.md-card:hover .md-card-actions, .md-card:focus-within .md-card-actions { opacity: 1; transform: none; }\n.md-card-actions button { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; corner-shape: round; background: color-mix(in srgb, var(--card) 86%, transparent); backdrop-filter: blur(12px); box-shadow: var(--dsw-elevation-soft); transition: transform .25s var(--ease), background .15s; color: var(--ink); }\n.md-card-actions button:hover { transform: scale(1.1); background: var(--card); }\n.md-card-actions button.is-busy { animation: md-pulse 1s ease-in-out infinite; }\n@keyframes md-pulse { 50% { opacity: .45; } }\n.md-card.is-inverted { background: var(--primary); color: var(--on-primary); }\n.md-card.is-inverted .md-card-foot, .md-card.is-inverted .md-card-note p { color: color-mix(in srgb, var(--on-primary) 68%, transparent); }\n.md-card.is-published .md-card-media { filter: saturate(.92); }\n\n.md-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; corner-shape: round; background: var(--ink4); }\n.md-dot.status-outline { background: #d39a2c; }\n.md-dot.status-draft { background: #4176e6; }\n.md-dot.status-ready { background: #8a5fe0; }\n.md-dot.status-published { background: #2fa36c; }\n.md-status { display: inline-block; padding: 0 8px; border-radius: 999px; corner-shape: round; background: var(--hover); color: var(--ink2); font-size: 11.5px; line-height: 20px; white-space: nowrap; }\n.md-status.status-outline { background: color-mix(in srgb, #d39a2c 16%, transparent); }\n.md-status.status-draft { background: color-mix(in srgb, #4176e6 14%, transparent); }\n.md-status.status-ready { background: color-mix(in srgb, #8a5fe0 14%, transparent); }\n.md-status.status-published { background: color-mix(in srgb, #2fa36c 16%, transparent); }\n\n/* 首屏那句话 */\n.md-hero-anchor { position: absolute; left: 0; top: 0; width: 520px; transform: translate(-50%, -50%); }\n.md-hero { cursor: default; user-select: text; }\n.md-hero-date { color: var(--ink3); font-size: 13px; line-height: 20px; margin-bottom: 12px; }\n.md-root .md-hero-line { font-size: 33px; line-height: 46px; font-weight: 300; letter-spacing: -.015em; color: var(--ink3); }\n.md-hero-line b { font-weight: 400; color: var(--ink); }\n.md-hero-line br { display: block; }\n.md-inline-pic { display: inline-block; width: 36px; height: 36px; vertical-align: -7px; border-radius: 50%; corner-shape: round; object-fit: cover; box-shadow: var(--dsw-elevation-soft); margin: 0 2px; }\n.md-inline-pic.is-empty { background: var(--hover); }\n.md-hero-streak { font-family: var(--latin-serif); font-style: italic; }\n.md-hero-input { display: flex; align-items: center; gap: 10px; margin-top: 20px; max-width: 440px; height: 48px; padding: 0 10px 0 18px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); color: var(--ink3); transition: box-shadow .25s var(--ease), transform .3s var(--ease); }\n.md-hero-input:focus-within { box-shadow: 0 0 0 1px var(--ink), 0 16px 40px -14px rgb(0 0 0 / .22); transform: translateY(-1px); }\n.md-root .md-hero-input input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--ink); font-size: 15px; }\n.md-hero-meta { margin-top: 14px; text-align: center; color: var(--ink3); font-size: 12.5px; line-height: 18px; }\n.md-hero-meta b { font-family: var(--latin-serif); font-style: italic; font-weight: 400; font-size: 15px; color: var(--ink2); }\n.md-hero.is-compact { padding: 20px 0 8px; }\n.md-hero-input input::placeholder { color: var(--ink3); }\n\n.md-toolrow { position: absolute; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: var(--r-lg); background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--dsw-elevation-soft); z-index: 12; cursor: default; }\n.md-toolrow-right { right: 18px; bottom: 18px; }\n.md-root.has-dock .md-stage.is-focusing .md-toolrow-right { opacity: 0; pointer-events: none; }\n\n.md-dockbar { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 14; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 6px; border-radius: 24px; background: var(--glass); backdrop-filter: blur(28px) saturate(170%); box-shadow: var(--dsw-elevation-prominent); max-width: calc(100% - 24px); transition: opacity .25s var(--ease), transform .4s var(--ease); }\n.md-dockbar-sep { width: .5px; height: 22px; background: var(--line-strong); flex: none; }\n.md-chips { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }\n.md-chips button { height: 30px; padding: 0 11px; border-radius: var(--r-md); color: var(--ink3); font-size: 12.5px; white-space: nowrap; transition: background .15s, color .15s; }\n.md-chips button:hover { color: var(--ink); background: var(--hover); }\n.md-chips button.is-on { color: var(--ink); background: var(--active); }\n.md-stage.is-focusing ~ .md-dockbar { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(12px); }\n.md-root:has(.md-sheet) .md-dockbar { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(12px); }\n\n/* 迷你邮票条 */\n.md-ministamps { display: flex; align-items: center; gap: 8px; margin-top: 18px; }\n.md-ministamps-row { display: grid; grid-template-columns: repeat(10, 34px); gap: 4px; }\n.md-ministamps .md-stamp { --s: 5px; --hole: 1.2px; width: 34px; height: 43px; aspect-ratio: auto; }\n.md-ministamps-more { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; corner-shape: round; color: var(--ink3); transition: background .15s, color .15s; }\n.md-ministamps-more:hover { background: var(--hover); color: var(--ink); }\n\n/* 邮票：用遮罩打出齿孔 */\n.md-stamp {\n  --s: 9px; --hole: 2.4px;\n  position: relative; display: block; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; background: var(--card);\n  -webkit-mask: radial-gradient(circle var(--hole), transparent 97%, #000) calc(var(--s) / -2) calc(var(--s) / -2) / var(--s) var(--s), linear-gradient(#000 0 0) center / calc(100% - var(--s)) calc(100% - var(--s)) no-repeat;\n  mask: radial-gradient(circle var(--hole), transparent 97%, #000) calc(var(--s) / -2) calc(var(--s) / -2) / var(--s) var(--s), linear-gradient(#000 0 0) center / calc(100% - var(--s)) calc(100% - var(--s)) no-repeat;\n  transition: transform .35s cubic-bezier(.2, 1.4, .4, 1);\n  filter: drop-shadow(0 1px 1px rgb(0 0 0 / .1));\n}\nbutton.md-stamp:not(:disabled):hover { transform: scale(1.08) rotate(-2deg); }\n.md-stamp img { display: block; width: 100%; height: 100%; object-fit: cover; }\n.md-stamp i { position: absolute; right: 7px; top: 7px; min-width: 15px; padding: 0 4px; border-radius: 999px; corner-shape: round; background: rgb(0 0 0 / .62); color: #fff; font-style: normal; font-size: 10px; line-height: 15px; text-align: center; }\n.md-stamp.is-type { display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 22px; line-height: 1; color: rgb(0 0 0 / .7); }\n.md-ministamps .md-stamp.is-type { font-size: 13px; }\n.md-stamp.is-blank { background: var(--hover); color: var(--ink2); display: flex; align-items: center; justify-content: center; filter: none; }\n.md-stamp.is-today { background: var(--primary); color: var(--on-primary); animation: md-breathe 2.6s ease-in-out infinite; }\n@keyframes md-breathe { 50% { opacity: .68; } }\n.tone-0 { background-color: #f6e2d5; } .tone-1 { background-color: #dfe7fb; } .tone-2 { background-color: #dcf0df; } .tone-3 { background-color: #f6dfe9; } .tone-4 { background-color: #efe9cf; } .tone-5 { background-color: #e6dff7; }\n\n/* 瀑布流与列表 */\n.md-wall-scroll { position: absolute; inset: 0; overflow-y: auto; padding: 72px 20px 96px; }\n.md-wall { columns: 236px; column-gap: 16px; max-width: 1500px; margin: 0 auto; }\n.md-wall-cell { break-inside: avoid; margin-bottom: 16px; padding: 1px; animation: md-rise .6s var(--ease) both; }\n.md-wall-cell .md-card { transition: transform .4s cubic-bezier(.2, 1.3, .4, 1); }\n.md-wall-cell .md-card:hover { transform: translateY(-3px); }\n.md-rows { max-width: 1100px; margin: 0 auto; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); overflow: hidden; }\n.md-root .md-row { display: grid; grid-template-columns: minmax(0, 1fr) 120px 110px 84px 76px; gap: 12px; align-items: center; width: 100%; padding: 8px 16px; border-bottom: .5px solid var(--line); font-size: 13px; line-height: 20px; transition: background .12s; }\n.md-root .md-row:hover { background: var(--hover); }\n.md-root .md-row:last-child { border-bottom: 0; }\n.md-root .md-row.is-head { color: var(--ink3); font-size: 12px; padding: 10px 16px; }\n.md-root .md-row.is-head:hover { background: none; }\n.md-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-row-main { display: flex; align-items: center; gap: 12px; }\n.md-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-row-title em { margin-right: 6px; color: var(--ink3); font-style: normal; font-size: 12px; }\n.md-thumb { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--r-sm); overflow: hidden; background: var(--hover); font-family: var(--serif); color: var(--ink2); font-size: 14px; }\n.md-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.md-root.is-narrow .md-row { grid-template-columns: minmax(0, 1fr) 84px 76px; }\n.md-root.is-narrow .md-row > :nth-child(2), .md-root.is-narrow .md-row > :nth-child(3) { display: none; }\n\n/* 详情抽屉 */\n.md-people-chips { display: flex; flex-wrap: wrap; gap: 6px; }\n.md-people-chips button { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 9px 0 4px; border-radius: 999px; corner-shape: round; font-size: 12px; color: var(--ink3); box-shadow: inset 0 0 0 .5px var(--line-strong); transition: background .15s, color .15s; }\n.md-people-chips button.is-on { background: var(--active); color: var(--ink); box-shadow: inset 0 0 0 .5px var(--ink3); }\n.md-avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 50%; corner-shape: round; color: rgb(0 0 0 / .72); font-weight: 500; line-height: 1; }\n.md-avatars { display: inline-flex; }\n.md-avatars .md-avatar + .md-avatar { margin-left: -6px; box-shadow: 0 0 0 1.5px var(--card); }\n\n.md-prose { font-size: 14.5px; line-height: 26px; }\n.md-root .md-prose h1 { font-family: var(--serif); font-size: 24px; line-height: 34px; font-weight: 600; margin: 0 0 14px; }\n.md-root .md-prose h2 { font-size: 16.5px; line-height: 26px; font-weight: 600; margin: 22px 0 8px; }\n.md-root .md-prose h3, .md-root .md-prose h4 { font-size: 14.5px; line-height: 24px; font-weight: 600; margin: 16px 0 6px; }\n.md-root .md-prose p { margin: 0 0 12px; }\n.md-root .md-prose ul, .md-root .md-prose ol { margin: 0 0 12px; padding-left: 20px; }\n.md-root .md-prose ul { list-style: disc; }\n.md-root .md-prose ol { list-style: decimal; }\n.md-root .md-prose blockquote { margin: 0 0 14px; padding: 8px 14px; border-left: 2px solid var(--line-strong); color: var(--ink2); font-size: 13px; line-height: 22px; }\n.md-prose table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px; line-height: 20px; }\n.md-prose th, .md-prose td { padding: 6px 8px; border-bottom: .5px solid var(--line); text-align: left; vertical-align: top; }\n.md-prose th { color: var(--ink3); font-weight: 500; }\n.md-prose code { padding: 1px 4px; border-radius: var(--r-xs); background: var(--hover); font-size: 12.5px; }\n\n\n.md-feed-hero { max-width: 560px; margin: 8px auto 34px; }\n\n/* 灵感工作区：左边对话，右边稿面 */\n.md-studio { --canvas: color-mix(in srgb, var(--ink) 3.5%, var(--bg)); --chat-w: 320px; position: absolute; inset: 0; z-index: 31; display: flex; background: var(--canvas); will-change: clip-path; }\n.md-studio-chat { flex: none; width: var(--chat-w); min-height: 0; display: flex; animation: md-rise .5s var(--ease) both; }\n.md-chat { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }\n.md-studio .md-dock-head { min-height: 52px; padding: 10px 12px 4px max(10px, var(--dsh-frame-leading-clearance, 0px)); gap: 2px; }\n.md-studio .md-dock-scroll { padding: 6px 14px 12px; }\n.md-studio .md-composer { background: var(--card); }\n.md-chat-toggle { display: none; }\n\n/* 灵感卡 */\n.md-idea-card { flex: none; padding: 14px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); }\n.md-idea-label { display: block; color: var(--ink3); font-size: 11.5px; line-height: 16px; margin-bottom: 4px; }\n.md-root .md-idea-text { display: block; width: 100%; padding: 0; border: 0; outline: 0; background: none; resize: none; overflow: hidden; font-size: 14px; line-height: 22px; font-weight: 500; color: var(--ink); }\n.md-idea-body-wrap { display: flex; flex-direction: column; margin-top: 6px; }\n.md-idea-body-clip.is-clipped { max-height: 80px; overflow: hidden; -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent); }\n.md-root .md-idea-body { display: block; width: 100%; padding: 0; border: 0; outline: 0; background: none; resize: none; overflow: hidden; font-size: 13px; line-height: 20px; color: var(--ink2); white-space: pre-wrap; }\n.md-root .md-go { display: flex; align-items: center; justify-content: center; width: 100%; height: 40px; margin-top: 12px; border-radius: 999px; corner-shape: round; background: var(--primary); color: var(--on-primary); font-size: 14px; transition: transform .35s cubic-bezier(.2, 1.4, .4, 1), background .15s; }\n.md-root .md-go:hover { background: var(--primary-hover); transform: translateY(-1px); }\n.md-root .md-go:active { transform: scale(.98); }\n.md-go-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }\n.md-root .md-go-row .md-go { flex: 1; margin-top: 0; }\n.md-go-option { display: flex; align-items: center; gap: 5px; flex: none; color: var(--ink3); font-size: 12px; line-height: 18px; cursor: pointer; }\n.md-go-option input, .md-check input { margin: 0; accent-color: var(--primary); }\n.md-check { display: flex; align-items: center; gap: 8px; color: var(--ink); font-size: 13px; cursor: pointer; }\n.md-idea-hint { margin-top: 10px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-idea-hint button { margin-left: 4px; color: var(--accent); }\n.md-root .md-idea-hint.is-error { color: #d13c35; }\n.md-progress-card { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: .5px solid var(--line); }\n.md-progress-step { display: flex; align-items: center; gap: 8px; color: var(--ink4); font-size: 12.5px; line-height: 18px; font-variant-numeric: tabular-nums; transition: color .3s; }\n.md-progress-step i { flex: none; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; corner-shape: round; box-shadow: inset 0 0 0 1px var(--line-strong); transition: background .3s; }\n.md-progress-step.is-active { color: var(--ink2); }\n.md-progress-step.is-active i { box-shadow: inset 0 0 0 1.5px var(--ink2); animation: md-breathe 1.4s ease-in-out infinite; }\n.md-progress-step.is-done { color: var(--ink2); }\n.md-progress-step.is-done i { background: var(--primary); color: var(--on-primary); box-shadow: none; }\n.md-link-btn { align-self: flex-start; margin-top: 2px; color: var(--ink3); font-size: 12px; }\n.md-link-btn:hover { color: var(--ink); }\n.md-composer-ctx button { flex: none; margin-left: auto; color: var(--ink3); display: flex; }\n\n/* 稿面 */\n.md-sheet { position: relative; flex: 1; min-width: 0; min-height: 0; padding: 10px 10px 10px 0; container-type: size; overflow: hidden auto; }\n.md-bento { position: relative; height: 100%; display: grid; gap: 10px; grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); grid-template-areas: \"hero hero\" \"article shots\"; }\n.md-tile { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); transition: opacity .35s var(--ease), transform .45s cubic-bezier(.2, 1.2, .4, 1), filter .35s var(--ease); animation: md-rise .6s var(--ease) both; }\n.md-tile-article { grid-area: article; animation-delay: 70ms; }\n.md-tile-shots { grid-area: shots; animation-delay: 140ms; }\n.md-bento.has-open .md-tile:not(.is-open) { opacity: .25; transform: scale(.985); filter: saturate(.6); pointer-events: none; }\n.md-bento .md-tile.is-open { grid-area: auto; position: absolute; inset: 0; z-index: 6; box-shadow: var(--dsw-elevation-prominent); animation: none; }\n.md-tile-head { flex: none; display: flex; align-items: center; gap: 2px; height: 44px; padding: 0 8px 0 18px; }\n.md-root .md-tile-head h2 { font-size: 13px; line-height: 20px; font-weight: 600; }\n.md-tile-meta { margin-left: 8px; color: var(--ink3); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }\n.md-i-trend .md-tile-meta { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-grow { flex: 1; }\n.md-tile-head .md-icon-btn { width: 28px; height: 28px; border-radius: var(--r-sm); }\n.md-tile-foot { position: absolute; right: 14px; bottom: 10px; color: var(--ink3); font-size: 11.5px; font-variant-numeric: tabular-nums; }\n\n/* 主视觉：整块渐变底 */\n.md-tile-hero { grid-area: hero; flex-direction: row; align-items: stretch; gap: 20px; min-height: 216px; padding: 22px 24px; overflow: hidden; background:\n  radial-gradient(55% 120% at 82% 8%, color-mix(in srgb, #c9b6f2 40%, transparent), transparent 70%),\n  radial-gradient(45% 110% at 100% 92%, color-mix(in srgb, #f7b899 42%, transparent), transparent 72%),\n  radial-gradient(50% 130% at 48% 118%, color-mix(in srgb, #a9cdf5 34%, transparent), transparent 70%),\n  var(--card); }\n.md-tile-hero.is-running { background-size: 130% 130%; animation: md-rise .6s var(--ease) both, md-wash 7s ease-in-out infinite alternate; }\n@keyframes md-wash { from { background-position: 0% 0%; } to { background-position: 100% 60%; } }\n.md-hero-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; padding-top: 18px; }\n.md-root .md-hero-title { display: block; width: 100%; padding: 0; border: 0; outline: 0; background: none; resize: none; overflow: hidden; color: var(--ink); font-size: clamp(25px, 4.4cqw, 42px); line-height: 1.26; font-weight: 300; letter-spacing: -.015em; }\n.md-root .md-hero-title.is-idle { color: var(--ink2); }\n.md-hero-stats { display: flex; flex-wrap: wrap; gap: 4px 14px; min-height: 20px; margin-top: 12px; color: var(--ink2); font-size: 12.5px; line-height: 20px; }\n.md-hero-stat { display: inline-flex; align-items: center; gap: 4px; animation: md-fade .5s both; }\n.md-hero-stat svg { color: var(--ink3); }\n.md-hero-stat b { font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }\n.md-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; animation: md-rise .5s var(--ease) both; }\n.md-pill { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 999px; corner-shape: round; background: color-mix(in srgb, var(--card) 70%, transparent); box-shadow: inset 0 0 0 .5px var(--line-strong); color: var(--ink); font-size: 13px; white-space: nowrap; text-decoration: none; backdrop-filter: blur(12px); transition: background .15s, transform .25s var(--ease); }\n.md-root .md-pill:hover { background: var(--card); }\n.md-root .md-pill:active { transform: scale(.97); }\n.md-root .md-pill:disabled { opacity: .5; }\n.md-root .md-pill.is-primary { background: var(--primary); color: var(--on-primary); box-shadow: none; }\n.md-root .md-pill.is-primary:hover { background: var(--primary-hover); }\n.md-hero-corner { position: absolute; right: 10px; top: 8px; z-index: 3; display: flex; opacity: .55; transition: opacity .2s; }\n.md-tile-hero:hover .md-hero-corner, .md-hero-corner:focus-within { opacity: 1; }\n.md-hero-corner .md-icon-btn { width: 28px; height: 28px; border-radius: var(--r-sm); }\n\n/* 封面和配图的拼贴 */\n.md-collage { flex: none; position: relative; align-self: center; width: min(44%, 400px); aspect-ratio: 16 / 9.4; margin: 6px 4px 0 0; }\n.md-collage > div { position: absolute; padding: 4px; border-radius: 14px; background: var(--card); box-shadow: 0 0 0 .5px var(--line), 0 10px 26px -10px rgb(0 0 0 / .28); transition: transform .5s cubic-bezier(.2, 1.3, .4, 1); }\n.md-collage > div:hover { z-index: 3; transform: rotate(0deg) scale(1.03); }\n.md-collage .md-plate { border-radius: 10px; }\n.md-collage-main { left: 10%; top: 0; width: 72%; aspect-ratio: 3 / 2; transform: rotate(-1.6deg); z-index: 2; }\n.md-collage-side { width: 38%; aspect-ratio: 3 / 2; }\n.md-collage-side.is-0 { left: 0; bottom: 0; transform: rotate(-5deg); z-index: 3; }\n.md-collage-side.is-1 { right: 0; bottom: 6%; transform: rotate(4deg); z-index: 1; }\n.md-collage-side.is-2, .md-collage-side.is-3 { display: none; }\n\n/* 图 */\n.md-plate { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; line-height: 0; }\n.md-plate.is-wash { background: radial-gradient(90% 90% at 80% 10%, color-mix(in srgb, #c9b6f2 26%, transparent), transparent), radial-gradient(80% 90% at 10% 90%, color-mix(in srgb, #a9cdf5 26%, transparent), transparent), var(--hover); }\n.md-plate.is-clickable { cursor: zoom-in; }\n.md-plate::after { content: ''; position: absolute; inset: 0; pointer-events: none; }\n.md-plate[data-status=\"running\"]::after, .md-plate[data-status=\"pending\"]::after { background: linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--ink) 8%, transparent) 50%, transparent 70%); background-size: 220% 100%; animation: md-shimmer-bg 1.6s linear infinite; }\n@keyframes md-shimmer-bg { to { background-position: -220% 0; } }\n.md-plate img { display: block; width: 100%; height: 100%; object-fit: cover; animation: md-develop .9s var(--ease) both; }\n@keyframes md-develop { from { opacity: 0; filter: blur(10px); transform: scale(1.03); } }\n.md-plate.is-paper { border-radius: var(--r-sm); background: #fff; box-shadow: 0 0 0 .5px #17171a40; }\n.md-plate.is-paper img { object-fit: cover; }\n.md-plate-mark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--latin-serif); font-size: 26px; line-height: 1; color: color-mix(in srgb, var(--ink) 12%, transparent); }\n/* 还没生成的分镜格不用白纸，免得暗色界面里一片白 */\n.md-plate.is-paper:not(:has(img)) { background: var(--hover); box-shadow: none; }\n.md-plate-failed { position: absolute; left: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 3px; padding: 0 6px; border-radius: var(--r-xs); background: var(--card); color: var(--ink3); font-size: 11px; line-height: 18px; box-shadow: var(--dsw-elevation-soft); }\n\n/* 正文 */\n.md-article-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 20px 22px 18px; scroll-behavior: smooth; }\n.md-article-scroll .md-prose { font-size: 14px; line-height: 25px; }\n.md-root .md-article-scroll .md-prose h2 { font-size: 15px; line-height: 24px; margin: 16px 0 6px; }\n.md-root .md-article-scroll .md-prose p { margin-bottom: 11px; }\n.md-tile-article.is-open .md-article-scroll { padding: 4px 24px 60px; }\n.md-article { width: min(700px, 100%); margin: 0 auto; }\n.md-tile-article.is-open .md-prose { font-size: 16px; line-height: 30px; }\n.md-root .md-tile-article.is-open .md-prose h2 { font-size: 19px; line-height: 30px; margin: 26px 0 8px; }\n.md-root .md-tile-article.is-open .md-prose p { margin-bottom: 14px; }\n.md-article-figure { margin: 10px 0 24px; }\n.md-article-figure .md-plate { aspect-ratio: 3 / 2; height: auto; border-radius: var(--r-lg); }\n.md-article-figure figcaption { margin-top: 8px; text-align: center; color: var(--ink3); font-size: 12.5px; line-height: 18px; }\n.md-root .md-article-edit { flex: 1; display: block; width: 100%; min-height: 0; padding: 0 20px 22px 18px; border: 0; background: none; outline: 0; resize: none; font-size: 14px; line-height: 25px; }\n.md-root .md-tile-article.is-open .md-article-edit { width: min(740px, 100%); margin: 0 auto; font-size: 16px; line-height: 30px; }\n.md-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 6px 20px 16px 18px; }\n.md-skeleton i { display: block; height: 10px; border-radius: 999px; corner-shape: round; background: linear-gradient(100deg, var(--hover) 30%, var(--active) 50%, var(--hover) 70%); background-size: 220% 100%; animation: md-shimmer-bg 1.6s linear infinite; }\n.md-skeleton.is-still i { animation: none; background: color-mix(in srgb, var(--ink) 4%, transparent); }\n.md-skeleton i:nth-child(3n) { width: 72%; }\n.md-skeleton i:nth-child(5n) { width: 88%; }\n.md-pick { position: absolute; z-index: 4; transform: translate(-50%, calc(-100% - 6px)); display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 11px; border-radius: 999px; corner-shape: round; white-space: nowrap; font-size: 12px; animation: md-pop .3s cubic-bezier(.2, 1.3, .4, 1) both; }\n.md-root .md-pick { background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-prominent); }\n\n/* 分镜 */\n.md-shots { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows2), minmax(0, 1fr)); gap: 12px; padding: 2px 16px 16px; }\n.md-shot { margin: 0; min-width: 0; min-height: 0; display: flex; flex-direction: column; }\n.md-shot .md-plate { flex: 1; min-height: 0; }\n.md-shot figcaption { flex: none; margin-top: 6px; }\n.md-shot-meta { display: block; color: var(--ink3); font-size: 11px; line-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.md-shot-meta b { font-family: var(--latin-serif); font-size: 13px; font-weight: 400; color: var(--ink); }\n.md-shot figcaption p { margin-top: 1px; font-size: 12px; line-height: 17px; height: 34px; color: var(--ink2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.md-tile-shots.is-open .md-shots { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows3), minmax(0, 1fr)); gap: 16px 18px; padding: 2px 24px 24px; }\n.md-tile-shots.is-open .md-shot-meta { font-size: 12.5px; line-height: 18px; }\n.md-tile-shots.is-open .md-shot-meta b { font-size: 16px; }\n.md-tile-shots.is-open .md-shot figcaption p { font-size: 13.5px; line-height: 20px; height: 40px; }\n\n/* 自适应：宽的时候分镜排成 3\\xD72，窄或矮的时候整页滚动 */\n@container (min-width: 1040px) {\n  .md-bento { grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); }\n  .md-shots { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows3), minmax(0, 1fr)); }\n}\n@container (max-width: 620px) {\n  .md-tile-hero { flex-direction: column; gap: 14px; }\n  .md-collage { width: 100%; max-width: 420px; align-self: center; }\n}\n@container (max-width: 620px) or (max-height: 620px) {\n  .md-bento { height: auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto; grid-template-areas: \"hero\" \"article\" \"shots\"; }\n  .md-tile-article { height: 480px; }\n  .md-shots { flex: none; grid-template-rows: none; grid-auto-rows: auto; }\n  .md-tile-shots { overflow: visible; }\n  .md-shot .md-plate { flex: none; height: auto; aspect-ratio: 3 / 2; }\n}\n\n/* 窗口太窄时，对话栏改成抽屉 */\n.md-root.is-narrow .md-studio { --chat-w: 300px; }\n.md-root.is-compact .md-studio-chat { position: absolute; left: 0; top: 0; bottom: 0; z-index: 12; background: var(--canvas); box-shadow: var(--dsw-elevation-prominent); transform: translateX(-104%); transition: transform .45s cubic-bezier(.2, 1, .3, 1); animation: none; }\n.md-root.is-compact .md-studio.chat-open .md-studio-chat { transform: none; }\n.md-root.is-compact .md-chat-toggle { position: absolute; left: 14px; bottom: 14px; z-index: 13; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; corner-shape: round; background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-prominent); }\n.md-root.is-compact .md-studio.chat-open .md-chat-toggle { left: calc(var(--chat-w) + 14px); }\n.md-root.is-compact .md-sheet { padding-left: 10px; }\n\n/* 查看大图 */\n.md-viewer { position: absolute; inset: 0; z-index: 8; display: flex; align-items: center; justify-content: center; padding: 18px; background: color-mix(in srgb, var(--bg) 62%, transparent); backdrop-filter: blur(18px) saturate(140%); animation: md-fade .25s both; }\n.md-viewer-card { display: flex; flex-direction: column; width: 100%; max-width: 960px; max-height: 100%; overflow: hidden; border-radius: var(--r-panel); background: var(--card); box-shadow: var(--dsw-elevation-prominent); }\n.md-viewer-image { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: var(--hover); line-height: 0; overflow: hidden; }\n.md-viewer-image.is-paper { background: #fff; }\n.md-viewer-image img { display: block; max-width: 100%; max-height: calc(100cqh - 120px); object-fit: contain; animation: md-develop .5s var(--ease) both; }\n.md-viewer-busy { position: absolute; left: 12px; bottom: 12px; padding: 2px 10px; border-radius: var(--r-sm); background: var(--glass); backdrop-filter: blur(12px); font-size: 12px; line-height: 20px; }\n.md-viewer-card > footer { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 10px 12px 10px 18px; }\n.md-viewer-text { flex: 1 1 200px; min-width: 0; font-size: 13px; line-height: 19px; }\n.md-viewer-text b { display: block; font-weight: 500; }\n.md-viewer-text span { display: block; color: var(--ink3); font-size: 12px; line-height: 18px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n\n/* 设置 */\n.md-presets { display: flex; flex-wrap: wrap; gap: 4px; }\n.md-presets button { height: 30px; padding: 0 11px; border-radius: var(--r-md); box-shadow: inset 0 0 0 .5px var(--line-strong); font-size: 12.5px; color: var(--ink2); }\n.md-presets button.is-on { background: var(--primary); color: var(--on-primary); box-shadow: none; }\n.md-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }\n.md-advanced { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; color: var(--ink3); font-size: 12.5px; }\n.md-test-sample { display: block; width: 100%; border-radius: var(--r-lg); }\n\n/* 抽屉底部的对话条：对话栏让位给画布时使用 */\n.md-sheet-ask { flex: none; padding: 8px 12px 12px; border-top: .5px solid var(--line); }\n.md-sheet-ask-reply { margin: 0 4px 8px; color: var(--ink2); font-size: 12.5px; line-height: 19px; max-height: 96px; overflow-y: auto; white-space: pre-wrap; }\n.md-sheet-ask form { display: flex; align-items: center; gap: 6px; padding: 5px 5px 5px 12px; border-radius: var(--r-xl); background: var(--hover); }\n.md-root .md-sheet-ask input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 13px; }\n.md-sheet-ask .md-send { width: 28px; height: 28px; }\n.md-sheet-ask-open { display: inline-flex; align-items: center; color: var(--ink3); flex: none; }\n.md-sheet-ask-open:hover { color: var(--ink); }\n\n/* 侧边对话 */\n.md-dock { position: relative; z-index: 26; flex: none; width: var(--dock-w); display: flex; flex-direction: column; min-height: 0; border-left: .5px solid var(--line); background: color-mix(in srgb, var(--card) 62%, transparent); backdrop-filter: blur(30px) saturate(160%); animation: md-dock-in .5s var(--ease) both; }\n@keyframes md-dock-in { from { opacity: 0; transform: translateX(20px); } }\n.md-root.is-narrow .md-dock { z-index: 34; position: absolute; right: 8px; top: 8px; bottom: 8px; width: min(340px, calc(100% - 16px)); border: 0; border-radius: var(--r-panel); box-shadow: var(--dsw-elevation-prominent); background: color-mix(in srgb, var(--card) 92%, transparent); overflow: hidden; }\n.md-dock-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 14px 10px 8px 18px; }\n.md-dock > .md-chat { height: 100%; }\n.md-root .md-dock-head h2 { font-size: 15px; line-height: 22px; font-weight: 600; }\n.md-engine { display: inline-flex; align-items: center; gap: 5px; max-width: 130px; min-width: 0; color: var(--ink3); font-size: 11.5px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.md-engine i { flex: none; width: 6px; height: 6px; border-radius: 50%; corner-shape: round; background: var(--ink4); }\n.md-engine.is-live i { background: #2fa36c; }\n.md-engine.is-down i { background: #d39a2c; }\n.md-dock-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 18px 12px; display: flex; flex-direction: column; gap: 14px; }\n.md-dock-intro { margin: auto 0; padding-bottom: 12px; }\n.md-root .md-dock-intro h3 { font-size: 25px; line-height: 35px; font-weight: 300; letter-spacing: -.01em; margin-bottom: 10px; }\n.md-dock-intro p { color: var(--ink3); font-size: 13px; line-height: 21px; }\n.md-msg { font-size: 13.5px; line-height: 22px; animation: md-rise .35s var(--ease) both; white-space: pre-wrap; overflow-wrap: anywhere; }\n.md-msg.is-user { align-self: flex-end; max-width: 88%; padding: 8px 13px; border-radius: var(--r-lg); background: var(--active); }\n.md-msg.is-bot p + p { margin-top: 6px; }\n.md-msg-error { color: #d13c35; font-size: 12.5px; }\n.md-msg-note { color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-model-alert { margin-bottom: 12px; padding: 10px 12px; border-radius: var(--r-md); background: color-mix(in srgb, #d39a2c 12%, transparent); font-size: 12.5px; line-height: 18px; }\n.md-model-alert strong { display: block; font-weight: 600; }\n.md-model-alert p { margin-top: 4px; color: var(--ink2); overflow-wrap: anywhere; }\n.md-receipt { display: flex; align-items: flex-start; gap: 7px; width: 100%; margin-top: 6px; padding: 7px 10px; border-radius: var(--r-md); background: var(--card); box-shadow: var(--dsw-elevation-soft); font-size: 12.5px; line-height: 19px; transition: transform .25s var(--ease); }\nbutton.md-receipt:hover { transform: translateX(2px); }\n.md-receipt-check { flex: none; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-top: 1.5px; border-radius: 50%; corner-shape: round; background: var(--primary); color: var(--on-primary); }\n.md-msg footer { display: flex; align-items: center; gap: 10px; margin-top: 6px; color: var(--ink4); font-size: 11px; line-height: 16px; }\n.md-msg footer button { display: inline-flex; align-items: center; gap: 3px; color: var(--ink3); }\n.md-msg footer button:hover { color: var(--ink); }\n.md-suggest { display: flex; flex-direction: column; gap: 4px; padding: 0 12px 8px; }\n.md-suggest button { padding: 5px 10px; border-radius: var(--r-md); color: var(--ink2); font-size: 12.5px; line-height: 19px; transition: background .12s, color .12s; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: none; }\n.md-suggest button:hover:not(:disabled) { background: var(--hover); color: var(--ink); }\n.md-composer { position: relative; margin: 0 12px 12px; padding: 10px 8px 8px 14px; border-radius: var(--r-panel); background: var(--card); box-shadow: var(--dsw-elevation-soft); display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px; transition: box-shadow .2s var(--ease); }\n.md-composer:focus-within { box-shadow: 0 0 0 1px var(--ink), var(--dsw-elevation-soft); }\n.md-composer-ctx { display: flex; align-items: center; gap: 5px; width: 100%; min-width: 0; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-composer-ctx span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.md-root .md-composer textarea { flex: 1; min-width: 0; min-height: 32px; padding: 5px 0; border: 0; outline: 0; background: none; resize: none; font-size: 14px; line-height: 22px; }\n\n/* 普通页面 */\n.md-page { position: absolute; inset: 0; overflow-y: auto; padding: 78px 28px 40px; }\n.md-page-head, .md-section-head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 22px; }\n.md-section-head { margin-top: 36px; margin-bottom: 14px; }\n.md-root .md-page-head h1 { font-size: 34px; line-height: 44px; font-weight: 300; letter-spacing: -.015em; }\n.md-root .md-section-head h2 { font-size: 20px; line-height: 28px; font-weight: 400; }\n.md-page-sub { color: var(--ink3); font-size: 13px; line-height: 20px; margin-top: 2px; }\n.md-search { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: var(--r-md); background: var(--card); box-shadow: inset 0 0 0 .5px var(--line-strong); color: var(--ink3); width: 220px; }\n.md-root .md-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--ink); font-size: 13px; }\n.md-empty { padding: 56px 20px; text-align: center; color: var(--ink3); font-size: 13px; }\n.md-empty-title { font-size: 17px; color: var(--ink2); margin-bottom: 4px; }\n.md-panel { padding: 18px 20px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); min-width: 0; }\n.md-panel > header { display: flex; align-items: center; margin-bottom: 12px; min-height: 28px; }\n.md-root .md-panel h2 { font-size: 14px; line-height: 20px; font-weight: 500; }\n\n/* 看板 */\n.md-board { display: grid; grid-template-columns: repeat(5, minmax(190px, 1fr)); gap: 10px; align-items: start; overflow-x: auto; padding-bottom: 8px; }\n.md-board-col { padding: 10px; min-height: 320px; border-radius: var(--r-xl); background: var(--hover); transition: background .2s, box-shadow .2s; }\n.md-board-col.is-over { background: var(--active); box-shadow: inset 0 0 0 1px var(--ink3); }\n.md-board-col > header { display: flex; align-items: center; gap: 7px; padding: 2px 4px 10px; }\n.md-root .md-board-col h3 { font-size: 13px; line-height: 20px; font-weight: 500; }\n.md-board-list { display: flex; flex-direction: column; gap: 8px; }\n.md-board-card { display: block; width: 100%; padding: 6px; border-radius: var(--r-lg); background: var(--card); box-shadow: var(--dsw-elevation-soft); transition: transform .3s cubic-bezier(.2, 1.3, .4, 1); cursor: grab; }\n.md-board-card:hover { transform: translateY(-2px); }\n.md-board-card img { display: block; width: 100%; height: 92px; object-fit: cover; border-radius: 10px; margin-bottom: 6px; }\n.md-board-card strong { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding: 2px 6px 0; font-size: 13px; line-height: 19px; font-weight: 500; }\n.md-board-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; padding: 4px 6px 4px; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-board-meta .is-time { color: var(--accent); }\n\n/* 表格 */\n.md-table-wrap { border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); overflow: auto; }\n.md-table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 20px; }\n.md-table th { position: sticky; top: 0; z-index: 1; background: var(--card); padding: 10px 12px; text-align: left; font-weight: 400; color: var(--ink3); font-size: 12px; white-space: nowrap; border-bottom: .5px solid var(--line); }\n.md-table th button { display: inline-flex; align-items: center; gap: 3px; }\n.md-table td { padding: 8px 12px; border-bottom: .5px solid var(--line); vertical-align: middle; }\n.md-table tbody tr { cursor: pointer; transition: background .1s; }\n.md-table tbody tr:hover { background: var(--hover); }\n.md-table tbody tr:last-child td { border-bottom: 0; }\n.md-table.is-plain tbody tr { cursor: default; }\n.md-table .is-num { text-align: right; font-variant-numeric: tabular-nums; }\n.md-table-title { display: flex; align-items: center; gap: 12px; min-width: 300px; }\n.md-table-title strong { display: block; font-weight: 500; }\n.md-table-title small { display: block; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n\n/* 对话框与提示 */\n.md-dialog-mask { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--dsw-alias-bg-mask-1); animation: md-fade .18s both; }\n.md-dialog { max-width: 100%; max-height: 100%; overflow: auto; padding: 18px 20px 20px; border-radius: var(--r-panel); background: var(--card); box-shadow: var(--dsw-elevation-prominent); animation: md-pop .4s cubic-bezier(.2, 1.3, .4, 1) both; }\n@keyframes md-pop { from { opacity: 0; transform: scale(.94) translateY(10px); } }\n.md-dialog-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }\n.md-root .md-dialog-head h2 { font-size: 17px; line-height: 24px; font-weight: 500; }\n.md-form { display: flex; flex-direction: column; gap: 12px; }\n.md-field { display: flex; flex-direction: column; gap: 5px; }\n.md-field > span { color: var(--ink2); font-size: 12.5px; line-height: 18px; }\n.md-field small { color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-root .md-field input, .md-root .md-field select, .md-root .md-field textarea { width: 100%; border-radius: var(--r-md); border: .5px solid var(--line-strong); background: var(--card); padding: 7px 11px; font-size: 13.5px; line-height: 22px; outline: 0; resize: vertical; }\n.md-root .md-field input, .md-root .md-field select { height: 36px; padding: 0 11px; }\n.md-root .md-field input:focus, .md-root .md-field select:focus, .md-root .md-field textarea:focus { border-color: var(--ink); }\n.md-form-foot { display: flex; gap: 6px; margin-top: 4px; }\n.md-capture-tabs { display: flex; gap: 2px; padding: 4px; margin-bottom: 14px; border-radius: var(--r-md); background: var(--hover); }\n.md-capture-tabs button { flex: 1; height: 28px; border-radius: var(--r-sm); text-align: center; color: var(--ink3); font-size: 12.5px; }\n.md-capture-tabs button.is-on { background: var(--card); color: var(--ink); box-shadow: var(--dsw-elevation-soft); }\n.md-root .md-dropzone { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; padding: 34px 16px; border-radius: var(--r-lg); border: 1px dashed var(--line-strong); color: var(--ink2); text-align: center; transition: background .15s; }\n.md-root .md-dropzone:hover { background: var(--hover); }\n.md-dropzone small { color: var(--ink3); font-size: 12px; }\n.md-toast { position: absolute; z-index: 70; left: 50%; bottom: 76px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; max-width: min(520px, calc(100% - 32px)); padding: 8px 14px; border-radius: var(--r-lg); background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-prominent); font-size: 13px; line-height: 20px; animation: md-toast .5s cubic-bezier(.2, 1.3, .4, 1) both; }\n@keyframes md-toast { from { opacity: 0; transform: translate(-50%, 14px) scale(.96); } }\n.md-toast.is-error { background: #c33a33; color: #fff; }\n.md-root .md-toast button { flex: none; margin-left: 6px; font-weight: 500; color: inherit; text-decoration: underline dotted; text-underline-offset: 3px; }\n\n@media (prefers-reduced-motion: reduce) {\n  .md-root *, .md-root *::before, .md-root *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }\n  .md-links path { stroke-dashoffset: 0; }\n}\n\n\n/* 视频封面 */\n.md-poster { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 10px; line-height: 0; background: var(--hover); container-type: inline-size; }\n.md-poster[role=\"button\"] { cursor: zoom-in; }\n.md-poster img { display: block; width: 100%; height: 100%; object-fit: cover; animation: md-develop .9s var(--ease) both; }\n.md-poster::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgb(0 0 0 / .62)); pointer-events: none; }\n.md-poster.is-type { background: radial-gradient(90% 90% at 85% 10%, #ffc49688, transparent 70%), linear-gradient(120deg, #1a1b3a, #4a2f6b 58%, #d9745a); }\n.md-poster.is-type::after { display: none; }\n.md-poster b { position: absolute; z-index: 1; left: 5.5cqw; right: 22cqw; bottom: 5.5cqw; color: #fff; font-family: var(--serif); font-weight: 700; font-size: 8.4cqw; line-height: 1.24; text-shadow: 0 1px 10px rgb(0 0 0 / .3); animation: md-rise .6s var(--ease) both; }\n.md-poster[data-status=\"running\"]::before, .md-poster[data-status=\"pending\"]::before { content: ''; position: absolute; inset: 0; z-index: 2; background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / .16) 50%, transparent 70%); background-size: 220% 100%; animation: md-shimmer-bg 1.6s linear infinite; }\n.md-collage-main { aspect-ratio: 16 / 9; width: 78%; left: 0; }\n.md-collage-side { width: 32%; }\n.md-collage-side.is-0 { left: auto; right: 0; top: 3%; bottom: auto; transform: rotate(4deg); z-index: 3; }\n.md-collage-side.is-1 { right: 5%; bottom: 0; transform: rotate(-3deg); z-index: 3; }\n.md-collage-main:last-child { left: 11%; }\n.md-date-pill { position: relative; cursor: pointer; }\n.md-date-pill input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }\n.md-root .md-pill.is-small { height: 28px; padding: 0 11px; font-size: 12px; }\n.md-style-pick { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: .5px solid var(--line); color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-style-pick.is-follow { margin-top: 8px; padding-top: 0; border-top: 0; }\n.md-format-seg { display: flex; flex: 1; min-width: 0; height: 28px; padding: 2px; border-radius: var(--r-sm); background: var(--hover); }\n.md-root .md-format-seg button { display: inline-flex; align-items: center; justify-content: center; flex: 1; min-width: 0; border-radius: calc(var(--r-sm) - 2px); color: var(--ink3); font-size: 12.5px; line-height: 24px; transition: background .15s, color .15s; }\n.md-root .md-format-seg button.is-on { background: var(--card); color: var(--ink); box-shadow: var(--dsw-elevation-soft); }\n.md-root .md-article-title { font-family: var(--serif); font-size: 22px; line-height: 32px; font-weight: 600; margin: 0 0 16px; text-wrap: balance; }\n.md-root .md-prose.is-script p { margin-bottom: 18px; line-height: 28px; }\n.md-root .md-prose.is-article p { text-align: justify; }\n.md-root .md-style-pick select { flex: 1; min-width: 0; height: 28px; padding: 0 6px; border: 0; border-radius: var(--r-sm); background: var(--hover); color: var(--ink); font-size: 12.5px; outline: 0; }\n\n/* 精致页面的共同底：和工作区一样的底色 + 格子 */\n.md-board-page { position: absolute; inset: 0; overflow: hidden auto; padding: 64px 10px 10px; background: color-mix(in srgb, var(--ink) 3.5%, var(--bg)); container-type: size; }\n.md-i-hero { flex-direction: row; align-items: stretch; gap: 20px; min-height: 176px; padding: 20px 24px; background:\n  radial-gradient(55% 120% at 82% 8%, color-mix(in srgb, #c9b6f2 40%, transparent), transparent 70%),\n  radial-gradient(45% 110% at 100% 92%, color-mix(in srgb, #f7b899 42%, transparent), transparent 72%),\n  radial-gradient(50% 130% at 48% 118%, color-mix(in srgb, #a9cdf5 34%, transparent), transparent 70%),\n  var(--card); }\n.md-root .md-i-line { font-size: clamp(22px, 2.9cqw, 34px); line-height: 1.4; font-weight: 300; letter-spacing: -.012em; color: var(--ink3); }\n.md-i-line b { font-weight: 400; color: var(--ink); }\n.md-i-line .md-inline-pic { width: 1.1em; height: 1.1em; vertical-align: -.2em; }\n.md-i-sample { position: absolute; right: 16px; bottom: 10px; color: var(--ink4); font-size: 11px; }\n.md-i-hero.is-empty { min-height: 280px; }\n\n/* 排期 */\n.md-schedule { height: 100%; min-height: 620px; display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) 248px; }\n@container (max-width: 760px) { .md-schedule { height: auto; grid-template-columns: minmax(0, 1fr); } .md-cal-tile { height: 720px; } .md-tray { height: 420px; flex: none; } }\n.md-cal-tile { padding: 14px 16px 16px; }\n.md-cal-head { flex: none; display: flex; align-items: flex-end; gap: 12px; margin-bottom: 12px; }\n.md-cal-num { font-family: var(--latin-serif); font-size: 64px; line-height: 54px; letter-spacing: -.03em; }\n.md-cal-month { display: flex; flex-direction: column; }\n.md-cal-month span { color: var(--ink3); font-size: 12px; line-height: 15px; }\n.md-cal-month em { font-family: var(--latin-serif); font-size: 24px; line-height: 30px; color: var(--ink2); }\n.md-cal-stats { display: flex; gap: 18px; margin-left: 14px; }\n.md-cal-stats dt { color: var(--ink3); font-size: 11.5px; line-height: 15px; }\n.md-cal-stats dd { font-family: var(--latin-serif); font-size: 22px; line-height: 28px; }\n.md-cal-stats small { margin-left: 2px; font-family: var(--dsw-font-family); font-size: 11.5px; color: var(--ink3); }\n@container (max-width: 840px) { .md-cal-stats { display: none; } }\n.md-cal-weeks { flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding-bottom: 6px; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-cal-weeks span { padding-left: 8px; }\n.md-cal-grid { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows), minmax(0, 1fr)); gap: 4px; }\n.md-cal-cell { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 5px 6px 6px; overflow: hidden; border-radius: var(--r-md); background: color-mix(in srgb, var(--ink) 2.5%, transparent); transition: background .15s, box-shadow .15s, transform .3s cubic-bezier(.2, 1.3, .4, 1); }\n.md-cal-cell.is-outside { background: none; opacity: .4; }\n.md-cal-cell.is-today { background: color-mix(in srgb, var(--ink) 5%, transparent); }\n.md-cal-cell.is-over { background: var(--active); box-shadow: inset 0 0 0 1.5px var(--ink); transform: scale(1.02); }\n.md-cal-cell-top { flex: none; display: flex; align-items: flex-start; justify-content: space-between; min-height: 22px; }\n.md-cal-date { width: 22px; height: 22px; text-align: center; font-size: 12px; line-height: 22px; color: var(--ink2); border-radius: 50%; corner-shape: round; }\n.md-cal-cell.is-today .md-cal-date { background: var(--primary); color: var(--on-primary); }\n.md-cal-stamp { flex: none; width: 22px; }\n.md-cal-stamp .md-stamp { --s: 4px; --hole: 1px; width: 22px; height: 28px; aspect-ratio: auto; }\n.md-cal-stamp .md-stamp.is-type { font-size: 10px; }\n.md-cal-stamp .md-stamp i { display: none; }\n.md-cal-posts { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 3px; margin-top: 2px; }\n.md-root .md-cal-chip { flex: none; display: flex; align-items: center; gap: 5px; width: 100%; min-width: 0; padding: 2px 5px 2px 2px; border-radius: var(--r-sm); background: var(--card); box-shadow: var(--dsw-elevation-soft); cursor: grab; animation: md-pop .4s cubic-bezier(.2, 1.3, .4, 1) both; transition: transform .25s var(--ease); }\n.md-root .md-cal-chip:hover { transform: translateY(-1px); }\n.md-cal-thumb { flex: none; width: 22px; height: 22px; border-radius: 5px; overflow: hidden; background: radial-gradient(90% 90% at 85% 10%, #ffc49688, transparent 70%), linear-gradient(120deg, #1a1b3a, #4a2f6b 58%, #d9745a); }\n.md-cal-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }\n.md-cal-chip-text { min-width: 0; flex: 1; display: flex; flex-direction: column; }\n.md-cal-chip-text time { color: var(--ink3); font-size: 10px; line-height: 12px; font-variant-numeric: tabular-nums; }\n.md-cal-chip-text span { font-size: 11px; line-height: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.md-cal-more { color: var(--ink3); font-size: 10.5px; line-height: 14px; padding-left: 4px; }\n.md-rail-col { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }\n.md-root .md-next { flex: none; display: block; width: 100%; padding: 12px 14px; border-radius: var(--r-xl); background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-soft); transition: transform .35s cubic-bezier(.2, 1.3, .4, 1); }\n.md-root .md-next:hover { transform: translateY(-2px); }\n.md-next-top { display: flex; justify-content: space-between; font-size: 11.5px; line-height: 16px; opacity: .7; }\n.md-next b { display: block; margin-top: 2px; font-family: var(--latin-serif); font-size: 28px; line-height: 36px; font-weight: 400; font-variant-numeric: tabular-nums; }\n.md-next p { font-size: 13px; line-height: 19px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.md-next-foot { display: block; margin-top: 6px; font-size: 11.5px; line-height: 16px; opacity: .7; }\n.md-tray { flex: 1; transition: box-shadow .2s; }\n.md-tray.is-over { box-shadow: inset 0 0 0 1.5px var(--ink), var(--dsw-elevation-soft); }\n@container (max-width: 760px) { .md-rail-col .md-tray { flex: none; height: 420px; } }\n.md-tray-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 12px; }\n.md-root .md-tray-scroll h3 { margin: 6px 2px 8px; color: var(--ink3); font-size: 12px; line-height: 16px; font-weight: 400; }\n.md-tray-scroll h3 span { margin-left: 2px; }\n.md-tray-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 10px; }\n.md-root .md-tray-card { display: block; width: 100%; cursor: grab; transition: transform .3s cubic-bezier(.2, 1.3, .4, 1); }\n.md-root .md-tray-card:hover { transform: translateY(-2px) rotate(-.6deg); }\n.md-tray-cover { position: relative; display: block; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--r-md); box-shadow: var(--dsw-elevation-soft); container-type: inline-size; }\n.md-tray-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }\n.md-tray-cover.is-type { background: radial-gradient(90% 90% at 85% 10%, #ffc49688, transparent 70%), linear-gradient(120deg, #1a1b3a, #4a2f6b 58%, #d9745a); }\n.md-tray-cover b { position: absolute; left: 6cqw; right: 6cqw; bottom: 5cqw; color: #fff; font-family: var(--serif); font-size: 8.6cqw; line-height: 1.25; font-weight: 700; }\n.md-tray-title { display: block; margin-top: 5px; font-size: 12px; line-height: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink2); }\n.md-tray-list { display: flex; flex-direction: column; gap: 2px; margin: 0 -4px; }\n.md-root .md-tray-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px; border-radius: var(--r-sm); font-size: 12px; line-height: 17px; cursor: grab; transition: background .12s; }\n.md-root .md-tray-item:hover { background: var(--hover); }\n.md-tray-item > span:last-child { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n\n/* 复盘 */\n.md-insights { min-height: 100%; display: grid; gap: 10px; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); grid-template-rows: auto minmax(240px, 1fr) minmax(250px, 1fr); grid-template-areas: \"hero hero\" \"trend platforms\" \"top advice\"; }\n@container (max-width: 760px) { .md-insights { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-template-areas: \"hero\" \"trend\" \"platforms\" \"top\" \"advice\"; } .md-i-trend { height: 300px; } }\n.md-insights .md-i-hero { grid-area: hero; }\n.md-i-trend { grid-area: trend; }\n.md-i-platforms { grid-area: platforms; }\n.md-i-top { grid-area: top; }\n.md-i-advice { grid-area: advice; }\n.md-metrics { flex: none; align-self: center; display: flex; gap: 22px; margin-right: 8px; }\n.md-metric dt { color: var(--ink3); font-size: 12px; line-height: 16px; }\n.md-metric dd { font-family: var(--latin-serif); font-size: 32px; line-height: 42px; letter-spacing: -.01em; }\n.md-metric small { margin-left: 2px; font-family: var(--dsw-font-family); font-size: 12px; color: var(--ink3); }\n@container (max-width: 760px) { .md-metrics { display: none; } }\n.md-i-chart { flex: 1; min-height: 0; padding: 0 16px 10px 8px; display: flex; }\n.md-chart { position: relative; flex: 1; min-width: 0; min-height: 0; }\n.md-chart svg { display: block; overflow: visible; position: absolute; inset: 0; }\n.md-chart-grid { stroke: var(--line); stroke-width: .5; }\n.md-chart-axis { fill: var(--ink3); font-size: 11px; }\n.md-chart-line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; animation: md-draw 1.2s var(--ease) both; stroke-dashoffset: 1; }\n.md-chart-area { fill: color-mix(in srgb, var(--accent) 9%, transparent); animation: md-fade 1s .3s both; }\n.md-chart-cross { stroke: var(--line-strong); stroke-width: 1; }\n.md-chart-dot { fill: var(--accent); stroke: var(--card); stroke-width: 2; }\n.md-chart-tip { position: absolute; display: flex; flex-direction: column; min-width: 120px; padding: 7px 10px; border-radius: var(--r-md); background: var(--card); box-shadow: var(--dsw-elevation-panel); pointer-events: none; font-size: 12px; line-height: 17px; }\n.md-chart-tip small { color: var(--ink3); font-size: 11px; }\n.md-chart-tip b { font-weight: 500; }\n.md-i-table { flex: 1; min-height: 0; overflow-y: auto; }\n.md-bars { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 0 18px 16px; overflow-y: auto; }\n.md-bars li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 8px; align-items: baseline; font-size: 12.5px; line-height: 17px; color: var(--ink2); }\n.md-bars b { font-family: var(--latin-serif); font-size: 18px; line-height: 22px; font-weight: 400; color: var(--ink); text-align: right; }\n.md-bar-track { grid-column: 1 / -1; height: 6px; border-radius: 999px; corner-shape: round; background: var(--hover); overflow: hidden; }\n.md-bar-track i { display: block; height: 100%; border-radius: 999px; corner-shape: round; background: var(--accent); transform-origin: left; animation: md-grow 1s var(--ease) both; }\n@keyframes md-grow { from { transform: scaleX(0); } }\n.md-top { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px; }\n.md-root .md-top button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 10px 6px 8px; border-radius: var(--r-md); transition: background .12s; }\n.md-root .md-top button:hover { background: var(--hover); }\n.md-top-rank { flex: none; width: 16px; text-align: center; font-family: var(--latin-serif); font-size: 16px; color: var(--ink3); }\n.md-top-title { flex: 1; min-width: 0; }\n.md-top-title strong { display: block; font-weight: 500; font-size: 13px; line-height: 19px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.md-top-title small { display: block; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-top b { font-family: var(--latin-serif); font-size: 18px; font-weight: 400; white-space: nowrap; }\n.md-i-advice-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 0 18px 16px; }\n.md-i-advice-list > p { font-size: 13px; line-height: 20px; }\n.md-i-tip strong { display: block; font-weight: 500; font-size: 13.5px; line-height: 20px; }\n.md-i-tip p { margin: 1px 0 6px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n\n/* 风格 */\n.md-style-page { display: flex; flex-direction: column; gap: 10px; min-height: 100%; }\n.md-style-hero { flex: none; min-height: 164px; }\n.md-inline-avatar { display: inline-flex; width: 1.2em; height: 1.2em; vertical-align: -.22em; font-size: .9em; }\n.md-avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 50%; corner-shape: round; color: rgb(0 0 0 / .72); font-weight: 500; line-height: 1; }\n.md-style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }\n.md-style { display: flex; flex-direction: column; min-width: 0; padding: 14px 16px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); transition: transform .4s cubic-bezier(.2, 1.3, .4, 1), box-shadow .2s; animation: md-rise .5s var(--ease) both; }\n.md-style:hover { transform: translateY(-2px); box-shadow: var(--dsw-elevation-prominent); }\n.md-style.is-active { box-shadow: 0 0 0 1.5px var(--ink), var(--dsw-elevation-soft); }\n.md-style > header { display: flex; align-items: center; gap: 10px; }\n.md-style > header strong { display: block; font-size: 15px; line-height: 21px; font-weight: 500; }\n.md-style > header small { display: block; color: var(--ink3); font-size: 11.5px; line-height: 15px; }\n.md-style-summary { margin-top: 10px; font-size: 13px; line-height: 20px; color: var(--ink2); }\n.md-style blockquote { margin-top: 10px; padding-left: 10px; border-left: 1.5px solid var(--line-strong); font-family: var(--serif); font-size: 13.5px; line-height: 22px; color: var(--ink); }\n.md-style-words { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }\n.md-style-words span { padding: 0 8px; border-radius: 999px; corner-shape: round; background: var(--hover); color: var(--ink2); font-size: 11.5px; line-height: 20px; }\n.md-style > footer { margin-top: auto; padding-top: 12px; }\n.md-root .md-style-add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 180px; border-radius: var(--r-xl); border: 1px dashed var(--line-strong); color: var(--ink3); font-size: 13px; transition: background .15s, color .15s; }\n.md-root .md-style-add:hover { background: var(--card); color: var(--ink); }\n.md-rules { flex: none; }\n.md-rules ul { padding: 0 8px 8px; }\n.md-rule { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--r-md); }\n.md-rule > div { flex: 1; min-width: 0; }\n.md-rule strong { display: block; font-size: 13.5px; line-height: 20px; font-weight: 500; }\n.md-rule p { color: var(--ink2); font-size: 12.5px; line-height: 19px; }\n.md-rule .md-icon-btn { width: 28px; height: 28px; opacity: 0; transition: opacity .15s; }\n.md-rule:hover .md-icon-btn, .md-rule .md-icon-btn:focus-visible { opacity: 1; }\n.md-rule-empty { padding: 8px 10px 12px; font-size: 13px; }\n.md-rules .md-tile-head .md-pill { margin-left: 4px; }\n\n/* 抓账号 */\n.md-setup-lead { color: var(--ink2); font-size: 13px; line-height: 20px; }\n.md-setup ol { display: flex; flex-direction: column; gap: 14px; margin: 14px 0 16px; counter-reset: step; }\n.md-setup li { position: relative; padding-left: 30px; counter-increment: step; }\n.md-setup li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; corner-shape: round; background: var(--hover); color: var(--ink2); text-align: center; font-size: 11.5px; line-height: 20px; }\n.md-setup li strong { display: block; font-size: 13.5px; line-height: 20px; font-weight: 500; }\n.md-setup li span { display: block; color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-setup li a { display: inline-block; margin-top: 4px; color: var(--dsw-alias-link); font-size: 12.5px; line-height: 18px; }\n.md-copy-line { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 5px 5px 5px 10px; border-radius: var(--r-md); background: var(--hover); }\n.md-copy-line code { flex: 1; min-width: 0; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 18px; user-select: all; }\n.md-setup-note { margin-bottom: 10px; color: var(--ink2); font-size: 12.5px; line-height: 18px; }\n.md-setup-note.is-error { color: var(--dsw-alias-danger, #c0392b); }\n.md-root .md-setup-check { width: 100%; }\n.md-saved-accounts { display: flex; flex-wrap: wrap; gap: 4px; }\n.md-setup-foot { color: var(--ink3); font-size: 11.5px; line-height: 17px; }\n.md-monid-balance { align-self: center; color: var(--ink3); font-size: 12px; white-space: nowrap; }\n.md-root .md-inline-link { color: var(--dsw-alias-link); font-size: inherit; line-height: inherit; }\n\n/* 风格板块 */\n.md-style-icon { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: var(--hover); font-size: 21px; line-height: 1; }\n.md-inline-emoji { font-size: .92em; }\n.md-style-section > h2 { display: flex; align-items: center; gap: 6px; margin: 6px 2px 8px; color: var(--ink2); font-size: 13px; line-height: 20px; font-weight: 500; }\n.md-style-filter { flex: none; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }\n.md-root .md-style-filter button { height: 30px; padding: 0 12px; border-radius: 999px; corner-shape: round; color: var(--ink2); font-size: 12.5px; transition: background .15s, color .15s; }\n.md-root .md-style-filter button:hover { background: var(--hover); }\n.md-root .md-style-filter button.is-on { background: var(--primary); color: var(--on-primary); }\n.md-style-page .md-style-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }\n.md-style-page .md-style blockquote { font-size: 13px; line-height: 21px; }\n\n/* 空状态 */\n.md-hero-hint { margin-top: 10px; color: var(--ink3); font-size: 12.5px; line-height: 18px; animation: md-rise .5s var(--ease) both; }\n.md-tray-empty { padding: 4px 2px 10px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n\n.md-poster .md-plate-failed { z-index: 3; }\n.md-root button.md-plate-failed { cursor: pointer; }\n.md-root button.md-plate-failed:hover { color: var(--ink); }\n\n/* 手机宽度：DSH 0.2.2 起网页版可以在手机上打开。顶栏导航可横向滑动，次要按钮收起，灵感墙标题缩到屏幕宽度内 */\n.md-root { container: md-root / inline-size; }\n@container md-root (max-width: 560px) {\n  .md-topbar { gap: 6px; padding: 10px 10px 10px max(10px, var(--dsh-frame-leading-clearance, 0px)); }\n  .md-nav { flex: 0 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: none; }\n  .md-nav::-webkit-scrollbar { display: none; }\n  .md-nav button { padding: 0 10px; }\n  .md-sample { display: none; }\n  .md-open-dock { width: 36px; padding: 0; justify-content: center; font-size: 0; gap: 0; }\n  .md-open-dock svg { flex: none; }\n  .md-hero-anchor { width: min(520px, calc(100cqw - 40px)); }\n  .md-root .md-hero-line { font-size: 24px; line-height: 34px; }\n  .md-hero-input { height: 44px; }\n  .md-board-page { padding-top: 58px; }\n}\n\n/* 记灵感时拉到眼前的相关灵感 */\n.md-node.is-related { z-index: 9; }\n.md-node.is-related .md-card, .md-wall-cell.is-related .md-card { box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--accent, #6b5cff) 55%, transparent), var(--dsw-elevation-soft); }\n.md-node.is-dim { opacity: .28; filter: saturate(.5); }\n.md-hero-related { margin-top: 10px; display: flex; gap: 10px; align-items: baseline; color: var(--ink2); font-size: 12.5px; line-height: 18px; animation: md-rise .5s var(--ease) both; }\n\n\n/* 新版本提示：顶栏的小胶囊 + 设置底部的版本行 */\n.md-update { display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 999px; corner-shape: round; color: var(--ink); font-size: 12px; line-height: 28px; text-decoration: none; white-space: nowrap; background: color-mix(in srgb, var(--accent, #6b5cff) 14%, var(--glass)); box-shadow: inset 0 0 0 .5px var(--line-strong); backdrop-filter: blur(24px); transition: background .15s; }\n.md-update:hover { background: color-mix(in srgb, var(--accent, #6b5cff) 24%, var(--glass)); }\n.md-version { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 14px 0 4px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-version a { color: var(--accent, #6b5cff); text-decoration: none; }\n.md-version a:hover { text-decoration: underline; }"

    function injectStyles() {
      if (typeof document === 'undefined' || document.querySelector('style[data-rd="1"]')) return
      const style = document.createElement('style')
      style.setAttribute('data-rd', '1')
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

    // 上游偶发的流中断不该把英文原文摊给用户：瞬时错误自动重试一次，
    // 仍失败时给一句人话 + 可操作建议（参照 media-desk 的呈现口径）。
    function isTransientModelError(msg) {
      return /stream ended|finish reason|aborted|temporarily|timeout|timed out|连接中断|中断/i.test(String(msg || ''))
    }
    async function callWithRetry(payload) {
      try { return await call(payload) }
      catch (err) {
        if (!isTransientModelError(err && err.message)) throw err
        await new Promise(r => setTimeout(r, 600))
        return call(payload)
      }
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
      } catch (err) { return false }
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

    // media-desk's exact icon path dictionary (verbatim).
    const ICONS = {
      plus:'M12 5v14M5 12h14', close:'M6 6l12 12M18 6L6 18', send:'M12 19V5M6 11l6-6 6 6',
      check:'M5 12.5l4.5 4.5L19 7', chevL:'M14.5 5.5L8 12l6.5 6.5', chevR:'M9.5 5.5L16 12l-6.5 6.5',
      chevD:'M6 9.5l6 6 6-6', search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
      chat:'M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0A2.5 2.5 0 0 1 5 13.5z',
      scatter:'M4 5h6v7H4zM13 4h7v5h-7zM6 15h5v5H6zM14 12h6v8h-6z',
      wall:'M4 4h7v10H4zM13 4h7v6h-7zM4 16h7v4H4zM13 12h7v8h-7z',
      list:'M4 6h16M4 12h16M4 18h16',
      user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5',
      spark:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
      pen:'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
      film:'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
      branch:'M6 4v8a4 4 0 0 0 4 4h6M6 4a2 2 0 1 0 0 .01M18 16a2 2 0 1 0 0 .01M6 12a4 4 0 0 1 4-4h6M18 8a2 2 0 1 0 0 .01',
      trash:'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13', pin:'M9 4h6l-1 6 3 3v2H7v-2l3-3zM12 15v5',
      link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
      copy:'M9 9h10v11H9zM5 15V4h10', upload:'M12 16V5M7 10l5-5 5 5M5 19h14',
      calendar:'M5 6h14v14H5zM5 10h14M9 3.5v4M15 3.5v4', zoomIn:'M12 6v12M6 12h12', zoomOut:'M6 12h12',
      target:'M12 4v3M12 17v3M4 12h3M17 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
      play:'M8 5.5v13l11-6.5z', undo:'M8 6L4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3',
      bolt:'M13 3L5 14h6l-1 7 8-11h-6z',
      refresh:'M19 8a8 8 0 0 0-14-1L4 9M5 16a8 8 0 0 0 14 1l1-2M4 4v5h5M20 20v-5h-5',
      edit:'M4 20l1-4L16 5l3 3L8 19z',
      eye:'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
      upRight:'M7 17L17 7M8 7h9v9',
      image:'M4 5h16v14H4zM4 16l5-4.5 4 3.5 3-2.5 4 3.5M15.5 9.5a1 1 0 1 0 0 .01',
      clock:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
      expand:'M14 5h5v5M10 19H5v-5M19 5l-6 6M5 19l6-6',
      save:'M12 4v11M7 11l5 5 5-5M5 20h14', folder:'M4 7h6l2 2h10v10H4z',
      more:'M5 12h.01M12 12h.01M19 12h.01',
      pen:'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586',
      link:'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
      bolt:'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      upload:'M12 16V4M7 9l5-5 5 5M4 20h16',
      target:'M12 4v3M12 17v3M4 12h3M17 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
      gear:'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    }
    function I(props) {
      const size = (props && props.size) || 16
      const fill = !!(props && props.fill), stroke = (props && props.stroke) || 1.6
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24',
        fill: fill ? 'currentColor' : 'none', stroke: fill ? 'none' : 'currentColor',
        strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: ICONS[props && props.name] || '' }))
    }
    function F(props) {
      const cls = 'md-icon-btn ' + (props.active ? 'is-active ' : '') + (props.tone ? 'is-' + props.tone + ' ' : '') + (props.className || '')
      return h('button', { type: 'button', className: cls, 'aria-label': props.label, title: props.label,
        disabled: props.disabled, onClick: props.onClick }, I({ name: props.icon, size: props.size || 16 }))
    }
    function Dialog(props) {
      const close = props.onClose
      useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [close])
      return h('div', { className: 'md-dialog-mask', onPointerDown: e => { if (e.target === e.currentTarget) close() } },
        h('div', { className: 'md-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title,
          style: { width: props.width || 440 } },
          h('div', { className: 'md-dialog-head' }, h('h2', null, props.title), F({ icon: 'close', label: '关闭', onClick: close })),
          props.children))
    }

    const STYLE_CATS = ['综述写作', '实验论文', '理论推导', '研报简报', '科普写作', '开题报告']
    const DEFAULT_RULES = [
      { id: 'r1', label: '标题不超过 20 字', builtin: true },
      { id: 'r2', label: '每段先给结论再给证据', builtin: true },
      { id: 'r3', label: '引用必须带来源与年份', builtin: true },
    ]
    const ALL_STYLES = [
      { id: 'review', name: '综述写作', preset: true, category: '综述写作', icon: '📚', summary: '按主题脉络组织已有文献，强调分期、流派与争议，引用密集、措辞审慎。', samples: ['近年来，图神经网络在……方面取得显著进展，但其在……上的表现仍存在分歧。'] },
      { id: 'experiment', name: '实验论文', preset: true, category: '实验论文', icon: '🔬', summary: '结构化呈现方法、数据、基线与显著性，强调可复现与结果边界。', samples: ['我们在三个公开数据集上评估了该方法，结果显示……（p < 0.01）。'] },
      { id: 'theory', name: '理论推导', preset: true, category: '理论推导', icon: '🧮', summary: '先定义符号与假设，再逐步推导命题与推论，强调逻辑闭合。', samples: ['在假设 A1 与 A2 下，由引理 1 可得命题 2。'] },
      { id: 'brief', name: '研报简报', preset: true, category: '研报简报', icon: '📈', summary: '结论先行、数字支撑、风险与建议并列，适合快速决策阅读。', samples: ['核心结论：该方向近三年论文量增长 42%，但头部集中度仍然很高。'] },
      { id: 'popular', name: '科普写作', preset: true, category: '科普写作', icon: '💡', summary: '用类比与故事解释专业概念，少术语、多例子、可读性强。', samples: ['可以把图神经网络想象成：让每个节点先听听邻居说什么，再更新自己的判断。'] },
      { id: 'proposal', name: '开题报告', preset: true, category: '开题报告', icon: '📝', summary: '围绕问题陈述、研究空白、方法路线与预期贡献展开，强调可行性。', samples: ['本课题拟解决……问题，技术路线分为三个阶段，预期贡献包括……'] },
    ]
    const DEFAULT_IDEAS = [
      { id: 'idea-p1', kind: 'paper', text: '图神经网络的过平滑：层数越深，节点表征越趋同', body: '从信息瓶颈角度梳理过平滑的成因与缓解手段。', source: 'arXiv:2301.08284', status: 'idea', at: '2026-11-16' },
      { id: 'idea-p2', kind: 'paper', text: '异配图上的基线复现清单', source: 'GNN Benchmark', status: 'idea', at: '2026-11-15' },
      { id: 'idea-p3', kind: 'paper', text: '检索增强生成综述：从 RAG 到 Self-RAG', source: 'arXiv:2305.11401', status: 'idea', at: '2026-11-14' },
      { id: 'idea-i1', kind: 'image', text: '过平滑的层间信息衰减对比图', source: '灵感速记', status: 'idea', at: '2026-11-13', cover: 'linear-gradient(160deg,#cfe3d6,#6f9d86 55%,#34524a)' },
      { id: 'idea-i2', kind: 'image', text: '桌上的橘子：一个关于注意力的开场', source: '灵感速记', status: 'idea', at: '2026-11-12', cover: 'linear-gradient(165deg,#f6e7cc,#d98b4a 68%,#5a3520)' },
      { id: 'idea-i3', kind: 'image', text: '注意力热力图：模型到底在看哪里', source: '读图笔记', status: 'idea', at: '2026-11-11', cover: 'linear-gradient(155deg,#d6e4f0,#5b8bb5 60%,#25415e)' },
      { id: 'idea-t1', kind: 'table', text: '异配图基线对照表：数据集 / 精度 / 过平滑程度 / 复现难度', source: '路上想到', status: 'idea', at: '2026-11-10' },
      { id: 'idea-t2', kind: 'table', text: '近三年大模型评测榜单横向对照', source: '例会纪要', status: 'idea', at: '2026-11-09' },
      { id: 'idea-t3', kind: 'table', text: '实验组与对照组的消融结果汇总', source: '实验记录', status: 'idea', at: '2026-11-08' },
      { id: 'idea-r1', kind: 'report', text: '发布前 10 分钟检查清单：实验可复现、引用带年份、结论不越界', body: '实验可复现、引用带年份、结论不越界——发之前逐条过一遍。', source: '读者来信', status: 'idea', at: '2026-11-07' },
      { id: 'idea-r2', kind: 'report', text: '本周文献精读纪要：三篇论文的方法与局限', body: '三篇论文的方法路线、实验设置与主要局限，逐篇对照。', source: '组会', status: 'idea', at: '2026-11-06' },
      { id: 'idea-r3', kind: 'report', text: '课题中期进展汇报提纲', source: '导师反馈', status: 'idea', at: '2026-11-05' },
      { id: 'idea-l1', kind: 'link', text: 'https://arxiv.org/abs/2301.08284 — 想做一个异配图上的基线复现清单', source: 'arXiv', status: 'idea', at: '2026-11-04' },
      { id: 'idea-l2', kind: 'link', text: 'https://arxiv.org/abs/2305.11401 — RAG 综述，值得精读', source: 'arXiv', status: 'idea', at: '2026-11-03' },
      { id: 'idea-l3', kind: 'link', text: 'https://paperswithcode.com/ — GNN 基准代码库', source: 'Papers with Code', status: 'idea', at: '2026-11-02' },
      { id: 'idea-n1', kind: 'note', text: '好的选题不是想出来的，是被你反复抱怨出来的。', body: '反复被吐槽的地方，往往就藏着真问题。把它写下来，就是选题。', source: '读书笔记', status: 'idea', at: '2026-11-01' },
      { id: 'idea-n2', kind: 'note', text: '工具的终点，是让你忘记它。', source: '随手记', status: 'idea', at: '2026-10-31' },
      { id: 'idea-n3', kind: 'note', text: '写不出来，往往是因为还没想清楚要回答什么问题。', body: '先写下这句要回答的问题，再动笔写正文，会顺很多。', source: '深夜 thoughts', status: 'idea', at: '2026-10-30' },
    ]
    const IDEA_KIND_KEYS = ['paper', 'image', 'table', 'report', 'link', 'note']
    function hydrateIdeas() {
      let stored = []
      try { stored = JSON.parse(localStorage.getItem('rd.ideas') || 'null') || [] } catch (e) { stored = [] }
      const alias = { quote: 'report', 金句: 'report', 随手记: 'note', 笔记: 'note', 链接: 'link', 网页: 'link', 文献: 'paper', 图片: 'image', 表格: 'table', 报告: 'report', 视频: 'image' }
      const norm = x => { const o = Object.assign({}, x); const k = o.kind; o.kind = alias[k] || (IDEA_KIND_KEYS.indexOf(k) >= 0 ? k : 'note'); const d = DEFAULT_IDEAS.find(z => z.id === o.id); if (d) { if (!o.body && d.body) o.body = d.body; if (!o.cover && d.cover) o.cover = d.cover } return o }
      const list = (stored.length ? stored : DEFAULT_IDEAS).map(norm)
      const counts = {}
      list.forEach(x => { counts[x.kind] = (counts[x.kind] || 0) + 1 })
      IDEA_KIND_KEYS.forEach(k => {
        const need = 3 - (counts[k] || 0)
        if (need > 0) { const pool = DEFAULT_IDEAS.filter(d => d.kind === k); for (let i = 0; i < need; i++) list.push(Object.assign({}, pool[i % pool.length], { id: 'seed-' + k + '-' + i })) }
      })
      return list
    }
    function hashCode(e) { let t = 0; e = String(e || ''); for (let i = 0; i < e.length; i++) { t = (t << 5) - t + e.charCodeAt(i) | 0 } return t >>> 0 }

    function Desk() {
      const [view, setView] = useState(() => { try { const v = localStorage.getItem('rd.view'); return ['home', 'content', 'schedule', 'discover', 'insights', 'style'].indexOf(v) >= 0 ? v : 'home' } catch (e) { return 'home' } })
      const [mode, setMode] = useState(() => { try { const m = localStorage.getItem('rd.mode'); return m === 'wall' || m === 'scatter' ? m : 'scatter' } catch (e) { return 'scatter' } })
      const [kindFilter, setKindFilter] = useState(() => { try { const k = localStorage.getItem('rd.kindFilter'); return ['all', 'paper', 'image', 'table', 'report', 'link', 'note'].indexOf(k) >= 0 ? k : 'all' } catch (e) { return 'all' } })
      const [query, setQuery] = useState('')
      const [library, setLibrary] = useState({ papers: [], hypotheses: [], drafts: [], reviews: [], chat: [] })
      const [models, setModels] = useState([])
      const [msgs, setMsgs] = useState([])
      const [input, setInput] = useState('')
      const [busy, setBusy] = useState('')
      const [toast, setToast] = useState(null)
      const [selected, setSelected] = useState(null)
      const [positions, setPositions] = useState({})
      const [pan, setPan] = useState({ x: 0, y: 0 })
      const [zoom, setZoom] = useState(1)
      const [settingRows, setSettingRows] = useState([])
      const [settingDraft, setSettingDraft] = useState({})
      const [searchResults, setSearchResults] = useState([])
      const [showSettings, setShowSettings] = useState(false)
      const [model, setModel] = useState('')
      const [modelPickOpen, setModelPickOpen] = useState(false)
      const [dockOpen, setDockOpen] = useState(true)
      const [dockW, setDockW] = useState(() => { try { return Math.max(280, Math.min(700, parseInt(localStorage.getItem('rd.dockW'), 10) || 336)) } catch (e) { return 336 } })
      const [width, setWidth] = useState(1600)
      const [contentMode, setContentMode] = useState('board')
      const [contentQuery, setContentQuery] = useState('')
      const [contentSort, setContentSort] = useState({ key: 'title', dir: 1 })
      const [contentStatus, setContentStatus] = useState(() => { try { return JSON.parse(localStorage.getItem('rd.contentStatus') || '{}') } catch (e) { return {} } })
      const [boardOver, setBoardOver] = useState(null)
      const [calMonth, setCalMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
      const [schedule, setSchedule] = useState(() => { try { return JSON.parse(localStorage.getItem('rd.schedule') || '{}') } catch (e) { return {} } })
      const [insightMode, setInsightMode] = useState('chart')
      const [styleFilter, setStyleFilter] = useState('全部')
      const [activeStyle, setActiveStyle] = useState(() => { try { return localStorage.getItem('rd.activeStyle') || '' } catch (e) { return '' } })
      const [customStyles, setCustomStyles] = useState(() => { try { return JSON.parse(localStorage.getItem('rd.customStyles') || '[]') } catch (e) { return [] } })
      const [rules, setRules] = useState(() => { try { return JSON.parse(localStorage.getItem('rd.rules') || 'null') || DEFAULT_RULES.map(r => Object.assign({}, r)) } catch (e) { return DEFAULT_RULES.map(r => Object.assign({}, r)) } })
      const [capture, setCapture] = useState(null)
      const [captureText, setCaptureText] = useState('')
      const [captureUrl, setCaptureUrl] = useState('')
      const [captureName, setCaptureName] = useState('')
      const [captureTab, setCaptureTab] = useState('text')
      const [ideas, setIdeas] = useState(hydrateIdeas)
      const [studioId, setStudioId] = useState(null)
      const [studioItem, setStudioItem] = useState(null)
      const [studioFormat, setStudioFormat] = useState('script')
      const [studioDraft, setStudioDraft] = useState('')
      const [studioInput, setStudioInput] = useState('')
      const [studioImages, setStudioImages] = useState(false)
      const [ideaInput, setIdeaInput] = useState('')
      const [ideaCapOpen, setIdeaCapOpen] = useState(false)
      const [ideaCapTab, setIdeaCapTab] = useState('note')
      const [ideaCapText, setIdeaCapText] = useState('')
      const rootRef = useRef(null)

      const applyLibrary = useCallback(data => { if (data && data.library) setLibrary(data.library) }, [])
      const refresh = useCallback(async () => {
        try { applyLibrary(await call({ action: 'library' })) }
        catch (err) { setToast({ text: String(err.message || err), error: true }) }
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
      useEffect(() => {
        const el = rootRef.current
        if (!el || typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(entries => {
          const w = (entries[0] && entries[0].contentRect && entries[0].contentRect.width) || 1600
          setWidth(w)
        })
        ro.observe(el)
        return () => ro.disconnect()
      }, [])
      useEffect(() => { if (width < 1020) setDockOpen(false) }, [width < 1020])
      useEffect(() => { try { localStorage.setItem('rd.dockW', String(dockW)) } catch (e) {} }, [dockW])
      useEffect(() => { try { localStorage.setItem('rd.schedule', JSON.stringify(schedule)) } catch (e) {} }, [schedule])
      useEffect(() => { try { localStorage.setItem('rd.activeStyle', activeStyle) } catch (e) {} }, [activeStyle])
      useEffect(() => { try { localStorage.setItem('rd.customStyles', JSON.stringify(customStyles)) } catch (e) {} }, [customStyles])
      useEffect(() => { try { localStorage.setItem('rd.rules', JSON.stringify(rules)) } catch (e) {} }, [rules])
      useEffect(() => { try { localStorage.setItem('rd.ideas', JSON.stringify(ideas)) } catch (e) {} }, [ideas])
      useEffect(() => { try { localStorage.setItem('rd.view', view) } catch (e) {} }, [view])
      useEffect(() => { try { localStorage.setItem('rd.mode', mode) } catch (e) {} }, [mode])
      useEffect(() => { try { localStorage.setItem('rd.kindFilter', kindFilter) } catch (e) {} }, [kindFilter])
      useEffect(() => { try { localStorage.setItem('rd.contentStatus', JSON.stringify(contentStatus)) } catch (e) {} }, [contentStatus])

      const notify = (text, error, undo) => setToast(text ? { text, error: !!error, undo: !!undo, key: Date.now() } : null)
      useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), (toast.undo || toast.text.length > 24) ? 6000 : 3200); return () => clearTimeout(t) }, [toast])
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
      const num = n => Number(n || 0).toLocaleString()
      const modelRouteOf = m => (m && m.provider ? m.provider + '/' + m.model : (m && m.model ? m.model : ''))
      const curM = models.find(m => modelRouteOf(m) === model) || models[0]
      const modelLabel = curM ? (curM.model || curM.label || model) : (model ? String(model).split('/').pop() : '助手模型')

      const doSearch = useCallback(async () => {
        const q = query.trim()
        if (!q || busy) return
        setBusy('search'); notify(null)
        try {
          const d = await call({ action: 'search', query: q, sources: ['arxiv', 'europepmc', 'openalex'], maxResults: 12 })
          const list = Array.isArray(d.papers) ? d.papers : []
          setSearchResults(list); setView('discover')
          if (!list.length) notify('没有检索到文献，换个主题试试。', true)
        } catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [query, busy])
      const addPapers = useCallback(async list => {
        if (!list.length || busy) return
        setBusy('add')
        try { applyLibrary(await call({ action: 'add', papers: list })); notify('已加入文献库 ' + list.length + ' 篇。', false, true) }
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
        try { const d = await call({ action: 'clear' }); applyLibrary(d); setSelected(null); setPositions({}); notify(d.message || '已清空。', false, true) }
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
        setBusy('model')
        try {
          await call({ action: 'settings', patch: { 'model.route': value } })
          setModel(value)
          setSettingDraft(prev => ({ ...prev, 'model.route': value }))
          setModelPickOpen(false)
          notify(value ? '助手模型已切换。' : '助手模型已设为跟随默认。')
        } catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [])
      const seed = useCallback(() => { setQuery('graph neural network'); setTimeout(doSearch, 0) }, [doSearch])
      const addIdea = useCallback((text, kind) => {
        const t = String(text || '').trim()
        if (!t) return
        const item = { id: 'i' + Date.now() + Math.random().toString(36).slice(2, 6), text: t, kind: kind || (/^https?:\/\//i.test(t) ? 'link' : 'note'), at: new Date().toISOString().slice(0, 10), status: 'idea' }
        setIdeas(prev => [item].concat(prev))
        notify('已记下一条灵感。')
      }, [])
      const openStudio = useCallback((id, x) => { setStudioId(id); setStudioItem(x || null); setStudioDraft(''); setSelected(null) }, [])
      const closeStudio = useCallback(() => { setStudioId(null); setStudioItem(null) }, [])
      const draftStudio = useCallback(async () => {
        const idea = studioItem || ideas.find(x => x.id === studioId)
        if (!idea || busy) return
        setBusy('studio'); notify(null)
        try {
          const d = await callWithRetry({ action: 'ask', question: '把这条科研内容写成一份' + (studioFormat === 'article' ? '短文' : '研究快报') + '：' + (idea.title || idea.text) })
          setStudioDraft((d && d.message) || '（模型没有返回正文，可以补充想法后再试一次。）')
        } catch (err) { setStudioDraft('生成失败：' + String((err && err.message) || err)) }
        finally { setBusy('') }
      }, [ideas, studioId, studioItem, studioFormat, busy])
      const refineStudio = useCallback(async () => {
        const t = studioInput.trim()
        if (!t || busy) return
        setStudioInput('')
        setBusy('studio'); notify(null)
        try { const d = await callWithRetry({ action: 'ask', question: '基于这份草稿继续修改（'+t+'）：'+studioDraft }); setStudioDraft((d && d.message) || studioDraft) }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [studioInput, studioDraft, busy])
      const send = useCallback(async text => {
        const q = String(text || '').trim()
        if (!q || busy) return
        const style = ALL_STYLES.find(x => x.id === activeStyle)
        const styled = style ? '按「' + style.name + '」写作风格：' + q : q
        setInput('')
        setMsgs(prev => [...prev, { role: 'me', text: q }])
        setBusy('assistant'); notify(null)
        try {
          let d, answer
          if (/综述|review|进展|梳理/.test(q)) {
            d = await callWithRetry({ action: 'review', topic: q, perspectives: ['methodology', 'evidence', 'contradictions', 'gaps'] })
            const secs = (d.review && d.review.sections) || []
            answer = secs.length ? secs.map(s => '【' + (s.label || s.key) + '】\n' + (s.text || '')).join('\n\n') : (d.message || '（无内容）')
          } else if (/缺口|gap|未解决|不足/.test(q)) {
            d = await callWithRetry({ action: 'gaps', topic: q })
            answer = (d.gaps && d.gaps.text) || d.message || '（无内容）'
          } else if (/选题|假设|hypothesis|方向/.test(q)) {
            d = await callWithRetry({ action: 'hypothesis' })
            const rows = (d.library && d.library.hypotheses) || []
            applyLibrary(d)
            answer = rows.length ? rows.map(r => '• ' + (r.title || '') + (r.gap ? '\n  缺口：' + r.gap : '')).join('\n') : '没有推出选题。'
          } else {
            if (!fullCount) { answer = '文献库里还没有全文。先在「发现」里检索并加入文献，点卡片抓取全文，再问我。' }
            else { d = await callWithRetry({ action: 'ask', question: styled }); answer = (d.message || '（无内容）') + ((d.citations || []).length ? '\n\n已核验引文 ' + d.citations.length + ' 条。' : '') }
          }
          setMsgs(prev => [...prev, { role: 'ai', text: answer || '（无内容）' }])
        } catch (err) {
          const raw = String((err && err.message) || err)
          const friendly = isTransientModelError(raw)
            ? '模型这次没响应完（连接中断），已自动重试一次仍未成功。请再发一次，或到顶栏换个助手模型试试。'
            : '这次没能完成：' + raw
          setMsgs(prev => [...prev, { role: 'ai', text: friendly }])
        }
        finally { setBusy('') }
      }, [busy, fullCount, applyLibrary, activeStyle])
      const saveSettings = useCallback(async () => {
        const patch = {}
        for (const row of settingRows) {
          const v = settingDraft[row.key]
          if (v === undefined) continue
          if ((row.type === 'int' || row.type === 'float') && String(v).trim() === '') continue
          if (row.key === 'model.route') continue
          patch[row.key] = v
        }
        setBusy('settings')
        try { await call({ action: 'settings', patch }); notify('设置已保存。') }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [settingRows, settingDraft])
      const resetSettings = useCallback(async () => {
        setBusy('settings')
        try { await call({ action: 'settings', reset: true }); notify('已恢复默认设置。'); }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [])

      const NAV = [['home', '灵感'], ['content', '内容'], ['schedule', '排期'], ['discover', '发现'], ['insights', '复盘'], ['style', '文风']]
      const topbar = h('header', { className: 'md-topbar', 'data-window-drag': '', key: 'top' }, [
        h('nav', { className: 'md-nav', 'aria-label': '工作台导航', key: 'nav' },
          NAV.map(([id, label]) => h('button', { type: 'button', key: id,
            className: view === id ? 'is-on' : '', 'aria-current': view === id ? 'page' : undefined,
            onClick: () => { setView(id); setSelected(null) } }, label))),
        h('span', { style: { flex: 1 }, key: 'sp' }),
        h('button', { type: 'button', className: 'md-sample', key: 'sample',
          title: '现在看到的内容都是示例，可以一键清空', disabled: busy !== '' }, [
          h('span', { key: 's', onClick: seed }, '示例数据'),
          h('span', { key: 'd' }, ' · '),
          h('span', { key: 'c', onClick: doClear }, '清空'),
        ]),
        F({ key: 'undo', icon: 'undo', label: '撤销上一步', disabled: busy !== '', onClick: doUndo }),
        h('button', { type: 'button', className: 'md-open-dock', key: 'model', title: '助手模型', onClick: () => setModelPickOpen(true) }, [
          I({ name: 'spark', size: 13 }), modelLabel,
        ]),
        F({ key: 'gear', icon: 'gear', label: '设置', onClick: () => setShowSettings(true) }),
        dockOpen ? null : h('button', { type: 'button', className: 'md-open-dock', key: 'opendock', onClick: () => setDockOpen(true) }, [
          I({ name: 'chat', size: 15 }), '助手',
        ]),
      ])

      const isNarrow = width < 1020, isCompact = width < 780
      const hero = h('div', { className: 'md-hero', key: 'hero' }, [
        h('h1', { className: 'md-hero-line', key: 'line' }, [
          '还有 ', h('b', { key: 'b1' }, toRead + ' 篇文献'), ' 待精读，', h('br', { key: 'br1' }),
          h('b', { key: 'b2' }, papers.length + ' 篇'), ' 在库，', h('br', { key: 'br2' }),
          '你已经连续记录 ', h('b', { key: 'b3', className: 'md-hero-streak' }, String(library.hypotheses ? library.hypotheses.length : 0)), ' 条选题',
        ]),
        h('form', { className: 'md-hero-input', key: 'input', onSubmit: e => { e.preventDefault(); doSearch() } }, [
          I({ name: 'spark', size: 16, key: 'ic' }),
          h('input', { key: 'in', value: query, onChange: e => setQuery(e.target.value), placeholder: '检索一个研究主题，或记下一条线索', 'aria-label': '记下线索' }),
          h('button', { key: 'go', type: 'submit', className: 'md-send', 'aria-label': '检索', disabled: !query.trim() || busy !== '' }, I({ name: 'send', size: 15 })),
        ]),
      ])

      const paperCard = (p, i) => {
        const key = p.id || String(i)
        const pos = positions[key] || (isNarrow
          ? { px: 120 + (i % 2) * 200, py: 580 + Math.floor(i / 2) * 158, r: ((i * 37) % 9) - 4, d: 0.72 }
          : { px: 200 + (i % 4) * 230, py: 370 + Math.floor(i / 4) * 160, r: ((i * 37) % 11) - 5, d: 1 })
        const style = { '--px': pos.px + 'px', '--py': pos.py + 'px', '--r': pos.r + 'deg', '--d': pos.d }
        const nodePointerDown = e => {
          if (e.button !== 0) return
          e.stopPropagation()
          const startX = e.clientX, startY = e.clientY, el = e.currentTarget
          const base = positions[key] || pos, nd = base.d || 1, moved = { v: false }
          e.currentTarget.closest('.md-node').classList.add('is-dragging')
          const move = ev => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY
            if (!moved.v && Math.abs(dx) + Math.abs(dy) < 4) return
            moved.v = true
            setPositions(prev => Object.assign({}, prev, { [key]: Object.assign({}, base, { px: base.px + dx / nd, py: base.py + dy / nd }) }))
          }
          const up = () => {
            const node = el.closest('.md-node'); if (node) node.classList.remove('is-dragging')
            el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
            if (!moved.v) setSelected(p)
          }
          try { el.setPointerCapture && el.setPointerCapture(e.pointerId) } catch (err) {}
          el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
        }
        return h('div', { className: 'md-node' + (selected && selected.id === p.id ? ' is-selected' : ''), key, style }, [
          h('div', { className: 'md-pop' }, [
            h('div', { className: 'md-card', style: { width: isNarrow ? 150 : 210 }, onPointerDown: nodePointerDown }, [
              h('div', { className: 'md-card-note', key: 'n' }, [
                h('span', { className: 'md-card-rel', key: 'rel' }, sourceOf(p)),
                h('h3', { key: 't' }, short(p.title, 70)),
                h('p', { key: 'a' }, short(p.abstract, 120)),
              ]),
              h('div', { className: 'md-card-foot', key: 'f' }, [
                h('span', { className: 'md-card-source', key: 's' }, short(p.venue || '', 40)),
                h('span', { className: 'md-card-count', key: 'c' }, p.chunks > 0 ? (p.chunks + ' 段全文') : '仅摘要'),
                h('span', { className: 'md-card-time', key: 'y' }, p.year || ''),
              ]),
            ]),
          ]),
        ])
      }
      const stagePointerDown = e => {
        if (e.button !== 0 || (e.target.closest && e.target.closest('.md-node'))) return
        const el = e.currentTarget
        const startX = e.clientX, startY = e.clientY, base = pan
        el.classList.add('is-panning')
        const move = ev => setPan({ x: base.x + ev.clientX - startX, y: base.y + ev.clientY - startY })
        const up = () => {
          el.classList.remove('is-panning')
          el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
        }
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId) } catch (err) {}
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
      }
      const filtered = papers.filter(p => kindFilter === 'all' || (kindFilter === 'toread' ? !(p.chunks > 0) : (p.chunks > 0)))
      const scatter = h('div', { className: 'md-home', key: 'home' }, [
        h('div', { className: 'md-stage', key: 'stage', onPointerDown: stagePointerDown,
          style: { '--grid-size': (28 * (isNarrow ? 0.72 : 1)) + 'px', '--grid-x': pan.x + 'px', '--grid-y': pan.y + 'px' } }, [
          h('div', { className: 'md-world', key: 'world', style: { transform: 'translate(' + pan.x + 'px,' + pan.y + 'px)' } }, [
            h('div', { className: 'md-hero-anchor', key: 'ha', style: { left: isNarrow ? Math.round(width / 2) : 400, top: isNarrow ? 200 : 220 } }, hero),
            ...filtered.slice(0, isNarrow ? 7 : 16).map(paperCard),
          ]),
        ]),
        h('div', { className: 'md-dockbar', role: 'toolbar', 'aria-label': '文献视图', key: 'dockbar' }, [
          h('div', { className: 'md-seg', key: 'seg' }, [
            h('button', { key: 'scatter', type: 'button', className: mode === 'scatter' ? 'is-on' : '', onClick: () => setMode('scatter') }, [I({ name: 'scatter', size: 13, key: 'i' }), '散落']),
            h('button', { key: 'wall', type: 'button', className: mode === 'wall' ? 'is-on' : '', onClick: () => setMode('wall') }, [I({ name: 'wall', size: 13, key: 'i' }), '信息流']),
          ]),
          h('span', { className: 'md-dockbar-sep', key: 'sep1' }),
          h('div', { className: 'md-chips', key: 'chips' }, [['all', '全部'], ['toread', '待读'], ['read', '有全文']].map(([k, l]) =>
            h('button', { key: k, type: 'button', className: kindFilter === k ? 'is-on' : '', onClick: () => setKindFilter(k) }, l))),
          h('span', { className: 'md-dockbar-sep', key: 'sep2' }),
          h('button', { className: 'md-round is-primary', key: 'go', 'aria-label': '检索并记一条线索', title: '检索并记一条线索', disabled: busy !== '' || !query.trim(), onClick: doSearch }, I({ name: 'plus', size: 18 })),
        ]),
      ])

      const feed = h('div', { className: 'md-page', key: 'feed' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '文献信息流'), h('p', { className: 'md-page-sub', key: 's' }, '按加入顺序排列，点标题查看摘要。')]),
        papers.length ? h('div', { className: 'md-rows', key: 'rows' }, papers.map((p, i) => h('button', { className: 'md-row', key: p.id || i, onClick: () => setSelected(p) }, [
          h('span', { className: 'md-card-rel', key: 'b' }, sourceOf(p)),
          h('span', { className: 'md-row-main', key: 'm' }, [h('strong', { key: 't' }, short(p.title, 90)), h('span', { key: 'a' }, short(p.abstract, 160))]),
          h('span', { className: 'md-row-title', key: 'y' }, p.year || ''),
        ]))) : h('div', { className: 'md-empty', key: 'e' }, '还没有文献。用底部检索框找几篇。'),
      ])

      const detail = selected ? h('div', { className: 'md-panel', key: 'detail', style: { position: 'absolute', right: 18, bottom: 84, width: isNarrow ? 260 : 340, maxHeight: '55%', overflowY: 'auto', zIndex: 20 } }, [
        h('header', { key: 'h' }, [h('h2', { key: 't' }, '文献详情'), F({ key: 'x', icon: 'close', label: '关闭', onClick: () => setSelected(null) })]),
        h('h3', { key: 'title', style: { fontSize: 15, lineHeight: '22px', fontWeight: 500, marginBottom: 8 } }, selected.title),
        h('p', { className: 'md-muted', key: 'meta' }, (selected.venue || '') + ' ' + (selected.year || '')),
        h('p', { key: 'abs', style: { marginTop: 10, fontSize: 13, lineHeight: '21px' } }, short(selected.abstract, 500)),
        h('div', { className: 'md-form-foot', key: 'acts' }, [
          h('button', { className: 'md-btn is-small', key: 'r', disabled: busy !== '', onClick: () => readPaper(selected.id) }, '抓取全文'),
          h('button', { className: 'md-btn is-small', key: 'd', disabled: busy !== '', onClick: () => removePaper(selected.id) }, '移出'),
        ]),
      ]) : null

      const notesView = h('div', { className: 'md-page', key: 'notes' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '笔记'), h('p', { className: 'md-page-sub', key: 's' }, '选题、综述与草稿都落在这里。')]),
        (() => {
          const notes = [
            ...(library.hypotheses || []).map(x => ({ kind: '选题', title: x.title, body: x.rationale || x.gap || '' })),
            ...(library.reviews || []).map(x => ({ kind: '综述', title: x.topic || '综述', body: '' })),
            ...(library.drafts || []).map(x => ({ kind: '草稿', title: x.title || '草稿', body: short(x.text, 200) })),
          ]
          return notes.length ? h('div', { className: 'md-rows', key: 'rows' }, notes.map((n, i) => h('div', { className: 'md-row', key: i }, [
            h('span', { className: 'md-status', key: 'k' }, n.kind),
            h('span', { className: 'md-row-main', key: 'm' }, [h('strong', { key: 't' }, n.title), n.body ? h('span', { key: 'b' }, short(n.body, 220)) : null]),
          ]))) : h('div', { className: 'md-empty', key: 'e' }, h('div', { className: 'md-empty-title' }, '还没有笔记'), '让助手提选题或写综述，成果会落在这里。')
        })(),
      ])

      const planView = h('div', { className: 'md-page', key: 'plan' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '计划'), h('p', { className: 'md-page-sub', key: 's' }, '把文献按阅读状态排成看板。')]),
        h('div', { className: 'md-board', key: 'board' }, [
          ['待读', papers.filter(p => !(p.chunks > 0))],
          ['已读全文', papers.filter(p => p.chunks > 0)],
          ['已放弃', papers.filter(p => p.status === 'dropped')],
        ].map(([label, list], ci) => h('div', { className: 'md-board-col', key: ci }, [
          h('header', { key: 'h' }, [h('h3', { key: 't' }, label), h('span', { className: 'md-dot', key: 'd' })]),
          h('div', { className: 'md-board-list', key: 'l' }, list.map(p => h('button', { className: 'md-board-card', key: p.id, onClick: () => setSelected(p) }, [
            h('strong', { key: 't' }, short(p.title, 70)),
            h('div', { className: 'md-board-meta', key: 'm' }, [h('span', { key: 's' }, sourceOf(p)), h('span', { key: 'y' }, p.year || '')]),
          ]))),
        ]))),
      ])

      const discoverView = h('div', { className: 'md-page', key: 'discover' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '发现'), h('p', { className: 'md-page-sub', key: 's' }, '从 arXiv / Europe PMC / OpenAlex 检索，逐条加入文献库。')]),
        h('form', { className: 'md-search', key: 'search', onSubmit: e => { e.preventDefault(); doSearch() } }, [
          I({ name: 'search', size: 15, key: 'ic' }),
          h('input', { key: 'in', value: query, onChange: e => setQuery(e.target.value), placeholder: '输入主题开始检索…', 'aria-label': '检索主题' }),
        ]),
        h('div', { style: { height: 14 }, key: 'sp' }),
        searchResults.length ? h('div', { className: 'md-table-wrap', key: 'tbl' }, h('table', { className: 'md-table' }, [
          h('thead', { key: 'th' }, h('tr', null, [h('th', { key: 'a' }, '文献'), h('th', { key: 'b' }, '来源'), h('th', { key: 'c' }, '')])),
          h('tbody', { key: 'tb' }, searchResults.map((p, i) => h('tr', { key: i }, [
            h('td', { key: 't' }, h('div', { className: 'md-table-title' }, [h('strong', { key: 's' }, short(p.title, 90)), h('small', { key: 'a' }, short(p.abstract, 140))])),
            h('td', { key: 'src' }, sourceOf(p)),
            h('td', { key: 'act' }, h('button', { className: 'md-btn is-small is-primary', disabled: busy !== '', onClick: () => addPapers([p]) }, '加入库')),
          ]))),
        ])) : h('div', { className: 'md-empty', key: 'e' }, '输入主题开始检索。检索结果可逐条加入文献库。'),
      ])

      const renderField = row => {
        const v = settingDraft[row.key]
        const set = next => setSettingDraft(prev => ({ ...prev, [row.key]: next }))
        let input
        if (row.type === 'bool') return h('div', { key: row.key, style: { display: 'flex', flexDirection: 'column', gap: 5 } }, [h('label', { className: 'md-check' }, [h('input', { type: 'checkbox', checked: !!v, onChange: e => set(e.target.checked) }), h('span', null, row.label)]), row.help ? h('small', { style: { color: 'var(--ink3)', fontSize: '11.5px', lineHeight: '16px' } }, row.help) : null])
        else if (row.type === 'enum') input = h('select', { key: 'i', value: v == null ? '' : v, onChange: e => set(e.target.value) }, (row.options || []).map(o => h('option', { key: o, value: o }, o)))
        else if (row.type === 'enumList') {
          const arr = Array.isArray(v) ? v : []
          input = h('div', { className: 'md-presets', key: 'i' }, (row.options || []).map(o =>
            h('button', { key: o, type: 'button', className: arr.includes(o) ? 'is-on' : '', onClick: () => set(arr.includes(o) ? arr.filter(x => x !== o) : arr.concat([o])) }, o)))
        } else input = h('input', { key: 'i', type: row.type === 'int' || row.type === 'float' ? 'number' : 'text', value: v == null ? '' : v, placeholder: row.secret ? '环境变量名' : '', onChange: e => set(e.target.value) })
        return h('label', { className: 'md-field', key: row.key }, [h('span', { key: 'l' }, row.label), input, row.help ? h('small', { key: 'h' }, row.help) : null])
      }
      const CLABEL = { paper: '文献', image: '图片', table: '表格', report: '报告', link: '网页', note: '笔记' }
      const CCOVER = x => x.cover || (x.kind === 'image' ? 'linear-gradient(160deg,#cfe3d6,#6f9d86 55%,#34524a)' : null)
      const DEFAULT_CONTENT_STATUS = { 'idea-p1': 'outline', 'idea-p2': 'draft', 'idea-i1': 'draft', 'idea-r1': 'ready', 'idea-r2': 'published', 'idea-n1': 'published' }
      const ADAPT = o => Object.assign({ cover: null, platform: '', scheduledAt: '', createdAt: o.at || '', source: '', tags: [], drafted: false, scripted: false }, o)
      const CONTENT_STAGES = [['idea', '灵感'], ['outline', '大纲'], ['draft', '草稿'], ['ready', '待发布'], ['published', '已发布']]
      const contentItems = [
        ...ideas.map(x => ADAPT({ id: x.id, title: short(x.text, 80), body: x.body || '', kind: x.kind, status: contentStatus[x.id] || DEFAULT_CONTENT_STATUS[x.id] || 'idea', cover: CCOVER(x), scheduledAt: schedule[x.id] || '', source: x.source || '', tags: [CLABEL[x.kind] || '笔记'], raw: x })),
        ...papers.map(p => ADAPT({ id: p.id, kind: '论文', title: p.title, body: short(p.abstract, 180), status: p.chunks > 0 ? 'draft' : 'idea', source: sourceOf(p), at: p.year || '', platform: 'arXiv', tags: ['文献'], raw: p })),
        ...(library.hypotheses || []).map(x => ADAPT({ id: x.id, kind: '选题', title: x.title, body: x.rationale || x.gap || '', status: 'outline', source: '选题', tags: ['选题'], raw: x })),
        ...(library.reviews || []).map(x => ADAPT({ id: x.id, kind: '综述', title: x.topic || '综述', body: '', status: 'ready', source: '综述', tags: ['综述'], drafted: true, raw: x })),
        ...(library.drafts || []).map(x => ADAPT({ id: x.id, kind: '草稿', title: x.title || '草稿', body: short(x.body, 180), status: 'draft', source: '写作', tags: ['草稿'], drafted: true, raw: x })),
      ]
      const cq = contentQuery.trim().toLowerCase()
      const shownContent = cq ? contentItems.filter(x => [x.title, x.body, x.source, x.platform, ...(x.tags || [])].some(v => String(v || '').toLowerCase().includes(cq))) : contentItems
      const contentCounts = CONTENT_STAGES.map(st => shownContent.filter(x => x.status === st[0]).length)
      const draftedCount = contentItems.filter(x => x.drafted || x.scripted).length
      const coverBg = c => /^(https?:|data:|blob:)/i.test(c) ? { backgroundImage: 'url("' + c + '")', backgroundSize: 'cover', backgroundPosition: 'center' } : { background: c }
      const isIdeaItem = x => ['paper', 'image', 'table', 'report', 'link', 'note'].indexOf(x.kind) >= 0
      const contentBoard = h('div', { className: 'md-board', key: 'board' }, CONTENT_STAGES.map(([sid, label]) => {
        const list = shownContent.filter(x => x.status === sid)
        return h('section', { key: sid, className: 'md-board-col' + (boardOver === sid ? ' is-over' : ''), 'aria-label': label,
          onDragOver: e => { e.preventDefault(); setBoardOver(sid) },
          onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setBoardOver(null) },
          onDrop: e => { e.preventDefault(); setBoardOver(null); const id = e.dataTransfer && e.dataTransfer.getData('text/research-desk-item'); if (id) setContentStatus(prev => Object.assign({}, prev, { [id]: sid })) }
        }, [
          h('header', { key: 'h' }, [h('span', { className: 'md-dot status-' + sid, key: 'd' }), h('h3', { key: 't' }, label), h('span', { className: 'md-muted', key: 'n' }, list.length)]),
          h('div', { className: 'md-board-list', key: 'l' }, list.map(x =>
            h('button', { className: 'md-board-card', key: x.id, type: 'button', draggable: true,
              onDragStart: e => { if (e.dataTransfer) { e.dataTransfer.setData('text/research-desk-item', x.id); e.dataTransfer.effectAllowed = 'move' } },
              onClick: () => openStudio(x.id, x)
            }, [
              x.cover ? h('div', { key: 'cv', style: Object.assign({ width: '100%', height: 92, borderRadius: 10, marginBottom: 6 }, coverBg(x.cover)) }) : null,
              h('strong', { key: 't' }, short(x.title, 70)),
              h('span', { className: 'md-board-meta', key: 'm' }, [
                x.platform ? h('span', { key: 'p' }, x.platform) : null,
                x.scheduledAt && sid !== 'published' ? h('span', { className: 'is-time', key: 'tm' }, x.scheduledAt) : null,
                x.drafted ? I({ name: 'pen', size: 12, key: 'pen' }) : null,
                x.scripted ? I({ name: 'film', size: 12, key: 'film' }) : null,
              ]),
            ]))),
        ])
      }))
      const CONTENT_COLS = [{ key: 'title', label: '内容', get: x => x.title }, { key: 'status', label: '状态', get: x => CONTENT_STAGES.findIndex(c => c[0] === x.status) }, { key: 'platform', label: '平台', get: x => x.platform || '' }, { key: 'scheduledAt', label: '排期', get: x => x.scheduledAt || '' }, { key: 'createdAt', label: '记录于', get: x => x.createdAt || '' }]
      const sortedContent = [...shownContent].sort((a, b) => {
        const col = CONTENT_COLS.find(c => c.key === contentSort.key) || CONTENT_COLS[0]
        const av = col.get(a), bv = col.get(b)
        return (av > bv ? 1 : av < bv ? -1 : 0) * contentSort.dir
      })
      const contentTable = h('div', { className: 'md-table-wrap', key: 'tbl' }, h('table', { className: 'md-table' }, [
        h('thead', { key: 'th' }, h('tr', null, CONTENT_COLS.map(c => h('th', { key: c.key, 'aria-sort': contentSort.key === c.key ? (contentSort.dir > 0 ? 'ascending' : 'descending') : 'none' },
          h('button', { type: 'button', onClick: () => setContentSort(st => ({ key: c.key, dir: st.key === c.key ? -st.dir : 1 })) }, c.label, contentSort.key === c.key ? I({ name: contentSort.dir > 0 ? 'chevD' : 'send', size: 11 }) : null))))),
        h('tbody', { key: 'tb' }, sortedContent.map(x => h('tr', { key: x.id, tabIndex: 0, onClick: () => openStudio(x.id, x), onKeyDown: e => { if (e.key === 'Enter') openStudio(x.id, x) } }, [
          h('td', { className: 'md-table-title', key: 't' }, [h('span', { className: 'md-thumb', key: 'th' }, x.cover ? h('span', { style: Object.assign({ width: '100%', height: '100%', display: 'block' }, coverBg(x.cover)) }) : h('span', null, x.title.slice(0, 1))), h('span', { key: 'w' }, [h('strong', { key: 's' }, x.title), h('small', { key: 'b' }, (CLABEL[x.kind] || x.kind) + (x.source ? ' · ' + x.source : ''))])]),
          h('td', { key: 'st' }, h('span', { className: 'md-status status-' + x.status }, (CONTENT_STAGES.find(c => c[0] === x.status) || [])[1])),
          h('td', { key: 'pf' }, x.platform || '—'), h('td', { className: 'md-nowrap', key: 'sc' }, x.scheduledAt || '—'), h('td', { className: 'md-nowrap', key: 'at' }, x.createdAt || '—'),
        ]))),
      ]))
      const contentView = h('div', { className: 'md-page', key: 'content' }, [
        h('header', { className: 'md-page-head', key: 'ph' }, [
          h('div', { key: 'l' }, [h('h1', { key: 'h' }, '内容'), h('p', { className: 'md-page-sub', key: 's' }, ['共 ' + contentItems.length + ' 条', contentCounts[0] + ' 个灵感待推进', draftedCount + ' 篇已成稿', contentCounts[4] + ' 篇已发布'].join(' · '))]),
          h('span', { style: { flex: 1 }, key: 'sp' }),
          h('label', { className: 'md-search', key: 'search' }, [I({ name: 'search', size: 15, key: 'i' }), h('input', { key: 'in', value: contentQuery, onChange: e => setContentQuery(e.target.value), placeholder: '搜索标题、标签、平台', 'aria-label': '搜索内容' })]),
          h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '显示方式', key: 'seg' }, [
            h('button', { key: 'b', type: 'button', role: 'radio', 'aria-checked': contentMode === 'board', className: contentMode === 'board' ? 'is-on' : '', onClick: () => setContentMode('board') }, [I({ name: 'wall', size: 15, key: 'i' }), h('span', { key: 'l' }, '看板')]),
            h('button', { key: 't', type: 'button', role: 'radio', 'aria-checked': contentMode === 'table', className: contentMode === 'table' ? 'is-on' : '', onClick: () => setContentMode('table') }, [I({ name: 'list', size: 15, key: 'i' }), h('span', { key: 'l' }, '表格')]),
          ]),
        ]),
        shownContent.length === 0
          ? h('div', { className: 'md-empty', key: 'empty' }, [h('p', { className: 'md-empty-title', key: 't' }, cq ? '没有匹配的内容' : '还没有内容'), h('p', { key: 'h' }, cq ? '换个关键词试试。' : '到灵感页记下第一条。')])
          : contentMode === 'board' ? contentBoard : contentTable,
      ])
      const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
      const WEEKS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const calYear = calMonth.getFullYear(), calMon = calMonth.getMonth()
      const firstDay = new Date(calYear, calMon, 1).getDay()
      const calCells = []
      for (let ci = 0; ci < 42; ci++) calCells.push(new Date(calYear, calMon, ci - firstDay + 1))
      const shownCells = calCells[28].getMonth() !== calMon ? calCells.slice(0, 28) : (calCells[35].getMonth() === calMon ? calCells : calCells.slice(0, 35))
      const byDay = {}
      for (const p of papers) { const day = schedule[p.id]; if (!day) continue; (byDay[day] = byDay[day] || []).push(p) }
      const monthPrefix = calYear + '-' + String(calMon + 1).padStart(2, '0')
      const monthCount = Object.entries(byDay).filter(e => e[0].startsWith(monthPrefix)).reduce((n, e) => n + e[1].length, 0)
      const calendar = h('section', { className: 'md-tile md-cal-tile', key: 'cal' }, [
        h('header', { className: 'md-cal-head', key: 'head' }, [
          h('div', { className: 'md-cal-num', key: 'num' }, String(calMon + 1).padStart(2, '0')),
          h('div', { className: 'md-cal-month', key: 'mon' }, [h('span', { key: 'y' }, calYear), h('em', { key: 'm' }, MONTHS[calMon])]),
          h('dl', { className: 'md-cal-stats', key: 'stats' }, [
            h('div', { key: 's1' }, [h('dt', { key: 'd' }, '本月排期'), h('dd', { key: 'v' }, [monthCount, h('small', { key: 'u' }, '篇')])]),
            h('div', { key: 's2' }, [h('dt', { key: 'd' }, '待精读'), h('dd', { key: 'v' }, [toRead, h('small', { key: 'u' }, '篇')])]),
          ]),
          h('span', { className: 'md-grow', key: 'grow' }),
          F({ key: 'prev', icon: 'chevL', label: '上个月', onClick: () => setCalMonth(new Date(calYear, calMon - 1, 1)) }),
          h('button', { type: 'button', className: 'md-pill is-small', key: 'today', onClick: () => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }, '今天'),
          F({ key: 'next', icon: 'chevR', label: '下个月', onClick: () => setCalMonth(new Date(calYear, calMon + 1, 1)) }),
        ]),
        h('div', { className: 'md-cal-weeks', key: 'weeks' }, WEEKS.map(w => h('span', { key: w }, w))),
        h('div', { className: 'md-cal-grid', role: 'grid', key: 'grid', style: { '--rows': shownCells.length / 7 } }, shownCells.map(d => {
          const day = isoDay(d), list = byDay[day] || [], isToday = day === isoDay(new Date())
          return h('div', { key: day, role: 'gridcell', className: 'md-cal-cell ' + (d.getMonth() !== calMon ? 'is-outside ' : '') + (isToday ? 'is-today' : ''),
            onDragOver: e => e.preventDefault(),
            onDrop: e => { e.preventDefault(); const id = e.dataTransfer.getData('text/research-desk-paper'); if (id) { setSchedule(prev => Object.assign({}, prev, { [id]: day })); notify('已排期到 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日。') } },
          }, [
            h('div', { className: 'md-cal-cell-top', key: 'top' }, [h('span', { className: 'md-cal-date', key: 'date' }, d.getDate())]),
            h('div', { className: 'md-cal-posts', key: 'posts' }, list.slice(0, 2).map(p =>
              h('button', { type: 'button', key: p.id, draggable: true, className: 'md-cal-chip status-new', title: p.title, onDragStart: e => e.dataTransfer.setData('text/research-desk-paper', p.id), onClick: () => setSelected(p) },
                h('span', { className: 'md-cal-chip-text', key: 't' }, short(p.title, 18)))),
              list.length > 2 ? h('span', { className: 'md-cal-more', key: 'more' }, '还有 ' + (list.length - 2) + ' 条') : null),
          ])
        })),
      ])
      const unscheduled = papers.filter(p => !schedule[p.id] && p.status !== 'dropped')
      const scheduled = papers.filter(p => schedule[p.id]).sort((a, b) => String(schedule[a.id]).localeCompare(String(schedule[b.id])))
      const nextItem = scheduled[0]
      const rail = h('aside', { className: 'md-rail-col', key: 'rail' }, [
        nextItem ? h('button', { type: 'button', className: 'md-next', key: 'next', onClick: () => { setSelected(nextItem); setView('discover') } }, [
          h('span', { className: 'md-next-top', key: 'top' }, [h('span', { key: 'l' }, '下一篇'), h('span', { key: 'd' }, schedule[nextItem.id])]),
          h('b', { key: 'b' }, schedule[nextItem.id]),
          h('p', { key: 't' }, short(nextItem.title, 60)),
        ]) : null,
        h('section', { className: 'md-tile md-tray', key: 'tray', 'aria-label': '待排期' }, [
          h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '待排期'), h('span', { className: 'md-tile-meta', key: 'm' }, '拖到日历上安排精读')]),
          h('div', { className: 'md-tray-scroll', key: 'scroll' }, [
            unscheduled.length ? h('div', { className: 'md-tray-list', key: 'list' }, unscheduled.slice(0, 30).map(p =>
              h('button', { type: 'button', key: p.id, draggable: true, className: 'md-tray-item', onDragStart: e => e.dataTransfer.setData('text/research-desk-paper', p.id), onClick: () => setSelected(p) },
                [h('span', { className: 'md-cal-thumb', key: 'th' }, h('span', null, p.title.slice(0, 1))), h('span', { key: 't' }, short(p.title, 60))])))
              : h('p', { className: 'md-tray-empty', key: 'empty' }, '加入文献后，从这里拖到日历上安排精读。'),
          ]),
        ]),
      ])
      const scheduleView = h('div', { className: 'md-board-page', key: 'schedule' }, h('div', { className: 'md-schedule', key: 's' }, [calendar, rail]))
      const reviewData = (library.reviews && library.reviews[0]) || null
      const insightMetrics = [
        { label: '在库文献', value: num(papers.length), unit: '篇' },
        { label: '已抓全文', value: num(fullCount), unit: '篇' },
        { label: '选题假设', value: num((library.hypotheses || []).length), unit: '条' },
        { label: '综述产出', value: num((library.reviews || []).length), unit: '篇' },
      ]
      const metric = m => h('div', { className: 'md-metric', key: m.label }, [h('dt', { key: 'd' }, m.label), h('dd', { key: 'v' }, [m.value, h('small', { key: 'u' }, m.unit)])])
      const bySource = [['arXiv', papers.filter(p => /arxiv/i.test(p.source || ''))], ['Europe PMC', papers.filter(p => /europepmc|pmc/i.test(p.source || ''))], ['OpenAlex', papers.filter(p => /openalex/i.test(p.source || ''))]].map(e => ({ name: e[0], value: e[1].length }))
      const maxSource = Math.max(1, ...bySource.map(s => s.value))
      const years = {}
      for (const p of papers) { const y = Number(p.year) || 0; if (y) years[y] = (years[y] || 0) + 1 }
      const yearKeys = Object.keys(years).map(Number).sort((a, b) => a - b).slice(-12)
      const maxYear = Math.max(1, ...yearKeys.map(k => years[k]))
      const pts = yearKeys.map((y, i) => [(i / Math.max(1, yearKeys.length - 1)) * 600, 180 - (years[y] / maxYear) * 150])
      const linePath = pts.length ? 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') : ''
      const areaPath = pts.length ? linePath + ' L600,180 L0,180 Z' : ''
      const trendChart = h('svg', { className: 'md-i-chart-svg', viewBox: '0 0 600 180', role: 'img', 'aria-label': '文献年份趋势' }, [
        h('path', { className: 'md-chart-area', key: 'a', d: areaPath }),
        h('path', { className: 'md-chart-line', key: 'l', d: linePath }),
      ])
      const trendTable = h('div', { className: 'md-i-table' }, h('table', { className: 'md-table is-plain' }, [
        h('thead', { key: 'th' }, h('tr', null, [h('th', { key: 'y' }, '年份'), h('th', { key: 'n' }, '文献数')])),
        h('tbody', { key: 'tb' }, (yearKeys.length ? yearKeys : [0]).map(y => h('tr', { key: y }, [h('td', { key: 'yy' }, y || '—'), h('td', { key: 'nn' }, years[y] || 0)]))),
      ]))
      const trend = h('section', { className: 'md-tile md-i-trend', key: 'trend' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '文献年份分布'), h('span', { className: 'md-grow', key: 'sp' }), h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '趋势显示', key: 'seg' }, [h('button', { key: 'c', type: 'button', role: 'radio', 'aria-checked': insightMode === 'chart', className: insightMode === 'chart' ? 'is-on' : '', onClick: () => setInsightMode('chart') }, '图'), h('button', { key: 't', type: 'button', role: 'radio', 'aria-checked': insightMode === 'table', className: insightMode === 'table' ? 'is-on' : '', onClick: () => setInsightMode('table') }, '表')])]),
        insightMode === 'chart' ? trendChart : trendTable,
      ])
      const platforms = h('section', { className: 'md-tile md-i-platforms', key: 'pl' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, h('h2', null, '来源分布')),
        h('ul', { className: 'md-bars', key: 'b' }, bySource.map(s => h('li', { key: s.name }, [h('span', { className: 'md-bar-name', key: 'n' }, s.name), h('b', { key: 'v' }, s.value), h('span', { className: 'md-bar-track', key: 't' }, h('i', { style: { width: (s.value / maxSource * 100) + '%' } }))]))),
      ])
      const topPapers = [...papers].sort((a, b) => (b.citedBy || 0) - (a.citedBy || 0)).slice(0, 6)
      const topLi = (p, i) => h('li', { key: p.id }, [
        h('span', { className: 'md-top-rank', key: 'r' }, i + 1),
        h('span', { className: 'md-thumb', key: 'th' }, h('span', null, p.title.slice(0, 1))),
        h('span', { className: 'md-top-title', key: 't' }, [
          h('b', { key: 'b' }, short(p.title, 70)),
          h('small', { key: 's' }, sourceOf(p) + ' · 被引 ' + (p.citedBy || 0)),
        ]),
      ])
      const top = h('section', { className: 'md-tile md-i-top', key: 'top' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, h('h2', null, '高影响文献')),
        topPapers.length ? h('ol', { className: 'md-top', key: 'ol' }, topPapers.map(topLi))
          : h('p', { className: 'md-muted', key: 'e' }, '加入文献后，这里按被引量排序。'),
      ])
      const advice = h('section', { className: 'md-tile md-i-advice', key: 'advice' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '研究建议'), h('span', { className: 'md-grow', key: 'sp' }), h('button', { type: 'button', className: 'md-pill is-small', key: 'again', disabled: busy !== '', onClick: () => send('给我几个可做的选题') }, [I({ name: 'spark', size: 13, key: 'i' }), '重新分析'])]),
        reviewData && (reviewData.sections || []).length ? h('div', { className: 'md-i-advice-list', key: 'txt' }, reviewData.sections.map((s, i) => h('p', { key: i }, [h('b', { key: 'l' }, '【' + (s.label || s.key || ('要点' + (i + 1))) + '】 '), s.text || ''])))
          : reviewData ? h('div', { className: 'md-i-advice-list', key: 'txt' }, h('p', null, short(reviewData.topic || '', 200) || '已生成研究建议。'))
          : h('p', { className: 'md-muted', key: 'e' }, '在助手里说「梳理这个主题的综述」或「给我几个可做的选题」，复盘会汇总在这里。'),
      ])
      const insightsView = papers.length ? h('div', { className: 'md-board-page', key: 'insights' }, h('div', { className: 'md-insights', key: 'in' }, [
        h('section', { className: 'md-tile md-i-hero', key: 'hero' }, [h('div', { className: 'md-hero-copy', key: 'c' }, [
          h('h1', { className: 'md-i-line', key: 't' }, ['你的研究，', h('b', { key: 'b' }, '正在成形'), '。']),
          h('div', { className: 'md-hero-actions', key: 'a' }, [
            h('button', { type: 'button', className: 'md-pill', key: 'seed', disabled: busy !== '', onClick: seed }, [I({ name: 'spark', size: 14, key: 'i' }), '示例数据']),
            h('button', { type: 'button', className: 'md-pill', key: 'ask', disabled: busy !== '', onClick: () => send('给我几个可做的选题') }, [I({ name: 'pen', size: 14, key: 'i' }), '推选题']),
            h('button', { type: 'button', className: 'md-pill', key: 'export', disabled: busy !== '', onClick: doExport }, [I({ name: 'upload', size: 14, key: 'i' }), '导出复盘']),
          ]),
        ]), h('dl', { className: 'md-metrics', key: 'm' }, insightMetrics.map(metric))]),
        trend, platforms, top, advice,
      ])) : h('div', { className: 'md-board-page', key: 'insights' }, h('section', { className: 'md-tile md-i-hero is-empty', key: 'empty' }, [
        h('div', { className: 'md-hero-copy', key: 'c' }, [h('h1', { className: 'md-i-line', key: 't' }, '复盘，从第一条文献开始。'), h('p', { className: 'md-muted', key: 'p' }, '加入文献并让助手产出综述后，这里会汇总趋势、来源分布与研究建议。')]),
      ]))
      const allStyles = ALL_STYLES.concat(customStyles)
      const ownStyles = customStyles
      const presetStyles = allStyles.filter(s => s.preset)
      const presentCats = STYLE_CATS.filter(c => presetStyles.some(s => s.category === c))
      const shownCats = styleFilter === '全部' ? presentCats : presentCats.filter(c => c === styleFilter)
      const toggleRule = id => setRules(prev => prev.map(r => r.id === id ? Object.assign({}, r, { off: !r.off }) : r))
      const ruleItem = r => h('li', { className: 'md-rule' + (r.off ? ' is-off' : ''), key: r.id }, [
        h('button', { type: 'button', className: 'md-check', 'aria-label': (r.off ? '启用 ' : '停用 ') + r.label, onClick: () => toggleRule(r.id) }, [I({ name: r.off ? 'check' : 'close', size: 13 })]),
        h('span', { key: 't' }, r.label),
        r.builtin ? null : F({ key: 'x', icon: 'trash', label: '删除规则', onClick: () => setRules(prev => prev.filter(x => x.id !== r.id)) }),
      ])
      const saveCapture = () => {
        const text = captureTab === 'url' ? captureUrl.trim() : captureText.trim()
        if (!text) { notify('先贴点内容或链接。', true); return }
        const id = 'custom-' + Date.now()
        const st = { id, name: captureName.trim() || (captureTab === 'url' ? '链接风格' : '我的风格'), preset: false, category: '我的风格', source: captureTab === 'url' ? '链接' : '贴内容', icon: '✍️', summary: captureTab === 'url' ? short(captureUrl, 90) : short(captureText, 90), samples: captureTab === 'url' ? [] : [short(captureText, 180)] }
        setCustomStyles(prev => prev.concat([st]))
        setActiveStyle(id); setCapture(null); setCaptureText(''); setCaptureUrl(''); setCaptureName('')
        notify('已提炼风格：' + st.name + '。')
      }
      const captureDialog = capture ? h(Dialog, { key: 'capdlg', title: capture === 'text' ? '贴内容' : capture === 'url' ? '贴链接' : '从笔记提炼', onClose: () => setCapture(null), width: 480 }, [
        h('div', { className: 'md-form', key: 'f' }, [
          h('div', { className: 'md-form-tabs', key: 'tabs' }, [['text', '贴内容'], ['url', '贴链接'], ['note', '从笔记提炼']].map(([k, l]) => h('button', { key: k, type: 'button', className: captureTab === k ? 'is-on' : '', onClick: () => setCaptureTab(k) }, l))),
          h('label', { className: 'md-field', key: 'name' }, [h('span', null, '风格名称'), h('input', { value: captureName, onChange: e => setCaptureName(e.target.value), placeholder: '例如：我的综述风格' })]),
          captureTab === 'url'
            ? h('label', { className: 'md-field', key: 'url' }, [h('span', null, '文章链接'), h('input', { value: captureUrl, onChange: e => setCaptureUrl(e.target.value), placeholder: 'https://…' })])
            : h('label', { className: 'md-field', key: 'txt' }, [h('span', null, captureTab === 'note' ? '从哪条笔记提炼？' : '粘贴一段你写的文字'), h('textarea', { rows: 5, value: captureTab === 'note' ? (papers[0] ? papers[0].title : '') : captureText, onChange: e => captureTab === 'note' ? setCaptureName(e.target.value) : setCaptureText(e.target.value), placeholder: '贴一段文字，助手会按你的写法来写。' })]),
          h('div', { className: 'md-form-foot', key: 'foot' }, [h('button', { className: 'md-btn is-primary', key: 'save', onClick: saveCapture }, '提炼为风格'), h('button', { className: 'md-btn', key: 'cancel', onClick: () => setCapture(null) }, '取消')]),
        ]),
      ]) : null
      const styleCard = (s, i) => {
        const active = activeStyle === s.id
        return h('article', { className: 'md-style' + (active ? ' is-active' : ''), key: s.id }, [
          h('header', { key: 'h' }, [
            h('span', { className: 'md-style-icon tone-' + (hashCode(s.id) % 6), key: 'ic', 'aria-hidden': 'true' }, s.icon || '✍️'),
            h('div', { key: 'n' }, [h('strong', { key: 's' }, s.name), h('small', { key: 'd' }, active ? '正在使用' : (s.preset ? s.category : (s.source || '手动')))]),
            h('span', { className: 'md-grow', key: 'sp' }),
            s.preset ? null : F({ key: 'del', icon: 'trash', label: '删除「' + s.name + '」', onClick: () => { setCustomStyles(prev => prev.filter(x => x.id !== s.id)); if (active) setActiveStyle('') } }),
          ]),
          s.summary ? h('p', { className: 'md-style-summary', key: 'sum' }, s.summary) : null,
          s.samples && s.samples[0] ? h('blockquote', { key: 'q' }, s.samples[0]) : null,
          h('footer', { key: 'f' }, h('button', { type: 'button', className: 'md-pill is-small' + (active ? '' : ' is-primary'), key: 'use', onClick: () => { setActiveStyle(active ? '' : s.id); notify(active ? '已取消使用「' + s.name + '」。' : '现在按「' + s.name + '」写作。') } }, active ? '不用了' : '用这个写')),
        ])
      }
      const styleSection = (label, list, key) => list.length ? h('section', { className: 'md-style-section', 'aria-label': label, key }, [
        h('h2', { key: 'h' }, label),
        h('div', { className: 'md-style-grid', key: 'g', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' } }, list.map(styleCard)),
      ]) : null
      const styleView = h('div', { className: 'md-board-page', key: 'style' }, h('div', { className: 'md-style-page', key: 'sp' }, [
        h('section', { className: 'md-tile md-i-hero md-style-hero', key: 'hero' }, [h('div', { className: 'md-hero-copy', key: 'c' }, [
          h('h1', { className: 'md-i-line', key: 't' }, activeStyle
            ? ['现在按 ', h('span', { className: 'md-inline-emoji', key: 'e' }, (allStyles.find(s => s.id === activeStyle) || {}).icon || '✍️'), ' ', h('b', { key: 'b' }, (allStyles.find(s => s.id === activeStyle) || {}).name || ''), ' 的风格写。']
            : ['选一种科研写作风格直接开写，', h('br', { key: 'br' }), '或者从你的笔记里提炼自己的风格。']),
          h('div', { className: 'md-hero-actions', key: 'a' }, [
            h('button', { type: 'button', className: 'md-pill is-primary', key: 'note', onClick: () => { setCapture('note'); setCaptureTab('note') } }, [I({ name: 'user', size: 14, key: 'i' }), '从笔记提炼']),
            h('button', { type: 'button', className: 'md-pill', key: 'text', onClick: () => { setCapture('text'); setCaptureTab('text') } }, [I({ name: 'pen', size: 14, key: 'i' }), '贴内容']),
            h('button', { type: 'button', className: 'md-pill', key: 'url', onClick: () => { setCapture('url'); setCaptureTab('url') } }, [I({ name: 'link', size: 14, key: 'i' }), '贴链接']),
          ]),
        ])]),
        styleSection('我的风格', ownStyles, 'mine'),
        h('div', { className: 'md-style-filter', role: 'tablist', 'aria-label': '写作类型', key: 'filter' }, ['全部'].concat(presentCats).map(c => h('button', { key: c, type: 'button', role: 'tab', 'aria-selected': styleFilter === c, className: styleFilter === c ? 'is-on' : '', onClick: () => setStyleFilter(c) }, c))),
        styleSection(styleFilter === '全部' ? '预设风格' : styleFilter, styleFilter === '全部' ? presetStyles : presetStyles.filter(s => s.category === styleFilter), 'presets'),
        h('section', { className: 'md-tile md-rules', key: 'rules' }, [
          h('header', { className: 'md-tile-head', key: 'h' }, [
            h('h2', { key: 't' }, '写作规则'), h('span', { className: 'md-tile-meta', key: 'm' }, '每种风格都会遵守'), h('span', { className: 'md-grow', key: 'sp' }),
            h('button', { type: 'button', className: 'md-pill is-small', key: 'learn', disabled: busy !== '', onClick: () => send('整理我的写作规则') }, [I({ name: 'spark', size: 13, key: 'i' }), '从数据中学习']),
            h('button', { type: 'button', className: 'md-pill is-small', key: 'skill', disabled: busy !== '', onClick: doExport }, [I({ name: 'bolt', size: 13, key: 'i' }), '导出为 Skill']),
          ]),
          h('ul', { key: 'ul' }, rules.map(ruleItem).concat([(!rules.length) ? h('li', { className: 'md-muted md-rule-empty', key: 'e' }, '在对话里说「以后标题都不要超过 20 个字」，这里就会多一条。') : null])),
        ]),
      ]), captureDialog)

      const settingsDialog = showSettings ? h(Dialog, { key: 'setdlg', title: '设置', onClose: () => setShowSettings(false), width: 520 },
        h('div', { className: 'md-form', key: 'f' }, [
          ...settingRows.filter(r => r.key !== 'model.route').map(renderField),
          h('div', { className: 'md-form-foot', key: 'foot' }, [
            h('button', { className: 'md-btn is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
            h('button', { className: 'md-btn', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
          ]),
        ])) : null
      const modelDialog = modelPickOpen ? h(Dialog, { key: 'mdldlg', title: '助手模型', onClose: () => setModelPickOpen(false), width: 480 },
        h('div', { className: 'md-form', key: 'f' }, [
          h('div', { className: 'md-field', key: 'df' }, [
            h('div', { className: 'md-presets', key: 'p' }, h('button', { type: 'button', key: 'follow', disabled: busy === 'model', className: model ? '' : 'is-on', onClick: () => setModelRoute('') }, '跟随默认')),
            h('small', { key: 'tip' }, '不指定时，助手跟随 DeepSeek Harness 的默认模型。'),
          ]),
          ...(models.length ? models.map((m, i) => h('div', { className: 'md-field', key: 'f' + i }, [
            h('span', { key: 'n' }, m.provider || '模型'),
            h('div', { className: 'md-presets', key: 'p' }, h('button', { type: 'button', key: 'm', disabled: busy === 'model', className: model === modelRouteOf(m) ? 'is-on' : '', onClick: () => setModelRoute(modelRouteOf(m)) }, m.label || modelRouteOf(m))),
          ])) : [h('p', { className: 'md-muted', key: 'none' }, '正在读取可用模型…')]),
        ])) : null

      const ideaCapTabs = [['note', '笔记'], ['quote', '金句'], ['link', '链接'], ['file', '图片/视频']]
      const saveIdeaCapture = () => {
        const v = ideaCapText.trim()
        if (ideaCapTab === 'link') { if (!v) return; addIdea(v, 'link') }
        else if (ideaCapTab === 'file') return
        else { if (!v) return; addIdea(v, ideaCapTab === 'quote' ? 'report' : 'note') }
        setIdeaCapOpen(false); setIdeaCapText('')
      }
      const ideaCaptureDialog = ideaCapOpen ? h(Dialog, { key: 'ideaCap', title: '记下一个灵感', onClose: () => setIdeaCapOpen(false), width: 480 },
        h('div', { className: 'md-capture-tabs', role: 'tablist', key: 'tabs' }, ideaCapTabs.map(([k, l]) =>
          h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': ideaCapTab === k, className: ideaCapTab === k ? 'is-on' : '', onClick: () => { setIdeaCapTab(k); setIdeaCapText('') } }, l))),
        h('form', { className: 'md-form', key: 'form', onSubmit: e => { e.preventDefault(); saveIdeaCapture() } }, [
          ideaCapTab === 'link'
            ? h('label', { className: 'md-field', key: 'f' }, [h('span', { key: 's' }, '链接'), h('input', { type: 'url', required: true, value: ideaCapText, onChange: e => setIdeaCapText(e.target.value), placeholder: 'https://' }), h('small', { key: 'sm' }, '会自动读取页面的标题、简介和封面。')])
            : ideaCapTab === 'file'
            ? h('button', { type: 'button', className: 'md-dropzone', key: 'f', onClick: () => { const inp = document.querySelector && document.querySelector('#rd-idea-file'); if (inp) inp.click() } }, [I({ name: 'upload', size: 22, key: 'i' }), h('span', { key: 't' }, '选择图片或视频'), h('small', { key: 'sm' }, '也可以直接把文件拖到灵感墙上'), h('input', { id: 'rd-idea-file', type: 'file', hidden: true, multiple: true, accept: 'image/*,video/*', onChange: e => { const files = [].slice.call(e.target.files || []); files.forEach(f => addIdea(f.name, 'image')); setIdeaCapOpen(false) } })])
            : h('label', { className: 'md-field', key: 'f' }, [h('span', { key: 's' }, ideaCapTab === 'quote' ? '这句话' : '想法'), h('textarea', { rows: 4, required: true, value: ideaCapText, onChange: e => setIdeaCapText(e.target.value), placeholder: ideaCapTab === 'quote' ? '好的选题不是想出来的……' : '想到什么就写什么，之后再让助手补全。' })]),
          ideaCapTab === 'file' ? null : h('div', { className: 'md-form-foot', key: 'foot' }, [h('span', { style: { flex: 1 }, key: 'sp' }), h('button', { type: 'button', className: 'md-btn', key: 'cancel', onClick: () => setIdeaCapOpen(false) }, '取消'), h('button', { type: 'submit', className: 'md-btn is-primary', key: 'save' }, '放到灵感墙')]),
        ])) : null

      const suggestions = ['梳理这个主题的综述', '找出还没解决的问题', '给我几个可做的选题']
      const dockResizeDown = e => {
        if (e.button !== 0) return
        e.preventDefault(); e.stopPropagation()
        const el = e.currentTarget, sx = e.clientX, sw = dockW
        const maxW = Math.max(280, Math.min(700, Math.round(width * 0.7)))
        const move = ev => setDockW(Math.max(280, Math.min(maxW, Math.round(sw + (sx - ev.clientX)))))
        const up = () => { el.classList.remove('is-drag'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
        el.classList.add('is-drag')
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId) } catch (err) {}
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
      }
      const dock = h('aside', { className: 'md-dock', key: 'dock' }, [
        h('div', { className: 'md-dock-resizer', key: 'rz', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': '拖拽调整助手栏宽度', title: '拖拽调整宽度', onPointerDown: dockResizeDown }),
        h('div', { className: 'md-dock-head', 'data-window-drag': '', key: 'dh' }, [
          h('h2', { key: 't' }, '助手'),
          h('span', { className: 'md-engine' + (model ? ' is-live' : ''), key: 'e' }, [h('i', { key: 'i' }), modelLabel]),
          F({ key: 'x', icon: 'close', label: '收起对话', onClick: () => setDockOpen(false) }),
        ]),
        h('div', { className: 'md-dock-scroll', 'aria-live': 'polite', key: 'ds' }, [
          msgs.length ? msgs.map((m, i) => h('div', { className: 'md-msg ' + (m.role === 'me' ? 'is-user' : 'is-bot'), key: 'm' + i }, m.text)) : null,
          msgs.length ? null : h('div', { className: 'md-dock-intro', key: 'intro' }, [
            h('h3', { key: 'h' }, ['说一个研究问题，', h('br', { key: 'br' }), '剩下的我来补全。']),
            h('p', { key: 'p' }, '选题、检索、精读、写作标准和核验，都可以直接说。每一步都能撤销。'),
          ]),
          busy === 'assistant' ? h('span', { className: 'md-shimmer', key: 'busy' }, '正在处理……') : null,
          h('div', { className: 'md-suggest', key: 'sug' }, suggestions.slice(0, msgs.length ? 2 : 4).map(s =>
            h('button', { key: s, type: 'button', disabled: busy !== '', onClick: () => send(s) }, s))),
        ]),
        h('form', { className: 'md-composer', key: 'comp', onSubmit: e => { e.preventDefault(); send(input) } }, [
          h('textarea', { key: 'ta', rows: 1, 'aria-label': '给助手发消息', value: input, placeholder: '想改什么，直接说',
            onChange: e => setInput(e.target.value),
            onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } } }),
          h('button', { key: 'send', type: 'submit', className: 'md-send', 'aria-label': '发送', disabled: !input.trim() || busy !== '' }, I({ name: 'send', size: 15 })),
        ]),
      ])

      const ideaCount = ideas.length
      const scheduledCount = Object.keys(schedule).length
      const IDEA_KINDS = [['all', '全部'], ['paper', '文献'], ['image', '图片'], ['table', '表格'], ['report', '报告'], ['link', '网页'], ['note', '笔记']]
      const IDEA_LABEL = { paper: '文献', image: '图片', table: '表格', report: '报告', link: '网页', note: '笔记' }
      const coverOf = x => x.cover || (x.kind === 'image' ? 'linear-gradient(160deg,#cfe3d6,#6f9d86 55%,#34524a)' : null)
      const ideaCardBody = (x, extra) => {
        const kind = x.kind || 'note'
        const label = IDEA_LABEL[kind] || '笔记'
        const cover = coverOf(x)
        const isNote = kind === 'note' || kind === 'report'
        const art = { className: 'md-card kind-' + kind + ' is-idea', role: 'button', tabIndex: 0, onClick: () => openStudio(x.id, x), onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStudio(x.id, x) } } }
        Object.assign(art, extra || {})
        return h('article', art, [
          cover ? h('div', { className: 'md-card-media', key: 'm' }, h('div', { className: 'md-media-fallback', style: { background: cover, aspectRatio: '4 / 3' } })) : null,
          isNote
            ? h('div', { className: 'md-card-note', key: 'n' }, [h('span', { className: 'md-card-rel', key: 'r' }, label), h('h3', { key: 't' }, short(x.text, 80)), x.body ? h('p', { key: 'b' }, x.body) : null])
            : h('div', { className: 'md-card-caption', key: 'c' }, [h('span', { className: 'md-card-rel', key: 'r' }, label), h('h3', { key: 't' }, short(x.text, 60))]),
          h('footer', { className: 'md-card-foot', key: 'f' }, [h('span', { className: 'md-dot status-idea', key: 'd' }), h('span', { className: 'md-card-source', key: 's' }, x.source || label), h('span', { className: 'md-card-time', key: 'ti' }, x.at || '')]),
        ])
      }
      const svgCover = (c1, c2) => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs><rect width="72" height="72" fill="url(#g)"/></svg>')
      const inlinePic = src => src ? h('img', { className: 'md-inline-pic', src, alt: '', draggable: false }) : h('span', { className: 'md-inline-pic is-empty' })
      const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const feedFilmstrip = h('div', { className: 'md-ministamps', key: 'film' }, [
        h('div', { className: 'md-ministamps-row', key: 'row' }, (() => {
          const cells = []
          for (let r = 9; r >= 0; r--) {
            const d = new Date(); d.setDate(d.getDate() - r)
            const dayKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
            const dayIdeas = ideas.filter(x => (x.at || '').slice(0, 10) === dayKey)
            const img = dayIdeas.map(x => coverOf(x)).find(Boolean)
            const kindChar = ({ paper: '文', image: '图', table: '表', report: '告', link: '链', note: '记' })[dayIdeas[0] && dayIdeas[0].kind] || '记'
            cells.push(h('button', { key: dayKey, type: 'button', className: 'md-stamp ' + (r === 0 ? 'is-today' : img ? 'is-type' : 'is-blank'), 'aria-label': (d.getMonth() + 1) + '月' + d.getDate() + '日', onClick: r === 0 ? () => setIdeaCapOpen(true) : dayIdeas[0] ? () => openStudio(dayIdeas[0].id, dayIdeas[0]) : undefined },
              img ? h('span', { style: { width: '100%', height: '100%', display: 'block', background: img } }) : r === 0 ? I({ name: 'plus', size: 16 }) : dayIdeas.length ? kindChar : null,
              dayIdeas.length > 1 ? h('i', null, String(dayIdeas.length)) : null))
          }
          return cells
        })()),
        h('button', { type: 'button', className: 'md-ministamps-more', key: 'more', title: '打开排期', 'aria-label': '打开排期', onClick: () => setView('schedule') }, I({ name: 'upRight', size: 14 })),
      ])
      const ideaHero = h('div', { className: 'md-hero', key: 'ih', onPointerDown: e => e.stopPropagation() }, [
        h('p', { className: 'md-hero-date', key: 'date' }, [String(new Date().getFullYear()), ' · ', (new Date().getMonth() + 1) + ' 月 ' + new Date().getDate() + ' 日', ' · ', WEEKDAYS[new Date().getDay()]]),
        h('h1', { className: 'md-hero-line', key: 'l' }, [
          '还有 ', inlinePic(svgCover('#efe7d6', '#c9bfa8')), h('b', { key: 'a' }, ideas.length + ' 个灵感'), ' 等你成稿，', h('br', { key: 'b1' }),
          inlinePic(svgCover('#cfe0d0', '#6f9d86')), h('b', { key: 'b' }, scheduledCount + ' 条内容'), ' 排在本周，', h('br', { key: 'b2' }),
          '你已经连续记录 ', h('b', { key: 'c', className: 'md-hero-streak' }, '0'), ' 天。',
        ]),
        h('form', { className: 'md-hero-input', key: 'f', onSubmit: e => { e.preventDefault(); addIdea(ideaInput); setIdeaInput('') } }, [
          I({ name: 'spark', size: 16, key: 'i' }),
          h('input', { key: 'in', value: ideaInput, onChange: e => setIdeaInput(e.target.value), placeholder: '记下一个灵感，或贴一个链接', 'aria-label': '记下灵感' }),
          h('button', { key: 'go', type: 'submit', className: 'md-send', 'aria-label': '记下灵感', disabled: !ideaInput.trim() }, I({ name: 'send', size: 15 })),
        ]),
        feedFilmstrip,
      ])
      const shownIdeas = ideas.filter(x => kindFilter === 'all' || (x.kind || 'note') === kindFilter)
      const ideaCard = (idea, i) => {
        const key = 'idea-' + idea.id
        const pos = positions[key] || (isNarrow
          ? { px: 120 + (i % 2) * 190, py: 560 + Math.floor(i / 2) * 150, r: ((i * 29) % 9) - 4, d: 0.74 }
          : { px: 180 + (i % 4) * 250, py: 360 + Math.floor(i / 4) * 170, r: ((i * 31) % 11) - 5, d: 1 })
        const style = { '--px': pos.px + 'px', '--py': pos.py + 'px', '--r': pos.r + 'deg', '--d': pos.d }
        const down = e => {
          if (e.button !== 0) return
          e.stopPropagation()
          const sx = e.clientX, sy = e.clientY, el = e.currentTarget, base = pos, nd = base.d || 1, moved = { v: false }
          const node = el.closest('.md-node'); if (node) node.classList.add('is-dragging')
          const move = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved.v && Math.abs(dx) + Math.abs(dy) < 4) return; moved.v = true; setPositions(prev => Object.assign({}, prev, { [key]: Object.assign({}, base, { px: base.px + dx / nd, py: base.py + dy / nd }) })) }
          const up = () => { const n = el.closest('.md-node'); if (n) n.classList.remove('is-dragging'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); if (!moved.v) openStudio(idea.id) }
          try { el.setPointerCapture && el.setPointerCapture(e.pointerId) } catch (err) {}
          el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
        }
        return h('div', { className: 'md-node', key, style }, [
          h('div', { className: 'md-pop' }, [
            h('div', { style: { width: isNarrow ? 170 : 230 }, onPointerDown: down }, [ideaCardBody(idea)]),
          ]),
        ])
      }
      const ideaDockbar = h('div', { className: 'md-dockbar', role: 'toolbar', 'aria-label': '灵感视图', key: 'bar' }, [
        h('div', { className: 'md-seg', key: 'seg' }, [
          h('button', { key: 's', type: 'button', 'aria-label': '散落', title: '散落', className: mode === 'scatter' ? 'is-on' : '', onClick: () => setMode('scatter') }, I({ name: 'scatter', size: 16, key: 'i' })),
          h('button', { key: 'w', type: 'button', 'aria-label': '信息流', title: '信息流', className: mode === 'wall' ? 'is-on' : '', onClick: () => setMode('wall') }, I({ name: 'wall', size: 16, key: 'i' })),
        ]),
        h('span', { className: 'md-dockbar-sep', key: 'sp1' }),
        h('div', { className: 'md-chips', key: 'chips' }, IDEA_KINDS.map(([k, l]) =>
          h('button', { key: k, type: 'button', className: kindFilter === k ? 'is-on' : '', onClick: () => setKindFilter(k) }, l))),
        h('span', { className: 'md-dockbar-sep', key: 'sp2' }),
        h('button', { className: 'md-round is-primary', key: 'add', 'aria-label': '记一条灵感', title: '记一条灵感', onClick: () => setIdeaCapOpen(true) }, I({ name: 'plus', size: 18 })),
      ])
      const ideaScatter = h('div', { className: 'md-home', key: 'ideas' }, [
        h('div', { className: 'md-stage', key: 'stage', onPointerDown: stagePointerDown,
          style: { '--grid-size': (28 * (isNarrow ? 0.72 : 1)) + 'px', '--grid-x': pan.x + 'px', '--grid-y': pan.y + 'px' } }, [
          h('div', { className: 'md-world', key: 'world', style: { transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' } }, [
            h('div', { className: 'md-hero-anchor', key: 'ha', style: { left: isNarrow ? Math.round(width / 2) : 400, top: isNarrow ? 200 : 220 } }, ideaHero),
            ...shownIdeas.map(ideaCard),
          ]),
        ]),
        h('div', { className: 'md-toolrow md-toolrow-right', key: 'zoom', onPointerDown: e => e.stopPropagation() }, [
          F({ key: 'zo', icon: 'zoomOut', label: '缩小', onClick: () => setZoom(z => Math.max(0.4, Math.round(z * 0.8 * 100) / 100)) }),
          F({ key: 'tg', icon: 'target', label: '回到中心', onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }) } }),
          F({ key: 'zi', icon: 'zoomIn', label: '放大', onClick: () => setZoom(z => Math.min(2.5, Math.round(z * 1.25 * 100) / 100)) }),
        ]),
      ])
      const feedHero = h('div', { className: 'md-hero', key: 'fh', onPointerDown: e => e.stopPropagation() }, [
        h('p', { className: 'md-hero-date', key: 'date' }, [String(new Date().getFullYear()), ' · ', (new Date().getMonth() + 1) + ' 月 ' + new Date().getDate() + ' 日', ' · ', WEEKDAYS[new Date().getDay()]]),
        h('h1', { className: 'md-hero-line', key: 'line' }, [
          '还有 ', inlinePic(svgCover('#efe7d6', '#c9bfa8')), h('b', { key: 'a' }, ideas.length + ' 个灵感'), ' 等你成稿，', h('br', { key: 'b1' }),
          inlinePic(svgCover('#cfe0d0', '#6f9d86')), h('b', { key: 'b' }, scheduledCount + ' 条内容'), ' 排在本周，', h('br', { key: 'b2' }),
          '你已经连续记录 ', h('b', { key: 'c', className: 'md-hero-streak' }, '0'), ' 天。',
        ]),
        h('form', { className: 'md-hero-input', key: 'form', onSubmit: e => { e.preventDefault(); addIdea(ideaInput); setIdeaInput('') } }, [
          I({ name: 'spark', size: 16, key: 'i' }),
          h('input', { key: 'in', value: ideaInput, onChange: e => setIdeaInput(e.target.value), placeholder: '记下一个灵感，或贴一个链接', 'aria-label': '记下灵感' }),
          h('button', { key: 'go', type: 'submit', className: 'md-send', 'aria-label': '记下', disabled: !ideaInput.trim() }, I({ name: 'send', size: 15 })),
        ]),
        feedFilmstrip,
      ])
      const feedCard = (x, idx) => h('div', { key: x.id, className: 'md-wall-cell', style: { animationDelay: Math.min(idx * 22, 400) + 'ms' } }, [ideaCardBody(x)])
      const ideaList = h('div', { className: 'md-wall-scroll', key: 'ideaFeed' }, [
        h('div', { className: 'md-feed-hero', key: 'fh' }, feedHero),
        shownIdeas.length ? h('div', { className: 'md-wall', key: 'wall' }, shownIdeas.map(feedCard)) : h('div', { className: 'md-empty', key: 'e' }, '还没有灵感。用输入框记一条。'),
      ])
      const ideaHome = h('div', { className: 'md-home', key: 'ideaHome' }, [mode === 'wall' ? ideaList : ideaScatter, ideaDockbar])
      const ideaGallery = ideaHome
      const studioIdea = studioItem || ideas.find(x => x.id === studioId) || ideas[0]
      const studioTitle = studioItem ? short(studioItem.title || studioItem.text || '', 46) : studioIdea ? short(studioIdea.text, 46) : '一条新灵感'
      const shotLines = ['开场 · 抛出问题', '背景 · 现有做法', '痛点 · 关键缺口', '方法 · 我的思路', '证据 · 结果与边界', '收尾 · 一句话结论']
      const studioView = h('div', { className: 'md-studio', key: 'studio', role: 'dialog', 'aria-label': '成稿' }, [
        h('div', { className: 'md-studio-chat', key: 'sc' }, [
          h('div', { className: 'md-chat', key: 'c' }, [
            h('div', { className: 'md-dock-head', key: 'h' }, [
              F({ key: 'back', icon: 'chevL', label: '返回灵感', onClick: closeStudio }),
              h('h2', { key: 't' }, '成稿'),
            ]),
            h('div', { className: 'md-dock-scroll', key: 's', 'aria-live': 'polite' }, [
              h('div', { className: 'md-dock-intro', key: 'in' }, [
                h('h3', { key: 'h' }, ['这条灵感，', h('br', { key: 'b' }), '我来写成稿。']),
                h('p', { key: 'p' }, short(studioIdea ? (studioIdea.title || studioIdea.text) : '', 120)),
              ]),
              h('div', { className: 'md-progress-card', key: 'pr' }, [
                h('div', { className: 'md-progress-step is-done', key: 'p1' }, [h('i', { key: 'i' }), '灵感已记下']),
                h('div', { className: 'md-progress-step ' + (studioDraft ? 'is-done' : busy === 'studio' ? 'is-active' : ''), key: 'p2' }, [h('i', { key: 'i' }), studioDraft ? '初稿已生成' : (busy === 'studio' ? '正在成稿……' : '一键成稿')]),
                h('div', { className: 'md-progress-step ' + (studioDraft ? 'is-active' : ''), key: 'p3' }, [h('i', { key: 'i' }), '补充想法，继续打磨']),
              ]),
              busy === 'studio' ? h('span', { className: 'md-shimmer', key: 'busy' }, '正在成稿，马上就好……') : null,
              h('div', { className: 'md-suggest', key: 'sg' }, ['标题再短一点', '语气轻松一点', '开场再抓人一点', '封面大字更有冲击力'].map(s =>
                h('button', { key: s, type: 'button', disabled: busy !== '', onClick: () => { setStudioInput(s) } }, s))),
            ]),
            h('form', { className: 'md-composer', key: 'cp', onSubmit: e => { e.preventDefault(); refineStudio() } }, [
              h('textarea', { key: 'ta', rows: 1, 'aria-label': '补充想法', value: studioInput, placeholder: '补充点想法，或者直接说要什么', onChange: e => setStudioInput(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); refineStudio() } } }),
              h('button', { key: 'go', type: 'submit', className: 'md-send', 'aria-label': '发送', disabled: !studioInput.trim() || busy !== '' }, I({ name: 'send', size: 15 })),
            ]),
          ]),
        ]),
        h('div', { className: 'md-sheet', key: 'sh' }, [
          h('div', { className: 'md-bento', key: 'b' }, [
            h('section', { className: 'md-tile md-tile-hero', key: 'hero' }, [
              h('div', { className: 'md-hero-copy', key: 'hc' }, [
                h('h1', { className: 'md-hero-title' + (studioDraft ? '' : ' is-idle'), key: 't' }, studioTitle),
                h('div', { className: 'md-hero-stats', key: 'st' }, [
                  h('span', { key: 'a' }, studioFormat === 'article' ? '体裁 · 文章' : '体裁 · 脚本'),
                  h('span', { key: 'b' }, '风格 · 默认'),
                  h('span', { key: 'c' }, studioDraft ? '已成稿' : '待成稿'),
                ]),
                h('div', { className: 'md-hero-actions', key: 'ac' }, [
                  h('div', { className: 'md-seg', key: 'fmt' }, [
                    h('button', { key: 's', type: 'button', className: studioFormat === 'script' ? 'is-on' : '', onClick: () => setStudioFormat('script') }, '脚本'),
                    h('button', { key: 'a', type: 'button', className: studioFormat === 'article' ? 'is-on' : '', onClick: () => setStudioFormat('article') }, '文章'),
                  ]),
                  h('button', { key: 'go', type: 'button', className: 'md-go', disabled: busy !== '', onClick: draftStudio }, busy === 'studio' ? '正在成稿……' : '一键成稿'),
                  h('label', { className: 'md-go-option', key: 'im' }, [h('input', { type: 'checkbox', checked: studioImages, onChange: e => setStudioImages(e.target.checked) }), '生成图片']),
                ]),
              ]),
              h('div', { className: 'md-collage', key: 'col' }, [
                h('div', { className: 'md-collage-main', key: 'm' }, h('div', { className: 'md-plate is-wash' }, h('span', { className: 'md-plate-mark' }, '✦'))),
                h('div', { className: 'md-collage-side is-0', key: 's0' }, h('div', { className: 'md-plate is-wash' }, h('span', { className: 'md-plate-mark' }, '01'))),
                h('div', { className: 'md-collage-side is-1', key: 's1' }, h('div', { className: 'md-plate is-wash' }, h('span', { className: 'md-plate-mark' }, '02'))),
              ]),
            ]),
            h('section', { className: 'md-tile md-tile-article', key: 'art' }, [
              h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, studioFormat === 'article' ? '正文' : '脚本骨架'), h('span', { className: 'md-tile-meta', key: 'm' }, studioDraft ? '可继续打磨' : '等一键成稿')]),
              studioDraft
                ? h('div', { className: 'md-article-scroll', key: 'sc' }, h('div', { className: 'md-article md-prose', key: 'a', style: { whiteSpace: 'pre-wrap' } }, studioDraft))
                : h('div', { className: 'md-skeleton is-still', key: 'sk' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 }), h('i', { key: 4 }), h('i', { key: 5 }), h('i', { key: 6 })]),
            ]),
            h('section', { className: 'md-tile md-tile-shots', key: 'shots', style: { '--rows2': 3 } }, [
              h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '分镜头脚本'), h('span', { className: 'md-tile-meta', key: 'm' }, '6 格')]),
              h('div', { className: 'md-shots', key: 'g', style: { '--rows2': 3 } }, shotLines.map((line, i) =>
                h('figure', { className: 'md-shot', key: i }, [
                  h('div', { className: 'md-plate is-wash' }, h('span', { className: 'md-plate-mark' }, String(i + 1).padStart(2, '0'))),
                  h('figcaption', { key: 'c' }, [h('span', { className: 'md-shot-meta', key: 'm' }, h('b', null, String(i + 1).padStart(2, '0')), ' · 约 15 秒'), h('p', { key: 'p' }, line)]),
                ]))),
            ]),
          ]),
          h('form', { className: 'md-sheet-ask', key: 'ask', onSubmit: e => { e.preventDefault(); refineStudio() } }, [
            I({ name: 'spark', size: 14, key: 'i' }),
            h('input', { key: 'in', value: studioInput, onChange: e => setStudioInput(e.target.value), placeholder: '补充点想法，或者直接说要什么', 'aria-label': '补充想法' }),
            h('button', { key: 'go', type: 'submit', className: 'md-send', disabled: !studioInput.trim() || busy !== '' }, I({ name: 'send', size: 13 })),
          ]),
        ]),
        h('button', { key: 'toggle', type: 'button', className: 'md-chat-toggle', 'aria-label': '打开对话', onClick: () => { const s = document.querySelector && document.querySelector('.md-studio'); if (s) s.classList.toggle('chat-open') } }, I({ name: 'chat', size: 16 })),
      ])
      const DOCK_RESIZE_CSS = '.md-dock-resizer{position:absolute;left:-4px;top:0;bottom:0;width:9px;cursor:col-resize;z-index:6;touch-action:none}.md-dock-resizer::after{content:"";position:absolute;left:3px;top:50%;width:3px;height:38px;border-radius:3px;background:var(--line-strong,var(--ink4));transform:translateY(-50%);opacity:0;transition:opacity .15s,background .15s}.md-root.has-dock .md-dock:hover .md-dock-resizer::after{opacity:.55}.md-dock-resizer:hover::after,.md-dock-resizer.is-drag::after{opacity:1!important;background:var(--primary)!important}.md-root.is-narrow .md-dock-resizer{display:none}'
      const inStudio = !!studioId
      const content = inStudio ? null : view === 'home' ? ideaGallery : view === 'content' ? contentView : view === 'schedule' ? scheduleView : view === 'discover' ? discoverView : view === 'insights' ? insightsView : styleView
      return h('div', {
        className: 'md-root rd-root' + (isNarrow ? ' is-narrow' : '') + (isCompact ? ' is-compact' : '') + (dockOpen && !inStudio ? ' has-dock' : '') + (inStudio ? ' is-studio' : ''),
        ref: rootRef, 'data-rd': '1', key: 'root', style: { '--dock-w': dockW + 'px' },
      }, [
        h('style', { key: 'css' }, CSS),
        h('style', { key: 'dockcss' }, DOCK_RESIZE_CSS),
        h('div', { className: 'md-ambient', 'aria-hidden': 'true', key: 'amb' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 })]),
        inStudio ? null : h('div', { className: 'md-main', key: 'main' }, [
          topbar,
          h('main', { className: 'md-content', key: 'content' }, [content, detail]),
        ]),
        inStudio ? studioView : (dockOpen ? dock : null),
        settingsDialog,
        modelDialog,
        ideaCaptureDialog,
        toast ? h('div', { className: 'md-toast' + (toast.error ? ' is-error' : ''), key: 'toast', role: 'status' }, [h('span', { key: 't' }, toast.text), toast.error || !toast.undo ? null : h('button', { key: 'u', onClick: doUndo }, '撤销')]) : null,
      ])
    }


    function mount(ctx) {
      try {
        injectStyles()
        const register = function (slot, options, component, label) {
          return ctx.slots.inject(slot, function* () {
            try { yield ctx.slots.register(options, component) }
            catch (err) { console.error(NS + ': failed to register ' + label, err) }
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
        try { mount(ctx) }
        catch (err) { try { if (typeof console !== 'undefined') console.warn('[' + NS + '] apply failed', err) } catch (ignored) {} }
      },
    }
  },
})
