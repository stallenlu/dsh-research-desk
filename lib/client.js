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

    function Desk() {
      const [view, setView] = useState('library')
      const [mode, setMode] = useState('scatter')
      const [kindFilter, setKindFilter] = useState('all')
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
      const [settingRows, setSettingRows] = useState([])
      const [settingDraft, setSettingDraft] = useState({})
      const [searchResults, setSearchResults] = useState([])
      const [showSettings, setShowSettings] = useState(false)
      const [model, setModel] = useState('')
      const [modelPickOpen, setModelPickOpen] = useState(false)
      const [dockOpen, setDockOpen] = useState(true)
      const [width, setWidth] = useState(1600)
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

      const notify = (text, error) => setToast(text ? { text, error: !!error } : null)
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
      const send = useCallback(async text => {
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

      const NAV = [['library', '文献'], ['notes', '笔记'], ['plan', '计划'], ['discover', '发现'], ['style', '文风']]
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
        if (row.type === 'bool') input = h('label', { className: 'md-check', key: 'i' }, [h('input', { type: 'checkbox', checked: !!v, onChange: e => set(e.target.checked) }), h('span', null, '开启')])
        else if (row.type === 'enum') input = h('select', { key: 'i', value: v == null ? '' : v, onChange: e => set(e.target.value) }, (row.options || []).map(o => h('option', { key: o, value: o }, o)))
        else if (row.type === 'enumList') {
          const arr = Array.isArray(v) ? v : []
          input = h('div', { className: 'md-presets', key: 'i' }, (row.options || []).map(o =>
            h('button', { key: o, type: 'button', className: arr.includes(o) ? 'is-on' : '', onClick: () => set(arr.includes(o) ? arr.filter(x => x !== o) : arr.concat([o])) }, o)))
        } else input = h('input', { key: 'i', type: row.type === 'int' || row.type === 'float' ? 'number' : 'text', value: v == null ? '' : v, placeholder: row.secret ? '环境变量名' : '', onChange: e => set(e.target.value) })
        return h('div', { className: 'md-field', key: row.key }, [h('span', { key: 'l' }, row.label), input, row.help ? h('small', { key: 'h' }, row.help) : null])
      }
      const styleView = h('div', { className: 'md-page', key: 'style' }, [
        h('div', { className: 'md-page-head', key: 'ph' }, [h('h1', { key: 'h' }, '文风'), h('p', { className: 'md-page-sub', key: 's' }, '检索、问答、综述、写作与运行环境设置。')]),
        h('div', { className: 'md-panel', key: 'panel' }, [
          h('div', { className: 'md-form', key: 'form' }, [
            ...settingRows.filter(r => r.key !== 'model.route').map(renderField),
            h('div', { className: 'md-form-foot', key: 'foot' }, [
              h('button', { className: 'md-btn is-primary', key: 's', disabled: busy !== '', onClick: saveSettings }, '保存设置'),
              h('button', { className: 'md-btn', key: 'r', disabled: busy !== '', onClick: resetSettings }, '恢复默认'),
              h('button', { className: 'md-btn', key: 'e', disabled: busy !== '', onClick: doExport }, '导出全部'),
            ]),
          ]),
        ]),
      ])

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

      const suggestions = ['梳理这个主题的综述', '找出还没解决的问题', '给我几个可做的选题']
      const dock = h('aside', { className: 'md-dock', key: 'dock' }, [
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

      const content = view === 'library' ? (mode === 'scatter' ? scatter : feed) : view === 'notes' ? notesView : view === 'plan' ? planView : view === 'discover' ? discoverView : styleView
      return h('div', {
        className: 'md-root rd-root' + (isNarrow ? ' is-narrow' : '') + (isCompact ? ' is-compact' : '') + (dockOpen ? ' has-dock' : ''),
        ref: rootRef, 'data-rd': '1', key: 'root',
      }, [
        h('style', { key: 'css' }, CSS),
        h('div', { className: 'md-ambient', 'aria-hidden': 'true', key: 'amb' }, [h('i', { key: 1 }), h('i', { key: 2 }), h('i', { key: 3 })]),
        h('div', { className: 'md-main', key: 'main' }, [
          topbar,
          h('main', { className: 'md-content', key: 'content' }, [content, detail]),
        ]),
        dockOpen ? dock : null,
        settingsDialog,
        modelDialog,
        toast ? h('div', { className: 'md-toast' + (toast.error ? ' is-error' : ''), key: 'toast', role: 'status' }, [h('span', { key: 't' }, toast.text), toast.error ? null : h('button', { key: 'u', onClick: doUndo }, '撤销')]) : null,
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
