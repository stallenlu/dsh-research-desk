# 科灵台主要交互对齐 DSH 原生会话 · 系统分析与实施建议报告

> 版本 v1.0 · 2026-11-20 · 对应目标 goal-d738f4b6-fd00-4639-9b2f-9f61f69d1d9a
> 证据纪律：本文所有 file:line 均为调研时快照，行号随源码漂移。按 kelin-ui 章程铁律「以 class 名 + DOM 结构为准，引用前必须 read 原文自检」。标注「asar 内」指 D:/opt/DeepSeek Harness/resources/app.asar（dsh/node_modules/@deepseek-ai/...），「仓库内」指 E:/Research/dsh-research-desk。
> 撰写依据：五份只读调研（交互全景盘点 / 诉求演进与口径锁定 / 定位推导带勾追溯表 / 可行性成本风险矩阵 / 插件能力动态选用），全程未改代码、未自建 headless 当完成自证。

## 0. 一句话结论

不照搬 DSH 插件全量能力。在**输入附件卡 / 输出消息呈现 / 底部工具行**三个交互面，按 DSH 原生的「视觉语法 + 能力契约」做必要基础对齐；按科灵台定位（科研全流程助手）自研特性功能；对无底座的第三方插件控件（∞ 自动继续、赞踩、排序/脑图/分享）明确不做、绝不摆假按钮。用户得到的是「像原生一样熟悉」的交互，而不是「堆了一堆点不动的图标」。

## 1. 问题界定与诉求口径锁定

### 1.1 权威口径（用户逐字，按优先级叠加）

- **边界口径（最终，m19636）**：dsh 原生的会话功能可以直接调用 dsh 里已经安装并开启的插件的功能；科灵原则上需要的**不是这样全部功能**，需要的是原生会话中**必要的基础功能对齐**，同时要根据具体科灵台定位的应用场景和科灵的设计定位进行**必要的特性功能开发**。
- **范围口径（m19560，多选）**：输入框上方的附件卡 + 底部工具行按钮布局，两项都要。
- **方式授权（m19640/41/42）**：系统全面分析、不再一点点迭代 → 给出详细分析建议报告 → 带领团队认真做。
- **补充需求（m19657）**：科灵里应该可以从 dsh 安装的插件里动态选择需要的，从而更好完成任务。
- **复用原则（m18930/35/40）**：截图和文件的处理直接采用 dsh 原生会话的处理方式；主要交互模式上能套用 dsh 原生设计的就都用原生的。

### 1.2 诉求演进时间线

| 时间 | 用户消息 | 诉求焦点 |
| --- | --- | --- |
| m18920 | 输入框 Ctrl+V 粘贴截图/文件到上方 | 输入附件卡样式 |
| m18930/35/40 | 直接采用 dsh 原生处理方式/设计 | 处理机制原生化 |
| m19358 | 科灵给的图像文件默认靠右希望靠左；文件显示却找不到分析不了 | 输出侧对齐 + 实质 bug |
| m19521/55/60 | 工具行左起插件｜权限｜+号 | 底部工具行布局 |
| m19596 | 输出后按钮和信息完整采用 dsh | 消息 footer |
| m19636 | 只对齐必要基础 + 按定位开发特性 | 边界收口（最终） |
| m19640/41/42 | 系统分析 → 报告 → 带团队做 | 方式授权 |
| m19657 | 从已装插件动态选择能力 | 补充需求 |

### 1.3 三大做错方向风险

1. 把「完整采用」误解为照搬 dsh 插件全量能力——m19636 已明确收窄。
2. 把「靠左/靠右」误解为输入框上方附件排列——m19358 实指**输出侧科灵回复的图像/文件对齐**（以 m19555 截图为准）；输入侧附件卡与输出侧消息卡片是两个位置（输入侧已随 eba7b61 修复）。
3. 漏掉 m19358「文件显示但找不到、分析不了」是实质功能 bug——已随 eba7b61 修复（文件字节走原生 attachments 提纯，agent 可读）。

