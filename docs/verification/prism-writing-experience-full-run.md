# Prism 写作体验 12 阶段全量优化验证记录

> 启动日期：2026-05-19  
> 目标：按 `CONTEXT.md` 已确认的 12 阶段顺序，增量完成 Prism 本地写作体验优化。  
> 主视觉：当前妙言风格（Miaoyan-style）。

## 基线

- `197655b`：确认妙言风格优化计划。
- 验证：`git diff --check` 通过。
- 推送：已推送 `origin/main`。

## 阶段 1：状态栏降噪

改动范围：

- `src/domains/workspace/components/StatusBar.tsx`
- `src/domains/workspace/components/StatusBar.module.css`
- `src/domains/workspace/components/StatusBar.test.tsx`

实现结果：

- 底部状态栏不再显示 `已保存` / `未保存` / `保存中`。
- 底部状态栏不再显示 `META` / `LINK n` / `BACKLINK n` / `TYPO n`。
- 中间统计压缩为 `字数 · 行:列`，选区状态为 `选区 n 字 · 行:列`。
- 可处理诊断聚合为右侧 `ERROR n`。
- 保留现有专注模式按钮与导出按钮。
- 保留后台导出状态 `导出中` 入口。

验证：

- `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx`：7 项通过。
- `npm test -- --run`：69 个测试文件、415 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改前端状态栏呈现与测试，不涉及 Tauri capabilities、安装器、签名、公证、updater 或 file association。

## 阶段 2：命令面板整理

改动范围：

- `src/domains/commands/types.ts`
- `src/domains/commands/registry.ts`
- `src/domains/commands/registry.test.ts`
- `src/App.tsx`
- `src/domains/workspace/services/documentLinks.ts`
- `src/domains/workspace/services/documentLinks.test.ts`
- `src/domains/workspace/services/index.ts`
- `src/domains/workspace/components/DocumentLinksPanel.tsx`
- `src/domains/workspace/components/DocumentLinksPanel.test.tsx`
- `src/styles/global.css`

实现结果：

- 命令面板新增 `打开文档属性`、`查看当前文档链接`、`查看反向链接`、`查看关系图谱`。
- `打开文档属性` 打开现有 Front Matter 属性面板。
- `查看反向链接` 打开现有反向链接面板。
- `查看当前文档链接` 打开新增轻量文档链接面板，列出当前文档 Markdown/wiki 链接并可点击跳转。
- `查看关系图谱` 先接入命令入口，阶段 8 替换为正式轻量关系图谱。
- `META` / `LINK` / `BACKLINK` 已从状态栏移除，入口进入命令面板。

验证：

- `npm test -- --run src/domains/commands/registry.test.ts src/domains/workspace/services/documentLinks.test.ts src/domains/workspace/components/DocumentLinksPanel.test.tsx src/components/shell/CommandPalette.test.tsx`：4 个测试文件、32 项测试通过。
- `npm test -- --run`：70 个测试文件、419 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改命令面板、React 弹层与 TypeScript 服务，不涉及发布、签名、公证、updater 或安装器。

### 2026-05-19 命令面板默认态降噪

改动范围：

- `src/components/shell/CommandPalette.tsx`
- `src/components/shell/CommandPalette.test.tsx`
- `src/styles/global.css`

实现结果：

- 命令面板 `commands` 模式默认保留完整功能发现：顶部展示最近使用 / 推荐动作，下方按文件、编辑、插入、格式、视图、主题、窗口、帮助分组展示所有剩余命令。
- 搜索框输入后仍搜索全量命令并按匹配度排序，低频能力如关系图谱、主题、帮助等既可浏览，也可搜索。
- 命令结果按轻量分组展示，分组标题带数量，保持当前妙言风格的小标题、紧凑行高和低对比 hover。
- 执行过的命令会进入本地最近使用，下一次打开命令面板时优先展示。
- `Cmd+P` 快速打开与 `Cmd+Shift+F` 全文搜索继续使用独立模式，不并回命令面板默认列表。

验证：

