# Prism 全功能测试用例（代码梳理版）

日期：2026-06-27

本测试用例从当前源码重新梳理，不复用旧的全功能测试目录、截图清单或模板。旧目录 `docs/reviews/prism-full-feature-test-2026-06-22/` 已按要求删除。

## 目标

验证 Prism 当前代码中已经暴露的全部用户可见功能：启动与首启文档、文件与工作区、编辑器、预览渲染、Markdown 专属知识能力、导出、设置、主题、系统菜单、跨平台集成和故障恢复。

这份文档是“全功能验收用例集”，不是单元测试替代品。每条用例都必须产出可复核证据：截图、录屏、导出产物、文件系统结果、测试日志或自动化报告。

## 代码依据

核心功能面来自以下源码入口：

| 功能域 | 主要代码依据 |
|---|---|
| 启动、首启、打开文件 | `src/hooks/useBootstrap.ts`、`src/app/useStartupFileOpen.ts`、`src-tauri/src/domain/initial_documents.rs`、`src-tauri/src/commands/startup_files.rs` |
| 文件类型与文档能力边界 | `src/domains/workspace/services/fileAssociation.ts`、`src-tauri/src/domain/document_io.rs`、`src-tauri/src/domain/workspace_tree.rs`、`src-tauri/src/domain/workspace_index.rs` |
| 主菜单与命令 | `src/domains/commands/types.ts`、`src/domains/commands/menuModel.ts`、`src/domains/commands/categories/*.ts` |
| 标题栏、状态栏、窗口壳 | `src/components/shell/TitleBar.tsx`、`src/domains/workspace/components/StatusBar.tsx`、`src/components/shell/WindowShell.tsx` |
| 工作区与导航 | `src/domains/workspace/components/FileTree.tsx`、`src/domains/workspace/components/Sidebar.tsx`、`src/domains/workspace/components/OutlinePanel.tsx`、`src/domains/workspace/components/RelationGraphPanel.tsx` |
| 编辑器 | `src/domains/editor/components/EditorPane.tsx`、`src/domains/editor/components/SplitView.tsx`、`src/domains/editor/extensions/*.ts`、`src/domains/editor/runtime/*.ts` |
| 预览渲染 | `src/lib/markdownToHtml.ts`、`src/lib/markdownRenderService.ts`、`src/domains/editor/components/PreviewPane.tsx` |
| 诊断 | `src/app/useDocumentDiagnosticsModel.ts`、`src/domains/editor/extensions/linkDiagnostics.ts`、`imageDiagnostics.ts`、`headingDiagnostics.ts`、`tables.ts`、`typographyDiagnostics.ts` |
| 导出 | `src/domains/export/exportPipeline.ts`、`src/domains/export/templates.ts`、`src/domains/export/preflight.ts`、`src/domains/export/jobs/*`、`src-tauri/src/domain/export_*` |
| 设置、主题、字体 | `src/domains/settings/types.ts`、`src/components/shell/SettingsModal.tsx`、`src/domains/themes/*`、`src-tauri/src/domain/theme_store.rs` |
| 系统集成 | `src-tauri/tauri.conf.json`、`src-tauri/src/lib.rs`、`src-tauri/src/commands/*.rs`、`scripts/run-app-smoke.mjs` |

## 测试数据

在独立临时目录创建工作区，避免污染真实文档。建议目录：`/tmp/prism-full-functional-test-workspace`。

| 文件 | 内容要求 |
|---|---|
| `Examples/Prism Markdown 语法指南.md` | Prism 首启指南同名文件，覆盖标题、斜体、副标题、目录、图片、表格、代码块、KaTeX、Mermaid、PlantUML、Markmap、任务列表、脚注、引用、callout、details、wiki link、普通链接 |
| `notes/linked-note.md` | 被 `[[linked-note]]` 和 Markdown 链接引用的文档 |
| `notes/backlink-source.md` | 指向指南文档，用于反链和关系图谱 |
| `notes/broken-links.md` | 缺失文件、缺失 heading、空链接、缺失图片、错误 Mermaid、错误 KaTeX、重复 heading |
| `notes/table-heavy.md` | 多列表格、对齐、HTML 表格、可排序数据 |
| `notes/long.md` | 超长 Markdown，至少 300KB，含多段代码、表格、图片和标题 |
| `data.json` | JSON 文本，不能出现 Markdown 预览/导出/图谱入口 |
| `query.sql` | SQL 文本，能编辑保存搜索，不能出现 Markdown 专属能力 |
| `plain.txt` | 普通文本，能编辑保存搜索，不能出现 Markdown 专属能力 |
| `config.yaml`、`.env`、`sample.csv` | Text Document 白名单补充 |
| `assets/cover.png`、`assets/vector.svg` | 本地图片资源，预览与导出都能读取 |
| `unsupported.ts` | 不支持的源码文件，用于验证拒绝策略 |

## 执行规则

- macOS 当前真机必须执行 P0 和 P1；P2 跨平台项只记录真实 Windows/Linux 结果，不允许推测。
- 每条手工用例必须保存证据：截图或导出文件加备注。
- 涉及导出时必须保留导出产物，并记录格式、主题、清晰度、导出设置。
- 涉及外部链接、更新检查、Pandoc 时，记录网络/本地依赖状态。
- Prism 不应为了 PlantUML、Mermaid、Markmap 渲染联网；测试时可断网验证图表仍可渲染。
- Text Document 只验证打开、编辑、保存、搜索、工作区导航和状态栏类型；不要求 Markdown 预览、导出、链接诊断、反链和图谱。

## 通过标准

P0 全部通过才能认为当前版本可日常使用。P1 失败需要形成缺陷单。P2 失败需要标明平台和复现环境。P3 可作为质量优化 backlog。

建议记录格式：

```json
{
  "id": "PRISM-FF-001",
  "priority": "P0",
  "area": "Startup",
  "source": "src/hooks/useBootstrap.ts",
  "preconditions": [],
  "steps": [],
  "expected": "",
  "actual": "",
  "status": "Pass | Fail | Blocked",
  "evidence": "",
  "notes": ""
}
```

## P0 核心工作流

