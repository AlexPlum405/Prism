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
