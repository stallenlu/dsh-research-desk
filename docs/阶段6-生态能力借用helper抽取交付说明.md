# 生态能力借用公共 helper 抽取 · 交付说明（阶段6 收口）

> 本目标「生态能力借用公共helper抽取与模拟使用者验证」的交付说明。按"两步走"第一步落地：只抽公共管道，场景语义留统一策略层。第二步场景语义声明化四前置门槛未过且属产品方向，未纳入、未施工、未夹带。

## §0 结论与取证基准

- 基线 HEAD = `90061145c4ed8f46db2222533d2a41ae4486cc6f`（上一目标收口提交；本目标施工未提交、在工作树）。
- 工作树（收口时点）：`M lib/host.mjs` / `M lib/search.mjs`；`?? lib/toolBorrow.mjs` / `test/toolBorrow.test.mjs` / `docs/helper抽取-阶段1-公共helper接口设计.md` / `docs/阶段1-helper抽取技术可行性与影响面-后端.md` / `docs/模拟研究人员使用者测试记录.md` / `docs/科研语义映射-人话转译层-接口设计.md`（留档、不混入）。`git diff --check` exit 0。
- **行号口径**：阶段8施工 + 本目标抽取两次致行号漂移；本文全部锚点以收口时点逐字重取为准（host.mjs revision=`559561fff014d9757316a452e8d0579fdc67bc12511ea88e2d005309b32b9ad9`、search.mjs=`9f6494fbdf…`、toolBorrow.mjs=`8d69eae720…`、approval.mjs=`f9738fc9b7b…`）。阶段1设计稿里那组常量旧值（:45/:47/:49/:67/:68）已过时，本文用当前真值并在此声明。
- 三层验证链：单测 476/476 fail0 skip0（负责人环境默认权威跑法 `node --test test/*.test.mjs`）→ 验收非施工方复验四尺全 PASS → 本阶段端到端模拟使用者测试（web 场景真实宿主 + 真实 HTTP 路由）。

## §1 目标与范围

- 目标：把 `lib/host.mjs` 与 `lib/search.mjs` 三处重复的"工具发现→探测→调用→回流"通用管道（生图 `draftImageTool` / scihub `scihubTool` / 抓全文 `webFetchTool`）收成一处公共 helper，以后每加一类借用能力不再重写这套管道；场景语义（副作用闸门／白名单回流／注入防御／人话转译／失败提示）保留在统一策略层，绝不下放给插件自报。
- 收口条件（用户睡前授权）：做到端到端"模拟研究人员使用者测试"通过才收口。
- 边界：只做第一步；第二步声明化不擅做；不给用户摊通用工具面板；一般用户第一眼标准；不碰 CSS 基线；接口设计稿留档不混入；模拟测试不与用户本人真机 36 项点签混账。

## §2 helper 抽取最终口径（通用层 vs 场景语义）

### §2.1 公共 helper `lib/toolBorrow.mjs`（59 行，两纯函数）

- 职责红线写在文件注释 `:7-12`：不读被借工具自报安全注解（`readOnlyHint`/`destructiveHint`）、验真策略由调用方第一方纯函数注入、安全放行仍落 `lib/approval.mjs` 真人拍板；不做模型自选工具、不写 state、不碰三道闸门、不决定失败文案、不做结果提纯；失败返回 null/undefined，不抛异常、不打印凭据。
- `borrowTool(ctx, opts)` `:25-40`：取工具集 `ctx.get('tools')` `:27` → 三件套探测 `executable/execute/selectExecutor` `:28` → `selectExecutor()` `:32` → 按 `opts.names` 逐个 `tools.executable(name)` `:35` → 调注入的 `opts.verify(def,executor,name)` 严格 `===true` 才通过 `:36` → `opts.pack({tools,name,def})` 原样透传 `:36`；发现/验真失败一律 null `:39`。helper 不内置任何验真规则。
- `invokeTool(tools, opts)` `:54-59`：现场拼 id `idPrefix+':'+Date.now()+'-'+random` `:56` → `tools.execute({calls:[{type:'tool-call',id,name,arguments:JSON.stringify(args)}],signal})` `:57` → 按 `callId===id` 从 `batch.results` 找回原始 `result` `:58`；无匹配返回 undefined。只回流原始 result，提纯/错误分类/人话留各 service。

### §2.2 三处管道收口逐条对照（当前真值）

