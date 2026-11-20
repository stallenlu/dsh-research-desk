# 架构说明

本文说明 dsh-research-desk v0.3.3 的数据流、模块职责、状态文件形状与扩展点。

## 1. 数据流

```
侧栏面板  lib/client.js（免构建，React.createElement，window.__ModuleLoader__.load）
   │  POST /api/research-desk/   同源检查 + 512 KB 请求体上限
   ▼
宿主半片  lib/host.mjs  apply(ctx)
   ├── ctx.webServer.register({ kind: "prefix", path: "/api/research-desk/" }) → handle()
   └── ctx.tools.register({ name: "research_desk" })                        → execute(args, exec)
                    │
                    ▼  （两条入口共用同一份服务函数，不会走偏）
          createService(ctx).run(args, signal)   —— 按 action 分派
                    │
   ┌────────────────┼─────────────────┬──────────────────┬─────────────────┐
   ▼                ▼                 ▼                  ▼                 ▼
 search.mjs      qa.mjs           review.mjs          runner.mjs         export.mjs
 三源检索        BM25 检索        五视角综述          python/node       md / bib / json
 + 全文抓取      + 引文核验       + 引文核验          + 统计自查        + 去标识
   │                │                 │                  │                 │
   └────────────────┴────────┬────────┴──────────────────┴─────────────────┘
                             ▼
                    lib/desk.mjs  applyOps()   —— 唯一写路径，字段白名单
                             ▼
                    lib/store.mjs  Store.mutate() —— 原子落盘 + 30 步撤销
                             ▼
              $DSH_HOME/research-desk/state.json

MCP 旁路：lib/mcp.mjs  runMcpStdio() → createMcpServer() → 同一个 Store + 同一个 applyOps
           → 同一份 state.json（MCP 写入在面板里立刻可见）
```

三条入口的性质：

- **面板**：`lib/client.js` 通过 `ctx.webServer` 暴露的前缀路由 `/api/research-desk/` 调用服务，前端只认这一个 POST 入口。
- **工具**：`ctx.tools.register({ name: "research_desk" })`，超时 300 秒，`isConcurrencySafe` 为真，把 `exec.signal` 透传给服务以支持取消。
- **MCP**：`lib/mcp.mjs` 的 `runMcpStdio()` 从 stdin 读每行 JSON-RPC，只把响应写 stdout，诊断信息写 stderr。
  可执行入口是 `bin/dsh-research-desk-mcp.mjs`（`package.json` 的 `bin` 与 `exports["./mcp"]` 都指向它）。

## 2. 模块职责