### 1.4 九条验收（最终需求逐条落地）

| # | 验收项 |
| --- | --- |
| ① | Ctrl+V 粘贴文件/图片到输入框上方，dsh 原生样式 |
| ② | 附件处理机制原生化（admitPromptContent / admitEncodedFile） |
| ③ | 输出图像/文件默认靠左 |
| ④ | 输出文件看得到、找得到、分析得了 |
| ⑤ | 输出消息下方按 dsh 原生展示按钮和信息 |
| ⑥ | 工具行左起：插件功能｜权限设置｜+号 |
| ⑦ | 不照搬插件全量能力 |
| ⑧ | 按科灵定位自研特性功能 |
| ⑨ | 系统分析报告统筹，不再零散迭代 |

### 1.5 m19596「完整采用」与 m19636「只对齐基础」的调和

两层不矛盾：**层次不同**——「完整」修饰的是处理方式 How（交互范式），m19636 收窄的是功能集合 What；**时间演进**——m19636 在后，是最终口径；**统一原则漏斗**——交互层全面原生化 → 功能层只对齐必要基础 → 差异层按定位自研。

## 2. DSH 原生交互全景盘点

### 2.1 基础能力 vs 插件能力（分野，直接决定「对齐什么」）

| 交互域 | 关键证据（asar 内） | 性质 | 科灵台现状 |
| --- | --- | --- | --- |
| 消息气泡/角色 | MessageItem.tsx:180-237 右对齐气泡限宽70%；AssistantMarkdown.module.css:1-7 助手全宽 narration | 基础 | client.js:3040 有 md-msg 但缺右对齐气泡+限宽 |
| 思考过程 reasoning | ReasoningRow.tsx:12/61-113 可折叠 disclosure+streaming 微光+signature 剥离 | 基础 | 有 reasoning 数据(820/1306)缺折叠展示 |
| 流式视觉 | RunningStatus.tsx:25-48 鲸尾+计时+TextShimmer 三态同渲染器 | 基础 | 有 callStream(849/921/1306)缺 live 视觉 |
| 空态/欢迎 | EmptyHero.tsx:22-166 headline+品牌鱼+工作区 chip，composer 不重挂载 | 基础 | 无欢迎态/品牌鱼 |
| 会话/工作区切换 | dsh-client-ui-session/workspace 包，与空态 chip 耦合 | 基础 | grep 无 session/conversation，最大结构性差距 |
| 错误/边界提示 | MessageItem.tsx:53-163 行内状态行/重试/maxTokens/stopped | 混合 | 仅 toast + isTransientModelError(241) |
| 模型选择弹层 | ModelSelect.tsx:444-666 两级钻取+键盘+ARIA+portal | 混合 | 无弹层，仅 modelsStatus |
| token 体系 | --dsw-alias-* 语义 token | 基础 | client.js:26 已对齐（部分） |

结论：DSH 原生「无插件也工作」的基础能力有 8 域；deepseek-account 登录/配额/签名码、provider 模型扩展位、fork/plugin-merged 收尾等属插件专属，去掉不影响基础会话。科灵台数据层（reasoning/toolTrace/role）已有，主要缺展示层。

## 3. 科灵台定位推导与带勾追溯表

### 3.1 哲学根原文（只挂 1.1/1.2/1.3；1.4 工程约定、1.7 工作假设均不作根）

- **R1 = 1.1 北极星**（E:/Research/科灵台UI规范与施工契约.md:39，用户 m07018）：科灵智能助手是科灵台的灵魂，触及所有环节，全流程协助研究者**收集/发现/整理/发表作品**，可成长，与研究者磨合越久越默契。（原文未含数值模拟执行，不得扩写。）
- **R2 = 1.2 合作关系**（charter.md:45-46 / README.md:54）：介于助手与托管之间——共同目标、各有分工、互相补位、过程透明、决策点来回商量；三句话归一为**共同目标（合作）、过程可见（空间）、科灵主动（lead+角色设定）**。
- **R3 = 1.3 四条能力边界**（charter.md:51-54，逐字）：①三档权限约束 agent 工具调用、不约束实验子进程；②仅阻断走代理的外网 HTTP(S)，非网络隔离；③当前无静态代码扫描，仅长度与空值校验；④实验代码仅受 runner.enabled/路径白名单约束，沙箱与确认闸门尚在实现中，不得声称已约束。