- `npm test -- --run src/components/shell/CommandPalette.test.tsx`：通过。
- `npm test -- --run src/components/shell/CommandPalette.test.tsx src/domains/commands/registry.test.ts`：2 个测试文件、29 项测试通过。
- `npm test -- --run`：74 个测试文件、441 项测试通过。
- `npm run build`：通过，仅有既有 Vite large chunk warning。
- `npm run tauri:build:app-smoke`：通过，已生成并重启本地 `Prism.app`。
- `git diff --check`：通过。

跳过项：

- 本次只改 React 命令面板呈现、CSS 和组件测试，不涉及命令执行、文件系统、导出、Tauri capabilities 或发布链路，未跑发布级 DMG / 签名 / 公证 smoke。

## 阶段 3：斜杠菜单

改动范围：

- `src/domains/editor/extensions/slashMenu.ts`
- `src/domains/editor/extensions/slashMenu.test.ts`
- `src/domains/editor/components/EditorPane.integration.test.tsx`
- `src/styles/global.css`

实现结果：

- 斜杠菜单补齐 `标题`、`分割线`、`图片`、`链接`。
- Callout 补齐 `IMPORTANT` 类型。
- 保留已有表格、Mermaid、KaTeX、代码块、Toggle、导出设置块、模板插入。
- 所有插入内容仍是标准 Markdown / HTML 片段。
- CodeMirror completion 浮层补充妙言主题样式，保持轻量低对比。

验证：

- `npm test -- --run src/domains/editor/extensions/slashMenu.test.ts src/domains/editor/components/EditorPane.integration.test.tsx`：2 个测试文件、22 项测试通过。
- `npm test -- --run`：70 个测试文件、419 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改编辑器 completion 源与前端样式，不涉及 Tauri capabilities、发布、签名、公证或安装器。

## 阶段 4：Callout / Toggle 渲染与导出

改动范围：

- `src/domains/editor/extensions/callouts.ts`
- `src/domains/editor/extensions/callouts.test.ts`
- `src/lib/markdownToHtml.test.ts`
- `src/domains/export/exportPipeline.ts`
- `src/domains/export/exportPipeline.test.ts`
- `src/styles/global.css`

实现结果：

- Callout 解析补齐 `IMPORTANT`，与 `NOTE` / `TIP` / `WARNING` 保持同一 Markdown 源码语法。
- 预览 HTML 会输出 `.prism-callout--important`、`data-callout-kind="important"` 和标题元数据，不泄漏 `[!IMPORTANT]` marker。
- DOCX 导出识别 `IMPORTANT` Callout，输出标题和正文，不泄漏源 marker。
- Toggle 继续使用 `<details><summary>...</summary>...</details>`，DOCX 维持“折叠：标题 + 展开正文”的兼容兜底。
- 预览和导出打印样式把 Callout / Toggle 作为尽量不分页拆分的块处理。

验证：

- `npm test -- --run src/domains/editor/extensions/callouts.test.ts src/lib/markdownToHtml.test.ts src/domains/export/exportPipeline.test.ts`：3 个测试文件、77 项测试通过。
- `npm test -- --run`：70 个测试文件、420 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改 Markdown 解析、前端样式和 DOCX 映射，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 5：工作区索引

改动范围：

- `src/domains/workspace/services/workspaceIndex.ts`
- `src/domains/workspace/services/workspaceIndex.test.ts`
- `src/domains/workspace/services/index.ts`

实现结果：

- 新增可复用工作区索引服务，输入现有 `fileTree`、已读取 Markdown 内容和 `recentFiles`。
- 索引覆盖 Markdown 文件、相对路径、标题、Front Matter、正文标题、文档链接、已解析目标、反向链接和最近文档。
- 索引只收录 Prism 支持的 Markdown / Markdown-like 文件，不把图片等资源混入文档结果。
- 新增轻量搜索函数，支持空查询返回最近文档，以及按标题、文件名、路径、标题节点、正文内容排序命中。
- 当前阶段只落服务层与测试，供阶段 6-8 的快速打开、全文搜索、`[[` 链接、反链与关系图谱复用，不新增常驻 UI。

