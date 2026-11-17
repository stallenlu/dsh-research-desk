# dsh-research-desk · 科研工作台

DeepSeek Harness 插件：给 agent 和研究者一个**就在侧栏里的科研工作台**——检索文献、维护阅读库、抓全文做带锚点的问答、推可证伪选题、写多视角综述、在受限目录里跑验证脚本、整库导出。
**每一条引文都回到原文逐字核对，对不上就剔除。**

- 包名 `dsh-research-desk`，版本 0.2.0，MIT，零运行时依赖，零构建步骤
- 宿主要求：DSH `>=0.2.1-rc.5 <0.3.0`，Node `>=22`
- 交付渠道：GitHub + npm + dshmarket（索引条目见 `index.json`）

---

## 1. 一句话定位与解决的问题

**一句话定位**：它把「查文献 → 精读 → 问答 → 选题 → 综述 → 验证计算 → 导出」这条科研工作流，做成 DeepSeek Harness 宿主里的一个侧栏面板加一个 agent 工具，两条入口共用同一份状态与同一套服务函数。

它解决六个问题：

| 问题 | 做法 |
| --- | --- |
| 引用核查 | 模型给的每条引文逐字回原文片段比对，对不上的进 `unverified` 并从结论里剔除；检索没命中就根本不发模型请求 |
| 锚定阅读 | `read` 把全文切块入库（默认 1100 字符、重叠 160），答案里的每条引文都能指回 chunk、标题与原文链接 |
| 多视角综述 | 五个视角（方法学 / 证据 / 矛盾与争议 / 研究缺口 / 应用与影响）各写一节，各自带核验过的引文 |
| 选题假设 | 只用库内摘要推出选题，每个选题必须写出「缺口」与「能杀死它的最便宜实验」，不许声称机制已被证明 |
| 沙箱验证计算 | 只允许 `python` / `node`，`shell: false`、独立工作目录、超时上限、stdout/stderr 截断落盘；默认关闭 |
| 导出 | 一键产出 Markdown 清单、BibTeX、JSON；JSON 默认不含全文，密钥只导出「是否已配置」 |

---

## 2. 能力清单（九个面板页）

侧栏入口叫「科研工作台」，打开后是九个页签，顶部常驻「N 篇文献 · N 条选题 · N 篇草稿」。

### 2.1 检索（search）

- **输入**：检索式，加三个数据源勾选（arXiv / Europe PMC / OpenAlex）；面板固定按单源 12 条请求。
- **输出**：结果卡片列表，每张卡带来源 / 年份 / venue / 引用数 chip、摘要、「加入文献库」按钮与原文链接。
- **限制**：三个源都免密钥；单源条数上限由设置 `maxResults` 决定（默认 15，宿主端夹在 1–40）；某个源失败不阻断整体，失败原因出现在返回的 `errors` 里；只覆盖这三个开放源，不接付费库。 把 `sources` 设为空数组就真的一个源都不检索（早期版本会把空数组当成没给、退回默认三源，已修）。

### 2.2 文献库（library）

- **输入**：检索结果「加入文献库」，以及卡片上的「抓取全文」「移出」「纳入问答」勾选。
- **输出**：文献卡片列表，带状态 chip（`new` / `reading` / `read` / `kept` / `dropped`）与片段数 chip（显示「N 段全文」或「仅摘要」）。
- **限制**：去重优先级是 DOI → arXiv id → PubMed id → 标题；只有抓过全文的文献才能支撑问答与综述；面板展示的摘要截到 1200 字、作者最多 12 位。

### 2.3 问答（ask）

- **输入**：一个问题，加上可选的「纳入问答」勾选（勾了只答这些文献，不勾就用库里全部已入库全文）。
- **输出**：答案卡片，分「已核验引文」（chunkId + 引文原文）与「剔除未通过核验的引文」计数；问答记录保留最近 200 条，面板显示最近 50 条。
- **限制**：只用已入库的全文段落作答；检索段落数由 `qa.limit` 控制（1–20，默认 8），命中阈值由 `qa.minScore` 控制（0–1，默认 0.6）；`qa.shareFullText` 关闭时只用摘要；库里没有可用段落时直接报「还没有入库全文。先对文献执行 read，再提问。」

### 2.4 选题（hypothesis）

- **输入**：点一次「从文献库生成选题」，模型看到的是库里前 40 篇的标题与摘要（每篇摘要截到 1400 字）。
- **输出**：选题卡片，每张含标题、状态、理由、缺口、以及能杀死它的实验。
- **限制**：输入只有标题和摘要，**不可能**给出机制级结论；返回的证据 id 必须来自库内，否则被过滤掉；`privacy.shareAbstracts` 关闭时模型只看到标题行。

