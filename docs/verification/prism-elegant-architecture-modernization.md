# Prism 优雅架构现代化验证记录

> 启动日期：2026-05-21
> 计划文件：`docs/prism-elegant-architecture-modernization-plan.md`
> Goal 文件：`docs/prism-elegant-architecture-modernization-goal.md`
> 目标：按 Phase 0 到 Phase 10 完成行为保持型架构现代化，让 App、导出、编辑器、平台事件、Tauri native command 的职责收敛，同时保持本地优先、单文档单窗口、Markdown 源码可见、当前妙言风格和既有用户功能不回退。

## 基线

- 当前 HEAD：`3daefb8 优化主题导入弹窗交互`。
- 最近已完成背景：主题导入弹窗已改为 Prism/Miaoyan 风格内部弹窗，并已推送到 `origin/main`。
- 工作树开始状态：
  - `?? docs/prism-elegant-architecture-modernization-plan.md`：本轮计划文件，纳入 Checkpoint 0。
  - `?? docs/prism-elegant-architecture-modernization-goal.md`：本轮 goal 文件，纳入 Checkpoint 0。
  - `?? .antigravitycli/`：本地 scratch，无关脏改，不提交。
  - `?? temp_script_check.js`：本地原型/检查 scratch，无关脏改，不提交。
- 已读上下文：
  - `AGENTS.md`
  - `CONTEXT.md`
  - `docs/adr/0001-adopt-openai-minimal-design.md`
  - `docs/adr/0002-css-token-naming.md`
  - `docs/adr/0003-bundle-fonts-locally.md`
  - `docs/adr/0004-focus-mode-soft-dim.md`
  - `docs/adr/0005-adopt-miaoyan-style.md`
  - `docs/verification/`
  - 当前 `git status --short`
  - 当前 `git diff --stat`
  - 当前 `git diff --name-only`
  - 最近 `git log --oneline -20`
- 当前关键膨胀点行数：
  - `src/App.tsx`：1357 行。
  - `src/domains/export/exportPipeline.ts`：3209 行。
  - `src/domains/editor/components/EditorPane.tsx`：1424 行。
  - `src-tauri/src/lib.rs`：963 行。
- 当前事件与平台直接依赖基线：
  - `window.dispatchEvent(new CustomEvent(...))` / `window.addEventListener(...)` 仍分布在 `App.tsx`、`EditorPane.tsx`、`SplitView.tsx`、`FileTree.tsx`、`fileActions.ts`、命令模块和若干测试中。
  - 前端 Tauri 直接调用仍分布在 `App.tsx`、`fileActions.ts`、`settings/store.ts`、`themes`、`commands/categories/*`、`document`、`editor`、`PreviewPane.tsx` 等路径。

## Phase 0：架构基线与证据冻结

### Checkpoint 0A：计划与验证入口落地

改动范围：

- `docs/prism-elegant-architecture-modernization-plan.md`
- `docs/prism-elegant-architecture-modernization-goal.md`
- `docs/verification/prism-elegant-architecture-modernization.md`

实现结果：

- 记录本轮 10 个 phase 的架构现代化目标、边界、风险、验证分层和完成标准。
- 建立本验证文档，后续每个 checkpoint 在这里追加证据。
- 明确无关脏改：`.antigravitycli/`、`temp_script_check.js` 不提交、不覆盖。
- 本 checkpoint 不改业务代码，不改变任何用户可见行为。

验证：

```bash
git diff --check --cached
```

结果：

- 通过。未发现尾随空白或 diff 格式问题。

跳过项：

- 本 checkpoint 只落地文档和验证入口，不触及 TypeScript、React、Tauri、Rust、文件系统、导出或真实 app 启动。
- 因此不跑 `npm test -- --run`、`npm run build`、`cargo test`、`npm run tauri:build:app-smoke`；后续触及对应风险面时按分层补齐。

剩余风险：

- 后续 Phase 1 到 Phase 10 尚未实现。
- `App.tsx`、`exportPipeline.ts`、`EditorPane.tsx`、`src-tauri/src/lib.rs` 仍是主要重构对象。

## Phase 1：Typed app events 与 platform adapters

### Checkpoint 1A：类型化应用事件接口

改动范围：

