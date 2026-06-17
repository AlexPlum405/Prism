# Prism 迁移帮助

> 面向从 Typora、妙言、MarkText 迁移到 Prism 的用户。本文只描述当前 Prism 已实现或本轮优化已完成的能力，不承诺 AI、云同步、协作、插件市场、重型知识图谱或完整 block editor。

## 迁移心智

Prism 是本地优先、Markdown-first、单活动文档窗口的桌面写作器。它更接近“打开一个文件、专注写作、完整预览、可信导出”的工作流，而不是多标签知识库、代码 IDE 或云协作平台。

外部资料只用于校准迁移心智：

- Typora 官方强调无独立预览窗口的 live preview 写作体验，并提供 Markdown、导出和主题相关能力。参考：<https://typora.io/>、<https://support.typora.io/Markdown-Reference/>、<https://support.typora.io/Export/>
- 妙言官方仓库描述为 macOS 轻量 Markdown note-taking app，并强调 local-first、split editor & preview、LaTeX、Mermaid 等能力。参考：<https://github.com/tw93/MiaoYan>
- MarkText 官方仓库描述为面向 Linux、macOS、Windows 的开源 Markdown editor。参考：<https://github.com/marktext/marktext>

Prism 不复制任何一个竞品的完整心智。迁移时先理解下面几个差异。

## 从 Typora 迁移

Typora 用户通常期待编辑和预览融合。Prism 当前采用三态视图：

| 期待 | Prism 对应能力 | 在 app 中验证 |
|---|---|---|
| 写作时直接操作 Markdown 内容 | 源码编辑是主编辑面，保留纯 Markdown 可读性 | 打开 Markdown Document，使用命令面板执行 `源码模式`，或按 `Cmd/Ctrl + /` |
| 写作时同时看结果 | 分栏模式显示编辑器和完整预览 | 命令面板执行 `分栏模式`，或点击右上视图切换 |
| 只读检查最终阅读效果 | 预览模式显示完整预览，支持 KaTeX、Mermaid、表格、代码块等 | 命令面板执行 `预览模式`，再用右键或诊断入口定位源码 |
| 常用格式快捷键 | 粗体、斜体、链接、代码块、列表、任务列表、引用等已注册为命令 | 打开 `帮助 -> 快捷键`，或在命令面板搜索 `bold`、`link`、`table`、`task` |
| 导出 PDF/HTML/图片/DOCX | Prism 支持 HTML、PDF、PNG、DOCX，并先用诊断体系暴露缺失图片、断链、Mermaid/KaTeX 错误等风险 | 命令面板搜索 `export`，或使用状态栏导出入口；有错误时查看 `ERROR n` |

需要注意：Prism 不承诺 Typora 式所见即所得编辑。Prism 的编辑面保持 Markdown 源码清晰，预览面承担完整阅读和导出基准。

## 从妙言迁移

妙言迁移用户通常关注本地文件、轻量界面、中文长文阅读和分栏预览。Prism 的对应策略是：

| 期待 | Prism 对应能力 | 在 app 中验证 |
|---|---|---|
| 本地文件为主 | Prism 直接打开和保存本地 Markdown Document；Text Document 支持常见文档/数据/配置文本 | 用打开对话框打开 `.md`、`.markdown`、`.txt`、`.sql`、`.json`、`.yaml` 等文件 |
| 分栏编辑/预览 | 三态视图中的分栏模式是主路径之一 | 命令面板执行 `分栏模式` |
| 中文长文排版 | 默认 `MiaoYan` 主题和暗色 `Nocturne` 已用排版 fixture 校准 920px 阅读列宽 | 查看 `docs/verification/prism-preview-typography-snapshots-2026-06-17/` 截图，或在 app 里切换主题后打开长文 |
| 轻量写作器气质 | Prism 保留克制浅色界面、低对比边框、紧凑工具区，但按 ADR-0006 建立跨平台一致结构 | 对比 macOS/Windows/Linux 时，主工作区结构应一致，差异只留给系统 chrome 和菜单 |
| 文档关系 | 只有当前 Markdown Document 存在出链或反链时，状态栏才显示图谱按钮 | 准备带 `[[内部链接]]` 或 Markdown 相对链接的工作区，观察状态栏图谱按钮显隐 |

需要注意：Prism 不以 macOS AppKit 拟态作为唯一审美。它保留妙言式的写作温度，但主结构、命令组织、状态反馈和导出诊断要在 macOS、Windows、Linux 都成立。