### 2.5 综述（review）

- **输入**：主题（留空则只按视角检索词检索）加五个视角勾选，默认开方法学 / 证据 / 矛盾与争议 / 研究缺口，「应用与影响」默认关。
- **输出**：每个视角一节正文，带该节引文与未核验条数；另有「只找研究缺口」按钮，缺口单独存成一篇综述（标题后缀「· 研究缺口」）。
- **限制**：只看已入库全文；每篇最多取 2 个片段，单篇综述的视角上限由 `review.maxSections` 控制（1–5，默认 4）；某个视角没有可支撑段落时写「文献库中没有可支撑的段落。」并且不发模型请求；所有视角都撑不住时报「检索不到可支撑的段落，没有生成综述。」

### 2.6 实验（experiment）

- **输入**：实验标题、运行时（`python` / `node`）、代码。
- **输出**：运行结果卡片（退出码、耗时、标准输出、错误输出），以及实验记录列表（最近 10 条：状态、运行时、耗时、超时标记、退出码、stdout/stderr 各截到 4000 字符）。
- **限制**：必须先在设置里打开「允许调用外部工具」（`runner.enabled`），否则拒绝执行；只允许 python 与 node 两种运行时；超时由 `runner.timeoutSec` 控制（5–600 秒，默认 60）；代码只落在插件数据目录下的 `runs` 文件夹。

### 2.7 草稿（draft）

- **输入**：一句写作要求（默认「写一个结构完整的论文大纲。」）。
- **输出**：草稿卡片，含标题、引用条数与可展开正文。
- **限制**：模型输入只有标题和摘要；每条主张必须标注库内文献 id，库撑不起的段落要求写「缺什么」而不是编；正文上限 60000 字符，库视图截到 20000 字符。

### 2.8 导出（export）

- **输入**：点一次「生成导出文件」，一次产出 md / bib / json 三种格式。
- **输出**：三个可下载文件 `research-desk-library.md`、`research-desk-library.bib`、`research-desk-library.json`。
- **限制**：JSON 默认不含全文片段（只留片段序号与标题）；`secrets.*` 一律导出成 `{configured: true/false}`；Markdown 里综述部分分成「已核验引文」与「未通过核验的引文（已剔除）」两段。

### 2.9 设置（settings）

- **输入**：每条设置一张卡片（按类型给输入框或下拉），加「保存设置」与「恢复默认」两个按钮。
- **输出**：改完即时生效；非法值保留旧值并在消息里说明原因（如「设置没有保存：…」）。
- **限制**：只有 `SETTING_DEFS` 里声明过的键会被接受，未知键直接丢弃；密钥项只显示环境变量名与「该环境变量已设置 / 只保存环境变量名」。

---

## 3. 安装

三条路，任选其一。**安装前必须把桌面 profile 完全退出**（驻留中的宿主会占着插件目录，装完不生效）。装完重新打开宿主，侧栏出现「科研工作台」图标即为成功，也可以直接让 agent 调 `research_desk` 工具验证。

### 3.1 dshmarket 市场安装（推荐）

在 dshmarket 的插件市场里找到「科研工作台 / Research Desk」，一键安装。dshmarket 读取的正是精选列表 awesome-dsh-plugin 里的索引条目，版本与 npm 上的 `dsh-research-desk` 对应（当前 0.2.0）。

### 3.2 npm 规格名安装

在宿主插件页的规格名输入框填 `dsh-research-desk`；或者在终端里用 CLI（需要 `dsh` 在 PATH）：

```bash
dsh plugin --profile desktop add dsh-research-desk
```

### 3.3 自定义索引安装

把仓库里的 `index.json` 放到任意可公开访问的地址（GitHub raw 或 jsDelivr 镜像都行），然后在桌面端「插件 → 实验性插件 → 自定义插件索引」里填这个 URL：

```text
https://raw.githubusercontent.com/stallenlu/dsh-research-desk/main/index.json
https://cdn.jsdelivr.net/gh/stallenlu/dsh-research-desk@main/index.json
```

索引文件格式（format 1）：