- `src/platform/events/eventTypes.ts`
- `src/platform/events/appEvents.ts`
- `src/platform/events/appEvents.test.ts`
- `src/hooks/useAppToast.ts`
- `src/hooks/useExportTaskUi.ts`
- `src/App.tsx`
- `src/components/shell/SettingsModal.tsx`
- `src/domains/commands/registry.ts`
- `src/domains/commands/categories/editorCommands.ts`
- `src/domains/commands/categories/exportCommands.ts`
- `src/domains/commands/categories/fileCommands.ts`
- `src/domains/editor/components/EditorPane.tsx`
- `src/domains/editor/components/SplitView.tsx`
- `src/domains/editor/extensions/slashMenu.ts`
- `src/domains/workspace/components/FileTree.tsx`
- `src/lib/fileActions.ts`

实现结果：

- 新增 `APP_EVENT_NAMES`、`emitAppEvent()`、`onAppEvent()`，把内部 `prism-*` DOM event 名收敛到一个 typed interface。
- 新增 `AppEventMap`，覆盖 `editor.command`、`editor.format`、`editor.heading`、`editor.blockFormat`、`command.run`、`search.open`、`file.action`、`file.renameRequest`、`toast.show`、`export.progress`、`export.failed`、`diagnostics.open`、`settings.open`。
- 迁移 production 代码中高频 `window.dispatchEvent(new CustomEvent('prism-*'))` 与 `window.addEventListener('prism-*')` 入口，外部 DOM event 名保持不变，旧测试和旧调用仍可兼容。
- `EditorPane` 的 typed listener 保留空 payload 容错，避免旧事件或测试派发空 detail 时抛错。
- 本 checkpoint 只建立 app event seam，不改变命令、搜索、导出、toast、诊断、文件树的用户可见行为。

验证：

```bash
npm test -- --run src/platform/events/appEvents.test.ts src/hooks/useAppToast.test.tsx src/hooks/useExportTaskUi.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx src/domains/commands/registry.test.ts src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- 第一次聚焦测试发现旧测试会派发空 payload，`EditorPane` typed listener 已补容错。
- 聚焦测试复跑通过：6 个测试文件、62 项测试通过。
- `npm run build` 通过；保留既有 Vite 大 chunk 和 KaTeX 动态导入警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 不触及 Tauri/Rust/native command、真实文件写入算法、导出 pipeline 算法、发布签名、公证、updater、安装器或 file association。
- 因此未跑 `cargo test` 和 `npm run tauri:build:app-smoke`；后续触及 platform adapter / native command / 最终收口时补齐。

剩余风险：

- `src/platform/tauri/` adapter 尚未建立，下一 checkpoint 继续收敛低风险 Tauri 调用。
- 测试代码仍保留少量原始 `prism-*` DOM event 派发，用于验证兼容性；production 事件入口已通过 typed interface 收敛。

### Checkpoint 1B：第一批 Tauri platform adapter

改动范围：

- `src/platform/tauri/dialogs.ts`
- `src/platform/tauri/nativeCommands.ts`
- `src/platform/tauri/opener.ts`
- `src/lib/fileSystemScope.ts`
- `src/domains/commands/registry.ts`
- `src/domains/commands/categories/exportCommands.ts`
- `src/domains/commands/categories/workspaceCommands.ts`
- `src/components/shell/SettingsModal.tsx`

实现结果：

- 建立第一批 Tauri adapter：
  - `dialogs.ts`：`askDialog()`、`confirmDialog()`、`messageDialog()`、`openDialog()`。
  - `nativeCommands.ts`：`invokeNativeCommand()`、`grantMarkdownFileScopeNative()`、`grantWorkspaceDirectoryScopeNative()`、`openPathWithSystemNative()`。
  - `opener.ts`：`openPathWithDefaultApp`、`openExternalUrl`、`revealPathInFileManager`。
- 迁移低风险调用点：设置中心路径选择、工作区打开文件夹、导出后打开/显示位置、帮助链接/检查更新跳转、DevTools native invoke、Markdown/workspace scope 授权。
- `dialogs.ts` 使用惰性 wrapper，避免测试只 mock `open` 时因为未用到的 `ask/confirm/message` 顶层解构而失败。
- 本 checkpoint 不迁移保存、删除、恢复、导出 pipeline 写文件、主题安装文件写入等高风险路径。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/exportCommand.integration.test.ts src/components/shell/SettingsModal.test.tsx src/domains/commands/platform.test.ts
npm run build
git diff --check
```

结果：

- 第一次聚焦测试暴露 `dialogs.ts` 顶层解构与旧测试 mock 不兼容；已改为惰性 wrapper。
- 聚焦测试复跑通过：4 个测试文件、47 项测试通过。
- `npm run build` 通过；保留既有 Vite 大 chunk 和 KaTeX 动态导入警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只改前端 Tauri adapter 和低风险调用点，不触及 Rust/native command 实现、不改真实文件写入算法、不改导出 pipeline 内部算法。
- 因此未跑 `cargo test` 和 `npm run tauri:build:app-smoke`；Phase 8 和最终收口时补齐。

