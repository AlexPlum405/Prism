# Prism 架构优化全阶段验证记录

> 启动日期：2026-05-20  
> 计划文件：`docs/prism-architecture-optimization-full-plan.md`  
> 目标：按 checkpoint 完成 10 个架构优化项，同时保持现有写作、预览、保存、恢复、搜索、诊断、导出能力不回退。

## 基线

- `fc5d828`：记录 Prism 架构优化全阶段计划。
- 工作树：开始执行时 `main...origin/main`，无未提交改动。
- 已读上下文：`AGENTS.md`、`CONTEXT.md`、`docs/adr/`、计划文件、`docs/verification/`。

## Checkpoint 2A：导出分页与失败诊断分层

改动范围：

- `src/domains/export/pagination.ts`
- `src/domains/export/pagination.test.ts`
- `src/domains/export/diagnostics.ts`
- `src/domains/export/diagnostics.test.ts`
- `src/domains/export/exportPipeline.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出导出分页保护模块 `pagination.ts`，集中承载 atomic block 标记、标题与视觉块分组、分页 spacer、超高视觉块缩放、分页阈值常量。
- `exportPipeline.ts` 继续通过同一公开函数调用分页逻辑，HTML/PDF/PNG/DOCX 的现有导出路径不改变算法。
- 从 `registry.ts` 抽出导出失败诊断模块 `diagnostics.ts`，集中承载引用路径校验、Pandoc 状态、导出设置、warning、错误堆栈等诊断文本生成。
- 命令注册层保留导出编排与 toast 行为，不再内联导出诊断细节。
- 新增聚焦测试覆盖分页模块和诊断模块，原有导出 pipeline 与命令注册测试保持通过。

验证：

```bash
npm test -- --run src/domains/export/pagination.test.ts src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts
```

结果：

- 7 个测试文件通过。
- 85 项测试通过。

跳过项：

- 本 checkpoint 只迁移 TypeScript 纯函数边界和新增单元测试，不改变 Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 2B：导出渲染等待与栅格兼容工具分层

改动范围：

- `src/domains/export/rendering.ts`
- `src/domains/export/rendering.test.ts`
- `src/domains/export/pagination.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出可复用渲染工具模块 `rendering.ts`。
- `rendering.ts` 统一承载导出 frame 等待、超时保护、栅格不兼容 CSS color 函数清理、WebKit color() 归一化、DOM computed color 归一化。
- `pagination.ts` 改为复用同一 frame wait helper，减少导出 pipeline 内部重复等待逻辑。
- `exportPipeline.ts` 继续使用原函数名别名接入新模块，避免大范围改调用点和导出行为。
- 新增聚焦测试覆盖 timer fallback、timeout rejection、CSS color 清理和 color() 归一化。

验证：

```bash
npm test -- --run src/domains/export/rendering.test.ts src/domains/export/pagination.test.ts src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts
```

结果：

- 8 个测试文件通过。
- 89 项测试通过。

跳过项：

- 本 checkpoint 只迁移导出前端渲染辅助函数，不改变 Tauri capabilities、WebKit PDF Rust command、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 2C：导出 assets 工具分层

改动范围：