验证：

- `npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/documentLinks.test.ts src/domains/workspace/services/backlinks.test.ts src/domains/workspace/services/fileTree.test.ts`：4 个测试文件、14 项测试通过。
- `npm test -- --run`：71 个测试文件、422 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只新增纯 TypeScript 工作区索引服务和单元测试，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 6：快速打开 / 全文搜索 / 最近文档

改动范围：

- `src/App.tsx`
- `src/components/shell/CommandPalette.tsx`
- `src/components/shell/CommandPalette.test.tsx`
- `src/domains/commands/types.ts`
- `src/domains/commands/registry.ts`
- `src/domains/commands/registry.test.ts`
- `src/domains/workspace/services/workspaceIndex.ts`
- `src/domains/workspace/services/workspaceIndex.test.ts`
- `src/domains/workspace/services/index.ts`
- `src/styles/global.css`

实现结果：

- App 层开始异步读取当前工作区 Markdown 内容并构建工作区索引，当前打开文档的未保存内容会覆盖索引中的磁盘版本。
- `Cmd+P` 快速打开继续使用命令面板文件模式，但优先走工作区索引，支持按文件名、Front Matter 标题、路径和标题节点匹配。
- 新增 `Cmd+Shift+F` / `全文搜索工作区` 命令，打开命令面板搜索模式，支持当前工作区 Markdown 的标题、文件名、路径、标题节点和正文内容搜索。
- 空查询保留最近文档优先显示，随后展示工作区内最近修改的 Markdown 文件。
- 命令面板列表增加长路径 / 正文片段的省略处理，避免破坏当前妙言风格弹层布局。
- 不引入 IDE 级 search/replace；替换仍保持当前文档内查找/替换能力。

验证：

- `npm test -- --run src/components/shell/CommandPalette.test.tsx src/domains/commands/registry.test.ts src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/fileTree.test.ts`：4 个测试文件、34 项测试通过。
- `npm test -- --run src/components/shell/CommandPalette.test.tsx src/domains/commands/registry.test.ts src/domains/workspace/services/workspaceIndex.test.ts`：3 个测试文件、29 项测试通过。
- `npm test -- --run`：71 个测试文件、424 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改前端命令、React 弹层和 TypeScript 索引服务，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 7：`[[` 页面链接与反链

改动范围：

- `src/App.tsx`
- `src/domains/document/components/DocumentView.tsx`
- `src/domains/editor/components/SplitView.tsx`
- `src/domains/editor/components/EditorPane.tsx`
- `src/domains/editor/components/EditorPane.integration.test.tsx`
- `src/domains/editor/extensions/linkCompletion.ts`
- `src/domains/editor/extensions/linkCompletion.test.ts`
- `src/domains/workspace/services/documentLinks.ts`
- `src/domains/workspace/services/documentLinks.test.ts`
- `src/domains/workspace/services/workspaceIndex.ts`
- `src/domains/workspace/services/workspaceIndex.test.ts`
- `src/domains/workspace/services/index.ts`

实现结果：

- `[[` 补全继续在源码编辑区触发，并复用工作区索引。
- 补全候选支持工作区相对路径、Front Matter / 索引标题、文档标题节点。
- 选择 `[[` 候选仍插入普通 Markdown 相对链接，例如 `[入门指南](guide.md)` 或 `[安装步骤](guide.md#安装步骤)`，不引入新的私有链接格式。
- 预览中已存在的 `[[文档名]]` 继续可点击跳转，并新增按索引标题解析目标文档。
- 反向链接改为从工作区索引读取，避免状态栏时代的重复文件扫描；反链条目仍可点击打开来源文档并跳到引用行。
- 现有 `DocumentLinksPanel`、`BacklinksPanel` UI 保持不变，不新增常驻面板。

验证：