### 3.2 必对齐基础（B 类，挂 R1/R2/R3）

- B1 文本输入+发送（R1）｜B2 附件粘贴上方靠左×可移除（R1，README:105，已落地 eba7b61）｜B3 附件提纯逐字读取+不支持类型明示≤4张≤4MB（R1）｜B4 新会话隔离（R1）｜B5 回答 Markdown 渲染（R2）｜B6 审批权限沿用 DSH 语义（R3①+R2）。

### 3.3 定位特性（F 类，DSH 原生没有但科灵必有）

- F1 能力边界四条白话上屏（R3①②③④）｜F2 有锚点问答+引文逐字核验+无命中不调模型（R1+R2，README:49/59）｜F3 研究流程状态模型（成稿三步/写作脉络六环节，R1）｜F4 靶心协作 collab 四区+collab_stream（R2，README:132）｜F5 决策区拍板（R2）｜F6 角色可设定+自主度 L0-L3（R2）｜F7 三处按需入口（R1+R2）｜F8 共成长画像记忆 L1-L4（R1）｜F9 搭档话术（R1+R2 派生）｜F10 只做研究流程状态与证据链边界自述（R1，README:41）。

### 3.4 不做（N 类）

- N1 扫荡式复用插件全量（R1+m19636）｜N2 通用文献管理器全套/同行评审裁判/选刊顾问（R1，README:41）｜N3 不可逆实验决策自动机/静默提权（R2）｜N4 声称已沙箱隔离/已静态扫描的虚假安全感文案（R3②③④）｜N5 现阶段做 PDF 页码锚点/citekey 导出/中文源/引用图/跨文献聚类（R1，README:161-166）｜N6 内部 id 枚举变量名上屏（R3④）。

特别推导：三开关收尾归属——识图=B2/B3 基础对齐+定位加成；协作=F4 定位特性；权限只读=F1/R3 边界呈现。

## 4. 可行性 / 成本 / 风险决策矩阵

决策分层：**A 立即锁为回归门禁**（真能力已实现，不得回退）｜**B 排期接真能力**｜**C 本轮明确不做**（无底座，严禁假按钮）。

| 项 | 归属 | 真/假 | 改动范围 | 风险 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| 1 附件条靠左+文件可读 | A | 真（已落地） | 无（回归保护） | 低 | 高·保持 |
| 2 工具行 +号命令目录 | B | 条件真（host svc catalog 现成） | client 弹层+host catalog action | 中（逐项须有真 action） | 中 |
| 3 权限盾牌 | A | 真（approval 闸门） | client 状态展示 | 高（不可绕过人工确认） | 高 |
| 4 ∞ 自动继续 | C | 假（第三方插件无底座） | 不实现 | 高（假按钮） | 低·不做 |
| 5 消息后复制 | A | 真（已实现） | 无 | 低 | 高·保持 |
| 6 消息后时间 | B | 真（host:1895 有 at） | client 投影到气泡 | 低（缺 at 留空不造假） | 中 |
| 7 消息后用量 | A | 真（LLM usage） | 无/微调 | 低（无 usage 不显示） | 高·保持 |
| 8 消息后赞/踩 | C | 假（无后端+Store） | 不实现 | 高 | 低·不做 |
| 9 排序/脑图/分享 | C | 假（无原生注册） | 不实现 | 高 | 低·不做 |

### 4.1 核心问题作答：既熟悉又不造假