剩余风险：

- `App.tsx`、`fileActions.ts`、`useBootstrap.ts`、`settings/store.ts`、`fontService.ts`、`themeStorage.ts`、`exportPipeline.ts` 等仍有直接 Tauri import，后续 phase 按风险逐步迁移。

## Phase 2：App.tsx 瘦身为 composition root

### Checkpoint 2A：启动文件打开 hook 分层

改动范围：

- `src/app/useStartupFileOpen.ts`
- `src/app/useStartupFileOpen.test.tsx`
- `src/platform/tauri/startupFiles.ts`
- `src/App.tsx`

实现结果：

- 从 `App.tsx` 抽出 `useStartupFileOpen()`，集中处理：
  - 启动后延迟读取 native pending files。
  - 监听 Tauri `file-opened` 事件。
  - 组件卸载时取消 native listener。
- 新增 `src/platform/tauri/startupFiles.ts`，把 `get_pending_files` 和 `file-opened` 事件接到 platform adapter。
- `App.tsx` 不再直接 import `@tauri-apps/api/core` 和 `@tauri-apps/api/event`。
- `App.tsx` 行数从基线 1357 行降到 1310 行。
- 行为保持不变：仍只打开 native 传入的第一个文件，pending files 仍是 best-effort。

验证：

```bash
npm test -- --run src/app/useStartupFileOpen.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- 聚焦测试通过：2 个测试文件、11 项测试通过。
- `npm run build` 通过；保留既有 Vite 大 chunk 和 KaTeX 动态导入警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只迁移启动文件事件和 pending file 读取，不改变保存、导出、工作区索引、文件树或真实文件写入行为。
- 因此未跑 `npm run tauri:build:app-smoke`；最终真实 app smoke 会覆盖 Finder/启动打开链路。

剩余风险：

- `App.tsx` 仍包含命令上下文、保存/导出弹窗、诊断、链接/反链/图谱等多块 model，需要继续拆分。

### Checkpoint 2B：命令上下文与快捷键接线分层

改动范围：

- `src/app/useAppCommandContext.ts`
- `src/app/useAppShortcuts.ts`
- `src/app/useAppShortcuts.test.tsx`
- `src/App.tsx`

实现结果：

- 从 `App.tsx` 抽出 `useAppCommandContext()`，集中承载：
  - `CommandContext` 创建。
  - menu sections 计算。
  - `setTheme:` / `openRecentFile:` / `openWorkspaceFile:` 特殊 action。
  - unknown command toast。
  - `command.run`、`file.action`、`settings.open` typed app event 接线。
- 从 `App.tsx` 抽出 `useAppShortcuts()`，集中承载：
  - `Escape` 退出专注模式。
  - 全局快捷键匹配与 `runCommand()` 调用。
- `App.tsx` 不再直接处理全局命令 bus 和 keydown 注册。
- `App.tsx` 行数从 Checkpoint 2A 的 1310 行降到 1241 行。
- 命令定义、菜单结构、快捷键、命令 id 和用户可见行为保持不变。

验证：

```bash
npm test -- --run src/app/useAppShortcuts.test.tsx src/domains/commands/registry.test.ts src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、35 项测试通过。
- `npm run build` 通过；保留既有 Vite 大 chunk 和 KaTeX 动态导入警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只迁移 App 命令接线，不改命令定义、不改保存/导出算法、不触碰 Tauri/Rust/native command。
- 因此未跑 `npm run tauri:build:app-smoke`；最终真实 app smoke 覆盖菜单、快捷键和导出入口。

剩余风险：

- `App.tsx` 仍包含保存/导出弹窗模型、诊断模型、文档链接/反链/图谱导航模型，后续继续拆分。

### Checkpoint 2C：文档诊断 model 分层

改动范围：

- `src/app/useDocumentDiagnosticsModel.ts`
- `src/App.tsx`

实现结果：

- 从 `App.tsx` 抽出 `useDocumentDiagnosticsModel()`，集中承载：
  - 链接、图片、标题、渲染、表格、中文排版诊断扫描。
  - `diagnostics.open` typed app event 接线。
  - `ERROR n` actionable diagnostics 聚合。
  - 诊断面板显示/关闭、preflight diagnostics 清理、点击跳转。
  - 排版建议面板显示/关闭、点击跳转。