- `npm test -- --run src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/workspace/services/documentLinks.test.ts src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/components/BacklinksPanel.test.tsx`：5 个测试文件、37 项测试通过。
- `npm test -- --run`：71 个测试文件、427 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改前端编辑器补全、React 数据传递和 TypeScript 索引/链接服务，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 8：轻量关系图谱

改动范围：

- `src/App.tsx`
- `src/domains/workspace/services/relationGraph.ts`
- `src/domains/workspace/services/relationGraph.test.ts`
- `src/domains/workspace/services/index.ts`
- `src/domains/workspace/components/RelationGraphPanel.tsx`
- `src/domains/workspace/components/RelationGraphPanel.test.tsx`
- `src/styles/global.css`

实现结果：

- `查看关系图谱` 命令从占位 toast 替换为正式轻量关系图谱 modal。
- 图谱复用工作区索引，不新增文件扫描链路。
- 支持当前文档范围和工作区范围；当前文档范围支持 1 跳 / 2 跳。
- 节点是 Markdown 文件，边来自 Markdown/wiki 链接解析结果。
- 支持节点搜索，搜索字段匹配标题、文件名、相对路径和标题节点。
- 节点可点击打开目标文档；列表侧边展示入链/出链数量。
- UI 使用现有 modal / 分段按钮 / 低对比 SVG 视觉，不做 3D、块节点、数据库关系或常驻右栏。

验证：

- `npm test -- --run src/domains/workspace/services/relationGraph.test.ts src/domains/workspace/components/RelationGraphPanel.test.tsx src/domains/commands/registry.test.ts src/domains/workspace/services/workspaceIndex.test.ts`：4 个测试文件、32 项测试通过。
- `npm test -- --run`：73 个测试文件、432 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改 React modal、CSS 和 TypeScript 图谱服务，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 9：Front Matter 属性面板

改动范围：

- `src/domains/editor/components/DocumentPropertiesPanel.test.tsx`

实现结果：

- 审计确认现有 `DocumentPropertiesPanel` 已通过命令面板 `打开文档属性` 进入。
- 面板支持编辑 `title`、`tags`、`description`、`author`、`date`、`status`、`export`，保存后写回 Markdown 顶部 YAML Front Matter。
- 写回逻辑保留未知 YAML 字段，不创建数据库、不隐藏 Markdown 源码。
- 新增组件回归测试，覆盖 description / author / date / status / export 全字段写回、未知字段保留、关闭回调和成功 toast。
- 现有无效 YAML 防护保持：Front Matter 解析失败时禁用应用按钮并提示先修源码。

验证：

- `npm test -- --run src/domains/editor/components/DocumentPropertiesPanel.test.tsx src/domains/editor/extensions/frontMatterProperties.test.ts src/domains/commands/registry.test.ts src/lib/markdownToHtml.test.ts`：4 个测试文件、57 项测试通过。
- `npm test -- --run`：73 个测试文件、433 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只补属性面板测试覆盖，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 10：模板系统

改动范围：

- `src/domains/editor/extensions/templates.ts`
- `src/domains/editor/extensions/templates.test.ts`
- `src/domains/editor/extensions/slashMenu.ts`
- `src/domains/commands/registry.ts`
- `src/domains/commands/registry.test.ts`
- `src/domains/editor/components/EditorPane.integration.test.tsx`

实现结果：

- 审计确认现有模板系统已覆盖 `README`、会议纪要、PRD、技术方案、周报、公众号长文、论文草稿、读书笔记、研究摘要、白皮书等 Markdown 模板。
- 模板入口继续通过 `/template` 斜杠菜单和命令面板 / 文件菜单提供，不新增数据库或常驻模板面板。
- 模板内容统一保持 Markdown 源码插入，不引入 WYSIWYG 或块级数据库。
- 新增模板占位符解析，仅支持 `{{date}}`、`{{title}}`、`{{author}}`；未知占位符保持原样，避免误替换用户自定义内容。
- 通过命令创建新文档时以模板名称填充 `{{title}}`；源码编辑区直接插入模板时使用默认日期和轻量兜底标题。
- 斜杠菜单插入模板时先解析占位符，避免把内部占位符直接泄漏给普通写作用户。