| 文件 | 职责 | 关键导出 |
| --- | --- | --- |
| `lib/host.mjs` | 宿主半片：注册工具与 HTTP 前缀路由；承载全部 18 个 action 的服务函数 | `name`、`inject`、`apply`、`createService` |
| `lib/client.js` | 侧栏面板：九个页签的免构建 React 实现，请求同源桥 | `window.__ModuleLoader__.load` 注册 |
| `lib/search.mjs` | arXiv / Europe PMC / OpenAlex 三源检索、arXiv 查询构造、HTML/JATS 清洗、全文抓取 | `search`、`fetchFullText`、`SOURCES` |
| `lib/qa.mjs` | 全文分块、BM25 检索、带引文核验的问答 | `chunkText`、`retrieve`、`ask` |
| `lib/review.mjs` | 五个综述视角的检索与生成、逐条引文核验 | `PERSPECTIVES`、`generateReview`、`perspectiveKeys` |
| `lib/runner.mjs` | 外部运行时探测、受限目录内跑代码、装包 | `runCode`、`installPackages`、`RUNTIMES`、`workDirFor` |
| `lib/export.mjs` | Markdown / BibTeX / JSON / Typst / LaTeX 五种导出与去标识 | `citeKey`、`toMarkdown`、`toBibTeX`、`toJSON`、`toTypst`、`toLatex`、`exportBundle` |
| `lib/desk.mjs` | 领域模型与唯一写路径：字段白名单、去重、操作集 | `applyOps`、`emptyState`、`migrateState`、`paperKey` |
| `lib/store.mjs` | 原子落盘、mtime 重读、串行写队列、撤销栈 | `Store`、`dshHome`、`revertChange` |
| `lib/settings.mjs` | 22 条设置定义、类型校验、密钥解析 | `SETTING_DEFS`、`coerceSettings`、`readSettings`、`resolveSecret` |
| `lib/stats.mjs` | 纯 JS 统计自查：t 检验、效应量、置信区间、多重比较校正 | `oneSampleT`、`twoSampleWelch`、`pairedT`、`adjustPvalues` |
| `lib/llm.mjs` | 模型路由与流式调用 | `listModels`、`defaultRoute`、`streamText` |
| `bin/dsh-research-desk-mcp.mjs` | MCP 可执行入口：`package.json` 的 `bin` 条目 `dsh-research-desk-mcp` 指向它，`exports` 另有 `./mcp` 子路径 | `runMcpStdio()` |
| `lib/mcp.mjs` | MCP stdio server 与 5 个工具 | `MCP_TOOLS`、`createMcpServer`、`runMcpStdio` |
| `lib/util.mjs` | 文本、列表、编号、URL 等清洗工具 | `cleanText`、`cleanList`、`toNumber`、`isHttpUrl` |

## 3. 状态文件形状

文件位置：`$DSH_HOME/research-desk/state.json`（`DSH_HOME` 未设时为 `~/.dsh/research-desk/state.json`）。写入方式是「临时文件 + rename」原子替换，每次写前按 mtime 重读，因此桌面端与 Web 端两个宿主进程同时跑不会互相覆盖。

```json
{
  "version": 1,
  "papers": [
    {
      "id": "p_...",
      "key": "doi:10.1234/abcd",
      "title": "...",
      "abstract": "...",
      "venue": "...",
      "year": 2026,
      "doi": "...",
      "arxivId": "...",
      "pmid": "...",
      "pmcid": "...",
      "url": "https://...",
      "source": "arxiv",
      "authors": ["..."],
      "tags": ["..."],
      "status": "new",
      "citedBy": 12,
      "note": "",
      "notes": [{ "id": "n_...", "at": "ISO", "text": "..." }],
      "addedAt": "ISO",
      "fulltextKind": "fulltext",
      "fulltextUrl": "https://...",
      "chunks": [{ "index": 0, "heading": "...", "text": "..." }]
    }
  ],
  "questions": [],
  "hypotheses": [
    { "id": "h_...", "title": "...", "rationale": "...", "gap": "...", "experiment": "...", "evidence": ["p_..."], "status": "draft", "at": "ISO" }
  ],
  "drafts": [
    { "id": "d_...", "title": "...", "body": "...", "refs": ["p_..."], "at": "ISO" }
  ],
  "reviews": [
    {
      "id": "r_...",
      "topic": "...",
      "sections": [
        {
          "key": "methodology",
          "label": "方法学",
          "text": "...",
          "citations": [{ "chunkId": "...", "quote": "...", "paperId": "p_...", "title": "...", "heading": "..." }],
          "unverified": [{ "chunkId": "...", "quote": "...", "reason": "引用与原文不一致" }]
          "hits": []
        }
      ],
      "stats": { "sections": 4, "citationCount": 12, "unverifiedCount": 1, "paperCount": 3 },
      "at": "ISO"
    }
  ],
  "experiments": [
    { "id": "e_...", "title": "...", "runtime": "python", "code": "...", "hypothesisId": "h_...", "status": "done", "exitCode": 0, "stdout": "...", "stderr": "...", "durationMs": 812, "timedOut": false, "at": "ISO" }
  ],
  "chat": [
    { "q": "...", "a": "...", "at": "ISO", "verified": 3 }
  ],
  "settings": { "sources": ["arxiv", "europepmc", "openalex"], "maxResults": 15, "...": "共 22 项" },
  "updatedAt": "ISO"
}
```