- `src/domains/export/assets.ts`
- `src/domains/export/assets.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出资产处理工具模块 `assets.ts`。
- `assets.ts` 集中承载 data URL / bytes 转换、canvas PNG bytes 兜底、本地媒体路径解析、MIME 推断、DOCX raster 类型判断、图片尺寸读取、SVG 尺寸归一化、DOCX SVG foreignObject 文本降级。
- `exportPipeline.ts` 保留导出主流程和具体格式编排，继续调用同一转换函数，不改变 HTML/PDF/PNG/DOCX 导出算法。
- 新增聚焦测试覆盖 data URL 二进制转换、本地相对路径解析、媒体读取元数据、MIME/type 判断、SVG DOCX 兼容处理。

验证：

```bash
npm test -- --run src/domains/export/assets.test.ts src/domains/export/rendering.test.ts src/domains/export/pagination.test.ts src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts
```

结果：

- 9 个测试文件通过。
- 94 项测试通过。

跳过项：

- 本 checkpoint 只迁移导出资产转换与路径解析工具，不改变 Tauri capabilities、导出格式、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 4A：编辑器命令定义分层

改动范围：

- `src/domains/commands/categories/editorCommands.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 新增 `createEditorCommands()`，把编辑、插入、格式三类纯编辑器命令从 `registry.ts` 拆出。
- `registry.ts` 保留统一 registry 对外接口、快捷键查找、启用状态判断、命令执行与错误 toast。
- 外部菜单结构、命令 id、快捷键、enabled 条件、事件派发命令名保持不变。
- 本次只迁移定义层，不恢复全功能命令面板，也不改变 `Cmd+P` 快速打开和 `Cmd+Shift+F` 全文搜索定位。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/platform.test.ts src/App.recovery.test.tsx
```

结果：

- 3 个测试文件通过。
- 38 项测试通过。

跳过项：

- 本 checkpoint 只移动命令定义代码，不改变 Tauri capabilities、文件系统、导出算法、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 4B：视图/主题/窗口/帮助命令定义分层

改动范围：

- `src/domains/commands/categories/viewCommands.ts`
- `src/domains/commands/categories/themeCommands.ts`
- `src/domains/commands/categories/windowCommands.ts`
- `src/domains/commands/categories/helpCommands.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 把视图、主题、窗口、帮助相关命令定义从 `registry.ts` 拆入对应 category module。
- `registry.ts` 保留统一 registry 对外接口、快捷键查找、启用状态判断、命令执行与错误 toast。
- `Cmd+P` 仍只做快速打开，`Cmd+Shift+F` 仍只做全文搜索；没有恢复全功能命令面板。
- 命令 id、菜单类别、快捷键、checked/ enabled 条件和 run 行为保持不变。
- 文件、保存、恢复、导出等高耦合命令仍留在 `registry.ts`，等待后续按更深的文件安全层和导出命令边界继续拆分。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/platform.test.ts src/App.recovery.test.tsx
```

结果：

- 3 个测试文件通过。
- 38 项测试通过。

跳过项：

- 本 checkpoint 只移动命令定义代码，不改变 Tauri capabilities、文件系统、导出算法、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 4C：导出命令编排分层

改动范围：

- `src/domains/commands/categories/exportCommands.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 新增 `createExportCommands()`，把 PDF / DOCX / HTML / PNG 导出命令、上次设置导出、覆盖上次导出从 `registry.ts` 拆出。
- 导出命令模块承载导出进度事件、导出保存路径请求、导出历史设置、质量档位、成功 toast 打开/显示位置动作、失败诊断与重试动作。
- `registry.ts` 不再直接依赖导出 pipeline、导出诊断、导出质量工具或导出历史类型。
- 外部命令 id、菜单类别、快捷键/启用条件、toast 文案、历史记录行为保持不变。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/commands/platform.test.ts src/App.recovery.test.tsx
```

结果：

- 4 个测试文件通过。
- 39 项测试通过。

跳过项：

- 本 checkpoint 只移动导出命令编排代码，不改变导出 pipeline 算法、Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 1A：App toast 与导出任务 UI hook 分层

改动范围：

- `src/hooks/useAppToast.ts`
- `src/hooks/useAppToast.test.tsx`
- `src/hooks/useExportTaskUi.ts`
- `src/hooks/useExportTaskUi.test.tsx`
- `src/App.tsx`

实现结果：

- 从 `App.tsx` 抽出 `useAppToast()`，集中管理 toast state、自动消失 timer、全局 `prism-toast` 事件监听和 dismiss 行为。
- 从 `App.tsx` 抽出 `useExportTaskUi()`，集中管理导出进度事件、后台导出状态、导出失败诊断弹窗状态、复制诊断文本。
- `App.tsx` 保留组合层使用，不再直接持有 toast timer 和导出事件监听细节。
- 不改变导出 toast 文案、后台按钮、状态栏后台导出入口、失败诊断弹窗和复制诊断行为。

验证：

```bash
npm test -- --run src/hooks/useAppToast.test.tsx src/hooks/useExportTaskUi.test.tsx src/App.recovery.test.tsx
npm test -- --run
```

结果：

- 聚焦测试：3 个测试文件、12 项测试通过。
- 全量前端测试：80 个测试文件、457 项测试通过。

跳过项：

- 本 checkpoint 只移动 React UI state hook，不改变 Tauri capabilities、文件系统、导出算法、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 1B / 6A：工作区索引 hook 分层

改动范围：

- `src/domains/workspace/hooks/useWorkspaceIndexModel.ts`
- `src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx`
- `src/App.tsx`

实现结果：

- 从 `App.tsx` 抽出 `useWorkspaceIndexModel()`，集中管理工作区 Markdown 文件读取、索引源文档状态、索引中状态、当前未保存文档覆盖磁盘内容、`buildWorkspaceIndex()` 调用。
- `App.tsx` 继续消费 `workspaceIndex` 与 `workspaceIndexing`，不再直接持有 `workspaceIndexSources` 与读取 effect。
- 工作区索引仍复用现有 `workspaceIndex` 服务，继续服务快速打开、全文搜索、文档链接、反链与关系图谱。
- 新增 hook 测试覆盖：只读取 Markdown 文件、忽略图片文件、当前未保存文档覆盖磁盘旧内容、无工作区时清空索引状态。

验证：

```bash
npm test -- --run src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/App.recovery.test.tsx
npm test -- --run src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/domains/workspace/services/workspaceIndex.test.ts src/components/shell/CommandPalette.test.tsx src/domains/workspace/components/BacklinksPanel.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx src/App.recovery.test.tsx
```

结果：

- 聚焦 hook + App：2 个测试文件、10 项测试通过。
- 工作区索引相关组合：6 个测试文件、18 项测试通过。

跳过项：

- 本 checkpoint 只移动 React hook 与现有索引服务接线，不改变文件写入、安全策略、Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 5A：统一诊断模型底座

改动范围：

- `src/domains/diagnostics/types.ts`
- `src/domains/diagnostics/adapters.ts`
- `src/domains/diagnostics/adapters.test.ts`
- `src/App.tsx`

实现结果：

- 新增 `PrismDiagnostic` 统一诊断类型，包含 `kind`、`severity`、`source`、`line`、`column`、`message`、`reason`、`action`。
- 新增 link diagnostics 与 typography diagnostics 到 `PrismDiagnostic` 的 adapter。
- 链接问题映射为 `severity: "error"`，普通中文排版建议映射为 `severity: "info"`。
- App 层开始用 `getActionableErrorDiagnostics()` 计算状态栏 `ERROR n`，保持“普通排版建议不计入 ERROR”的产品边界。
- 现有链接诊断面板和排版提示面板仍使用原始领域类型，UI 与交互不变；统一模型先作为底层收敛点。

验证：

```bash
npm test -- --run src/domains/diagnostics/adapters.test.ts src/domains/editor/components/LinkDiagnosticsPanel.test.tsx src/domains/editor/components/TypographyDiagnosticsPanel.test.tsx src/domains/workspace/components/StatusBar.test.tsx src/App.recovery.test.tsx
```

结果：

- 5 个测试文件通过。
- 22 项测试通过。

跳过项：

- 本 checkpoint 只新增诊断类型与 adapter，并调整 App 中 `ERROR` 计数来源，不改变导出 pipeline、文件系统、Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 3A / 6B：Markdown document model 与工作区索引复用

改动范围：

- `src/domains/markdown/frontMatter.ts`
- `src/domains/markdown/headingSlug.ts`
- `src/domains/markdown/documentModel.ts`
- `src/domains/markdown/index.ts`
- `src/domains/markdown/documentModel.test.ts`
- `src/domains/editor/extensions/frontMatterProperties.ts`
- `src/domains/editor/extensions/headingSlug.ts`
- `src/domains/workspace/services/documentLinks.ts`
- `src/domains/workspace/services/workspaceIndex.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 新增 `src/domains/markdown/` 作为低层 Markdown core，集中承载 document front matter 解析、heading slug、heading 提取、Markdown/wiki 链接提取和 `parseMarkdownDocumentModel()`。
- `frontMatterProperties.ts` 和 `headingSlug.ts` 保留原有 editor 扩展入口，但改为从 Markdown core re-export，避免 UI/编辑器侧成为工作区索引的底层依赖。
- `documentLinks.ts` 保留 workspace 里的链接解析与路径解析职责，只复用 Markdown core 的链接提取函数和类型。
- `workspaceIndex.ts` 改为基于 `parseMarkdownDocumentModel()` 构建 title、front matter、headings、links 和 backlinks，减少 front matter / heading / links 的重复扫描逻辑。
- 清理 `exportPipeline.ts` 中导出分页拆分后遗留的未使用 import，使 `npm run build` 的 TypeScript 阶段恢复通过。
- 外部 `WorkspaceIndex`、`DocumentLinkReference`、`parseDocumentFrontMatter()`、`getMarkdownHeadingSlug()` 入口保持兼容，快速打开、全文搜索、反链、关系图谱、预览和导出行为不改变。