验证：

- `npm test -- --run src/domains/editor/extensions/templates.test.ts src/domains/editor/extensions/slashMenu.test.ts src/domains/commands/registry.test.ts src/domains/editor/components/EditorPane.integration.test.tsx`：4 个测试文件、54 项测试通过。
- `npm test -- --run`：73 个测试文件、434 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改 TypeScript 模板解析、命令创建文档和编辑器模板插入，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 11：块级操作

改动范围：

- `src/domains/editor/extensions/blockOperations.ts`
- `src/domains/editor/extensions/blockOperations.test.ts`
- `src/domains/editor/extensions/contextMenu.ts`
- `src/domains/editor/extensions/contextMenu.test.ts`
- `src/domains/editor/components/EditorPane.integration.test.tsx`
- `src/domains/commands/types.ts`
- `src/domains/commands/registry.ts`
- `src/domains/commands/registry.test.ts`
- `src/domains/commands/menuModel.ts`

实现结果：

- 保留现有命令面板和格式菜单中的段落上移/下移、章节上移/下移、复制当前章节、折叠当前标题、选区转引用/Callout/列表/任务列表能力。
- 新增 `复制当前段落` 和 `删除当前段落` 源码级操作，操作对象是当前光标所在 Markdown 段落，不引入块编辑器或拖拽把手。
- 删除当前段落会整理相邻空行，避免留下多余空白；复制当前段落会在原段落下方插入副本并选中副本。
- 右键菜单新增 `块级操作` 子菜单，接入段落移动、复制/删除段落、选区转引用、选区转 Callout、选区转任务列表、复制章节和折叠标题。
- 命令仍通过现有 `prism-editor-command` 分发到 CodeMirror 源码编辑区，Markdown 源码仍是唯一真实内容。
- 规范化已有 Callout marker 时补齐 `IMPORTANT`，避免二次转换列表/任务时残留 Callout 标记。

验证：

- `npm test -- --run src/domains/editor/extensions/blockOperations.test.ts src/domains/editor/extensions/contextMenu.test.ts src/domains/commands/registry.test.ts src/domains/editor/components/EditorPane.integration.test.tsx`：4 个测试文件、54 项测试通过。
- `npm test -- --run`：74 个测试文件、437 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改编辑器源码操作、右键菜单和命令注册，不涉及 Tauri capabilities、发布、签名、公证、updater 或安装器。

## 阶段 12：导出保真与稳定专项

改动范围：

- `src/domains/export/exportPipeline.ts`
- `src/domains/export/exportPipeline.test.ts`
- `src/domains/commands/exportCommand.integration.test.ts`
- `src/domains/export/isolatedWebviewExport.test.ts`
- `src/domains/export/index.test.ts`
- `src/domains/commands/registry.test.ts`
- `src-tauri/src/lib.rs`
- `docs/verification/prism-complex-export-smoke.md`
- `docs/verification/prism-docx-rich-export-smoke.md`
- `docs/verification/prism-pdf-export-performance.md`

实现结果：

- 审计确认导出专项已在前序增量中闭环，本阶段不再重写导出链路，只做当前 full-run 复核和证据归档。
- HTML / PDF / PNG / DOCX 均继续走独立导出 WebView / 动态导出 chunk，避免把重导出链路拖入主编辑窗口。
- PDF 在 macOS 上优先使用 WebKit `WKWebView.createPDF` 矢量主链路，保留文字、字体和 SVG / Mermaid / KaTeX 渲染结果；失败时才 warning fallback 到 raster，不自动降到低清 scale。
- PNG 使用用户选择的清晰度 scale；超出安全 canvas 限制时按批次处理或抛出明确错误，不再静默降清晰度。
- DOCX 保持混合策略：正文、标题、表格、代码、列表、链接尽量使用原生 DOCX；Mermaid、KaTeX 和复杂 HTML 视觉块以高分辨率 PNG fallback 保真；普通本地 SVG 保留 SVG + PNG fallback。
- 链接图片在 PDF 中重建 `/Link` + `/URI` 注解，在 DOCX 中保留外层 hyperlink 和 drawing hyperlink，避免导出后只剩不可点击图片。
- 导出 DOM 标记图片、SVG、Mermaid、KaTeX、表格、代码块、Callout、Toggle、TOC 和带视觉样式的 HTML 块为 atomic block，并在 WebKit PDF / raster fallback 捕获前插入 spacer，降低视觉块跨页截断风险。
- 失败诊断会记录导出阶段、格式、路径、主题、模板、front matter、Pandoc / CSL 状态、warning 和错误堆栈，便于用户复制反馈。