| 能力 | 验真配置（场景语义，留各 service） | 通用管道收口点 |
|---|---|---|
| 生图 `draftImageTool` | `lib/host.mjs:52-65`，`:54` 调 `borrowTool`；验真=输出契约 `prompt:string`+`output.schema.paths:array` 且 describe 列名硬命中，逐字保持原语义 | import `:34`；execute 改 `invokeTool` `:1334`（idPrefix `draft-image`） |
| 论文下载 `scihubTool` | `lib/host.mjs:69-85`，`:72` 调 `borrowTool`；验真=入参契约（`scihub_pdf` 验 doi/url、`scihub_batch` 验 dois）。**"describe 形同虚设"边角按不改行为纪律逐字保留、注释留痕 `:75-80`** | import `:34`；execute 改 `invokeTool` `:1374`（idPrefix `scihub-download`） |
| 抓全文 `webFetchTool` | `lib/search.mjs:17-31`，`:20` 调 `borrowTool`；验真=describe 列名命中 **OR** url 参数合规，pack 返回 tools 本身 | import `:5`；execute 改 `invokeTool` `:383`（`web-fetch`）/`:428`（`verify-origin`） |

- 通用层唯一性反证：全库 `ctx.get('tools')`/`selectExecutor`/`.execute({calls`/`callId===id` 只命中 `lib/toolBorrow.mjs:27/:32/:57/:58`，host.mjs/search.mjs 各 service 零残留；`borrowTool`/`invokeTool` 调用点全库 15 命中（host `:34/:54/:72/:1334/:1374`、search `:5/:20/:383/:428`），边界闭合。
- 抽取不改对外行为：三处 UNAVAILABLE 文案、一次性令牌 `consumed`、闸门时序均未进 diff；id 形态与四前缀（draft-image/scihub-download/web-fetch/verify-origin）逐字一致；execute 的 signal 顶层透传、callId 精确回流保留。前端零改（diff 仅 host/search + 新 helper/测试）。

### §2.3 当前常量/分支真值（漂移后重取）

- `DRAFT_IMAGE_NAMES` `lib/host.mjs:46`、`DRAFT_IMAGE_UNAVAILABLE` `:48`、`DRAFT_IMAGE_NO_APPROVAL` `:50`、`SCIHUB_NAMES` `:65`、`SCIHUB_UNAVAILABLE` `:66`。
- 生图最前置 UNAVAILABLE 分支 `:1311`；approved 意图 `:1316`、真人拍板 `humanApproved` `:1323`、`gateCanProceed(outbound)` `:1324`、拒绝 `:1326`。
- scihub 空参 `:1368`、无工具 `:1370`。
- 说明：以上为抽取施工后当前值，与阶段1设计稿（施工前）那组差 1~3 行，属加 import 行 + 删旧管道行所致，非行为变化。

## §3 三道闸门零改 + 统一策略层

| 闸门 | 当前真值 | 抽取为何不碰 |
|---|---|---|
| 高风险确认 `ensureRiskApproval` | 定义 `lib/host.mjs:1252`、调用 `:1974`(install)/`:1996`(workspace)、底层 `gateCanProceed`=`approval.mjs canProceed :30-39` | helper 不 import store、不写 decision、不碰 collab |
| 每步确认 `collabStep` | `lib/host.mjs:2405`、waiting-human 硬拦 `:2412-2413`、L0/L1 每步确认 `:2423` | 与工具借用管道无调用关系 |
| 人工拍板 `collabDecisionAnswer` | `lib/host.mjs:2481`、`by!=='human'` 拒绝 `:2486` 附近 | 同上 |
| 统一策略层 | `lib/approval.mjs:1-57`（`:1-2` 声明不碰 store/spawn/确认；`HIGH_RISK_KINDS :3`=`['install','workspace','outbound']`；`canProceed :30-39`） | 维持唯一闸门锁定位，抽取不新增、不绕过、不下放 |

- 配图副作用闸门（`humanApproved :1323` / `gateCanProceed :1324`）、一次性令牌（`:1346-1354` 的 `store.mutate` 标 consumed）逐字留在 `draftImage` 场景段，未随 helper 抽走。
- 注入防御（`lib/search.mjs:13` `WEB_UNTRUSTED_NOTICE`、`:14` `WEB_SHELL_RE`）留在 search.mjs，未下放。

## §4 模拟研究人员使用者测试（阶段6，真实端到端）