采用原生「视觉语法 + 能力契约」，不照搬第三方控件外观。①**视觉语法全盘沿用**（零成本）：--dsw-alias token、圆角/elevation、md-round/md-dockbar role=toolbar、md-chatmenu、F() 图标体系；②**真能力按原生契约接**（A/B 项）：附件走 attachments cap、+号走 host svc catalog、盾牌走 approval 闸门、时间/用量/复制走真实数据，每个按钮上线前必须能指到一条真实 action/数据源；③**无底座项诚实处理**（C 项）：不出图标、不出灰按钮冒充「即将支持」，产品需要时用文字说明「需 XX 底座，未接入」。

仓库内关键锚点：host.mjs:32 inject=['tools','webServer','agents','attachments']；host.mjs:1629-1662 svc 分派表（status/models/settings/stats/search/add/library/read/ask/chat/hypothesis/draft/review/gaps/experiments/run/export/import/undo/history 等，即现成 catalog）；host.mjs:1710-1736 权限闸门；approval.mjs:30-38 canProceed。客户端 client.js:2827-2836 权限页、:2986 chatRelativeTime、:3040 消息块、:3072 model、:3077 attach。

## 5. 插件能力动态选用专项（补充需求 m19657）

### 5.1 DSH 如何发现「已装且开启」的插件能力——四个发现面（无单一目录）

- **插件清单**：dsh-host-plugin-inventory/src/index.ts:70-102 的 pluginInventory.list（cordis Loader.entries() 且 !entry.disabled）。
- **命令目录**：dsh-client-ui-commands/src/client/service.ts:108/115 remote.commands.list + registerSource（trigger "/"）；宿主 dsh-commands/src/index.ts:285/315 register/list。
- **skill 目录**：dsh-skill/src/index.ts:475/481 snapshot({modelFacing/humanFacing})。
- **工具注册**：插件 ctx.tools.register（如 dsh-freebie-radar/lib/host.mjs:434-457）；MCP 另算（dsh-mcp-manager/src/index.ts:82）。

### 5.2 「动态选择」的两个主体（层级不同）

- **用户/管理员决定「哪些能力在场」**：dsh-plugin-manager:2854 setPluginEnabled（写操作，需权限）；agent-preset；mcp_connector_session_tools（仅用户明确指定精确工具名后可激活）。
- **科灵（agent）决定「在场能力用哪个」**：dsh-tool-skill/lib/index.js:788-795 的 skill 工具、ctx.tools.register 的工具、MCP tools。DSH **不支持 agent 自主 enable 原本关闭的插件**（那是写操作）。

### 5.3 选用路径的数据流与权限边界

- /命令（用户主动、不经 LLM）：dsh-commands/src/index.ts:76/333/361 remote.commands.execute，per-agent 作用域+附件准入+AbortSignal+durable 生命周期日志。
- skill（模型自主）：dsh-tool-skill 的 skill 工具只加载指令文本，由模型执行；catalog 分流 model-facing/human-facing。
- MCP 工具（模型自主、宿主治理）：宿主 connector 管 OAuth/API Key，科灵代理调用不得接触凭据。
- 插件直注 agent tool（模型自主）：如 freebie_radar，public read 免 key、admin actions 需 adminToken。

### 5.4 三条路可行性（对科灵台）

- **① MCP 连接器方向不可直接复用**：lib/mcp.mjs:1/31/252 是「科灵对外暴露 MCP」而非「科灵消费 DSH 插件」；MCP_TOOLS 硬编码。
- **② skill 目录最低摩擦（推荐）**：若科灵 runner 跑在 DSH agent 会话内，model-facing skill catalog 自动进 system prompt（本会话 available_skills 可证），把插件能力包成 skill 即可被模型按需 load；但 skill 只是指令，不是插件调用本身。
- **③ 命令 catalog 仅作用户手动面板数据源**：/命令 agent 无法自主调用，需科灵台自己发 remote.commands.execute（要 sessionId + 用户授权）。

### 5.5 最小方案与风险