本轮联网复核：

- Apple `WKWebView.createPDF` 是异步从 WebView 内容生成 PDF data 的官方能力，匹配当前 macOS PDF 主链路。
- Microsoft WebView2 `PrintToPdfAsync` 是 Windows 对应方向，但当前 Prism 1.0.x 先保持 macOS WebKit 主链路，非 macOS 仍保留 fallback。
- html2canvas 官方 `scale` 选项用于控制 canvas 渲染比例，当前 PNG / raster fallback 使用显式 scale，而不是自动低清降级。
- MDN `break-inside` / `page-break-inside` 说明了打印分页避免断裂的 CSS 语义；Prism 在 CSS 避免断裂之外额外做 DOM spacer，是为了覆盖 WebKit 固定页切线下的视觉块保真。
- docx.js 图片文档说明 `ImageRun` 可作为段落 / hyperlink 子项，并支持 `png` 等 raster 图片；当前 DOCX 对 Mermaid 采用 PNG-first，和 Word / WPS 兼容性目标一致。

本轮产物复核：

- `.codex-smoke/complex-export/out/complex-export.html`：重新生成；检查到标题、Mermaid / KaTeX 相关内容。
- `.codex-smoke/complex-export/out/complex-export.pdf`：重新生成；`pdf-lib` 读取为 1 页，首页尺寸约 `595.28 x 841.89`，符合 A4。
- `.codex-smoke/complex-export/out/complex-export.png`：重新生成；测试环境 PNG 为 html2canvas 替身产物，已确认 PNG signature，真实视觉 PNG 仍以既有真实 app smoke 证据为准。
- `.codex-smoke/complex-export/out/complex-export.docx`：重新生成；`jszip` 读取 `word/document.xml`，确认标题、表格文本存在，Mermaid 源码 `graph TD` 未泄漏，`word/media/` 有 2 个媒体文件。
- `.codex-smoke/complex-export/out/command-export.html|pdf|png|docx`：通过命令入口集成测试重新生成，确认四格式命令都能走真实导出 pipeline。
- 真实 app 四格式 UI smoke、PDF WebKit 长文 smoke、DOCX 富内容 smoke 已分别记录在 `docs/verification/prism-complex-export-smoke.md`、`docs/verification/prism-pdf-export-performance.md`、`docs/verification/prism-docx-rich-export-smoke.md`；本轮未改导出源码，因此不重复手动点击导出。

验证：

- `npm test -- --run src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts`：5 个测试文件、81 项测试通过。
- 产物读取检查：HTML 标题 / Mermaid / KaTeX 命中；PDF A4 页面可读；PNG signature 正确；DOCX 标题 / 表格文本存在、Mermaid 源码未泄漏、media 数量为 2。
- `cd src-tauri && cargo fmt --check && cargo check`：通过。
- `npm run tauri:build:app-smoke`：通过，生成 `src-tauri/target/release/bundle/macos/Prism.app`。

跳过项：

- 未重复真实 UI 四格式导出点击 smoke；已有 2026-05-15 至 2026-05-18 的真实 `.app` 证据覆盖 HTML / PDF / PNG / DOCX、长文 WebKit PDF、DOCX Mermaid PNG-first、链接图片、行内 HTML 和分页保护。本阶段没有改导出源码，重复人工 smoke 的风险收益不成比例。