```json
{
  "format": 1,
  "title": { "en": "Research Desk", "zh": "科研工作台" },
  "description": { "en": "...", "zh": "..." },
  "metadata": { "categories": ["research", "literature", "productivity"] },
  "plugins": [
    {
      "name": "dsh-research-desk",
      "title": { "en": "Research Desk", "zh": "科研工作台" },
      "description": { "en": "...", "zh": "..." },
      "author": "stallenlu",
      "homepage": "https://github.com/stallenlu/dsh-research-desk",
      "repository": { "url": "https://github.com/stallenlu/dsh-research-desk" },
      "metadata": { "category": "research", "keywords": ["research", "literature", "arxiv", "pubmed", "openalex", "科研", "文献"] },
      "versions": [
        {
          "version": "0.2.0",
          "publishTimestamp": "2026-11-18T01:00:00.000Z",
          "source": { "type": "npm" },
          "engines": { "dsh": ">=0.2.1-rc.5 <0.3.0" }
        }
      ]
    }
  ]
}
```

---

## 4. 设置

设置面板共 **22 项**，全部有默认值，改完即时生效，「恢复默认」一键还原。下面按用途分组。

### 检索

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `sources` | 检索数据源（`arxiv` / `europepmc` / `openalex`） | 三个全开 |
| `maxResults` | 单源最大条数（1–40） | `15` |

### 模型（跨组生效）

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `model.route` | 覆盖宿主默认模型，格式 `provider/model` | 空（用宿主默认） |

### 问答

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `qa.limit` | 问答检索保留段落数（1–20） | `8` |
| `qa.minScore` | 检索命中相对阈值（0–1） | `0.6` |
| `qa.shareFullText` | 是否把全文片段送给模型 | `true`（关掉只用摘要） |

### 综述

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `review.perspectives` | 综述视角集合（`methodology` / `evidence` / `contradictions` / `gaps` / `applications`） | 方法学 + 证据 + 矛盾 + 缺口 |
| `review.maxSections` | 单篇综述视角上限（1–5） | `4` |

### 运行（外部工具）

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `runner.enabled` | 是否允许调用外部工具 | `false`（关掉后所有实验命令都被拒绝） |
| `runner.pythonPath` | Python 解释器路径 | 空（自动探测） |
| `runner.nodePath` | Node 解释器路径 | 空（自动探测） |
| `runner.timeoutSec` | 单次调用超时秒数（5–600） | `60` |
| `runner.workDir` | 调用工作目录 | 空（用数据目录下的 `runs`） |
| `runner.allowInstall` | 是否允许安装外部包 | `false` |
| `runner.packages` | 预装包名，逗号分隔 | 空 |

### 统计

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `stats.alpha` | 显著性水平（0.0001–0.5） | `0.05` |
| `stats.adjust` | 多重比较校正（`none` / `holm` / `bonferroni`） | `holm` |

### 隐私

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `privacy.shareAbstracts` | 是否把摘要送给模型（影响选题与草稿） | `true` |

### 存储

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `storage.dataDir` | 数据落地目录 | 空（用 DSH_HOME 数据目录） |

### 密钥

| 键 | 含义 | 默认值 |
| --- | --- | --- |
| `secrets.openalexKey` | OpenAlex 密钥的环境变量名 | 空 |
| `secrets.semanticScholarKey` | Semantic Scholar 密钥的环境变量名 | 空 |
| `secrets.openalexMailto` | OpenAlex 联系邮箱的环境变量名 | 空 |

> **密钥项怎么工作**：这三个设置**只保存环境变量的名字**（例如 `OPENALEX_API_KEY`），值在调用时从环境里读取。
> 变量名本身也不会出现在导出文件里（那里只留 `{configured: true/false}`），`state.json` 里存的同样只是名字——**密钥值从不落盘、不进任何导出**。

完整的键、类型、取值范围见 [docs/settings.md](docs/settings.md)。

---

## 5. 工具调用

Agent 侧只有一个工具：`research_desk`（超时 300 秒，标记为并发安全）。全部能力靠 `action` 参数切换，共 18 个动作；返回体统一带 `ok` / `action` / `message`，多数动作还带 `count` 与最新的 `library` 视图。

| action | 作用 | 主要参数 |
| --- | --- | --- |
| `status` | 库内篇数、选题数、草稿数与当前默认模型 | — |
| `models` | 列出宿主可调用的模型 | — |
| `search` | 三源检索（免密钥） | `query`、`sources`、`maxResults` |
| `add` | 把文献放进文献库（自动去重） | `papers` |
| `library` | 列出文献库、选题、草稿、综述、实验与问答记录 | — |
| `read` | 抓全文并切成可检索片段入库 | `paperId` |
| `ask` | 只用库内全文回答，每条引文逐字核验 | `question`、`paperIds` |
| `hypothesis` | 从文献库推出可证伪选题 | — |
| `review` | 写多视角综述，逐条核验引文 | `topic`、`perspectives` |
| `gaps` | 只找研究缺口 | `topic` |
| `draft` | 写论文大纲 | `instruction` |
| `remove` | 移出一篇文献 | `paperId` |
| `undo` | 撤销上一步 | — |
| `settings` | 查看 / 修改 / 恢复默认设置 | `patch`、`reset` |
| `experiments` | 列出实验记录 | — |
| `run` | 在受限工作目录里跑 python 或 node | `title`、`runtime`、`code`、`packages`、`hypothesisId` |
| `stats` | 统计自查（t 检验、效应量、多重比较校正） | `kind`、`groupA`、`groupB`、`mu0`、`pvalues` |
| `export` | 导出 md / bib / json | `formats` |

