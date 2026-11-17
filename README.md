# dsh-research-desk · 科研工作台

DeepSeek Harness 插件：把「查文献 → 精读 → 问答 → 选题 → 草稿」这条科研工作流做成一个可复用的工作台，
**并且每一条引文都回到原文逐字核对**。

- 插件包名：`dsh-research-desk`（MIT，零运行时依赖，零构建步骤）
- 宿主要求：DSH `>=0.2.1-rc.5 <0.3.0`，Node `>=22`
- 状态：代码与测试在本机跑通；**尚未在桌面宿主里安装验证**（本机 `dsh` CLI 不在 PATH，只能走 GUI 插件页或自定义插件索引安装）

---

## 1. 它解决什么

调研报告《开源科研工作台全景调研分析报告》给出的结论是：严格跑通「文献→假设→实验→论文」四段闭环的开源项目 = 0 个，
生态真实形态是 8 层栈（L1 文献 / L2 综述 / L3 精读 / L4 选题假说 / L5 实验计算 / L6 可复现 / L7 写作出版 / L8 协作评审），
瓶颈在 L4（选题假说）与 L6（可复现），而这两层恰好是现有生态最薄弱的。

本插件覆盖其中**不需要实验设备、可以真做出来的五段**：L1 检索与文献库、L3 精读与带锚点问答、L4 选题假说、L7 草稿，
外加一条贯穿式约束：**引用必须可核验**。

对应调研报告里最硬的负面证据：

- Ideation–Execution Gap（arXiv 2506.20803 / Science 10.1126/science.aeb7969）：43 位专家各花 100 小时以上盲审执行，
  AI 生成的假设在 novelty / excitement / effectiveness / overall 四项上**全部显著更差**（p<0.05），部分排序直接反转。
- arXiv 2608.05179 的验证缺口审计：9 个自称闭环的 L4 系统里 7 个只是机械重跑，**没有一个有外部在环 oracle**。
- PNAS 2026;123(44) doi 10.1073/pnas.2610214123 归纳的五类失效模式；只看手稿的检出率只有 53.7%（F1 0.42），
  给日志和代码才升到 81.5%（F1 0.81）。
- GhostCite（arXiv 2602.06718）：LLM 引用幻觉率 14.23%–94.93%，76.7% 的评审者根本不核引用。

所以这个插件的设计取向是**反着做**：能力宁可少，不可假。
- 问答只从已入库的全文回答；**没有命中就根本不调模型**（不是让模型自由发挥后再标个"不确定"）。
- 模型给的引文逐条与原文片段比对，**对不上就剔除并计入 `unverified`**，而不是照样显示。
- 选题阶段明确告诉模型"你只拿到了摘要，不许声称机制已被证明"，要求每个选题写出**能杀死它的最便宜实验**。
- 草稿阶段要求每条主张标注来源 id；**文献库撑不起某节就写缺什么**，不许编。

---

## 2. 六个动作

Agent 侧只有一个工具 `research_desk`，一个 `action` 参数切换；侧栏面板走同源 HTTP 桥，打到同一份状态文件。

| action | 作用 | 关键参数 |
|---|---|---|
| `status` | 库内篇数、选题数、草稿数、当前默认模型 | — |
| `models` | 列出宿主可调用的模型 | — |
| `search` | 检索 arXiv / Europe PMC / OpenAlex（免密钥） | `query` `sources` `maxResults` |
| `add` | 把检索结果放进文献库（按 doi→arxiv→标题去重） | `papers[]` |
| `library` | 列出文献库、选题、草稿 | — |
| `read` | 拉全文并切成可检索片段存进库里 | `paperId` |
| `ask` | 只用库内全文回答，每条引文核验 | `question` `paperIds` |
| `hypothesis` | 从文献库推出可证伪选题 | — |
| `draft` | 生成论文大纲 | `instruction` |
| `remove` | 移出一篇文献 | `paperId` |
| `undo` | 撤销上一步 | — |

调用示例：

```json
{ "action": "search", "query": "retrieval augmented generation evaluation", "maxResults": 12 }
```

---

## 3. 数据源与免密钥说明

三个源都**不需要 API key**，这是刻意的：科研工作者装插件的第一道门槛应该是判断题，不是注册。

| 源 | 端点 | 覆盖 | 备注 |
|---|---|---|---|
| arXiv | `export.arxiv.org/api/query` | 预印本全文（TeX/HTML） | 自然语言检索用 AND 词链；AND 0 命中自动回退 OR 链 |
| Europe PMC | `ebi.ac.uk/europepmc/webservices/rest/search` | 生命科学 + PMC 全文 | 优先命中 PMC 全文 |
| OpenAlex | `api.openalex.org/works` | 全学科 + 引用数 + 摘要倒排索引 | 2026-02-13 起 polite pool 已废，`mailto` 改为可选、缺省不发 |

**踩过的坑（已修）**：arXiv 不把裸多词查询当关键词列表。`all:"retrieval augmented generation scientific literature"` 实测 **0 行**（它只做整串短语匹配），
而 `all:retrieval AND all:augmented AND all:generation` 实测 3 行。所以 `arxivQuery()` 会把自然语言拆成 AND 词链，
引号短语原样保留，最多 8 个词；AND 链 0 命中再退到 OR 链（最多 5 项）。

**全文抓取顺序**：PMC `fullTextXML` → `arxiv.org/html/{id}` → 摘要降级。
Europe PMC 的 JATS 里混着 `journal-meta / contrib-group / ref-list` 等元数据噪声，会把
"pmc Innovation (Camb) … 4094 theinnov 101771342" 这种串混进正文开头，已在 `stripHtml()` 里剥掉。