验证：

```bash
npm test -- --run src/domains/markdown/documentModel.test.ts src/domains/editor/extensions/frontMatterProperties.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/editor/extensions/linkCompletion.test.ts src/domains/workspace/services/documentLinks.test.ts src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/components/shell/CommandPalette.test.tsx src/domains/workspace/components/BacklinksPanel.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx
npm test -- --run src/lib/markdownToHtml.test.ts src/domains/export/frontMatter.test.ts src/domains/export/templates.test.ts src/domains/export/exportPipeline.test.ts
npm test -- --run
npm run build
```

结果：

- Markdown / workspace / 链接聚焦测试：10 个测试文件、38 项测试通过。
- Markdown 渲染与导出 front matter 相关测试：4 个测试文件、90 项测试通过。
- 全量前端测试：83 个测试文件、465 项测试通过。
- `npm run build` 通过；Vite 仍提示既有大 chunk 警告，留给后续“主包性能优化”checkpoint 处理。

跳过项：

- 本 checkpoint 只迁移 TypeScript 纯函数边界和工作区索引接线，不改变文件写入、安全策略、Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 4D：文件 / 工作区 / 文档信息命令定义分层

改动范围：

- `src/domains/commands/categories/fileCommands.ts`
- `src/domains/commands/categories/workspaceCommands.ts`
- `src/domains/commands/categories/documentInfoCommands.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 新增 `createFileCommands()`，把新建、打开、保存、另存为、模板、打印、显示当前位置、关闭文稿等文件命令从 `registry.ts` 拆出。
- 新增 `createWorkspaceCommands()`，把打开文件夹、快速打开和关系图谱入口从 `registry.ts` 拆出，保留工作区路径授权、文件树加载和独立窗口打开行为。
- 新增 `createDocumentInfoCommands()`，把文档属性、当前文档链接、反向链接入口从 `registry.ts` 拆出。
- `registry.ts` 继续只负责命令组合、快捷键匹配、统一启用判断、执行包裹和错误 toast。
- 命令 id、菜单类别、快捷键、enabled 条件、模板插入事件、保存冲突检测、恢复快照、最近文件记录、导出命令和帮助/窗口/视图命令行为保持不变。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/commands/platform.test.ts src/App.recovery.test.tsx
npm test -- --run
npm run build
```