- `App.tsx` 不再直接 import 诊断扫描器、diagnostics adapters、`PrismDiagnostic` 或 `ImageDiagnostic`。
- `App.tsx` 行数从 Checkpoint 2B 的 1241 行降到 1115 行。
- 诊断算法、状态栏 `ERROR n` 筛选规则、诊断面板 UI、排版建议 UI 保持不变。

验证：

```bash
npm test -- --run src/domains/editor/components/DocumentDiagnosticsPanel.test.tsx src/domains/editor/components/TypographyDiagnosticsPanel.test.tsx src/domains/workspace/components/StatusBar.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- 第一次聚焦测试发现 `StatusBar` 仍引用 `actionableDiagnostics`，App 解构遗漏；已补齐。
- 聚焦测试复跑通过：4 个测试文件、20 项测试通过。
- `npm run build` 通过；保留既有 Vite 大 chunk 和 KaTeX 动态导入警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只迁移诊断 model，不改变诊断算法、Tauri/Rust/native command、保存/导出写文件行为。
- 因此未跑 `npm run tauri:build:app-smoke`；最终真实 app smoke 覆盖状态栏 `ERROR n` 和诊断面板入口。

剩余风险：

- `App.tsx` 仍包含保存/导出弹窗模型和文档链接/反链/图谱导航模型。

### Checkpoint 2D：文档导航 model 分层

改动范围：

- `src/app/useDocumentNavigationModel.ts`
- `src/App.tsx`

实现结果：

- 从 `App.tsx` 抽出 `useDocumentNavigationModel()`，集中承载：
  - 当前文档 links 提取。
  - backlinks 计算、面板显示/关闭。
  - backlink 选择后的打开文件与行号跳转。
  - Markdown/wiki 文档链接解析与打开。
  - 关系图谱打开条件与显示状态。
- `App.tsx` 不再直接 import `extractDocumentLinks()`、`getWorkspaceIndexBacklinks()`、`getWorkspaceIndexLinkFiles()`、`resolveDocumentLinkTarget()`、`isSamePath()` 或链接/反链引用类型。
- `App.tsx` 行数从 Checkpoint 2C 的 1115 行降到 1021 行。
- 工作区索引、链接解析算法、BacklinksPanel、DocumentLinksPanel、RelationGraphPanel UI 行为保持不变。

验证：

```bash
npm test -- --run src/domains/workspace/components/BacklinksPanel.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx src/components/shell/CommandPalette.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- 聚焦测试通过：4 个测试文件、14 项测试通过。
- `npm run build` 通过；保留既有 Vite 大 chunk 和 KaTeX 动态导入警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只迁移导航 model，不改工作区索引算法、不改文件打开实现、不触碰 Tauri/Rust/native command。
- 因此未跑 `npm run tauri:build:app-smoke`；最终真实 app smoke 覆盖链接跳转、反链跳转和关系图谱入口。

剩余风险：

- `App.tsx` 仍包含保存/导出弹窗 model 和部分 shell UI 局部状态。

### Checkpoint 2E：保存与导出弹窗 model 分层

改动范围：

- `src/app/useSaveExportDialogModel.ts`
- `src/app/useSaveExportDialogModel.test.tsx`
- `src/App.tsx`

实现结果：

- 从 `App.tsx` 抽出 `useSaveExportDialogModel()`，集中承载：
  - Markdown 另存弹窗状态、默认目录、文件名补 `.md`。
  - 导出弹窗状态、默认导出目录、导出文件名补目标扩展名。
  - 目录选择、覆盖确认、文件名分隔符校验。
  - PNG 清晰度选择、导出清晰度持久化、导出准备进度事件。
- `App.tsx` 不再直接维护 `SaveDialogState`、导出文件名推导、默认导出目录解析、覆盖路径 basename 或保存/导出确认逻辑。
- 新增 hook 单测，锁定保存/导出弹窗最容易回退的行为：
  - Markdown 另存补扩展名并解析到原文档目录。
  - 导出覆盖确认不直接覆盖，用户确认覆盖后才 resolve。
  - PNG 清晰度写回设置 store，并继续发出导出准备进度事件。
  - 目录选择统一通过 Tauri dialog adapter。
- `App.tsx` 行数从 Checkpoint 2D 的 1021 行降到 796 行。
- 保存/导出弹窗 JSX、文案、覆盖确认 UI、清晰度下拉 UI 保持不变。

验证：