---

## 4. 安装

三条路，任选其一：

1. **自定义插件索引**（推荐，适合自己 fork 迭代）
   桌面端「插件 → 实验性插件 → 自定义插件索引」填：
   `https://raw.githubusercontent.com/<owner>/<repo>/main/index.json`
   或 jsDelivr 镜像 `https://cdn.jsdelivr.net/gh/<owner>/<repo>@main/index.json`（最多晚 12 小时同步）。
2. **直装包名**：插件页输入 `dsh-research-desk`。
3. **命令行**（本机 `dsh` CLI 不在 PATH，需先补 PATH）：
   ```bash
   dsh plugin --profile desktop add dsh-research-desk
   ```
   桌面 profile 必须**完全退出**再装，否则安装会静默不生效。

装完在侧栏看到「科研工作台」图标即为成功；也可让 agent 直接调 `research_desk` 工具验证。

---

## 5. 架构

```
lib/host.mjs    host 半片：注册 webServer 前缀路由 + 注册 research_desk 工具
lib/search.mjs  三源检索 + 全文抓取 + arXiv 查询构造 + HTML/JATS 清洗
lib/qa.mjs      BM25 检索、分块、模型问答、引文逐字核验
lib/desk.mjs    领域模型与唯一写路径（字段白名单、去重、操作集）
lib/store.mjs   原子落盘、mtime 重读、串行写队列、30 步 undo
lib/llm.mjs     模型路由与流式调用（block-end 聚合、sessionId 自带）
lib/client.js   侧栏面板（免构建 React.createElement）
```

**零依赖、零构建**：没有 npm 依赖，没有 JSX，没有 esbuild。
`lib/client.js` 直接是 `window.__ModuleLoader__.load({...})` 形态，由宿主模块加载器注入 `react`。

**状态文件**：`$DSH_HOME/research-desk/state.json`（Windows 上即
`C:/Users/<用户>/.dsh/research-desk/state.json`）。桌面端与 Web 端共享这一份。
写入是「临时文件 + rename」原子替换；每次写前按 mtime 重读，两个宿主进程同时跑不会互相覆盖；
撤销采用三方回滚（只回滚这一步真正改动的字段，别人之后的改动不动）。

**安全边界**：
- 侧栏只走同源 `POST /api/research-desk/`，并校验 `sec-fetch-site` 与 loopback 来源，非同源一律 403。
- 请求体上限 512 KB。
- 模型调用在会话外进行，必须自带 `sessionId`（`dsh-research-desk-<uuid>`），否则部分网关会报 `MissingSessionID`。

---

## 6. 测试

```bash
node --test test/desk.test.mjs test/search.test.mjs   # 24 个用例，全绿
node test/live-probe.mjs                              # 真实打三个上游的连通性探针
```

- `test/desk.test.mjs`（19 例）：字段白名单、去重优先级、状态枚举、证据 id 必须来自库内、
  undo 三方回滚不覆盖他人后续修改、引文核验通过/不通过、模型流失败、无命中不调模型。
- `test/search.test.mjs`（5 例）：arXiv AND/OR 词链、引号短语、词数上限、空查询通配、JATS 噪声剥离。
- `test/live-probe.mjs`：真实 HTTP 探针（search → fetchFullText → chunkText → retrieve）。
  最近一次实跑：检索 24 篇（三个源全通，`errors=[]`），arXiv 命中 HiPerRAG / HySemRAG / PaperQA / SciRAG；
  全文抓取 86,234 字符 / 99 片段 / 4.3 秒；BM25 命中 4 段（最高分 7.79）。

---

## 7. 明确的边界（不吹）

- **未在宿主内实机安装验证**：本机 `dsh` CLI 不在 PATH，只能走 GUI 插件页或自定义插件索引。
  侧栏面板是否被宿主识别为可渲染 slot，**尚未在真实宿主里验证过**——这是当前最大的未知项。
- **只覆盖摘要级选题**。选题模型的输入是标题+摘要，不是全文；因此它**不可能**发现机制层面的结论。
  这与调研报告的结论一致：AI 假说的上限就在这里。
- **没有实验执行、没有统计分析、没有版本化的可复现产物**（对应 8 层栈的 L5/L6，本插件不含）。
- **没有引文格式化器**（GB/T 7714 / APA 等）；引文是自由文本 id 标注。
- **单用户本地状态**，没有多人协作、没有冲突消解 UI（写入层做了不覆盖，但没做合并界面）。
- **检索覆盖有限**：三个源不等于全网。Google Scholar 无官方 API，Scopus / Web of Science 需付费订阅，本插件不接。

---

## 8. 与调研报告的关系

本插件是《开源科研工作台全景调研分析报告》结论的**工程化落点**，不是报告的复述：

- 报告说"生态是 8 层栈、跨层需自搭 glue code"→ 本插件把 L1/L3/L4/L7 四层里的**可做部分**连成一条闭环，
  剩下的 L2（综述）、L5（实验）、L6（可复现）、L8（评审）留给 Zotero / DVC / Overleaf / OpenReview 这类成熟件。
- 报告说"引用污染是当下最贵的坑"→ 本插件把**引文核验做成硬约束**：对不上就剔，并显式报 `unverified`。
- 报告说"L4 是最薄的一层"→ 本插件的选题动作刻意加了三道闸：只用库内摘要、必须写出能杀死它的实验、
  不许声称机制已被证明。

## 许可证

MIT（见 `LICENSE`）。
