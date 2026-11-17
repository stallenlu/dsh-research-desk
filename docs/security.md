# 安全与数据边界

本文把 dsh-research-desk v0.2.0 的安全边界逐条摊开：外部命令怎么跑、路径怎么约束、包名怎么校验、超时怎么算、HTTP 入口怎么拦、密钥怎么存、导出怎么脱敏。
每一条都对应代码里的一个具体检查，不是原则性表态。

## 1. 总览

| 面 | 边界 |
| --- | --- |
| 对外请求 | 只读：检索与全文抓取都是 GET；上传与删除不存在 |
| 对外写盘 | 只有 `$DSH_HOME/research-desk/state.json` 与受限工作目录下的脚本 / 日志 |
| 外部命令 | 白名单 `python` / `node`，`shell: false`，独立工作目录，超时上限，输出截断落盘 |
| 装包 | 默认关闭；打开后只接受 `pip install` / `npm install` 形式并校验包名 |
| HTTP 入口 | 只接受 POST，同源校验，请求体 512 KB 上限 |
| 密钥 | 只存环境变量名，值调用时从环境读，不落盘、不导出 |
| 模型输出 | 视为不可信输入，一律过字段白名单 |

## 2. HTTP 入口

面板与工具之外的第三条入口是同源 HTTP 桥：`POST /api/research-desk/`。

- **方法**：非 POST 一律 `405 method not allowed`。
- **同源**：请求必须来自回环地址（对端 socket 地址是 `127.0.0.1` / `::1` / `::ffff:127.*`，或 `Host` 头是回环主机名），且 `Origin` 要么没有、要么是 `dsh-app://`、要么指向回环地址；否则 `403 origin rejected`。
- **请求体**：上限 512 KB（`MAX_BODY`），超限直接断开并返回 `payload-too-large`；JSON 解析失败返回 `invalid-json`；不是对象的 JSON 当作空对象。
- **响应**：`content-type: application/json; charset=utf-8`，`cache-control: no-store`，不带 `Access-Control-Allow-Origin`，所以浏览器侧的跨源读取拿不到数据。

## 3. 外部命令执行模型

外部命令只由 `lib/runner.mjs` 执行，模型输出不能直接拼命令行。

- **白名单**：运行时只能是 `python` 或 `node`（`RUNTIMES`），其余一律拒绝。
- **不经过 shell**：`spawn(cmd, args, { shell: false, windowsHide: true })`，`args` 永远是数组，代码里没有任何拼 shell 字符串的路径。
- **代码落盘再执行**：用户代码先写成 `run-<时间戳>.py` / `run-<时间戳>.mjs` 放进工作目录，解释器**只拿到这个文件路径**这一个参数，代码本身不作为命令行参数传递。
- **参数透传**：`cwd` 设为工作目录；环境变量额外带 `PYTHONIOENCODING=utf-8`、`PYTHONUTF8=1`、`PYTHONUNBUFFERED=1`，保证输出不乱码、不缓冲。
- **解释器探测**：顺序是设置里配置的路径 → 常见命令名（`python` / `python3` / `py -3` / `node`）→ DSH 自带运行时（`$DSH_HOME/dsh-runtimes/*/dependencies`）；每个候选跑 `--version`，2 秒内没有版本号就判定不可用。
- **取消**：宿主给的 `AbortSignal` 透传给子进程，工具被取消时进程树一起终止。
- **代码长度**：单次代码上限 200000 字符（`MAX_CODE_CHARS`）。

## 4. 路径约束

- **允许根目录**只有三个：`runner.workDir` 配置的工作目录、插件数据目录、`storage.dataDir` 配置的数据目录；三个都没配时退回默认数据目录。
- **工作目录必须落在允许根目录内**，否则直接失败：「工作目录不在允许范围内：<路径>」。
- **所有落盘路径都经过 `resolveInside(root, ...segments)`**：先 `path.resolve` 再用 `isInside()` 判断是否仍在根目录内，越界抛「路径越界：<目标>」。脚本路径、日志目录、stdout / stderr 日志文件都走这条检查。
- **默认位置**：工作目录是数据目录下的 `runs`，日志在其 `logs` 子目录里：`logs/run-<时间戳>.stdout.log` 与 `logs/run-<时间戳>.stderr.log`。
- **安装日志**同样落在工作目录的 `logs` 下：`logs/install-<时间戳>.stdout.log` 与 `.stderr.log`。

## 5. 包名校验

安装动作默认关闭（`runner.allowInstall` 为 `false`），打开后：