| ID | 功能域 | 代码依据 | 前置条件 | 步骤 | 预期结果 | 建议自动化 |
|---|---|---|---|---|---|---|
| PRISM-FF-001 | 首启种子文档 | `initial_documents.rs`、`useBootstrap.ts` | 清空 Prism 首启 marker，确保 app bundle 有 `Resources/Initial` | 启动 Prism | 首次启动复制 Initial 到用户文档目录下 `Prism/`，直接打开 `Examples/Prism Markdown 语法指南.md`，不显示空指引页 | Rust `initial_documents` + Playwright/app smoke |
| PRISM-FF-002 | 普通启动默认文档 | `useBootstrap.ts` | 用户文档目录已有 `/Documents/Prism/Examples/Prism Markdown 语法指南.md` | 关闭所有窗口后重新打开 Prism | 直接打开 Prism 目录和指南文档；窗口显示前不闪现空页面 | app smoke 截图 |
| PRISM-FF-003 | 新建窗口 | `openWindow.ts`、`useBootstrap.ts` | Prism 已打开 | 主菜单 `窗口 > 新建窗口` 或 `Cmd+Shift+N` | 新窗口直接打开默认 Prism 工作区指南，不带 `?empty` 或旧指引页 | `src/lib/openWindow.test.ts` + app smoke |
| PRISM-FF-004 | 系统打开文件 | `startup_files.rs`、`useStartupFileOpen.ts` | 准备 `.md/.txt/.json/.sql` 文件 | 从 Finder 双击或 `open -a Prism <file>` | 支持文档在当前/新窗口打开，路径顺序保持，Unsupported 文件不打开 | Rust `startup_files` + 手工 |
| PRISM-FF-005 | 显式 URL 打开文件 | `useBootstrap.ts` | 启动 URL 带 `?file=` | 用含空格和中文路径启动窗口 | 文件被解码并打开，工作区同步到文件所在目录 | `src/hooks/useBootstrap.test.tsx` |
| PRISM-FF-006 | 显式 URL 打开文件夹 | `useBootstrap.ts` | 启动 URL 带 `?folder=` | 打开指定目录 | 请求目录授权，加载文件树，不自动打开无关文档 | `src/hooks/useBootstrap.test.tsx` |
| PRISM-FF-007 | Markdown 文件打开 | `fileAssociation.ts`、`document_io.rs` | 准备 `.md` 和 `.markdown` | `文件 > 打开` | Markdown profile 生效，支持编辑/分栏/预览/导出/链接/图谱 | `openDocumentFlow.test.ts` |
| PRISM-FF-008 | Text Document 打开 | `fileAssociation.ts`、`document_io.rs` | 准备 `.txt/.sql/.json/.yaml/.env/.csv` | 逐个打开 | 进入源码编辑模式，状态栏显示文本类型；分栏/预览/导出/图谱不可用或不显示 | 单元 + 手工 |
| PRISM-FF-009 | 不支持文件拒绝 | `document_io.rs`、`openDocumentFlow.ts` | 准备 `unsupported.ts` | 尝试打开 | 明确提示仅支持 Markdown/Text 文档，不读入内容，不污染最近文件 | Rust + `openDocumentFlow.test.ts` |
| PRISM-FF-010 | 大文件保护 | `openDocumentFlow.ts` | 准备超过 10MB 支持文件 | 打开文件 | 弹出大文件确认；取消则不打开，确认则加载 | `src/lib/fileActions.test.ts` |
| PRISM-FF-011 | 文件 > 新建文稿 | `fileCommands.ts`、`fileActions.ts` | 当前已有工作区 | 点击 `文件 > 新建文稿` | 在当前目录创建唯一 `Untitled.md`，当前窗口打开，左上文件名可内联改名 | 单元 + 手工 |
| PRISM-FF-012 | 无工作区新建文稿 | `fileCommands.ts` | 无当前文档路径且无工作区 | 点击新建文稿 | 不打开新窗口；提示需要工作区或位置 | 手工 |
| PRISM-FF-013 | 保存与另存 | `fileCommands.ts`、`fileSafety.ts` | 打开文档并修改 | `Cmd+S`、`Cmd+Shift+S` | 标题栏显示保存中/已保存；另存后路径、最近文件、快照更新 | 单元 + 手工 |
| PRISM-FF-014 | 自动保存 | `useAutoSave.ts` | 自动保存开启 | 修改文档，等待间隔 | 内容写入磁盘，保存状态恢复，失败显示标题栏错误 | `useAutoSave.test.tsx` |
| PRISM-FF-015 | 外部修改冲突 | `fileSafety.ts`、`SaveConflictModal.tsx` | 文档打开后从外部修改磁盘文件 | 在 Prism 保存 | 出现冲突状态和冲突弹窗；不会覆盖外部内容，用户可选择处理 | 单元 + 手工 |
| PRISM-FF-016 | 恢复快照 | `recovery.ts`、`RecoveryModal.tsx` | 制造未保存恢复快照 | 启动或触发恢复 | 恢复弹窗列出文档，可恢复/丢弃；恢复后内容一致 | `App.recovery.test.tsx` |
| PRISM-FF-017 | 标题栏文件名 | `TitleBar.tsx` | 打开保存文档 | 查看标题栏、点击文件名改名 | 显示无 `.md` 后缀、无 `- Prism` 后缀、无 P 图标；可内联重命名 | `TitleBar.test.tsx` |
| PRISM-FF-018 | 标题栏保存状态 | `TitleBar.tsx` | 打开文档 | 修改、保存失败、制造冲突 | dirty/saving/failed/conflict 均以标题旁 badge 表达且不抖动 | `TitleBar.test.tsx` |
| PRISM-FF-019 | 视图模式 | `viewCommands.ts`、`SplitView.tsx` | 打开 Markdown | 切换源码、分栏、预览 | 三种模式切换正确；Text Document 强制源码模式 | `SplitView.test.tsx` |
| PRISM-FF-020 | 编辑搜索 | `SearchPanel.tsx`、`editorSearchRuntime.ts` | 文档含多个关键词 | `Cmd+F` 搜索，跳转上一/下一项 | 命中计数、高亮、滚动和无结果态准确 | `SearchPanel.test.tsx` |
| PRISM-FF-021 | 替换 | `SearchPanel.tsx`、`SplitView.tsx` | 文档含多个关键词 | `Cmd+H`，单次替换和全部替换 | 预览模式触发替换时切到 split；替换范围准确 | `SearchPanel.test.tsx` |
| PRISM-FF-022 | 预览搜索 | `SplitView.tsx` | 预览模式文档 | 搜索预览文本 | 预览区域高亮命中，当前命中可滚动到中间 | `SplitView.test.tsx` |
| PRISM-FF-023 | 分栏滚动同步 | `SplitView.tsx`、`previewScrollMap.ts` | 长 Markdown | 编辑区/预览区分别滚动 | 分栏模式滚动比例同步；源码行到预览块映射稳定 | 单元 + 手工 |
| PRISM-FF-024 | 预览任务勾选 | `SplitView.tsx`、`markdownToHtml.ts` | Markdown 含 `- [ ]` | 在预览模式点击 checkbox | Markdown 源码对应行切换 `[ ]/[x]`；编辑态 checkbox 不替代预览态交互 | `SplitView.test.tsx` |
| PRISM-FF-025 | 基础编辑命令 | `editorCommands.ts` | 打开文档 | 撤销、重做、剪切、复制、粘贴、粘贴纯文本、全选 | CodeMirror 内容和剪贴板行为正确 | `EditorPane.integration.test.tsx` |
| PRISM-FF-026 | 复制为多格式 | `richCopy.ts`、`editorCommands.ts` | 选中文本 | 执行复制为 Plain/Markdown/HTML | 剪贴板内容与选区语义一致 | 单元 + 手工 |
| PRISM-FF-027 | 行内格式 | `formatting.ts`、`SelectionFloatingToolbar.tsx` | 选中文本 | 加粗、斜体、下划线、删除线、行内代码、链接、高亮、引用 | Markdown 标记正确，预览一致 | `formatting.test.ts` |
| PRISM-FF-028 | 块格式 | `editorBlockCommands.ts` | 文档含段落 | 段落、H1-H6、升降标题、引用、有序/无序/任务列表、代码块、数学块、分割线、脚注、TOC、YAML | 插入/转换后的 Markdown 可读可预览 | 单元 + 手工 |
| PRISM-FF-029 | 段落和章节操作 | `blockOperations.ts` | 文档含多段多标题 | 上移/下移/复制/删除段落，复制/移动章节，折叠当前标题 | 范围准确，不破坏其他内容 | `blockOperations.test.ts` |
| PRISM-FF-030 | 编辑区右键菜单 | `contextMenu.ts`、`ContextMenu.tsx` | 有/无选区、表格内/外 | 右键编辑区 | 菜单项启用态合理；Esc 关闭；选区时有链接入口；表格内有表格子菜单 | `ContextMenu.test.tsx` |
| PRISM-FF-031 | Slash 片段 | `slashSnippets.ts` | Markdown 编辑区 | 输入 `/time`、`/table`、`/img`、`/video`、`/markmap`、`/mermaid`、`/plantuml`、`/fold`、`/task` 后 Tab | 插入对应标准 Markdown/HTML 片段，选区光标位置正确 | `slashSnippets.test.ts` |
| PRISM-FF-032 | 模板插入 | `templates.ts`、`fileCommands.ts` | 有当前文档和无当前文档两种 | 插入 README、PRD、会议纪要、周报、技术方案、公众号长文、论文草稿、读书笔记、研究摘要、白皮书 | 无文档时创建模板文档；有文档时插入到当前光标；占位符解析 | `templates.test.ts` |
| PRISM-FF-033 | 图片插入/粘贴 | `imagePaste.ts`、`EditorPane.tsx` | 有本地图片 | 插入图片、粘贴图片 | 图片保存到资产路径或插入路径，预览能显示 | 单元 + 手工 |
| PRISM-FF-034 | Wiki 链接补全 | `linkCompletion.ts` | 工作区有多个 Markdown | 输入 `[[` 和关键词 | 候选来自工作区索引/回退树，选择后插入正确链接 | `linkCompletion.test.ts` |
| PRISM-FF-035 | 表格插入 | `TableInsertPopover.tsx`、`tables.ts` | 打开 Markdown | 打开表格 popover，hover 网格，输入行列，对齐 | 插入表格尺寸、表头、对齐正确 | `tables.test.ts` + 手工 |
| PRISM-FF-036 | 表格工具栏 | `TableFloatingToolbar.tsx`、`useEditorTableModel.ts` | 光标在表格内 | 插入/删除/移动行列，左右中对齐，格式化，选中表格 | 源码表格结构正确，工具栏位置稳定 | 单元 + 手工 |
| PRISM-FF-037 | 表格复制/转换/排序 | `tables.ts` | 表格含多行数据 | 复制 Markdown/HTML/CSV/TSV，升序/降序排序，Markdown/HTML 转换 | 剪贴板和源码结果准确 | `tables.test.ts` |
| PRISM-FF-038 | Markdown 基础预览 | `markdownToHtml.ts`、`PreviewPane.tsx` | 指南文档 | 切到预览 | 标题、段落、列表、引用、链接、图片、表格、代码、脚注、任务列表按主题渲染 | `markdownToHtml.test.ts` + 截图 |
| PRISM-FF-039 | Front Matter 预览 | `frontMatterProperties.ts`、`markdownToHtml.ts` | 文档含合法 YAML | 预览顶部元信息 | title/tags/description/author/date/status/export 展示正确，源码行映射保留 | 单元 + 手工 |
| PRISM-FF-040 | 非法 Front Matter | `DocumentPropertiesPanel.tsx`、`markdownToHtml.ts` | 文档含非法 YAML | 打开属性面板和预览 | 属性面板禁用应用；预览显示可读错误，不计入无关错误 | 单元 + 手工 |
| PRISM-FF-041 | KaTeX | `PreviewPane.tsx`、`markdownToHtml.ts` | 文档含行内、块级公式和错误公式 | 预览和导出 | 正确公式渲染清晰；错误公式有定位和可读错误 | `markdownToHtml.test.ts` |
| PRISM-FF-042 | Mermaid | `PreviewPane.tsx`、`exportPipeline.ts` | 文档含流程图、关系图、mindmap 等 Mermaid | 预览、HTML/PDF/PNG/DOCX 导出 | 预览和导出节点完整，主题一致，无空白图和裁切 | 单元 + 手工导出 |
| PRISM-FF-043 | PlantUML 离线渲染 | `plantUml.ts`、`exportPipeline.ts` | 断网，文档含 PlantUML/puml | 预览和导出 | 不请求在线服务；SVG 渲染完整；PNG/PDF/DOCX 不少节点不裁切 | `plantUml.test.ts` + 断网手工 |
| PRISM-FF-044 | Markmap | `markmap.ts`、`PreviewPane.tsx`、`exportPipeline.ts` | 文档含 `markmap` 和 Markdown-outline mindmap | 预览和导出 | 思维导图完整渲染，颜色随主题，导出不退化成源码 | `markmap.test.ts` |
| PRISM-FF-045 | 本地媒体预览 | `PreviewPane.tsx` | 文档引用 png/svg/gif/webp | 预览 | 相对路径按文档目录解析，object URL 缓存更新，缺失图片显示合理占位 | 单元 + 手工 |
| PRISM-FF-046 | 安全 HTML | `markdownToHtml.ts` | 文档含 `script`、危险 href、事件属性 | 预览 | 危险标签/属性被剔除，普通 HTML/details 保留 | `markdownToHtml.test.ts` |
| PRISM-FF-047 | 大文档预览性能 | `PreviewPane.performance.test.tsx`、`markdownRenderService.ts` | 打开 300KB+ 长文档 | 滚动、搜索、切换视图 | 不白屏；Worker/降级路径不丢核心内容；长表格走轻量路径 | 性能测试 + 手工 |
| PRISM-FF-048 | 演示模式 | `presentation.ts`、`PresentationOverlay.tsx` | 文档含 slide 分隔语法 | 执行演示模式 | 有 slides 时打开演示层；无 slides 时 toast 提示 | `presentation.test.ts` |
| PRISM-FF-049 | 链接诊断 | `linkDiagnostics.ts`、`DocumentDiagnosticsPanel.tsx` | 文档含断链、空链接、缺失 heading | 查看状态栏 ERROR 并点击 | ERROR 计数准确；弹窗分组显示；点击跳到源码行 | 单元 + 手工 |
| PRISM-FF-050 | 图片诊断 | `imageDiagnostics.ts` | 文档含缺失图片 | 查看 ERROR | 缺失本地图片计入 actionable error，点击定位 | 单元 + 手工 |
| PRISM-FF-051 | Heading/Table/Render 诊断 | `headingDiagnostics.ts`、`tables.ts`、`preflight.ts` | 文档含重复 heading、坏表格、坏图表/公式 | 查看 ERROR 与导出 preflight | 分类、数量、位置正确；导出前阻断真正错误 | 单元 + 手工 |
| PRISM-FF-052 | Typography 诊断 | `typographyDiagnostics.ts` | 文档含中文排版问题 | 点击排版诊断入口 | 排版建议只在用户打开时展示，不默认计入 ERROR | 单元 + 手工 |
| PRISM-FF-053 | 文档属性面板 | `DocumentPropertiesPanel.tsx` | Markdown 文档 | 打开属性，修改字段，应用 | YAML Front Matter 写回顶部，内容其他部分不变 | 单元 + 手工 |
| PRISM-FF-054 | 当前链接面板 | `DocumentLinksPanel.tsx` | Markdown 有 Markdown/wiki/outbound 链接 | 打开当前链接 | 出链列表准确，可跳转内部文档；外部链接不当作图谱关系 | 单元 + 手工 |
| PRISM-FF-055 | 反链面板 | `BacklinksPanel.tsx`、`workspace_index.rs` | 工作区文档互相链接 | 打开被引用文档并查看反链 | 反链来源、片段、点击跳转准确 | Rust + 手工 |
| PRISM-FF-056 | 关系图谱条件按钮 | `StatusBar.tsx`、`workspaceIndexQuery.ts` | 有链接关系和无链接关系文档各一份 | 分别打开 | 有文档关系时状态栏显示图谱按钮；无关系或 Text Document 不显示 | 单元 + 手工 |
| PRISM-FF-057 | 关系图谱面板 | `RelationGraphPanel.tsx` | 工作区有 1-2 跳链接网络 | 打开图谱，切 current/workspace，深度 1/2，搜索，hover，拖拽，双击节点 | 节点/边完整，当前文档高亮；双击打开目标文档 | 单元 + 手工 |
| PRISM-FF-058 | 大纲 | `OutlinePanel.tsx` | 文档有/无标题 | 切换大纲，搜索标题，点击标题 | 层级、空态、无结果态、跳转都正确 | `OutlinePanel.test.tsx` |
| PRISM-FF-059 | 快速打开 | `CommandPalette.tsx`、`workspaceIndexQuery.ts` | 工作区有多文件和最近文件 | `Cmd+P` 搜文件名/标题/路径 | 排名合理；回车打开；索引/native/fallback 状态清楚 | `CommandPalette.test.tsx` |
| PRISM-FF-060 | 全文搜索 | `CommandPalette.tsx`、`workspace_index.rs` | 工作区有可搜索内容 | `Cmd+Shift+F` 搜标题/正文/heading | 结果显示文件名、匹配类型、片段；无索引时有说明 | Rust + React 测试 |
| PRISM-FF-061 | 文件树基础 | `FileTree.tsx` | 打开工作区 | 展开/折叠、选中文件、active 态 | 层级、缩进、预览摘要、选中态稳定 | `FileTree.test.tsx` |
| PRISM-FF-062 | 文件树视图与排序 | `FileTree.tsx`、`fileTree.ts` | 工作区含不同大小/时间文件 | 切树/列表，按名称/修改/创建/大小排序 | 顺序变化可见；列表显示 folder label | 单元 + 手工 |
| PRISM-FF-063 | 文件树上下文菜单 | `fileTreeContextMenu.ts`、`fileActions.ts` | 文件、文件夹、空白区分别右键 | 执行打开、新窗口、新建、重命名、复制、删除、复制路径、显示位置、刷新 | 文件系统和 UI 同步；删除先进入废纸篓，失败才二次确认永久删除 | 单元 + 手工 |
| PRISM-FF-064 | 侧栏/状态栏 | `Sidebar.tsx`、`StatusBar.tsx` | 打开文档 | 切文件/大纲 tab，隐藏/显示侧栏，隐藏/显示状态栏 | 主区域重排正确；状态栏无重叠 | 手工 + CSS 测试 |
| PRISM-FF-065 | 写作统计 | `writingStats.ts`、`StatusBar.tsx` | 有正文和选区 | 查看状态栏、选中文本 | 字数、行列、选区统计准确，数字本地化 | 单元 + 手工 |
| PRISM-FF-066 | 专注模式 | `workspace/store.ts` | 打开文档 | 点击状态栏专注按钮或 F8 | 侧栏和状态栏收起/恢复，编辑连续性不丢 | 手工 |
| PRISM-FF-067 | 打字机模式 | `typewriter.ts` | 长文档 | 开启 F9 后输入和滚动 | 光标保持在可视区域合理位置 | 单元 + 手工 |
| PRISM-FF-068 | 行号/自动换行 | `editorAppearanceRuntime.ts`、`SettingsModal.tsx` | 打开写作设置 | 切换显示行号和自动换行 | CodeMirror 扩展热更新，布局稳定 | `editorAppearanceRuntime.test.ts` |
| PRISM-FF-069 | 导出菜单启用态 | `menuModel.ts`、`exportCommands.ts` | Markdown 与 Text Document 各一份 | 展开导出菜单 | Markdown 可导出 PDF/Word/HTML/PNG；Text Document 导出禁用并显示原因 | 单元 + 手工 |
| PRISM-FF-070 | 导出 preflight | `preflight.ts`、`exportCommands.ts` | 文档含 actionable errors | 尝试导出 | 打开诊断面板并阻断导出；错误修复后可导出 | 单元 + 手工 |
| PRISM-FF-071 | HTML 导出 | `exportPipeline.ts` | 指南文档 | 导出 HTML，打开产物 | 主题内联可选；本地图片、KaTeX、Mermaid、PlantUML、Markmap、链接、TOC 保真 | 集成 + 手工 |
| PRISM-FF-072 | PDF 导出 | `exportPipeline.ts`、`pdf_capture.rs` | 指南文档 | 导出 PDF | 分页不切半文字；页眉页脚/页码/边距/纸张生效；图表完整 | 手工 + PDF 渲染检查 |
| PRISM-FF-073 | PNG 导出 | `exportPipeline.ts` | 长指南文档，清晰度 1x/2x/4x | 导出 PNG | 按用户选择清晰度导出；超大画布走分片，不强制降级；PlantUML 不裁切 | 手工 + 像素尺寸检查 |
| PRISM-FF-074 | DOCX 导出 | `exportPipeline.ts` | 指南文档 | 导出 DOCX，用 WPS/Word 打开 | 可打开；标题、表格、图片、公式、图表、列表、脚注、callout 语义尽量保真 | 手工 + unzip 检查 |
| PRISM-FF-075 | 导出历史 | `exportCommands.ts`、`settings/types.ts` | 已完成一次导出 | 使用覆盖上次导出/按上次设置导出 | 无历史时禁用；有历史时输出路径和设置复用正确 | 单元 + 手工 |
| PRISM-FF-076 | 导出任务状态 | `exportJob.ts`、`useExportTaskUi.tsx` | 执行导出 | 观察状态栏和 toast | 导出中、成功、取消、失败状态和打开/显示位置动作正确 | 单元 + 手工 |
| PRISM-FF-077 | 导出设置 | `SettingsModal.tsx`、`useExportSettingsModel.ts` | 打开设置 > 导出 | 修改默认格式、PNG 清晰度、HTML 主题、PDF 纸张/边距/页码/页眉页脚、模板、目录、默认位置、DOCX 字体策略 | 设置持久化并影响下一次导出 | 单元 + 手工 |
| PRISM-FF-078 | Front Matter 覆盖导出 | `frontMatter.ts`、`templates.ts` | 文档 Front Matter 含 `export` 设置 | 开启覆盖并导出 | title/author/date/template/paper/margin/toc 等覆盖符合 schema | `templates.test.ts` |
| PRISM-FF-079 | 引用/Pandoc | `pandoc.rs`、`citations.ts`、`exportPipeline.ts` | 配置 bibliography/csl/Pandoc | 检测 Pandoc，导出含 citekey 文档 | Pandoc 可用时渲染引用；不可用时有明确警告，不无声失败 | Rust + 手工 |
| PRISM-FF-080 | 设置通用 | `SettingsModal.tsx`、`settings/types.ts` | 打开设置 | 修改语言、界面明暗、默认视图、快捷键风格 | 设置立即生效并持久化 | 单元 + 手工 |
| PRISM-FF-081 | 设置写作 | `SettingsModal.tsx` | 打开设置 > 写作 | 修改字体、字号、行高、自动保存、策略、行号、自动换行 | 编辑器热更新；保存后重启仍保留 | 单元 + 手工 |
| PRISM-FF-082 | 设置外观/主题 | `themes/*`、`theme_store.rs` | 打开设置 > 外观 | 切 6 个内置主题，导入/应用/删除用户主题，导入无效主题 | 主题可切换；无效主题禁用或报错；删除有确认 | 单元 + 手工 |
| PRISM-FF-083 | 设置字体 | `fontService.ts` | 准备 ttf/otf/woff/woff2 | 导入字体，应用到编辑器/预览/DOCX | 字体列表和渲染生效，删除后回退合理 | 手工 |
| PRISM-FF-084 | 设置文件 | `settings/types.ts`、`SettingsModal.tsx` | 最近文件不为空 | 修改恢复会话、最近文件数量、清空最近文件 | 最近文件列表和恢复行为符合设置 | 单元 + 手工 |
| PRISM-FF-085 | 主菜单完整性 | `menuModel.ts` | 打开 app | 逐个展开 文件/编辑/插入/格式/导航/视图/导出/窗口/帮助 | 菜单项、分隔线、快捷键、勾选态、禁用原因符合当前文档状态 | `menuModel` 单元 + 截图 |
| PRISM-FF-086 | 命令快捷键 | `registry.ts`、`platform.ts` | macOS/Windows 风格各一次 | 执行主快捷键 | 平台显示和触发匹配；冲突命令不误触 | `platform.test.ts` |
| PRISM-FF-087 | 快捷键面板 | `ShortcutPanel.tsx` | 打开帮助 > 快捷键 | 查看分类和滚动 | 文件/编辑/插入/格式/视图/窗口/帮助快捷键完整可读 | 手工 |
| PRISM-FF-088 | 关于与更新 | `AboutModal.tsx`、`updateService.ts` | 打开帮助 > 关于/检查更新 | 点击检查更新 | 显示版本、品牌信息；检查中、最新、不可用、可更新、失败状态清楚 | 单元 + 手工 |