结果：

- 命令系统聚焦测试：4 个测试文件、39 项测试通过。
- 全量前端测试：83 个测试文件、465 项测试通过。
- `npm run build` 通过；Vite 仍提示既有大 chunk 警告，留给后续“主包性能优化”checkpoint 处理。

跳过项：

- 本 checkpoint 只迁移命令定义和命令 handler 的 module 边界，不改变文件权限、Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 7A：CSS / 设计系统分层

改动范围：

- `src/styles/global.css`
- `src/styles/tokens.css`
- `src/styles/shell.css`
- `src/styles/editor.css`
- `src/styles/preview.css`
- `src/styles/floating.css`
- `src/styles/export.css`
- `src/styles/diagnostics.css`
- `src/styles/content-themes.css`
- `src/styles/miaoyan.css`
- `src/styles/windows.css`
- `src/styles/global.test.ts`
- `src/assets/fonts/README.md`

实现结果：

- 将 7271 行 `global.css` 拆为按原始级联顺序导入的设计系统层，`global.css` 只保留 import 入口。
- `tokens.css` 承载字体、基础令牌、深色变量、旧变量别名和基础 reset；`shell.css` 承载 app 基座、focus/typewriter、滚动条和横向滚动条。
- `editor.css` 承载 CodeMirror 编辑器、源码染色、搜索和补全；`preview.css` 承载共享预览 affordance、citation、wiki link 和 front matter 预览。
- `floating.css` / `export.css` / `diagnostics.css` 分别承载浮层、导出弹窗/失败诊断、诊断/反链/关系图/恢复/toast/context/render-error 等 UI。
- `content-themes.css` 承载非妙言内容主题预览兼容；`miaoyan.css` 承载当前主风格的 AppKit / DownView / Heti 兼容与妙言预览排印；`windows.css` 承载 WebView2 文本补偿。
- 更新 CSS 测试为读取 `global.css` import 图，保持 Windows 补偿和 modal pill 断言仍覆盖实际级联内容。
- 未修改任何选择器和声明内容，主要风险控制点是 import 顺序；拆分顺序按原始行号保持。

验证：

```bash
npm test -- --run src/styles/global.test.ts src/domains/document/components/ViewModeSwitch.module.test.ts
npm run build
npm test -- --run
```

结果：

- CSS 聚焦测试：2 个测试文件、5 项测试通过。
- `npm run build` 通过，打包后 `main-kRUF3VD-.css` 仍为 40.44 kB / gzip 5.22 kB。
- 全量前端测试：83 个测试文件、465 项测试通过。

跳过项：

- 本 checkpoint 是机械 CSS 分层，没有改变视觉 token、选择器、组件结构、Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 真实 App 主界面、设置、快速打开、ERROR、导出弹窗视觉抽检留到最终 `npm run tauri:build:app-smoke` 和本地 `Prism.app` 重启 gate 统一覆盖。