- **只接受两种形式**：Python 走 `<python> -m pip install <包...>`，Node 走 `node <npm-cli.js> install <包...>`。Windows 上 `npm.cmd` 必须经 shell 才能跑，所以改成用 node 直接执行 `npm-cli.js`，同样不经过 shell。
- **包名正则**：`/^[A-Za-z0-9@._-]+(\[[^\]]+\])?(==[0-9A-Za-z.*-]+)?$/`，允许官方名、作用域包（`@scope/name`）、PEP 508 extras（`pkg[extra]`）与版本锁（`pkg==1.2.3`），其余一律拒绝（「包名不合法：<名>」）。
- **必须含字母数字**：不含 `[A-Za-z0-9]` 的名字直接拒。
- **只按逗号切分**：字符串形式的包名只认逗号分隔，分号与空格不当分隔符，避免 `a;whoami` 被切成两个各自合法的名字而绕过校验。
- **数量上限**：一次最多 20 个包（`MAX_PACKAGES`）。

## 6. 超时、输出与日志

- **超时**：`runner.timeoutSec`，范围 5–600 秒，默认 60 秒；到期终止子进程并记 `timedOut: true`，错误信息为「执行超时，已终止」。
- **输出截断**：stdout / stderr 各截到 20000 字符（`MAX_OUTPUT_CHARS`），并带 `truncated` 标记说明是否被截。
- **完整日志落盘**：截断前的完整输出写进 `logs/` 下的 `.stdout.log` 与 `.stderr.log`；实验记录里保存截断后的内容，界面显示再截到 4000 字符。
- **实验记录**：每次调用都生成一条记录，含标题、运行时、代码、退出码、耗时、超时标记、stdout / stderr 摘要与关联的选题 id。

## 7. 密钥处理

- **只存名字**：`secrets.*` 三项存的是环境变量名，校验必须匹配 `^[A-Za-z_][A-Za-z0-9_]*$`。
- **调用时取值**：`resolveSecret(settings, key)` 在用的时候从 `process.env` 读当前值，因此轮换环境变量即刻生效，不需要改设置。
- **界面不显示值**：设置面板对密钥项只渲染变量名与「该环境变量已设置 / 只保存环境变量名，插件不保存密钥本身」。
- **状态文件里没有值**：`state.json` 存的就是变量名，密钥值从不落盘。
- **导出里没有值**：`toJSON()` 把 `secrets.` 开头的键替换成 `{configured: true/false}`——变量名和变量值都不导出。

## 8. 导出脱敏

- **JSON 默认不含全文**：`includeFullText` 默认为 `false`，片段只留序号与标题这类定位信息，正文留在本地库里；Markdown 与 BibTeX 同样不含全文正文。
- **密钥脱敏**：见上，`secrets.*` 一律变成 `{configured: boolean}`。
- **引文分栏**：Markdown 里的综述部分把「已核验引文」与「未通过核验的引文（已剔除）」分开列，导出件不会把被剔除的引文伪装成结论。
- **BibTeX 转义**：`{ } \ & % $ # _` 等 LaTeX 特殊字符被转义，引文键取「首作者姓 + 年份 + 标题首词」并去掉标点。

## 9. 状态文件与撤销

- **原子写入**：先写 `state.json.tmp` 再 `rename` 覆盖，中断不会留下半个文件。
- **多进程安全**：每次读都按 mtime 判断是否需要重读，桌面端与 Web 端同时跑不会互相覆盖。
- **串行写入**：`store.mutate()` 把写操作排进队列，读改写不会被两个调用方交错。
- **撤销**：保留最近 30 步（`MAX_UNDO`），回滚用三方比对，只回滚这一步真正改过的字段，别人的后续改动不动。

## 10. 模型输出当作不可信输入

模型生成的选题、草稿、综述、引文都不直接落盘：

- 所有字段先过 `lib/desk.mjs` 的字段白名单与类型表（`PAPER_FIELDS` / `HYPOTHESIS_FIELDS` / `DRAFT_FIELDS` / `EXPERIMENT_FIELDS`），不在白名单上的字段直接丢弃而不是合并。
- 引文必须逐字命中原文片段才算数，对不上的进 `unverified` 并从结论里剔除。
- 检索没有命中时**根本不发模型请求**，避免模型自由发挥。

## 11. 本插件不覆盖的方面

- 没有多用户与权限模型：状态是一份本地文件，没有账号、角色或协作冲突界面。
- 没有沙箱隔离进程：外部命令是普通子进程，靠白名单、路径约束与超时约束，而不是容器或 seccomp。
- 没有对上游数据源做内容安全审查：检索与全文抓取的内容原样入库，模型看到的也是这些内容。

需要更强隔离时，请把解释器放进你自己的容器或受限账号里运行。