## P1 完整功能与边界

| ID | 功能域 | 代码依据 | 前置条件 | 步骤 | 预期结果 | 建议自动化 |
|---|---|---|---|---|---|---|
| PRISM-FF-089 | 最近文件 | `recentFiles.ts`、`menuModel.ts` | 打开超过 10 个文件 | 展开打开最近，清空最近文件 | 只显示设置限制数量，排序按 lastOpened | 单元 + 手工 |
| PRISM-FF-090 | 当前文档重复打开 | `openDocumentFlow.ts` | 当前文档已打开 | 从文件树再次打开同一路径 | 不触发 dirty guard，不重复窗口，工作区刷新合理 | 单元 |
| PRISM-FF-091 | 菜单打开已有文档时新窗口策略 | `openDocumentFlow.ts` | 当前窗口已有文档 | `文件 > 打开` 选择另一个文件 | 因 entry prefers new window，新文件进新窗口，当前窗口不丢内容 | 单元 + 手工 |
| PRISM-FF-092 | 工作区导航 dirty guard | `openDocumentFlow.ts` | 当前文档未保存 | 点击文件树其他文件 | 弹出保存/另存/丢弃/取消，按选择执行 | 单元 + 手工 |
| PRISM-FF-093 | 打开文件同步工作区 | `fileActions.ts` | 当前工作区不含目标文件 | Finder 打开外部文件 | 左侧工作区切到文件所在目录或刷新当前树 | 单元 |
| PRISM-FF-094 | 文件夹授权失败 | `fileSystemScope.ts` | 模拟授权拒绝 | 打开文件夹 | 有错误提示，不留下半加载状态 | 手工 |
| PRISM-FF-095 | 文件属性信息 | `fileActions.ts` | 文件树文件/目录 | 执行属性/信息动作（如菜单暴露） | 显示名称、路径、类型、大小、时间 | 手工 |
| PRISM-FF-096 | 删除当前打开文件 | `fileActions.ts` | 当前文档在工作区 | 从文件树删除该文件 | 删除后当前文档关闭，文件树刷新 | 单元 + 手工 |
| PRISM-FF-097 | 重命名当前文件夹 | `fileActions.ts` | 当前文档在被重命名目录下 | 重命名父文件夹 | 当前文档路径同步更新，保存仍写到新位置 | 单元 + 手工 |
| PRISM-FF-098 | 文件树复制文件 | `fileActions.ts` | 文件树有文件 | 复制文件 | 新文件名唯一，内容一致，工作区刷新 | 单元 |
| PRISM-FF-099 | 文件树新建文件夹 | `fileActions.ts` | 工作区打开 | 新建文件夹并内联改名 | 文件夹创建、树模式展开、非法名提示 | 单元 + 手工 |
| PRISM-FF-100 | 状态栏工作区 hover 操作 | `StatusBar.tsx` | 侧栏显示 | hover 状态栏左侧工作区区域 | 新建文件、工作区菜单、树/列表切换按钮显示/隐藏正确 | 手工 |
| PRISM-FF-101 | 主题内容排版质量 | `src/styles/global.css`、`themeContract.ts` | 指南文档 | 切换 miaoyan/inkstone/slate/mono/nocturne/carbon | 编辑/预览正文颜色、字体、代码、表格、公式、图表都有主题差异且可读 | CSS 测试 + 截图 |
| PRISM-FF-102 | 暗黑主题 | `themeContract.ts` | 系统或 app 暗色 | 切 nocturne/carbon 并预览 | 背景接近黑色或深色，正文/代码/图表对比度合格 | CSS 测试 + 截图 |
| PRISM-FF-103 | 用户主题包扫描 | `theme_store.rs` | 准备有效/无效主题包 | 导入并重启 | 有效主题进入列表，无效主题带错误原因 | Rust + 手工 |
| PRISM-FF-104 | 主题目录打开 | `theme_store.rs` | 设置外观 | 点击打开主题目录 | 系统文件管理器打开主题目录 | 手工 |
| PRISM-FF-105 | 自托管字体 | `src/assets/fonts/README.md` | 离线环境 | 打开 app 并切主题 | UI/内容字体不依赖远程资源 | 手工 |
| PRISM-FF-106 | CodeMirror 主题 | `editorAppearanceRuntime.ts`、`markdownHighlight.ts` | 6 个主题 | 查看编辑态 Markdown token、代码块、数学、图表源码 | token 颜色与主题契约一致，无漏色 | CSS/截图 |
| PRISM-FF-107 | 编辑器横向滚动条 | `HorizontalScrollbar.tsx` | 关闭 word wrap，长行 | 编辑与预览区域横向滚动 | 滚动条同步且不遮挡状态栏 | 单元 + 手工 |
| PRISM-FF-108 | 行内 Markdown 装饰 | `markdownHighlight.ts` | 文档含粗体、链接、图片、数学、代码 | 编辑态查看 | 装饰不改变源码字符，不把 `[]` 误显示成 checkbox | 单元 + 截图 |
| PRISM-FF-109 | Callout 选择器 | `CalloutPickerPopover.tsx` | 光标在正文 | 插入 callout，选择 note/tip/warning/important | 插入标准 blockquote callout，预览样式正确 | 手工 |
| PRISM-FF-110 | Selection callout | `calloutSnippets.ts` | 选中多行文本 | 转为 note/warning/tip/important | 选区行全部被正确包装 | 单元 |
| PRISM-FF-111 | Markdown 列表编辑 | `markdownLists.ts` | 多级列表 | 回车、缩进、取消任务项 | 列表延续、缩进和 checkbox 状态正确 | 单元 |
| PRISM-FF-112 | 图片诊断异步更新 | `imageDiagnostics.ts` | 修改图片路径从缺失到存在 | 观察 ERROR | 诊断异步消失，不需要重启 | 手工 |
| PRISM-FF-113 | 渲染错误 action | `PreviewPane.tsx` | 错误 KaTeX/Mermaid | 点击错误中的定位/查看源码动作 | 跳到对应源码行 | 手工 |
| PRISM-FF-114 | Wiki 链接点击 | `PreviewPane.tsx`、`useDocumentNavigationModel.ts` | 预览中含 wiki link | 点击 wiki link | 内部文档打开；找不到时 toast 提示 | 单元 + 手工 |
| PRISM-FF-115 | Markdown 普通链接点击 | `PreviewPane.tsx` | 预览含相对 `.md` 链接、外链、锚点 | 点击 | 内部文档走 Prism 打开；外链走系统浏览器；不支持协议被拦截 | 单元 + 手工 |
| PRISM-FF-116 | 预览源码 flash | `SplitView.tsx` | 分栏模式 | 点击预览块定位源码 | 编辑区跳转并短暂高亮源码区域 | 手工 |
| PRISM-FF-117 | 文档索引增量 | `workspace_index.rs`、`useWorkspaceIndexModel.tsx` | 工作区有多文档 | 修改当前文档和磁盘文件 | 索引增量更新，搜索/反链/图谱读到最新内容 | Rust + 手工 |
| PRISM-FF-118 | 索引任务取消 | `workspace_index_job.rs` | 大工作区 | 快速切换工作区 | 旧任务取消，新任务完成，不读错 root | Rust |
| PRISM-FF-119 | 工作区搜索 native 回退 | `CommandPalette.tsx` | 模拟 native command 不可用 | 搜索文件/正文 | 回退 TypeScript 查询，UI 标明状态，不崩溃 | 单元 |
| PRISM-FF-120 | 图谱 native 回退 | `RelationGraphPanel.tsx` | 模拟 native graph 查询失败 | 打开图谱 | 使用 TS fallback，节点一致 | 单元 |
| PRISM-FF-121 | 关系图谱交互 | `RelationGraphPanel.tsx` | 多节点图谱 | 单击、长按拖拽、hover、搜索无结果 | 聚焦、拖拽、空态和物理布局稳定 | 手工 |
| PRISM-FF-122 | PDF 链接注释 | `pdfLinks.ts`、`exportPipeline.ts` | 文档含外链 | 导出 PDF 并点击链接 | 外链可点；内部锚点不生成危险链接 | 单元 + PDF 检查 |
| PRISM-FF-123 | 导出本地资源解析 | `export_resources.rs`、`assets.ts` | 图片含相对路径、绝对路径、file URL、query/hash | 导出 | 路径解析正确；外部资源策略可解释 | Rust + 单元 |
| PRISM-FF-124 | PNG 分片边界 | `exportPipeline.ts` | 超宽 PlantUML 或超长文档 | 4x PNG 导出 | 分片拼接后无横向/纵向裁切、无白缝 | 手工 + 像素检查 |
| PRISM-FF-125 | PDF 分页避切 | `exportPipeline.ts` | 文档含长段落、标题、表格、图表 | 导出 PDF | 文字不被上下两页切半；图表尽量整体分页 | 手工 |
| PRISM-FF-126 | DOCX 图片 fallback | `exportPipeline.ts` | SVG/PNG/JPG/GIF/WebP 图片 | 导出 DOCX | Word/WPS 可显示；不支持格式有可读 fallback | 手工 |
| PRISM-FF-127 | DOCX 表格宽度 | `exportPipeline.ts` | 宽表格 | 导出 DOCX | 表格宽度铺满内容宽度，不局促；列宽合理 | 手工 |
| PRISM-FF-128 | DOCX 公式 | `exportPipeline.ts` | 行内/块级公式 | 导出 DOCX | 公式以图片或兼容形式显示，不出现乱码方框 | 手工 |
| PRISM-FF-129 | HTML 导出自包含 | `exportPipeline.ts` | `htmlIncludeTheme=true` | 导出 HTML 后离线打开 | CSS、图片、图表样式仍可用 | 手工 |
| PRISM-FF-130 | 导出失败诊断 | `diagnostics.ts` | 制造不可写输出路径或超限 | 导出 | 诊断包含时间、格式、阶段、文档、输出、设置、Pandoc、错误和下一步 | 单元 + 手工 |
| PRISM-FF-131 | 导出取消 | `exportCommands.ts` | 打开保存面板 | 取消导出 | 状态栏显示取消后恢复，无失败误报 | 单元 + 手工 |
| PRISM-FF-132 | 导出打开产物动作 | `exportCommands.ts` | 导出成功 | 点击打开/显示位置 | 优先系统 native 打开，失败回退 opener，失败有 toast | 单元 |
| PRISM-FF-133 | 后台导出状态 | `useExportTaskUi.tsx` | 导出时切窗口或后台 | 观察状态栏 | 仅有任务时显示导出中；成功短暂展示；失败保留可点详情 | 单元 + 手工 |
| PRISM-FF-134 | 设置迁移/旧配置 | `settings_store.rs`、`commands/settings.rs` | 准备旧设置文件 | 启动 | 能读取/迁移或兼容旧设置，不覆盖新设置 | Rust |
| PRISM-FF-135 | 设置持久化错误 | `settings_store.rs` | 模拟 app data 不可写 | 修改设置 | 错误可见，不导致 UI 崩溃 | 手工 |
| PRISM-FF-136 | 三语 i18n | `domains/i18n` | 切中文/英文/日文/自动 | 遍历主菜单、设置、导出、诊断 | 无 missing key，布局不溢出 | 单元 + 截图 |
| PRISM-FF-137 | Toast 行为 | `Toast.tsx`、`useAppToast.tsx` | 触发成功/警告/错误 toast | 点击 action、等待自动关闭 | action 执行、可选择不关闭、计时清理 | 单元 |
| PRISM-FF-138 | Error Boundary | `AppErrorBoundary.tsx` | 注入渲染异常 | 打开 app | 显示可读错误边界，不白屏 | 手工/测试 |
| PRISM-FF-139 | DevTools | `registry.ts` | debug/dev build | `Shift+F12` | 可切 DevTools；不可用时 toast | 手工 |
| PRISM-FF-140 | 窗口最小化/全屏/置顶 | `windowCommands.ts` | 桌面 app | 执行窗口命令 | 状态同步，菜单 checked 正确 | 手工 |
| PRISM-FF-141 | macOS close/hide/reopen | `src-tauri/src/lib.rs` | macOS | 关闭主窗口、Dock reopen、打开文件事件 | 关闭隐藏而非退出；reopen 显示主窗口 | 手工 |
| PRISM-FF-142 | 打印 | `fileCommands.ts` | 打开 Markdown | 执行打印 | 调出系统打印，不改变文档 | 手工 |
| PRISM-FF-143 | 帮助外链 | `registry.ts` | 网络可用或离线 | Markdown 参考、迁移指南、GitHub、反馈 | 在线打开对应 URL；离线失败不影响 app | 手工 |
| PRISM-FF-144 | 更新检查异常 | `updateService.ts` | 离线或 updater 不可用 | 检查更新 | 显示不可用/失败原因，不无限 loading | 单元 + 手工 |