参数取值：`sources` 是 `arxiv` / `europepmc` / `openalex`；`perspectives` 是 `methodology` / `evidence` / `contradictions` / `gaps` / `applications`；`runtime` 是 `python` / `node`；`kind` 是 `one-sample` / `two-sample-welch` / `paired`；`formats` 是 `md` / `bib` / `json`；`maxResults` 1–40（默认 12）。

已知修复：`library` 动作在文献库非空时曾因消息拼接出错而崩溃，现已修好；`sources` 设为空数组现在真的会一个源都不检索。

调用示例：

```json
{ "action": "search", "query": "retrieval augmented generation evaluation", "sources": ["arxiv", "openalex"], "maxResults": 12 }
```

```json
{ "action": "ask", "question": "这些方法在检索阶段用了什么索引结构？", "paperIds": ["<library 里这篇文献的 id>"] }
```

```json
{ "action": "run", "title": "BM25 复现", "runtime": "python", "code": "print(sum(range(10)))", "hypothesisId": "<选题 id>" }
```

---

## 6. MCP

`lib/mcp.mjs` 同时提供一个 stdio 传输的 MCP server，让别的 agent 也能用同一份文献库。

- 协议版本 `2024-11-05`，服务名 `dsh-research-desk`，版本 `0.2.0`，能力声明为 `tools`。
- stdout 只走 JSON-RPC，诊断日志走 stderr；`notifications/initialized` 不回包。
- 与桌面面板共用同一个 `state.json` 与同一套 `applyOps` 写路径，**MCP 写入的内容在面板里立刻可见**。

| 工具 | 参数 |
| --- | --- |
| `research_search` | `query`（必填）、`sources`（`arxiv`/`europepmc`/`openalex`，缺省三个都查）、`maxResults`（1–40，缺省 10） |
| `research_library_list` | `status`（`new`/`reading`/`read`/`kept`/`dropped`）、`limit`（1–200，缺省 50） |
| `research_library_add` | `papers`（必填，数组；每篇至少 `title`，可选 `abstract`/`venue`/`year`/`doi`/`arxivId`/`pmid`/`pmcid`/`url`/`source`/`authors`/`tags`/`status`/`note`） |
| `research_library_remove` | `paperId`（必填，取自 `research_library_list`） |
| `research_export` | `format`（`markdown`/`json`/`bibtex`，缺省 `markdown`）、`paperIds`（缺省导出全部） |

启动命令（包已全局安装时用 bin 名，否则直接跑入口脚本）：

```bash
dsh-research-desk-mcp
node bin/dsh-research-desk-mcp.mjs
```

包也导出了 MCP 子路径，可以直接 `import`：

```js
import { runMcpStdio } from 'dsh-research-desk/mcp'
```

挂到别的 MCP 客户端上：

```json
{
  "mcpServers": {
    "dsh-research-desk": {
      "command": "node",
      "args": ["/ABS/PATH/dsh-research-desk/bin/dsh-research-desk-mcp.mjs"]
    }
  }
}
```

数据目录默认同样是 `$DSH_HOME/research-desk`；要单独隔开就传 `dataDir`。

---

## 7. 数据与安全边界