> 完整记录见 `docs/模拟研究人员使用者测试记录.md`（102 行）；脚本与原始日志在 `C:/Users/GT14/.dsh/artifacts/`（非 `_` 前缀）。本节摘要逐条对应，锚点经架构收口时点逐字复核。

### §4.1 测试性质（非 headless 自证）

- 起真实 DSH 宿主实例 + 真实 profile bundle，走前端实际调用的同一 HTTP 路由 `/api/research-desk/` POST `{action}`，与既有真机验收脚本 `test/acceptance.mjs:135-179 bootServer` / `:109-117 post` 同范式。
- 独立临时 `DSH_HOME` 隔离，不触碰用户正在写的 `C:\Users\GT14\.dsh\research-desk\state.json`。
- 全程记录真实输入 + 服务端真实人话回执；工具不可用如实记 UNAVAILABLE，不注入 mock、不伪造成功；模拟测试不与用户本人真机签混账。

### §4.2 真实入口锚点（收口重取）

- `lib/host.mjs:39` `ROUTE_PREFIX='/api/research-desk/'`；`:43` `ACTIONS`（50 项，含 `draft_image`/`download_paper`/`verify_origin`/`notice_action`/`sync_schedule`）。
- `:2594` `run(args,signal,extra)` 统一入口；`:2648` `draft_image` / `:2649` `download_paper` / `:2650` `verify_origin` dispatch 分支。
- `:3315` `ctx.webServer.register({kind:'prefix',path:ROUTE_PREFIX,handler:handle})`；`:3317` `ctx.tools.register({name:'research_desk',...})`。

### §4.3 端到端真实回执（web profile）

- **入口在册**：`POST {action:'status'}` → http 200，`status.commands` 列出 `draft_image=true`/`download_paper=true`/`verify_origin=true`/`read=true`。
- **抓全文链（本例走 arxiv HTML 直取旁路，未验证生态 web_fetch 借用链）**：`search` 'retrieval augmented generation evaluation' → 9 篇（arxiv/europepmc/openalex 三源真实人话）→ `add` 前 3 篇 count=3 → `library` paperCount=3 → `read(paperId)` chunks=164、`kind='html'`、`diag=[]`，`message='已入库 164 段（html），来自 https://arxiv.org/html/2601.05264。'`。数据真实、人话不露裸数据（合用户"服务端算好、客户端只渲染"口径）；但**这条回执恰恰证明生态 web_fetch 借用链本例未走到**：`lib/search.mjs:366-371` 对有 arxivId 的文献先走 `https://arxiv.org/html/<id>` 的 `getText` 直取、命中即 `return {kind:'html'}`；只有走到 `:376-393` 的 webFetchTool 借用链才 `return {kind:'web'}`（`:386`，对应 `lib/host.mjs:1579` 模板分支）。日志 `kind='html'` + `diag=[]`（连 `:388`/`:391` 的 `onDiag` 都没触发）铁证本例在 arxiv 直取处就返回、未尝试 webFetchTool。故抓全文的"借用能力"在端到端里同样未验证，不能算作"工具可用走通"。
- **生图（工具缺失，真实降级）**：`POST {action:'draft_image',prompt:...}` 与加 `approved:true` 两种输入，均 http 200 `ok=false` `message='未找到可用的订阅生图工具，这一版配图暂时做不了。'`（常量 `:48`、最前置分支 `:1311`）。无工具时在闸门判断前就返回，未进 `:1316/:1323/:1326`，如实降级非伪造成功。
- **scihub（工具缺失，真实降级）**：单篇 DOI / 批量 DOI 均 http 200 `ok=false` `message='未找到可用的论文下载工具，这一版下载暂时做不了。'`（常量 `:66`、分支 `:1370`）；空参 → `'请提供 doi、url 或 dois 之一。'`（`:1368`）。

### §4.4 工具"可用时"路径：本机未验证（如实标注）

- desktop profile 两次尝试均因环境机制阻断：`--profile desktop` → `profile "desktop" is managed exclusively by the Electron application`；改名 `e2e-desk`+symlink → `profile "e2e-desk" does not exist`（bootstrap 不认临时 profile）。均 120s 无 token，**非工具本身问题**。
- 结论如实写：**本机 desktop 实例借用工具注入未验证**，不编造"工具可用时下载成功"。该路径正确性由非真机覆盖：`test/toolBorrow.test.mjs` 11 条真行为断言 + 既有生图 29 / scihub 6 / 抓全文 8 条回归 + 负责人 476/476 fail0。
- **待 Chief 拍**：是否接受"单测+既有回归覆盖"替代 desktop 工具可用路径的真机验证作为本目标收口依据（工具可用时的 scihub 下载 / 生图闸门）。这是收口唯一悬置点，不工程侧内部消化。