## P2 跨平台和系统集成

| ID | 平台 | 功能域 | 代码依据 | 步骤 | 预期结果 |
|---|---|---|---|---|---|
| PRISM-FF-145 | macOS | Bundle 身份 | `tauri.conf.json` | `plutil -p /Applications/Prism.app/Contents/Info.plist` | `CFBundleIdentifier` 为 `com.prism.editor.v1`，文档类型含 `.md/.markdown` 和文档图标 |
| PRISM-FF-146 | macOS | Finder 图标 | `scripts/generate-document-icons.mjs`、`patch-macos-document-icons.mjs` | 设置 Prism 为 `.md` 默认打开方式，重启 Finder | 所有 `.md` 显示 Prism 文档图标，不是空白图标 |
| PRISM-FF-147 | macOS | 文件关联 | `tauri.conf.json`、`startup_files.rs` | 双击 `.md/.markdown/.txt/.json/.sql` | 支持类型由 Prism 打开；若系统只注册 Markdown，Text Document 通过 Open With 验证 |
| PRISM-FF-148 | macOS | 沙盒授权 | `file_scope.rs` | 首次打开工作区和外部文件 | 授权流程出现一次，后续同目录可读写 |
| PRISM-FF-149 | macOS | PDF capture | `pdf_capture.rs` | 导出 PDF | 平台能力检测正确，失败时回退或报错可读 |
| PRISM-FF-150 | Windows | 标题栏布局 | `TitleBar.tsx` | Windows 真机打开 | 视图切换、文件名、窗口按钮不重叠 |
| PRISM-FF-151 | Windows | 文件关联 | `tauri.conf.json` | 安装后双击 `.md/.markdown` | 由 Prism 打开，标题栏和工作区路径正确 |
| PRISM-FF-152 | Windows | 路径处理 | `path.ts`、`export_resources.rs` | 打开含空格、中文、盘符路径文档 | 预览图片、导出资源、链接解析正确 |
| PRISM-FF-153 | Windows | 导出 | `exportPipeline.ts` | 导出 HTML/PDF/PNG/DOCX | 产物可打开，路径和字体 fallback 正常 |
| PRISM-FF-154 | Linux | 标题栏布局 | `TitleBar.tsx` | Linux 真机打开 | 窗口控件、标题、视图切换协调 |
| PRISM-FF-155 | Linux | 文件关联 | `tauri.conf.json` | 安装后打开 `.md/.markdown` | Prism 打开文件，MIME/desktop integration 正常 |
| PRISM-FF-156 | Linux | 导出 | `exportPipeline.ts` | 导出 HTML/PDF/PNG/DOCX | 产物可打开，系统字体 fallback 可读 |
| PRISM-FF-157 | 全平台 | 离线渲染 | `PreviewPane.tsx`、`exportPipeline.ts` | 断网打开含图表文档并导出 | Mermaid/PlantUML/Markmap 不因断网失败；帮助/更新外链可失败但不影响编辑 |
| PRISM-FF-158 | 全平台 | 窄窗口 | CSS/布局 | 1024x768、窄宽、低高度 | 标题栏、状态栏、浮层、设置、导出菜单无严重重叠 |
| PRISM-FF-159 | 全平台 | 高 DPI | CSS/导出 | Retina/高缩放显示器 | 编辑/预览/图表清晰；PNG 1x/2x/4x 尺寸符合选择 |
| PRISM-FF-160 | 全平台 | 系统字体 | `themeContract.ts`、字体资源 | 中英日混排、emoji、代码 | 无豆腐块；emoji 不额外生成方框；代码等宽可读 |