## 从 MarkText 迁移

MarkText 用户通常熟悉跨平台、开源、Markdown-first 的桌面编辑器。Prism 的迁移重点是可靠文件链路、完整预览和导出诊断：

| 期待 | Prism 对应能力 | 在 app 中验证 |
|---|---|---|
| 跨平台 Markdown 桌面应用 | Prism 基于 Tauri 2 + React + TypeScript，视觉口径按 ADR-0006 收束为跨平台写作器 | 阅读 `CONTEXT.md` 和 ADR-0006；真机外观仍需按平台补验 |
| Markdown-first | Markdown Document 拥有预览、导出、链接诊断、Mermaid、KaTeX、关系图谱语义 | 打开 `.md/.markdown` 后切换预览、执行导出、查看诊断 |
| 常见文本文件也能打开 | Text Document 支持 `.txt/.text/.sql/.json/.jsonc/.yaml/.yml/.toml/.xml/.csv/.tsv/.log/.ini/.conf/.env` | 打开这些文件，确认进入编辑模式且不显示 Markdown 预览/图谱 |
| 搜索和工作区导航 | 当前文档搜索、替换、工作区全文搜索、快速打开已注册命令 | `Cmd/Ctrl + F` 搜索当前文档；`Cmd/Ctrl + Shift + F` 搜索工作区；命令面板执行 `快速打开` |
| 导出更可信 | 导出前诊断和失败详情显示阶段、对象、原因、下一步 | 准备缺失图片或 Mermaid 错误的文档，触发导出前诊断 |

需要注意：Prism 不把常见源码文件纳入默认承诺。`.js/.ts/.py/.rs/.go/.java/.c/.cpp/.css/.html` 等不进入默认文件关联、默认工作区索引或产品定位。

## 文件类型模型

| 类型 | 扩展名 | Prism 能力 | 不承诺 |
|---|---|---|---|
| Markdown Document | `.md`、`.markdown` | 编辑、保存、自动保存、完整预览、搜索、Mermaid、KaTeX、导出、链接诊断、页面链接、反链、条件图谱 | 云同步、协作、AI 自动写作、插件市场 |
| Text Document | `.txt`、`.text`、`.sql`、`.json`、`.jsonc`、`.yaml`、`.yml`、`.toml`、`.xml`、`.csv`、`.tsv`、`.log`、`.ini`、`.conf`、`.env` | 打开、编辑、保存、另存、搜索、自动保存、工作区导航 | Markdown 预览、Mermaid/KaTeX、导出保真、Markdown 链接诊断、反链、图谱 |
| 不默认承诺 | `.js`、`.ts`、`.tsx`、`.py`、`.rs`、`.go`、`.java`、`.c`、`.cpp`、`.css`、`.html` | 后续只能作为高级“打开任意文本文件”另行评估 | 不作为代码 IDE 或默认关联范围 |

## 常用入口

| 任务 | 入口 |
|---|---|
| 新建文档 | `Cmd/Ctrl + N` |
| 打开文档 | 命令面板 `打开` 或系统打开 `.md/.markdown`、Text Document |
| 保存 | `Cmd/Ctrl + S` |
| 另存为 | 命令面板搜索 `save as` |
| 当前文档搜索 | `Cmd/Ctrl + F` |
| 工作区全文搜索 | `Cmd/Ctrl + Shift + F` |
| 替换 | `Cmd/Ctrl + H` |
| 源码模式 | `Cmd/Ctrl + /` |
| 侧栏 | `Cmd/Ctrl + Shift + L` |
| 专注模式 | `F8` |
| 打字机模式 | `F9` |
| 设置 | `Cmd/Ctrl + ,` |
| 快捷键面板 | 命令面板搜索 `shortcut` |

## 主题和导出

Prism 当前内置主题为 `MiaoYan`、`Inkstone Light`、`Slate Writer`、`Mono Draft`、`Nocturne`。主题能力由 `themeContract.ts` 约束，用户主题 CSS 也有安全校验。迁移时优先从内置主题开始，不要把 Typora 或 MarkText 的 CSS 直接当作 Prism 主题承诺。

导出当前以可信为核心：HTML、PDF、PNG、DOCX 支持完整预览路径，导出前诊断会尽量暴露缺失图片、断链、Mermaid/KaTeX 错误、标题锚点冲突和导出阶段错误。迁移用户应先用一份包含图片、表格、代码块、公式、Mermaid 的真实文档做导出 smoke，再决定默认导出设置。
