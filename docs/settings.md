# 设置项参考

`dsh-research-desk` v0.3.1 一共 **22 项**设置，全部定义在 `lib/settings.mjs` 的 `SETTING_DEFS` 里。
设置面板（侧栏「设置」页签）、宿主工具 `research_desk` 的 `settings` 动作、MCP 的 `settingsView` 读的是同一份数据，改完即时生效，「恢复默认」一键还原。

## 1. 检索

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `sources` | enumList | `["arxiv","europepmc","openalex"]` | `arxiv` / `europepmc` / `openalex` | 检索时查哪些数据源。留空（空数组）就真的一个源都不检索，不会退回默认三源 |
| `maxResults` | int | `15` | 1–40 | 单个数据源最多返回多少条。超出范围会被夹回边界 |

## 2. 模型

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `model.route` | model | `""`（空） | `provider/model` | 覆盖宿主默认模型。留空就用宿主当前选中的模型；格式不含 `/` 会被判为非法 |

## 3. 问答

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `qa.limit` | int | `8` | 1–20 | 每次问答保留多少个检索命中段落 |
| `qa.minScore` | float | `0.6` | 0–1 | 命中相对阈值：保留分数不低于最高分乘该比例的段落 |
| `qa.shareFullText` | bool | `true` | 开 / 关 | 关掉后只用摘要作答与检索，不把全文片段送给模型 |

## 4. 综述

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `review.perspectives` | enumList | `["methodology","evidence","contradictions","gaps"]` | `methodology` / `evidence` / `contradictions` / `gaps` / `applications` | 默认写哪几个视角（方法学 / 证据 / 矛盾与争议 / 研究缺口 / 应用与影响） |
| `review.maxSections` | int | `4` | 1–5 | 单篇综述最多写几个视角 |

## 5. 运行（外部工具）

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `runner.enabled` | bool | `false` | 开 / 关 | 总开关。关着时所有实验命令都被拒绝，提示「没有开启外部工具调用」 |
| `runner.pythonPath` | path | `""`（空） | 解释器路径 | 指定 Python 解释器；留空则自动探测 |
| `runner.nodePath` | path | `""`（空） | 解释器路径 | 指定 Node 解释器；留空则自动探测 |
| `runner.timeoutSec` | int | `60` | 5–600 秒 | 单次外部调用的超时上限，超时即终止 |
| `runner.workDir` | path | `""`（空） | 目录路径 | 外部调用的工作目录；留空则用数据目录下的 `runs` |
| `runner.allowInstall` | bool | `false` | 开 / 关 | 是否允许在运行前装外部包。打开后只接受 `pip install` / `npm install` 形式并校验包名 |
| `runner.packages` | string | `""`（空） | 逗号分隔的包名 | 预装包名，例如 `numpy,scipy` |

## 6. 统计

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `stats.alpha` | float | `0.05` | 0.0001–0.5 | 显著性水平，用于 `stats` 动作的检验与判定 |
| `stats.adjust` | enum | `"holm"` | `none` / `holm` / `bonferroni` | 多重比较校正方法 |

## 7. 隐私

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `privacy.shareAbstracts` | bool | `true` | 开 / 关 | 关掉后，生成选题与草稿时模型只看到标题行，看不到摘要 |

## 8. 存储

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `storage.dataDir` | path | `""`（空） | 目录路径 | 数据落地目录；留空则用 `$DSH_HOME/research-desk` |

## 9. 密钥

| 键 | 类型 | 默认值 | 取值范围 | 用途 |
| --- | --- | --- | --- | --- |
| `secrets.openalexKey` | secretRef | `""`（空） | 环境变量名 | OpenAlex 密钥的环境变量名 |
| `secrets.semanticScholarKey` | secretRef | `""`（空） | 环境变量名 | Semantic Scholar 密钥的环境变量名 |
| `secrets.openalexMailto` | secretRef | `""`（空） | 环境变量名 | OpenAlex 联系邮箱的环境变量名，用于 polite pool |

## 10. 校验规则

设置面板提交后走 `coerceSettings(patch, current)`，规则是固定的：

- **未知键直接丢弃**，并在消息里报「不认识的设置项：<key>」；模型或脚本塞进来的字段进不了状态。
- **非法值保留旧值**，并报「设置没有保存：<原因>」，不会写坏状态。
- **数字按声明范围夹取**：`int` 四舍五入后夹到 `min`–`max`，`float` 夹到 `min`–`max`。
- **布尔**接受 `true` / `false` 与字符串 `"true"` / `"false"` / `"1"` / `"0"`。
- **枚举**必须在 `options` 里；**多选枚举**会去重，数组与逗号分隔字符串都接受。
- **`model` 必须含 `/`**；**`secretRef` 必须匹配 `^[A-Za-z_][A-Za-z0-9_]*$`**；**`path` 最长 500 字符**。
- 读取时 `readSettings(state)` 把已存的值覆盖到默认值上，新版本加新键不会让老状态失效；存坏的值会退回默认。

## 11. 密钥项怎么工作

三个 `secrets.*` 设置**只保存环境变量的名字**，例如 `OPENALEX_API_KEY`。

- 保存的值就是变量名本身，界面上的输入框里也是变量名。
- 真正取值发生在调用时：`resolveSecret(settings, key)` 从 `process.env` 读出当前值，返回 `{name, value, present}`。
- **密钥值从不写进 `state.json`，也不进任何导出文件**；导出时这一项被替换成 `{configured: true/false}`。
- 变量名本身在导出里也会被替换掉——`secrets.` 开头的键一律按密钥处理，宁可少输出。

当前 `secrets.openalexMailto` 会在检索时被读出来，作为 OpenAlex 请求的 `mailto` 参数；两个密钥项目前只是登记入口，检索本身不需要密钥。

完整边界见 [security.md](security.md)。