- **数据目录**：默认 `$DSH_HOME/research-desk/state.json`（`DSH_HOME` 未设时为 `~/.dsh/research-desk/state.json`，Windows 即 `C:\Users\<用户>\.dsh\research-desk\state.json`）。`storage.dataDir` 可以改落地目录。
- **读与写**：检索与全文抓取只做对外只读请求；写入只发生在 `state.json`（临时文件 + rename 原子替换）与 `runs` 工作目录；插件没有对外删除或上传接口。
- **外部命令**：`spawn(cmd, args, { shell: false })`，参数永远是数组，不拼 shell 字符串；只允许 `python` 与 `node`；脚本写进受限工作目录，工作目录必须落在允许根目录内（`runner.workDir`、数据目录、`storage.dataDir`），否则报「工作目录不在允许范围内：…」；解释器只拿到脚本文件路径这一个参数。
- **超时与日志**：超时由 `runner.timeoutSec` 控制（5–600 秒，默认 60），到点终止；stdout / stderr 落盘到 `<workDir>/logs/<脚本名>.stdout.log` 与 `<脚本名>.stderr.log`，返回值截到 20000 字符，实验记录里保存，界面显示截到 4000 字符。
- **装包**：默认关闭（`runner.allowInstall` 为 `false`）；打开后只接受 `pip install` 与 `npm install` 两种形式，包名按 `/^[A-Za-z0-9@._-]+(\[[^\]]+\])?(==[0-9A-Za-z.*-]+)?$/` 校验，一次最多 20 个；Windows 上 npm 走 `node npm-cli.js`，同样不经过 shell。
- **HTTP 入口**：只接受 `POST /api/research-desk/`，非 POST 返回 405；同源检查要求回环地址，且 Origin 为空、是 `dsh-app://`、或指向回环地址，否则 403 `origin rejected`；请求体上限 512 KB，超限返回 `payload-too-large`。
- **密钥**：只存环境变量名，值在调用时从环境读取；`state.json` 与任何导出里都没有密钥值。

更细的边界见 [docs/security.md](docs/security.md)。

---

## 8. 引文可信性设计

四步，每一步都对应代码里的一处检查：

1. **要求逐字引用**：问答与综述的系统提示都写明「只能用检索到的段落」「逐字引用原文」「每个事实句标 `[S1]`/`[S2]` 段落标记」「缺什么就说缺什么，不许编」。
2. **逐条比对**：返回的每条引文必须在对应片段里逐字命中（`hit.text.includes(quote)`，综述侧允许空白归一后匹配）。
3. **对不上就剔除**：命中失败的引文进 `unverified` 列表并从结论里剔除，同时带上原因（`quote not present in source` / `no matching chunk` / 「引用与原文不一致」/「找不到对应段落」/「引文是空的」）；面板和工具返回都显式给出剔除条数。
4. **没命中就不调模型**：检索为空时直接回答「库里没有能回答这个问题的段落」，一次模型请求都不发；综述某个视角没有可支撑段落时写「文献库中没有可支撑的段落。」，同样不发模型请求。

结论就是：**没有命中就不是答案，是一次诚实的「没找到」**。

---

## 9. 已知限制

- **插件还没有在真实宿主会话里端到端安装验证过**：侧栏 slot 注册、工具注册、面板渲染都还是纸面推演，这是当前最大的未知项。
- **外部运行时依赖使用者自己的机器**：探测顺序是设置里的解释器路径 → 常见命令名（`python` / `python3` / `py -3` / `node`）→ DSH 自带运行时；探不到就没有执行环境。
- **综述与问答的质量取决于库里的全文覆盖**：只抓了摘要的文献不参与综述，也不参与引文核验。
- **导出的 JSON 默认不含全文片段**：只留片段序号与标题，正文留在本地库里。
- **没有多用户与权限模型**：状态是一份本地文件，没有账号、角色或协作冲突界面；撤销栈是单机的 30 步。
- **检索只覆盖三个开放源**：Google Scholar 没有官方 API，Scopus / Web of Science 需要付费订阅。
- **选题与草稿的输入只有标题和摘要**，做不了机制级结论。

---

## 10. 开发与测试

目录布局一行说明：`lib/` 是全部实现（host / search / qa / review / runner / export / desk / store / settings / stats / llm / mcp / client），`bin/` 是 MCP stdio 入口脚本，`test/` 是 `node:test` 单测与两个联网探针脚本，`docs/` 是本文档目录，`index.json` 是 dshmarket 索引条目。

Windows 上 `node --test` 必须显式给出文件路径（不能只写目录），一次跑完全部单测：

```bash
node --test test/desk.test.mjs test/export.test.mjs test/host.test.mjs test/mcp.test.mjs test/bin.test.mjs test/review.test.mjs test/runner.test.mjs test/search.test.mjs test/settings.test.mjs test/stats.test.mjs
```

共 115 个用例，当前全绿。

```bash
node test/live-probe.mjs
node test/raw-probe.mjs
```

发布流程：

1. `npm publish`（包名 `dsh-research-desk`，主入口 `lib/host.mjs`，客户端入口 `lib/client.js`）。
2. GitHub 仓库 <https://github.com/stallenlu/dsh-research-desk> 维护 README、`docs/` 与 MIT LICENSE。
3. 向 awesome-dsh-plugin 精选列表提 PR 收录本插件——dshmarket 读取的就是这份精选列表；同时在 `index.json` 里更新版本号与发布时间。

---

## 11. 许可证

MIT，见 [LICENSE](LICENSE)。