## P3 质量、兼容性和长期稳定

| ID | 功能域 | 代码依据 | 步骤 | 预期结果 |
|---|---|---|---|---|
| PRISM-FF-161 | 性能日志 | `PreviewPane.tsx` | 设置 `localStorage.prism.previewPerf=1` 后打开长文档 | 控制台输出 render/katex/mermaid 性能，不影响 UI |
| PRISM-FF-162 | Worker 降级 | `markdownRenderService.ts` | 禁用 Worker 或模拟 Worker error | 主线程 fallback 正确，结果一致 |
| PRISM-FF-163 | 内存释放 | `PreviewPane.tsx` | 连续打开含大量图片文档 | object URL 和缓存有上限，不持续增长 |
| PRISM-FF-164 | 导出大图内存 | `exportPipeline.ts` | 连续 4x PNG 导出长文档 | 分片 canvas 释放，失败不残留状态 |
| PRISM-FF-165 | 超大工作区 | `workspace_index.rs` | 1000+ 文档工作区 | 索引进度、取消、搜索响应可接受 |
| PRISM-FF-166 | 无障碍基础 | Shell/Editor/Settings | 键盘访问菜单、弹窗、表格 popover、设置 | 焦点顺序、Esc、aria label 基本可用 |
| PRISM-FF-167 | 减少动画 | `global.css` | 系统开启 reduced motion | 浮层、toast、状态反馈不做过度动画 |
| PRISM-FF-168 | 打包 smoke | `scripts/run-app-smoke.mjs` | 执行 app bundle smoke | 启动、bundle id、默认文档、基础 UI 验证通过 |