## §5 单测覆盖（11 条真行为断言，非合规全绿自证）

- `test/toolBorrow.test.mjs`（153 行）：验真严格 `===true`（truthy 字符串/数字不算）`:47-53`；三件套缺一返回 null `:55-61`；无 describe 返回 null `:63-66`；verify/selectExecutor 抛异常被吞、不打印凭据 `:68-83`；`destructiveHint:true` 但 verify 通过就放行、`readOnlyHint:true` 但 verify 拒绝就拒绝（证明 helper 不看自报注解）`:85-94`；只访问 `ctx.get('tools')` 不碰三闸 `:96-102`；防御性输入一律 null `:104-112`；invokeTool payload 形态/signal 顶层透传/callId 精确回流不串味 `:116-138`；id 前缀形态 `:140-147`；无匹配/非数组返回 undefined `:149-153`。
- 负责人环境默认权威跑法 `node --test test/*.test.mjs` → 476/476 pass fail0 skip0 cancelled0（465 基线 + 11 新增，零回归）。

## §6 本目标不做项（边界留痕）

- 第二步场景语义声明化（四前置门槛未过且属产品方向）；不引入第三方引擎；不给用户摊通用工具面板；不改五页签 UI；不碰 CSS 基线（`md-card`/`md-hero`/`md-ministamps`）；不碰 §0.1 六条硬约束；不碰冻结裁决（dsh-mnemon / session-superagent / AgentTeams 开关 / P2-3）；接口设计稿留档不混入；维度②科灵自身能力成长零施工；不代签真机；不自建 headless 自证。

## §7 遗留签字边界

- 用户本人 36 项真机/4 豁免签字仍是独立遗留项，本目标不触碰、不代签、不因本目标作废。
- **工具可用时三条借用链的本机端到端验证（独立遗留项）**：生图 approved 闸门 / scihub 下载 / web_fetch 借用链在工具真实可用时的完整端到端调用，因本机环境阻断（web profile 未装 dsh-scihub/vision-router 等工具 + desktop profile 被 Electron 独占、改名 profile 不被 bootstrap 识别）未走到。此项作为独立遗留项，与用户 36 项真机签同类，**不因本目标收口视为已通过**；其正确性暂由 `test/toolBorrow.test.mjs` 11 条真行为断言 + 负责人环境 476/476 回归覆盖。待具备工具可用的真实环境再补验，届时如实记账、不追认本目标已走通。
- 本目标是模拟使用者测试（团队内部验证 helper 抽取行为），与用户真机签不是一账；收口仅代表"第一步 helper 抽取 + 模拟测试"完成，不代表用户真机验收完成，也不代表工具可用时借用链端到端通过。

## §8 证据

- 命令：`git rev-parse HEAD`→`90061145c4ed8f46db2222533d2a41ae4486cc6f`；`git status --short`→见 §0；`git diff --check`→exit 0。
- `git diff -- lib/host.mjs lib/search.mjs`→三处管道收口逐段核对，场景语义未进 diff。
- `ops_inspect_local_file lib/toolBorrow.mjs 1-59`→两纯函数全文；`test/toolBorrow.test.mjs 1-153`→11 条断言全文。
- `ops_grep lib "borrowTool|invokeTool"`→15 命中；`ops_grep lib ".executable(|.selectExecutor(|ctx.get('tools')"`→全库 9 处，通用层唯一。
- `ops_inspect_local_file docs/模拟研究人员使用者测试记录.md 1-102`→端到端记录全文（测试产出，架构收口复核）。
- `ops_grep lib/host.mjs "DRAFT_IMAGE_UNAVAILABLE =|SCIHUB_UNAVAILABLE =|borrowTool(|invokeTool(|fetchFullText|async readPaper"` + `ops_inspect_local_file` 对应段→当前常量/调用点/路由/闸门真值逐字坐实。
- 第三方致谢：本目标未新增第三方二次封装，仅抽取科灵自有管道；沿用既有生态能力（scihub/生图/web_fetch）的致谢与免责声明见 README 与各能力文档。