- **方案 A（用户手动勾选能力面板）**：只读面板，数据源 pluginInventory.list + commands.list + skill.snapshot；勾选写入科灵台配置，执行时只调勾选项。每条须显示真实来源/只读性/是否联网/是否需拍板，不可用则禁用并说明。
- **方案 B（科灵自主选）**：把已注册能力清单注入 agent system prompt，复用 model-facing skill catalog，模型按需 load skill/call tool；禁止 agent 自行 enable 插件或触发 install/workspace/outbound。
- **风险红线**：approval.mjs:3 HIGH_RISK_KINDS=['install','workspace','outbound']、:30-38 canProceed、:50-55 choosePermission 只降不升。现有闸门只包住 research-desk 自己的 ACTIONS/collab_decision；外部插件能力若走 ctx.tools.register execute 或 remote.commands.execute 会**绕过闸门**，必须纳入高风险或显式白名单。toolRegistry.mjs:2-8 声明三档权限只约束 agent 会话工具调用、不约束子进程；mcp.mjs:127 research_run 是 runner.enabled 代理断网，与 DSH 插件能力不同源，不可混淆。

## 6. 执行路线（分批落地，每批走 kelin-ui 五关）

| 批次 | 内容 | 归属 | 状态 |
| --- | --- | --- | --- |
| 批次 0 | 附件条靠左 + 文件可读 | A 已实现 | 已完成（eba7b61），锁为回归门禁 |
| 批次 1 | 消息 footer 原生视觉语法：复制(已有)/时间(host at 投影)/用量(已有)；盾牌只读闸门状态展示 | A+B | 待拍板后开工 |
| 批次 2 | 工具行 +号命令目录（接 host svc catalog，逐项验真）、输出侧图像/文件靠左 | B | 待拍板后开工 |
| 批次 3 | 定位特性 F 类补齐（能力边界四白话上屏、证据链过程可见等，按场景分批） | F | 待拍板后开工 |
| 批次 4 | 插件动态选用（方案 A/B 或本轮不做，待拍板） | 补充 | 待拍板 |
| — | ∞/赞踩/排序/脑图/分享 | C | 明确不做，写入「不做」清单 |

每批固定流程：关1 调研（现状-目标差距表，逐字回盘 file:line）→ 关2 Chief 方案（带勾追溯表挂 1.1/1.2/1.3 原文）→ 关3 施工（写范围按批划定，lead 逐字复核≥2轮、第2轮非施工）→ 关4 非施工独立评审（rubric 勾叉+判定依据栏，禁施工者自签）+ 真实 GUI 截图 → 关5 README+门禁+提交推送+沉淀。写范围严格限定 lib/client.js / lib/host.mjs / test/*.test.mjs，不碰无关文件，不新增硬编码 hex，复用现存 class。

## 7. 验收总则

- **必须真实 GUI**：在 DSH Web/桌面里实际点、实际看结果；**严禁自建 headless DOM/源码字符串断言当「完成证据」**。现有 test 仅作回归护栏，不作为验收通过依据。
- 每项真能力都要能落到「host.mjs action + client.js 渲染 + GUI 三点闭环」。
- 时间/用量等真实数据缺失时诚实留空，不填 0 冒充、不造假按钮。
- 全程助手名「科灵」，话术是搭档不是使唤；能力边界白话上屏优先于内部机制隐藏。

## 8. 用户拍板结果（2026-11-20）

| 决策点 | 用户选择 | 影响 |
| --- | --- | --- |
| C 类控件 | **明确不做** | ∞自动继续/赞踩/排序脑图分享写入不做清单，不上假按钮、向用户说明 |
| 插件动态选用 | **本轮暂缓** | 单独作为后续专项，不并入批次 1+2 |
| 批次优先级 | **先做批次 1+2** | 先做基础对齐与工具行，批次 3 定位特性后续排 |
| 范围确认 | **认可三面** | 附件卡/输出消息/底部工具行三面为本轮范围，其余按 N 类不做 |

---

已拍板：按第 6 节路线带领团队分批开工，先批次 1+2，全程 kelin-ui 五关与真实 GUI 验收。