## 建议验证命令

文档变更只需：

```bash
git diff --check
```

全功能回归建议分层执行：

```bash
npm test -- --run src/hooks/useBootstrap.test.tsx src/lib/openWindow.test.ts src/lib/openDocumentFlow.test.ts src/domains/commands/registry.test.ts src/domains/commands/categories/fileCommands.test.ts
npm test -- --run src/components/shell/TitleBar.test.tsx src/components/shell/CommandPalette.test.tsx src/components/shell/ContextMenu.test.tsx src/components/shell/SettingsModal.test.tsx
npm test -- --run src/domains/editor/components/SplitView.test.tsx src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/SearchPanel.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx
npm test -- --run src/domains/editor/extensions/formatting.test.ts src/domains/editor/extensions/slashSnippets.test.ts src/domains/editor/extensions/tables.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/editor/extensions/imageDiagnostics.test.ts
npm test -- --run src/lib/markdownToHtml.test.ts src/lib/markdownRenderService.test.ts src/domains/editor/components/plantUml.test.ts src/domains/editor/components/markmap.test.ts
npm test -- --run src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/preflight.test.ts src/domains/export/templates.test.ts src/hooks/useExportTaskUi.test.tsx
(
  cd src-tauri
  cargo test initial_documents startup_files document_io workspace_tree workspace_index workspace_index_job export_job export_resources settings_store theme_store pdf_capture
  cargo fmt --check
)
npm run build
```

打包后手工 smoke：

```bash
npm run tauri:build:app-smoke
plutil -p /Applications/Prism.app/Contents/Info.plist | rg 'CFBundleIdentifier|CFBundleName|CFBundleDocumentTypes|UTExportedTypeDeclarations'
osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'
```

## 交付证据目录建议

执行本测试集时新建目录，不复用任何旧证据：

```text
docs/verification/runs/prism-full-functional-YYYY-MM-DD/
  manifest.json
  test-report.md
  issues.md
  screenshots/
  exports/
  logs/
```

`manifest.json` 条目必须和截图/导出证据一一对应。P2 的 Windows/Linux 项如果没有真机，状态写 `Blocked: no device`，不能用 macOS 结果代替。