字段说明：

- `papers[].key` 是去重键，优先级 DOI → arXiv id → PubMed id → 标题（`paperKey()`）。
- `papers[].chunks` 只有抓过全文的文献才有；`fulltextKind` 取值 `fulltext`（PMC）/ `html`（arXiv HTML）/ `web`（经生态 web_fetch 抓取落地页）/ `abstract`（降级到摘要）。优先级 PMC → arXiv HTML → web_fetch → 摘要；web 来源 chunk 文本前置不可信数据边界标记。
- `reviews[].sections[].citations` 是通过核验的引文，`unverified` 是被剔除的引文及其原因。
- `experiments[]` 是每次外部调用的记录：命令内容、退出码、耗时、超时标记、stdout / stderr 摘要。
- `chat` 保留最近 200 条；`questions` 是历史字段，恒为空数组。
- `settings` 存的是 22 条设置的值，其中 `secrets.*` 存的是环境变量名而不是密钥值。

写入路径只有一条：`store.mutate(label, fn)` → `applyOps(state, ops)`。所有写操作先过字段白名单（`PAPER_FIELDS` / `HYPOTHESIS_FIELDS` / `DRAFT_FIELDS` / `EXPERIMENT_FIELDS`），不在白名单上的字段一律丢弃。撤销栈保留 30 步，回滚用三方比对（`revertChange`），只回滚这一步真正改过的字段，别人之后的改动不受影响。

## 4. 扩展点

| 想加什么 | 改哪里 |
| --- | --- |
| 新的宿主动作 | `lib/host.mjs` 的 `ACTIONS` 数组 → `PARAMETERS` 加参数 → `createService()` 里加服务方法 → `run()` 的 `switch` 加分支 → `lib/client.js` 加页签或按钮 |
| 新的 MCP 工具 | `lib/mcp.mjs` 的 `MCP_TOOLS` 加 schema → `HANDLERS` 映射到实现；`test/mcp.test.mjs` 断言工具数量与 `additionalProperties:false` |
| 新的设置项 | `lib/settings.mjs` 的 `SETTING_DEFS` 加一条（`key` / `label` / `type` / `default` / 可选 `min`·`max`·`options`·`help`）。面板、校验、默认值合并、导出脱敏会自动跟上 |
| 新的检索数据源 | `lib/search.mjs` 的 `SOURCES` 与对应查询函数；再把 `settings.mjs` 里 `sources` 的 `options` 同步上 |
| 新的综述视角 | `lib/review.mjs` 的 `PERSPECTIVES`（`label` + `query` + `instruction`）；再把 `review.perspectives` 的 `options` 同步上 |
| 新的导出格式 | `lib/export.mjs` 增加转换函数并在 `exportBundle()` 里加文件条目；再把 `host.mjs` 的 `formats` 枚举（现为 `md`/`bib`/`json`/`typst`/`latex`，见 `exportData()` 的 `lib/host.mjs:1304`）同步上 |
| 换存储位置 | `lib/store.mjs` 的 `Store(root, createState)` 构造参数；`host.mjs` 用 `new Store(undefined, migrateState)`，`lib/mcp.mjs` 用 `createMcpServer({ dataDir })` |
| 换模型路由 | `lib/llm.mjs` 的 `defaultRoute()` / `streamText()`；设置项 `model.route` 会在 `host.mjs` 的 `routeFor()` 里解析成 `provider/model` |

开发时注意两条不变式：

1. **模型输出是不可信输入**。凡是模型生成的字段都要经过 `applyOps()` 的字段白名单与类型表，不在表里的字段直接丢弃而不是合并。
2. **两条入口共用一套服务函数**。面板、工具、MCP 都调 `createService()` 里的同一批方法，UI 与 agent 不可能走偏。