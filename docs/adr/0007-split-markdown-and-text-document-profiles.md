# 区分 Markdown Document 与 Text Document

2026-06-17：Prism 支持常见文档、数据和配置类 UTF-8 文本文件，但仍保持 Markdown-first 写作器定位。为避免文件类型能力自然扩散成通用代码 IDE，Prism 将文档分为 Markdown Document 与 Text Document 两类产品语义。

## Decision

Markdown Document 是核心文档类型，拥有源码编辑、完整预览、链接诊断、Mermaid/KaTeX、导出保真、页面链接、反向链接和轻量关系图谱语义。

Text Document 是兼容文档类型，覆盖 `.txt`、`.text`、`.sql`、`.json`、`.jsonc`、`.yaml`、`.yml`、`.toml`、`.xml`、`.csv`、`.tsv`、`.log`、`.ini`、`.conf`、`.env` 等文档、数据和配置类文本文件。它拥有打开、编辑、保存、另存、搜索、自动保存、恢复快照和工作区导航语义，但默认不承诺 Markdown 预览、Markdown 链接诊断、Mermaid/KaTeX 渲染、导出保真或关系图谱语义。

常见编程语言源码（例如 `.js`、`.ts`、`.tsx`、`.py`、`.rs`、`.go`、`.java`、`.c`、`.cpp`、`.css`、`.html`）不进入默认文件关联、默认工作区索引或产品承诺。后续若支持，只能作为“打开任意文本文件”的高级能力，而不是把 Prism 扩展成代码 IDE。

## Consequences

- 文件关联、启动参数、打开对话框、拖拽、最近文件、工作区索引、快速打开和全文搜索必须共享同一套 Document Profile 判断。
- Text Document 可以参与基础编辑与搜索，但不能默认触发 Markdown 专属预览、导出、页面链接、反链和关系图谱入口。
- 新增文本类型支持时必须先判断它属于文档/数据/配置文本，还是会把 Prism 的产品承诺推向代码 IDE。
