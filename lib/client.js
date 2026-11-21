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

    const CSS = "/* 所有颜色走 DSH 语义 token，明暗主题由宿主负责。圆角遵循 DSH 统一圆角规范。 */\n.md-root {\n  --ink: var(--dsw-alias-label-primary);\n  --ink2: var(--dsw-alias-label-secondary);\n  --ink3: var(--dsw-alias-label-tertiary);\n  --ink4: var(--dsw-alias-label-caption);\n  --on-primary: var(--dsw-alias-label-primary-inverted);\n  --primary: var(--dsw-alias-button-primary-fill);\n  --primary-hover: var(--dsw-alias-button-primary-hover);\n  --line: var(--dsw-alias-border-l2);\n  --line-strong: var(--dsw-alias-border-l4);\n  --hover: var(--dsw-alias-interactive-bg-hover);\n  --active: var(--dsw-alias-interactive-bg-active);\n  --bg: var(--dsw-alias-bg-base);\n  --card: var(--dsw-alias-bg-layer-2);\n  --accent: var(--dsw-alias-link);\n  --glass: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 72%, transparent);\n  --serif: \"Songti SC\", \"STSong\", \"Noto Serif SC\", \"Source Han Serif SC\", Georgia, serif;\n  --latin-serif: \"Iowan Old Style\", \"Palatino\", Georgia, \"Songti SC\", serif;\n  --ease: cubic-bezier(.2, .8, .2, 1);\n  --r-xs: var(--dsw-radius-xs, 4px);\n  --r-sm: var(--dsw-radius-sm, 8px);\n  --r-md: var(--dsw-radius-md, 12px);\n  --r-lg: var(--dsw-radius-lg, 16px);\n  --r-xl: var(--dsw-radius-xl, 20px);\n  --r-panel: var(--dsw-radius-panel, 28px);\n  --dock-w: 336px;\n  position: relative;\n  display: flex;\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  overflow: clip;\n  background: var(--bg);\n  color: var(--ink);\n  font-family: var(--dsw-font-family);\n  font-size: 14px;\n  line-height: 22px;\n  -webkit-font-smoothing: antialiased;\n}\n.md-root *, .md-root *::before, .md-root *::after { box-sizing: border-box; }\n:where(.md-root) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }\n:where(.md-root) button:disabled { cursor: default; }\n:where(.md-root) :is(h1, h2, h3, p, dl, dd, ul, ol, blockquote) { margin: 0; padding: 0; }\n:where(.md-root) :is(ul, ol) { list-style: none; }\n.md-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n:where(.md-root) :is(input, textarea, select) { font: inherit; color: inherit; }\n/* 下拉框弹出的选项列表由系统绘制，不认页面颜色：跟着 DSH 的深色主题切换配色方案，再给选项本身上色兜底 */\nbody[data-ds-dark-theme] .md-root { color-scheme: dark; }\n.md-root :is(option, optgroup) { background-color: var(--card); color: var(--ink); }\n.md-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }\n.md-muted { color: var(--ink3); }\n.md-nowrap { white-space: nowrap; }\n\n/* 背景氛围：很淡的彩色光斑，缓慢漂移 */\n.md-ambient { position: absolute; inset: 0; overflow: clip; pointer-events: none; }\n.md-ambient i { position: absolute; width: 56vmax; height: 56vmax; border-radius: 50%; corner-shape: round; filter: blur(70px); opacity: .5; animation: md-drift 42s ease-in-out infinite alternate; }\n.md-ambient i:nth-child(1) { left: -18vmax; top: -24vmax; background: radial-gradient(circle, color-mix(in srgb, #d9e4ff 42%, var(--bg)), transparent 68%); }\n.md-ambient i:nth-child(2) { right: -14vmax; top: -8vmax; background: radial-gradient(circle, color-mix(in srgb, #f6e2ef 42%, var(--bg)), transparent 68%); animation-delay: -14s; }\n.md-ambient i:nth-child(3) { left: 22vmax; bottom: -34vmax; background: radial-gradient(circle, color-mix(in srgb, #e2f3e0 42%, var(--bg)), transparent 68%); animation-delay: -28s; }\n@keyframes md-drift { to { transform: translate3d(6vmax, 4vmax, 0) scale(1.12); } }\n\n.md-main { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }\n.md-topbar {\n  position: absolute; z-index: 30; left: 0; right: 0; top: 0;\n  display: flex; align-items: center; gap: 8px;\n  padding: 14px 18px 14px max(18px, var(--dsh-frame-leading-clearance, 0px));\n  pointer-events: none;\n}\n.md-topbar > * { pointer-events: auto; }\n.md-nav { display: flex; gap: 2px; padding: 4px; border-radius: var(--r-lg); background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--dsw-elevation-soft); }\n.md-nav button { height: 32px; padding: 0 13px; border-radius: var(--r-md); color: var(--ink2); font-size: 13px; line-height: 32px; transition: background .18s var(--ease), color .18s var(--ease); white-space: nowrap; }\n.md-nav button:hover { background: var(--hover); color: var(--ink); }\n.md-nav button.is-on { background: var(--primary); color: var(--on-primary); }\n.md-sample { height: 28px; padding: 0 11px; border-radius: var(--r-sm); color: var(--ink3); font-size: 12px; line-height: 28px; background: var(--glass); backdrop-filter: blur(24px); box-shadow: var(--dsw-elevation-soft); white-space: nowrap; }\n.md-sample:hover { color: var(--ink); }\n.md-open-dock { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border-radius: var(--r-md); background: var(--glass); backdrop-filter: blur(24px); box-shadow: var(--dsw-elevation-soft); white-space: nowrap; font-size: 13px; }\n.md-open-dock:hover { background: var(--card); }\n\n.md-content { flex: 1; min-height: 0; position: relative; animation: md-rise .45s var(--ease) both; }\n@keyframes md-rise { from { opacity: 0; transform: translateY(8px); } }\n.md-loading { height: 100%; display: flex; align-items: center; justify-content: center; color: var(--ink3); }\n.md-shimmer { background: linear-gradient(100deg, var(--ink3) 30%, var(--ink) 50%, var(--ink3) 70%); background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: md-shimmer 1.6s linear infinite; }\n@keyframes md-shimmer { to { background-position: -220% 0; } }\n\n/* 按钮与基础控件 */\n.md-icon-btn { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 32px; height: 32px; border-radius: var(--r-md); color: var(--ink2); transition: background .15s, color .15s; }\n.md-icon-btn:hover { background: var(--hover); color: var(--ink); }\n.md-icon-btn.is-active { background: var(--active); color: var(--ink); }\n.md-topbar .md-icon-btn { background: var(--glass); backdrop-filter: blur(24px); box-shadow: var(--dsw-elevation-soft); width: 36px; height: 36px; }\n.md-root .md-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: var(--r-md); border: .5px solid var(--line-strong); background: var(--card); font-size: 13px; line-height: 20px; white-space: nowrap; transition: background .15s, transform .25s var(--ease), border-color .15s; }\n.md-root .md-btn:hover { background: var(--hover); }\n.md-root .md-btn:active { transform: scale(.97); }\n.md-root .md-btn:disabled { opacity: .5; }\n.md-root .md-btn.is-primary { background: var(--primary); color: var(--on-primary); border-color: transparent; }\n.md-root .md-btn.is-primary:hover { background: var(--primary-hover); }\n.md-root .md-btn.is-small { height: 28px; padding: 0 10px; border-radius: var(--r-sm); font-size: 12px; }\n.md-root .md-btn.is-wide { width: 100%; }\n.md-root .md-btn.is-danger { color: #d13c35; border-color: color-mix(in srgb, #d13c35 40%, transparent); }\n.md-root .md-btn.is-open { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent); }\n.md-root .md-btn.is-busy { opacity: .7; }\n.md-round { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; corner-shape: round; flex: none; }\n.md-root .md-round.is-primary { background: var(--primary); color: var(--on-primary); transition: transform .3s var(--ease), background .15s; }\n.md-root .md-round.is-primary:hover { background: var(--primary-hover); transform: rotate(90deg); }\n.md-send { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; corner-shape: round; flex: none; }\n.md-root .md-send { background: var(--primary); color: var(--on-primary); transition: opacity .15s, transform .2s var(--ease); }\n.md-root .md-send:disabled { opacity: .28; }\n.md-root .md-send:not(:disabled):hover { transform: translateY(-1px); }\n.md-seg { display: inline-flex; gap: 0; padding: 4px; border-radius: var(--r-md); background: var(--hover); flex: none; }\n.md-seg button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 28px; min-width: 32px; padding: 0 10px; border-radius: var(--r-sm); color: var(--ink3); font-size: 12px; transition: background .2s var(--ease), color .2s; white-space: nowrap; }\n.md-seg button:hover { color: var(--ink); }\n.md-topbar .md-seg { background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--dsw-elevation-soft); }\n.md-seg button.is-on { background: var(--card); color: var(--ink); box-shadow: var(--dsw-elevation-soft); }\n\n/* 画布 */\n.md-home { position: absolute; inset: 0; }\n.md-stage {\n  position: absolute; inset: 0; overflow: clip; touch-action: none; cursor: grab; user-select: none;\n  background-image: radial-gradient(circle, color-mix(in srgb, var(--ink) 11%, transparent) 1px, transparent 1.2px);\n  background-size: var(--grid-size, 28px) var(--grid-size, 28px);\n  background-position: var(--grid-x, 0) var(--grid-y, 0);\n}\n.md-stage.is-panning { cursor: grabbing; }\n.md-world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; will-change: transform; }\n.md-links { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; pointer-events: none; }\n.md-links path { fill: none; stroke: var(--line-strong); stroke-width: 1.2; stroke-dasharray: 1; stroke-dashoffset: 1; animation: md-draw .9s var(--ease) .1s forwards; vector-effect: non-scaling-stroke; }\n.md-links path.is-active { stroke: var(--ink); stroke-width: 1.6; }\n@keyframes md-draw { to { stroke-dashoffset: 0; } }\n.md-link-label { position: absolute; transform: translate(-50%, -50%); padding: 1px 9px; border-radius: 999px; corner-shape: round; background: var(--card); box-shadow: var(--dsw-elevation-soft); color: var(--ink2); font-size: 11px; line-height: 19px; white-space: nowrap; pointer-events: none; animation: md-fade .5s .4s both; z-index: 2; }\n@keyframes md-fade { from { opacity: 0; } }\n\n.md-node {\n  position: absolute; z-index: 1;\n  transform: translate(-50%, -50%) translate(calc(var(--px, 0px) * var(--d, 0)), calc(var(--py, 0px) * var(--d, 0)));\n  transition: opacity .45s var(--ease), filter .45s var(--ease), left .6s var(--ease), top .6s var(--ease);\n}\n.md-node:hover, .md-node:focus-within { z-index: 6; }\n.md-node.is-selected { z-index: 8; }\n.md-node.is-dragging { z-index: 20; transition: none; }\n.md-node.is-dim { opacity: .13; filter: saturate(.4); }\n.md-node.is-dim:hover { opacity: .85; filter: none; }\n.md-pop { will-change: transform; }\n\n.md-node .md-card { transform: rotate(var(--r, 0deg)); transition: transform .5s cubic-bezier(.2, 1.3, .4, 1), box-shadow .3s var(--ease); }\n.md-node:hover .md-card { transform: rotate(0deg) translateY(-4px) scale(1.025); }\n.md-node.is-dragging .md-card { transform: rotate(calc(var(--r, 0deg) * .4)) scale(1.05); box-shadow: 0 0 0 .5px var(--line-strong), 0 24px 48px -12px rgb(0 0 0 / .32); cursor: grabbing; }\n.md-node.is-selected .md-card { transform: none; box-shadow: 0 0 0 1.5px var(--ink), 0 22px 54px -14px rgb(0 0 0 / .28); }\n\n.md-card {\n  position: relative; display: block; width: 100%; border-radius: var(--r-xl); background: var(--card);\n  box-shadow: var(--dsw-elevation-soft); overflow: hidden; cursor: pointer; user-select: none;\n}\n.md-card-media { position: relative; margin: 6px 6px 0; border-radius: 14px; overflow: hidden; background: var(--hover); line-height: 0; }\n.md-media { display: block; width: 100%; height: auto; object-fit: cover; }\n.md-media-fallback { display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; font-family: var(--serif); font-size: 48px; line-height: 1; color: var(--ink3); }\n.md-card-play { position: absolute; left: 8px; bottom: 8px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; corner-shape: round; background: rgb(0 0 0 / .45); backdrop-filter: blur(8px); color: #fff; }\n.md-card-caption { padding: 10px 14px 0; }\n.md-card h3 { font-size: 13px; line-height: 19px; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.md-card-quote { padding: 22px 20px 8px; font-family: var(--serif); font-size: 20px; line-height: 30px; font-weight: 500; letter-spacing: .01em; }\n.md-card-note { padding: 16px 16px 2px; }\n.md-card-note h3 { font-size: 14px; line-height: 21px; font-weight: 600; -webkit-line-clamp: 3; }\n.md-card-note p { margin-top: 6px; color: var(--ink2); font-size: 12.5px; line-height: 20px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }\n.md-card-rel { display: inline-block; margin-bottom: 6px; padding: 0 8px; border-radius: 999px; corner-shape: round; background: var(--hover); color: var(--ink2); font-size: 11px; line-height: 19px; }\n.md-card-foot { display: flex; align-items: center; gap: 6px; padding: 8px 14px 12px; color: var(--ink3); font-size: 11.5px; line-height: 16px; min-height: 36px; }\n.md-card-source { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-card-count { display: inline-flex; align-items: center; gap: 2px; margin-left: 2px; }\n.md-card-time { margin-left: auto; white-space: nowrap; }\n.md-card-actions { position: absolute; right: 8px; top: 8px; display: flex; gap: 4px; opacity: 0; transform: translateY(-3px); transition: opacity .2s, transform .3s var(--ease); z-index: 2; }\n.md-card:hover .md-card-actions, .md-card:focus-within .md-card-actions { opacity: 1; transform: none; }\n.md-card-actions button { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; corner-shape: round; background: color-mix(in srgb, var(--card) 86%, transparent); backdrop-filter: blur(12px); box-shadow: var(--dsw-elevation-soft); transition: transform .25s var(--ease), background .15s; color: var(--ink); }\n.md-card-actions button:hover { transform: scale(1.1); background: var(--card); }\n.md-card-actions button.is-busy { animation: md-pulse 1s ease-in-out infinite; }\n@keyframes md-pulse { 50% { opacity: .45; } }\n.md-card.is-inverted { background: var(--primary); color: var(--on-primary); }\n.md-card.is-inverted .md-card-foot, .md-card.is-inverted .md-card-note p { color: color-mix(in srgb, var(--on-primary) 68%, transparent); }\n.md-card.is-published .md-card-media { filter: saturate(.92); }\n\n.md-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; corner-shape: round; background: var(--ink4); }\n.md-dot.status-outline { background: #d39a2c; }\n.md-dot.status-draft { background: #4176e6; }\n.md-dot.status-ready { background: #8a5fe0; }\n.md-dot.status-published { background: #2fa36c; }\n.md-status { display: inline-block; padding: 0 8px; border-radius: 999px; corner-shape: round; background: var(--hover); color: var(--ink2); font-size: 11.5px; line-height: 20px; white-space: nowrap; }\n.md-status.status-outline { background: color-mix(in srgb, #d39a2c 16%, transparent); }\n.md-status.status-draft { background: color-mix(in srgb, #4176e6 14%, transparent); }\n.md-status.status-ready { background: color-mix(in srgb, #8a5fe0 14%, transparent); }\n.md-status.status-published { background: color-mix(in srgb, #2fa36c 16%, transparent); }\n\n/* 首屏那句话 */\n.md-hero-anchor { position: absolute; left: 0; top: 0; width: 520px; transform: translate(-50%, -50%); }\n.md-hero { cursor: default; user-select: text; }\n.md-hero-date { color: var(--ink3); font-size: 13px; line-height: 20px; margin-bottom: 12px; }\n.md-root .md-hero-line { font-size: 33px; line-height: 46px; font-weight: 300; letter-spacing: -.015em; color: var(--ink3); }\n.md-hero-line b { font-weight: 400; color: var(--ink); }\n.md-hero-line br { display: block; }\n.md-inline-pic { display: inline-block; width: 36px; height: 36px; vertical-align: -7px; border-radius: 50%; corner-shape: round; object-fit: cover; box-shadow: var(--dsw-elevation-soft); margin: 0 2px; }\n.md-inline-pic.is-empty { background: var(--hover); }\n.md-hero-streak { font-family: var(--latin-serif); font-style: italic; }\n.md-hero-input { display: flex; align-items: center; gap: 10px; margin-top: 20px; max-width: 440px; height: 48px; padding: 0 10px 0 18px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); color: var(--ink3); transition: box-shadow .25s var(--ease), transform .3s var(--ease); }\n.md-hero-input:focus-within { box-shadow: 0 0 0 1px var(--ink), 0 16px 40px -14px rgb(0 0 0 / .22); transform: translateY(-1px); }\n.md-root .md-hero-input input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--ink); font-size: 15px; }\n.md-hero-meta { margin-top: 14px; text-align: center; color: var(--ink3); font-size: 12.5px; line-height: 18px; }\n.md-hero-meta b { font-family: var(--latin-serif); font-style: italic; font-weight: 400; font-size: 15px; color: var(--ink2); }\n.md-hero.is-compact { padding: 20px 0 8px; }\n.md-hero-input input::placeholder { color: var(--ink3); }\n\n.md-toolrow { position: absolute; display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: var(--r-lg); background: var(--glass); backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--dsw-elevation-soft); z-index: 12; cursor: default; }\n.md-toolrow-right { right: 18px; bottom: 18px; }\n.md-root.has-dock .md-stage.is-focusing .md-toolrow-right { opacity: 0; pointer-events: none; }\n\n.md-dockbar { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 14; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 6px; border-radius: 24px; background: var(--glass); backdrop-filter: blur(28px) saturate(170%); box-shadow: var(--dsw-elevation-prominent); max-width: calc(100% - 24px); transition: opacity .25s var(--ease), transform .4s var(--ease); }\n.md-dockbar-sep { width: .5px; height: 22px; background: var(--line-strong); flex: none; }\n.md-chips { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }\n.md-chips button { height: 30px; padding: 0 11px; border-radius: var(--r-md); color: var(--ink3); font-size: 12.5px; white-space: nowrap; transition: background .15s, color .15s; }\n.md-chips button:hover { color: var(--ink); background: var(--hover); }\n.md-chips button.is-on { color: var(--ink); background: var(--active); }\n.md-stage.is-focusing ~ .md-dockbar { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(12px); }\n.md-root:has(.md-sheet) .md-dockbar { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(12px); }\n\n/* 迷你邮票条 */\n.md-ministamps { display: flex; align-items: center; gap: 8px; margin-top: 18px; }\n.md-ministamps-row { display: grid; grid-template-columns: repeat(10, 34px); gap: 4px; }\n.md-ministamps .md-stamp { --s: 5px; --hole: 1.2px; width: 34px; height: 43px; aspect-ratio: auto; }\n.md-ministamps-more { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; corner-shape: round; color: var(--ink3); transition: background .15s, color .15s; }\n.md-ministamps-more:hover { background: var(--hover); color: var(--ink); }\n\n/* 邮票：用遮罩打出齿孔 */\n.md-stamp {\n  --s: 9px; --hole: 2.4px;\n  position: relative; display: block; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; background: var(--card);\n  -webkit-mask: radial-gradient(circle var(--hole), transparent 97%, #000) calc(var(--s) / -2) calc(var(--s) / -2) / var(--s) var(--s), linear-gradient(#000 0 0) center / calc(100% - var(--s)) calc(100% - var(--s)) no-repeat;\n  mask: radial-gradient(circle var(--hole), transparent 97%, #000) calc(var(--s) / -2) calc(var(--s) / -2) / var(--s) var(--s), linear-gradient(#000 0 0) center / calc(100% - var(--s)) calc(100% - var(--s)) no-repeat;\n  transition: transform .35s cubic-bezier(.2, 1.4, .4, 1);\n  filter: drop-shadow(0 1px 1px rgb(0 0 0 / .1));\n}\nbutton.md-stamp:not(:disabled):hover { transform: scale(1.08) rotate(-2deg); }\n.md-stamp img { display: block; width: 100%; height: 100%; object-fit: cover; }\n.md-stamp i { position: absolute; right: 7px; top: 7px; min-width: 15px; padding: 0 4px; border-radius: 999px; corner-shape: round; background: rgb(0 0 0 / .62); color: #fff; font-style: normal; font-size: 10px; line-height: 15px; text-align: center; }\n.md-stamp.is-type { display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 22px; line-height: 1; color: rgb(0 0 0 / .7); }\n.md-ministamps .md-stamp.is-type { font-size: 13px; }\n.md-stamp.is-blank { background: var(--hover); color: var(--ink2); display: flex; align-items: center; justify-content: center; filter: none; }\n.md-stamp.is-today { background: var(--primary); color: var(--on-primary); animation: md-breathe 2.6s ease-in-out infinite; }\n@keyframes md-breathe { 50% { opacity: .68; } }\n.tone-0 { background-color: #f6e2d5; } .tone-1 { background-color: #dfe7fb; } .tone-2 { background-color: #dcf0df; } .tone-3 { background-color: #f6dfe9; } .tone-4 { background-color: #efe9cf; } .tone-5 { background-color: #e6dff7; }\n\n/* 瀑布流与列表 */\n.md-wall-scroll { position: absolute; inset: 0; overflow-y: auto; padding: 72px 20px 96px; }\n.md-wall { columns: 236px; column-gap: 16px; max-width: 1500px; margin: 0 auto; }\n.md-wall-cell { break-inside: avoid; margin-bottom: 16px; padding: 1px; animation: md-rise .6s var(--ease) both; }\n.md-wall-cell .md-card { transition: transform .4s cubic-bezier(.2, 1.3, .4, 1); }\n.md-wall-cell .md-card:hover { transform: translateY(-3px); }\n.md-rows { max-width: 1100px; margin: 0 auto; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); overflow: hidden; }\n.md-root .md-row { display: grid; grid-template-columns: minmax(0, 1fr) 120px 110px 84px 76px; gap: 12px; align-items: center; width: 100%; padding: 8px 16px; border-bottom: .5px solid var(--line); font-size: 13px; line-height: 20px; transition: background .12s; }\n.md-root .md-row:hover { background: var(--hover); }\n.md-root .md-row:last-child { border-bottom: 0; }\n.md-root .md-row.is-head { color: var(--ink3); font-size: 12px; padding: 10px 16px; }\n.md-root .md-row.is-head:hover { background: none; }\n.md-row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-row-main { display: flex; align-items: center; gap: 12px; }\n.md-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-row-title em { margin-right: 6px; color: var(--ink3); font-style: normal; font-size: 12px; }\n.md-thumb { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--r-sm); overflow: hidden; background: var(--hover); font-family: var(--serif); color: var(--ink2); font-size: 14px; }\n.md-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }\n.md-root.is-narrow .md-row { grid-template-columns: minmax(0, 1fr) 84px 76px; }\n.md-root.is-narrow .md-row > :nth-child(2), .md-root.is-narrow .md-row > :nth-child(3) { display: none; }\n\n/* 详情抽屉 */\n.md-people-chips { display: flex; flex-wrap: wrap; gap: 6px; }\n.md-people-chips button { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 9px 0 4px; border-radius: 999px; corner-shape: round; font-size: 12px; color: var(--ink3); box-shadow: inset 0 0 0 .5px var(--line-strong); transition: background .15s, color .15s; }\n.md-people-chips button.is-on { background: var(--active); color: var(--ink); box-shadow: inset 0 0 0 .5px var(--ink3); }\n.md-avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 50%; corner-shape: round; color: rgb(0 0 0 / .72); font-weight: 500; line-height: 1; }\n.md-avatars { display: inline-flex; }\n.md-avatars .md-avatar + .md-avatar { margin-left: -6px; box-shadow: 0 0 0 1.5px var(--card); }\n\n.md-prose { font-size: 14.5px; line-height: 26px; }\n.md-root .md-prose h1 { font-family: var(--serif); font-size: 24px; line-height: 34px; font-weight: 600; margin: 0 0 14px; }\n.md-root .md-prose h2 { font-size: 16.5px; line-height: 26px; font-weight: 600; margin: 22px 0 8px; }\n.md-root .md-prose h3, .md-root .md-prose h4 { font-size: 14.5px; line-height: 24px; font-weight: 600; margin: 16px 0 6px; }\n.md-root .md-prose p { margin: 0 0 12px; }\n.md-root .md-prose ul, .md-root .md-prose ol { margin: 0 0 12px; padding-left: 20px; }\n.md-root .md-prose ul { list-style: disc; }\n.md-root .md-prose ol { list-style: decimal; }\n.md-root .md-prose blockquote { margin: 0 0 14px; padding: 8px 14px; border-left: 2px solid var(--line-strong); color: var(--ink2); font-size: 13px; line-height: 22px; }\n.md-prose table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px; line-height: 20px; }\n.md-prose th, .md-prose td { padding: 6px 8px; border-bottom: .5px solid var(--line); text-align: left; vertical-align: top; }\n.md-prose th { color: var(--ink3); font-weight: 500; }\n.md-prose code { padding: 1px 4px; border-radius: var(--r-xs); background: var(--hover); font-size: 12.5px; }\n\n\n.md-feed-hero { max-width: 560px; margin: 8px auto 34px; }\n\n/* 灵感工作区：左边对话，右边稿面 */\n.md-studio { --canvas: color-mix(in srgb, var(--ink) 3.5%, var(--bg)); --chat-w: 320px; position: absolute; inset: 0; z-index: 31; display: flex; background: var(--canvas); will-change: clip-path; }\n.md-studio-chat { flex: none; width: var(--chat-w); min-height: 0; display: flex; animation: md-rise .5s var(--ease) both; }\n.md-chat { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }\n.md-studio .md-dock-head { min-height: 52px; padding: 10px 12px 4px max(10px, var(--dsh-frame-leading-clearance, 0px)); gap: 2px; }\n.md-studio .md-dock-scroll { padding: 6px 14px 12px; }\n.md-studio .md-composer { background: var(--card); }\n.md-chat-toggle { display: none; }\n\n/* 灵感卡 */\n.md-idea-card { flex: none; padding: 14px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); }\n.md-idea-label { display: block; color: var(--ink3); font-size: 11.5px; line-height: 16px; margin-bottom: 4px; }\n.md-root .md-idea-text { display: block; width: 100%; padding: 0; border: 0; outline: 0; background: none; resize: none; overflow: hidden; font-size: 14px; line-height: 22px; font-weight: 500; color: var(--ink); }\n.md-idea-body-wrap { display: flex; flex-direction: column; margin-top: 6px; }\n.md-idea-body-clip.is-clipped { max-height: 80px; overflow: hidden; -webkit-mask-image: linear-gradient(#000 55%, transparent); mask-image: linear-gradient(#000 55%, transparent); }\n.md-root .md-idea-body { display: block; width: 100%; padding: 0; border: 0; outline: 0; background: none; resize: none; overflow: hidden; font-size: 13px; line-height: 20px; color: var(--ink2); white-space: pre-wrap; }\n.md-root .md-go { display: flex; align-items: center; justify-content: center; width: 100%; height: 40px; margin-top: 12px; border-radius: 999px; corner-shape: round; background: var(--primary); color: var(--on-primary); font-size: 14px; transition: transform .35s cubic-bezier(.2, 1.4, .4, 1), background .15s; }\n.md-root .md-go:hover { background: var(--primary-hover); transform: translateY(-1px); }\n.md-root .md-go:active { transform: scale(.98); }\n.md-go-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }\n.md-root .md-go-row .md-go { flex: 1; margin-top: 0; }\n.md-go-option { display: flex; align-items: center; gap: 5px; flex: none; color: var(--ink3); font-size: 12px; line-height: 18px; cursor: pointer; }\n.md-go-option input, .md-check input { margin: 0; accent-color: var(--primary); }\n.md-check { display: flex; align-items: center; gap: 8px; color: var(--ink); font-size: 13px; cursor: pointer; }\n.md-idea-hint { margin-top: 10px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-idea-hint button { margin-left: 4px; color: var(--accent); }\n.md-root .md-idea-hint.is-error { color: #d13c35; }\n.md-progress-card { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: .5px solid var(--line); }\n.md-progress-step { display: flex; align-items: center; gap: 8px; color: var(--ink4); font-size: 12.5px; line-height: 18px; font-variant-numeric: tabular-nums; transition: color .3s; }\n.md-progress-step i { flex: none; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; corner-shape: round; box-shadow: inset 0 0 0 1px var(--line-strong); transition: background .3s; }\n.md-progress-step.is-active { color: var(--ink2); }\n.md-progress-step.is-active i { box-shadow: inset 0 0 0 1.5px var(--ink2); animation: md-breathe 1.4s ease-in-out infinite; }\n.md-progress-step.is-done { color: var(--ink2); }\n.md-progress-step.is-done i { background: var(--primary); color: var(--on-primary); box-shadow: none; }\n.md-link-btn { align-self: flex-start; margin-top: 2px; color: var(--ink3); font-size: 12px; }\n.md-link-btn:hover { color: var(--ink); }\n.md-composer-ctx button { flex: none; margin-left: auto; color: var(--ink3); display: flex; }\n\n/* 稿面 */\n.md-sheet { position: relative; flex: 1; min-width: 0; min-height: 0; padding: 10px 10px 10px 0; container-type: size; overflow: hidden auto; }\n.md-bento { position: relative; height: 100%; display: grid; gap: 10px; grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); grid-template-areas: \"hero hero\" \"article shots\"; }\n.md-tile { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); transition: opacity .35s var(--ease), transform .45s cubic-bezier(.2, 1.2, .4, 1), filter .35s var(--ease); animation: md-rise .6s var(--ease) both; }\n.md-tile-article { grid-area: article; animation-delay: 70ms; }\n.md-tile-shots { grid-area: shots; animation-delay: 140ms; }\n.md-bento.has-open .md-tile:not(.is-open) { opacity: .25; transform: scale(.985); filter: saturate(.6); pointer-events: none; }\n.md-bento .md-tile.is-open { grid-area: auto; position: absolute; inset: 0; z-index: 6; box-shadow: var(--dsw-elevation-prominent); animation: none; }\n.md-tile-head { flex: none; display: flex; align-items: center; gap: 2px; height: 44px; padding: 0 8px 0 18px; }\n.md-root .md-tile-head h2 { font-size: 13px; line-height: 20px; font-weight: 600; }\n.md-tile-meta { margin-left: 8px; color: var(--ink3); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }\n.md-i-trend .md-tile-meta { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.md-grow { flex: 1; }\n.md-tile-head .md-icon-btn { width: 28px; height: 28px; border-radius: var(--r-sm); }\n.md-tile-foot { position: absolute; right: 14px; bottom: 10px; color: var(--ink3); font-size: 11.5px; font-variant-numeric: tabular-nums; }\n\n/* 主视觉：整块渐变底 */\n.md-tile-hero { grid-area: hero; flex-direction: row; align-items: stretch; gap: 20px; min-height: 216px; padding: 22px 24px; overflow: hidden; background:\n  radial-gradient(55% 120% at 82% 8%, color-mix(in srgb, #c9b6f2 40%, transparent), transparent 70%),\n  radial-gradient(45% 110% at 100% 92%, color-mix(in srgb, #f7b899 42%, transparent), transparent 72%),\n  radial-gradient(50% 130% at 48% 118%, color-mix(in srgb, #a9cdf5 34%, transparent), transparent 70%),\n  var(--card); }\n.md-tile-hero.is-running { background-size: 130% 130%; animation: md-rise .6s var(--ease) both, md-wash 7s ease-in-out infinite alternate; }\n@keyframes md-wash { from { background-position: 0% 0%; } to { background-position: 100% 60%; } }\n.md-hero-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; padding-top: 18px; }\n.md-root .md-hero-title { display: block; width: 100%; padding: 0; border: 0; outline: 0; background: none; resize: none; overflow: hidden; color: var(--ink); font-size: clamp(25px, 4.4cqw, 42px); line-height: 1.26; font-weight: 300; letter-spacing: -.015em; }\n.md-root .md-hero-title.is-idle { color: var(--ink2); }\n.md-hero-stats { display: flex; flex-wrap: wrap; gap: 4px 14px; min-height: 20px; margin-top: 12px; color: var(--ink2); font-size: 12.5px; line-height: 20px; }\n.md-hero-stat { display: inline-flex; align-items: center; gap: 4px; animation: md-fade .5s both; }\n.md-hero-stat svg { color: var(--ink3); }\n.md-hero-stat b { font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums; }\n.md-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; animation: md-rise .5s var(--ease) both; }\n.md-pill { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 999px; corner-shape: round; background: color-mix(in srgb, var(--card) 70%, transparent); box-shadow: inset 0 0 0 .5px var(--line-strong); color: var(--ink); font-size: 13px; white-space: nowrap; text-decoration: none; backdrop-filter: blur(12px); transition: background .15s, transform .25s var(--ease); }\n.md-root .md-pill:hover { background: var(--card); }\n.md-root .md-pill:active { transform: scale(.97); }\n.md-root .md-pill:disabled { opacity: .5; }\n.md-root .md-pill.is-primary { background: var(--primary); color: var(--on-primary); box-shadow: none; }\n.md-root .md-pill.is-primary:hover { background: var(--primary-hover); }\n.md-hero-corner { position: absolute; right: 10px; top: 8px; z-index: 3; display: flex; opacity: .55; transition: opacity .2s; }\n.md-tile-hero:hover .md-hero-corner, .md-hero-corner:focus-within { opacity: 1; }\n.md-hero-corner .md-icon-btn { width: 28px; height: 28px; border-radius: var(--r-sm); }\n\n/* 封面和配图的拼贴 */\n.md-collage { flex: none; position: relative; align-self: center; width: min(44%, 400px); aspect-ratio: 16 / 9.4; margin: 6px 4px 0 0; }\n.md-collage > div { position: absolute; padding: 4px; border-radius: 14px; background: var(--card); box-shadow: 0 0 0 .5px var(--line), 0 10px 26px -10px rgb(0 0 0 / .28); transition: transform .5s cubic-bezier(.2, 1.3, .4, 1); }\n.md-collage > div:hover { z-index: 3; transform: rotate(0deg) scale(1.03); }\n.md-collage .md-plate { border-radius: 10px; }\n.md-collage-main { left: 10%; top: 0; width: 72%; aspect-ratio: 3 / 2; transform: rotate(-1.6deg); z-index: 2; }\n.md-collage-side { width: 38%; aspect-ratio: 3 / 2; }\n.md-collage-side.is-0 { left: 0; bottom: 0; transform: rotate(-5deg); z-index: 3; }\n.md-collage-side.is-1 { right: 0; bottom: 6%; transform: rotate(4deg); z-index: 1; }\n.md-collage-side.is-2, .md-collage-side.is-3 { display: none; }\n\n/* 图 */\n.md-plate { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; line-height: 0; }\n.md-plate.is-wash { background: radial-gradient(90% 90% at 80% 10%, color-mix(in srgb, #c9b6f2 26%, transparent), transparent), radial-gradient(80% 90% at 10% 90%, color-mix(in srgb, #a9cdf5 26%, transparent), transparent), var(--hover); }\n.md-plate.is-clickable { cursor: zoom-in; }\n.md-plate::after { content: ''; position: absolute; inset: 0; pointer-events: none; }\n.md-plate[data-status=\"running\"]::after, .md-plate[data-status=\"pending\"]::after { background: linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--ink) 8%, transparent) 50%, transparent 70%); background-size: 220% 100%; animation: md-shimmer-bg 1.6s linear infinite; }\n@keyframes md-shimmer-bg { to { background-position: -220% 0; } }\n.md-plate img { display: block; width: 100%; height: 100%; object-fit: cover; animation: md-develop .9s var(--ease) both; }\n@keyframes md-develop { from { opacity: 0; filter: blur(10px); transform: scale(1.03); } }\n.md-plate.is-paper { border-radius: var(--r-sm); background: #fff; box-shadow: 0 0 0 .5px #17171a40; }\n.md-plate.is-paper img { object-fit: cover; }\n.md-plate-mark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--latin-serif); font-size: 26px; line-height: 1; color: color-mix(in srgb, var(--ink) 12%, transparent); }\n/* 还没生成的分镜格不用白纸，免得暗色界面里一片白 */\n.md-plate.is-paper:not(:has(img)) { background: var(--hover); box-shadow: none; }\n.md-plate-failed { position: absolute; left: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 3px; padding: 0 6px; border-radius: var(--r-xs); background: var(--card); color: var(--ink3); font-size: 11px; line-height: 18px; box-shadow: var(--dsw-elevation-soft); }\n\n/* 正文 */\n.md-article-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 20px 22px 18px; scroll-behavior: smooth; }\n.md-article-scroll .md-prose { font-size: 14px; line-height: 25px; }\n.md-root .md-article-scroll .md-prose h2 { font-size: 15px; line-height: 24px; margin: 16px 0 6px; }\n.md-root .md-article-scroll .md-prose p { margin-bottom: 11px; }\n.md-tile-article.is-open .md-article-scroll { padding: 4px 24px 60px; }\n.md-article { width: min(700px, 100%); margin: 0 auto; }\n.md-tile-article.is-open .md-prose { font-size: 16px; line-height: 30px; }\n.md-root .md-tile-article.is-open .md-prose h2 { font-size: 19px; line-height: 30px; margin: 26px 0 8px; }\n.md-root .md-tile-article.is-open .md-prose p { margin-bottom: 14px; }\n.md-article-figure { margin: 10px 0 24px; }\n.md-article-figure .md-plate { aspect-ratio: 3 / 2; height: auto; border-radius: var(--r-lg); }\n.md-article-figure figcaption { margin-top: 8px; text-align: center; color: var(--ink3); font-size: 12.5px; line-height: 18px; }\n.md-root .md-article-edit { flex: 1; display: block; width: 100%; min-height: 0; padding: 0 20px 22px 18px; border: 0; background: none; outline: 0; resize: none; font-size: 14px; line-height: 25px; }\n.md-root .md-tile-article.is-open .md-article-edit { width: min(740px, 100%); margin: 0 auto; font-size: 16px; line-height: 30px; }\n.md-skeleton { display: flex; flex-direction: column; gap: 12px; padding: 6px 20px 16px 18px; }\n.md-skeleton i { display: block; height: 10px; border-radius: 999px; corner-shape: round; background: linear-gradient(100deg, var(--hover) 30%, var(--active) 50%, var(--hover) 70%); background-size: 220% 100%; animation: md-shimmer-bg 1.6s linear infinite; }\n.md-skeleton.is-still i { animation: none; background: color-mix(in srgb, var(--ink) 4%, transparent); }\n.md-skeleton i:nth-child(3n) { width: 72%; }\n.md-skeleton i:nth-child(5n) { width: 88%; }\n.md-pick { position: absolute; z-index: 4; transform: translate(-50%, calc(-100% - 6px)); display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 11px; border-radius: 999px; corner-shape: round; white-space: nowrap; font-size: 12px; animation: md-pop .3s cubic-bezier(.2, 1.3, .4, 1) both; }\n.md-root .md-pick { background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-prominent); }\n\n/* 分镜 */\n.md-shots { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows2), minmax(0, 1fr)); gap: 12px; padding: 2px 16px 16px; }\n.md-shot { margin: 0; min-width: 0; min-height: 0; display: flex; flex-direction: column; }\n.md-shot .md-plate { flex: 1; min-height: 0; }\n.md-shot figcaption { flex: none; margin-top: 6px; }\n.md-shot-meta { display: block; color: var(--ink3); font-size: 11px; line-height: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.md-shot-meta b { font-family: var(--latin-serif); font-size: 13px; font-weight: 400; color: var(--ink); }\n.md-shot figcaption p { margin-top: 1px; font-size: 12px; line-height: 17px; height: 34px; color: var(--ink2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.md-tile-shots.is-open .md-shots { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows3), minmax(0, 1fr)); gap: 16px 18px; padding: 2px 24px 24px; }\n.md-tile-shots.is-open .md-shot-meta { font-size: 12.5px; line-height: 18px; }\n.md-tile-shots.is-open .md-shot-meta b { font-size: 16px; }\n.md-tile-shots.is-open .md-shot figcaption p { font-size: 13.5px; line-height: 20px; height: 40px; }\n\n/* 自适应：宽的时候分镜排成 3\\xD72，窄或矮的时候整页滚动 */\n@container (min-width: 1040px) {\n  .md-bento { grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); }\n  .md-shots { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows3), minmax(0, 1fr)); }\n}\n@container (max-width: 620px) {\n  .md-tile-hero { flex-direction: column; gap: 14px; }\n  .md-collage { width: 100%; max-width: 420px; align-self: center; }\n}\n@container (max-width: 620px) or (max-height: 620px) {\n  .md-bento { height: auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto; grid-template-areas: \"hero\" \"article\" \"shots\"; }\n  .md-tile-article { height: 480px; }\n  .md-shots { flex: none; grid-template-rows: none; grid-auto-rows: auto; }\n  .md-tile-shots { overflow: visible; }\n  .md-shot .md-plate { flex: none; height: auto; aspect-ratio: 3 / 2; }\n}\n\n/* 窗口太窄时，对话栏改成抽屉 */\n.md-root.is-narrow .md-studio { --chat-w: 300px; }\n.md-root.is-compact .md-studio-chat { position: absolute; left: 0; top: 0; bottom: 0; z-index: 12; background: var(--canvas); box-shadow: var(--dsw-elevation-prominent); transform: translateX(-104%); transition: transform .45s cubic-bezier(.2, 1, .3, 1); animation: none; }\n.md-root.is-compact .md-studio.chat-open .md-studio-chat { transform: none; }\n.md-root.is-compact .md-chat-toggle { position: absolute; left: 14px; bottom: 14px; z-index: 13; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; corner-shape: round; background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-prominent); }\n.md-root.is-compact .md-studio.chat-open .md-chat-toggle { left: calc(var(--chat-w) + 14px); }\n.md-root.is-compact .md-sheet { padding-left: 10px; }\n\n/* 查看大图 */\n.md-viewer { position: absolute; inset: 0; z-index: 8; display: flex; align-items: center; justify-content: center; padding: 18px; background: color-mix(in srgb, var(--bg) 62%, transparent); backdrop-filter: blur(18px) saturate(140%); animation: md-fade .25s both; }\n.md-viewer-card { display: flex; flex-direction: column; width: 100%; max-width: 960px; max-height: 100%; overflow: hidden; border-radius: var(--r-panel); background: var(--card); box-shadow: var(--dsw-elevation-prominent); }\n.md-viewer-image { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: var(--hover); line-height: 0; overflow: hidden; }\n.md-viewer-image.is-paper { background: #fff; }\n.md-viewer-image img { display: block; max-width: 100%; max-height: calc(100cqh - 120px); object-fit: contain; animation: md-develop .5s var(--ease) both; }\n.md-viewer-busy { position: absolute; left: 12px; bottom: 12px; padding: 2px 10px; border-radius: var(--r-sm); background: var(--glass); backdrop-filter: blur(12px); font-size: 12px; line-height: 20px; }\n.md-viewer-card > footer { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 10px 12px 10px 18px; }\n.md-viewer-text { flex: 1 1 200px; min-width: 0; font-size: 13px; line-height: 19px; }\n.md-viewer-text b { display: block; font-weight: 500; }\n.md-viewer-text span { display: block; color: var(--ink3); font-size: 12px; line-height: 18px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n\n/* 设置 */\n.md-presets { display: flex; flex-wrap: wrap; gap: 4px; }\n.md-presets button { height: 30px; padding: 0 11px; border-radius: var(--r-md); box-shadow: inset 0 0 0 .5px var(--line-strong); font-size: 12.5px; color: var(--ink2); }\n.md-presets button.is-on { background: var(--primary); color: var(--on-primary); box-shadow: none; }\n.md-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }\n.md-advanced { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; color: var(--ink3); font-size: 12.5px; }\n.md-test-sample { display: block; width: 100%; border-radius: var(--r-lg); }\n\n/* 抽屉底部的对话条：对话栏让位给画布时使用 */\n.md-sheet-ask { flex: none; padding: 8px 12px 12px; border-top: .5px solid var(--line); }\n.md-sheet-ask-reply { margin: 0 4px 8px; color: var(--ink2); font-size: 12.5px; line-height: 19px; max-height: 96px; overflow-y: auto; white-space: pre-wrap; }\n.md-sheet-ask form { display: flex; align-items: center; gap: 6px; padding: 5px 5px 5px 12px; border-radius: var(--r-xl); background: var(--hover); }\n.md-root .md-sheet-ask input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font-size: 13px; }\n.md-sheet-ask .md-send { width: 28px; height: 28px; }\n.md-sheet-ask-open { display: inline-flex; align-items: center; color: var(--ink3); flex: none; }\n.md-sheet-ask-open:hover { color: var(--ink); }\n\n/* 侧边对话 */\n.md-dock { position: relative; z-index: 26; flex: none; width: var(--dock-w); display: flex; flex-direction: column; min-height: 0; border-left: .5px solid var(--line); background: color-mix(in srgb, var(--card) 62%, transparent); backdrop-filter: blur(30px) saturate(160%); animation: md-dock-in .5s var(--ease) both; }\n@keyframes md-dock-in { from { opacity: 0; transform: translateX(20px); } }\n.md-root.is-narrow .md-dock { z-index: 34; position: absolute; right: 8px; top: 8px; bottom: 8px; width: min(340px, calc(100% - 16px)); border: 0; border-radius: var(--r-panel); box-shadow: var(--dsw-elevation-prominent); background: color-mix(in srgb, var(--card) 92%, transparent); overflow: hidden; }\n.md-dock-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 14px 10px 8px 18px; }\n.md-root .md-dock-head h2 + .md-icon-btn { margin-left: auto; }\n.md-dock > .md-chat { height: 100%; }\n.md-root .md-dock-head h2 { font-size: 15px; line-height: 22px; font-weight: 600; }\n.md-engine { display: inline-flex; align-items: center; gap: 5px; max-width: 130px; min-width: 0; color: var(--ink3); font-size: 11.5px; line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.md-engine i { flex: none; width: 6px; height: 6px; border-radius: 50%; corner-shape: round; background: var(--ink4); }\n.md-engine.is-live i { background: #2fa36c; }\n.md-engine.is-down i { background: #d39a2c; }\n.md-dock-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 18px 12px; display: flex; flex-direction: column; gap: 14px; }\n.md-dock-intro { margin: auto 0; padding-bottom: 12px; }\n.md-root .md-dock-intro h3 { font-size: 25px; line-height: 35px; font-weight: 300; letter-spacing: -.01em; margin-bottom: 10px; }\n.md-dock-intro p { color: var(--ink3); font-size: 13px; line-height: 21px; }\n.md-msg { font-size: 13.5px; line-height: 22px; animation: md-rise .35s var(--ease) both; white-space: pre-wrap; overflow-wrap: anywhere; }\n.md-msg.is-user { align-self: flex-end; max-width: 88%; padding: 8px 13px; border-radius: var(--r-lg); background: var(--active); }\n.md-msg.is-bot p + p { margin-top: 6px; }\n.md-msg-error { color: #d13c35; font-size: 12.5px; }\n.md-msg-note { color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-model-alert { margin-bottom: 12px; padding: 10px 12px; border-radius: var(--r-md); background: color-mix(in srgb, #d39a2c 12%, transparent); font-size: 12.5px; line-height: 18px; }\n.md-model-alert strong { display: block; font-weight: 600; }\n.md-model-alert p { margin-top: 4px; color: var(--ink2); overflow-wrap: anywhere; }\n.md-receipt { display: flex; align-items: flex-start; gap: 7px; width: 100%; margin-top: 6px; padding: 7px 10px; border-radius: var(--r-md); background: var(--card); box-shadow: var(--dsw-elevation-soft); font-size: 12.5px; line-height: 19px; transition: transform .25s var(--ease); }\nbutton.md-receipt:hover { transform: translateX(2px); }\n.md-receipt-check { flex: none; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-top: 1.5px; border-radius: 50%; corner-shape: round; background: var(--primary); color: var(--on-primary); }\n.md-msg footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; color: var(--ink4); font-size: 11px; line-height: 16px; }\n.md-msg footer button { display: inline-flex; align-items: center; gap: 3px; color: var(--ink3); }\n.md-msg footer button:hover { color: var(--ink); }\n.md-suggest { display: flex; flex-direction: column; gap: 4px; padding: 0 12px 8px; }\n.md-suggest button { padding: 5px 10px; border-radius: var(--r-md); color: var(--ink2); font-size: 12.5px; line-height: 19px; transition: background .12s, color .12s; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: none; }\n.md-suggest button:hover:not(:disabled) { background: var(--hover); color: var(--ink); }\n.md-composer { position: relative; margin: 0 12px 12px; padding: 10px 8px 8px 14px; border-radius: var(--r-panel); background: var(--card); box-shadow: var(--dsw-elevation-soft); display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px; transition: box-shadow .2s var(--ease); }\n.md-composer:focus-within { box-shadow: 0 0 0 1px var(--ink), var(--dsw-elevation-soft); }\n.md-composer-ctx { display: flex; align-items: center; gap: 5px; width: 100%; min-width: 0; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-composer-ctx span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.md-root .md-composer textarea { flex: 1; min-width: 0; min-height: 32px; padding: 5px 0; border: 0; outline: 0; background: none; resize: none; font-size: 14px; line-height: 22px; }\n\n/* 普通页面 */\n.md-page { position: absolute; inset: 0; overflow-y: auto; padding: 78px 28px 40px; }\n.md-page-head, .md-section-head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 22px; }\n.md-section-head { margin-top: 36px; margin-bottom: 14px; }\n.md-root .md-page-head h1 { font-size: 34px; line-height: 44px; font-weight: 300; letter-spacing: -.015em; }\n.md-root .md-section-head h2 { font-size: 20px; line-height: 28px; font-weight: 400; }\n.md-page-sub { color: var(--ink3); font-size: 13px; line-height: 20px; margin-top: 2px; }\n.md-search { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: var(--r-md); background: var(--card); box-shadow: inset 0 0 0 .5px var(--line-strong); color: var(--ink3); width: 220px; }\n.md-root .md-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--ink); font-size: 13px; }\n.md-empty { padding: 56px 20px; text-align: center; color: var(--ink3); font-size: 13px; }\n.md-empty-title { font-size: 17px; color: var(--ink2); margin-bottom: 4px; }\n.md-panel { padding: 18px 20px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); min-width: 0; }\n.md-panel > header { display: flex; align-items: center; margin-bottom: 12px; min-height: 28px; }\n.md-root .md-panel h2 { font-size: 14px; line-height: 20px; font-weight: 500; }\n\n/* 看板 */\n.md-board { display: grid; grid-template-columns: repeat(5, minmax(190px, 1fr)); gap: 10px; align-items: start; overflow-x: auto; padding-bottom: 8px; }\n.md-board-col { padding: 10px; min-height: 320px; border-radius: var(--r-xl); background: var(--hover); transition: background .2s, box-shadow .2s; }\n.md-board-col.is-over { background: var(--active); box-shadow: inset 0 0 0 1px var(--ink3); }\n.md-board-col > header { display: flex; align-items: center; gap: 7px; padding: 2px 4px 10px; }\n.md-root .md-board-col h3 { font-size: 13px; line-height: 20px; font-weight: 500; }\n.md-board-list { display: flex; flex-direction: column; gap: 8px; }\n.md-board-card { display: block; width: 100%; padding: 6px; border-radius: var(--r-lg); background: var(--card); box-shadow: var(--dsw-elevation-soft); transition: transform .3s cubic-bezier(.2, 1.3, .4, 1); cursor: grab; }\n.md-board-card:hover { transform: translateY(-2px); }\n.md-board-card img { display: block; width: 100%; height: 92px; object-fit: cover; border-radius: 10px; margin-bottom: 6px; }\n.md-board-card strong { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding: 2px 6px 0; font-size: 13px; line-height: 19px; font-weight: 500; }\n.md-board-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; padding: 4px 6px 4px; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-board-meta .is-time { color: var(--accent); }\n\n/* 表格 */\n.md-table-wrap { border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); overflow: auto; }\n.md-table { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 20px; }\n.md-table th { position: sticky; top: 0; z-index: 1; background: var(--card); padding: 10px 12px; text-align: left; font-weight: 400; color: var(--ink3); font-size: 12px; white-space: nowrap; border-bottom: .5px solid var(--line); }\n.md-table th button { display: inline-flex; align-items: center; gap: 3px; }\n.md-table td { padding: 8px 12px; border-bottom: .5px solid var(--line); vertical-align: middle; }\n.md-table tbody tr { cursor: pointer; transition: background .1s; }\n.md-table tbody tr:hover { background: var(--hover); }\n.md-table tbody tr:last-child td { border-bottom: 0; }\n.md-table.is-plain tbody tr { cursor: default; }\n.md-table .is-num { text-align: right; font-variant-numeric: tabular-nums; }\n.md-table-title { display: flex; align-items: center; gap: 12px; min-width: 300px; }\n.md-table-title strong { display: block; font-weight: 500; }\n.md-table-title small { display: block; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n\n/* 对话框与提示 */\n.md-dialog-mask { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--dsw-alias-bg-mask-1); animation: md-fade .18s both; }\n.md-dialog { max-width: 100%; max-height: 100%; overflow: auto; padding: 18px 20px 20px; border-radius: var(--r-panel); background: var(--card); box-shadow: var(--dsw-elevation-prominent); animation: md-pop .4s cubic-bezier(.2, 1.3, .4, 1) both; }\n@keyframes md-pop { from { opacity: 0; transform: scale(.94) translateY(10px); } }\n.md-dialog-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }\n.md-root .md-dialog-head h2 { font-size: 17px; line-height: 24px; font-weight: 500; }\n.md-form { display: flex; flex-direction: column; gap: 12px; }\n.md-field { display: flex; flex-direction: column; gap: 5px; }\n.md-field > span { color: var(--ink2); font-size: 12.5px; line-height: 18px; }\n.md-field small { color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-root .md-field input, .md-root .md-field select, .md-root .md-field textarea { width: 100%; border-radius: var(--r-md); border: .5px solid var(--line-strong); background: var(--card); padding: 7px 11px; font-size: 13.5px; line-height: 22px; outline: 0; resize: vertical; }\n.md-root .md-field input, .md-root .md-field select { height: 36px; padding: 0 11px; }\n.md-root .md-field input:focus, .md-root .md-field select:focus, .md-root .md-field textarea:focus { border-color: var(--ink); }\n.md-form-foot { display: flex; gap: 6px; margin-top: 4px; }\n.md-capture-tabs { display: flex; gap: 2px; padding: 4px; margin-bottom: 14px; border-radius: var(--r-md); background: var(--hover); }\n.md-capture-tabs button { flex: 1; height: 28px; border-radius: var(--r-sm); text-align: center; color: var(--ink3); font-size: 12.5px; }\n.md-capture-tabs button.is-on { background: var(--card); color: var(--ink); box-shadow: var(--dsw-elevation-soft); }\n.md-root .md-dropzone { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; padding: 34px 16px; border-radius: var(--r-lg); border: 1px dashed var(--line-strong); color: var(--ink2); text-align: center; transition: background .15s; }\n.md-root .md-dropzone:hover { background: var(--hover); }\n.md-dropzone small { color: var(--ink3); font-size: 12px; }\n.md-toast { position: absolute; z-index: 70; left: 50%; bottom: 76px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; max-width: min(520px, calc(100% - 32px)); padding: 8px 14px; border-radius: var(--r-lg); background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-prominent); font-size: 13px; line-height: 20px; animation: md-toast .5s cubic-bezier(.2, 1.3, .4, 1) both; }\n@keyframes md-toast { from { opacity: 0; transform: translate(-50%, 14px) scale(.96); } }\n.md-toast.is-error { background: #c33a33; color: #fff; }\n.md-root .md-toast button { flex: none; margin-left: 6px; font-weight: 500; color: inherit; text-decoration: underline dotted; text-underline-offset: 3px; }\n\n@media (prefers-reduced-motion: reduce) {\n  .md-root *, .md-root *::before, .md-root *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }\n  .md-links path { stroke-dashoffset: 0; }\n}\n\n\n/* 视频封面 */\n.md-poster { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 10px; line-height: 0; background: var(--hover); container-type: inline-size; }\n.md-poster[role=\"button\"] { cursor: zoom-in; }\n.md-poster img { display: block; width: 100%; height: 100%; object-fit: cover; animation: md-develop .9s var(--ease) both; }\n.md-poster::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgb(0 0 0 / .62)); pointer-events: none; }\n.md-poster.is-type { background: radial-gradient(90% 90% at 85% 10%, #ffc49688, transparent 70%), linear-gradient(120deg, #1a1b3a, #4a2f6b 58%, #d9745a); }\n.md-poster.is-type::after { display: none; }\n.md-poster b { position: absolute; z-index: 1; left: 5.5cqw; right: 22cqw; bottom: 5.5cqw; color: #fff; font-family: var(--serif); font-weight: 700; font-size: 8.4cqw; line-height: 1.24; text-shadow: 0 1px 10px rgb(0 0 0 / .3); animation: md-rise .6s var(--ease) both; }\n.md-poster[data-status=\"running\"]::before, .md-poster[data-status=\"pending\"]::before { content: ''; position: absolute; inset: 0; z-index: 2; background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / .16) 50%, transparent 70%); background-size: 220% 100%; animation: md-shimmer-bg 1.6s linear infinite; }\n.md-collage-main { aspect-ratio: 16 / 9; width: 78%; left: 0; }\n.md-collage-side { width: 32%; }\n.md-collage-side.is-0 { left: auto; right: 0; top: 3%; bottom: auto; transform: rotate(4deg); z-index: 3; }\n.md-collage-side.is-1 { right: 5%; bottom: 0; transform: rotate(-3deg); z-index: 3; }\n.md-collage-main:last-child { left: 11%; }\n.md-date-pill { position: relative; cursor: pointer; }\n.md-date-pill input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: 0; padding: 0; }\n.md-root .md-pill.is-small { height: 28px; padding: 0 11px; font-size: 12px; }\n.md-style-pick { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: .5px solid var(--line); color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-style-pick.is-follow { margin-top: 8px; padding-top: 0; border-top: 0; }\n.md-format-seg { display: flex; flex: 1; min-width: 0; height: 28px; padding: 2px; border-radius: var(--r-sm); background: var(--hover); }\n.md-root .md-format-seg button { display: inline-flex; align-items: center; justify-content: center; flex: 1; min-width: 0; border-radius: calc(var(--r-sm) - 2px); color: var(--ink3); font-size: 12.5px; line-height: 24px; transition: background .15s, color .15s; }\n.md-root .md-format-seg button.is-on { background: var(--card); color: var(--ink); box-shadow: var(--dsw-elevation-soft); }\n.md-root .md-article-title { font-family: var(--serif); font-size: 22px; line-height: 32px; font-weight: 600; margin: 0 0 16px; text-wrap: balance; }\n.md-root .md-prose.is-script p { margin-bottom: 18px; line-height: 28px; }\n.md-root .md-prose.is-article p { text-align: justify; }\n.md-root .md-style-pick select { flex: 1; min-width: 0; height: 28px; padding: 0 6px; border: 0; border-radius: var(--r-sm); background: var(--hover); color: var(--ink); font-size: 12.5px; outline: 0; }\n\n/* 精致页面的共同底：和工作区一样的底色 + 格子 */\n.md-board-page { position: absolute; inset: 0; overflow: hidden auto; padding: 64px 10px 10px; background: color-mix(in srgb, var(--ink) 3.5%, var(--bg)); container-type: size; }\n.md-i-hero { flex-direction: row; align-items: stretch; gap: 20px; min-height: 176px; padding: 20px 24px; background:\n  radial-gradient(55% 120% at 82% 8%, color-mix(in srgb, #c9b6f2 40%, transparent), transparent 70%),\n  radial-gradient(45% 110% at 100% 92%, color-mix(in srgb, #f7b899 42%, transparent), transparent 72%),\n  radial-gradient(50% 130% at 48% 118%, color-mix(in srgb, #a9cdf5 34%, transparent), transparent 70%),\n  var(--card); }\n.md-root .md-i-line { font-size: clamp(22px, 2.9cqw, 34px); line-height: 1.4; font-weight: 300; letter-spacing: -.012em; color: var(--ink3); }\n.md-i-line b { font-weight: 400; color: var(--ink); }\n.md-i-line .md-inline-pic { width: 1.1em; height: 1.1em; vertical-align: -.2em; }\n.md-i-sample { position: absolute; right: 16px; bottom: 10px; color: var(--ink4); font-size: 11px; }\n.md-i-hero.is-empty { min-height: 280px; }\n\n/* 排期 */\n.md-schedule { height: 100%; min-height: 620px; display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) 248px; }\n@container (max-width: 760px) { .md-schedule { height: auto; grid-template-columns: minmax(0, 1fr); } .md-cal-tile { height: 720px; } .md-tray { height: 420px; flex: none; } }\n.md-cal-tile { padding: 14px 16px 16px; }\n.md-cal-head { flex: none; display: flex; align-items: flex-end; gap: 12px; margin-bottom: 12px; }\n.md-cal-num { font-family: var(--latin-serif); font-size: 64px; line-height: 54px; letter-spacing: -.03em; }\n.md-cal-month { display: flex; flex-direction: column; }\n.md-cal-month span { color: var(--ink3); font-size: 12px; line-height: 15px; }\n.md-cal-month em { font-family: var(--latin-serif); font-size: 24px; line-height: 30px; color: var(--ink2); }\n.md-cal-stats { display: flex; gap: 18px; margin-left: 14px; }\n.md-cal-stats dt { color: var(--ink3); font-size: 11.5px; line-height: 15px; }\n.md-cal-stats dd { font-family: var(--latin-serif); font-size: 22px; line-height: 28px; }\n.md-cal-stats small { margin-left: 2px; font-family: var(--dsw-font-family); font-size: 11.5px; color: var(--ink3); }\n@container (max-width: 840px) { .md-cal-stats { display: none; } }\n.md-cal-weeks { flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding-bottom: 6px; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-cal-weeks span { padding-left: 8px; }\n.md-cal-grid { flex: 1 1 0; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows), minmax(0, 1fr)); gap: 4px; }\n.md-cal-cell { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 5px 6px 6px; overflow: hidden; border-radius: var(--r-md); background: color-mix(in srgb, var(--ink) 2.5%, transparent); transition: background .15s, box-shadow .15s, transform .3s cubic-bezier(.2, 1.3, .4, 1); }\n.md-cal-cell.is-outside { background: none; opacity: .4; }\n.md-cal-cell.is-today { background: color-mix(in srgb, var(--ink) 5%, transparent); }\n.md-cal-cell.is-over { background: var(--active); box-shadow: inset 0 0 0 1.5px var(--ink); transform: scale(1.02); }\n.md-cal-cell-top { flex: none; display: flex; align-items: flex-start; justify-content: space-between; min-height: 22px; }\n.md-cal-date { width: 22px; height: 22px; text-align: center; font-size: 12px; line-height: 22px; color: var(--ink2); border-radius: 50%; corner-shape: round; }\n.md-cal-cell.is-today .md-cal-date { background: var(--primary); color: var(--on-primary); }\n.md-cal-stamp { flex: none; width: 22px; }\n.md-cal-stamp .md-stamp { --s: 4px; --hole: 1px; width: 22px; height: 28px; aspect-ratio: auto; }\n.md-cal-stamp .md-stamp.is-type { font-size: 10px; }\n.md-cal-stamp .md-stamp i { display: none; }\n.md-cal-posts { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 3px; margin-top: 2px; }\n.md-root .md-cal-chip { flex: none; display: flex; align-items: center; gap: 5px; width: 100%; min-width: 0; padding: 2px 5px 2px 2px; border-radius: var(--r-sm); background: var(--card); box-shadow: var(--dsw-elevation-soft); cursor: grab; animation: md-pop .4s cubic-bezier(.2, 1.3, .4, 1) both; transition: transform .25s var(--ease); }\n.md-root .md-cal-chip:hover { transform: translateY(-1px); }\n.md-cal-thumb { flex: none; width: 22px; height: 22px; border-radius: 5px; overflow: hidden; background: radial-gradient(90% 90% at 85% 10%, #ffc49688, transparent 70%), linear-gradient(120deg, #1a1b3a, #4a2f6b 58%, #d9745a); }\n.md-cal-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }\n.md-cal-chip-text { min-width: 0; flex: 1; display: flex; flex-direction: column; }\n.md-cal-chip-text time { color: var(--ink3); font-size: 10px; line-height: 12px; font-variant-numeric: tabular-nums; }\n.md-cal-chip-text span { font-size: 11px; line-height: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.md-cal-more { color: var(--ink3); font-size: 10.5px; line-height: 14px; padding-left: 4px; }\n.md-rail-col { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }\n.md-root .md-next { flex: none; display: block; width: 100%; padding: 12px 14px; border-radius: var(--r-xl); background: var(--primary); color: var(--on-primary); box-shadow: var(--dsw-elevation-soft); transition: transform .35s cubic-bezier(.2, 1.3, .4, 1); }\n.md-root .md-next:hover { transform: translateY(-2px); }\n.md-next-top { display: flex; justify-content: space-between; font-size: 11.5px; line-height: 16px; opacity: .7; }\n.md-next b { display: block; margin-top: 2px; font-family: var(--latin-serif); font-size: 28px; line-height: 36px; font-weight: 400; font-variant-numeric: tabular-nums; }\n.md-next p { font-size: 13px; line-height: 19px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.md-next-foot { display: block; margin-top: 6px; font-size: 11.5px; line-height: 16px; opacity: .7; }\n.md-tray { flex: 1; transition: box-shadow .2s; }\n.md-tray.is-over { box-shadow: inset 0 0 0 1.5px var(--ink), var(--dsw-elevation-soft); }\n@container (max-width: 760px) { .md-rail-col .md-tray { flex: none; height: 420px; } }\n.md-tray-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 12px; }\n.md-root .md-tray-scroll h3 { margin: 6px 2px 8px; color: var(--ink3); font-size: 12px; line-height: 16px; font-weight: 400; }\n.md-tray-scroll h3 span { margin-left: 2px; }\n.md-tray-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 10px; }\n.md-root .md-tray-card { display: block; width: 100%; cursor: grab; transition: transform .3s cubic-bezier(.2, 1.3, .4, 1); }\n.md-root .md-tray-card:hover { transform: translateY(-2px) rotate(-.6deg); }\n.md-tray-cover { position: relative; display: block; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--r-md); box-shadow: var(--dsw-elevation-soft); container-type: inline-size; }\n.md-tray-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }\n.md-tray-cover.is-type { background: radial-gradient(90% 90% at 85% 10%, #ffc49688, transparent 70%), linear-gradient(120deg, #1a1b3a, #4a2f6b 58%, #d9745a); }\n.md-tray-cover b { position: absolute; left: 6cqw; right: 6cqw; bottom: 5cqw; color: #fff; font-family: var(--serif); font-size: 8.6cqw; line-height: 1.25; font-weight: 700; }\n.md-tray-title { display: block; margin-top: 5px; font-size: 12px; line-height: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink2); }\n.md-tray-list { display: flex; flex-direction: column; gap: 2px; margin: 0 -4px; }\n.md-root .md-tray-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px; border-radius: var(--r-sm); font-size: 12px; line-height: 17px; cursor: grab; transition: background .12s; }\n.md-root .md-tray-item:hover { background: var(--hover); }\n.md-tray-item > span:last-child { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n\n/* 复盘 */\n.md-insights { min-height: 100%; display: grid; gap: 10px; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); grid-template-rows: auto minmax(240px, 290px) minmax(250px, 300px); grid-template-areas: \"hero hero\" \"trend platforms\" \"top advice\"; }\n@container (max-width: 760px) { .md-insights { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-template-areas: \"hero\" \"trend\" \"platforms\" \"top\" \"advice\"; } .md-i-trend { height: 300px; } }\n.md-insights .md-i-hero { grid-area: hero; }\n.md-i-trend { grid-area: trend; }\n.md-i-platforms { grid-area: platforms; }\n.md-i-top { grid-area: top; }\n.md-i-advice { grid-area: advice; }\n.md-metrics { flex: none; align-self: center; display: flex; gap: 22px; margin-right: 8px; }\n.md-metric dt { color: var(--ink3); font-size: 12px; line-height: 16px; }\n.md-metric dd { font-family: var(--latin-serif); font-size: 32px; line-height: 42px; letter-spacing: -.01em; }\n.md-metric small { margin-left: 2px; font-family: var(--dsw-font-family); font-size: 12px; color: var(--ink3); }\n@container (max-width: 760px) { .md-metrics { display: none; } }\n.md-i-chart { flex: 1; min-height: 0; padding: 0 16px 10px 8px; display: flex; }\n.md-chart { position: relative; flex: 1; min-width: 0; min-height: 0; }\n.md-chart svg { display: block; overflow: visible; position: absolute; inset: 0; }\n.md-chart-grid { stroke: var(--line); stroke-width: .5; }\n.md-chart-axis { fill: var(--ink3); font-size: 11px; }\n.md-chart-line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; animation: md-draw 1.2s var(--ease) both; stroke-dashoffset: 1; }\n.md-chart-area { fill: color-mix(in srgb, var(--accent) 9%, transparent); animation: md-fade 1s .3s both; }\n.md-chart-cross { stroke: var(--line-strong); stroke-width: 1; }\n.md-chart-dot { fill: var(--accent); stroke: var(--card); stroke-width: 2; }\n.md-chart-tip { position: absolute; display: flex; flex-direction: column; min-width: 120px; padding: 7px 10px; border-radius: var(--r-md); background: var(--card); box-shadow: var(--dsw-elevation-panel); pointer-events: none; font-size: 12px; line-height: 17px; }\n.md-chart-tip small { color: var(--ink3); font-size: 11px; }\n.md-chart-tip b { font-weight: 500; }\n.md-i-table { flex: 1; min-height: 0; overflow-y: auto; }\n.md-bars { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 0 18px 16px; overflow-y: auto; }\n.md-bars li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 8px; align-items: baseline; font-size: 12.5px; line-height: 17px; color: var(--ink2); }\n.md-bars b { font-family: var(--latin-serif); font-size: 18px; line-height: 22px; font-weight: 400; color: var(--ink); text-align: right; }\n.md-bar-track { grid-column: 1 / -1; height: 6px; border-radius: 999px; corner-shape: round; background: var(--hover); overflow: hidden; }\n.md-bar-track i { display: block; height: 100%; border-radius: 999px; corner-shape: round; background: var(--accent); transform-origin: left; animation: md-grow 1s var(--ease) both; }\n@keyframes md-grow { from { transform: scaleX(0); } }\n.md-top { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px; }\n.md-root .md-top button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 10px 6px 8px; border-radius: var(--r-md); transition: background .12s; }\n.md-root .md-top button:hover { background: var(--hover); }\n.md-top-rank { flex: none; width: 16px; text-align: center; font-family: var(--latin-serif); font-size: 16px; color: var(--ink3); }\n.md-top-title { flex: 1; min-width: 0; }\n.md-top-title strong { display: block; font-weight: 500; font-size: 13px; line-height: 19px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.md-top-title small { display: block; color: var(--ink3); font-size: 11.5px; line-height: 16px; }\n.md-top b { font-family: var(--latin-serif); font-size: 18px; font-weight: 400; white-space: nowrap; }\n.md-i-advice-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 0 18px 16px; }\n.md-i-advice-list > p { font-size: 13px; line-height: 20px; }\n.md-i-tip strong { display: block; font-weight: 500; font-size: 13.5px; line-height: 20px; }\n.md-i-tip p { margin: 1px 0 6px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n\n/* 风格 */\n.md-style-page { display: flex; flex-direction: column; gap: 10px; min-height: 100%; }\n.md-style-hero { flex: none; min-height: 164px; }\n.md-inline-avatar { display: inline-flex; width: 1.2em; height: 1.2em; vertical-align: -.22em; font-size: .9em; }\n.md-avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; border-radius: 50%; corner-shape: round; color: rgb(0 0 0 / .72); font-weight: 500; line-height: 1; }\n.md-style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }\n.md-style { display: flex; flex-direction: column; min-width: 0; padding: 14px 16px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--dsw-elevation-soft); transition: transform .4s cubic-bezier(.2, 1.3, .4, 1), box-shadow .2s; animation: md-rise .5s var(--ease) both; }\n.md-style:hover { transform: translateY(-2px); box-shadow: var(--dsw-elevation-prominent); }\n.md-style.is-active { box-shadow: 0 0 0 1.5px var(--ink), var(--dsw-elevation-soft); }\n.md-style > header { display: flex; align-items: center; gap: 10px; }\n.md-style > header strong { display: block; font-size: 15px; line-height: 21px; font-weight: 500; }\n.md-style > header small { display: block; color: var(--ink3); font-size: 11.5px; line-height: 15px; }\n.md-style-summary { margin-top: 10px; font-size: 13px; line-height: 20px; color: var(--ink2); }\n.md-style blockquote { margin-top: 10px; padding-left: 10px; border-left: 1.5px solid var(--line-strong); font-family: var(--serif); font-size: 13.5px; line-height: 22px; color: var(--ink); }\n.md-style-words { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }\n.md-style-words span { padding: 0 8px; border-radius: 999px; corner-shape: round; background: var(--hover); color: var(--ink2); font-size: 11.5px; line-height: 20px; }\n.md-style > footer { margin-top: auto; padding-top: 12px; }\n.md-root .md-style-add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 180px; border-radius: var(--r-xl); border: 1px dashed var(--line-strong); color: var(--ink3); font-size: 13px; transition: background .15s, color .15s; }\n.md-root .md-style-add:hover { background: var(--card); color: var(--ink); }\n.md-rules { flex: none; }\n.md-rules ul { padding: 0 8px 8px; }\n.md-rule { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--r-md); }\n.md-rule > div { flex: 1; min-width: 0; }\n.md-rule strong { display: block; font-size: 13.5px; line-height: 20px; font-weight: 500; }\n.md-rule p { color: var(--ink2); font-size: 12.5px; line-height: 19px; }\n.md-rule .md-icon-btn { width: 28px; height: 28px; opacity: 0; transition: opacity .15s; }\n.md-rule:hover .md-icon-btn, .md-rule .md-icon-btn:focus-visible { opacity: 1; }\n.md-rule-empty { padding: 8px 10px 12px; font-size: 13px; }\n.md-rules .md-tile-head .md-pill { margin-left: 4px; }\n\n/* 抓账号 */\n.md-setup-lead { color: var(--ink2); font-size: 13px; line-height: 20px; }\n.md-setup ol { display: flex; flex-direction: column; gap: 14px; margin: 14px 0 16px; counter-reset: step; }\n.md-setup li { position: relative; padding-left: 30px; counter-increment: step; }\n.md-setup li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; corner-shape: round; background: var(--hover); color: var(--ink2); text-align: center; font-size: 11.5px; line-height: 20px; }\n.md-setup li strong { display: block; font-size: 13.5px; line-height: 20px; font-weight: 500; }\n.md-setup li span { display: block; color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-setup li a { display: inline-block; margin-top: 4px; color: var(--dsw-alias-link); font-size: 12.5px; line-height: 18px; }\n.md-copy-line { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 5px 5px 5px 10px; border-radius: var(--r-md); background: var(--hover); }\n.md-copy-line code { flex: 1; min-width: 0; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 18px; user-select: all; }\n.md-setup-note { margin-bottom: 10px; color: var(--ink2); font-size: 12.5px; line-height: 18px; }\n.md-setup-note.is-error { color: var(--dsw-alias-danger, #c0392b); }\n.md-root .md-setup-check { width: 100%; }\n.md-saved-accounts { display: flex; flex-wrap: wrap; gap: 4px; }\n.md-setup-foot { color: var(--ink3); font-size: 11.5px; line-height: 17px; }\n.md-monid-balance { align-self: center; color: var(--ink3); font-size: 12px; white-space: nowrap; }\n.md-root .md-inline-link { color: var(--dsw-alias-link); font-size: inherit; line-height: inherit; }\n\n/* 风格板块 */\n.md-style-icon { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: var(--hover); font-size: 21px; line-height: 1; }\n.md-inline-emoji { font-size: .92em; }\n.md-style-section > h2 { display: flex; align-items: center; gap: 6px; margin: 6px 2px 8px; color: var(--ink2); font-size: 13px; line-height: 20px; font-weight: 500; }\n.md-style-filter { flex: none; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }\n.md-root .md-style-filter button { height: 30px; padding: 0 12px; border-radius: 999px; corner-shape: round; color: var(--ink2); font-size: 12.5px; transition: background .15s, color .15s; }\n.md-root .md-style-filter button:hover { background: var(--hover); }\n.md-root .md-style-filter button.is-on { background: var(--primary); color: var(--on-primary); }\n.md-style-page .md-style-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }\n.md-style-page .md-style blockquote { font-size: 13px; line-height: 21px; }\n\n/* 空状态 */\n.md-hero-hint { margin-top: 10px; color: var(--ink3); font-size: 12.5px; line-height: 18px; animation: md-rise .5s var(--ease) both; }\n.md-tray-empty { padding: 4px 2px 10px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n\n.md-poster .md-plate-failed { z-index: 3; }\n.md-root button.md-plate-failed { cursor: pointer; }\n.md-root button.md-plate-failed:hover { color: var(--ink); }\n\n/* 手机宽度：DSH 0.2.2 起网页版可以在手机上打开。顶栏导航可横向滑动，次要按钮收起，灵感墙标题缩到屏幕宽度内 */\n.md-root { container: md-root / inline-size; }\n@container md-root (max-width: 560px) {\n  .md-topbar { gap: 6px; padding: 10px 10px 10px max(10px, var(--dsh-frame-leading-clearance, 0px)); }\n  .md-nav { flex: 0 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: none; }\n  .md-nav::-webkit-scrollbar { display: none; }\n  .md-nav button { padding: 0 10px; }\n  .md-sample { display: none; }\n  .md-open-dock { width: 36px; padding: 0; justify-content: center; font-size: 0; gap: 0; }\n  .md-open-dock svg { flex: none; }\n  .md-hero-anchor { width: min(520px, calc(100cqw - 40px)); }\n  .md-root .md-hero-line { font-size: 24px; line-height: 34px; }\n  .md-hero-input { height: 44px; }\n  .md-board-page { padding-top: 58px; }\n}\n\n/* 记灵感时拉到眼前的相关灵感 */\n.md-node.is-related { z-index: 9; }\n.md-node.is-related .md-card, .md-wall-cell.is-related .md-card { box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--accent, #6b5cff) 55%, transparent), var(--dsw-elevation-soft); }\n.md-node.is-dim { opacity: .28; filter: saturate(.5); }\n.md-hero-related { margin-top: 10px; display: flex; gap: 10px; align-items: baseline; color: var(--ink2); font-size: 12.5px; line-height: 18px; animation: md-rise .5s var(--ease) both; }\n\n\n/* 新版本提示：顶栏的小胶囊 + 设置底部的版本行 */\n.md-update { display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 999px; corner-shape: round; color: var(--ink); font-size: 12px; line-height: 28px; text-decoration: none; white-space: nowrap; background: color-mix(in srgb, var(--accent, #6b5cff) 14%, var(--glass)); box-shadow: inset 0 0 0 .5px var(--line-strong); backdrop-filter: blur(24px); transition: background .15s; }\n.md-update:hover { background: color-mix(in srgb, var(--accent, #6b5cff) 24%, var(--glass)); }\n.md-version { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 14px 0 4px; color: var(--ink3); font-size: 12px; line-height: 18px; }\n.md-version a { color: var(--accent, #6b5cff); text-decoration: none; }\n.md-version a:hover { text-decoration: underline; }\n.md-i-hero .md-hero-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}\n.md-hero-actions{display:flex;gap:8px;margin-top:8px}"

    // 会话栏必须跟随科灵栏自身主题：只用 .md-root 的语义 token，不用 --dsw-alias 浅色兜底，
    // 否则深色 dock 上会出现白底浮层 / 浅灰字看不见（见投诉截图）。
    const CHATBAR_CSS = [
      '.md-chatbar { display: flex; align-items: center; gap: 8px; padding: 8px 18px; border-bottom: 1px solid var(--line); position: relative; background: color-mix(in srgb, var(--card) 62%, transparent); }',
      // 新建 / 找历史改用 F（md-icon-btn）纯图标 + tooltip，去掉独立 pill 样式。
      '.md-chatbar-cur { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--card); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 4px 8px; color: var(--ink); cursor: pointer; font-size: 13px; }',
      '.md-chatbar-cur:hover { background: var(--hover); }',
      '.md-chatbar-cur span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.md-chatmenu { position: absolute; left: 18px; right: 18px; top: 100%; z-index: 60; max-height: 260px; overflow-y: auto; background: var(--card); border: 1px solid var(--line-strong); border-radius: var(--r-md); box-shadow: var(--dsw-elevation-prominent); padding: 4px; color: var(--ink); }',
      '.md-chatmenu-row { display: flex; align-items: center; gap: 2px; padding: 2px 4px; border-radius: var(--r-xs); }',
      '.md-chatmenu-row:hover { background: var(--hover); }',
      '.md-chatmenu-row.is-on { background: var(--active); }',
      '.md-chatmenu-name { flex: 1; min-width: 0; text-align: left; background: transparent; border: 0; color: var(--ink); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 5px 4px; font-size: 13px; }',
      '.md-chatmenu-row input { flex: 1; min-width: 0; font-size: 13px; padding: 4px 6px; border: 1px solid var(--line-strong); border-radius: var(--r-xs); background: var(--card); color: var(--ink); }',
      '.md-chatmenu-save { display: block; width: 100%; margin-top: 4px; background: var(--card); border: 1px solid var(--line); border-radius: var(--r-xs); padding: 6px; cursor: pointer; color: var(--ink); font-size: 12px; }',
      '.md-chatmenu-save:hover { background: var(--hover); }',
      // 找历史入口 / 人话会话卡：与会话栏共用语义 token，绝不引入浅色兜底。
      '.md-chatmenu-row.is-card { align-items: flex-start; }',
      '.md-chatsearch { position: absolute; left: 18px; right: 18px; top: 100%; z-index: 61; background: var(--card); border: 1px solid var(--line-strong); border-radius: var(--r-md); box-shadow: var(--dsw-elevation-prominent); padding: 8px; color: var(--ink); }',
      '.md-chatsearch-form { display: flex; gap: 11px; align-items: center; }',
      '.md-chatsearch-form input { flex: 1; min-width: 0; font-size: 13px; padding: 5px 8px; border: 1px solid var(--line); border-radius: var(--r-xs); background: color-mix(in srgb, var(--ink) 4%, transparent); color: var(--ink); outline: none; transition: border-color .15s; }',
      '.md-chatsearch-form input::placeholder { color: var(--ink3); }',
      '.md-chatsearch-form input:focus { outline: none; border-color: var(--accent); }',
      '.md-chatsearch :focus-visible { outline: 1px solid var(--line-strong); outline-offset: 1px; }',
      '.md-chatsearch-scope { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin: 2px 0 6px; }',
      '.md-chatsearch-scope-label { font-size: 12px; color: var(--ink3); margin-right: 2px; }',
      '.md-chatsearch-chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--ink2); cursor: pointer; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.md-chatsearch-chip.is-on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }',
      '.md-chatsearch-list { margin-top: 6px; max-height: 220px; overflow-y: auto; }',
      '.md-chatsearch-row { display: block; width: 100%; text-align: left; padding: 6px; border-radius: var(--r-xs); background: transparent; color: var(--ink); cursor: pointer; }',
      '.md-chatsearch-row:hover { background: var(--hover); }',
      '.md-chatcard { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 4px; text-align: left; background: transparent; color: var(--ink); cursor: pointer; }',
      '.md-chatcard-title { font-size: 13px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }',
      '.md-chatcard-summary { font-size: 11px; color: var(--ink2); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }',
      '.md-chatcard-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; width: 100%; }',
      '.md-chatcard-time { margin-left: auto; flex: none; font-size: 11px; color: var(--ink3); white-space: nowrap; }',
      '.md-chatcard-pill { flex: none; padding: 0 6px; border-radius: 999px; border: 1px solid currentColor; font-size: 10px; line-height: 16px; }',
      '.md-chatcard-pill.oc-topic { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }',
      '.md-chatcard-pill.oc-exp { color: var(--primary); background: color-mix(in srgb, var(--primary) 14%, transparent); }',
      '.md-chatcard-pill.oc-draft { color: var(--ink2); background: color-mix(in srgb, var(--ink2) 14%, transparent); }',
      '.md-chatcard-pill.oc-decision { color: var(--ink); background: color-mix(in srgb, var(--ink) 12%, transparent); }',
      '.md-chatcard-tag { flex: none; font-size: 10px; color: var(--ink3); }',
    ]
    function injectStyles() {
      if (typeof document === 'undefined' || document.querySelector('style[data-rd="1"]')) return
      const style = document.createElement('style')
      style.setAttribute('data-rd', '1')
      style.textContent = CSS + '\n' + CHATBAR_CSS.join('\n')
      document.head.appendChild(style)
    }

    // 复盘页专用样式：转化漏斗 / 产出节奏 / 资料利用度 / 一键建议。所有颜色走 DSH 语义 token。
    const INSIGHTS_CSS = [
      '/* 复盘页专用：转化漏斗 / 产出节奏 / 资料利用度 / 一键建议 */',
      '/* 复盘布局回归基础五宫格：hero 跨整行 + trend/platforms/top/advice 2×2 */',
      '/* 下半区：研究过程分析分区（分区叠加，不混入五宫格） */',
      '.md-section-label{font-size:13px;font-weight:600;color:var(--ink2);margin:20px 2px 0}',
      '.md-i-top .md-desk-feed-row .md-top-title{flex:1;min-width:0}',
      '.md-i-top .md-desk-feed-list{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin}',
      '.md-insights-toolshead{display:flex;align-items:center;gap:8px}',
      '.md-insights-toolshead .md-grow{flex:1}',
      '.md-insights-extra{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;margin-top:8px}',
      '.md-insights-extra>.md-tile{height:250px;grid-area:auto;overflow:hidden}',
      '.md-insights-extra .md-i-chart-svg{height:150px;margin:4px 0 6px}',
      '.md-insights-extra>.md-i-advice{grid-column:1/-1;height:auto;min-height:0}',
      '.md-i-trend .md-i-chart-svg{flex:1;min-height:0;width:100%;margin:0;box-sizing:border-box;padding:0 18px}',
      '.md-insights-extra .md-i-chart-svg{box-sizing:border-box;padding:0 18px}',
      '.md-i-platforms .md-bars{justify-content:space-evenly;padding-bottom:8px}',
      '.md-i-advice .md-suggest{flex:1;justify-content:space-around;padding-top:4px}',
      '.md-funnel{display:flex;align-items:stretch;gap:0;margin:6px 18px 0}',
      '.md-funnel-step{flex:1;min-width:0;padding:14px 12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);text-align:left}',
      '.md-funnel-step b{display:block;font-size:26px;line-height:1.2;color:var(--ink);font-weight:650}',
      '.md-funnel-step b small{font-size:12px;color:var(--ink3);font-weight:500;margin-left:3px}',
      '.md-funnel-step span{display:block;font-size:12.5px;color:var(--ink2);margin-top:5px;font-weight:600}',
      '.md-funnel-step i{display:block;font-style:normal;font-size:11px;color:var(--ink3);margin-top:3px}',
      '.md-funnel-arrow{flex:none;width:26px;display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:18px;font-weight:500}',
      '.md-funnel-rate{margin:14px 18px 18px;font-size:12.5px;color:var(--ink2);line-height:1.7}',
      '.md-funnel-rate b{color:var(--primary)}',
      '.md-pace{display:flex;gap:6px;align-items:flex-end;height:150px;padding:8px 0}',
      '.md-pace-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;min-width:0}',
      '.md-pace-bars{display:flex;gap:2px;align-items:flex-end;height:120px;width:100%;justify-content:center}',
      '.md-pace-bars i{width:22%;max-width:14px;border-radius:3px 3px 0 0;min-height:2px}',
      '.md-pace-bars .md-pace-idea{background:var(--primary);opacity:.55}',
      '.md-pace-bars .md-pace-topic{background:var(--accent);opacity:.7}',
      '.md-pace-bars .md-pace-done{background:var(--primary)}',
      '.md-pace-col small{font-size:10.5px;color:var(--ink3);white-space:nowrap}',
      '.md-pace-legend{display:flex;gap:14px;font-size:11px;color:var(--ink3);margin-top:6px}',
      '.md-pace-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px}',
      '.md-util-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:6px 18px 0}',
      '.md-util-cell{padding:14px 14px 16px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card)}',
      '.md-util-cell b{display:block;font-size:26px;color:var(--ink)}',
      '.md-util-cell span{font-size:12px;color:var(--ink2)}',
      '.md-util-cell small{display:block;font-size:11px;color:var(--ink3);margin-top:6px;line-height:1.5}',
      '.md-suggest{display:flex;flex-direction:column;gap:10px;margin-top:4px}',
      '.md-suggest-row{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card)}',
      '.md-suggest-row b{flex:none;width:22px;height:22px;border-radius:50%;background:var(--primary);color:var(--on-primary);font-size:12px;display:flex;align-items:center;justify-content:center}',
      '.md-suggest-row p{margin:0;flex:1;font-size:13px;color:var(--ink);line-height:1.6}',
      '.md-suggest-row p small{display:block;color:var(--ink3);font-size:11.5px;margin-top:3px}',
      '@media(max-width:840px){.md-root .md-insights{grid-template-columns:1fr}.md-insights-extra{grid-template-columns:1fr}.md-funnel{flex-wrap:wrap}.md-funnel-step{flex-basis:calc(50% - 13px)}.md-funnel-arrow{display:none}.md-util-grid{grid-template-columns:1fr}}'
    ].join(String.fromCharCode(10))

    // 智能资料台：研究画像 / 任务台 / 汇集分区。颜色全走 DSH 语义 token，不碰 :26 单行 CSS。
    const SMARTDESK_CSS = [
      '/* 智能资料台 */',
      '.md-desk-stack{display:flex;flex-direction:column;gap:14px}',
      '.md-desk-stack .md-section-label{margin:2px 0 0}',
      '.md-desk-profile-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:6px 16px 16px}',
      '.md-desk-pcell{padding:14px 15px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);display:flex;flex-direction:column;gap:6px}',
      '.md-desk-pcell-top{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink2);font-weight:600}',
      '.md-desk-pcell-top i{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--primary) 12%,transparent);color:var(--primary)}',
      '.md-desk-pcell b{font-size:22px;line-height:1.2;color:var(--ink);font-weight:600}',
      '.md-desk-pcell b small{font-size:12px;color:var(--ink3);font-weight:500;margin-left:3px}',
      '.md-desk-pcell-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px;min-height:20px}',
      '.md-desk-pcell-list em{font-style:normal;font-size:11px;color:var(--ink2);border:1px solid var(--line);border-radius:var(--r-xs);padding:2px 7px;background:var(--card);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.md-desk-pcell-note{margin-top:auto;padding-top:9px;border-top:1px dashed var(--line);font-size:11px;line-height:1.55;color:var(--ink3)}',
      '.md-desk-taskform{position:relative;display:flex;align-items:center;gap:10px;margin:0 16px 14px;padding:9px 9px 9px 12px;border-radius:var(--r-panel);background:linear-gradient(100deg,color-mix(in srgb,var(--primary) 12%,var(--card)),color-mix(in srgb,#c9b6f2 10%,var(--card)) 55%,color-mix(in srgb,var(--accent) 9%,var(--card)));box-shadow:var(--dsw-elevation-soft),inset 0 0 0 .5px color-mix(in srgb,var(--primary) 26%,transparent);transition:box-shadow .2s var(--ease)}',
      '.md-desk-taskform:focus-within{box-shadow:0 0 0 1px var(--primary),var(--dsw-elevation-soft)}',
      '.md-desk-taskform .md-desk-task-spark{flex:none;width:32px;height:32px;border-radius:50%;corner-shape:round;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--primary) 18%,transparent);color:var(--primary)}',
      '.md-desk-taskform input{flex:1;min-width:0;height:32px;padding:0;border:0;outline:0;background:none;font-size:14px;color:var(--ink)}',
      '.md-desk-taskform input::placeholder{color:var(--ink3)}',
      '.md-root .md-desk-taskform input:focus-visible{outline:none;outline-offset:0}',
      '.md-desk-tasks{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}',
      '.md-desk-task{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);text-align:left;cursor:pointer;transition:border-color .15s,transform .15s}',
      '.md-desk-task:hover{border-color:var(--primary);transform:translateY(-1px)}',
      '.md-desk-task.is-active{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,var(--card))}',
      '.md-desk-task .md-desk-task-ic{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary)}',
      '.md-desk-task strong{font-size:13px;color:var(--ink)}',
      '.md-desk-task small{font-size:11px;color:var(--ink3);line-height:1.5}',
      '.md-desk-task{min-height:92px}',
      '.md-desk-feed{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:8px;align-items:start}',
      '.md-desk-feed>.md-tile{min-height:220px;grid-area:auto}',
      '.md-desk-feed-list{padding:4px 10px 10px;display:flex;flex-direction:column;gap:2px}',
      '.md-desk-feed-row{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:var(--r-md)}',
      '.md-desk-feed-row+.md-desk-feed-row{border-top:1px solid var(--line)}',
      '.md-desk-feed-row .md-top-title b{display:block;font-size:13px;color:var(--ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '.md-desk-feed-row .md-top-title small{display:block;font-size:11px;color:var(--ink3);margin-top:2px}',
      '.md-desk-feed-row .md-btn{flex:none;margin-left:auto}',
      '@media(max-width:840px){.md-desk-feed,.md-desk-profile-grid{grid-template-columns:1fr}}',
      /* L4 画像蒸馏与纠错 */
      '.md-desk-profile-edit{margin:2px 16px 14px;padding:12px 14px;border:1px dashed var(--line);border-radius:var(--r-md);background:color-mix(in srgb,var(--card) 85%,var(--hover))}',
      '.md-profile-edit-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}',
      '.md-profile-edit-head h3{margin:0;font-size:13px;color:var(--ink);font-weight:600}',
      '.md-profile-edit-head .md-pill{margin-left:auto}',
      '.md-profile-edit-group{display:grid;grid-template-columns:minmax(96px,120px) 1fr minmax(160px,220px);gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}',
      '.md-profile-edit-label b{display:block;font-size:12px;color:var(--ink)}',
      '.md-profile-edit-label span{display:block;font-size:11px;color:var(--ink3);line-height:1.4;margin-top:2px}',
      '.md-profile-edit-chips{display:flex;flex-wrap:wrap;gap:6px;min-height:24px;align-items:center}',
      '.md-profile-edit-chips em{font-style:normal;font-size:11px;color:var(--ink3)}',
      '.md-profile-chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:3px 4px 3px 9px;border-radius:99px;background:color-mix(in srgb,var(--primary) 10%,transparent);color:var(--ink2);font-size:11.5px;border:1px solid color-mix(in srgb,var(--primary) 22%,transparent)}',
      '.md-profile-chip>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.md-profile-chip-x{flex:none;width:16px;height:16px;padding:0;border:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:transparent;color:var(--ink3);cursor:pointer}',
      '.md-profile-chip-x:hover{background:color-mix(in srgb,var(--primary) 18%,transparent);color:var(--ink)}',
      '.md-profile-edit-form{display:flex;gap:6px}',
      '.md-profile-edit-form input{flex:1;min-width:0;height:28px;padding:0 8px;border:1px solid var(--line);border-radius:var(--r-xs);background:var(--card);color:var(--ink);font-size:12px;outline:none}',
      '.md-profile-edit-form input:focus{border-color:var(--primary)}',
      '.md-profile-edit .md-empty{padding:8px 0}',
      '@media(max-width:840px){.md-profile-edit-group{grid-template-columns:1fr}}'
    ].join(String.fromCharCode(10))

    // 诊断留痕：把最近一次后端请求的地址/源/失败真相写到 localStorage，
    // 让"自检"能读到真实运行态，而不是靠猜（自建 headless 环境测不出用户 GUI 的冷启动竞态）。
    function recordHostDiag(info) {
      try {
        var prev
        try { prev = JSON.parse(localStorage.getItem('rd.hostDiag') || '{}') } catch (e) { prev = {} }
        localStorage.setItem('rd.hostDiag', JSON.stringify(Object.assign({}, prev, info, { at: Date.now() })))
      } catch (e) {}
    }

    async function call(payload, attempt) {
      // 外部 signal（停止生成）优先；否则用 180s 超时兜底。
      const ext = payload && payload._externalSignal
      const ctrl = ext ? null : new AbortController()
      const timer = ctrl ? setTimeout(function () { ctrl.abort() }, 180000) : null
      const sig = ext || (ctrl && ctrl.signal)
      const url = hostRouteUrl(ROUTE).href
      const tries = typeof attempt === 'number' ? attempt : 0
      recordHostDiag({ url: url, base: (typeof document !== 'undefined' && document.baseURI) || '', action: payload && payload.action, attempt: tries })
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal: sig,
      })
      if (timer) clearTimeout(timer)
      // 冷启动/热重载时 webServer 可能比插件晚就绪，首次 404 多是竞态：
      // 参照官方 dsh-steward，延迟 700ms 重试一次再判失败。
      if (res.status === 404 && tries === 0) {
        await new Promise(function (r) { setTimeout(r, 700) })
        return call(payload, tries + 1)
      }
      if (!res.ok) {
        var detail = 'HTTP ' + res.status
        if (res.status === 404) {
          detail = '后端路由没挂上（HTTP 404）。界面已加载但 /api/research-desk/ 这段路由没注册——'
            + '多为 DSH 冷启动时后端比面板晚就绪。请点顶栏闪电「自检并就地重载」重试；'
            + '若仍失败，需彻底退出 DSH（含托盘）后重开。诊断：' + url
        }
        recordHostDiag({ lastStatus: res.status, lastUrl: url, failed: true })
        throw new Error(detail)
      }
      recordHostDiag({ lastStatus: res.status, failed: false })
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
    function textIsChinese(text) {
      return /[\u4e00-\u9fff]/.test(String(text || ''))
    }
    // 科灵台语言：显式设置优先；host 档真正跟随 DSH 宿主语言。
    // 宿主语言由 __DSH_LOCALE__ bridge 提供（locale 插件权威信号），读不到时安全回退中文。
    function effectiveLang(localeId, hostLang) {
      if (localeId === 'en') return 'en'
      if (localeId === 'zh') return 'zh'
      // host 档：跟随 DSH 宿主语言；未知信号一律按中文，绝不再读静态 html lang 初值误判。
      return hostLang === 'en' ? 'en' : 'zh'
    }
    function isIdentityChat(text) {
      const s = String(text || '').trim()
      return /^(你是(?!怎么|如何|否)|你是谁|你是啥|你叫什么|你的名字|介绍一下(你|你自己)|自我介绍|你好|您好|嗨|hi\b|hello\b|who are you\b|what can you do\b|你能做什么|你能干嘛|你会什么|你能帮我做什么)/i.test(s)
    }

    // 把模型输出的轻量 Markdown 渲染成 React 节点：标题 / 粗体 / 行内码 / 代码块 / 有序·无序列表 / 引用 / 分隔线。
    // 服务端负责“算好人话”，这里只负责渲染，不引入任何 markdown 依赖。
    function inlineMd(text, keyBase) {
      const out = []
      const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
      let last = 0, m, n = 0
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index))
        const tok = m[0]
        if (tok.startsWith('**')) out.push(h('strong', { key: keyBase + '-b' + (n++) }, tok.slice(2, -2)))
        else out.push(h('code', { key: keyBase + '-c' + (n++) }, tok.slice(1, -1)))
        last = m.index + tok.length
      }
      if (last < text.length) out.push(text.slice(last))
      return out
    }
    function renderRichText(text) {
      const src = String(text == null ? '' : text)
      const lines = src.replace(/\r\n?/g, '\n').split('\n')
      const nodes = []
      let list = null, listKey = 0, code = null, codeKey = 0
      const flushList = () => { if (list) { nodes.push(h(list.tag, { key: 'l' + (listKey++) }, list.items)); list = null } }
      const flushCode = () => { if (code) { nodes.push(h('pre', { key: 'c' + (codeKey++) }, h('code', null, code.join('\n')))); code = null } }
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        let m
        if (/^\s*```/.test(line)) { flushList(); if (code) flushCode(); else code = []; continue }
        if (code) { code.push(line); continue }
        if ((m = line.match(/^\s*##\s+(.*)$/))) { flushList(); nodes.push(h('h4', { key: 'h' + i }, inlineMd(m[1], 'h' + i))); continue }
        if ((m = line.match(/^\s*#\s+(.*)$/))) { flushList(); nodes.push(h('h3', { key: 'h' + i }, inlineMd(m[1], 'h' + i))); continue }
        if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { flushList(); nodes.push(h('hr', { key: 'r' + i })); continue }
        if ((m = line.match(/^\s*(\d+)\.\s+(.*)$/))) {
          if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] } }
          list.items.push(h('li', { key: 'li' + i }, inlineMd(m[2], 'li' + i))); continue
        }
        if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
          if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] } }
          list.items.push(h('li', { key: 'li' + i }, inlineMd(m[1], 'li' + i))); continue
        }
        if ((m = line.match(/^\s*>\s?(.*)$/))) { flushList(); nodes.push(h('blockquote', { key: 'q' + i }, inlineMd(m[1], 'q' + i))); continue }
        if (line.trim() === '') { flushList(); continue }
        flushList(); nodes.push(h('p', { key: 'p' + i }, inlineMd(line, 'p' + i)))
      }
      flushList(); flushCode()
      return nodes.length ? nodes : [h('p', { key: 'empty' }, src)]
    }

    // ── dsh-ui 围栏渲染：模型吐出 ```dsh-ui JSON 时，用 genui 的 standalone 运行时渲染成原生卡片 ──
    const GENUI_RUNTIME_URL = '/plugins/@changfenhuang/dsh-genui/assets/standalone-runtime.js'
    let genuiLoad = null
    function loadGenuiRuntime() {
      if (typeof window === 'undefined') return Promise.resolve(false)
      if (window.__GenuiStandalone__ && typeof window.__GenuiStandalone__.mount === 'function') return Promise.resolve(true)
      if (!genuiLoad) {
        genuiLoad = new Promise(function (resolve) {
          const s = document.createElement('script')
          s.src = new URL(GENUI_RUNTIME_URL, hostRouteUrl(ROUTE).href).href
          s.onload = function () { resolve(!!(window.__GenuiStandalone__ && typeof window.__GenuiStandalone__.mount === 'function')) }
          s.onerror = function () { genuiLoad = null; resolve(false) }
          document.head.appendChild(s)
        })
      }
      return genuiLoad
    }
    // dsh-ui 卡片结构预校验：只拦截确定畸形的 spec(混合 DSL / 字段用错),放过不确定写法,避免坏卡片 dump 原始 JSON
    const GENUI_TYPES = ('text row col grid card carousel divider spacer arrow hero stat badge progress list table keyvalue avatar image image-group compare audio video timeline file-tree breadcrumb diff json code callout steps icon blocks chart plot echart button input select checkbox radio switch slider textarea editor date-picker segmented-control tabs accordion copy link submit popover svg mermaid diagram scene3d quiz entity-card').split(' ')
    const GENUI_TONES = ('info success warning error').split(' ')
    function isValidGenuiSpec(spec) {
      if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return false
      // 病症一:根同时带 items 与 children —— 把两套卡片 DSL 拼在了一起
      if (Array.isArray(spec.items) && Array.isArray(spec.children)) return false
      const roots = Array.isArray(spec.items) ? spec.items : (spec.type ? [spec] : null)
      if (!roots) return false
      function checkNode(node) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) return false
        const t = node.type
        if (typeof t !== 'string' || GENUI_TYPES.indexOf(t) < 0) return false
        // 病症二:callout 正文必须用 content,且 tone 只能取四个合法值(warn 这类会挂)
        if (t === 'callout') {
          if (typeof node.content !== 'string') return false
          if (node.tone && GENUI_TONES.indexOf(node.tone) < 0) return false
        }
        // 病症三:steps 只能是字符串数组,不能塞 {label,status} 对象
        if (t === 'steps') {
          const arr = Array.isArray(node.steps) ? node.steps : node.items
          if (!Array.isArray(arr) || !arr.every(function (s) { return typeof s === 'string' })) return false
        }
        const kids = []
        if (Array.isArray(node.items)) kids.push.apply(kids, node.items)
        if (Array.isArray(node.children)) kids.push.apply(kids, node.children)
        return kids.every(function (k) { return !k || typeof k !== 'object' || !k.type || checkNode(k) })
      }
      return roots.every(checkNode)
    }
    function splitFences(text) {
      const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n')
      const parts = []
      const re = /```dsh-ui[ \t]*\n([\s\S]*?)```/g
      let last = 0, m
      while ((m = re.exec(src)) !== null) {
        if (m.index > last) parts.push({ kind: 'md', text: src.slice(last, m.index) })
        parts.push({ kind: 'fence', text: m[1] })
        last = m.index + m[0].length
      }
      if (last < src.length) parts.push({ kind: 'md', text: src.slice(last) })
      return parts.length ? parts : [{ kind: 'md', text: src }]
    }
    function GenuiFence({ raw }) {
      const ref = useRef(null)
      const [failed, setFailed] = useState(false)
      useEffect(() => {
        let unmount = null, cancelled = false
        let spec = null
        try { spec = JSON.parse(raw) } catch (e) { setFailed(true); return }
        if (!isValidGenuiSpec(spec)) { setFailed(true); return }
        loadGenuiRuntime().then(function (ok) {
          if (!ok || cancelled || !ref.current) { setFailed(true); return }
          try {
            const dark = typeof document !== 'undefined' && document.body.hasAttribute('data-ds-dark-theme')
            const artifact = { format: 'dsh-genui', version: 1, spec: spec, presentation: { locale: 'zh', theme: dark ? 'dark' : 'light' } }
            unmount = window.__GenuiStandalone__.mount(ref.current, artifact)
          } catch (e) { setFailed(true) }
        })
        return function () { cancelled = true; if (unmount) { try { unmount() } catch (e) {} } }
      }, [raw])
      if (failed) return h('div', { className: 'md-genui-fallback' }, [
        h('div', { className: 'md-genui-fallback-title', key: 't' }, '卡片渲染失败，已收起原始内容'),
        h('details', { key: 'd' }, [
          h('summary', { key: 's' }, '查看原始内容'),
          h('pre', { key: 'p' }, raw)
        ])
      ])
      return h('div', { className: 'md-genui-fence', ref: ref })
    }
    async function callWithRetry(payload) {
      try { return await call(payload) }
      catch (err) {
        // 用户主动停止：不重试，直接抛特殊标记
        if (err && err.name === 'AbortError') { const e = new Error('已停止生成'); e.name = 'StopError'; throw e }
        if (!isTransientModelError(err && err.message)) throw err
        await new Promise(r => setTimeout(r, 600))
        return call(payload)
      }
    }

    // 流式读取科灵 agent 的 SSE 回传：data: {type,text|message|library...}\n\n
    async function callStream(payload, onEvent, signal) {
      const res = await fetch(hostRouteUrl(ROUTE).href, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal,
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const emit = raw => {
        const line = String(raw).split('\n').find(x => x.indexOf('data: ') === 0)
        if (!line) return
        try { onEvent(JSON.parse(line.slice(6))) } catch (e) {}
      }
      if (!res.body || !res.body.getReader) { emit(await res.text()); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const step = await reader.read()
        if (step.done) break
        buf += decoder.decode(step.value || new Uint8Array(), { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          emit(buf.slice(0, idx))
          buf = buf.slice(idx + 2)
        }
      }
      if (buf.trim()) emit(buf)
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
      theme:'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
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
      shield:'M12 3 5.5 5.8v5.1c0 4.25 2.72 7.87 6.5 9.1 3.78-1.23 6.5-4.85 6.5-9.1V5.8L12 3Z',
    }
    const THEMES = [
      { id: 'host', name: '跟随宿主', desc: '与 DeepSeek Harness 主题一致', sw: ['#6b7a90','#e7eaf0'] },
      { id: 'aurora', name: '极光白', desc: '干净明亮的冷色界面', sw: ['#eef3fb','#2563eb','#0f1623'],
        light:{bg:'#f5f7fa',card:'#ffffff',ink:'#1b2333',ink2:'#4a5568',ink3:'#718096',ink4:'#9aa5b4',line:'#e2e8f0',lineStrong:'#cbd5e1',hover:'#eef2f7',active:'#e4eaf2',accent:'#2563eb',primary:'#2563eb',primaryHover:'#1d4ed8',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#0f1623',card:'#182233',ink:'#e8edf6',ink2:'#b6c2d4',ink3:'#8795aa',ink4:'#65738a',line:'#27374d',lineStrong:'#3b4d66',hover:'#1d2a3d',active:'#26374e',accent:'#5b9cff',primary:'#3b82f6',primaryHover:'#60a5fa',onPrimary:'#ffffff',glass:'#182233cc'} },
      { id: 'ink', name: '墨夜', desc: '沉静深邃的暗色工作台', sw: ['#1e1c1a','#d0a06a','#141312'],
        light:{bg:'#f4f3f0',card:'#ffffff',ink:'#242220',ink2:'#55504a',ink3:'#7d766e',ink4:'#a39c93',line:'#e6e1da',lineStrong:'#d2cbc1',hover:'#efece6',active:'#e7e2da',accent:'#b45309',primary:'#7c5c3b',primaryHover:'#6b4e31',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#141312',card:'#1e1c1a',ink:'#f2ede7',ink2:'#c4bcb2',ink3:'#948a7f',ink4:'#70675d',line:'#302b27',lineStrong:'#443d36',hover:'#26221f',active:'#312b25',accent:'#e0a458',primary:'#b98a56',primaryHover:'#d0a06a',onPrimary:'#17130f',glass:'#1e1c1acc'} },
      { id: 'celadon', name: '青瓷', desc: '温润的东方浅色质感', sw: ['#e9f1ea','#2f7d5b','#101b17'],
        light:{bg:'#f2f6f2',card:'#fbfdfb',ink:'#1f2f2a',ink2:'#486057',ink3:'#6f887d',ink4:'#95a99e',line:'#d7e4da',lineStrong:'#b9cfc1',hover:'#e9f1ea',active:'#dcebdf',accent:'#2f7d5b',primary:'#2f7d5b',primaryHover:'#256547',onPrimary:'#ffffff',glass:'#fbfdfbcc'},
        dark:{bg:'#101b17',card:'#17261f',ink:'#e6f0e9',ink2:'#b3c9bc',ink3:'#87a494',ink4:'#648174',line:'#2a3f34',lineStrong:'#3c5949',hover:'#1d3027',active:'#26402f',accent:'#6bc79a',primary:'#4aa97d',primaryHover:'#6bc79a',onPrimary:'#0d1712',glass:'#17261fcc'} },
      { id: 'sand', name: '暖沙', desc: '柔和的米棕暖色调', sw: ['#f5ece1','#c07d3d','#1a1512'],
        light:{bg:'#faf6f1',card:'#ffffff',ink:'#2a2119',ink2:'#635244',ink3:'#8d7969',ink4:'#b19d8c',line:'#eadfd2',lineStrong:'#d8c8b6',hover:'#f5ece1',active:'#eee2d3',accent:'#b45309',primary:'#a85a18',primaryHover:'#8f4a12',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#1a1512',card:'#241d19',ink:'#f4ece3',ink2:'#cbb8a6',ink3:'#9e8877',ink4:'#7a6759',line:'#3a2e26',lineStrong:'#524034',hover:'#2a211b',active:'#362a22',accent:'#e3a15c',primary:'#c07d3d',primaryHover:'#da9250',onPrimary:'#1a1512',glass:'#241d19cc'} },
      { id: 'sakura', name: '樱雾', desc: '轻快的粉色灵感氛围', sw: ['#fbeef2','#be185d','#1a1116'],
        light:{bg:'#fdf6f8',card:'#ffffff',ink:'#33222b',ink2:'#6b4a58',ink3:'#967080',ink4:'#b99aa7',line:'#f0dce3',lineStrong:'#e3c2ce',hover:'#fbeef2',active:'#f6e1e9',accent:'#be185d',primary:'#be185d',primaryHover:'#9d134c',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#1a1116',card:'#261a21',ink:'#f9edf2',ink2:'#d1adbb',ink3:'#a77f90',ink4:'#826075',line:'#3c2831',lineStrong:'#553a46',hover:'#2d1d26',active:'#3a2530',accent:'#f472b6',primary:'#db5b9a',primaryHover:'#f184b6',onPrimary:'#1a1116',glass:'#261a21cc'} },
      { id: 'dracula', name: 'Dracula', desc: '经典暗夜紫，取自 Dracula 官方配色', sw: ['#282a36','#bd93f9','#ff79c6'],
        light:{bg:'#f8f8f2',card:'#ffffff',ink:'#282a36',ink2:'#44475a',ink3:'#6272a4',ink4:'#8a90a6',line:'#e4e4f0',lineStrong:'#c9cada',hover:'#f0f0f8',active:'#e6e6f4',accent:'#8a42c8',primary:'#a050d0',primaryHover:'#8a42c8',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#282a36',card:'#343746',ink:'#f8f8f2',ink2:'#e4e4ee',ink3:'#a6a7b8',ink4:'#6272a4',line:'#44475a',lineStrong:'#6272a4',hover:'#3a3d4d',active:'#44475a',accent:'#bd93f9',primary:'#bd93f9',primaryHover:'#ff79c6',onPrimary:'#282a36',glass:'#343746cc'} },
      { id: 'nord', name: 'Nord', desc: '北欧极地蓝灰，取自 Nord 官方配色', sw: ['#2e3440','#88c0d0','#5e81ac'],
        light:{bg:'#eceff4',card:'#ffffff',ink:'#2e3440',ink2:'#434c5e',ink3:'#616e88',ink4:'#8a94a6',line:'#d8dee9',lineStrong:'#c4cdd9',hover:'#e5e9f0',active:'#d8dee9',accent:'#3b7e96',primary:'#5e81ac',primaryHover:'#4c719c',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#2e3440',card:'#3b4252',ink:'#eceff4',ink2:'#d8dee9',ink3:'#a9b4c4',ink4:'#616e88',line:'#434c5e',lineStrong:'#4c566a',hover:'#3b4252',active:'#434c5e',accent:'#88c0d0',primary:'#5e81ac',primaryHover:'#81a1c1',onPrimary:'#ffffff',glass:'#3b4252cc'} },
      { id: 'solarized', name: 'Solarized', desc: '经典复古双色，取自 Solarized 官方配色', sw: ['#fdf6e3','#268bd2','#002b36'],
        light:{bg:'#fdf6e3',card:'#fffbf0',ink:'#073642',ink2:'#586e75',ink3:'#657b83',ink4:'#93a1a2',line:'#eee8d5',lineStrong:'#d6cdaf',hover:'#f2eadb',active:'#e9dfc7',accent:'#268bd2',primary:'#268bd2',primaryHover:'#1e6fa8',onPrimary:'#ffffff',glass:'#fffbf0cc'},
        dark:{bg:'#002b36',card:'#073642',ink:'#eee8d5',ink2:'#93a1a2',ink3:'#839496',ink4:'#657b83',line:'#094a57',lineStrong:'#0c5a68',hover:'#073642',active:'#094a57',accent:'#2aa198',primary:'#268bd2',primaryHover:'#2aa198',onPrimary:'#002b36',glass:'#073642cc'} },
      { id: 'gruvbox', name: 'Gruvbox', desc: '复古暖棕，取自 Gruvbox 官方配色', sw: ['#282828','#fabd2f','#d79921'],
        light:{bg:'#fbf1c7',card:'#fff9e6',ink:'#3c3836',ink2:'#504945',ink3:'#665c54',ink4:'#7c6f64',line:'#ebdbb2',lineStrong:'#d5c4a1',hover:'#f2e5bc',active:'#e8d9a8',accent:'#b57614',primary:'#af3a03',primaryHover:'#d65d0e',onPrimary:'#ffffff',glass:'#fff9e6cc'},
        dark:{bg:'#282828',card:'#32302f',ink:'#ebdbb2',ink2:'#d5c4a1',ink3:'#a89984',ink4:'#928374',line:'#3c3836',lineStrong:'#504945',hover:'#3c3836',active:'#504945',accent:'#fabd2f',primary:'#d79921',primaryHover:'#fabd2f',onPrimary:'#282828',glass:'#32302fcc'} },
      { id: 'catppuccin', name: 'Catppuccin', desc: '柔和马卡龙，取自 Catppuccin 官方配色', sw: ['#1e1e2e','#cba6f7','#89b4fa'],
        light:{bg:'#eff1f5',card:'#ffffff',ink:'#4c4f69',ink2:'#5c5f77',ink3:'#6c6f85',ink4:'#9ca0b0',line:'#ccd0da',lineStrong:'#b5b9c7',hover:'#e6e9ef',active:'#dce0e8',accent:'#8839ef',primary:'#1e66f5',primaryHover:'#8839ef',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#1e1e2e',card:'#313244',ink:'#cdd6f4',ink2:'#a6adc8',ink3:'#9399b2',ink4:'#6c7086',line:'#45475a',lineStrong:'#585b70',hover:'#313244',active:'#45475a',accent:'#cba6f7',primary:'#89b4fa',primaryHover:'#cba6f7',onPrimary:'#1e1e2e',glass:'#313244cc'} },
      { id: 'onedark', name: 'One Dark', desc: '编辑器经典暗色，取自 One Dark Pro 配色', sw: ['#282c34','#61afef','#c678dd'],
        light:{bg:'#f5f6f8',card:'#ffffff',ink:'#282c34',ink2:'#4b5361',ink3:'#5c6370',ink4:'#87909e',line:'#e1e4ea',lineStrong:'#c9cfd9',hover:'#edf0f4',active:'#e1e4ea',accent:'#3b7bc0',primary:'#4078c0',primaryHover:'#2c5e9e',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#282c34',card:'#21252b',ink:'#abb2bf',ink2:'#9aa3b0',ink3:'#7f8796',ink4:'#5c6370',line:'#3b4048',lineStrong:'#4b5361',hover:'#2c323c',active:'#3b4048',accent:'#61afef',primary:'#61afef',primaryHover:'#82aaff',onPrimary:'#282c34',glass:'#21252bcc'} },
      { id: 'tokyonight', name: 'Tokyo Night', desc: '东京夜色蓝紫，取自 Tokyo Night 配色', sw: ['#1a1b26','#7aa2f7','#bb9af7'],
        light:{bg:'#e8ebfa',card:'#ffffff',ink:'#1a1b26',ink2:'#3b4261',ink3:'#565a7e',ink4:'#7e83b2',line:'#c9cee8',lineStrong:'#aeb5d8',hover:'#dde2f5',active:'#cdd4ef',accent:'#3451b2',primary:'#3d59a1',primaryHover:'#3451b2',onPrimary:'#ffffff',glass:'#ffffffcc'},
        dark:{bg:'#1a1b26',card:'#24283b',ink:'#c0caf5',ink2:'#a9b1d6',ink3:'#7e83b2',ink4:'#565a7e',line:'#2f334d',lineStrong:'#3b4261',hover:'#292d42',active:'#2f334d',accent:'#7aa2f7',primary:'#7aa2f7',primaryHover:'#9ecbff',onPrimary:'#1a1b26',glass:'#24283bcc'} },
    ]
    const THEME_CSS = THEMES.filter(function (t) { return t.light }).map(function (t) {
      const decl = function (o) { return [['--bg',o.bg],['--card',o.card],['--ink',o.ink],['--ink2',o.ink2],['--ink3',o.ink3],['--ink4',o.ink4],['--line',o.line],['--line-strong',o.lineStrong],['--hover',o.hover],['--active',o.active],['--accent',o.accent],['--primary',o.primary],['--primary-hover',o.primaryHover],['--on-primary',o.onPrimary],['--glass',o.glass]].map(function (p) { return p[0]+':'+p[1]+';' }).join('') }
      return '.md-root[data-theme="'+t.id+'"]{'+decl(t.light)+'}body[data-ds-dark-theme] .md-root[data-theme="'+t.id+'"]{'+decl(t.dark)+'}'
    }).join('')
    const THEME_UI_CSS = '.md-root .md-theme-swatches{display:flex;gap:4px;margin-bottom:8px}.md-root .md-theme-swatches i{width:26px;height:26px;border-radius:8px;border:1px solid var(--line);box-shadow:0 1px 3px #0002}.md-root .md-style-card{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;padding:10px;border-radius:var(--r-md);border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}.md-root .md-style-card:hover{border-color:var(--primary)}.md-root .md-style-card.is-active{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary) inset}.md-root .md-style-card small{color:var(--ink3);font-size:11px;line-height:1.3}'
    function I(props) {
      const size = (props && props.size) || 16
      const fill = !!(props && props.fill), stroke = (props && props.stroke) || 1.6
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24',
        fill: fill ? 'currentColor' : 'none', stroke: fill ? 'none' : 'currentColor',
        strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('path', { d: ICONS[props && props.name] || '' }))
    }
    // 沉淀物 pill 只按服务端给的固定四态取色，不新增任何硬编码色值。
    const OUTCOME_CLASS = { '选题': 'oc-topic', '实验': 'oc-exp', '草稿': 'oc-draft', '决策': 'oc-decision' }
    // 会话时间只做展示层格式化：服务端给 ISO 时间，这里翻译成相对人话，不产出摘要/标签等语义内容。
    function chatRelativeTime(value) {
      const t = Date.parse(String(value || ''))
      if (!isFinite(t)) return ''
      const diff = Date.now() - t
      if (diff < 0) return ''
      const min = Math.floor(diff / 60000)
      if (min < 1) return '刚刚'
      if (min < 60) return min + ' 分钟前'
      const hour = Math.floor(min / 60)
      if (hour < 24) return hour + ' 小时前'
      const day = Math.floor(hour / 24)
      if (day === 1) return '昨天'
      if (day < 7) return day + ' 天前'
      const week = Math.floor(day / 7)
      if (week < 5) return week + ' 周前'
      const d = new Date(t)
      return (d.getMonth() + 1) + '月' + d.getDate() + '日'
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
    function buildIdeaSchedule(items, start) {
      const base = start ? new Date(start) : new Date()
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
      const fmt = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0')
      const out = {}
      let used = 0
      for (const x of items) {
        const dow = d.getDay()
        const cap = (dow === 0 || dow === 6) ? 1 : 2
        if (used >= cap) { d.setDate(d.getDate() + 1); used = 0 }
        out[x.id] = fmt(d)
        used++
      }
      return out
    }
    function hashCode(e) { let t = 0; e = String(e || ''); for (let i = 0; i < e.length; i++) { t = (t << 5) - t + e.charCodeAt(i) | 0 } return t >>> 0 }
    // 散落入场动画：多种可选模式，全部尊重减弱动画偏好；spring 为 media-desk 原版弹簧手感
    const SCATTER_ANIMS = [
      ['spring', '弹簧弹入'], ['fade', '柔和淡入'], ['rise', '轻微上浮'], ['zoom', '聚焦放大'], ['none', '关闭动画'],
    ]
    const ENTER_MS = 850
    // media-desk 原版弹簧：bn(120,16) 的 36 段线性 easing，峰值 1.0347 带真实回弹
    const ENTER_EASE = 'linear(0,0.0177,0.0643,0.1309,0.2102,0.2963,0.3847,0.4717,0.5548,0.6321,0.7025,0.7653,0.8203,0.8676,0.9075,0.9405,0.9672,0.9884,1.0046,1.0166,1.0251,1.0305,1.0336,1.0347,1.0344,1.033,1.0309,1.0282,1.0252,1.0222,1.0191,1.0162,1.0135,1.0109,1.0087,1.0067,1)'

    // 灵感页背景板预设：只通过独立 style 覆盖，绝不改动 :26 的单行 CSS。
    const BG_PRESETS = [
      ['grid', '默认点阵', ''],
      ['plain', '纯净底色', '.md-root[data-bg="plain"] .md-stage{background-image:none;background-color:var(--bg)}'],
      ['fine', '细密点阵', '.md-root[data-bg="fine"] .md-stage{background-size:16px 16px;background-image:radial-gradient(circle,color-mix(in srgb,var(--ink) 7%,transparent) 1px,transparent 1.2px)}'],
      ['warm', '暖色晕染', '.md-root[data-bg="warm"] .md-stage{background-size:auto;background-repeat:no-repeat;background-image:radial-gradient(ellipse at 22% 18%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 55%),radial-gradient(ellipse at 78% 82%,color-mix(in srgb,var(--primary) 12%,transparent),transparent 55%)}'],
      ['calm', '冷色晕染', '.md-root[data-bg="calm"] .md-stage{background-size:auto;background-repeat:no-repeat;background-image:radial-gradient(ellipse at 18% 78%,color-mix(in srgb,var(--primary) 14%,transparent),transparent 55%),radial-gradient(ellipse at 82% 22%,color-mix(in srgb,var(--accent) 12%,transparent),transparent 55%)}'],
    ]
    const BG_CSS = BG_PRESETS.map(function (x) { return x[2] }).join('')
    const EXPORT_FORMATS = [
      ['md', 'Markdown', '直接打开阅读的研究总览'],
      ['bib', 'BibTeX', '导进 Zotero 等引文工具'],
      ['json', 'JSON', '结构化数据，便于程序处理'],
      ['typst', 'Typst', '排版成论文或报告'],
      ['latex', 'LaTeX', '排版成论文或报告'],
    ]
    function Desk() {
      const [view, setView] = useState(() => { try { const v = localStorage.getItem('rd.view'); if (v === 'topics' || v === 'content') return 'research'; return ['home', 'research', 'schedule', 'discover', 'insights', 'lab', 'collab', 'style'].indexOf(v) >= 0 ? v : 'home' } catch (e) { return 'home' } })
      const [researchLens, setResearchLens] = useState('verify')
      const openResearch = lens => { setResearchLens(lens === 'publish' ? 'publish' : 'verify'); setView('research') }
      const [mode, setMode] = useState(() => { try { const m = localStorage.getItem('rd.mode'); return m === 'wall' || m === 'scatter' ? m : 'scatter' } catch (e) { return 'scatter' } })
      const [kindFilter, setKindFilter] = useState(() => { try { const k = localStorage.getItem('rd.kindFilter'); return ['all', 'paper', 'image', 'table', 'report', 'link', 'note'].indexOf(k) >= 0 ? k : 'all' } catch (e) { return 'all' } })
      const [query, setQuery] = useState('')
      const [library, setLibrary] = useState({ papers: [], hypotheses: [], drafts: [], reviews: [], chat: [], collaborations: [], collabByExperiment: {} })
      const [models, setModels] = useState([])
      const [modelsStatus, setModelsStatus] = useState('loading') // loading | ready | empty | error 模型加载状态，供面板显示与重试
      const [msgs, setMsgs] = useState([])
      const [input, setInput] = useState('')
      const [images, setImages] = useState([]) // 识图待发送图片：[{id,name,mediaType,data}]，data 为纯 base64（无 data: 前缀）
      const [pendingFiles, setPendingFiles] = useState([]) // 随消息发送的文档字节：[{id,name,data}]，data 为纯 base64（无 data: 前缀），不持久化（避免 rd.docs 膨胀）
      const abortRef = useRef(null)
      const fileInputRef = useRef(null)
      const visionInputRef = useRef(null)
      const importInputRef = useRef(null)
      const [busy, setBusy] = useState('')
      // L4 画像纠错的三个输入框（逐组独立，正常用户只看得见自己那一行）。
      const [profileAdd, setProfileAdd] = useState({ focus: '', sources: '', habits: '' })
      const [labDraft, setLabDraft] = useState({ title: '', runtime: 'python', code: '', hypothesisId: '', packages: '', criteria: '' })
      const [labExtract, setLabExtract] = useState('')
      const [labLines, setLabLines] = useState([])
      const [labRunning, setLabRunning] = useState(false)
      const [labOpen, setLabOpen] = useState(null)
      const labAbortRef = useRef(null)
      const [selectedCollabId, setSelectedCollabId] = useState('')
      const [collabGoal, setCollabGoal] = useState('')
      const [collabRole, setCollabRole] = useState('lead')
      const [collabAutonomy, setCollabAutonomy] = useState('L1')
      const [collabQuery, setCollabQuery] = useState('')
      const [collabFilter, setCollabFilter] = useState('all')
      const [collabCompare, setCollabCompare] = useState([])
      const [collabBusy, setCollabBusy] = useState('')
      const [collabLeadLines, setCollabLeadLines] = useState([])
      const collabLeadAbortRef = useRef(null)
      const [collabGuideDone, setCollabGuideDone] = useState(() => { try { return localStorage.getItem('rd.collabGuideDone') === '1' } catch (e) { return false } })
      const [toast, setToast] = useState(null)
      const [selected, setSelected] = useState(null)
      const [positions, setPositions] = useState({})
      const [pan, setPan] = useState({ x: 0, y: 0 })
      const [zoom, setZoom] = useState(1)
      const [bgStyle, setBgStyle] = useState(() => { try { const b = localStorage.getItem('rd.bgStyle'); return BG_PRESETS.some(function (x) { return x[0] === b }) ? b : 'grid' } catch (e) { return 'grid' } })
      const [settingRows, setSettingRows] = useState([])
      const [settingDraft, setSettingDraft] = useState({})
      const [imageToolAvailable, setImageToolAvailable] = useState(false)
      const [searchResults, setSearchResults] = useState([])
      const [model, setModel] = useState('')
      const [modelPickOpen, setModelPickOpen] = useState(false)
      const [modelQuery, setModelQuery] = useState('')
      const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
      const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
      const [settingsPage, setSettingsPage] = useState('root')
      const [modelEffort, setModelEffortState] = useState(() => { try { return localStorage.getItem('rd.effort') || '' } catch (e) { return '' } })
      // 识图、智能体团队协作均已接入：不再保留只写本地、不产生实际效果的状态。
      const [permMode, setPermMode] = useState(() => { try { const p = localStorage.getItem('rd.perm'); return ['read-only', 'workspace-write', 'danger-full-access'].indexOf(p) >= 0 ? p : 'read-only' } catch (e) { return 'read-only' } })
      const [clearChatOpen, setClearChatOpen] = useState(false)
      const [chatMenuOpen, setChatMenuOpen] = useState(false)
      // 命令目录（+号）：数据源为 status.commands；只读项直接调用，写操作只填提示不执行。
      const [cmdMenuOpen, setCmdMenuOpen] = useState(false)
      const [cmdCatalog, setCmdCatalog] = useState([])
      const [cmdMenuBusy, setCmdMenuBusy] = useState(false)
      // 关3：命令目录/对话切换菜单外部点击与 Esc 关闭。复用设置浮层范式（pointerdown/keydown capture + cleanup）。
      // 触发按钮各自作为锚点排除在「外部」之外，避免 pointerdown 先关、随后 onClick 又开导致点按钮关不掉。
      useEffect(() => {
        if (!cmdMenuOpen && !chatMenuOpen) return
        const onDown = e => {
          const t = e.target
          if (!t || !t.closest) return
          if (cmdMenuOpen && !t.closest('.md-cmdmenu') && !t.closest('.md-cmdmenu-trigger')) setCmdMenuOpen(false)
          if (chatMenuOpen && !t.closest('.md-chatlistmenu') && !t.closest('.md-chatbar-cur')) setChatMenuOpen(false)
        }
        const onKey = e => { if (e.key === 'Escape') { setCmdMenuOpen(false); setChatMenuOpen(false) } }
        document.addEventListener('pointerdown', onDown, true)
        window.addEventListener('keydown', onKey, true)
        return () => { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
      }, [cmdMenuOpen, chatMenuOpen])
      const [renameChatId, setRenameChatId] = useState('')
      const [renameChatText, setRenameChatText] = useState('')
      // 找历史：服务端算好人话结果，客户端只负责输入、发 action 和渲染。
      const [chatSearchOpen, setChatSearchOpen] = useState(false)
      const [chatSearchQuery, setChatSearchQuery] = useState('')
      const [chatSearchResults, setChatSearchResults] = useState([])
      const [chatSearchBusy, setChatSearchBusy] = useState(false)
      // 搜索命中：点结果后记下命中词，切到目标会话再滚到含词消息并短暂高亮（命中词由服务端聊天文本字面包含，纯前端即可定位）。
      const [searchHitTerm, setSearchHitTerm] = useState('')
      const [hitNav, setHitNav] = useState({ index: 0, total: 0 })
      const dockRef = useRef(null)
      // 搜索范围：null=全部会话；否则为勾选的会话 id 集合。后端仍全局搜，前端按此过滤结果。
      const [selectedSearchChats, setSelectedSearchChats] = useState(null)
      const [historyOpen, setHistoryOpen] = useState(false)
      const [historySteps, setHistorySteps] = useState([])
      const [exportOpen, setExportOpen] = useState(false)
      const [exportFormats, setExportFormats] = useState(['md', 'bib', 'json'])
      const [clearLibOpen, setClearLibOpen] = useState(false)
      const [dockDefault, setDockDefault] = useState(() => { try { return localStorage.getItem('rd.dockDefault') === '1' } catch (e) { return false } })
      const [dockOpen, setDockOpen] = useState(() => { try { return localStorage.getItem('rd.dockDefault') === '1' } catch (e) { return false } })
      const [dockW, setDockW] = useState(() => { try { return Math.max(280, Math.min(700, parseInt(localStorage.getItem('rd.dockW'), 10) || 336)) } catch (e) { return 336 } })
      const [width, setWidth] = useState(1600)
      const [stageH, setStageH] = useState(900)
      const [contentMode, setContentMode] = useState('board')
      const [contentQuery, setContentQuery] = useState('')
      const [topicMode, setTopicMode] = useState('board')
      const [topicQuery, setTopicQuery] = useState('')
      const [topicOver, setTopicOver] = useState(null)
      const [topicSort, setTopicSort] = useState({ key: 'status', dir: -1 })
      const [contentSort, setContentSort] = useState({ key: 'title', dir: 1 })
      const [contentStatus, setContentStatus] = useState(() => { try { return JSON.parse(localStorage.getItem('rd.contentStatus') || '{}') } catch (e) { return {} } })
      const [boardOver, setBoardOver] = useState(null)
      const [calMonth, setCalMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
      const [schedule, setSchedule] = useState(() => { let stored = {}; try { const raw = localStorage.getItem('rd.schedule'); if (raw) { const v = JSON.parse(raw); if (v && typeof v === 'object') stored = v } } catch (e) {} return Object.assign({}, buildIdeaSchedule(hydrateIdeas()), stored) })
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
      const [studioFormat, setStudioFormat] = useState('article')
      const [studioDraft, setStudioDraft] = useState('')
      const [studioInput, setStudioInput] = useState('')
      // 场景化配图：科灵为成稿初稿借订阅生图工具配一张图，不建通用工具面板。
      const [studioIllustration, setStudioIllustration] = useState(null)
      const pendingIllustrationRef = useRef(null)
      const [ideaInput, setIdeaInput] = useState('')
      const [ideaCapOpen, setIdeaCapOpen] = useState(false)
      const [ideaCapTab, setIdeaCapTab] = useState('note')
      const [ideaCapText, setIdeaCapText] = useState('')
      const [rdDocs, setRdDocs] = useState(() => { try { const v = JSON.parse(localStorage.getItem('rd.docs') || '[]'); return Array.isArray(v) ? v : [] } catch (e) { return [] } })
      const [rdDocTab, setRdDocTab] = useState('all')
      const [rdDocBusy, setRdDocBusy] = useState('')
      const [deskTaskText, setDeskTaskText] = useState('')
      const [deskPick, setDeskPick] = useState('collect')
      const [themeOpen, setThemeOpen] = useState(false)
      const [themeId, setThemeId] = useState(() => { try { const t = localStorage.getItem('rd.theme'); return THEMES.some(function(x){return x.id === t}) ? t : 'host' } catch (e) { return 'host' } })
      const [localeId, setLocaleId] = useState(() => { try { const l = localStorage.getItem('rd.locale'); return ['host', 'zh', 'en'].indexOf(l) >= 0 ? l : 'host' } catch (e) { return 'host' } })
      // 宿主语言（host 档跟随用）：默认中文安全回退，挂载后由 DSH locale bridge 校正。
      const [hostLang, setHostLang] = useState('zh')
      const [themeDraft, setThemeDraft] = useState(themeId)
      const [scatterAnim, setScatterAnim] = useState(() => { try { const a = localStorage.getItem('rd.scatterAnim'); return SCATTER_ANIMS.some(function(x){return x[0] === a}) ? a : 'spring' } catch (e) { return 'spring' } })
      const rootRef = useRef(null)
      const enteredIdeasRef = useRef(new Set())
      const animInitRef = useRef(false)

      const applyLibrary = useCallback(data => {
        if (!data || !data.library) return
        setLibrary(data.library)
        const cols = Array.isArray(data.library.collaborations) ? data.library.collaborations : []
        if (cols.length) setSelectedCollabId(function(id) { return cols.some(function(c) { return String(c.id) === String(id) }) ? id : String(cols[0].id || '') })
        if (Array.isArray(data.library.chat)) {
          const rebuilt = []
          data.library.chat.forEach(row => {
            const q = String(row.q || '').replace(/^按「[^」]+」写作风格：/, '')
            if (q) rebuilt.push({ role: 'me', text: q })
            if (row.a) rebuilt.push({ role: 'ai', text: String(row.a), reasoning: String(row.reasoning || ''), toolTrace: Array.isArray(row.toolTrace) ? row.toolTrace.slice() : [], usageText: row.usageText ? String(row.usageText) : '', at: row.at || '' })
          })
          setMsgs(rebuilt)
        }
      }, [])
      // 命中词建立后：给所有正文含词的 .md-msg 标 data-hit，按导航索引滚到对应条并高亮（含 fence 内命中）。
      useEffect(() => {
        const root = dockRef.current
        if (!root || !root.querySelectorAll) return
        const hits = root.querySelectorAll('[data-hit="1"]')
        if (hits.length !== hitNav.total) setHitNav(function (n) { return { index: Math.min(n.index, Math.max(0, hits.length - 1)), total: hits.length } })
        const old = root.querySelectorAll('.md-msg.is-hit')
        for (let i = 0; i < old.length; i++) old[i].classList.remove('is-hit')
        if (!searchHitTerm || !hits.length) return
        const idx = Math.min(hitNav.index, hits.length - 1)
        const target = hits[idx]
        target.classList.add('is-hit')
        try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch (e) { try { target.scrollIntoView() } catch (e2) {} }
      }, [searchHitTerm, hitNav.index, msgs])
      const runLab = useCallback(async () => {
        if (labRunning) return
        if (!labDraft.code.trim()) { setToast({ text: '先写一段验证代码，再运行。', error: true }); return }
        let criteria = []
        try { const parsed = JSON.parse(labDraft.criteria || '[]'); if (Array.isArray(parsed)) criteria = parsed } catch (e) {}
        const packages = labDraft.packages.split(/[,，\n]/).map(x => x.trim()).filter(Boolean)
        const ctrl = new AbortController()
        labAbortRef.current = ctrl
        setLabRunning(true); setLabLines([])
        try {
          await callStream({ action: 'experiment_stream', title: labDraft.title || '虚拟实验', runtime: labDraft.runtime, code: labDraft.code, hypothesisId: labDraft.hypothesisId, packages, criteria }, ev => {
            if (ev.type === 'phase') setLabLines(p => p.concat([{ k: 'phase', t: ev.message || ev.phase }]))
            else if (ev.type === 'delta') setLabLines(p => p.concat([{ k: ev.reasoning ? 'reason' : (ev.kind || 'out'), t: ev.text || '' }]))
            else if (ev.type === 'done') { applyLibrary(ev); setLabOpen(ev.runId || null); setToast({ text: ev.message || '实验完成。' }) }
            else if (ev.type === 'error') setToast({ text: ev.message || '实验出错。', error: true })
          }, ctrl.signal)
        } catch (err) { if (err && err.name === 'AbortError') setToast({ text: '已停止实验。' }); else setToast({ text: String(err && err.message || err), error: true }) }
        finally { setLabRunning(false); labAbortRef.current = null }
      }, [labRunning, labDraft, applyLibrary])
      const analyzeLab = useCallback(async runId => {
        try {
          let extractors = []
          try { const parsed = JSON.parse(labExtract || '[]'); if (Array.isArray(parsed)) extractors = parsed } catch (e) {}
          const d = await call({ action: 'experiment_analyze', runId, extractors })
          applyLibrary(d); setToast({ text: d.message || '已分析。' })
        } catch (err) { setToast({ text: String(err && err.message || err), error: true }) }
      }, [labExtract, applyLibrary])
      const iterateLab = useCallback(async (runId, verdict) => {
        try { const d = await call({ action: 'experiment_iterate', runId, verdict }); applyLibrary(d); setToast({ text: d.message || '已生成下一轮。' }) }
        catch (err) { setToast({ text: String(err && err.message || err), error: true }) }
      }, [applyLibrary])
      // 一次性迁移:旧 rd.topicStatus(内容阶段本地状态)按服务端 hypothesis.status 判定写回后清空
      const topicMigratedRef = useRef(false)
      useEffect(() => {
        if (topicMigratedRef.current) return
        if (localStorage.getItem('rd.migrated.topicStatus') === 'v1') { topicMigratedRef.current = true; return }
        const hyps = library.hypotheses || []
        if (!hyps.length) return
        topicMigratedRef.current = true
        let local = {}
        try { local = JSON.parse(localStorage.getItem('rd.topicStatus') || '{}') || {} } catch (e) {}
        const writeBack = hyps.filter(h => {
          const st = h.status
          const loc = local[h.id]
          if (['supported', 'rejected', 'held'].indexOf(st) >= 0) return false
          if (['ready', 'published'].indexOf(loc) >= 0) return false
          return (!st || st === 'draft') && ['idea', 'outline', 'draft', undefined].indexOf(loc) >= 0
        })
        Promise.all(writeBack.map(h => call({ action: 'set_hypothesis_status', id: h.id, status: 'draft' }).catch(() => null)))
          .then(() => { try { localStorage.removeItem('rd.topicStatus'); localStorage.setItem('rd.migrated.topicStatus', 'v1') } catch (e) {} refresh() })
      }, [library.hypotheses])
      const refresh = useCallback(async () => {
        try {
          const d = await call({ action: 'library' })
          applyLibrary(d)
          if (d && Array.isArray(d.documents)) setRdDocs(d.documents)
        }
        catch (err) { setToast({ text: String(err.message || err), error: true }) }
      }, [applyLibrary])
      const collabList = useCallback(async () => {
        try { const d = await call({ action: 'collab_list' }); applyLibrary(d); return d }
        catch (err) { setToast({ text: String(err && err.message || err), error: true }); return null }
      }, [applyLibrary])
      const createCollab = useCallback(async (goalText, source) => {
        const t = String(goalText || '').trim()
        if (!t) { setToast({ text: '先写下想让科灵验证的目标。', error: true }); return }
        setCollabBusy('create')
        try {
          const d = await call({ action: 'collab_create', title: t.slice(0, 40), goal: { text: t, source: source || 'human' }, kelinRole: collabRole, autonomy: collabAutonomy })
          applyLibrary(d)
          if (d && d.collab && d.collab.id) setSelectedCollabId(String(d.collab.id))
          setCollabGoal(''); setToast({ text: (d && d.message) || '虚空里已建好一条记录，科灵来带队。' })
        } catch (err) { setToast({ text: String(err && err.message || err), error: true }) }
        finally { setCollabBusy('') }
      }, [applyLibrary, collabRole, collabAutonomy])
      const collabLead = useCallback(async function (goalText, existingId) {
        var t = String(goalText || '').trim()
        if (!t && !existingId) { setToast({ text: '先写下想让科灵验证的目标。', error: true }); return }
        setCollabBusy('lead'); setCollabLeadLines([])
        var ctrl = new AbortController()
        collabLeadAbortRef.current = ctrl
        try {
          await callStream({ action: 'collab_stream', goal: t, collabId: existingId || undefined, autonomy: collabAutonomy, kelinRole: collabRole }, function (ev) {
            if (ev.type === 'prepared') { setSelectedCollabId(String(ev.collabId)); setCollabLeadLines(function (p) { return p.concat([{ k: 'phase', t: '科灵已在虚空建好记录，开始带队…' }]) }) }
            else if (ev.type === 'delta') setCollabLeadLines(function (p) { return p.concat([{ k: ev.kind === 'tool' ? 'tool' : (ev.reasoning ? 'reason' : 'out'), t: ev.text || '' }]) })
            else if (ev.type === 'done') { applyLibrary(ev); if (ev.collabId) setSelectedCollabId(String(ev.collabId)); setCollabGoal(''); if (ev.usageText) setCollabLeadLines(function (p) { return p.concat([{ k: 'out', t: String(ev.usageText) }]) }); setToast({ text: ev.status === 'waiting-human' ? '科灵停在需要你拍板的地方，去决策区看一下。' : '科灵带队完成，见时间线与决策区。' }) }
            else if (ev.type === 'error') setToast({ text: ev.message || '科灵带队出错。', error: true })
          }, ctrl.signal)
        } catch (err) { if (err && err.name === 'AbortError') setToast({ text: '已停止带队。' }); else setToast({ text: String(err && err.message || err), error: true }) }
        finally { setCollabBusy(''); collabLeadAbortRef.current = null }
      }, [collabAutonomy, collabRole, applyLibrary])
      const askDecision = useCallback(async (collabId, point, payload) => {
        try { const d = await call({ action: 'collab_decision_ask', collabId, point, payload }); applyLibrary(d); setToast({ text: (d && d.message) || '已把决策点交给人拍板。' }); return d }
        catch (err) { setToast({ text: String(err && err.message || err), error: true }); return null }
      }, [applyLibrary])
      const answerDecision = useCallback(async (collabId, decisionId, choice) => {
        setCollabBusy('decision')
        var needResume = false, resumeGoal = ''
        try {
          const d = await call({ action: 'collab_decision_answer', collabId, decisionId, choice, by: 'human' }); applyLibrary(d)
          needResume = !!(d && d.needResume)
          if (needResume) {
            const rows = (d && d.library && d.library.collaborations) || []
            const row = rows.find(function (c) { return String(c && c.id) === String(collabId) })
            resumeGoal = collabGoalText(row) || ('继续推进合作 ' + collabId)
            setToast({ text: (d && d.resumeMessage) || '已批准，科灵接着带队推进。' })
          } else setToast({ text: (d && d.message) || '已记录你的决定，科灵继续执行。' })
        }
        catch (err) { setToast({ text: String(err && err.message || err), error: true }) }
        finally { setCollabBusy('') }
        if (needResume) collabLead(resumeGoal, collabId)
      }, [applyLibrary, collabLead])
      const runCollabAction = useCallback(async (action, collabId, extra) => {
        setCollabBusy(action)
        try { const d = await call(Object.assign({ action, collabId }, extra || {})); applyLibrary(d); setToast({ text: (d && d.message) || '科灵已更新虚空里的记录。' }) }
        catch (err) { setToast({ text: String(err && err.message || err), error: true }) }
        finally { setCollabBusy('') }
      }, [applyLibrary])
      const switchCollabRole = useCallback(role => {
        setCollabRole(role)
        if (selectedCollabId) runCollabAction('collab_step', selectedCollabId, { step: { phase: 'decide', actor: 'human', decision: '把科灵角色切换为 ' + role, reason: '人在决策区改档位', refs: [] } })
      }, [selectedCollabId, runCollabAction])
      const switchCollabAutonomy = useCallback(level => {
        setCollabAutonomy(level)
        if (selectedCollabId) runCollabAction('collab_step', selectedCollabId, { step: { phase: 'decide', actor: 'human', decision: '把自主度切换为 ' + level, reason: '人在决策区改档位', refs: [] } })
      }, [selectedCollabId, runCollabAction])
      const openCollabFromRun = useCallback(runId => {
        const map = (library && library.collabByExperiment) || {}
        const cid = map[runId]
        if (cid) { setSelectedCollabId(String(cid)); setView('lab') }
        else setToast({ text: '这条实验还没有关联虚空记录。' })
      }, [library])
      const flowBackToDraft = useCallback((c, runId) => {
        const goal = collabGoalText(c)
        const conclusion = collabEvaluationText(c && c.evaluation) || String((c && c.evaluation && c.evaluation.summary) || '已完成虚拟实验评估')
        const instruction = '把这次虚拟实验合作的评估结论写成一段研究快报。目标：' + goal + '。评估结论：' + conclusion + (runId ? '（关联实验 ' + runId + '）' : '') + '。要求给出结论、关键依据与下一步建议。'
        setCollabBusy('draft')
        call({ action: 'draft', instruction: instruction }).then(function (d) {
          applyLibrary(d)
          setToast({ text: (d && d.message) || '已回流成草稿，可在选题·发布视角继续打磨。' })
        }).catch(function (err) { setToast({ text: String(err && err.message || err), error: true }) }).then(function () { setCollabBusy('') })
      }, [applyLibrary])
      const openCollabWithGoal = useCallback(text => {
        const t = String(text || '').trim()
        if (t) setCollabGoal(t)
        setView('lab')
      }, [])
      useEffect(() => { injectStyles(); refresh() }, [refresh])
      const loadModels = useCallback(async () => {
        setModelsStatus('loading')
        try {
          const d = await call({ action: 'models' })
          if (d && Array.isArray(d.models)) {
            setModels(d.models)
            setModelsStatus(d.models.length ? 'ready' : 'empty')
          } else setModelsStatus('error')
        } catch (e) { setModelsStatus('error') }
      }, [])
      useEffect(() => {
        let alive = true
        loadModels()
        call({ action: 'settings' }).then(d => {
          if (!alive || !d) return
          setImageToolAvailable(d.imageToolAvailable === true)
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
          const rect = entries[0] && entries[0].contentRect
          setWidth((rect && rect.width) || 1600)
          setStageH((rect && rect.height) || 900)
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
      useEffect(() => { try { localStorage.setItem('rd.docs', JSON.stringify(rdDocs)) } catch (e) {} }, [rdDocs])
      useEffect(() => { try { localStorage.setItem('rd.view', view) } catch (e) {} }, [view])
      useEffect(() => {
        try {
          const root = rootRef.current
          if (root) {
            const els = [root, root.querySelector('.md-content'), root.querySelector('.md-main')]
            els.forEach(function(el) { if (el) el.scrollTop = 0 })
          }
          if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0)
        } catch (e) {}
      }, [view])
      useEffect(() => { try { localStorage.setItem('rd.mode', mode) } catch (e) {} }, [mode])
      useEffect(() => { try { localStorage.setItem('rd.kindFilter', kindFilter) } catch (e) {} }, [kindFilter])
      useEffect(() => { try { localStorage.setItem('rd.contentStatus', JSON.stringify(contentStatus)) } catch (e) {} }, [contentStatus])
      useEffect(() => { try { localStorage.setItem('rd.theme', themeId) } catch (e) {} }, [themeId])
      useEffect(() => { try { localStorage.setItem('rd.locale', localeId) } catch (e) {} }, [localeId])
      // 挂接 DSH 宿主语言桥：read() 异步返回 { languages, preference }；onChange 推送后续切换。
      useEffect(() => {
        const bridge = globalThis && globalThis.__DSH_LOCALE__
        if (!bridge) return
        const apply = v => { const p = v && v.preference; setHostLang(p === 'en' || p === 'zh' ? p : 'zh') }
        try {
          const r = bridge.read()
          if (r && typeof r.then === 'function') { r.then(apply).catch(function () {}) }
          else { apply(r) }
        } catch (e) {}
        if (typeof bridge.onChange === 'function') { try { bridge.onChange(apply) } catch (e) {} }
      }, [])
      useEffect(() => { try { localStorage.setItem('rd.scatterAnim', scatterAnim) } catch (e) {} }, [scatterAnim])
      useEffect(() => { try { localStorage.setItem('rd.bgStyle', bgStyle) } catch (e) {} }, [bgStyle])
      useEffect(() => { if (!animInitRef.current) { animInitRef.current = true; return } enteredIdeasRef.current.clear() }, [scatterAnim])

      const notify = (text, error, undo) => setToast(text ? { text, error: !!error, undo: !!undo, key: Date.now() } : null)
      // 命令目录里可安全直接执行的只读 action 白名单；其余一律只填提示，绝不自动执行。
      const READONLY_CMDS = ['status', 'models', 'settings', 'stats', 'library', 'history', 'experiments', 'collab_list']
      const openCommandMenu = async () => {
        setCmdMenuOpen(v => !v)
        setCmdMenuBusy(true)
        try {
          const r = await call({ action: 'status' })
          setCmdCatalog(Array.isArray(r && r.commands) ? r.commands : [])
        } catch (e) {
          notify('命令目录读取失败：' + (e && e.message ? e.message : '请重试'), true)
          setCmdCatalog([])
        } finally { setCmdMenuBusy(false) }
      }
      const runCatalogAction = c => {
        const act = String((c && c.action) || '')
        if (!act) return
        setCmdMenuOpen(false)
        if (READONLY_CMDS.indexOf(act) >= 0) {
          call({ action: act })
            .then(r => notify(act + '：' + (r && r.message ? String(r.message) : '已返回结果')))
            .catch(e => notify(act + ' 调用失败：' + (e && e.message ? String(e.message) : '请重试'), true))
        } else {
          const desc = c && c.description ? String(c.description) : ''
          setInput(prev => (prev ? prev + '\n' : '') + '【需参数】' + act + (desc ? '：' + desc : '') + '（该命令需要参数；点击只填入提示，不会直接执行，请补全后自行发送）')
          notify('已填入 ' + act + ' 的提示文本（需参数，未执行）')
        }
      }
      // 图片白名单：与隐藏 input 的 accept 一致。
      const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
      // 从粘贴板抽 File 列表（对齐 DSH 原生 clipboardFiles）：kind !== 'file' 一律跳过，目录项自然被排除。
      const clipboardFiles = dataTransfer => {
        const out = []
        if (!dataTransfer) return out
        const items = dataTransfer.items
        if (items && typeof items.length === 'number') {
          for (let i = 0; i < items.length; i++) {
            const it = items[i]
            if (!it || it.kind !== 'file') continue
            try { const f = it.getAsFile(); if (f) out.push(f) } catch (e) {}
          }
        }
        if (!out.length && dataTransfer.files && dataTransfer.files.length) {
          for (const f of [].slice.call(dataTransfer.files)) out.push(f)
        }
        return out
      }
      // 两阶段预览（原生 A 类）：选中/粘贴只 createObjectURL 出 blob 缩略图即时上屏；
      // 真正的纯 base64 在发送时再读（见 readImageBase64），payload 绝不带 data: 前缀。
      const pickImages = fileList => {
        const files = Array.from(fileList || [])
        if (!files.length) return
        let room = 4 - images.length
        const accepted = []
        for (const f of files) {
          const mt = String(f.type || '').toLowerCase()
          if (IMAGE_MIME.indexOf(mt) < 0) { notify('只支持 PNG / JPEG / WebP / GIF 图片。', true); continue }
          if (f.size > 4 * 1024 * 1024) { notify('这张图超过 4MB，请换一张小一点的。', true); continue }
          if (room <= 0) { notify('一次最多带 4 张图，多的这次先不放进来。', true); break }
          room--
          accepted.push(f)
        }
        const entries = accepted.map(file => ({
          id: 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          name: file.name || '图片',
          mediaType: String(file.type || 'image/png').toLowerCase(),
          data: '',
          file,
          previewUrl: (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(file) : '',
        }))
        if (entries.length) setImages(prev => prev.concat(entries).slice(0, 4))
      }
      // 发送阶段才读字节：FileReader 拆出 data: 前缀后的纯 base64，host 识图提纯要求 canonical base64。
      const readImageBase64 = img => new Promise(resolve => {
        if (img.data) { resolve(img.data); return }
        if (!img.file || typeof FileReader === 'undefined') { resolve(''); return }
        const reader = new FileReader()
        reader.onload = () => {
          const raw = String(reader.result || '')
          const comma = raw.indexOf(',')
          resolve(comma >= 0 ? raw.slice(comma + 1) : '')
        }
        reader.onerror = () => { notify('这张图没读出来，请重试。', true); resolve('') }
        reader.readAsDataURL(img.file)
      })
      // textarea 的粘贴入口：只有剪贴板里真的有文件才拦截；纯文本照常交给编辑器。
      const onComposerPaste = e => {
        const dt = e.clipboardData || (e.nativeEvent && e.nativeEvent.clipboardData)
        const files = clipboardFiles(dt)
        if (!files.length) return
        e.preventDefault()
        intakeFiles(files)
      }
      const removeImage = id => setImages(prev => {
        const hit = prev.filter(x => x.id === id)[0]
        if (hit && hit.previewUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try { URL.revokeObjectURL(hit.previewUrl) } catch (e) {}
        }
        return prev.filter(x => x.id !== id)
      })
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
      const humanDecisionText = function (s) { s = String(s || ''); const m = s.match(/^risk:([a-z]+):([\s\S]*)$/i); if (!m) return s; const L = { install: '安装依赖包（会联网）', workspace: '改动工作区', outbound: '对外发包（会把数据送出去）' }; return (m[2] && m[2].trim()) || L[m[1].toLowerCase()] || s }
      const num = n => Number(n || 0).toLocaleString()
      const modelRouteOf = m => (m && m.provider ? m.provider + '/' + m.model : (m && m.model ? m.model : ''))
      // 同一模型在 DSH 目录里按 provider/识图变体被注册成多条时合并展示：
      // 只要基础 model id 或显示名相同即视为同一模型，并优先保留当前选中那条。
      const baseModelId = id => String(id || '').replace(/[-_:.](vision|识图|multimodal|image)$/i, '')
      const dedupModels = (() => {
        const out = []
        const base = m => baseModelId(m && m.model).toLowerCase()
        const disp = m => String((m && m.label) || (m && m.model) || '').trim().toLowerCase()
        for (const m of models) {
          const idx = out.findIndex(x => base(x) === base(m) || (disp(m) && disp(x) === disp(m)))
          if (idx < 0) { out.push(m); continue }
          const prev = out[idx]
          if (modelRouteOf(m) === model && modelRouteOf(prev) !== model) out[idx] = m
        }
        return out
      })()
      const curM = dedupModels.find(m => modelRouteOf(m) === model) || dedupModels[0]
      const modelLabel = curM ? (curM.model || curM.label || model) : (model ? String(model).split('/').pop() : '默认模型')
      const setModelEffort = v => { setModelEffortState(v); try { localStorage.setItem('rd.effort', v) } catch (e) {} }
      const setPerm = v => { setPermMode(v); try { localStorage.setItem('rd.perm', v) } catch (e) {} }
      const PERM_LABELS = { 'read-only': '仅可查看', 'workspace-write': '工作区修改', 'danger-full-access': '完全权限' }
      const toggleExportFormat = f => setExportFormats(prev => prev.indexOf(f) >= 0 ? prev.filter(x => x !== f) : prev.concat([f]))

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
      const doClear = useCallback(() => { if (busy) return; setClearLibOpen(true) }, [busy])
      const doClearConfirm = useCallback(async () => {
        setClearLibOpen(false)
        setBusy('clear')
        try { const d = await call({ action: 'clear' }); applyLibrary(d); setSelected(null); setPositions({}); notify(d.message || '已清空。', false, true) }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [applyLibrary])
      const doExport = useCallback(async (formats) => {
        const list = Array.isArray(formats) && formats.length ? formats : ['md', 'bib', 'json']
        setBusy('export')
        setExportOpen(false)
        try {
          const d = await call({ action: 'export', formats: list })
          const files = (d && d.files) || []
          for (const f of files) downloadText(f.filename, f.mime, f.content)
          notify('已生成 ' + files.length + ' 个导出文件。')
        } catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [])
      const doImport = useCallback(async file => {
        if (!file) return
        setBusy('import')
        try {
          const text = await file.text()
          const d = await call({ action: 'import', text, format: 'auto' })
          applyLibrary(d)
          notify(d.message || '导入完成。', !d.ok)
        } catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [applyLibrary])
      const doUndo = useCallback(async () => {
        setBusy('undo')
        try { const d = await call({ action: 'undo' }); notify(d.message || '已撤销。'); refresh() }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [refresh])
      const doHistory = useCallback(async () => {
        setHistoryOpen(true)
        try { const d = await call({ action: 'history' }); setHistorySteps((d && d.steps) || []); if (!d || !d.ok) notify(String((d && d.message) || '读取历史失败。'), true) }
        catch (err) { notify(String(err.message || err), true) }
      }, [])
      const doRestore = useCallback(async index => {
        setBusy('restore')
        try { const d = await call({ action: 'restore', index }); applyLibrary(d); notify(d.message || '已回到该节点。', !d.ok); setHistoryOpen(false); refresh() }
        catch (err) { notify(String(err.message || err), true) }
        finally { setBusy('') }
      }, [applyLibrary, refresh])
      const setModelRoute = useCallback(async value => {
        setBusy('model')
        try {
          await call({ action: 'settings', patch: { 'model.route': value } })
          setModel(value)
          setSettingDraft(prev => ({ ...prev, 'model.route': value }))
          setModelPickOpen(false)
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
        setBusy('studio'); notify(null); setStudioIllustration(null); pendingIllustrationRef.current = null
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
      // 场景化配图：先问桥要不要人工拍板；挂进决策区由真人拍板，不另造拍板 UI。
      const runDraftImage = useCallback(async (prompt, approved, decisionId) => {
        return await callWithRetry({ action: 'draft_image', prompt: String(prompt || '').slice(0, 2000), approved: !!approved, collabId: selectedCollabId || undefined, decisionId: decisionId || undefined })
      }, [selectedCollabId])
      const requestIllustration = useCallback(async () => {
        if (!studioDraft || busy) return
        setBusy('illustration'); notify(null)
        try {
          const prompt = '为这份科研初稿配一张配图，帮助读者理解正文主题：' + String(studioDraft).slice(0, 800)
          const d = await runDraftImage(prompt, false)
          if (d && d.gate === 'waiting-human') {
            notify((d && d.message) || '配图需要你拍板，已放到决策区。')
            let collabId = selectedCollabId
            if (!collabId) {
              const created = await callWithRetry({ action: 'collab_create', title: '成稿配图审批', goal: { text: '为成稿初稿配图申请订阅生图额度', source: 'human' } })
              collabId = created && created.collab ? String(created.collab.id) : ''
              if (created && created.library) applyLibrary(created)
              if (collabId) setSelectedCollabId(collabId)
            }
            if (!collabId) { notify('无法建立审批记录，配图取消。', true); return }
            const point = 'risk:outbound:给这份初稿配一张图（调用订阅生图额度）'
            const asked = await askDecision(collabId, point, { scenario: 'draft_image', prompt })
            const decisionId = asked && asked.decisionId ? String(asked.decisionId) : ''
            if (decisionId) pendingIllustrationRef.current = { decisionId, collabId, prompt }
            else notify('审批记录没有建好，配图取消。', true)
            return
          }
          if (!d || d.ok !== true) { notify(String((d && d.message) || '配图暂时做不了。'), true); return }
          if (d.image && d.image.data) { setStudioIllustration({ data: d.image.data, mediaType: d.image.mediaType || 'image/png' }); notify((d && d.message) || '科灵已经配好一张图。') }
          else notify('生图工具没有返回图片。', true)
        } catch (err) { notify(String((err && err.message) || err), true) }
        finally { setBusy('') }
      }, [studioDraft, busy, askDecision, runDraftImage])
      // 先等人拍板落盘，再带决策 id 调桥；approved 只是意图提示，真正的闸门在服务端决策记录。
      const approveIllustration = useCallback(async (collabId, decisionId, prompt) => {
        try {
          await answerDecision(collabId, decisionId, 'approve')
          const res = await runDraftImage(prompt, true, decisionId)
          if (res && res.ok && res.image && res.image.data) {
            setStudioIllustration({ data: res.image.data, mediaType: res.image.mediaType || 'image/png' })
            notify((res && res.message) || '科灵已经配好一张图。')
            pendingIllustrationRef.current = null
          } else notify(String((res && res.message) || '配图失败。'), true)
        } catch (err) { notify(String((err && err.message) || err), true) }
      }, [answerDecision, runDraftImage])
      const send = useCallback(async (text, opts) => {
        // L4 真机探针：默认关闭，仅真机验收脚本显式开启时随 chat_stream 透传 diag。
        let diag = !!(opts && opts.diag === true)
        if (!diag) { try { diag = localStorage.getItem('rd.diag') === '1' } catch (e) {} }
        const q = String(text || '').trim()
        if (!q || busy) return
        const style = ALL_STYLES.concat(customStyles).find(x => x.id === activeStyle)
        const styled = style ? '按「' + style.name + '」写作风格：' + q : q
        setInput('')
        // 用户输入由服务端 chat 回填，不在此本地追加
        setBusy('assistant'); notify(null)
        const ctrl = new AbortController()
        abortRef.current = ctrl
        // 立即显示用户输入；done 时服务端 library.chat 会整体重建消息，不会重复。
        setMsgs(prev => [...prev, { role: 'me', text: q }])
        let acc = ''
        let reasoningAcc = ''
        let toolTrace = []
        let aiStarted = false
        try {
          // 会话归属对齐：send 不带 chatId，服务端按全局 activeChatId 决定这条问答落到哪段会话。
          // 若界面已切/新建会话、但服务端 activeChatId 因竞态还没跟上，先强制切到界面正在显示的会话，
          // 避免回答写进上一段对话（用户反馈「选了新会话，回答却进旧会话」）。
          const targetChatId = library && library.activeChatId
          if (targetChatId) {
            try { await call({ action: 'chat_switch', id: targetChatId }) } catch (e) {}
          }
          // 方式二：科灵通过 ctx.agents 驱动真实 DSH Agent，SSE 流式回传文本与工具过程。
          // 发送时才把待发图片读成纯 base64（两阶段预览的第二阶段），payload 不带 data: 前缀。
          const imagePayload = await Promise.all((images || []).map(async x => ({ name: x.name, mediaType: x.mediaType, data: await readImageBase64(x) })))
          await callStream({
            action: 'chat_stream',
            question: styled,
            effort: modelEffort || undefined,
            perm: permMode,
            ideas: (ideas || []).map(x => ({ text: x.text })),
            docs: (rdDocs || []).map(x => ({ name: x.name })),
            images: imagePayload,
            files: (pendingFiles || []).map(x => ({ name: x.name, data: x.data })),
            rules: (rules || []).map(r => ({ label: r.label || r.text || r.id, off: !!r.off })),
            ...(diag ? { diag: true } : {}),
          }, ev => {
            if (!ev) return
            if (ev.type === 'delta' && ev.kind === 'tool') {
              toolTrace = toolTrace.concat([ev.text || ''])
            } else if (ev.type === 'delta' && ev.text) {
              if (ev.reasoning) reasoningAcc += ev.text
              else acc += ev.text
              setMsgs(prev => {
                const next = prev.slice()
                const reasoning = reasoningAcc || ''
                if (aiStarted && next.length && next[next.length - 1].role === 'ai') next[next.length - 1] = { role: 'ai', text: acc, reasoning: reasoning }
                else { next.push({ role: 'ai', text: acc, reasoning: reasoning }); aiStarted = true }
                return next
              })
            } else if (ev.type === 'done') {
              // 服务端已接收本次提问（含图片）才清空待发送预览；失败/中断时保留，方便重试。
              images.forEach(x => { if (x.previewUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) { try { URL.revokeObjectURL(x.previewUrl) } catch (e) {} } })
              setRdDocs(prev => prev.map(x => x.composerPending ? Object.assign({}, x, { composerPending: false }) : x))
              setImages([])
              setPendingFiles([])
              if (ev.library) applyLibrary(ev)
              if (ev.profileUpdated) notify('科灵把画像蒸馏好了，可以在「资料 → 研究画像」里核对或修正。')
              if (reasoningAcc || toolTrace.length || ev.usageText) setMsgs(prev => {
                const next = prev.slice()
                for (let k = next.length - 1; k >= 0; k--) {
                  if (next[k].role === 'ai') { next[k] = Object.assign({}, next[k], { reasoning: reasoningAcc, toolTrace: toolTrace.slice() }, ev.usageText ? { usageText: String(ev.usageText) } : {}); break }
                }
                return next
              })
            } else if (ev.type === 'error') {
              throw new Error(ev.message || '科灵调用失败')
            }
          }, ctrl.signal)
        } catch (err) {
          if (err && (err.name === 'StopError' || err.name === 'AbortError')) {
            // 用户主动点「停止生成」：静默结束，不留错误提示。
          } else {
            const raw = String((err && err.message) || err)
            const zh = effectiveLang(localeId, hostLang) === 'zh'
            const friendly = isTransientModelError(raw)
              ? (zh ? '模型这次没响应完（连接中断）。请再发一次，或在输入框里换个科灵模型试试。'
                    : 'The model did not finish (connection interrupted). Please send it again or switch the Kelin model in the composer.')
              : (zh ? '这次没能完成，请稍后再试。'
                    : 'Could not complete this request: ' + raw)
            // 失败响应不写入服务端 chat，本地追加一条提示
            setMsgs(prev => [...prev, { role: 'ai', text: friendly }])
          }
        }
        finally {
          if (abortRef.current === ctrl) abortRef.current = null
          setBusy('')
        }
      }, [busy, fullCount, applyLibrary, activeStyle, customStyles, localeId, modelEffort, permMode, ideas, images, rdDocs, rules, library.activeChatId])
      // 停止生成：中断当前请求；host 若已检测 signal 则不会写入这次问答。
      const stopChat = useCallback(() => {
        if (abortRef.current) { try { abortRef.current.abort() } catch (e) {} abortRef.current = null }
      }, [])
      // 清空会话：只清服务端 chat，不动文献/选题/画像。用应用内 Dialog 确认，不用浏览器原生 confirm（webview 里原生 confirm 可能不 resolve）。
      const doClearChat = useCallback(async () => {
        setClearChatOpen(false)
        setBusy('chatclear')
        try { const d = await call({ action: 'chat_clear' }); applyLibrary(d); setMsgs([]); notify('已清空科灵对话。', false, true) }
        catch (err) { notify(String((err && err.message) || err), true) }
        finally { setBusy('') }
      }, [applyLibrary])
      const clearChat = useCallback(() => { if (busy || !msgs.length) return; setClearChatOpen(true) }, [busy, msgs.length])
      // 重新生成：让服务端删掉最后一条问答，再用同一问题重发。
      const regenLast = useCallback(async () => {
        if (busy) return
        let lastQ = ''
        for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'me') { lastQ = msgs[i].text; break } }
        if (!lastQ) return
        try {
          const d = await call({ action: 'chat_clear', last: true })
          applyLibrary(d)
          send(lastQ)
        } catch (err) { notify(String((err && err.message) || err), true) }
      }, [busy, msgs, applyLibrary, send])
      // 会话管理：新建/切换/重命名/删除，全部服务端算人话，客户端只发action并渲染library
      const runChatOp = useCallback(async action => {
        setChatMenuOpen(false)
        setBusy('chatop')
        try { const d = await call(action); applyLibrary(d); notify(d && d.message ? d.message : '已更新对话。') }
        catch (err) { notify(String((err && err.message) || err), true) }
        finally { setBusy('') }
      }, [applyLibrary])
      const chatNewOp = useCallback(() => runChatOp({ action: 'chat_new' }), [runChatOp])
      const chatSwitchOp = useCallback(id => runChatOp({ action: 'chat_switch', id }), [runChatOp])
      // 打开一条命中：切到目标会话、等消息重建后定位到含词消息；多条时可用导航逐条看。
      const openSearchHit = useCallback(async (r, termOverride) => {
        setChatSearchOpen(false)
        const term = String(termOverride || chatSearchQuery || '').trim()
        await chatSwitchOp(r.id)
        setSearchHitTerm(term)
        setHitNav({ index: 0, total: 0 })
      }, [chatSwitchOp, chatSearchQuery])
      // 找历史：查询交给服务端 chat_search，results/message 都是算好的人话，客户端原样渲染。
      const runChatSearch = useCallback(async () => {
        const query = String(chatSearchQuery || '').trim()
        if (!query) { setChatSearchResults([]); return }
        setChatSearchBusy(true)
        try {
          const d = await call({ action: 'chat_search', query })
          const results = Array.isArray(d && d.results) ? d.results : []
          setChatSearchResults(results)
          if (d && d.message) notify(d.message)
          // 只在「全部会话」范围下、命中唯一一段时自动跳；一旦勾选了范围，先列出结果由用户点选。
          if (!selectedSearchChats && results.length === 1 && results[0] && results[0].id) openSearchHit(results[0], query)
        } catch (err) {
          setChatSearchResults([])
          notify(String((err && err.message) || err), true)
        } finally { setChatSearchBusy(false) }
      }, [chatSearchQuery, openSearchHit, selectedSearchChats])
      // 按勾选的会话过滤搜索结果；null（未勾选任何范围）=全部会话。
      const visibleChatSearchResults = selectedSearchChats && selectedSearchChats.size
        ? chatSearchResults.filter(function (x) { return selectedSearchChats.has(String(x && x.id)) })
        : chatSearchResults
      const toggleSearchChat = useCallback(id => {
        setSelectedSearchChats(function (prev) {
          const set = prev ? new Set(prev) : new Set()
          const key = String(id)
          if (set.has(key)) set.delete(key); else set.add(key)
          return set
        })
      }, [])
      const chatDeleteOp = useCallback(id => runChatOp({ action: 'chat_delete', id }), [runChatOp])
      const submitRenameChat = useCallback(async () => {
        const id = renameChatId, title = String(renameChatText || '').trim()
        setRenameChatId('')
        if (!id || !title) return
        setBusy('chatop')
        try { const d = await call({ action: 'chat_rename', id, title }); applyLibrary(d); notify(d && d.message ? d.message : '已改名。') }
        catch (err) { notify(String((err && err.message) || err), true) }
        finally { setBusy('') }
      }, [renameChatId, renameChatText, applyLibrary])
      const pushTopics = useCallback(async () => {
        if (busy) return
        setBusy('topics'); notify(null)
        try {
          const d = await callWithRetry({ action: 'hypothesis' })
          applyLibrary(d)
          const n = ((d && d.library && d.library.hypotheses) || []).length
          notify(n ? '已新增 ' + n + ' 个选题。' : '模型这次没给出可用选题。', !n)
        } catch (err) { notify(String((err && err.message) || err), true) }
        finally { setBusy('') }
      }, [busy, applyLibrary])
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

      // 自检并就地重载：探活后端 + 读取真实请求诊断，再就地刷新面板吃到最新 client.js。
      // 只重载 webview，不重启 DSH 主进程、不碰托盘；host.mjs 的改动仍需重启进程。
      const doSelfReload = useCallback(async () => {
        let alive = false, why = ''
        try { const d = await call({ action: 'status' }); alive = !!(d && d.ok !== false) }
        catch (e) { alive = false; why = (e && e.message) || '请求失败' }
        let diag = {}
        try { diag = JSON.parse(localStorage.getItem('rd.hostDiag') || '{}') } catch (e) {}
        const base = (typeof document !== 'undefined' && document.baseURI) || ''
        const isAppShell = base.indexOf('dsh-app:') === 0
        // 无论后端是否就绪都重载：否则后端异常时用户永远拿不到这次的界面修复。
        // 同时把真正卡住的点摊开，避免又一轮"改了却没解决"。
        if (alive) {
          notify('后端正常（' + (isAppShell ? '桌面壳' : '网页') + '同源），正在就地重载科灵台…')
        } else {
          notify('后端暂不可用（' + why + '）。仍将重载以应用界面修复；若重载后仍报错，需重启 DSH 后端路由。', true)
        }
        setTimeout(function () { try { window.location.reload() } catch (e) {} }, 1500)
      }, [])

      const NAV = [['home', '灵感'], ['discover', '资料'], ['research', '选题'], ['lab', '虚空'], ['style', '文风'], ['schedule', '排期'], ['insights', '复盘']]
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
        F({ key: 'history', icon: 'refresh', label: '浏览历史节点', disabled: busy !== '', onClick: doHistory }),
        F({ key: 'theme', icon: 'theme', label: '切换主题', onClick: () => { setThemeDraft(themeId); setThemeOpen(true) } }),
        F({ key: 'selfreload', icon: 'bolt', label: '自检并就地重载', disabled: busy !== '', onClick: doSelfReload }),
        F({ key: 'gear', icon: 'gear', label: '设置', onClick: () => { setSettingsPage('root'); setSettingsDialogOpen(true) } }),
        dockOpen ? null : h('button', { type: 'button', className: 'md-open-dock', key: 'opendock', onClick: () => setDockOpen(true) }, [
          I({ name: 'chat', size: 15 }), '科灵',
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



      // L4 画像纠错的唯一写入点：整组提交 focus/sources/habits，交给服务端 update_profile 整体赋值。
      const editProfile = async next => {
        const p = library.profile || {}
        const payload = {
          focus: Array.isArray(next.focus) ? next.focus : (Array.isArray(p.focus) ? p.focus : []),
          sources: Array.isArray(next.sources) ? next.sources : (Array.isArray(p.sources) ? p.sources : []),
          habits: Array.isArray(next.habits) ? next.habits : (Array.isArray(p.habits) ? p.habits : []),
        }
        try {
          const d = await call({ action: 'update_profile', ...payload })
          if (d && d.library) applyLibrary(d)
          notify('画像已更新，科灵下次会照这个来。')
        } catch (e) { notify(String((e && e.message) || e), true) }
      }
      // L4 三组画像Chip：删到空也照常整组提交空数组（服务端允许覆盖）。
      const profileGroups = [
        ['focus', '关注方向', '科灵优先留意的研究主题'],
        ['sources', '常用来源', '科灵优先汇集并交叉核验的信息源'],
        ['habits', '研究习惯', '科灵从你的提问里学到的工作方式'],
      ]
      const discoverView = h('div', { className: 'md-page', key: 'discover' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '资料'), h('p', { className: 'md-page-sub', key: 's' }, '科灵记住你的研究方向，主动汇集该看的、该整理的；需要专门调研时，直接下达任务。')]),
        h('style', { key: 'deskcss' }, SMARTDESK_CSS),
        h('div', { className: 'md-desk-stack', key: 'stack' }, [
        h('section', { className: 'md-tile md-i-hero', key: 'hero' }, [h('div', { className: 'md-hero-copy', key: 'c' }, [
          h('h1', { className: 'md-i-line', key: 't' }, ['让资料，', h('b', { key: 'b' }, '主动为你所用'), '。']),
          h('p', { className: 'md-muted', key: 'p' }, '科灵越了解你的研究，越能提前把有用的东西放到你面前。下面是它此刻记住的，和你下一步可以交给它的事。'),
          h('div', { className: 'md-hero-actions', key: 'a' }, [
            h('button', { type: 'button', className: 'md-pill is-primary', key: 'add', onClick: () => { setIdeaCapTab('doc'); setIdeaCapOpen(true) } }, '添加资料'),
            h('button', { type: 'button', className: 'md-pill', key: 'go', onClick: () => setDockOpen(true) }, '交给科灵调研'),
          ]),
        ]), h('dl', { className: 'md-metrics', key: 'm' }, [
          ['已登记资料', num(rdDocs.length), '份'],
          ['已建索引', num(rdDocs.filter(x => x.chunks > 0).length), '份'],
          ['在跟选题', num((library.hypotheses || []).length), '个'],
        ].map(x => h('div', { className: 'md-metric', key: x[0] }, [h('dt', null, x[0]), h('dd', null, [x[1], h('small', null, x[2])])]))),
        ]),
        h('section', { className: 'md-tile', key: 'profile' }, [
          h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '科灵记住的研究画像'), h('span', { className: 'md-tile-meta', key: 'm' }, '随灵感 / 选题 / 资料自动更新')]),
          h('div', { className: 'md-desk-profile-grid', key: 'g' }, [
            h('div', { className: 'md-desk-pcell', key: 'topic' }, [
              h('div', { className: 'md-desk-pcell-top', key: 't' }, [h('i', { key: 'i' }, I({ name: 'target', size: 15 })), '研究方向']),
              h('b', { key: 'n' }, [num((library.hypotheses || []).length), h('small', null, '个在跟课题')]),
              h('div', { className: 'md-desk-pcell-list', key: 'l' }, (library.hypotheses || []).slice(0, 2).map((x, i) => h('em', { key: i }, short(x.title, 11) || '未命名课题'))),
              h('div', { className: 'md-desk-pcell-note', key: 'note' }, '科灵据此追踪相关进展，主动发现值得立项的选题。'),
            ]),
            h('div', { className: 'md-desk-pcell', key: 'src' }, [
              h('div', { className: 'md-desk-pcell-top', key: 't' }, [h('i', { key: 'i' }, I({ name: 'link', size: 15 })), '常用信息源']),
              h('b', { key: 'n' }, [num(['arXiv', 'Europe PMC', 'OpenAlex'].filter(s => papers.some(p => sourceOf(p) === s)).length), h('small', null, '个来源')]),
              h('div', { className: 'md-desk-pcell-list', key: 'l' }, ['arXiv', 'Europe PMC', 'OpenAlex'].filter(s => papers.some(p => sourceOf(p) === s)).map((s, i) => h('em', { key: i }, s))),
              h('div', { className: 'md-desk-pcell-note', key: 'note' }, '科灵优先从这些来源汇集资料，并交叉核验、去重。'),
            ]),
            h('div', { className: 'md-desk-pcell', key: 'idea' }, [
              h('div', { className: 'md-desk-pcell-top', key: 't' }, [h('i', { key: 'i' }, I({ name: 'spark', size: 15 })), '灵感积累']),
              h('b', { key: 'n' }, [num(ideas.length), h('small', null, '条灵感')]),
              h('div', { className: 'md-desk-pcell-list', key: 'l' }, ideas.slice(0, 2).map((x, i) => h('em', { key: i }, short(x.text, 11) || '未命名灵感'))),
              h('div', { className: 'md-desk-pcell-note', key: 'note' }, '科灵从灵感里识别高频主题与值得深挖的想法。'),
            ]),
          ]),
          h('div', { className: 'md-desk-profile-edit', key: 'profile-edit' }, [
            h('div', { className: 'md-profile-edit-head', key: 'h' }, [
              h('h3', { key: 't' }, '科灵学到的画像（可以改）'),
              h('span', { className: 'md-tile-meta', key: 'm' }, library.profile && library.profile.updatedAt ? ('最近更新 · ' + chatRelativeTime(library.profile.updatedAt)) : '从对话与资料里自动提炼'),
              h('button', { type: 'button', className: 'md-pill is-small', key: 'reset', disabled: busy !== '', onClick: () => editProfile({ focus: [], sources: [], habits: [] }) }, '清空画像'),
            ]),
            ...profileGroups.map(g => {
              const key = g[0]
              const arr = Array.isArray((library.profile || {})[key]) ? library.profile[key] : []
              const add = (profileAdd[key] || '').trim()
              return h('div', { className: 'md-profile-edit-group', key: key }, [
                h('div', { className: 'md-profile-edit-label', key: 'l' }, [h('b', { key: 'b' }, g[1]), h('span', { key: 's' }, g[2])]),
                h('div', { className: 'md-profile-edit-chips', key: 'c' }, arr.length
                  ? arr.map((x, i) => h('span', { className: 'md-profile-chip', key: key + i }, [
                      h('span', { key: 't', title: String(x) }, String(x)),
                      h('button', { type: 'button', className: 'md-profile-chip-x', key: 'x', 'aria-label': '移除' + String(x), title: '移除这条', disabled: busy !== '', onClick: () => editProfile({ [key]: arr.filter((_, j) => j !== i) }) }, I({ name: 'close', size: 11 })),
                    ]))
                  : h('em', { key: 'e' }, '还没有' + g[1] + '，可在右侧添加')),
                h('form', { className: 'md-profile-edit-form', key: 'f', onSubmit: e => { e.preventDefault(); if (!add || arr.length >= 40) return; if (arr.some(v => String(v) === add)) { setProfileAdd(prev => ({ ...prev, [key]: '' })); return }; editProfile({ [key]: arr.concat([add]) }); setProfileAdd(prev => ({ ...prev, [key]: '' })) } }, [
                  h('input', { key: 'i', value: profileAdd[key] || '', onChange: e => setProfileAdd(prev => ({ ...prev, [key]: e.target.value })), placeholder: '添加一条' + g[1], 'aria-label': '添加' + g[1] }),
                  h('button', { type: 'submit', className: 'md-btn is-small is-primary', key: 'b', disabled: busy !== '' || !add }, '添加'),
                ]),
              ])
            }),
          ]),
          h('form', { className: 'md-desk-taskform', key: 'tf', onSubmit: e => { e.preventDefault(); const v = deskTaskText.trim(); if (!v) return; setDeskTaskText(''); setDockOpen(true); send(v) } }, [
            h('span', { className: 'md-desk-task-spark', key: 'ic' }, I({ name: 'spark', size: 18 })),
            h('input', { key: 'in', value: deskTaskText, onChange: e => setDeskTaskText(e.target.value), placeholder: '想查什么资料，直接说', 'aria-label': '资料台任务' }),
            h('button', { type: 'submit', className: 'md-send', key: 'go', 'aria-label': '交给科灵', disabled: busy !== '' || !deskTaskText.trim() }, I({ name: 'send', size: 15 })),
          ]),
        ]),
        h('div', { className: 'md-desk-tasks', key: 'tasks' }, [
          [['collect', 'target', '汇集最新资料', '按你的关注方向检索文献与资讯，去重后给清单', '汇集我关注方向的最新文献与资讯，按主题分组，给出清单与来源'],
['organize', 'wall', '整理已有资料', '按主题分类、标出待读与重复，给整理清单', '把资料台已登记资料按主题分类，标出重复与待读，给整理清单'],
['analyze', 'branch', '分析研究画像', '看你最近关注什么，指出该补的资料和该推的选题', '分析我最近的研究画像，指出该补哪些资料、该推进哪个选题'],
['report', 'pen', '写阶段调研报告', '基于已建索引资料写带引用的阶段报告', '基于资料台已建索引的资料写一份阶段性调研报告，带引用'],
['papers', 'search', '查最新论文', '按研究方向跨库检索近期论文，给带引用速览', '检索我研究方向近期发表的论文，跨 arXiv / PubMed / OpenAlex 交叉核验，按主题分组给出带引用与链接的速览'],
['track', 'refresh', '追踪主题进展', '盯住指定主题的最新进展与争议', '围绕我关心的主题，汇集最近进展、关键争议与代表作者，给出可跟进的线索清单'],
['patent', 'link', '找专利与软件', '检索相关专利与开源实现，整理成清单', '检索与我研究方向相关的专利与开源软件，说明许可与获取方式，整理成清单'],
['brief', 'save', '导出调研简报', '把已汇集资料整理成可分享的简报', '把资料台已汇集的资料整理成一份可分享的阶段调研简报：要点、来源、待读与下一步建议']].map(t => h('button', { type: 'button', className: 'md-desk-task' + (deskPick === t[0] ? ' is-active' : ''), key: t[0], onClick: () => { setDeskPick(t[0]); setDeskTaskText(t[4]); } }, [h('span', { className: 'md-desk-task-ic', key: 'i' }, I({ name: t[1], size: 15 })), h('strong', { key: 't' }, t[2]), h('small', { key: 's' }, t[3])]))
        ]),
        h('div', { className: 'md-section-label', key: 'agg' }, '科灵已为你汇集'),
        h('div', { className: 'md-desk-feed', key: 'feed' }, [
          h('section', { className: 'md-tile', key: 'read' }, [
            h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '待读文献'), h('span', { className: 'md-tile-meta', key: 'm' }, papers.filter(p => !(p.chunks > 0)).length + ' 篇未建索引')]),
            papers.filter(p => !(p.chunks > 0)).length ? h('div', { className: 'md-desk-feed-list', key: 'l' }, papers.filter(p => !(p.chunks > 0)).slice(0, 4).map(p => h('div', { className: 'md-desk-feed-row', key: p.id }, [h('span', { className: 'md-thumb', key: 'th' }, h('span', null, p.title.slice(0, 1))), h('span', { className: 'md-top-title', key: 't' }, h('b', null, short(p.title, 52))), h('button', { className: 'md-btn is-small', key: 'go', onClick: () => { setDockOpen(true); send('资料台任务：阅读并总结《' + short(p.title, 40) + '》，加入研究库并建索引') } }, '让科灵读')]))) : h('div', { className: 'md-empty', key: 'e' }, '没有待读文献。检索感兴趣的主题，加入库后让科灵建索引。'),
          ]),
          h('section', { className: 'md-tile', key: 'recent' }, [
            h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '最近登记资料'), h('span', { className: 'md-grow', key: 'sp' }), h('button', { type: 'button', className: 'md-pill is-small', key: 'add', onClick: () => { setIdeaCapTab('doc'); setIdeaCapOpen(true) } }, '+ 添加资料')]),
            rdDocs.length ? h('div', { className: 'md-desk-feed-list', key: 'l' }, rdDocs.slice(0, 4).map(d => h('div', { className: 'md-desk-feed-row', key: d.id }, [h('span', { className: 'md-thumb', key: 'th' }, h('span', null, String(d.name || '?').slice(0, 1).toUpperCase())), h('span', { className: 'md-top-title', key: 't' }, [h('b', null, short(d.name, 48)), h('small', null, (d.chunks > 0 ? '已建索引' : '待解析') + ' · ' + String(d.type || '').toUpperCase())])]))) : h('div', { className: 'md-empty', key: 'e' }, '还没有登记资料。可上传 PDF / Word / PPT / Excel，交给平台技能解析。'),
          ]),
        ]),
        h('div', { className: 'md-section-label', key: 'aux' }, '资料检索与登记（辅助入口）'),
        h('section', { className: 'md-tile', key: 'mat' }, [
          h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '原始资料库'), h('span', { className: 'md-grow', key: 'sp' }), h('button', { type: 'button', className: 'md-pill is-small is-primary', key: 'add', onClick: () => { setIdeaCapTab('doc'); setIdeaCapOpen(true) } }, '+ 添加资料')]),
          rdDocs.length ? h('div', { className: 'md-table-wrap', key: 'tb' }, h('table', { className: 'md-table' }, [
            h('thead', { key: 'th' }, h('tr', null, [h('th', { key: 'n' }, '资料'), h('th', { key: 'ty' }, '类型'), h('th', { key: 'st' }, '状态'), h('th', { key: 'a' }, '操作')])),
            h('tbody', { key: 'body' }, rdDocs.map(d => h('tr', { key: d.id }, [
              h('td', { key: 'n' }, h('div', { className: 'md-table-title' }, [h('strong', { key: 's' }, short(d.name, 70)), h('small', { key: 'p' }, short(d.path, 90))])),
              h('td', { key: 'ty' }, String(d.type || '').toUpperCase()),
              h('td', { key: 'st' }, d.indexed === 'queued' ? '已交给平台' : (d.chunks > 0 ? '已建索引' : '待解析')),
              h('td', { key: 'a' }, h('button', { type: 'button', className: 'md-btn is-small', disabled: rdDocBusy === d.id, key: 'go', onClick: () => indexRdDoc(d) }, rdDocBusy === d.id ? '处理中…' : '交给平台解析')),
            ]))),
          ])) : h('div', { className: 'md-empty', key: 'e' }, '还没有原始资料。点「添加资料」上传 PDF / Word / PPT / Excel 等科研文件。'),
        ]),
        h('form', { className: 'md-search', key: 'search', onSubmit: e => { e.preventDefault(); doSearch() } }, [
          I({ name: 'search', size: 15, key: 'ic' }),
          h('input', { key: 'in', value: query, onChange: e => setQuery(e.target.value), placeholder: '输入主题开始检索…', 'aria-label': '检索主题' }),
        ]),
        searchResults.length ? h('div', { className: 'md-table-wrap', key: 'tbl' }, h('table', { className: 'md-table' }, [
          h('thead', { key: 'th' }, h('tr', null, [h('th', { key: 'a' }, '文献'), h('th', { key: 'b' }, '来源'), h('th', { key: 'c' }, '')])),
          h('tbody', { key: 'tb' }, searchResults.map((p, i) => h('tr', { key: i }, [
            h('td', { key: 't' }, h('div', { className: 'md-table-title' }, [h('strong', { key: 's' }, short(p.title, 90)), h('small', { key: 'a' }, short(p.abstract, 140))])),
            h('td', { key: 'src' }, sourceOf(p)),
            h('td', { key: 'act' }, h('button', { className: 'md-btn is-small is-primary', disabled: busy !== '', onClick: () => addPapers([p]) }, '加入库')),
          ]))),
        ])) : h('div', { className: 'md-empty', key: 'e' }, '输入主题开始检索。检索结果可逐条加入文献库。'),
      ])
      ])

      // 关3：显示/取值分离——底层英文值不动，仅把显示文字中文化；未命中原样返回，品牌名不误伤。
      const OPTION_LABELS = {
        'sources': { arxiv: 'arXiv', europepmc: 'Europe PMC', openalex: 'OpenAlex' },
        'kelin.role': { lead: '带队', methodologist: '方法', engineer: '工程', analyst: '分析' },
        'review.perspectives': { methodology: '方法学', evidence: '证据', contradictions: '矛盾与争议', gaps: '研究缺口', applications: '应用与影响' },
        'stats.adjust': { none: '不校正', holm: 'Holm 校正', bonferroni: 'Bonferroni 校正' },
        'image.source': { auto: '自动（优先订阅工具）', http: '只用自带密钥', tool: '只用订阅生图工具' },
        'image.protocol': { openai: 'OpenAI 兼容', bailian: '阿里百炼', wan: '万相异步' },
      }
      const optionLabel = (key, o) => {
        const table = OPTION_LABELS[key]
        return table && Object.prototype.hasOwnProperty.call(table, o) ? table[o] : o
      }

      const renderField = row => {
        const v = settingDraft[row.key]
        const set = next => setSettingDraft(prev => ({ ...prev, [row.key]: next }))
        let input
        if (row.type === 'bool') return h('div', { key: row.key, style: { display: 'flex', flexDirection: 'column', gap: 5 } }, [h('label', { className: 'md-check' }, [h('input', { type: 'checkbox', checked: !!v, onChange: e => set(e.target.checked) }), h('span', null, row.label)]), row.help ? h('small', { style: { color: 'var(--ink3)', fontSize: '11.5px', lineHeight: '16px' } }, row.help) : null])
        else if (row.type === 'enum') input = h('select', { key: 'i', value: v == null ? '' : v, onChange: e => set(e.target.value) }, (row.options || []).map(o => h('option', { key: o, value: o }, optionLabel(row.key, o))))
        else if (row.type === 'enumList') {
          const arr = Array.isArray(v) ? v : []
          input = h('div', { className: 'md-presets', key: 'i' }, (row.options || []).map(o =>
            h('button', { key: o, type: 'button', className: arr.includes(o) ? 'is-on' : '', onClick: () => set(arr.includes(o) ? arr.filter(x => x !== o) : arr.concat([o])) }, optionLabel(row.key, o))))
        } else input = h('input', { key: 'i', type: row.type === 'int' || row.type === 'float' ? 'number' : 'text', value: v == null ? '' : v, placeholder: row.secret ? '环境变量名' : '', onChange: e => set(e.target.value) })
        return h('label', { className: 'md-field', key: row.key }, [h('span', { key: 'l' }, row.label), input, row.help ? h('small', { key: 'h' }, row.help) : null])
      }

      const IMAGE_PRESETS = [
        { label: 'OpenAI', patch: { 'image.protocol': 'openai', 'image.baseUrl': 'https://api.openai.com/v1', 'image.model': 'gpt-image-1', 'image.size': '1536x1024', 'image.quality': 'medium' } },
        { label: 'xAI', patch: { 'image.protocol': 'openai', 'image.baseUrl': 'https://api.x.ai/v1', 'image.model': 'grok-2-image', 'image.size': '' } },
        { label: '火山方舟', patch: { 'image.protocol': 'openai', 'image.baseUrl': 'https://ark.cn-beijing.volces.com/api/v3', 'image.model': '', 'image.size': '1024x1024' } },
        { label: '智谱', patch: { 'image.protocol': 'openai', 'image.baseUrl': 'https://open.bigmodel.cn/api/paas/v4', 'image.model': 'cogview-4', 'image.size': '1024x1024' } },
        { label: '硅基流动', patch: { 'image.protocol': 'openai', 'image.baseUrl': 'https://api.siliconflow.cn/v1', 'image.model': '', 'image.size': '', 'image.extra': '{"image_size":"1024x1024"}' } },
        { label: '阿里云百炼', patch: { 'image.protocol': 'bailian', 'image.baseUrl': 'https://dashscope.aliyuncs.com', 'image.model': 'qwen-image-2.0-pro', 'image.size': '2688x1536' } },
        { label: '百炼Token Plan', patch: { 'image.protocol': 'bailian', 'image.baseUrl': 'https://token-plan.cn-beijing.maas.aliyuncs.com', 'image.model': 'qwen-image-3.0-pro', 'image.size': '1024x1024' } },
        { label: '百炼万相异步', patch: { 'image.protocol': 'wan', 'image.baseUrl': 'https://dashscope.aliyuncs.com', 'image.model': 'wan2.5-t2i-preview', 'image.size': '1280x1280' } },
        { label: '其他自定义', patch: { 'image.baseUrl': '', 'image.model': '', 'image.size': '1024x1024' } },
      ]
      const applyImagePreset = patch => setSettingDraft(prev => ({ ...prev, ...patch }))
      const imageToolTip = imageToolAvailable
        ? '检测到订阅生图工具：自动或只用订阅生图工具都能生成；选只用自带密钥则走你自己的接口。'
        : '未检测到订阅生图工具：选只用订阅生图工具会生成失败，请填自有接口或等工具装好。'
      const CLABEL = { paper: '文献', image: '图片', table: '表格', report: '报告', link: '网页', note: '笔记' }
      const CCOVER = x => x.cover || (x.kind === 'image' ? 'linear-gradient(160deg,#cfe3d6,#6f9d86 55%,#34524a)' : null)
      const DEFAULT_CONTENT_STATUS = { 'idea-p1': 'outline', 'idea-p2': 'draft', 'idea-i1': 'draft', 'idea-r1': 'ready', 'idea-r2': 'published', 'idea-n1': 'published' }
      const ADAPT = o => Object.assign({ cover: null, platform: '', scheduledAt: '', createdAt: o.at || '', source: '', tags: [], drafted: false, scripted: false }, o)
      const CONTENT_STAGES = [['idea', '灵感'], ['outline', '大纲'], ['draft', '草稿'], ['ready', '待发布'], ['published', '已发布']]
      const contentItems = [
        ...ideas.map(x => ADAPT({ id: x.id, title: short(x.text, 80), body: x.body || '', kind: x.kind, status: contentStatus[x.id] || DEFAULT_CONTENT_STATUS[x.id] || 'idea', cover: CCOVER(x), scheduledAt: schedule[x.id] || '', source: x.source || '', tags: [CLABEL[x.kind] || '笔记'], raw: x })),
        ...papers.map(p => ADAPT({ id: p.id, kind: '论文', title: p.title, body: short(p.abstract, 180), status: p.chunks > 0 ? 'draft' : 'idea', source: sourceOf(p), at: p.year || '', platform: 'arXiv', tags: ['文献'], raw: p })),
        ...(library.hypotheses || []).map(x => ADAPT({ id: x.id, kind: '选题', title: x.title, body: x.rationale || x.gap || '', status: contentStatus[x.id] || ({ draft: 'outline', testing: 'outline', supported: 'draft', rejected: 'idea', held: 'idea' }[x.status] || 'idea'), source: '选题', tags: ['选题'], raw: x })),
        ...(library.reviews || []).map(x => ADAPT({ id: x.id, kind: '综述', title: x.topic || '综述', body: '', status: 'ready', source: '综述', tags: ['综述'], drafted: true, raw: x })),
        ...(library.drafts || []).map(x => ADAPT({ id: x.id, kind: '草稿', title: x.title || '草稿', body: short(x.body, 180), status: x.status || contentStatus[x.id] || 'draft', source: '写作', tags: ['草稿'], drafted: true, raw: x })),
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
          onDrop: e => {
            e.preventDefault(); setBoardOver(null)
            const id = e.dataTransfer && e.dataTransfer.getData('text/research-desk-item')
            if (!id) return
            // 成稿状态由服务端落库；其它卡片仍用本地看板状态（不是发布闭环）。
            if (!(library.drafts || []).some(d => d.id === id)) { setContentStatus(prev => Object.assign({}, prev, { [id]: sid })); return }
            call({ action: 'set_draft_status', id, status: sid })
              .then(d => { applyLibrary(d); if (d && d.message) setToast({ text: d.message }) })
              .catch(err => setToast({ text: String(err && err.message || err), error: true }))
          }
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
          h('td', { key: 'st' }, h('span', { className: 'md-status status-' + x.status }, '写作: ' + ((CONTENT_STAGES.find(c => c[0] === x.status) || [])[1] || x.status))),
          h('td', { key: 'pf' }, x.platform || '—'), h('td', { className: 'md-nowrap', key: 'sc' }, x.scheduledAt || '—'), h('td', { className: 'md-nowrap', key: 'at' }, x.createdAt || '—'),
        ]))),
      ]))
      const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
      const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      const WEEKS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const todayStr = isoDay(new Date())
      const relDay = s => { if (!s) return ''; const a = new Date(s + 'T00:00:00'), b = new Date(todayStr + 'T00:00:00'); const n = Math.round((a - b) / 86400000); if (n === 0) return '今天'; if (n === 1) return '明天'; if (n === 2) return '后天'; if (n === -1) return '昨天'; if (n < 0) return (-n) + '天前'; const p = s.split('-'); return (+p[1]) + '月' + (+p[2]) + '日' }
      const geDay = s => { const p = String(s || '').split('-'); return p.length < 3 ? '' : (+p[1]) + '月' + (+p[2]) + '日' }
      const slotTime = id => String(9 + (hashCode(id) % 12)).padStart(2, '0') + ':00'
      const coverSrc = it => { const m = it.paper && it.paper.media; const c = it.idea ? CCOVER(it.idea) : (m && (m.poster || m.src)) || null; return c && /^(https?:|data:|blob:)/i.test(c) ? c : null }
      const coverStyle = it => { const src = coverSrc(it); if (src) return { backgroundImage: 'url("' + src + '")', backgroundSize: 'cover', backgroundPosition: 'center' }; const c = it.idea ? CCOVER(it.idea) : null; return c && !/^(https?:|data:|blob:)/i.test(c) ? { background: c } : null }
      const typeChar = k => (CLABEL[k] || '文').slice(0, 1)
      const atSet = new Set(ideas.map(x => x.at).filter(Boolean))
      let streak = 0
      { const d = new Date(); if (!atSet.has(isoDay(d))) d.setDate(d.getDate() - 1); while (atSet.has(isoDay(d))) { streak++; d.setDate(d.getDate() - 1) } }
      const calYear = calMonth.getFullYear(), calMon = calMonth.getMonth()
      const monthPrefix = calYear + '-' + String(calMon + 1).padStart(2, '0')
      const firstDay = new Date(calYear, calMon, 1).getDay()
      const calCells = []
      for (let ci = 0; ci < 42; ci++) calCells.push(new Date(calYear, calMon, ci - firstDay + 1))
      const shownCells = calCells[28].getMonth() !== calMon ? calCells.slice(0, 28) : (calCells[35].getMonth() === calMon ? calCells : calCells.slice(0, 35))
      const schedItems = ideas.map(x => ({ id: x.id, title: short(x.text, 80), kind: x.kind, idea: x })).concat(papers.map(p => ({ id: p.id, title: p.title, kind: 'paper', paper: p })))
      const byDay = {}
      for (const it of schedItems) { const day = schedule[it.id]; if (!day) continue; (byDay[day] = byDay[day] || []).push(it) }
      const monthIdeaCount = ideas.filter(x => String(x.at || '').slice(0, 7) === monthPrefix).length
      const monthPubCount = ideas.filter(x => contentStatus[x.id] === 'published' && String(x.at || '').slice(0, 7) === monthPrefix).length
      const pendingCount = schedItems.filter(it => !schedule[it.id]).length
      const autoScheduleAll = () => { const fresh = buildIdeaSchedule(ideas, new Date()); setSchedule(prev => Object.assign({}, prev, fresh)); notify('已为 ' + ideas.length + ' 个灵感排好期：工作日每天 2 条，周末每天 1 条。') }
      const calendar = h('section', { className: 'md-tile md-cal-tile', key: 'cal' }, [
        h('header', { className: 'md-cal-head', key: 'head' }, [
          h('div', { className: 'md-cal-num', key: 'num' }, String(calMon + 1).padStart(2, '0')),
          h('div', { className: 'md-cal-month', key: 'mon' }, [h('span', { key: 'y' }, calYear), h('em', { key: 'm' }, MONTHS_EN[calMon])]),
          h('dl', { className: 'md-cal-stats', key: 'stats' }, [
            h('div', { key: 's1' }, [h('dt', { key: 'd' }, '连续记录'), h('dd', { key: 'v' }, [streak, h('small', { key: 'u' }, '天')])]),
            h('div', { key: 's2' }, [h('dt', { key: 'd' }, '本月灵感'), h('dd', { key: 'v' }, [monthIdeaCount, h('small', { key: 'u' }, '条')])]),
            h('div', { key: 's3' }, [h('dt', { key: 'd' }, '本月发布'), h('dd', { key: 'v' }, [monthPubCount, h('small', { key: 'u' }, '条')])]),
          ]),
          h('span', { className: 'md-grow', key: 'grow' }),
          F({ key: 'prev', icon: 'chevL', label: '上个月', onClick: () => setCalMonth(new Date(calYear, calMon - 1, 1)) }),
          h('button', { type: 'button', className: 'md-pill is-small', key: 'today', onClick: () => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }, '今天'),
          h('button', { type: 'button', className: 'md-pill is-small', key: 'auto', title: '重新为所有灵感排期', onClick: autoScheduleAll }, '智能排期'),
          F({ key: 'next', icon: 'chevR', label: '下个月', onClick: () => setCalMonth(new Date(calYear, calMon + 1, 1)) }),
        ]),
        h('div', { className: 'md-cal-weeks', key: 'weeks' }, WEEKS.map(w => h('span', { key: w }, w))),
        h('div', { className: 'md-cal-grid', role: 'grid', key: 'grid', style: { '--rows': shownCells.length / 7 } }, shownCells.map(d => {
          const day = isoDay(d), list = byDay[day] || [], isToday = day === todayStr
          const first = list[0], cs = first ? coverStyle(first) : null
          const stamp = first ? h('span', { className: 'md-cal-stamp', key: 'stamp' },
            h('span', { className: 'md-stamp' + (cs ? '' : ' is-type tone-' + (hashCode(first.id) % 6)), style: cs || undefined }, [
              cs ? null : typeChar(first.kind), list.length > 1 ? h('i', null, String(list.length)) : null
            ])) : null
          return h('div', { key: day, role: 'gridcell', className: 'md-cal-cell ' + (d.getMonth() !== calMon ? 'is-outside ' : '') + (isToday ? 'is-today' : ''),
            onDragOver: e => e.preventDefault(),
            onDrop: e => { e.preventDefault(); const id = e.dataTransfer.getData('text/research-desk-paper'); if (id) { setSchedule(prev => Object.assign({}, prev, { [id]: day })); notify('已排期到 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日。') } },
          }, [
            h('div', { className: 'md-cal-cell-top', key: 'top' }, [h('span', { className: 'md-cal-date', key: 'date' }, d.getDate()), stamp]),
            h('div', { className: 'md-cal-posts', key: 'posts' }, [
              ...list.slice(0, 2).map(it => {
                const s = coverStyle(it)
                return h('button', { type: 'button', key: it.id, draggable: true, className: 'md-cal-chip', title: it.title, onDragStart: e => e.dataTransfer.setData('text/research-desk-paper', it.id), onClick: () => it.idea ? openStudio(it.id, it.idea) : setSelected(it.paper) }, [
                  h('span', { className: 'md-cal-thumb', key: 'th', style: s || undefined }, s ? null : h('span', null, typeChar(it.kind))),
                  h('span', { className: 'md-cal-chip-text', key: 't' }, [h('time', { key: 'tm' }, slotTime(it.id)), h('span', { key: 's' }, short(it.title, 18))]),
                ])
              }),
              list.length > 2 ? h('span', { className: 'md-cal-more', key: 'more' }, '还有 ' + (list.length - 2) + ' 条') : null,
            ]),
          ])
        })),
      ])
      const unscheduled = ideas.filter(x => !schedule[x.id]).map(x => ({ id: x.id, title: short(x.text, 80), kind: x.kind, idea: x }))
      const scheduled = schedItems.filter(it => schedule[it.id]).sort((a, b) => String(schedule[a.id]).localeCompare(String(schedule[b.id])))
      const nextItem = scheduled.filter(it => it.idea).concat(scheduled.filter(it => !it.idea))[0]
      const rail = h('aside', { className: 'md-rail-col', key: 'rail' }, [
        nextItem ? h('button', { type: 'button', className: 'md-next', key: 'next', onClick: () => { if (nextItem.idea) { openStudio(nextItem.id, nextItem.idea) } else { setSelected(nextItem.paper); setView('discover') } } }, [
          h('span', { className: 'md-next-top', key: 'top' }, [h('span', { key: 'l' }, '下一条'), h('span', { key: 'd' }, relDay(schedule[nextItem.id]))]),
          h('b', { key: 'b' }, slotTime(nextItem.id)),
          h('p', { key: 't' }, short(nextItem.title, 60)),
          h('span', { className: 'md-next-foot', key: 'f' }, (nextItem.idea ? (CLABEL[nextItem.kind] || '灵感') : '文献') + ' · ' + ((nextItem.idea && nextItem.idea.source) || '灵感速记') + ' · ' + geDay(schedule[nextItem.id])),
        ]) : null,
        h('section', { className: 'md-tile md-tray', key: 'tray', 'aria-label': '待排期' }, [
          h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '待排期'), h('span', { className: 'md-tile-meta', key: 'm' }, short(String(pendingCount) + ' 条灵感 · 拖到日历上安排成稿', 40))]),
          h('div', { className: 'md-tray-scroll', key: 'scroll' }, [
            unscheduled.length ? h('div', { className: 'md-tray-grid', key: 'grid' }, unscheduled.slice(0, 12).map(it => {
              const s = coverStyle(it)
              return h('button', { type: 'button', key: it.id, draggable: true, className: 'md-tray-card', onDragStart: e => e.dataTransfer.setData('text/research-desk-paper', it.id), onClick: () => it.idea ? openStudio(it.id, it.idea) : setSelected(it.paper) }, [
                h('span', { className: 'md-tray-cover' + (s ? '' : ' is-type'), key: 'c', style: s || undefined }, s ? null : h('b', null, short(it.title, 10))),
                h('span', { className: 'md-tray-title', key: 't' }, short(it.title, 42)),
              ])
            }))
              : h('p', { className: 'md-tray-empty', key: 'empty' }, '所有灵感都已排好期。需要调整就把日历上的卡片拖到别的日子。'),
          ]),
        ]),
      ])
      const reviewData = (library.reviews && library.reviews[0]) || null
      const docIndexed = rdDocs.filter(x => x.chunks > 0).length
      const hyps = library.hypotheses || []
      const drafts = library.drafts || []
      const stageCounts = {}
      for (const v of Object.values(contentStatus)) stageCounts[v] = (stageCounts[v] || 0) + 1
      const doneCount = drafts.length + (stageCounts.ready || 0) + (stageCounts.published || 0)
      const publishedCount = (stageCounts.published || 0) + (stageCounts['已发布'] || 0)
      const nextHint = doneCount < hyps.length ? '把选题推进成稿' : (publishedCount < doneCount ? '把成稿推进到发布' : '继续补充灵感和资料，保持节奏')
      const scheduleView = h('div', { className: 'md-page', key: 'schedule' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '排期'), h('p', { className: 'md-page-sub', key: 's' }, '科灵替你把灵感排进日历，盯住节奏；要让科灵接着推进，直接下达任务。')]),
        h('style', { key: 'deskcss' }, SMARTDESK_CSS),
        h('section', { className: 'md-tile md-i-hero', key: 'hero', style: { marginBottom: 24 } }, [h('div', { className: 'md-hero-copy', key: 'c' }, [
          h('h1', { className: 'md-i-line', key: 't' }, ['让节奏，', h('b', { key: 'b' }, '交给科灵安排'), '。']),
          h('p', { className: 'md-muted', key: 'p' }, nextHint),
          h('div', { className: 'md-hero-actions', key: 'a' }, [
            h('button', { type: 'button', className: 'md-pill is-primary', key: 'go', disabled: busy !== '', onClick: () => send('根据我当前的灵感与选题，给我排一个接下来的研究节奏') }, [I({ name: 'spark', size: 14, key: 'i' }), '让科灵安排节奏']),
            h('button', { type: 'button', className: 'md-pill', key: 'cal', onClick: autoScheduleAll }, [I({ name: 'wall', size: 14, key: 'i' }), '智能排期']),
          ]),
        ]), h('dl', { className: 'md-metrics', key: 'm' }, [
          ['待排灵感', num(pendingCount), '条'],
          ['本月发布', num(monthPubCount), '条'],
          ['连续记录', streak, '天'],
        ].map(x => h('div', { className: 'md-metric', key: x[0] }, [h('dt', null, x[0]), h('dd', null, [x[1], h('small', null, x[2])])])))]),
        h('div', { className: 'md-schedule', key: 's' }, [calendar, rail]),
      ])
      const insightMetrics = [
        { label: '原始资料', value: num(rdDocs.length), unit: '份' },
        { label: '选题假设', value: num(hyps.length), unit: '条' },
        { label: '已成稿', value: num(doneCount), unit: '篇' },
        { label: '综述产出', value: num((library.reviews || []).length), unit: '篇' },
      ]
      const metric = m => h('div', { className: 'md-metric', key: m.label }, [h('dt', { key: 'd' }, m.label), h('dd', { key: 'v' }, [m.value, h('small', { key: 'u' }, m.unit)])])

      // 第一版骨架：文献年份分布 / 来源分布 / 高影响文献 / 研究建议（2×2 五宫格）
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
      const topLi = (p) => h('div', { className: 'md-desk-feed-row', key: p.id }, [
        h('span', { className: 'md-thumb', key: 'th' }, h('span', null, p.title.slice(0, 1))),
        h('span', { className: 'md-top-title', key: 't' }, [h('b', null, short(p.title, 52)), h('small', null, sourceOf(p) + ' · 被引 ' + (p.citedBy || 0))]),
        h('button', { type: 'button', className: 'md-btn is-small', key: 'go', onClick: () => { setDockOpen(true); send('资料台任务：阅读并总结《' + short(p.title, 40) + '》，加入研究库并建索引') } }, '让科灵读'),
      ])
      const top = h('section', { className: 'md-tile md-i-top', key: 'top' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, h('h2', null, '高影响文献')),
        topPapers.length ? h('div', { className: 'md-desk-feed-list', key: 'l' }, topPapers.map(topLi))
          : h('p', { className: 'md-muted', key: 'e' }, '加入文献后，这里按被引量排序。'),
      ])
      // 细节修正：研究建议直接给真实统计数，不用跳科灵打字
      const sugg = []
      if (ideas.length > hyps.length) sugg.push([ideas.length - hyps.length + ' 条灵感还没长成选题', '到选题验证视角让科灵把灵感聚成研究问题', 'verify'])
      if (hyps.length > doneCount) sugg.push([hyps.length - doneCount + ' 个选题还没进成稿', '交给科灵，到选题发布视角挑一个进成稿工作室', 'publish'])
      if (rdDocs.length > docIndexed) sugg.push([rdDocs.length - docIndexed + ' 份资料还没建索引', '交给平台技能解析建索引，资料才能回答研究问题', 'discover'])
      if (publishedCount < doneCount) sugg.push([doneCount - publishedCount + ' 篇成稿还没发布', '到选题发布视角检查成稿，推进到待发布 / 已发布', 'publish'])
      if (!sugg.length) sugg.push(['链路通畅，没有明显堆积', '继续补充灵感与资料，保持节奏', 'home'])
      const advice = h('section', { className: 'md-tile md-i-advice', key: 'advice' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '研究建议'), h('span', { className: 'md-grow', key: 'sp' }), h('button', { type: 'button', className: 'md-pill is-small', key: 'again', disabled: busy !== '', onClick: () => send('根据我当前的研究进度，给我下一阶段的具体建议') }, [I({ name: 'spark', size: 13, key: 'i' }), '让科灵细化'])]),
        h('div', { className: 'md-suggest', key: 'list' }, sugg.map((s, i) => h('div', { className: 'md-suggest-row', key: i }, [h('b', { key: 'n' }, i + 1), h('p', { key: 'p' }, [s[0], h('small', { key: 'h' }, s[1])]), h('button', { type: 'button', className: 'md-btn is-small', key: 'go', style: { flex: 'none', alignSelf: 'center', marginLeft: 'auto' }, onClick: () => ((s[2] === 'verify' || s[2] === 'publish') ? openResearch(s[2]) : setView(s[2])) }, '交给科灵')]))),
      ])

      // ===== 下半区：研究过程分析五栏目（分区叠加，独立于上方五宫格） =====
      const funnelSteps = [
        { n: ideas.length, label: '灵感', hint: '记下的想法', to: 'home' },
        { n: hyps.length, label: '选题', hint: '长成选题', to: 'verify' },
        { n: doneCount, label: '成稿', hint: '草稿与待发布', to: 'publish' },
        { n: publishedCount, label: '发布', hint: '已产出成稿', to: 'publish' },
      ]
      const funnelRate = (a, b) => a ? Math.round(b / a * 100) + '%' : '—'
      const funnel = h('section', { className: 'md-tile md-i-funnel', key: 'funnel' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '研究转化漏斗'), h('span', { className: 'md-tile-meta', key: 'm' }, '从想法到产出，看卡在哪一环')]),
        h('div', { className: 'md-funnel', key: 'f' }, funnelSteps.reduce((acc, s, i) => {
          acc.push(h('button', { type: 'button', key: s.label, className: 'md-funnel-step', onClick: () => ((s.to === 'verify' || s.to === 'publish') ? openResearch(s.to) : setView(s.to)) }, [
            h('b', { key: 'n' }, [s.n, h('small', { key: 'u' }, '项')]),
            h('span', { key: 'l' }, s.label),
            h('i', { key: 'hint' }, s.hint),
          ]))
          if (i < 3) acc.push(h('span', { className: 'md-funnel-arrow', key: 'arr' + i }, '›'))
          return acc
        }, [])),
        h('p', { className: 'md-funnel-rate', key: 'rate' }, [
          '灵感→选题 ', h('b', { key: 'a' }, funnelRate(ideas.length, hyps.length)),
          ' · 选题→成稿 ', h('b', { key: 'b' }, funnelRate(hyps.length, doneCount)),
          ' · 成稿→发布 ', h('b', { key: 'c' }, funnelRate(doneCount, publishedCount)),
          '。', doneCount < hyps.length ? '重点是让选题进入成稿。' : (publishedCount < doneCount ? '成稿已具备，推进发布。' : '链路通畅，继续补充灵感。'),
        ]),
      ])

      const growth = {}
      const bump = (day, which) => { if (!day) return; const k = String(day).slice(0, 10); if (k[4] !== '-' || k[7] !== '-') return; if (!growth[k]) growth[k] = { idea: 0, doc: 0 }; growth[k][which]++ }
      for (const x of ideas) bump(x.at, 'idea')
      for (const x of rdDocs) bump(x.addedAt || x.at, 'doc')
      const growthKeys = Object.keys(growth).sort().slice(-14)
      let accIdea = 0, accDoc = 0
      const growthPts = growthKeys.map(k => { accIdea += growth[k].idea; accDoc += growth[k].doc; return { k, idea: accIdea, doc: accDoc } })
      const gmax = Math.max(1, ...growthPts.map(p => p.idea + p.doc))
      const gxy = (i, v) => [(growthPts.length < 2 ? 300 : (i / (growthPts.length - 1)) * 600), 180 - (v / gmax) * 150]
      const gpath = key => growthPts.length ? 'M' + growthPts.map((p, i) => { const q = gxy(i, p[key]); return q[0].toFixed(1) + ',' + q[1].toFixed(1) }).join(' L') : ''
      const growthTile = h('section', { className: 'md-tile md-i-trend', key: 'growth' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '真实增长曲线'), h('span', { className: 'md-tile-meta', key: 'm' }, '按灵感与资料的记录日期累计')]),
        h('svg', { className: 'md-i-chart-svg', viewBox: '0 0 600 180', role: 'img', 'aria-label': '研究积累趋势' }, [
          h('path', { className: 'md-chart-line', key: 'l', d: gpath('idea'), style: { stroke: 'var(--primary)' } }),
          h('path', { className: 'md-chart-line', key: 'd', d: gpath('doc'), style: { stroke: 'var(--accent)' } }),
        ]),
        h('div', { className: 'md-pace-legend', key: 'lg' }, [h('span', { key: 'i' }, h('i', { className: 'md-pace-idea' }), '灵感'), h('span', { key: 'd' }, h('i', { className: 'md-pace-topic' }), '资料')]),
      ])

      const months = []
      const nowD = new Date()
      for (let i = 5; i >= 0; i--) { const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1); months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
      const paceRows = months.map(k => ({ k, idea: ideas.filter(x => String(x.at || '').slice(0, 7) === k).length, topic: hyps.filter(x => String(x.at || '').slice(0, 7) === k).length, done: drafts.filter(x => String(x.at || '').slice(0, 7) === k).length }))
      const pacemax = Math.max(1, ...paceRows.map(r => Math.max(r.idea, r.topic, r.done)))
      const pace = h('section', { className: 'md-tile md-i-pace', key: 'pace' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '产出节奏'), h('span', { className: 'md-tile-meta', key: 'm' }, '近 6 个月')]),
        h('div', { className: 'md-pace', key: 'bars' }, paceRows.map(r => h('div', { className: 'md-pace-col', key: r.k }, [
          h('div', { className: 'md-pace-bars', key: 'b' }, [
            h('i', { className: 'md-pace-idea', key: 'i', style: { height: (r.idea / pacemax * 110) + 'px' }, title: '灵感 ' + r.idea }),
            h('i', { className: 'md-pace-topic', key: 't', style: { height: (r.topic / pacemax * 110) + 'px' }, title: '选题 ' + r.topic }),
            h('i', { className: 'md-pace-done', key: 'd', style: { height: (r.done / pacemax * 110) + 'px' }, title: '成稿 ' + r.done }),
          ]),
          h('small', { key: 'k' }, r.k.slice(2)),
        ]))),
        h('div', { className: 'md-pace-legend', key: 'lg' }, [h('span', { key: 'i' }, h('i', { className: 'md-pace-idea' }), '灵感'), h('span', { key: 't' }, h('i', { className: 'md-pace-topic' }), '选题'), h('span', { key: 'd' }, h('i', { className: 'md-pace-done' }), '成稿')]),
      ])

      const citedDocs = rdDocs.filter(d => { const nm = String(d.name || '').replace(/.[^.]+$/, '').slice(0, 8); return nm && (drafts.some(x => String(x.text || x.body || '').includes(nm)) || hyps.some(x => String(x.evidence || x.gap || '').includes(nm))) }).length
      const util = h('section', { className: 'md-tile md-i-util', key: 'util' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '资料利用度'), h('span', { className: 'md-tile-meta', key: 'm' }, '登记不等于用上')]),
        h('div', { className: 'md-util-grid', key: 'g' }, [
          h('div', { className: 'md-util-cell', key: 'r' }, [h('b', null, num(rdDocs.length)), h('span', null, '已登记'), h('small', null, '在「资料」里登记的科研文件')]),
          h('div', { className: 'md-util-cell', key: 'i' }, [h('b', null, num(docIndexed)), h('span', null, '已建索引'), h('small', null, rdDocs.length ? '占登记资料 ' + Math.round(docIndexed / rdDocs.length * 100) + '%' : '交给平台插件解析后计入')]),
          h('div', { className: 'md-util-cell', key: 'c' }, [h('b', null, num(citedDocs)), h('span', null, '被引用'), h('small', null, '按文件名在选题与草稿中出现统计')]),
        ]),
      ])

      // 下半区不再重复「研究建议」：上区五宫格已有同一组 sugg，避免同内容出现两次。

      const insightsView = (ideas.length || hyps.length || rdDocs.length || papers.length) ? h('div', { className: 'md-page', key: 'insights' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '复盘'), h('p', { className: 'md-page-sub', key: 's' }, '科灵把你的研究进展汇总成可读的判断：看到哪一步成形、哪些资料还没用上、下一步做什么。')]),
        h('style', { key: 'deskcss' }, SMARTDESK_CSS),
        h('div', { className: 'md-insights', key: 'in' }, [
        h('style', { key: 'insightcss' }, INSIGHTS_CSS),
        h('section', { className: 'md-tile md-i-hero', key: 'hero' }, [h('div', { className: 'md-hero-copy', key: 'c' }, [
          h('h1', { className: 'md-i-line', key: 't' }, ['你的研究，', h('b', { key: 'b' }, '正在成形'), '。']),
          h('p', { className: 'md-muted', key: 'p' }, '科灵把你记下的灵感、资料与文献，汇总成一眼能看懂的进展判断，下一步做什么，它替你想好。'),
          h('div', { className: 'md-hero-actions', key: 'a' }, [
            h('button', { type: 'button', className: 'md-pill is-primary', key: 'add', disabled: busy !== '', onClick: () => { setView('discover'); setRdDocTab('all'); setIdeaCapTab('doc'); setIdeaCapOpen(true) } }, [I({ name: 'upload', size: 14, key: 'i' }), '添加资料']),
            h('button', { type: 'button', className: 'md-pill', key: 'ask', disabled: busy !== '', onClick: () => send('给我几个可做的选题') }, [I({ name: 'pen', size: 14, key: 'i' }), '推选题']),
            h('input', { key: 'importfile', ref: importInputRef, type: 'file', accept: '.md,.bib,.json', style: { display: 'none' }, onChange: e => { doImport(e.target.files && e.target.files[0]); e.target.value = '' } }),
          ]),
        ]), h('dl', { className: 'md-metrics', key: 'm' }, insightMetrics.map(metric))]),
        trend, platforms, top, advice,
        ]),
        h('div', { className: 'md-section-label md-insights-toolshead', key: 'extratitle' }, ['研究过程分析', h('span', { className: 'md-grow', key: 'sp' }), h('button', { type: 'button', className: 'md-pill is-small', key: 'export', disabled: busy !== '', onClick: () => setExportOpen(true) }, [I({ name: 'upload', size: 13, key: 'i' }), '导出复盘']), h('button', { type: 'button', className: 'md-pill is-small', key: 'import', disabled: busy !== '', onClick: () => importInputRef.current && importInputRef.current.click() }, [I({ name: 'save', size: 13, key: 'i' }), '导入文献'])]),
        h('div', { className: 'md-insights-extra', key: 'extra' }, [ funnel, growthTile, pace, util ]),
      ]) : h('div', { className: 'md-board-page', key: 'insights' }, h('section', { className: 'md-tile md-i-hero is-empty', key: 'empty' }, [
        h('div', { className: 'md-hero-copy', key: 'c' }, [h('h1', { className: 'md-i-line', key: 't' }, '复盘，从第一份资料开始。'), h('p', { className: 'md-muted', key: 'p' }, '记下灵感、添加资料或检索文献后，这里会汇总文献年份分布、来源分布、高影响文献与研究建议。'), h('div', { className: 'md-hero-actions', key: 'a' }, h('button', { type: 'button', className: 'md-pill is-primary', key: 'add', onClick: () => { setView('discover'); setRdDocTab('all'); setIdeaCapTab('doc'); setIdeaCapOpen(true) } }, '添加资料'))]),
      ]))
      const LAB_CSS = [
        '.md-lab-embed{display:block;position:relative;width:100%;padding-top:2px;container-type:inline-size}',
        '.md-lab{display:flex;flex-direction:column;gap:12px;min-height:100%}',
        '.md-lab-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:12px;align-items:start}',
        '@container (max-width:900px){.md-lab-grid{grid-template-columns:minmax(0,1fr)}}',
        '.md-lab-form{display:flex;flex-direction:column;gap:9px;padding:14px 16px 16px}',
        '.md-lab-form label{display:flex;flex-direction:column;gap:4px;color:var(--ink2);font-size:12px;line-height:16px}',
        '.md-lab-form input,.md-lab-form textarea,.md-lab-form select{width:100%;padding:7px 9px;border:.5px solid var(--line-strong);border-radius:var(--r-sm);background:var(--bg);color:var(--ink);font-size:12.5px;line-height:19px;outline:0;resize:vertical}',
        '.md-lab-form textarea code{min-height:130px;font-family:ui-monospace,monospace;font-size:12px;line-height:18px}',
        '.md-lab-form .md-lab-hint{color:var(--ink3);font-size:11px;line-height:16px}',
        '.md-lab-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
        '.md-lab-list{display:flex;flex-direction:column;gap:7px;max-height:560px;overflow-y:auto;padding:2px}',
        '.md-lab-run{display:block;width:100%;padding:10px 12px;border-radius:var(--r-md);background:var(--card);text-align:left;transition:background .15s}',
        '.md-lab-run:hover{background:var(--hover)}',
        '.md-lab-run.is-on{box-shadow:inset 0 0 0 1px var(--accent)}',
        '.md-lab-run b{display:block;font-size:13px;line-height:19px;font-weight:500}',
        '.md-lab-run .md-lab-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:3px;color:var(--ink3);font-size:11px;line-height:15px}',
        '.md-lab-status{display:inline-block;padding:0 7px;border-radius:999px;background:var(--hover);color:var(--ink2);font-size:10.5px;line-height:17px}',
        '.md-lab-status.s-done{background:color-mix(in srgb,#2fa36c 18%,transparent);color:#2fa36c}',
        '.md-lab-status.s-failed{background:color-mix(in srgb,#d13c35 16%,transparent);color:#d13c35}',
        '.md-lab-status.s-running{background:color-mix(in srgb,#4176e6 16%,transparent);color:#4176e6}',
        '.md-lab-console{max-height:260px;overflow:auto;padding:10px 12px;border-radius:var(--r-md);background:color-mix(in srgb,var(--ink) 4%,var(--bg));font-family:ui-monospace,monospace;font-size:11.5px;line-height:17px;white-space:pre-wrap;overflow-wrap:anywhere}',
        '.md-lab-console .is-phase{color:var(--accent)}',
        '.md-lab-console .is-err{color:#d13c35}',
'.md-lab-console .is-reason{color:var(--ink4);font-style:italic;opacity:.78}',
        '.md-lab-console .is-tool{color:#4176e6}',
        '.md-lab-detail{display:flex;flex-direction:column;gap:9px;padding:14px 16px}',
        '.md-lab-metrics{display:flex;flex-wrap:wrap;gap:6px}',
        '.md-lab-metrics span{padding:2px 8px;border-radius:999px;background:var(--hover);font-size:11.5px;line-height:19px}',
        ''
      ].join(String.fromCharCode(10))
      const COLLAB_CSS = [
        '.md-collab{display:grid;gap:14px}',
        '.md-collab-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}',
        '.md-collab-hero h1{margin:0;font-size:23px;font-weight:650}',
        '.md-collab-hero p{margin:6px 0 0;font-size:13px}',
        '.md-collab-guide{padding:12px 14px;border-radius:var(--r-md);background:var(--primary-soft,var(--hover));font-size:13px;line-height:1.6}',
        '.md-collab-guide ol{margin:8px 0 0;padding-left:20px}',
        '.md-collab-guide button{margin-left:6px}',
        '.md-collab-taskboard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}',
        '.md-collab-node{padding:12px 14px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);min-width:0}',
        '.md-collab-node b{display:block;font-size:12px;color:var(--ink3);margin-bottom:6px}',
        '.md-collab-node span{display:block;font-size:13px;line-height:1.5;word-break:break-word}',
        '.md-collab-node .md-collab-hint{font-size:11px;color:var(--ink4);margin-top:5px}',
        '.md-collab-grid{display:grid;grid-template-columns:minmax(260px,1.05fr) minmax(280px,1fr);gap:14px}',
        '.md-collab-time{max-height:340px;overflow:auto;margin:0;padding:0 0 0 18px;list-style:none;border-left:2px solid var(--line)}',
        '.md-collab-time li{position:relative;padding:0 0 13px 6px;font-size:12px;line-height:1.55}',
        '.md-collab-time li::before{content:"";position:absolute;left:-24px;top:3px;width:8px;height:8px;border-radius:50%;background:var(--primary)}',
        '.md-collab-time .md-collab-step-hd{font-weight:600;color:var(--ink2)}',
        '.md-collab-time .md-collab-step-meta{color:var(--ink4);margin-left:6px}',
        '.md-collab-time .md-collab-refs{color:var(--ink4);font-size:11px;margin-top:2px;word-break:break-all}',
        '.md-collab-tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}',
        '.md-collab-tools input,.md-collab-tools select{min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg);color:var(--ink)}',
        '.md-collab-tools input{flex:1}',
        '.md-collab-list{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:7px;max-height:230px;overflow:auto}',
        '.md-collab-list li{border:1px solid var(--line);border-radius:var(--r-sm);padding:8px 10px;font-size:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}',
        '.md-collab-list li.is-on{border-color:var(--primary);background:var(--primary-soft,var(--hover))}',
        '.md-collab-list .md-collab-item-main{flex:1;min-width:120px;cursor:pointer}',
        '.md-collab-list .md-collab-item-meta{color:var(--ink4);font-size:11px;display:block;margin-top:2px}',
        '.md-collab-empty{padding:32px 18px;text-align:center;color:var(--ink3);font-size:13px;line-height:1.7}',
        '.md-collab-compare{font-size:11px;color:var(--ink3);margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}',
        '.md-collab-compare span{padding:3px 7px;border:1px solid var(--line);border-radius:var(--r-sm)}',
        '.md-collab-decisions{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}',
        '.md-collab-decisions li{border:1px solid var(--line);border-radius:var(--r-sm);padding:10px;font-size:12px;line-height:1.5}',
        '.md-collab-decisions .md-collab-acts{display:flex;gap:6px;margin-top:7px}',
        '.md-collab-hi{color:var(--primary);font-weight:600}',
        '.md-collab-boundary{font-size:11px;color:var(--ink4);line-height:1.6;margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}',
                '.md-collab-term{position:relative;border-bottom:1px dotted var(--ink4);cursor:help}',
        '.md-collab-node .md-collab-term,.md-collab-hint .md-collab-term{display:inline}',
'.md-collab-term:focus{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-xs)}',
        '.md-collab-term:focus::after{content:attr(data-tip);position:absolute;left:0;bottom:calc(100% + 6px);z-index:20;min-width:180px;max-width:280px;padding:8px 10px;border-radius:var(--r-sm);background:var(--card);color:var(--ink);border:1px solid var(--line-strong);box-shadow:var(--dsw-elevation-soft);font-size:12px;line-height:18px;white-space:normal}',
        '.md-collab-body{padding:0 16px 16px}',
        '.md-collab .md-desk-tasks{padding:0 16px 16px}',
        '.md-collab-gear-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}',
        '.md-collab-gear-label{display:inline-flex;align-items:center;font-size:12px;color:var(--ink2)}',
        '.md-collab-goal{width:100%;min-height:72px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--bg);color:var(--ink);font-size:13px;line-height:20px;resize:vertical}',
        '.md-collab-guide{background:var(--card);border:1px solid var(--line)}',
        '.md-guide-steps{margin:10px 0 12px;padding-left:20px;display:grid;gap:8px;font-size:13px;line-height:20px}',
        '.md-collab-boundary p{margin-top:6px}',
        '.md-collab-advanced summary{cursor:pointer;padding:8px 0;color:var(--ink2);font-size:13px}',
        '@media(max-width:860px){.md-collab-taskboard,.md-collab-grid{grid-template-columns:1fr}.md-collab-gear-row{flex-wrap:wrap}}',
        ''
      ].join(String.fromCharCode(10))
      const labStatusCn = s => ({ planned: '待运行', running: '运行中', done: '完成', failed: '失败', rejected: '已否决' }[s] || s || '待运行')
      const labStatusCls = s => 'md-lab-status' + (s === 'done' ? ' s-done' : s === 'failed' ? ' s-failed' : s === 'running' ? ' s-running' : '')
      const RISK_GATE_TEXT = '装包、改工作区、对外发包等高风险动作，须在决策区拍板后才能继续。'
      const riskText = function () { return RISK_GATE_TEXT }
      // 四条能力边界（charter.md:51-54）逐字白话上屏；实验台与虚空同一块文案，复用 .md-collab-boundary。
      const CAPABILITY_BOUNDARY_WORDS = '这里的边界你要知道：三档权限开关只管科灵调用工具，管不到实验里跑的子程序，实验代码以解释器完整权限运行；"离线"只拦代理层的外网 HTTP(S) 请求，不等于机器断网，别当成硬保证；当前没有静态代码扫描，代码只查了长度和空值，就以解释器完整权限执行，只交给可信代码；实验代码目前只受 runner.enabled 总开关和路径白名单约束，三档权限管不到它，沙箱与确认闸门还在实现中，不能说已经约束住了——装包和工作区改动在虚空带队路径要在决策区拍板，自己从实验台点跑则不经那两道拍板。'
      const capabilityBoundary = function (key) {
        return h('div', { className: 'md-collab-boundary', key: key || 'b' }, [
          h('p', { key: 'p1', style: { margin: '0' } }, riskText()),
          h('p', { key: 'p2' }, CAPABILITY_BOUNDARY_WORDS),
        ])
      }
      const labView = h('div', { className: 'md-lab-embed', key: 'lab' }, [
        h('style', { key: 'labcss' }, LAB_CSS),
        h('div', { className: 'md-lab', key: 'wrap' }, [
          h('div', { className: 'md-lab-grid', key: 'grid' }, [
            h('section', { className: 'md-tile md-lab-form', key: 'form' }, [
              h('label', { key: 't' }, ['实验名称', h('input', { key: 'i', value: labDraft.title, placeholder: '例如：热传导方程收敛性验证', onChange: e => setLabDraft(d => Object.assign({}, d, { title: e.target.value })) })]),
              h('div', { className: 'md-lab-row', key: 'rt' }, [
                h('label', { key: 'r', style: { flex: 1 } }, ['运行环境', h('select', { key: 's', value: labDraft.runtime, onChange: e => setLabDraft(d => Object.assign({}, d, { runtime: e.target.value })) }, [h('option', { key: 'py', value: 'python' }, 'Python'), h('option', { key: 'js', value: 'node' }, 'Node.js')])]),
                h('label', { key: 'h', style: { flex: 1 } }, ['关联假说（可选）', h('input', { key: 'i', value: labDraft.hypothesisId, placeholder: '假说 ID', onChange: e => setLabDraft(d => Object.assign({}, d, { hypothesisId: e.target.value })) })])
              ]),
              h('label', { key: 'code' }, ['验证代码', h('textarea', { key: 'i', className: 'md-lab-code', value: labDraft.code, spellCheck: false, placeholder: 'print(\"result = \", 3.14)', onChange: e => setLabDraft(d => Object.assign({}, d, { code: e.target.value })) })]),
              h('label', { key: 'pkg' }, ['依赖包（逗号分隔，可选）', h('input', { key: 'i', value: labDraft.packages, placeholder: 'numpy, scipy', onChange: e => setLabDraft(d => Object.assign({}, d, { packages: e.target.value })) }), h('span', { key: 'hint', className: 'md-lab-hint' }, '装包会联网；执行时离线只拦代理层的外网 HTTP(S) 请求，不等于机器断网。')]),
              capabilityBoundary('boundary'),
              h('details', { key: 'crit' }, [
                h('summary', { key: 'sum', style: { cursor: 'pointer', color: 'var(--ink2)', fontSize: '12px' } }, '可选：判据与指标提取'),
                h('label', { key: 'c' }, ['判据 JSON', h('textarea', { key: 'i', value: labDraft.criteria, spellCheck: false, placeholder: '[{\"id\":\"a\",\"metric\":\"loss\",\"op\":\"lte\",\"threshold\":0.1,\"required\":true}]', onChange: e => setLabDraft(d => Object.assign({}, d, { criteria: e.target.value })) }), h('span', { key: 'hint', className: 'md-lab-hint' }, '算子：eq/neq/gt/gte/lt/lte/in/converged/monotonic/stable')]),
                h('label', { key: 'ex' }, ['指标提取器 JSON（分析时用）', h('textarea', { key: 'i', value: labExtract, spellCheck: false, placeholder: '[{\"name\":\"loss\",\"regex\":\"loss\\\\s*=\\\\s*([0-9.]+)\",\"type\":\"float\"}]', onChange: e => setLabExtract(e.target.value) })])
              ]),
              h('div', { className: 'md-lab-row', key: 'acts' }, [
                h('button', { type: 'button', key: 'run', className: 'md-btn is-primary', disabled: labRunning || !labDraft.code.trim(), onClick: runLab }, [I({ name: labRunning ? 'refresh' : 'play', size: 14, key: 'i' }), labRunning ? '运行中…' : '运行实验']),
                h('span', { key: 'track', className: 'md-lab-hint' }, '这一轨是你自己主动执行：点一下就等于授权，只受 runner.enabled 总开关管，不经合作决策区拍板。'),
                labRunning ? h('button', { type: 'button', key: 'stop', className: 'md-btn is-danger', onClick: () => labAbortRef.current && labAbortRef.current.abort() }, '停止') : null
              ]),
              labLines.length ? h('div', { className: 'md-lab-console', key: 'console' }, labLines.map((ln, i) => h('div', { key: 'l' + i, className: ln.k === 'phase' ? 'is-phase' : (ln.k === 'error' ? 'is-err' : (ln.k === 'reason' ? 'is-reason' : (ln.k === 'tool' ? 'is-tool' : ''))) }, (ln.k === 'phase' ? '› ' : (ln.k === 'reason' ? '思考· ' : (ln.k === 'tool' ? '工具· ' : ''))) + ln.t))) : null
            ]),
            (() => {
              const runs = library.experiments || []
              const detail = labOpen ? runs.find(r => r.id === labOpen) : null
              return h('section', { className: 'md-tile md-lab-detail', key: 'runs' }, [
                h('div', { className: 'md-section-label', key: 'hd' }, '实验记录（' + runs.length + '）'),
                runs.length ? h('div', { className: 'md-lab-list', key: 'list' }, runs.map(r => h('button', { type: 'button', key: r.id, className: 'md-lab-run' + (labOpen === r.id ? ' is-on' : ''), onClick: () => setLabOpen(labOpen === r.id ? null : r.id) }, [
                  h('b', { key: 't' }, r.title || '未命名实验'),
                  h('div', { className: 'md-lab-meta', key: 'm' }, [
                    h('span', { key: 's', className: labStatusCls(r.status) }, labStatusCn(r.status)),
                    h('span', { key: 'r' }, r.runtime || 'python'),
                    r.durationMs != null ? h('span', { key: 'd' }, Math.round(r.durationMs) + 'ms') : null,
                    r.cacheHit ? h('span', { key: 'c' }, '缓存复用') : null,
                    h('span', { key: 'id' }, (r.id || '').slice(0, 12))
                  ])
                ]))) : h('p', { key: 'empty', className: 'md-muted' }, '还没有实验记录。左边写一段代码，点「运行实验」开始第一次验证。'),
                detail ? h('div', { key: 'detail' }, [
                  h('div', { className: 'md-lab-row', key: 'acts' }, [
                    h('button', { type: 'button', key: 'an', className: 'md-btn is-small', onClick: () => analyzeLab(detail.id) }, [I({ name: 'target', size: 13, key: 'i' }), '分析指标']),
                    h('button', { type: 'button', key: 'ok', className: 'md-btn is-small', onClick: () => iterateLab(detail.id, 'supported') }, '判为支持'),
                    h('button', { type: 'button', key: 'no', className: 'md-btn is-small', onClick: () => iterateLab(detail.id, 'rejected') }, '判为否定'),
                    h('button', { type: 'button', key: 'hold', className: 'md-btn is-small', onClick: () => iterateLab(detail.id, 'held') }, '不确定')
                  ]),
                  (detail.metrics && Object.keys(detail.metrics).length) ? h('div', { className: 'md-lab-metrics', key: 'met' }, Object.keys(detail.metrics).map(k => h('span', { key: k }, k + ' = ' + String(detail.metrics[k]))) ) : null,
                  (detail.criteria || []).length ? h('div', { key: 'crit' }, (detail.criteria || []).map((c, i) => h('div', { key: 'c' + i, className: 'md-lab-hint' }, (c.id || ('#' + i)) + '：' + (c.verdict || '') + (c.ok ? ' ✓' : ' ✗'))) ) : null,
                  detail.stdout ? h('div', { className: 'md-lab-console', key: 'out' }, detail.stdout) : null,
                  detail.stderr ? h('div', { className: 'md-lab-console is-err', key: 'err' }, detail.stderr) : null,
                  detail.reason ? h('p', { key: 'reason', className: 'md-muted' }, detail.reason) : null
                ]) : null
              ])
            })()
          ])
        ])
      ])
      const COLLAB_ROLES = [['lead', '带队'], ['methodologist', '方法'], ['engineer', '工程'], ['analyst', '分析']]
      const COLLAB_AUTONOMY = [['L0', '人下指令'], ['L1', '先问人'], ['L2', '关键事问人'], ['L3', '只看结果']]
      const cols = Array.isArray(library.collaborations) ? library.collaborations : []
      const collabStatusCn = s => ({ active: '进行中', 'waiting-human': '等人拍板', done: '已完成', abandoned: '已放弃' }[s] || s || '进行中')
      const collabRefs = refs => Array.isArray(refs) ? refs.filter(Boolean).map(function(r) { return typeof r === 'string' ? r : (r && (r.id || runIdSafe(r))) }).filter(Boolean) : []
      const runIdSafe = x => x && (x.runId || x.id) ? String(x.runId || x.id) : String(x || '')
      const collabStageOf = c => {
        const steps = Array.isArray(c && c.steps) ? c.steps : []
        const last = steps.length ? steps[steps.length - 1] : null
        return last && last.phase ? String(last.phase) : (c && c.status === 'waiting-human' ? '等待决策' : '待启动')
      }
      const collabNeedDecisionText = c => {
        if (!c) return '虚空里还没有记录'
        if (Array.isArray(c.decisions) && c.decisions.some(function(d) { return d && d.pending === true })) return '需要你拍板'
        if (c.status === 'waiting-human') return '等待你确认'
        return '当前无需决策'
      }
      const collabTerm = (label, tip) => h('span', { className: 'md-collab-term', title: tip, tabIndex: 0, 'aria-label': label + '：' + tip, 'data-tip': tip, key: label }, label)
      const collabGoalText = c => String((c && c.goal && c.goal.text) || (c && c.title) || '').trim()
      const collabPublishedText = c => {
        const s = String(collabGoalText(c))
        return s.length > 72 ? s.slice(0, 72) + '…' : s
      }
      const collabEvaluationText = e => {
        if (!e) return ''
        const verdict = e.verdict ? '判据：' + String(e.verdict) + '。' : ''
        const conclusion = e.conclusion ? String(e.conclusion) : ''
        return (verdict + conclusion).slice(0, 80)
      }
      const collabFiltered = (cols || []).filter(function(c) {
        const q = collabQuery.trim()
        const hay = [collabGoalText(c), c && c.title, collabEvaluationText(c && c.evaluation)].join(' ').toLowerCase()
        if (q && hay.indexOf(q.toLowerCase()) < 0) return false
        if (collabFilter === 'all') return true
        if (collabFilter === 'hypothesis') return !!(c && c.evaluation && c.evaluation.hypothesisId)
        if (collabFilter === 'pending') return !!(Array.isArray(c.decisions) && c.decisions.some(function(d) { return d && d.pending === true }))
        if (collabFilter.indexOf('role:') === 0) return (c && c.kelinRole || 'lead') === collabFilter.slice(5)
        if (collabFilter.indexOf('auto:') === 0) return (c && c.autonomy || 'L1') === collabFilter.slice(5)
        return (c && c.status || 'active') === collabFilter
      })
      const selectedCollab = (cols || []).find(function(c) { return String(c && c.id) === String(selectedCollabId) }) || cols[0] || null
      const goalForCreate = collabGoal.trim()
      const EMPTY_COLLAB = '这里记录科灵在虚空里带队的每一次虚拟实验：看目标、看过程、看结果，需要时你拍板。'
      const taskboard = h('section', { className: 'md-tile', key: 'taskboard' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '任务台'), h('span', { className: 'md-tile-meta', key: 'm' }, '目标 / 当前阶段 / 是否需要你拍板')]),
        h('div', { className: 'md-collab-body', key: 'body' }, h('div', { className: 'md-collab-taskboard', key: 'nodes' }, [
          h('div', { className: 'md-collab-node', 'data-testid': 'collab-goal', key: 'goal' }, [
            h('b', { key: 'l' }, '目标'),
            h('span', { key: 'v' }, selectedCollab ? collabPublishedText(selectedCollab) : (goalForCreate || EMPTY_COLLAB)),
            h('span', { className: 'md-collab-hint', key: 's' }, selectedCollab ? ('来源：' + (selectedCollab.goal && selectedCollab.goal.source === 'kelin' ? '科灵提议' : '人提出')) : '向下写目标，科灵可据此提议')
          ]),
          h('div', { className: 'md-collab-node', 'data-testid': 'collab-stage', key: 'stage' }, [
            h('b', { key: 'l' }, '当前阶段'),
            h('span', { key: 'v' }, selectedCollab ? collabStageOf(selectedCollab) : '待启动'),
            h('span', { className: 'md-collab-hint', key: 's' }, selectedCollab ? ([collabStatusCn(selectedCollab.status), ' · ', collabTerm('角色', '科灵这次以什么身份带队，可切换'), ' ', (COLLAB_ROLES.find(function(r) { return r[0] === selectedCollab.kelinRole }) || ['lead', '带队'])[1], ' · ', collabTerm('自主度', '科灵自己拿主意的档位，L0人下指令，L1先问人，L2关键事问人，L3只看结果'), ' ', String(selectedCollab.autonomy || 'L1')]) : '由科灵按步骤推进')
          ]),
          h('div', { className: 'md-collab-node', 'data-testid': 'collab-needs-decision', key: 'need' }, [
            h('b', { key: 'l' }, '是否需要你拍板'),
            h('span', { className: (selectedCollab && collabNeedDecisionText(selectedCollab) === '需要你拍板') ? 'md-collab-hi' : '', key: 'v' }, collabNeedDecisionText(selectedCollab)),
            h('span', { className: 'md-collab-hint', key: 's' }, selectedCollab ? ('最近决策点：' + (function() { const ds = Array.isArray(selectedCollab.decisions) ? selectedCollab.decisions.filter(Boolean) : []; return ds.length ? short(humanDecisionText(ds[ds.length - 1].point), 40) : '暂无' })()) : '装包、发包等风险动作会先问你')
          ]),
        ])),
      ])
      const timeline = h('section', { className: 'md-tile', 'data-testid': 'collab-timeline', key: 'timeline' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '过程时间线'), h('span', { className: 'md-tile-meta', key: 'm' }, '按科灵执行顺序')]),
        h('div', { className: 'md-collab-body', key: 'body' }, selectedCollab && Array.isArray(selectedCollab.steps) && selectedCollab.steps.length ? h('ul', { className: 'md-collab-time', key: 't' }, selectedCollab.steps.map(function(st, i) {
          return h('li', { key: (st && st.id) || i }, [
            h('span', { className: 'md-collab-step-hd', key: 'p' }, st && st.phase ? String(st.phase) : '步骤'),
            h('span', { className: 'md-collab-step-meta', key: 'a' }, st && st.actor === 'human' ? '人' : '科灵'),
            st && st.decision ? h('div', { key: 'd' }, String(st.decision)) : null,
            st && st.reason ? h('div', { className: 'md-collab-step-meta', key: 'r' }, '理由：' + String(st.reason)) : null,
            collabRefs(st && st.refs).length ? h('div', { className: 'md-collab-refs', key: 'f' }, [collabTerm('血缘', '这条结果来自虚空里的哪条记录、哪次实验，按引用串起来'), '：' + collabRefs(st.refs).join('、')]) : null,
          ])
        })) : h('div', { className: 'md-collab-empty', key: 'e' }, EMPTY_COLLAB),
        h('div', { className: 'md-collab-tools', key: 'tools' }, [
          h('button', { key: 'plan', type: 'button', disabled: !selectedCollab || !!collabBusy, onClick: function() { if (selectedCollab) runCollabAction('collab_plan', selectedCollab.id) } }, '让科灵出方案'),
          h('button', { key: 'step', type: 'button', disabled: !selectedCollab || !!collabBusy, onClick: function() { if (selectedCollab) askDecision(selectedCollab.id, '是否按科灵的方案继续下一步？') } }, '请科灵提议下一步'),
          h('button', { key: 'run', type: 'button', disabled: !selectedCollab || !!collabBusy, onClick: function() { if (!labDraft.code.trim()) { setToast({ text: '先在实验台写一段验证代码，再点跑实验。', error: true }); return } if (selectedCollab) runCollabAction('collab_run', selectedCollab.id, { title: collabGoalText(selectedCollab), code: labDraft.code, runtime: labDraft.runtime || 'python' }) } }, '在虚空里跑实验'),
          h('span', { key: 'track', className: 'md-collab-step-meta' }, '这一轨是科灵代替你执行：装包和工作区改动都要你在决策区拍板，跑完计入合作证据链。')
        ]))
      ])
      const collabExperimentRows = [];
      (cols || []).forEach(function(c) {
        const ids = Array.isArray(c.experimentIds) ? c.experimentIds : []
        ids.forEach(function(rid) { collabExperimentRows.push({ rid: String(rid), c: c }) })
      })
      const experimentRows = cols.length && collabFiltered.length ? collabExperimentRows.filter(function(row) { return collabFiltered.indexOf(row.c) >= 0 }) : []
      const compared = (Array.isArray(collabCompare) ? collabCompare : []).map(function(id) { return cols.find(function(c) { return String(c && c.id) === String(id) }) }).filter(Boolean)
      const compareText = compared.map(function(c) { return collabGoalText(c).slice(0, 18) + ' · ' + collabStatusCn(c.status) + (c.evaluation && c.evaluation.verdict ? ' · 判据' + String(c.evaluation.verdict) : '') }).join(' ｜ ')
      const overview = h('section', { className: 'md-tile', 'data-testid': 'collab-overview', key: 'overview' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '实验总览'), h('span', { className: 'md-tile-meta', key: 'm' }, '虚空里的全部实验'), h('span', { className: 'md-grow', key: 'sp' })]),
        h('div', { className: 'md-collab-body', key: 'body' }, [h('div', { className: 'md-collab-tools', key: 'tools' }, [
          h('input', { key: 'q', value: collabQuery, placeholder: '搜目标或结论', 'aria-label': '搜虚空里的实验', onChange: e => setCollabQuery(e.target.value) }),
          h('select', { key: 'f', value: collabFilter, 'aria-label': '筛选虚空记录', onChange: e => setCollabFilter(e.target.value) }, [
            h('option', { key: 'all', value: 'all' }, '全部'),
            h('option', { key: 'active', value: 'active' }, '进行中'),
            h('option', { key: 'waiting', value: 'waiting-human' }, '等人拍板'),
            h('option', { key: 'done', value: 'done' }, '已完成'),
            h('option', { key: 'role', value: 'role:lead' }, '科灵带队'),
            h('option', { key: 'auto', value: 'auto:L2' }, 'L2 关键事问人'),
            h('option', { key: 'hyp', value: 'hypothesis' }, '有判据'),
            h('option', { key: 'pending', value: 'pending' }, '有待决')
          ])
        ]),
        !cols.length ? h('div', { className: 'md-collab-empty', key: 'e' }, EMPTY_COLLAB) : !experimentRows.length ? h('div', { className: 'md-collab-empty', key: 'e2' }, '没有符合条件的实验，换个关键词试试。') : h('ul', { className: 'md-collab-list', key: 'l' }, experimentRows.map(function(row, i) {
          const exp = (library.experiments || []).find(function(e) { return String(e && (e.runId || e.id)) === row.rid })
          const meta = [collabGoalText(row.c).slice(0, 32), exp && exp.status ? labStatusCn(exp.status) : '', collabEvaluationText(row.c.evaluation)].filter(Boolean).join(' · ')
          const on = collabCompare.indexOf(row.c.id) >= 0
          return h('li', { key: row.rid + '-' + i, className: on ? 'is-on' : '' }, [
            h('span', { className: 'md-collab-item-main', key: 'm', role: 'button', tabIndex: 0, onClick: function() { openCollabFromRun(row.rid) }, onKeyDown: function(e) { if (e.key === 'Enter') openCollabFromRun(row.rid) } }, [
              '实验 ' + short(row.rid, 14),
              h('span', { className: 'md-collab-item-meta', key: 'mt' }, meta)
            ]),
            h('button', { key: 'eval', type: 'button', onClick: function() { runCollabAction('collab_evaluate', row.c.id, { runId: row.rid, conclusion: collabEvaluationText(row.c.evaluation) || '由科灵根据实验输出评估' }) } }, '让科灵评估'),
            h('button', { key: 'flow', type: 'button', disabled: !!collabBusy, title: '把评估结论推回内容工作流，生成草稿', onClick: function() { flowBackToDraft(row.c, row.rid) } }, '回流成草稿'),
            h('button', { key: 'cmp', type: 'button', onClick: function() { setCollabCompare(function(arr) { return on ? arr.filter(function(x) { return String(x) !== String(row.c.id) }) : arr.concat([row.c.id]) }) } }, on ? '取消对比' : '对比')
          ])
        })),
        compareText ? h('div', { className: 'md-collab-compare', key: 'cmp' }, h('span', { key: 'c' }, '对比：' + compareText)) : null
        ])
      ])
      const pendingDecisions = (selectedCollab && Array.isArray(selectedCollab.decisions) ? selectedCollab.decisions : []).filter(function(d) { return d && d.pending === true })
      const decisionZone = h('section', { className: 'md-tile', 'data-testid': 'collab-decisions', key: 'decisions' }, [
        h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '决策区'), h('span', { className: 'md-tile-meta', key: 'm' }, '装包、发包等风险动作先拍板')]),
        h('div', { className: 'md-collab-body', key: 'body' }, [
        h('div', { className: 'md-collab-gear-row', key: 'gears' }, [
          h('span', { className: 'md-collab-gear-label', key: 'rl' }, [collabTerm('角色', '科灵这次以什么身份带队，可切换'), '：']),
          h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '带队角色', key: 'roles' }, COLLAB_ROLES.map(function(r) { return h('button', { key: r[0], type: 'button', role: 'radio', 'aria-checked': collabRole === r[0], className: collabRole === r[0] ? 'is-on' : '', disabled: !selectedCollab || !!collabBusy, onClick: function() { switchCollabRole(r[0]) } }, r[1]) })),
          h('span', { className: 'md-collab-gear-label', key: 'al' }, [collabTerm('自主度', '科灵自己拿主意的档位，L0人下指令，L1先问人，L2关键事问人，L3只看结果'), '：']),
          h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '自主度', key: 'autos' }, COLLAB_AUTONOMY.map(function(a) { return h('button', { key: a[0], type: 'button', role: 'radio', 'aria-checked': collabAutonomy === a[0], className: collabAutonomy === a[0] ? 'is-on' : '', disabled: !selectedCollab || !!collabBusy, onClick: function() { switchCollabAutonomy(a[0]) } }, a[0] + ' ' + a[1]) })),
        ]),
        pendingDecisions.length ? h('ul', { className: 'md-collab-decisions', key: 'dl' }, pendingDecisions.map(function(d) {
          return h('li', { key: d.id }, [
            h('div', { key: 'p' }, '待拍板：' + humanDecisionText(d.point)),
            d.choice ? h('div', { className: 'md-collab-step-meta', key: 'c' }, '科灵建议：' + String(d.choice)) : null,
            h('div', { className: 'md-collab-acts', key: 'a' }, [
              h('button', { key: 'yes', type: 'button', disabled: !!collabBusy, onClick: function() { const pend = pendingIllustrationRef.current; if (pend && String(pend.decisionId) === String(d.id) && selectedCollab) approveIllustration(selectedCollab.id, d.id, pend.prompt); else if (selectedCollab) answerDecision(selectedCollab.id, d.id, 'approve') } }, '同意'),
              h('button', { key: 'no', type: 'button', disabled: !!collabBusy, onClick: function() { if (selectedCollab) answerDecision(selectedCollab.id, d.id, 'reject') } }, '否决')
            ])
          ])
        })) : h('div', { className: 'md-collab-empty', key: 'e' }, selectedCollab ? '当前没有待拍板的决策。' : EMPTY_COLLAB),
        h('div', { className: 'md-collab-tools', key: 'ask' }, [
          h('button', { key: 'ask', type: 'button', disabled: !selectedCollab || !!collabBusy, onClick: function() { if (selectedCollab) askDecision(selectedCollab.id, '是否继续当前实验方向？') } }, '新增决策点')
        ]),
        capabilityBoundary('b'),
        h('p', { key: 'p3' }, [collabTerm('判据', '判断实验是否通过的硬条件，由服务端算好'), '只读，科灵按它判断实验是否达标。'])
        ])
      ])
      const pendingAll = (cols || []).reduce(function(n, c) { return n + ((c && Array.isArray(c.decisions)) ? c.decisions.filter(function(d) { return d && d.pending === true }).length : 0) }, 0)
      const collabMetrics = [
        { label: '虚空记录', value: num(cols.length), unit: '条' },
        { label: '虚拟实验', value: num((library.experiments || []).length), unit: '次' },
        { label: '待你拍板', value: num(pendingAll), unit: '项' },
        { label: '迭代轮次', value: num((library.experiments || []).filter(function(e) { return e && e.parentRunId }).length), unit: '轮' },
      ]
      const collabView = h('div', { className: 'md-page', key: 'collab-space', 'data-zone': 'collab' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '虚空'), h('p', { className: 'md-page-sub', key: 's' }, '科灵在这里带队做虚拟实验：你只管定目标、在关键处拍板，过程与结果都为你沉淀。')]),
        h('style', { key: 'deskcss' }, SMARTDESK_CSS),
        h('style', { key: 'css' }, COLLAB_CSS),
        h('div', { className: 'md-collab', key: 'wrap' }, [
          h('section', { className: 'md-tile md-i-hero', key: 'hero' }, [
            h('div', { className: 'md-hero-copy', key: 'c' }, [
              h('h1', { className: 'md-i-line', key: 't' }, ['让想法，', h('b', { key: 'b' }, '在虚空里验证'), '。']),
              h('p', { className: 'md-muted', key: 'p' }, '科灵自主立目标、组队、调工具把虚拟实验跑完；你只在关键处拍板。目标、过程、结果都沉淀在这里。'),
              h('div', { className: 'md-hero-actions', key: 'a' }, [
                h('button', { type: 'button', className: 'md-pill is-primary', key: 'lead', disabled: !goalForCreate || !!collabBusy, onClick: function() { collabLead(collabGoal) } }, '让科灵带队验证'),
                h('button', { type: 'button', className: 'md-pill', key: 'refresh', disabled: !!collabBusy, onClick: collabList }, '刷新虚空'),
              ]),
              h('p', { className: 'md-muted', key: 'tip' }, '先到下方「给科灵一个目标」写下目标，这里就能带队验证。'),
            ]),
            h('dl', { className: 'md-metrics', key: 'm' }, collabMetrics.map(metric)),
          ]),
          !collabGuideDone ? h('section', { className: 'md-tile md-collab-guide', key: 'guide' }, [
            h('header', { className: 'md-tile-head', key: 'h' }, h('h2', { key: 't' }, '第一次来？三步上手')),
            h('ol', { className: 'md-guide-steps', key: 'ol' }, [
              h('li', { key: '1' }, cols.length ? '先看虚空里的一条示例：点实验总览里的实验。' : '先给科灵一个目标，科灵会在虚空里建第一条记录。'),
              h('li', { key: '2' }, ['在决策区看懂', collabTerm('角色', '科灵这次以什么身份带队，可切换'), '和', collabTerm('自主度', '科灵自己拿主意的档位，L0人下指令，L1先问人，L2关键事问人，L3只看结果'), '，随时切换。']),
              h('li', { key: '3' }, '写下目标，让科灵提议方案；要拍板时到决策区同意或否决。')
            ]),
            h('button', { type: 'button', className: 'md-pill is-small', key: 'done', onClick: function() { try { localStorage.setItem('rd.collabGuideDone', '1') } catch (e) {} setCollabGuideDone(true) } }, '知道了')
          ]) : null,
          taskboard,
          h('section', { className: 'md-tile', key: 'composer' }, [
            h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '给科灵一个目标'), h('span', { className: 'md-tile-meta', key: 'm' }, '写下目标，科灵自主带队推进')]),
            h('form', { className: 'md-desk-taskform', key: 'tf', onSubmit: e => { e.preventDefault(); if (!goalForCreate || !!collabBusy) return; collabLead(collabGoal) } }, [
              h('span', { className: 'md-desk-task-spark', key: 'ic' }, I({ name: 'spark', size: 18 })),
              h('input', { key: 'in', value: collabGoal, onChange: e => setCollabGoal(e.target.value), placeholder: '例如：验证选题卡里的缺口是否成立', 'aria-label': '虚空目标' }),
              h('button', { type: 'submit', className: 'md-send', key: 'go', 'aria-label': '让科灵带队', disabled: !!collabBusy || !goalForCreate }, I({ name: 'send', size: 15 })),
            ]),
            h('div', { className: 'md-desk-tasks', key: 'quick' }, [
              ['lead', 'target', '让科灵带队验证', '自主立目标、组队、调工具跑完', function() { collabLead(collabGoal) }],
              ['continue', 'refresh', '接着带队推进', '沿现有虚空记录继续', function() { if (selectedCollab) collabLead(collabGoalText(selectedCollab), selectedCollab.id) }],
            ].map(t => h('button', { type: 'button', className: 'md-desk-task', key: t[0], disabled: !!collabBusy, onClick: t[4] }, [
              h('span', { className: 'md-desk-task-ic', key: 'i' }, I({ name: t[1], size: 15 })),
              h('strong', { key: 't' }, t[2]),
              h('small', { key: 's' }, t[3]),
            ]))),
          ]),
          h('div', { className: 'md-collab-grid', key: 'grid' }, [timeline, overview]),
          decisionZone,
          collabLeadLines.length ? h('section', { className: 'md-tile', key: 'leadconsole' }, [
            h('header', { className: 'md-tile-head', key: 'h' }, h('h2', { key: 't' }, '科灵带队过程')),
            h('div', { className: 'md-collab-body', key: 'c' }, h('div', { className: 'md-lab-console', key: 'l' }, collabLeadLines.map(function (ln, i) { return h('div', { key: 'l' + i, className: ln.k === 'phase' ? 'is-phase' : (ln.k === 'reason' ? 'is-reason' : (ln.k === 'tool' ? 'is-tool' : '')) }, (ln.k === 'reason' ? '思考· ' : (ln.k === 'tool' ? '工具· ' : '')) + String(ln.t)) })))
          ]) : null,
          h('details', { key: 'advanced', className: 'md-collab-advanced' }, [
            h('summary', { key: 's' }, '自己写代码跑一次（一般直接用上面的科灵带队）'),
            labView
          ])
        ])
      ])
      const TOPIC_STAGES = [['draft', '待验证'], ['testing', '验证中'], ['supported', '已支持'], ['rejected', '已否决'], ['held', '暂缓']]
      const topicStage = x => ['draft', 'testing', 'supported', 'rejected', 'held'].indexOf(x.status) >= 0 ? x.status : 'draft'
      const topicStatusCn = s => (TOPIC_STAGES.find(c => c[0] === s) || [])[1] || '待验证'
      const allHyps = library.hypotheses || []
      const tq = topicQuery.trim().toLowerCase()
      const shownTopics = tq ? allHyps.filter(x => [x.title, x.gap, x.experiment, x.rationale].some(v => String(v || '').toLowerCase().includes(tq))) : allHyps
      const topicCounts = TOPIC_STAGES.map(st => shownTopics.filter(x => topicStage(x) === st[0]).length)
      const topicBoard = h('div', { className: 'md-board', key: 'tboard' }, TOPIC_STAGES.map(([sid, label]) => {
        const list = shownTopics.filter(x => topicStage(x) === sid)
        return h('section', { key: sid, className: 'md-board-col' + (topicOver === sid ? ' is-over' : ''), 'aria-label': label,
          onDragOver: e => { e.preventDefault(); setTopicOver(sid) },
          onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setTopicOver(null) },
          onDrop: e => { e.preventDefault(); setTopicOver(null); const id = e.dataTransfer && e.dataTransfer.getData('text/research-desk-topic'); if (id) call({ action: 'set_hypothesis_status', id, status: sid }).then(applyLibrary).catch(err => setToast({ text: String(err && err.message || err), error: true })) }
        }, [
          h('header', { key: 'h' }, [h('span', { className: 'md-dot status-' + sid, key: 'd' }), h('h3', { key: 't' }, label), h('span', { className: 'md-muted', key: 'n' }, list.length)]),
          h('div', { className: 'md-board-list', key: 'l' }, list.map(x =>
            h('div', { className: 'md-board-card', key: x.id || x.title, draggable: true, role: 'button', tabIndex: 0,
              onDragStart: e => { if (e.dataTransfer) { e.dataTransfer.setData('text/research-desk-topic', x.id); e.dataTransfer.effectAllowed = 'move' } },
              onClick: () => openStudio(x.id, x), onKeyDown: e => { if (e.key === 'Enter') openStudio(x.id, x) }
            }, [
              h('strong', { key: 't' }, short(x.title || '未命名选题', 70)),
              x.gap ? h('span', { className: 'md-board-meta', key: 'g' }, short('缺口：' + x.gap, 90)) : null,
              h('span', { className: 'md-board-meta', key: 'f' }, h('span', { key: 'go' }, '验证: ' + topicStatusCn(topicStage(x)) + ' · 去成稿 ↗')),
              h('button', { key: 'verify', type: 'button', className: 'md-collab-verify', title: '让科灵就这个选题缺口做虚拟实验验证', onClick: function(e) { e.stopPropagation(); openCollabWithGoal('验证选题：' + String(x.title || '') + (x.gap ? '，缺口：' + String(x.gap) : '')) } }, '让科灵验证')
            ])
          )),
        ])
      }))
      const TOPIC_COLS = [{ key: 'title', label: '选题', get: x => x.title || '' }, { key: 'status', label: '状态', get: x => TOPIC_STAGES.findIndex(c => c[0] === topicStage(x)) }, { key: 'gap', label: '研究缺口', get: x => x.gap || '' }, { key: 'at', label: '记录于', get: x => x.at || '' }]
      const sortedTopics = [...shownTopics].sort((a, b) => {
        const col = TOPIC_COLS.find(c => c.key === topicSort.key) || TOPIC_COLS[0]
        const av = col.get(a), bv = col.get(b)
        return (av > bv ? 1 : av < bv ? -1 : 0) * topicSort.dir
      })
      const topicTable = h('div', { className: 'md-table-wrap', key: 'ttbl' }, h('table', { className: 'md-table' }, [
        h('thead', { key: 'th' }, h('tr', null, TOPIC_COLS.map(c => h('th', { key: c.key, 'aria-sort': topicSort.key === c.key ? (topicSort.dir > 0 ? 'ascending' : 'descending') : 'none' },
          h('button', { type: 'button', onClick: () => setTopicSort(st => ({ key: c.key, dir: st.key === c.key ? -st.dir : 1 })) }, c.label, topicSort.key === c.key ? I({ name: topicSort.dir > 0 ? 'chevD' : 'send', size: 11 }) : null))))),
        h('tbody', { key: 'tb' }, sortedTopics.map(x => h('tr', { key: x.id || x.title, tabIndex: 0, onClick: () => openStudio(x.id, x), onKeyDown: e => { if (e.key === 'Enter') openStudio(x.id, x) } }, [
          h('td', { className: 'md-table-title', key: 't' }, [h('strong', { key: 's' }, x.title || '未命名选题'), h('small', { key: 'b' }, short(x.rationale || x.gap || '', 120))]),
          h('td', { key: 'st' }, h('span', { className: 'md-status status-' + topicStage(x) }, '验证: ' + topicStatusCn(topicStage(x)))),
          h('td', { key: 'g' }, short(x.gap || '—', 160)), h('td', { className: 'md-nowrap', key: 'at' }, (x.at || '').slice(0, 10) || '—'),
        ]))),
      ]))
      const topicMetrics = [
        { label: '选题总数', value: num(allHyps.length), unit: '条' },
        { label: '待验证', value: num(allHyps.filter(x => ['draft', 'testing'].indexOf(topicStage(x)) >= 0).length), unit: '条' },
        { label: '已支持', value: num(allHyps.filter(x => topicStage(x) === 'supported').length), unit: '条' },
        { label: '关联资料', value: num(rdDocs.length), unit: '份' },
      ]
      const topicsView = h('div', { className: 'md-page', key: 'topics' }, [
        h('section', { className: 'md-tile md-i-hero', key: 'hero', style: { marginBottom: 24 } }, [h('div', { className: 'md-hero-copy', key: 'c' }, [
          h('h1', { className: 'md-i-line', key: 't' }, ['让灵感，', h('b', { key: 'b' }, '长成选题'), '。']),
          h('p', { className: 'md-muted', key: 'p' }, '基于文献、资料与灵感，生成带研究缺口与实验建议的选题；成果沉淀在这里，并进入内容看板。'),
          h('div', { className: 'md-hero-actions', key: 'a' }, [
            h('button', { type: 'button', className: 'md-pill is-primary', key: 'push', disabled: busy !== '', onClick: pushTopics }, busy === 'topics' ? '推选中…' : '让科灵推选题'),
            h('button', { type: 'button', className: 'md-pill', key: 'toData', onClick: () => setView('discover') }, '去添加资料'),
          ]),
        ]), h('dl', { className: 'md-metrics', key: 'm' }, topicMetrics.map(metric))]),
        h('header', { className: 'md-page-head', key: 'ph' }, [
            h('div', { key: 'l' }, [h('h1', { key: 't' }, '选题假设'), h('p', { className: 'md-page-sub', key: 's' }, ['共 ' + allHyps.length + ' 条', topicCounts[0] + ' 个待启动', topicCounts[3] + ' 篇待发布', topicCounts[4] + ' 篇已发布'].join(' · '))]),
            h('span', { style: { flex: 1 }, key: 'sp' }),
            h('label', { className: 'md-search', key: 'search' }, [I({ name: 'search', size: 15, key: 'i' }), h('input', { key: 'in', value: topicQuery, onChange: e => setTopicQuery(e.target.value), placeholder: '搜索标题、缺口、实验', 'aria-label': '搜索选题' })]),
            h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '显示方式', key: 'seg' }, [
              h('button', { key: 'b', type: 'button', role: 'radio', 'aria-checked': topicMode === 'board', className: topicMode === 'board' ? 'is-on' : '', onClick: () => setTopicMode('board') }, [I({ name: 'wall', size: 15, key: 'i' }), h('span', { key: 'l' }, '看板')]),
              h('button', { key: 't', type: 'button', role: 'radio', 'aria-checked': topicMode === 'table', className: topicMode === 'table' ? 'is-on' : '', onClick: () => setTopicMode('table') }, [I({ name: 'list', size: 15, key: 'i' }), h('span', { key: 'l' }, '表格')]),
            ]),
        ]),
        shownTopics.length === 0
          ? h('div', { className: 'md-empty', key: 'e' }, [h('p', { className: 'md-empty-title', key: 't' }, tq ? '没有匹配的选题' : '还没有选题'), h('p', { key: 'h' }, tq ? '换个关键词试试。' : '点「让科灵推选题」，或先去「资料」添加原始资料。')])
          : topicMode === 'board' ? topicBoard : topicTable,
      ])
      // ===== 选题:验证 / 发布 双视角(合并原选题Tab与内容Tab) =====
      const researchLensSeg = h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '选题视角', key: 'rlseg' }, [
        h('button', { key: 'v', type: 'button', role: 'radio', 'aria-checked': researchLens === 'verify', className: researchLens === 'verify' ? 'is-on' : '', onClick: () => setResearchLens('verify') }, '验证视角'),
        h('button', { key: 'p', type: 'button', role: 'radio', 'aria-checked': researchLens === 'publish', className: researchLens === 'publish' ? 'is-on' : '', onClick: () => setResearchLens('publish') }, '发布视角'),
      ])
      const lensMode = researchLens === 'verify' ? topicMode : contentMode
      const lensQuery = researchLens === 'verify' ? topicQuery : contentQuery
      const researchView = h('div', { className: 'md-page', key: 'research' }, [
        h('header', { className: 'md-page-head', key: 'ph' }, [
          h('div', { key: 'l' }, [h('h1', { key: 't' }, '选题'), h('p', { className: 'md-page-sub', key: 's' }, researchLens === 'verify' ? ('验证视角 · 共 ' + allHyps.length + ' 条选题 · 看每条验证到哪一步') : ('发布视角 · 共 ' + contentItems.length + ' 条 · 看每条写到哪'))]),
          h('span', { style: { flex: 1 }, key: 'sp' }),
          h('label', { className: 'md-search', key: 'search' }, [I({ name: 'search', size: 15, key: 'i' }), h('input', { key: 'in', value: lensQuery, onChange: e => researchLens === 'verify' ? setTopicQuery(e.target.value) : setContentQuery(e.target.value), placeholder: researchLens === 'verify' ? '搜索选题标题、缺口、实验' : '搜索标题、标签、平台', 'aria-label': '搜索选题' })]),
          researchLensSeg,
          h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '显示方式', key: 'seg2' }, [
            h('button', { key: 'b', type: 'button', role: 'radio', 'aria-checked': lensMode === 'board', className: lensMode === 'board' ? 'is-on' : '', onClick: () => researchLens === 'verify' ? setTopicMode('board') : setContentMode('board') }, [I({ name: 'wall', size: 15, key: 'i' }), h('span', { key: 'l' }, '看板')]),
            h('button', { key: 't', type: 'button', role: 'radio', 'aria-checked': lensMode === 'table', className: lensMode === 'table' ? 'is-on' : '', onClick: () => researchLens === 'verify' ? setTopicMode('table') : setContentMode('table') }, [I({ name: 'list', size: 15, key: 'i' }), h('span', { key: 'l' }, '表格')]),
          ]),
        ]),
        h('section', { className: 'md-tile md-i-hero', key: 'hero' }, [h('div', { className: 'md-hero-copy', key: 'c' }, [
          h('h1', { className: 'md-i-line', key: 't' }, ['让灵感，', h('b', { key: 'b' }, '长成选题'), '。']),
          h('p', { className: 'md-muted', key: 'p' }, '科灵帮你看清每条选题验证到哪、写到哪，下一步由你定。'),
          h('div', { className: 'md-hero-actions', key: 'a' }, [
            h('button', { type: 'button', className: 'md-pill is-primary', key: 'lead', disabled: busy !== '', title: '让科灵带队推进当前选题', onClick: () => openCollabWithGoal('帮我把当前选题推进到下一步:先验证关键缺口，再给出成稿建议') }, busy ? '科灵处理中…' : '让科灵验证/推进这条选题'),
          ]),
        ]), h('dl', { className: 'md-metrics', key: 'm' }, topicMetrics.map(metric))]),
        h('p', { className: 'md-muted', key: 'hint', style: { margin: '0 0 16px' } }, '同一条选题：验证视角看验证结论，发布视角看写作进度，两边状态互不影响。'),
        researchLens === 'verify'
          ? (shownTopics.length === 0 ? h('div', { className: 'md-empty', key: 'ev' }, [h('p', { className: 'md-empty-title', key: 't' }, topicQuery.trim() ? '没有匹配的选题' : '还没有选题'), h('p', { key: 'h' }, '点上方「让科灵验证/推进这条选题」，或先去「资料」添加原始资料。')]) : topicMode === 'board' ? topicBoard : topicTable)
          : (shownContent.length === 0 ? h('div', { className: 'md-empty', key: 'ec' }, [h('p', { className: 'md-empty-title', key: 't' }, contentQuery.trim() ? '没有匹配的内容' : '还没有内容'), h('p', { key: 'h' }, '到灵感页记下第一条。')]) : contentMode === 'board' ? contentBoard : contentTable),
      ])
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
            : h('label', { className: 'md-field', key: 'txt' }, [h('span', null, captureTab === 'note' ? '从哪条笔记提炼？' : '粘贴一段你写的文字'), h('textarea', { rows: 5, value: captureText, onChange: e => setCaptureText(e.target.value), placeholder: '贴一段文字，科灵会按你的写法来写。' })]),
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
            h('button', { type: 'button', className: 'md-pill is-small', key: 'skill', disabled: busy !== '', onClick: () => setExportOpen(true) }, [I({ name: 'bolt', size: 13, key: 'i' }), '导出复盘']),
          ]),
          h('ul', { key: 'ul' }, rules.map(ruleItem).concat([(!rules.length) ? h('li', { className: 'md-muted md-rule-empty', key: 'e' }, '在对话里说「以后标题都不要超过 20 个字」，这里就会多一条。') : null])),
        ]),
      ]), captureDialog)

      const clearLibDialog = clearLibOpen ? h(Dialog, { key: 'clearlibdlg', title: '清空文献库', onClose: () => setClearLibOpen(false), width: 420 },
        h('div', { className: 'md-form', key: 'f' }, [
          h('p', { key: 'p', className: 'md-setup-lead' }, '确定清空文献库和全部笔记？这一步可以用「撤销」恢复。'),
          h('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 } }, [
            h('button', { key: 'cancel', type: 'button', className: 'md-btn', onClick: () => setClearLibOpen(false) }, '取消'),
            h('button', { key: 'ok', type: 'button', className: 'md-btn is-danger', onClick: doClearConfirm }, '确定清空'),
          ]),
        ])) : null
      const exportDialog = exportOpen ? h(Dialog, { key: 'exportdlg', title: '导出复盘', onClose: () => setExportOpen(false), width: 460 },
        h('div', { className: 'md-form', key: 'f' }, [
          h('p', { key: 'p', className: 'md-setup-lead' }, '选择要导出的格式，同一批研究数据会按所选格式各生成一份文件。'),
          h('div', { key: 'opts', style: { display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' } }, EXPORT_FORMATS.map(function (item) {
            const f = item[0]
            return h('label', { key: f, style: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' } }, [
              h('input', { type: 'checkbox', checked: exportFormats.indexOf(f) >= 0, onChange: () => toggleExportFormat(f) }),
              h('span', null, item[1] + ' · ' + item[2]),
            ])
          })),
          h('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 } }, [
            h('button', { key: 'cancel', type: 'button', className: 'md-btn', onClick: () => setExportOpen(false) }, '取消'),
            h('button', { key: 'ok', type: 'button', className: 'md-btn is-primary', disabled: !exportFormats.length, onClick: () => doExport(exportFormats) }, '导出 ' + exportFormats.length + ' 个文件'),
          ]),
        ])) : null
      const clearChatDialog = clearChatOpen ? h(Dialog, { key: 'clearchatdlg', title: '清空科灵对话', onClose: () => setClearChatOpen(false), width: 420 },
        h('div', { className: 'md-form', key: 'f' }, [
          h('p', { key: 'p', className: 'md-setup-lead' }, '确定清空当前科灵对话？文献、选题与画像不会受影响。这一步不可撤销。'),
          h('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 } }, [
            h('button', { key: 'cancel', type: 'button', className: 'md-btn', onClick: () => setClearChatOpen(false) }, '取消'),
            h('button', { key: 'ok', type: 'button', className: 'md-btn is-danger', onClick: doClearChat }, '确定清空'),
          ]),
        ])) : null
      const historyDialog = historyOpen ? h(Dialog, { key: 'histDlg', title: '历史节点', onClose: () => setHistoryOpen(false), width: 520 },
        h('div', { className: 'md-form', key: 'f' }, [
          h('p', { key: 'p', className: 'md-setup-lead' }, '每次改动都会留下一个可回溯的节点。点选一个即可回到那一刻的状态，之后的节点会作为新分支丢弃。'),
          historySteps.length ? h('ul', { key: 'ul', style: { listStyle: 'none', padding: 0, margin: '10px 0', maxHeight: 320, overflowY: 'auto' } }, historySteps.slice().reverse().map(s => h('li', { key: s.index }, h('button', { type: 'button', className: 'md-btn', style: { width: '100%', textAlign: 'left', marginBottom: 6 }, onClick: () => doRestore(s.index) }, [(s.at ? String(s.at).slice(0, 19).replace('T', ' ') + '  ' : '') + s.label])))) : h('p', { key: 'e', className: 'md-muted' }, '还没有历史节点。'),
          h('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', marginTop: 12 } }, h('button', { type: 'button', className: 'md-btn', onClick: () => setHistoryOpen(false) }, '关闭')),
        ])) : null
      const PROVIDER_ORDER = [
        ['deepseek官方', ['deepseek-official', 'deepseek']],
        ['WorkBuddy', ['workbuddy']],
        ['Qoder', ['qoder']],
        ['Trae', ['trae']],
        ['Loomy', ['loomy']],
        ['MiniMax', ['minimax']],
        ['Raccoon', ['raccoon']],
        ['ZCode', ['zcode']],
        ['Cline', ['cline']],
        ['智谱', ['zhipu', '智谱', 'bigmodel']],
        ['商汤', ['sensetime', '商汤']],
        ['讯飞', ['iflytek', '讯飞', 'spark']],
        ['Our Free Models', ['our-free-model', 'ourfreemodel', 'our free models']],
        ['FreeLLMAPI', ['freellmapi', 'freellm']],
      ]
      const providerMeta = id => {
        const s = String(id || '').toLowerCase()
        for (let i = 0; i < PROVIDER_ORDER.length; i++) {
          const en = PROVIDER_ORDER[i]
          if (en[1].some(function(a) { return s.indexOf(a) >= 0 })) {
            return { rank: i, label: i === 0 && s.indexOf('official') < 0 ? 'DeepSeek' : en[0] }
          }
        }
        return { rank: PROVIDER_ORDER.length, label: String(id || '模型') }
      }
      const modelGroups = (() => {
        const byId = new Map()
        for (const m of dedupModels) { const id = m.provider || '模型'; if (!byId.has(id)) byId.set(id, []); byId.get(id).push(m) }
        return Array.from(byId, function(en) { return Object.assign({ id: en[0] }, providerMeta(en[0]), { items: en[1] }) })
          .sort(function(a, b) { return a.rank - b.rank || a.id.localeCompare(b.id) })
      })()
      useEffect(() => {
        if (!settingsPanelOpen) return
        const onDown = e => { if (!e.target.closest || !e.target.closest('.md-settings-anchor')) setSettingsPanelOpen(false) }
        const onKey = e => { if (e.key === 'Escape') setSettingsPanelOpen(false) }
        document.addEventListener('pointerdown', onDown, true)
        window.addEventListener('keydown', onKey, true)
        return () => { document.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey, true) }
      }, [settingsPanelOpen])
      const closeSettings = () => { setSettingsPanelOpen(false); setSettingsDialogOpen(false) }
      const settingsBody = () => (
        settingsPage === 'root'
          ? h('div', { className: 'md-settings-body', key: 'root' }, [
              h('button', { type: 'button', key: 'assistant', className: 'md-settings-row', onClick: () => setSettingsPage('assistant') }, [
                h('span', { key: 'l' }, '模型与协作'), h('span', { key: 'v' }, '科灵角色 · 团队协作'), I({ name: 'chevR', size: 14 }),
              ]),
              h('button', { type: 'button', key: 'retrieval', className: 'md-settings-row', onClick: () => setSettingsPage('retrieval') }, [
                h('span', { key: 'l' }, '检索与综述'), h('span', { key: 'v' }, '数据源 · 问答 · 综述'), I({ name: 'chevR', size: 14 }),
              ]),
              h('button', { type: 'button', key: 'experiment', className: 'md-settings-row', onClick: () => setSettingsPage('experiment') }, [
                h('span', { key: 'l' }, '实验与统计'), h('span', { key: 'v' }, '运行器 · 显著性'), I({ name: 'chevR', size: 14 }),
              ]),
              h('button', { type: 'button', key: 'data', className: 'md-settings-row', onClick: () => setSettingsPage('data') }, [
                h('span', { key: 'l' }, '数据与隐私'), h('span', { key: 'v' }, '摘要 · 目录 · 密钥'), I({ name: 'chevR', size: 14 }),
              ]),
              h('button', { type: 'button', key: 'ui', className: 'md-settings-row', onClick: () => setSettingsPage('ui') }, [
                h('span', { key: 'l' }, '界面偏好'), h('span', { key: 'v' }, '语言 · 背景 · 动画'), I({ name: 'chevR', size: 14 }),
              ]),
              h('button', { type: 'button', key: 'image', className: 'md-settings-row', onClick: () => setSettingsPage('image') }, [
                h('span', { key: 'l' }, '生图配置'), h('span', { key: 'v' }, '自带密钥 · HTTP 直连'), I({ name: 'chevR', size: 14 }),
              ]),
            ])
          : settingsPage === 'menu'
          ? h('div', { className: 'md-settings-body', key: 'menu' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: closeSettings }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '科灵设置')]),
              h('button', { type: 'button', key: 'model', className: 'md-settings-row', onClick: () => setSettingsPage('model') }, [
                h('span', { key: 'l' }, '模型'), h('span', { key: 'v' }, modelLabel), I({ name: 'chevR', size: 14 }),
              ]),
              h('button', { type: 'button', key: 'effort', className: 'md-settings-row', onClick: () => setSettingsPage('effort') }, [
                h('span', { key: 'l' }, '推理等级'), h('span', { key: 'v' }, (modelEffort || 'high')[0].toUpperCase() + (modelEffort || 'high').slice(1)), I({ name: 'chevR', size: 14 }),
              ]),
              h('button', { type: 'button', key: 'team', className: 'md-settings-row', onClick: () => { setView('lab'); closeSettings() } }, [
                h('span', { key: 'l' }, '智能体团队协作'), h('span', { key: 'v' }, '到虚空靶心·真实协作在这里'), I({ name: 'chevR', size: 14 }),
              ]),
            ])
          : settingsPage === 'model'
          ? h('div', { className: 'md-settings-body', key: 'model' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('menu') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '模型')]),
              h('div', { className: 'md-model-search', key: 'srch' }, [
                I({ name: 'search', size: 13 }),
                h('input', { key: 'i', type: 'text', value: modelQuery, placeholder: '搜索模型…', 'aria-label': '搜索模型',
                  onChange: e => setModelQuery(e.target.value),
                  onKeyDown: e => { if (e.key === 'Escape') closeSettings() } }),
              ]),
              h('div', { className: 'md-model-pop-scroll', key: 's' },
                !dedupModels.length ? h('p', { className: 'md-muted', key: 'none' },
                  modelsStatus === 'loading' ? '正在读取可用模型…'
                  : modelsStatus === 'error' ? ['模型列表没读出来。', h('button', { type: 'button', key: 'retry', className: 'md-model-retry', onClick: () => loadModels() }, '重新读取')]
                  : '没有可用的模型'
                ) : (() => {
                  const q = modelQuery.trim().toLowerCase()
                  const groups = modelGroups.map(g => Object.assign({}, g, { items: g.items.filter(m => !q || String((m.label || '') + ' ' + modelRouteOf(m)).toLowerCase().indexOf(q) >= 0) })).filter(g => g.items.length)
                  if (!groups.length) return h('p', { className: 'md-muted', key: 'none' }, '没有匹配的模型')
                  return [h('button', { type: 'button', key: 'follow', disabled: busy === 'model', className: 'md-model-opt' + (!model ? ' is-on' : ''), onClick: () => { setModelRoute(''); closeSettings() } }, [
                    h('span', { key: 't', className: 'md-model-opt-label' }, '跟随默认'), !model ? h('span', { key: 'c', className: 'md-model-opt-check' }, '✓') : null,
                  ])].concat(groups.map(g => h('div', { className: 'md-model-group', key: 'g' + g.id }, [
                    h('span', { key: 'n' }, g.label),
                    h('div', { className: 'md-model-opts', key: 'p' }, g.items.map(m => {
                      const route = modelRouteOf(m), on = model === route
                      return h('button', { type: 'button', key: m.model, disabled: busy === 'model', title: route,
                        className: 'md-model-opt' + (on ? ' is-on' : ''),
                        onClick: () => { setModelRoute(route); setModelQuery(''); closeSettings() } }, [
                        h('span', { key: 't', className: 'md-model-opt-label' }, m.label || route),
                        on ? h('span', { key: 'c', className: 'md-model-opt-check' }, '✓') : null,
                      ])
                    })),
                  ])))
                })()),
            ])
          : settingsPage === 'perm'
          ? h('div', { className: 'md-settings-body', key: 'perm' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('root') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '权限模式')]),
              ['read-only', 'workspace-write', 'danger-full-access'].map(v => h('button', { type: 'button', key: v, className: 'md-model-opt' + (permMode === v ? ' is-on' : ''), onClick: () => { setPerm(v); closeSettings() } }, [
                h('span', { key: 't', className: 'md-model-opt-label' }, PERM_LABELS[v]),
                permMode === v ? h('span', { key: 'c', className: 'md-model-opt-check' }, '✓') : null,
              ])),
              h('small', { key: 'tip', className: 'md-settings-tip' }, '默认只能查看。选更高档只是记下你的偏好，不会立刻提权：科灵每次调用工具仍要你在决策区点头，实际按只读运行；高风险动作（装包、发包等）仍需在决策区拍板。'),
            ])
          : settingsPage === 'image'
          ? h('div', { className: 'md-settings-body', key: 'image' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('root') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '生图配置')]),
              h('small', { key: 'tool-tip', className: 'md-settings-tip' }, imageToolTip),
              h('label', { key: 'preset-label', className: 'md-field' }, [h('span', { key: 'l' }, '生图服务商一键预填')]),
              h('div', { className: 'md-presets', key: 'presets' }, IMAGE_PRESETS.map(preset =>
                h('button', { key: preset.label, type: 'button', onClick: () => applyImagePreset(preset.patch) }, preset.label))),
              ...settingRows.filter(r => r.key.indexOf('image.') === 0).map(renderField),
              h('small', { key: 'tip', className: 'md-settings-tip' }, '填写环境变量名，不是密钥本身；密钥不写进科灵台、不随导出带走；生图按张计费。接口地址、模型或密钥环境变量名留空就不启用 HTTP 生图，配图仍走订阅生图工具；两条路都要人工拍板。'),
              h('button', { type: 'button', key: 'save', className: 'md-btn is-primary', disabled: busy !== '', onClick: saveSettings }, '保存生图设置'),
            ])
          : settingsPage === 'assistant'
          ? h('div', { className: 'md-settings-body', key: 'assistant' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('root') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '模型与协作')]),
              ...settingRows.filter(r => r.key === 'kelin.role').map(renderField),
              h('small', { key: 'tip', className: 'md-settings-tip' }, '模型选择在科灵栏的科灵胶囊里，点开即可切换模型、推理等级。'),
              h('button', { type: 'button', key: 'team', className: 'md-settings-row', onClick: () => { setView('lab'); closeSettings() } }, [
                h('span', { key: 'l' }, '智能体团队协作'), h('span', { key: 'v' }, '到虚空靶心·真实协作在这里'), I({ name: 'chevR', size: 14 }),
              ]),
              h('div', { className: 'md-form-foot', key: 'foot' }, [
                h('button', { className: 'md-btn is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
                h('button', { className: 'md-btn', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
              ]),
            ])
          : settingsPage === 'retrieval'
          ? h('div', { className: 'md-settings-body', key: 'retrieval' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('root') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '检索与综述')]),
              ...settingRows.filter(r => ['sources', 'maxResults', 'qa.', 'review.'].some(p => r.key === p || r.key.indexOf(p) === 0)).map(renderField),
              h('div', { className: 'md-form-foot', key: 'foot' }, [
                h('button', { className: 'md-btn is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
                h('button', { className: 'md-btn', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
              ]),
            ])
          : settingsPage === 'experiment'
          ? h('div', { className: 'md-settings-body', key: 'experiment' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('root') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '实验与统计')]),
              ...settingRows.filter(r => r.key.indexOf('runner.') === 0 || r.key.indexOf('stats.') === 0).map(renderField),
              h('small', { key: 'tip', className: 'md-settings-tip' }, '实验代码只受运行开关与路径白名单约束；沙箱与确认闸门还在实现中，暂不能视作已约束。'),
              h('div', { className: 'md-form-foot', key: 'foot' }, [
                h('button', { className: 'md-btn is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
                h('button', { className: 'md-btn', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
              ]),
            ])
          : settingsPage === 'data'
          ? h('div', { className: 'md-settings-body', key: 'data' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('root') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '数据与隐私')]),
              ...settingRows.filter(r => r.key.indexOf('privacy.') === 0 || r.key.indexOf('storage.') === 0 || r.key.indexOf('secrets.') === 0).map(renderField),
              h('small', { key: 'tip', className: 'md-settings-tip' }, '密钥只填环境变量名，密钥本身不写进科灵台、不随导出带走。'),
              h('div', { className: 'md-form-foot', key: 'foot' }, [
                h('button', { className: 'md-btn is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
                h('button', { className: 'md-btn', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
              ]),
            ])
          : settingsPage === 'ui'
          ? h('div', { className: 'md-settings-body', key: 'ui' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('root') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '界面偏好')]),
              h('div', { key: 'localeRow', className: 'md-field' }, [
                h('span', { key: 'l' }, '语言'),
                h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '语言', key: 'seg' }, [
                  h('button', { key: 'host', type: 'button', className: localeId === 'host' ? 'is-on' : '', onClick: () => setLocaleId('host') }, '跟随 DeepSeek Harness'),
                  h('button', { key: 'zh', type: 'button', className: localeId === 'zh' ? 'is-on' : '', onClick: () => setLocaleId('zh') }, '中文'),
                  h('button', { key: 'en', type: 'button', className: localeId === 'en' ? 'is-on' : '', onClick: () => setLocaleId('en') }, 'English'),
                ]),
                h('small', { key: 'h' }, '科灵的自我介绍与提示话术所用语言；「跟随 DeepSeek Harness」按宿主界面语言判断。'),
              ]),
              h('label', { key: 'bgRow', className: 'md-field' }, [
                h('span', { key: 'l' }, '灵感背景板'),
                h('select', { key: 'i', value: bgStyle, onChange: e => setBgStyle(e.target.value) }, BG_PRESETS.map(function (x) { return h('option', { key: x[0], value: x[0] }, x[1]) })),
                h('small', { key: 'h' }, '只影响灵感页的散落背景。「默认点阵」跟随主题配色，其余为不同点阵密度与柔和晕染。'),
              ]),
              h('div', { key: 'dockRow', style: { display: 'flex', flexDirection: 'column', gap: 5 } }, [
                h('label', { className: 'md-check' }, [h('input', { type: 'checkbox', checked: dockDefault, onChange: e => { const on = e.target.checked; setDockDefault(on); setDockOpen(on); try { localStorage.setItem('rd.dockDefault', on ? '1' : '0') } catch (err) {} } }), h('span', null, '默认显示科灵')]),
                h('small', { style: { color: 'var(--ink3)', fontSize: '11.5px', lineHeight: '16px' } }, '开启后每次打开工作台都会展开科灵栏；关闭则只保留顶栏「科灵」入口。默认关闭。'),
              ]),
              h('label', { key: 'animRow', className: 'md-field' }, [
                h('span', { key: 'l' }, '散落动画'),
                h('select', { key: 'i', value: scatterAnim, onChange: e => setScatterAnim(e.target.value) }, SCATTER_ANIMS.map(function(x){ return h('option', { key: x[0], value: x[0] }, x[1]) })),
                h('small', { key: 'h' }, '切回灵感散落视图时按所选方式入场；「关闭动画」不做位移，最省资源。跟随系统减弱动画偏好时始终不播放。'),
              ]),
              h('div', { className: 'md-form-foot', key: 'foot' }, [
                h('button', { className: 'md-btn is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
                h('button', { className: 'md-btn', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
              ]),
            ])
          : h('div', { className: 'md-settings-body', key: 'effort' }, [
              h('button', { type: 'button', key: 'back', className: 'md-settings-row md-settings-back', onClick: () => setSettingsPage('menu') }, [I({ name: 'chevL', size: 14 }), h('span', { key: 'l' }, '推理等级')]),
              ['low', 'mid', 'high'].map(v => h('button', { type: 'button', key: v, className: 'md-model-opt' + ((modelEffort || 'high') === v ? ' is-on' : ''), onClick: () => { setModelEffort(v); closeSettings() } }, [
                h('span', { key: 't', className: 'md-model-opt-label' }, v[0].toUpperCase() + v.slice(1)),
                (modelEffort || 'high') === v ? h('span', { key: 'c', className: 'md-model-opt-check' }, '✓') : null,
              ])),
              h('small', { key: 'tip', className: 'md-settings-tip' }, '推理等级越高，回答越审慎，耗时也更长。'),
            ])
      )
      const settingsPanel = (settingsPanelOpen && dockOpen) ? h('div', { className: 'md-settings-pop', key: 'setpop' }, settingsBody()) : null

      const ideaCapTabs = [['note', '笔记 / 金句'], ['doc', '文档'], ['link', '链接'], ['file', '图片/视频']]
      const saveIdeaCapture = () => {
        const v = ideaCapText.trim()
        if (ideaCapTab === 'link') { if (!v) return; addIdea(v, 'link') }
        else if (ideaCapTab === 'doc' || ideaCapTab === 'file') return
        else { if (!v) return; addIdea(v, 'note') }
        setIdeaCapOpen(false); setIdeaCapText('')
      }
      const DOC_EXT = { pdf: 'pdf', doc: 'doc', docx: 'docx', ppt: 'ppt', pptx: 'pptx', xls: 'xls', xlsx: 'xlsx', csv: 'csv', txt: 'txt', md: 'md', tex: 'tex', bib: 'bib', epub: 'epub' }
      const DOC_SKILL = { pdf: 'agentero-dsh-pdf', doc: 'docx2md', docx: 'docx2md', ppt: 'office', pptx: 'office', xls: 'office', xlsx: 'office', csv: 'office' }
      const ingestRdDocs = (files, markPending) => {
        const rows = []
        for (const f of [].slice.call(files || [])) {
          const ext = String(f.name || '').split('.').pop().toLowerCase()
          if (!DOC_EXT[ext]) { notify('暂不支持 .' + ext + '，可用 PDF / Word / PPT / Excel / txt / md。', true); continue }
          rows.push({ id: 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name: f.name, type: ext, size: f.size || 0, path: f.path || f.name, indexed: false, chunks: 0, addedAt: new Date().toISOString().slice(0, 10), ...(markPending ? { composerPending: true } : {}) })
        }
        if (!rows.length) return
        setRdDocs(prev => rows.concat(prev))
        notify('已登记 ' + rows.length + ' 份原始资料；解析交给平台插件，完成后可让科灵基于资料问答。')
        return rows
      }
      // 文档字节读成纯 base64（无 data: 前缀），与图片 readImageBase64 同构，随消息发给 host。
      const readFileBase64 = f => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const s = String(reader.result || '')
          const i = s.indexOf(',')
          resolve(i >= 0 ? s.slice(i + 1) : s)
        }
        reader.onerror = () => reject(reader.error || new Error('read failed'))
        reader.readAsDataURL(f)
      })
      // 粘贴/选择的文件按类型分流：图片→识图预览，文档→资料登记+字节暂存，都不支持的给一句克制提示。
      const intakeFiles = fileList => {
        const files = Array.from(fileList || [])
        if (!files.length) return
        const imageFiles = []
        const docFiles = []
        let unsupported = 0
        for (const f of files) {
          const mt = String(f.type || '').toLowerCase()
          if (IMAGE_MIME.indexOf(mt) >= 0) { imageFiles.push(f); continue }
          const ext = String(f.name || '').split('.').pop().toLowerCase()
          if (DOC_EXT[ext]) { docFiles.push(f); continue }
          unsupported++
        }
        if (imageFiles.length) pickImages(imageFiles)
        if (docFiles.length) {
          ingestRdDocs(docFiles, true)
          Promise.all(docFiles.map(async f => ({ id: 'pf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name: f.name, data: await readFileBase64(f) })))
            .then(added => { if (added.length) setPendingFiles(prev => added.concat(prev)) })
            .catch(err => notify('文件读取失败：' + (err && err.message || '未知错误'), true))
        }
        if (unsupported) notify('这类文件暂时放不进来，可用图片或 PDF / Word / PPT / Excel / txt / md。', true)
      }
      // 移除资料卡时同步清掉待发字节，保证「移除了就不发」。
      const removeRdDoc = id => {
        const doc = rdDocs.find(x => x.id === id)
        setRdDocs(prev => prev.filter(x => x.id !== id))
        if (doc) setPendingFiles(prev => prev.filter(x => x.name !== doc.name))
      }
      const indexRdDoc = async doc => {
        if (rdDocBusy) return
        setRdDocBusy(doc.id); notify(null)
        try {
          const d = await callWithRetry({ action: 'add', papers: [{ title: doc.name, source: 'raw-material:' + doc.type, tags: ['原始资料', doc.type], note: 'path=' + doc.path }] })
          applyLibrary(d)
          setRdDocs(prev => prev.map(x => x.id === doc.id ? Object.assign({}, x, { indexed: 'queued' }) : x))
          const skill = DOC_SKILL[doc.type] || 'office'
          setInput('用「' + skill + '」解析资料「' + doc.name + '」（路径：' + doc.path + '）的全文，加入研究库并 read 建索引，之后基于它回答我后续问题。')
          setDockOpen(true)
          notify('已登记并备好解析指令；科灵栏已打开，点发送即交给 DSH 平台技能处理。')
        } catch (err) { notify(String(err.message || err), true) }
        finally { setRdDocBusy('') }
      }
      const themeDialog = themeOpen ? h(Dialog, { key: 'themeDlg', title: '选择主题', onClose: () => setThemeOpen(false), width: 560 },
        h('div', { className: 'md-style-grid', key: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' } }, THEMES.map(function(t) {
          return h('button', { key: t.id, type: 'button', className: 'md-style-card' + (themeDraft === t.id ? ' is-active' : ''), onClick: () => setThemeDraft(t.id) }, [
            h('div', { key: 'sw', className: 'md-theme-swatches' }, t.sw.map(function(c, i) { return h('i', { key: i, style: { background: c } }) })),
            h('strong', { key: 'n' }, t.name),
            h('small', { key: 'd' }, t.desc),
            themeDraft === t.id ? h('span', { key: 'on', className: 'md-pill is-primary is-small' }, '已选') : null,
          ])
        })),
        h('div', { className: 'md-form-foot', key: 'foot' }, [h('span', { style: { flex: 1 }, key: 'sp' }), h('button', { type: 'button', className: 'md-btn', key: 'cancel', onClick: () => setThemeOpen(false) }, '取消'), h('button', { type: 'button', className: 'md-btn is-primary', key: 'save', onClick: () => { setThemeId(themeDraft); setThemeOpen(false); notify('主题已切换为「' + ((THEMES.find(function(t){return t.id === themeDraft}) || {}).name || '') + '」。') } }, '应用主题')])
      ) : null
      const settingsDialog = settingsDialogOpen ? h(Dialog, { key: 'setdlg', title: '设置', onClose: () => setSettingsDialogOpen(false), width: 560 }, settingsBody()) : null
      const ideaCaptureDialog = ideaCapOpen ? h(Dialog, { key: 'ideaCap', title: '记下一个灵感', onClose: () => setIdeaCapOpen(false), width: 480 },
        h('div', { className: 'md-capture-tabs', role: 'tablist', key: 'tabs' }, ideaCapTabs.map(([k, l]) =>
          h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': ideaCapTab === k, className: ideaCapTab === k ? 'is-on' : '', onClick: () => { setIdeaCapTab(k); setIdeaCapText('') } }, l))),
        h('form', { className: 'md-form', key: 'form', onSubmit: e => { e.preventDefault(); saveIdeaCapture() } }, [
          ideaCapTab === 'link'
            ? h('label', { className: 'md-field', key: 'f' }, [h('span', { key: 's' }, '链接'), h('input', { type: 'url', required: true, value: ideaCapText, onChange: e => setIdeaCapText(e.target.value), placeholder: 'https://' }), h('small', { key: 'sm' }, '会自动读取页面的标题、简介和封面。')])
            : ideaCapTab === 'file'
            ? h('button', { type: 'button', className: 'md-dropzone', key: 'f', onClick: () => { const inp = document.querySelector && document.querySelector('#rd-idea-file'); if (inp) inp.click() } }, [I({ name: 'upload', size: 22, key: 'i' }), h('span', { key: 't' }, '选择图片或视频'), h('small', { key: 'sm' }, '也可以直接把文件拖到灵感墙上'), h('input', { id: 'rd-idea-file', type: 'file', hidden: true, multiple: true, accept: 'image/*,video/*', onChange: e => { const files = [].slice.call(e.target.files || []); files.forEach(f => addIdea(f.name, 'image')); setIdeaCapOpen(false) } })])
            : ideaCapTab === 'doc' ? null
            : h('label', { className: 'md-field', key: 'f' }, [h('span', { key: 's' }, '想法'), h('textarea', { rows: 4, required: true, value: ideaCapText, onChange: e => setIdeaCapText(e.target.value), placeholder: '想到什么就写什么，之后再让科灵补全。' })]),
          ideaCapTab === 'doc'
            ? h('div', { className: 'md-field', key: 'f' }, [h('span', { key: 's' }, '科研文档'), h('button', { type: 'button', className: 'md-dropzone', key: 'z', onClick: () => { const inp = document.querySelector && document.querySelector('#rd-idea-file'); if (inp) inp.click() } }, [I({ name: 'upload', size: 22, key: 'i' }), h('span', { key: 't' }, '选择 PDF / Word / PPT / Excel / txt'), h('small', { key: 'sm' }, '解析交给平台插件（docx2md / PDF / office），这里只登记引用。'), h('input', { id: 'rd-idea-file', type: 'file', hidden: true, multiple: true, accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.tex,.bib,.epub', onChange: e => { intakeFiles(e.target.files); setIdeaCapOpen(false) } })]), h('small', { key: 'sm2' }, '登记后会出现在「资料」页，可交给平台解析并建索引。')])
            : ideaCapTab === 'file' ? null : h('div', { className: 'md-form-foot', key: 'foot' }, [h('span', { style: { flex: 1 }, key: 'sp' }), h('button', { type: 'button', className: 'md-btn', key: 'cancel', onClick: () => setIdeaCapOpen(false) }, '取消'), h('button', { type: 'submit', className: 'md-btn is-primary', key: 'save' }, '放到灵感墙')]),
        ])) : null

      const lastUserMsg = msgs.length ? [...msgs].reverse().find(m => m.role === 'me') : null
      const langZh = effectiveLang(localeId, hostLang) === 'zh'
      const suggestions = lastUserMsg && isIdentityChat(lastUserMsg.text)
        ? (langZh ? ['你能做什么', '帮我汇集最新资料', '给我几个可做的选题'] : ['What can you do', 'Gather the latest materials', 'Suggest research topics'])
        : (langZh ? ['梳理这个主题的综述', '找出还没解决的问题', '给我几个可做的选题'] : ['Write a review on this topic', 'Find unresolved questions', 'Suggest research topics'])
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
        h('div', { className: 'md-dock-resizer', key: 'rz', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': '拖拽调整科灵栏宽度', title: '拖拽调整宽度', onPointerDown: dockResizeDown }),
        h('div', { className: 'md-dock-head', 'data-window-drag': '', key: 'dh' }, [
          h('h2', { key: 't' }, '科灵'),
          F({ key: 'x', icon: 'close', label: '收起对话', onClick: () => setDockOpen(false) }),
        ]),
        h('div', { className: 'md-chatbar', key: 'cb' }, [
          F({ key: 'new', icon: 'plus', label: '新建对话', disabled: busy !== '', onClick: chatNewOp }),
          F({ key: 'find', icon: 'search', label: '找历史对话', disabled: busy !== '', onClick: () => {
            if (chatSearchOpen && String(chatSearchQuery || '').trim()) { runChatSearch(); return }
            setChatMenuOpen(false); setChatSearchOpen(v => !v)
          } }),
          h('button', { type: 'button', key: 'cur', className: 'md-chatbar-cur', title: '切换/管理对话', disabled: busy !== '', onClick: () => { setChatSearchOpen(false); setChatMenuOpen(v => !v) } }, [
            h('span', { key: 'ttl' }, (library.chats || []).find(function (c) { return c.id === library.activeChatId }) ? ((library.chats || []).find(function (c) { return c.id === library.activeChatId }).title || '新对话') : '新对话'),
            I({ name: 'chevD', size: 13 }),
          ]),
          chatMenuOpen ? h('div', { className: 'md-chatmenu md-chatlistmenu', key: 'menu' }, [
            (library.chats || []).map(function (c) {
              const active = c.id === library.activeChatId
              // L1 暂未落地时三字段缺省：优雅降级回旧「标题（N）」，不在前端现算摘要/标签。
              const summary = String(c.summary || '')
              const tags = Array.isArray(c.tags) ? c.tags : []
              const outcomes = Array.isArray(c.outcomes) ? c.outcomes : []
              const rich = !!(summary || tags.length || outcomes.length)
              const time = chatRelativeTime(c.updatedAt || c.createdAt)
              return h('div', { className: 'md-chatmenu-row' + (active ? ' is-on' : '') + (rich && renameChatId !== c.id ? ' is-card' : ''), key: c.id }, [
                renameChatId === c.id
                  ? h('input', { key: 'ri', autoFocus: true, value: renameChatText, 'aria-label': '对话新名字', onChange: e => setRenameChatText(e.target.value), onKeyDown: e => { if (e.key === 'Enter') submitRenameChat(); if (e.key === 'Escape') setRenameChatId('') } })
                  : rich
                    ? h('button', { type: 'button', key: 'sw', className: 'md-chatmenu-name md-chatcard', disabled: busy !== '', onClick: () => chatSwitchOp(c.id) }, [
                        h('div', { key: 't', className: 'md-chatcard-title' }, c.title || '新对话'),
                        summary ? h('div', { key: 's', className: 'md-chatcard-summary', title: summary }, summary) : null,
                        h('div', { key: 'm', className: 'md-chatcard-meta' }, [
                          outcomes.map(function (o, j) { return h('span', { key: 'o' + j, className: 'md-chatcard-pill ' + (OUTCOME_CLASS[String(o)] || 'oc-topic') }, String(o)) }),
                          tags.map(function (t, j) { return h('span', { key: 'g' + j, className: 'md-chatcard-tag' }, '#' + String(t)) }),
                          time ? h('span', { key: 'time', className: 'md-chatcard-time' }, time) : null,
                        ]),
                      ])
                    : h('button', { type: 'button', key: 'sw', className: 'md-chatmenu-name', disabled: busy !== '', onClick: () => chatSwitchOp(c.id) }, (c.title || '新对话') + '（' + (c.messageCount || 0) + '）'),
                F({ key: 'rn', icon: 'edit', label: '重命名', disabled: busy !== '', onClick: () => { setRenameChatId(c.id); setRenameChatText(c.title || '新对话') } }),
                F({ key: 'del', icon: 'trash', label: '删除对话', tone: 'danger', disabled: busy !== '' || (library.chats || []).length <= 1, onClick: () => chatDeleteOp(c.id) }),
              ])
            }),
            renameChatId ? h('button', { type: 'button', key: 'rsave', className: 'md-chatmenu-save', onClick: submitRenameChat }, '保存名字') : null,
          ]) : null,
          chatSearchOpen ? h('div', { className: 'md-chatsearch', key: 'chatsearch' }, [
            h('form', { className: 'md-chatsearch-form', key: 'form', onSubmit: e => { e.preventDefault(); runChatSearch() } }, [
              h('input', { key: 'q', 'aria-label': '搜索历史对话', value: chatSearchQuery, placeholder: '搜主题、摘要或沉淀物（回车搜索）', autoFocus: true,
                onChange: e => setChatSearchQuery(e.target.value),
                onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); runChatSearch() } } }),
            ]),
            h('div', { className: 'md-chatsearch-scope', key: 'scope' }, [
              h('span', { key: 'lbl', className: 'md-chatsearch-scope-label' }, '搜索范围'),
              h('button', { key: 'all', type: 'button', className: 'md-chatsearch-chip ' + (selectedSearchChats ? '' : 'is-on'), onClick: () => setSelectedSearchChats(null) }, '全部'),
              (library.chats || []).map(function (c) {
                const on = !!(selectedSearchChats && selectedSearchChats.has(String(c.id)))
                return h('button', { key: 'c' + c.id, type: 'button', title: String(c.title || '新对话'), className: 'md-chatsearch-chip ' + (on ? 'is-on' : ''), onClick: () => toggleSearchChat(c.id) }, String(c.title || '新对话'))
              }),
            ]),
            visibleChatSearchResults.length
              ? h('div', { className: 'md-chatsearch-list', key: 'list' }, visibleChatSearchResults.map(function (r, i) {
                  const out = Array.isArray(r && r.outcomes) ? r.outcomes : []
                  return h('button', { type: 'button', key: 'r' + i, className: 'md-chatsearch-row', disabled: busy !== '', onClick: () => openSearchHit(r) }, [
                    h('div', { key: 't', className: 'md-chatcard-title' }, String((r && r.title) || '未命名对话')),
                    r && r.summary ? h('div', { key: 's', className: 'md-chatcard-summary' }, String(r.summary)) : null,
                    out.length ? h('div', { key: 'o', className: 'md-chatcard-meta' }, out.map(function (o, j) { return h('span', { key: 'o' + j, className: 'md-chatcard-pill ' + (OUTCOME_CLASS[String(o)] || 'oc-topic') }, String(o)) })) : null,
                  ])
                }))
              : null,
          ]) : null,
        ]),
        h('div', { className: 'md-dock-scroll', 'aria-live': 'polite', key: 'ds', ref: dockRef }, [
          hitNav.total > 1 ? h('div', { className: 'md-hitnav', key: 'hitnav' }, [
            h('span', { key: 'l', className: 'md-hitnav-label' }, '命中 ' + hitNav.total + ' 处 · 第 ' + (hitNav.index + 1) + ' 处'),
            h('button', { key: 'p', type: 'button', onClick: () => setHitNav(function (n) { return { total: n.total, index: (n.index - 1 + n.total) % n.total } }) }, '上一处'),
            h('button', { key: 'n', type: 'button', onClick: () => setHitNav(function (n) { return { total: n.total, index: (n.index + 1) % n.total } }) }, '下一处'),
            h('button', { key: 'x', type: 'button', onClick: () => { setSearchHitTerm(''); setHitNav({ index: 0, total: 0 }) } }, '关闭'),
          ]) : null,
          msgs.length ? msgs.map((m, i) => h('div', { className: 'md-msg ' + (m.role === 'me' ? 'is-user' : 'is-bot'), 'data-rd-msg': '1', 'data-hit': (searchHitTerm && String(m.text || '').indexOf(searchHitTerm) !== -1 ? '1' : ''), key: 'm' + i }, m.role === 'me' ? m.text : h('div', { className: 'md-msg-ai', key: 'ai' }, [ m.reasoning ? h('details', { className: 'md-reason', key: 'reason' }, [h('summary', { key: 'sum' }, '思考过程'), h('div', { className: 'md-reason-body', key: 'body' }, String(m.reasoning))]) : null, m.toolTrace && m.toolTrace.length ? h('details', { className: 'md-tooltrace', key: 'tooltrace' }, [h('summary', { key: 'sum' }, '工具调用（' + m.toolTrace.length + '）'), h('div', { className: 'md-tooltrace-body', key: 'body' }, m.toolTrace.map(function (t, j) { return h('div', { key: 'tt' + j }, String(t)) }))]) : null, (function () { const parts = splitFences(m.text); return parts.map(function (p, j) { return p.kind === 'fence' ? h(GenuiFence, { key: 'f' + j, raw: p.text }) : h('div', { key: 't' + j }, renderRichText(p.text)) }) })(), h('footer', { key: 'foot' }, [ F({ key: 'copy', icon: 'copy', label: '复制这条回答', onClick: () => { const text = String(m.text || ''); const fallback = () => { try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select(); const ok = !!(document.execCommand && document.execCommand('copy')); document.body.removeChild(ta); notify(ok ? '已复制回答' : '复制失败，请手动选择文本', !ok) } catch (e) { notify('复制失败，请手动选择文本', true) } }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => notify('已复制回答')).catch(fallback); else fallback() } }), m.usageText ? h('div', { className: 'md-muted', key: 'usage', style: { fontSize: '12px' } }, String(m.usageText)) : null, m.at ? h('span', { className: 'md-msg-time', key: 'time' }, chatRelativeTime(m.at)) : null ]) ]))) : null,
          msgs.length ? null : h('div', { className: 'md-dock-intro', key: 'intro' }, [
            h('h3', { key: 'h' }, ['说一个研究问题，', h('br', { key: 'br' }), '剩下的我来补全。']),
            h('p', { key: 'p' }, '选题、检索、精读、写作标准和核验，都可以直接说。每一步都能撤销。'),
          ]),
          busy === 'assistant' ? h('span', { className: 'md-shimmer', key: 'busy' }, '正在处理……') : null,
          h('div', { className: 'md-suggest', key: 'sug' }, suggestions.slice(0, msgs.length ? 2 : 4).map(s =>
            h('button', { key: s, type: 'button', disabled: busy !== '', onClick: () => send(s) }, s))),
        ]),
        h('form', { className: 'md-composer md-composer-native', key: 'comp', onSubmit: e => { e.preventDefault(); send(input) } }, [
          // 附件条在输入框上方（对齐 DSH 原生：附件槽在编辑器 DOM 之前；.md-composer-native 的 align-items:stretch 让附件条与输入框/工具行同靠左，输出侧不回显图片/文件卡片）
          (images.length || rdDocs.some(x => x.composerPending))
            ? h('div', { className: 'md-vision-previews', key: 'previews' }, [
                ...images.map(img => h('div', { className: 'md-vision-thumb', key: img.id }, [
                  h('img', { src: img.previewUrl || ('data:' + img.mediaType + ';base64,' + img.data), alt: img.name || '待发送图片' }),
                  h('button', { type: 'button', className: 'md-vision-remove', title: '移除这张图', 'aria-label': '移除图片 ' + (img.name || ''), onClick: () => removeImage(img.id) }, I({ name: 'close', size: 11 }))
                ])),
                ...rdDocs.filter(x => x.composerPending).map(doc => h('div', { className: 'md-file-card', key: doc.id }, [
                  h('span', { className: 'md-file-badge', key: 'b' }, String(doc.type || 'file').toUpperCase().slice(0, 4)),
                  h('span', { className: 'md-file-name', key: 'n', title: doc.name }, String(doc.name || '资料')),
                  h('span', { className: 'md-file-size', key: 's' }, Math.max(1, Math.round(Number(doc.size || 0) / 1024)) + 'KB'),
                  h('button', { type: 'button', className: 'md-vision-remove', title: '移除这份资料', 'aria-label': '移除资料 ' + (doc.name || ''), onClick: () => removeRdDoc(doc.id) }, I({ name: 'close', size: 11 }))
                ])),
              ])
            : null,
          h('textarea', { key: 'ta', rows: 1, 'aria-label': '给科灵发消息', value: input, placeholder: '想改什么，直接说',
            onChange: e => setInput(e.target.value),
            onPaste: onComposerPaste,
            onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } } }),
          h('div', { className: 'md-composer-bar', key: 'bar' }, [
            h('div', { className: 'md-composer-tools', key: 'tools', style: { position: 'relative' } }, [
              // ＋号/权限置最左，对齐 DSH 原生会话。
              // +号命令目录：与顶栏「新建对话」的 F plus 以 key/label/class 区分；目录数据来自 status.commands。
              F({ key: 'cmdcatalog', icon: 'plus', size: 13, className: 'md-ctool md-cmdmenu-trigger', label: '命令目录', onClick: openCommandMenu }),
              // 权限设置入口：盾牌 indicator，复用 md-ctool 胶囊与盾牌图标（取自 DSH dsh-im ShieldIcon）；只展示「当前只读」，点击进权限页，不提权。
              h('button', { type: 'button', key: 'permind', className: 'md-ctool md-ctool-model', title: '权限设置：' + (PERM_LABELS[permMode] || '自定义') + ' · 当前只读（选更高档只是记下偏好，不会立刻提权；实际按只读运行）', 'aria-label': '当前权限：' + (PERM_LABELS[permMode] || '自定义') + ' · 当前只读，点开权限设置', onClick: () => { setSettingsPage('perm'); setSettingsPanelOpen(v => !v) } }, [I({ name: 'shield', size: 12 }), h('span', { key: 't' }, (PERM_LABELS[permMode] || '自定义') + ' · 当前只读')]),
              h('button', { type: 'button', key: 'vision', className: 'md-ctool md-ctool-vision' + (images.length ? ' is-on' : ''), title: images.length ? '让科灵看这张图，再问它' : '选图片给科灵看（识图需在科灵设置里选支持图片的模型）', 'aria-label': images.length ? '识图，已选 ' + images.length + ' 张' : '选择图片让科灵看', onClick: () => visionInputRef.current && visionInputRef.current.click() }, [I({ name: 'eye', size: 13 }), images.length ? '识图·' + images.length + '张' : '识图']),
              h('div', { className: 'md-settings-anchor', key: 'setwrap' }, [
                h('button', { type: 'button', key: 'model', className: 'md-ctool md-ctool-model md-settings-trigger', title: '科灵设置', onClick: () => { setSettingsPage('menu'); loadModels(); setSettingsPanelOpen(v => !v) } }, [I({ name: 'spark', size: 12 }), modelLabel, ' · ' + (modelEffort || 'high')]),
                settingsPanel,
              ]),
              h('button', { type: 'button', key: 'attach', className: 'md-ctool', title: '附加资料文件', onClick: () => fileInputRef.current && fileInputRef.current.click() }, I({ name: 'upload', size: 13 })),
              h('button', { type: 'button', key: 'askcollab', className: 'md-ctool', title: '交给科灵 · 到虚空验证（靶心）', disabled: !input.trim(), onClick: function() { openCollabWithGoal(input) } }, I({ name: 'target', size: 13 })),
              msgs.length ? h('button', { type: 'button', key: 'regen', className: 'md-ctool', title: '重新生成上一回答', disabled: busy !== '', onClick: regenLast }, I({ name: 'refresh', size: 13 })) : null,
              msgs.length ? h('button', { type: 'button', key: 'clear', className: 'md-ctool', title: '清空当前对话', disabled: busy !== '', onClick: clearChat }, I({ name: 'trash', size: 13 })) : null,
              cmdMenuOpen ? h('div', { className: 'md-chatmenu md-cmdmenu', key: 'cmdmenu', style: { left: '0', right: 'auto', width: '272px', top: 'auto', bottom: 'calc(100% + 4px)', maxHeight: 'min(320px, calc(100vh - 120px))' } }, [
                h('div', { className: 'md-chatmenu-row', key: 'hd' }, [
                  h('span', { className: 'md-chatmenu-name', key: 't' }, '命令目录：只读项直接执行；写操作只填提示，不直接执行')
                ]),
                cmdMenuBusy
                  ? h('div', { className: 'md-chatmenu-row', key: 'busy' }, h('span', { className: 'md-muted', key: 'b' }, '正在读取命令目录…'))
                  : !cmdCatalog.length
                    ? h('div', { className: 'md-chatmenu-row', key: 'empty' }, h('span', { className: 'md-muted', key: 'e' }, '暂无可用命令（status 未提供 commands）'))
                    : cmdCatalog.filter(function (c) { return c && c.action }).map(function (c, ci) {
                        return h('div', { className: 'md-chatmenu-row', key: 'c' + ci }, [
                          h('button', { type: 'button', key: 'b', className: 'md-chatmenu-name', title: String(c.description || c.action), onClick: function () { runCatalogAction(c) } }, [
                            h('span', { key: 'a' }, String(c.action)),
                            h('span', { key: 'd', className: 'md-muted' }, ' · ' + String(c.description || ''))
                          ])
                        ])
                      })
              ]) : null,
            ]),
            busy === 'assistant'
              ? h('button', { type: 'button', key: 'stop', className: 'md-send md-stop', 'aria-label': '停止生成', title: '停止生成', onClick: stopChat }, I({ name: 'close', size: 14 }))
              : h('button', { key: 'send', type: 'submit', className: 'md-send', 'aria-label': '发送', disabled: !input.trim() || busy !== '' }, I({ name: 'send', size: 15 })),
          ]),
          h('input', { key: 'file', ref: fileInputRef, type: 'file', multiple: true, accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.tex,.bib,.epub', style: { display: 'none' }, onChange: e => { intakeFiles(e.target.files); e.target.value = '' } }),
          h('input', { key: 'visionfile', ref: visionInputRef, type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,image/gif', style: { display: 'none' }, onChange: e => { pickImages(e.target.files); e.target.value = '' } }),
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
          '你已经连续记录 ', h('b', { key: 'c', className: 'md-hero-streak' }, String(streak)), ' 天。',
        ]),
        h('p', { key: 'nh', className: 'md-muted', style: { margin: '4px 0 8px', fontSize: '13px' } }, ['科灵建议的下一步：', nextHint]),
        h('button', { type: 'button', key: 'nhgo', className: 'md-pill is-small', style: { marginBottom: '8px' }, onClick: () => openResearch('verify') }, '让科灵把灵感长成选题'),
        h('form', { className: 'md-hero-input', key: 'f', onSubmit: e => { e.preventDefault(); addIdea(ideaInput); setIdeaInput('') } }, [
          I({ name: 'spark', size: 16, key: 'i' }),
          h('input', { key: 'in', value: ideaInput, onChange: e => setIdeaInput(e.target.value), placeholder: '记下一个灵感，或贴一个链接', 'aria-label': '记下灵感' }),
          h('button', { key: 'go', type: 'submit', className: 'md-send', 'aria-label': '记下灵感', disabled: !ideaInput.trim() }, I({ name: 'send', size: 15 })),
        ]),
        feedFilmstrip,
      ])
      const shownIdeas = ideas.filter(x => kindFilter === 'all' || (x.kind || 'note') === kindFilter)
      // Focus 铺排：R2 均匀采样 + 贪心最小间距（逐级放宽保证够数）均匀铺满舞台；hero 矩形避让不遮挡；按到 hero 的距离排序，重要卡贴近中心区
      const scatterSlots = (() => {
        const cx = Math.round(width / 2), cy = Math.round(stageH / 2)
        const padX = isNarrow ? 96 : 130, padY = isNarrow ? 64 : 102
        const heroHX = isNarrow ? 226 : 292, heroHY = isNarrow ? 148 : 222
        const n = Math.max(1, shownIdeas.length)
        const g = 1.324717957244746, a1 = 1 / g, a2 = 1 / (g * g)
        const inHero = (px, py) => Math.abs(px - cx) < heroHX && Math.abs(py - cy) < heroHY
        const pick = (minDx, minDy) => {
          const out = []
          for (let k = 1; k < 4000 && out.length < n; k++) {
            const u = (0.5 + a1 * k) % 1, v = (0.5 + a2 * k) % 1
            const px = Math.round(padX + u * (width - 2 * padX))
            const py = Math.round(padY + v * (stageH - 2 * padY))
            if (inHero(px, py)) continue
            if (out.some(c => Math.abs(c.px - px) < minDx && Math.abs(c.py - py) < minDy)) continue
            out.push({ px: px, py: py })
          }
          return out
        }
        let cand = pick(isNarrow ? 122 : 176, isNarrow ? 96 : 116)
        if (cand.length < n) cand = pick(isNarrow ? 110 : 148, isNarrow ? 86 : 98)
        if (cand.length < n) cand = pick(isNarrow ? 100 : 124, isNarrow ? 78 : 84)
        const edgeDist = p => { const dx = Math.max(0, Math.abs(p.px - cx) - heroHX), dy = Math.max(0, Math.abs(p.py - cy) - heroHY); return dx * dx + dy * dy }
        cand.sort((a, b) => edgeDist(a) - edgeDist(b))
        return cand.map((p, i) => ({ px: p.px, py: p.py, r: ((i * 29) % 17) - 8, d: isNarrow ? 0.82 : 1 }))
      })()
      // 注意力法则：重要性高的灵感靠近中心区域。评分=有正文/有封面/来源可靠度/较新，降序分配到由内向外的槽位。
      const KIND_W = { report: 3, paper: 3, table: 2, image: 2, note: 1, link: 1 }
      const importance = x => (KIND_W[x.kind] || 1) * 2 + (x.body ? 3 : 0) + (x.cover ? 2 : 0) + (x.source ? 1 : 0) + (x.at ? Math.max(0, 6 - Math.round((Date.now() - new Date(x.at).getTime()) / 86400000) / 7) : 0)
      const rank = new Map(shownIdeas.slice().sort((a, b) => importance(b) - importance(a)).map((x, i) => [x.id, i]))
      const ideaCard = (idea, i) => {
        const key = 'idea-' + idea.id
        const slotIndex = rank.has(idea.id) ? rank.get(idea.id) : i
        const pos = positions[key] || scatterSlots[slotIndex % Math.max(1, scatterSlots.length)] || { px: Math.round(width / 2), py: Math.round(stageH / 2), r: 0, d: 1 }
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
        const popEnter = el => {
          if (!el || enteredIdeasRef.current.has(idea.id)) return
          enteredIdeasRef.current.add(idea.id)
          if (scatterAnim === 'none') return
          if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
          const u = 0.25
          let frames, duration, easing, delay
          if (scatterAnim === 'fade') { frames = [{ opacity: 0 }, { opacity: 1 }]; duration = 520; easing = 'ease'; delay = Math.min(i * 24, 360) }
          else if (scatterAnim === 'rise') { frames = [{ transform: 'translateY(22px)', opacity: 0 }, { transform: 'none', opacity: 1 }]; duration = 620; easing = 'cubic-bezier(.22, 1, .36, 1)'; delay = Math.min(i * 28, 420) }
          else if (scatterAnim === 'zoom') { frames = [{ transform: 'scale(.86)', opacity: 0 }, { transform: 'none', opacity: 1 }]; duration = 560; easing = 'cubic-bezier(.2, .9, .3, 1)'; delay = Math.min(i * 26, 400) }
          else { frames = [{ transform: 'translate(' + (-pos.px * u) + 'px,' + (-pos.py * u) + 'px) scale(.8) rotate(' + (hashCode(idea.id) % 20 - 10) + 'deg)', opacity: 0 }, { transform: 'none', opacity: 1 }]; duration = ENTER_MS; easing = ENTER_EASE; delay = Math.min(i * 32, 620) }
          try { el.animate(frames, { duration, easing, delay, fill: 'backwards' }) } catch (e) {}
        }
        return h('div', { className: 'md-node', key, style }, [
          h('div', { className: 'md-pop', ref: popEnter }, [
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
            ...shownIdeas.map(ideaCard),
            h('div', { className: 'md-hero-anchor', key: 'ha', style: { left: Math.round(width / 2), top: Math.round(stageH / 2), background: 'radial-gradient(ellipse 60% 70% at 50% 50%, color-mix(in srgb, var(--bg) 80%, transparent) 34%, transparent 78%)', borderRadius: 24 } }, ideaHero),
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
          '你已经连续记录 ', h('b', { key: 'c', className: 'md-hero-streak' }, String(streak)), ' 天。',
        ]),
        h('p', { key: 'nh', className: 'md-muted', style: { margin: '4px 0 8px', fontSize: '13px' } }, ['科灵建议的下一步：', nextHint]),
        h('button', { type: 'button', key: 'nhgo', className: 'md-pill is-small', style: { marginBottom: '8px' }, onClick: () => openResearch('verify') }, '让科灵把灵感长成选题'),
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
      const shotLines = ['提出问题', '交代背景', '指出缺口', '给出方法', '呈现证据', '写清边界']
      const shotDescs = ['说清要解决的研究问题', '交代已有研究与现实背景', '点出现有做法的不足', '写清你的思路与方法', '摆出结果和支撑证据', '说明结论适用边界']
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
                h('div', { className: 'md-progress-step ' + (studioDraft ? 'is-done' : busy === 'studio' ? 'is-active' : ''), key: 'p2' }, [h('i', { key: 'i' }), studioDraft ? '初稿已生成' : (busy === 'studio' ? '科灵正在写……' : '科灵写成初稿')]),
                h('div', { className: 'md-progress-step ' + (studioDraft ? 'is-active' : ''), key: 'p3' }, [h('i', { key: 'i' }), '补充想法，继续打磨']),
              ]),
              busy === 'studio' ? h('span', { className: 'md-shimmer', key: 'busy' }, '科灵正在写，马上就好……') : null,
              h('div', { className: 'md-suggest', key: 'sg' }, ['先补一条反例证据', '核一下这句引用', '把边界写进结论', '把开场写成研究问题'].map(s =>
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
                h('p', { className: 'md-muted', key: 'desc' }, '从提纲、证据链到引用核验，科灵陪你一步步写完，过程和边界都摊开给你看。'),
                h('div', { className: 'md-hero-stats', key: 'st' }, [
                  h('span', { key: 'a' }, '体裁 · 研究快报/短文'),
                  h('span', { key: 'c' }, studioDraft ? '已成稿' : '待成稿'),
                  h('span', { key: 'd' }, '初稿 ' + studioDraft.length + ' 字'),
                ]),
                h('div', { className: 'md-hero-actions', key: 'ac' }, [
                  h('div', { className: 'md-seg', role: 'radiogroup', 'aria-label': '成稿体裁', key: 'fmt' }, [
                    h('button', { key: 's', type: 'button', role: 'radio', 'aria-checked': studioFormat === 'script', className: studioFormat === 'script' ? 'is-on' : '', onClick: () => setStudioFormat('script') }, '研究快报'),
                    h('button', { key: 'a', type: 'button', role: 'radio', 'aria-checked': studioFormat === 'article', className: studioFormat === 'article' ? 'is-on' : '', onClick: () => setStudioFormat('article') }, '短文'),
                  ]),
                  h('button', { key: 'go', type: 'button', className: 'md-pill is-primary', disabled: busy !== '', onClick: draftStudio }, busy === 'studio' ? '科灵正在写…' : '让科灵写成初稿'),
                  studioDraft ? h('button', { key: 'illustrate', type: 'button', className: 'md-pill', 'aria-label': '让科灵配一张图', disabled: busy !== '', title: '科灵借订阅生图为成稿配图，需你拍板后才会调用额度', onClick: requestIllustration }, busy === 'illustration' ? '科灵正在配图…' : '配一张图') : null,
                ]),
              ]),
            ]),
            h('section', { className: 'md-tile md-tile-article', key: 'art' }, [
              h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '初稿正文'), h('span', { className: 'md-tile-meta', key: 'm' }, studioDraft ? '可继续打磨；配图不替代证据核验' : '等科灵写成初稿')]),
              studioDraft
                ? h('div', { className: 'md-article-scroll', key: 'sc' }, [h('div', { className: 'md-article md-prose', key: 'a', style: { whiteSpace: 'pre-wrap' } }, studioDraft), studioIllustration && studioIllustration.data ? h('div', { className: 'md-vision-thumb', key: 'illus', title: '科灵配的图' }, h('img', { src: 'data:' + studioIllustration.mediaType + ';base64,' + studioIllustration.data, alt: '科灵为初稿配的图' })) : null])
                : h('div', { className: 'md-skeleton is-still', key: 'sk' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 }), h('i', { key: 4 }), h('i', { key: 5 }), h('i', { key: 6 })]),
            ]),
            h('section', { className: 'md-tile md-tile-shots', key: 'shots', style: { '--rows2': 3 } }, [
              h('header', { className: 'md-tile-head', key: 'h' }, [h('h2', { key: 't' }, '写作脉络'), h('span', { className: 'md-tile-meta', key: 'm' }, '6 个环节')]),
              h('div', { className: 'md-shots', key: 'g', style: { '--rows2': 3 } }, shotLines.map((line, i) =>
                h('figure', { className: 'md-shot', key: i }, [
                  h('div', { className: 'md-plate' }, h('span', { className: 'md-plate-mark' }, String(i + 1).padStart(2, '0'))),
                  h('figcaption', { key: 'c' }, [h('span', { className: 'md-shot-meta', key: 'm' }, h('b', null, String(i + 1).padStart(2, '0'))), h('p', { key: 'p' }, line), h('p', { className: 'md-muted', key: 'd' }, shotDescs[i])]),
                ]))),
            ]),
          ]),
          h('form', { className: 'md-sheet-ask', key: 'ask', onSubmit: e => { e.preventDefault(); refineStudio() } }, [
            I({ name: 'spark', size: 14, key: 'i' }),
            // 对话栏就是常驻输入框；抽屉让位给画布时，才在画布底部再放一个入口（两者共用 studioInput）。
            isCompact ? h('input', { key: 'in', value: studioInput, onChange: e => setStudioInput(e.target.value), placeholder: '补充点想法，或者直接说要什么', 'aria-label': '补充想法' }) : null,
            isCompact ? h('button', { key: 'go', type: 'submit', className: 'md-send', disabled: !studioInput.trim() || busy !== '' }, I({ name: 'send', size: 13 })) : null,
            h('button', { key: 'verify', type: 'button', className: 'md-pill', title: '让科灵就当前论点做虚拟实验验证', onClick: function() { openCollabWithGoal('验证论点：' + String(studioTitle || studioInput || '').slice(0, 80)) } }, '验证这个论点')
          ]),
        ]),
        h('button', { key: 'toggle', type: 'button', className: 'md-chat-toggle', 'aria-label': '打开对话', onClick: () => { const s = document.querySelector && document.querySelector('.md-studio'); if (s) s.classList.toggle('chat-open') } }, I({ name: 'chat', size: 16 })),
      ])
      // 聊天消息内的轻量 Markdown 排版，配色全部走语义 token，跟随明暗主题。
      const CHAT_MD_CSS = [
        '.md-msg.is-hit{position:relative;border-radius:var(--r-md);box-shadow:inset 3px 0 0 var(--accent),inset 0 0 0 1px var(--accent);background:color-mix(in srgb, var(--accent) 12%, transparent);animation:rd-hit-pulse 1s var(--ease) 1}','@keyframes rd-hit-pulse{0%{background:color-mix(in srgb, var(--accent) 30%, transparent)}100%{background:color-mix(in srgb, var(--accent) 12%, transparent)}}','.md-hitnav{flex:none;position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:8px;padding:6px 10px;margin:0;border-bottom:.5px solid var(--line-strong);border-radius:var(--r-sm);background:var(--card);font-size:12px;color:var(--ink2)}','.md-hitnav-label{flex:1}','.md-hitnav button{padding:3px 9px;border:.5px solid var(--line-strong);border-radius:var(--r-sm);background:var(--card);color:var(--ink2);cursor:pointer}','.md-hitnav button:hover{color:var(--accent)}',
        '.md-msg.is-bot{white-space:normal}','.md-msg-ai{display:flex;flex-direction:column;gap:6px}','.md-reason{border-left:2px solid var(--line-strong);padding:2px 0 2px 10px;margin:0 0 4px;color:var(--ink3)}','.md-reason>summary{cursor:pointer;font-size:12px;line-height:18px;color:var(--ink3);list-style:none;user-select:none}','.md-reason>summary::-webkit-details-marker{display:none}','.md-reason>summary:before{content:"▸ ";display:inline-block;transition:transform .15s var(--ease)}','.md-reason[open]>summary:before{transform:rotate(90deg)}','.md-reason-body{margin-top:4px;font-size:12px;line-height:19px;color:var(--ink4);white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow-y:auto}','.md-tooltrace{border-left:2px solid #4176e6;padding:2px 0 2px 10px;margin:0 0 4px;color:var(--ink3)}','.md-tooltrace>summary{cursor:pointer;font-size:12px;line-height:18px;color:var(--ink3);list-style:none;user-select:none}','.md-tooltrace>summary::-webkit-details-marker{display:none}','.md-tooltrace>summary:before{content:"▸ ";display:inline-block;transition:transform .15s var(--ease)}','.md-tooltrace[open]>summary:before{transform:rotate(90deg)}','.md-tooltrace-body{margin-top:4px;font-size:12px;line-height:19px;color:var(--ink4);white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow-y:auto}',
        '.md-msg.is-bot p{margin:0 0 8px}',
        '.md-msg.is-bot p:last-child{margin-bottom:0}',
        '.md-msg.is-bot h3,.md-msg.is-bot h4{font-size:14px;line-height:21px;font-weight:600;margin:10px 0 5px}',
        '.md-msg.is-bot h3:first-child,.md-msg.is-bot h4:first-child{margin-top:0}',
        '.md-msg.is-bot ul,.md-msg.is-bot ol{margin:0 0 8px;padding-left:20px;list-style:disc}',
        '.md-msg.is-bot ol{list-style:decimal}',
        '.md-msg.is-bot li{margin:2px 0}',
        '.md-msg.is-bot li p{margin:0}',
        '.md-msg.is-bot strong{font-weight:600}',
        '.md-msg.is-bot code{padding:1px 5px;border-radius:5px;background:var(--hover);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}',
        '.md-msg.is-bot pre{margin:6px 0;padding:9px 11px;border-radius:var(--r-md);background:var(--hover);overflow-x:auto;line-height:19px}',
        '.md-msg.is-bot pre code{padding:0;background:none;font-size:12px}',
        '.md-msg.is-bot blockquote{margin:6px 0;padding-left:10px;border-left:1.5px solid var(--line-strong);color:var(--ink2)}',
        '.md-msg.is-bot hr{margin:10px 0;border:0;border-top:.5px solid var(--line)}',
        // 输入框：DSH 原生风格——圆角框内 textarea + 底部工具行(左工具右发送)
        '.md-composer-native{display:flex;flex-direction:column;align-items:stretch;gap:0;margin:0 12px 12px;padding:8px 10px 6px;border-radius:var(--r-panel);border:.5px solid var(--line-strong);background:var(--card);box-shadow:var(--dsw-elevation-soft);transition:border-color .15s,box-shadow .15s}',
        '.md-composer-native:focus-within{border-color:var(--line-strong)}',
        '.md-root .md-composer-native textarea:focus-visible{outline:none;outline-offset:0}',
        '.md-composer-native textarea{width:100%;min-height:24px;max-height:120px;padding:2px 0 6px;box-sizing:border-box}',
        '.md-composer-bar{display:flex;align-items:center;justify-content:space-between;gap:8px}',
        '.md-composer-tools{display:flex;align-items:center;gap:2px;flex-wrap:wrap;min-width:0}',
        '.md-ctool{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:8px;background:none;color:var(--ink3);font-size:11px;cursor:pointer}',
        '.md-ctool:hover{background:var(--hover);color:var(--ink)}',
        '.md-ctool:disabled{opacity:.4;cursor:default}',
        '.md-ctool-model{width:auto;padding:0 8px;gap:5px;color:var(--ink2);background:var(--hover);border-radius:999px;font-size:11px}',
        '.md-ctool-vision{width:auto;padding:0 8px;gap:4px;border-radius:999px}',
        '.md-ctool.is-on{color:var(--primary);background:color-mix(in srgb,var(--primary) 14%,transparent)}',
        '.md-vision-previews{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 6px}',
        '.md-vision-thumb{position:relative;width:44px;height:44px;border-radius:8px;border:.5px solid var(--line-strong);background:var(--hover)}',
        '.md-vision-thumb img{display:block;width:100%;height:100%;border-radius:8px;object-fit:cover}',
        '.md-vision-remove{position:absolute;top:-5px;right:-5px;display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;padding:0;border:0;border-radius:999px;background:var(--ink3);color:var(--card);font-size:10px;line-height:1;cursor:pointer}',
        '.md-file-card{position:relative;display:flex;align-items:center;gap:8px;min-width:0;max-width:240px;padding:4px 22px 4px 4px;border-radius:8px;border:.5px solid var(--line-strong);background:var(--hover)}',
        '.md-file-badge{flex:none;padding:2px 5px;border-radius:5px;background:var(--card);color:var(--ink2);font-size:10px;line-height:14px;letter-spacing:.02em}',
        '.md-file-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink);font-size:11.5px;line-height:16px}',
        '.md-file-size{flex:none;color:var(--ink3);font-size:10.5px;line-height:14px}',
        '.md-stop{background:var(--ink3)!important;color:var(--card)!important}',
        '.md-model-anchor{position:relative;display:inline-flex}',
        '.md-model-pop{position:absolute;left:0;bottom:calc(100% + 10px);z-index:40;width:288px;max-height:360px;display:flex;flex-direction:column;padding:8px 0 6px;border-radius:14px;border:.5px solid var(--line-strong);background:var(--card);box-shadow:var(--dsw-elevation-soft),0 10px 32px rgba(0,0,0,.28)}',
        '.md-model-search{display:flex;align-items:center;gap:8px;margin:0 10px 6px;padding:0 10px;height:34px;border:.5px solid var(--line-strong);border-radius:10px;background:var(--hover);color:var(--ink3)}',
        '.md-model-search input{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--ink);font-size:12.5px}',
        '.md-model-search input::placeholder{color:var(--ink3)}',
        '.md-model-pop-scroll{overflow-y:auto;min-height:0;padding:0 6px;scrollbar-width:thin}',
        '.md-model-group{padding:4px 0}',
        '.md-model-group>span{display:block;padding:4px 10px 2px;font-size:10.5px;color:var(--ink3)}',
        '.md-model-opts{display:flex;flex-direction:column;gap:1px}',
        '.md-model-opt{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:8px 10px;border:0;border-radius:9px;background:none;color:var(--ink);font-size:12.5px;text-align:left;cursor:pointer}',
        '.md-model-opt:hover{background:var(--hover)}',
        '.md-model-opt.is-on{background:var(--hover);color:var(--ink)}',
        '.md-model-opt:disabled{opacity:.45;cursor:default}',
        '.md-model-opt-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.md-model-opt-check{flex:none;color:var(--primary);font-size:13px}',
        // 科灵设置面板：两级(根菜单/模型或推理等级)，相对 dock 定位、横向贴合不溢出
        '.md-settings-anchor{display:inline-flex}',
        '.md-settings-pop{position:absolute;left:12px;right:12px;bottom:84px;z-index:45;max-height:min(420px,58vh);display:flex;flex-direction:column;overflow:hidden;border-radius:14px;border:.5px solid var(--line-strong);background:var(--card);box-shadow:var(--dsw-elevation-soft),0 10px 32px rgba(0,0,0,.28)}',
        '.md-settings-body{display:flex;flex-direction:column;gap:2px;padding:6px;overflow-y:auto}',
        '.md-settings-row{display:flex;align-items:center;gap:8px;width:100%;min-height:42px;padding:0 10px;border:0;border-radius:9px;background:none;color:var(--ink);font-size:13px;text-align:left;cursor:pointer}',
        '.md-settings-row:hover{background:var(--hover)}',
        '.md-settings-row>span:first-child{flex:1}',
        '.md-settings-row>span:not(:first-child){color:var(--ink3);font-size:12px}',
        '.md-settings-back{min-height:34px;color:var(--ink2);border-bottom:.5px solid var(--line);border-radius:0;margin-bottom:4px}',
        '.md-settings-back>span{flex:1}',
        '.md-settings-tip{padding:6px 10px 4px;color:var(--ink3);font-size:11px;line-height:1.5}',
        '.md-switch{position:relative;flex:none;width:34px;height:19px;padding:0;border:0;border-radius:999px;background:var(--line-strong);cursor:pointer;transition:background .15s}',
        '.md-switch::after{content:"";position:absolute;left:2px;top:2px;width:15px;height:15px;border-radius:50%;background:var(--card);transition:transform .15s}',
        '.md-switch.is-on{background:var(--primary)}',
        '.md-switch.is-on::after{transform:translateX(15px)}',
        // dsh-ui 围栏渲染容器：genui standalone 自带 root，宽度贴合消息气泡
        '.md-genui-fence{margin:8px 0;max-width:100%;overflow-x:auto}',
        '.md-genui-fallback{margin:6px 0;border-radius:var(--r-md);font-size:12px}',
        '.md-genui-fallback-title{margin-bottom:5px;color:var(--ink3)}',
        '.md-genui-fallback details summary{cursor:pointer;line-height:18px;color:var(--ink3);list-style:none;user-select:none}',
        '.md-genui-fallback details summary::-webkit-details-marker{display:none}',
        '.md-genui-fallback details pre{margin:6px 0 0;padding:9px 11px;border-radius:var(--r-sm);background:var(--hover);overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}',
        ''
      ].join(String.fromCharCode(10))
      const DOCK_RESIZE_CSS = '.md-dock-resizer{position:absolute;left:-4px;top:0;bottom:0;width:9px;cursor:col-resize;z-index:6;touch-action:none}.md-dock-resizer::after{content:"";position:absolute;left:3px;top:50%;width:3px;height:38px;border-radius:3px;background:var(--line-strong,var(--ink4));transform:translateY(-50%);opacity:0;transition:opacity .15s,background .15s}.md-root.has-dock .md-dock:hover .md-dock-resizer::after{opacity:.55}.md-dock-resizer:hover::after,.md-dock-resizer.is-drag::after{opacity:1!important;background:var(--primary)!important}.md-root.is-narrow .md-dock-resizer{display:none}'
      const inStudio = !!studioId
      const content = inStudio ? null : view === 'home' ? ideaGallery : view === 'research' ? researchView : view === 'schedule' ? scheduleView : view === 'discover' ? discoverView : view === 'insights' ? insightsView : view === 'lab' ? collabView : styleView
      return h('div', {
        className: 'md-root rd-root' + (isNarrow ? ' is-narrow' : '') + (isCompact ? ' is-compact' : '') + (dockOpen && !inStudio ? ' has-dock' : '') + (inStudio ? ' is-studio' : ''),
        ref: rootRef, 'data-rd': '1', 'data-theme': themeId, 'data-bg': bgStyle, key: 'root', style: { '--dock-w': dockW + 'px' },
      }, [
        h('style', { key: 'css' }, CSS),
        h('style', { key: 'dockcss' }, DOCK_RESIZE_CSS),
        h('style', { key: 'chatmdcss' }, CHAT_MD_CSS),
        h('style', { key: 'themecss' }, THEME_CSS + THEME_UI_CSS),
        h('style', { key: 'bgcss' }, BG_CSS),
        h('div', { className: 'md-ambient', 'aria-hidden': 'true', key: 'amb' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 })]),
        inStudio ? null : h('div', { className: 'md-main', key: 'main' }, [
          topbar,
          h('main', { className: 'md-content', key: 'content' }, [content, detail]),
        ]),
        inStudio ? studioView : (dockOpen ? dock : null),
        clearChatDialog,
        clearLibDialog,
        exportDialog,
        historyDialog,
        /* modelDialog 锚定在 composer 模型按钮内 */
        themeDialog,
        settingsDialog,
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
          { name: 'sidebar.panellist', id: PANEL_ID, order: 58, label: function () { return '科灵台' } },
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