```bash
npm test -- --run src/app/useSaveExportDialogModel.test.tsx src/App.recovery.test.tsx src/domains/commands/exportCommand.integration.test.ts src/domains/commands/registry.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：4 个测试文件、37 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只迁移保存/导出弹窗 model，不改变真实文件写入算法、导出 pipeline 渲染算法、Rust/native command、发布签名、公证、updater、安装器或 file association。
- 因此未跑 `cargo test` 和 `npm run tauri:build:app-smoke`；最终收口会用真实 app smoke 覆盖保存、另存、导出入口和文件安全路径。

剩余风险：

- `App.tsx` 仍保留 shell 局部 UI 状态、恢复/冲突弹窗接线、平台 class/session persistence 等顶层装配逻辑，后续需要判断是否继续抽 hook，还是让 `App.tsx` 作为 composition root 保留这些接线。
- `exportPipeline.ts`、`EditorPane.tsx`、`src-tauri/src/lib.rs` 尚未进入后续 phase。

## Phase 3：Export strategy + pipeline 深化

### Checkpoint 3A：导出 service 与本地 format strategy

改动范围：

- `src/domains/export/exportService.ts`
- `src/domains/export/formats/localExportStrategies.ts`
- `src/domains/export/localExport.ts`
- `src/domains/export/localExport.test.ts`
- `src/domains/export/index.ts`

实现结果：

- 从 `index.ts` 抽出 `exportService.ts`，让 `index.ts` 回到对外 barrel：
  - 保持 `exportDocument()` 对外导出名和调用行为不变。
  - 保持 Tauri 主窗口带 `outputPath` 时走 isolated WebView，export worker / browser runtime 走 local pipeline。
- 从 `localExport.ts` 的 switch 抽出本地 format strategy registry：
  - `html` -> `adapters/html`
  - `pdf` -> `adapters/pdf`
  - `docx` -> `adapters/docx`
  - `png` -> `adapters/png`
- 新增 `localExport.test.ts`，验证四种 format 会加载正确 adapter，并在 strategy 边界拒绝不支持的 format。
- 本 checkpoint 不移动 `exportPipeline.ts` 内部算法，`exportHtml`、`exportPdf`、`exportPng`、`exportDocx` 仍由原 pipeline 导出，避免把 strategy 接线和渲染算法迁移混在一个 diff 中。

验证：

```bash
npm test -- --run src/domains/export/index.test.ts src/domains/export/localExport.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、10 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只建立导出 service / strategy 接线，不改变导出渲染、PDF capture、PNG canvas、DOCX builder、真实文件写入或 Tauri/Rust/native command。
- 因此未跑 `npm run tauri:build:app-smoke`；后续移动 pipeline 内部实现和最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍为 3209 行，主要 HTML/PDF/PNG/DOCX 实现尚未拆分。
- 下一步应先拆 `exportPipelineContext` / 渲染上下文中的纯工具，再逐步拆 HTML/PDF/PNG/DOCX 具体实现。

### Checkpoint 3B：导出 pipeline 上下文工具分层

改动范围：

- `src/domains/export/pipeline/exportPipelineContext.ts`
- `src/domains/export/pipeline/exportPipelineContext.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出上下文级公共工具：
  - `exportProgressMessages`
  - `normalizeExportRasterScale`
  - `getPreviewBackgroundColor`
  - `stripMarkdownExtension`
  - `getExportTitle`
  - `reportProgress`
  - `reportWarning`
  - `isTauriExportWorkerRuntime`
  - `getErrorMessage`
  - `getExportOutputPath`
- 新增 `exportPipelineContext.test.ts`，覆盖 raster scale 边界、导出 title 推导、进度/警告 callback、Tauri export worker 判断、错误消息与输出路径 helper、预览背景色 fallback。
- `exportPipeline.ts` 改为从 `pipeline/exportPipelineContext.ts` 导入这些工具，HTML/PDF/PNG/DOCX 导出算法未改变。

验证：

```bash
npm test -- --run src/domains/export/pipeline/exportPipelineContext.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/index.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：4 个测试文件、60 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动导出上下文工具，不改变渲染节点创建、Mermaid、图片、PDF capture/raster、DOCX builder、真实文件写入或 Rust/Tauri native command。
- 因此未跑 `npm run tauri:build:app-smoke`；后续触及真实导出 worker 或最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍承载主要实现，需要继续拆 render/html/pdf/png/docx 模块。
- 本次新增的上下文工具是后续模块拆分的公共依赖，后续移动代码时必须继续保持导出 API 和错误文案不变。
