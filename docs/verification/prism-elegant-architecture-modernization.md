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

### Checkpoint 3C：导出 CSS 渲染模块分层

改动范围：

- `src/domains/export/render/exportCss.ts`
- `src/domains/export/render/exportCss.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出导出 CSS 渲染支撑模块：
  - `inlineCssUrls()`：内联 CSS 中的外部 URL 资源，保留 data/hash/about URL。
  - `collectExportCss()`：收集当前样式表、补导出文档 CSS、TOC CSS、atomic pagination CSS、模板 CSS、`@page` 纸张与边距、print CSS，并在 raster safe 模式下复用现有颜色清理。
- 新增 `exportCss.test.ts`，覆盖：
  - 纸张和页边距 CSS 仍按输入生成。
  - atomic block / page spacer class 仍来自分页常量。
  - 外部 CSS URL 会被 fetch 后内联为 data URL。
  - data/hash/about URL 不触发 fetch，保持原样。
- `exportPipeline.ts` 改为从 `render/exportCss.ts` 导入 `collectExportCss()`，HTML/PDF/raster 的导出算法和调用位置保持不变。

验证：

```bash
npm test -- --run src/domains/export/render/exportCss.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
git diff --check
```

结果：

- 第一次测试发现新增测试断言写成了不存在的 atomic class 名；代码迁移保留的是既有常量 `prism-export-atomic` / `prism-export-page-spacer`，已修正测试。
- 聚焦测试复跑通过：3 个测试文件、52 项测试通过。
- `npm run build` 第一次发现 `exportPipeline.ts` 遗留未用导入，已清理。
- `npm run build` 复跑通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动 CSS 收集/内联模块，不改变 Mermaid、图片、PDF capture/raster、PNG canvas、DOCX builder、真实文件写入或 Rust/Tauri native command。
- 因此未跑 `npm run tauri:build:app-smoke`；后续触及真实导出 worker 或最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍包含渲染节点创建、Mermaid/图片渲染、HTML/PDF/PNG/DOCX 具体实现。
- 下一步继续拆 render node / HTML format，避免一次性移动 PDF 或 DOCX 大块逻辑。

### Checkpoint 3D：HTML fragment 安全渲染工具分层

改动范围：

- `src/domains/export/render/htmlFragmentRenderer.ts`
- `src/domains/export/render/htmlFragmentRenderer.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出 HTML fragment 安全渲染工具：
  - `escapeHtml()`
  - `isUnsafeExportUrl()`
  - `sanitizeExportHtmlFragment()`
- `exportPipeline.ts` 继续在 Mermaid fallback、Pandoc citation HTML、standalone HTML metadata、DOCX visual HTML block 中复用这些工具，调用行为不变。
- 新增 `htmlFragmentRenderer.test.ts`，覆盖：
  - HTML metadata/fallback 文本转义。
  - `javascript:` / `data:` 协议识别为不安全。
  - hash、相对路径、站内绝对路径仍视为安全本地链接。
  - fragment sanitizer 移除 script、事件属性、危险 href/src，同时保留 `mark`、`kbd`、HTTPS 链接等受支持 inline HTML。

验证：

```bash
npm test -- --run src/domains/export/render/htmlFragmentRenderer.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、53 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动 HTML fragment 工具，不改变 Markdown 转 HTML、PDF 链接矩形、Mermaid、图片、PDF/PNG/DOCX 渲染或真实文件写入。
- 因此未跑 `npm run tauri:build:app-smoke`；后续触及真实导出 worker 或最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍包含渲染节点创建、Mermaid/图片渲染和各导出格式主体。
- 后续可继续将 PDF link rect 单独拆到 `pdf/pdfLinks.ts`，再拆 `createRenderedExportNode()` 和 standalone HTML 生成。

### Checkpoint 3E：PDF 链接矩形收集模块分层

改动范围：

- `src/domains/export/pdf/pdfLinks.ts`
- `src/domains/export/pdf/pdfLinks.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出 PDF link annotation 前置数据收集：
  - `ExportPdfLinkRect`
  - `normalizeExportExternalLink()`
  - `collectExportPdfLinkRects()`
- `exportPipeline.ts` 继续在 WebKit PDF capture 和 raster PDF 渲染后复用该模块，PDF overlay/link annotation 计算入口保持不变。
- 新增 `pdfLinks.test.ts`，覆盖：
  - HTTPS、mailto、protocol-relative URL 的归一化。
  - 本地绝对路径按 base URI 解析为可链接 URL。
  - hash-only、`javascript:`、`data:` 链接不进入 PDF annotation。
  - link rect 会相对导出 root 计算，并过滤过小 rect。

验证：

```bash
npm test -- --run src/domains/export/pdf/pdfLinks.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、52 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动 PDF 链接收集，不改变 PDF 页面渲染、PDF chrome overlay、PDF 写文件、PNG/DOCX/HTML 导出或 Rust/Tauri native command。
- 因此未跑 `npm run tauri:build:app-smoke`；后续触及真实导出 worker 或最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍包含 PDF capture/raster 主流程和 PDF chrome overlay。
- 后续可继续拆 `renderedExportNode` / `standaloneHtml`，然后再拆 PDF engine。

### Checkpoint 3F：Standalone HTML 生成模块分层

改动范围：

- `src/domains/export/render/standaloneHtml.ts`
- `src/domains/export/render/standaloneHtml.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出 `buildStandaloneHtml()`：
  - 继续复用 `collectExportCss()`、`escapeHtml()`、`getExportTitle()`、`markdownToHtml()` 和内容主题 write class。
  - HTML 导出仍用同一 builder 生成最终 `.html`。
  - PDF/PNG iframe 渲染仍用同一 builder 生成 raster-safe HTML。
- 新增 `standaloneHtml.test.ts`，覆盖：
  - title/author metadata HTML escaping。
  - `includeTheme: false` 时不内联 style。
  - 未传 renderedRoot 时从 Markdown 生成正文。
  - 传入 renderedRoot 时 clone 后移除 fixed-position inline style，并保留 dark body class。

验证：

```bash
npm test -- --run src/domains/export/render/standaloneHtml.test.ts src/domains/export/exportPipeline.test.ts src/domains/export/render/exportCss.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
git diff --check
```

结果：

- 第一次测试断言过于精确，未考虑既有 `markdownToHtml()` 会保留 `data-source-line` / `data-line`；已改为检查 `h1` 标签与文本。
- 聚焦测试复跑通过：4 个测试文件、54 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动 standalone HTML builder，不改变 rendered node 创建、Mermaid、图片、PDF/PNG/DOCX 渲染、真实文件写入或 Rust/Tauri native command。
- 因此未跑 `npm run tauri:build:app-smoke`；后续触及真实导出 worker 或最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍包含 rendered export node、standalone iframe 创建、Mermaid/图片渲染和各格式主体。
- 下一步可拆 rendered export node 或开始把 HTML export facade 从 pipeline 中移出。

### Checkpoint 3G：导出 canvas 限制工具分层

改动范围：

- `src/domains/export/render/canvasLimits.ts`
- `src/domains/export/render/canvasLimits.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出 PDF raster、PNG、SVG raster、DOCX visual block 共用的 canvas 限制工具：
  - `MAX_EXPORT_CANVAS_DIMENSION`
  - `MAX_EXPORT_CANVAS_AREA`
  - `assertExportCanvasWithinLimits()`
  - `isExportCanvasWithinLimits()`
- `exportPipeline.ts` 继续在原位置调用这些工具，错误文案和限制数值保持不变。
- 新增 `canvasLimits.test.ts`，覆盖：
  - 正常尺寸通过。
  - 单轴超过 16000 时拒绝。
  - 总面积超过 64000000 时拒绝。

验证：

```bash
npm test -- --run src/domains/export/render/canvasLimits.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、53 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动 canvas 限制工具，不改变 PDF/PNG/DOCX 渲染、html2canvas 参数、真实文件写入或 Rust/Tauri native command。
- 因此未跑 `npm run tauri:build:app-smoke`；后续触及真实导出 worker 或最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍包含大块渲染和格式主体逻辑。
- 后续可以继续拆 standalone iframe、Mermaid render、图片内联，或者进入 EditorPane phase 前先确认 Phase 3 阶段性收益。

### Checkpoint 3H：PDF chrome 文本工具分层

改动范围：

- `src/domains/export/pdf/pdfChromeText.ts`
- `src/domains/export/pdf/pdfChromeText.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出 PDF/DOCX 页眉页脚与页码文本工具：
  - `getPdfPageNumberLabel()`
  - `getPdfPageNumberY()`
  - `getPdfHeaderY()`
  - `getPdfFooterY()`
  - `normalizePdfChromeText()`
  - `formatPdfHeaderFooterText()`
  - `buildHeaderFooterTextParts()`
  - `hasHeaderFooterPageToken()`
  - `createPdfChromeTextImage()`
  - `HeaderFooterTextPart`
- PDF chrome overlay 和 DOCX header/footer 继续复用同一模块，页眉页脚 token 行为保持一致。
- 新增 `pdfChromeText.test.ts`，覆盖页码文本、坐标、模板 token 替换、160 字符截断和 DOCX page/pages field 分段。

验证：

```bash
npm test -- --run src/domains/export/pdf/pdfChromeText.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、53 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动 PDF/DOCX chrome 文本工具，不改变 PDF 页面渲染、PDF link annotation、DOCX 文档结构、真实文件写入或 Rust/Tauri native command。
- 因此未跑 `npm run tauri:build:app-smoke`；后续触及真实导出 worker 或最终收口时补真实 app smoke。

剩余风险：

- `exportPipeline.ts` 仍包含 PDF overlay 主流程、PDF engines、Mermaid/图片渲染和 DOCX builder。
- 后续可以把 PDF chrome overlay 主流程移动到 `pdf/pdfChrome.ts`，或先拆 Mermaid/image renderer。

## Phase 4：Editor runtime 与 command adapter 拆分

### Checkpoint 4A：编辑器标题与块格式命令 adapter

改动范围：

- `src/domains/editor/runtime/editorBlockCommands.ts`
- `src/domains/editor/runtime/editorBlockCommands.test.ts`
- `src/domains/editor/components/EditorPane.tsx`

实现结果：

- 从 `EditorPane.tsx` 的 app event effect 中抽出标题与块格式命令 adapter：
  - `applyHeadingLevel()`
  - `applyBlockFormatCommand()`
- `EditorPane.tsx` 继续监听 `editor.heading` 和 `editor.blockFormat` typed app events，但事件回调只负责取当前 view 和 detail，然后委托 adapter。
- 保留既有行为：
  - `h1` 到 `h6` 当前行标题替换。
  - paragraph / increaseHeading / decreaseHeading。
  - quote / orderedList / unorderedList / taskList 仍委托 source block operation。
  - insertAbove / insertBelow。
  - codeBlock / mathBlock / yaml / comment 等 prefix/suffix 插入。
- 新增 `editorBlockCommands.test.ts`，用真实 CodeMirror `EditorView` 验证标题、段落、标题升降级、source block 委托和 code block 包裹。

验证：

```bash
npm test -- --run src/domains/editor/runtime/editorBlockCommands.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/extensions/blockOperations.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、34 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动编辑器块命令 adapter，不改变 CodeMirror view 创建/销毁、history、search、table runtime、clipboard、图片粘贴或 DOM 事件协议。
- 因此未跑真实 app smoke；后续触及编辑器 runtime 生命周期或最终收口时补 `npm run tauri:build:app-smoke`。

剩余风险：

- `EditorPane.tsx` 仍包含 table runtime、clipboard/search、imperative handle、CodeMirror extension 装配和大块 app event command switch。
- 后续应继续拆 editor command switch 或 table runtime，避免一次性移动 CodeMirror 生命周期。

### Checkpoint 4B：编辑器表格 runtime 基础分层

改动范围：

- `src/domains/editor/runtime/editorTableRuntime.ts`
- `src/domains/editor/runtime/editorTableRuntime.test.ts`
- `src/domains/editor/components/EditorPane.tsx`

实现结果：

- 从 `EditorPane.tsx` 抽出表格 runtime 的基础公共层：
  - `EDITOR_TABLE_COMMANDS`
  - `applyMarkdownTableEdit()`
  - `runMarkdownTableNavigation()`
- `EditorPane.tsx` 继续保留 table toolbar / popover UI 状态和位置计算，只把底层表格编辑应用与键盘导航委托给 runtime。
- 新增 `editorTableRuntime.test.ts`，覆盖：
  - 命令 id 到 Markdown table command 的映射。
  - 真实 CodeMirror `EditorView` 中执行 table lineBreak 导航。
  - 非光标选区时 table navigation 不处理。

验证：

```bash
npm test -- --run src/domains/editor/runtime/editorTableRuntime.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/extensions/tables.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、42 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动表格 edit apply / navigation / command map，不改变 table toolbar UI、popover、表格算法、CodeMirror 生命周期、clipboard 或图片粘贴。
- 因此未跑真实 app smoke；后续触及表格 UI 行为或最终收口时补真实 app smoke。

剩余风险：

- `EditorPane.tsx` 仍包含表格 command/copy/convert/paste UI handlers、clipboard/search 和 CodeMirror extension 装配。
- 后续可以继续拆 editor command switch 或 clipboard/search runtime。

### Checkpoint 4C：编辑器搜索 runtime 分层

改动范围：

- `src/domains/editor/runtime/editorSearchRuntime.ts`
- `src/domains/editor/runtime/editorSearchRuntime.test.ts`
- `src/domains/editor/components/EditorPane.tsx`

实现结果：

- 从 `EditorPane.tsx` 的 imperative handle 中抽出搜索 runtime：
  - `execEditorSearch()`
  - `restoreEditorSearch()`
- `EditorPane.tsx` 继续暴露 `execSearch` / `restoreSearch` 给 `SplitView`，但只负责获取当前 CodeMirror view 后委托 runtime。
- 保留既有行为：
  - 输入搜索时启用隐藏 search highlighter、重置到文档起点并跳到首个匹配。
  - next / prev / all 继续使用 CodeMirror search command。
  - replace 成功且文档变化后继续跳到下一个匹配。
  - replaceAll 继续复用 CodeMirror replaceAll。
  - restoreSearch 继续按 `currentMatch` 重放 `findNext()`，恢复搜索面板重新打开后的匹配位置。
- 新增 `editorSearchRuntime.test.ts`，用真实 CodeMirror `EditorView` 覆盖 input/next、replace、replaceAll 和 restoreSearch。
- `EditorPane.tsx` 行数降到 1232 行；搜索命令操作不再散落在组件内部。

验证：

```bash
npm test -- --run src/domains/editor/runtime/editorSearchRuntime.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
git diff --check
```

结果：

- 聚焦测试通过：2 个测试文件、27 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动搜索 runtime，不改变搜索 UI、SplitView 搜索状态、CodeMirror view 生命周期、编辑器滚动、表格、clipboard、导出或文件系统行为。
- 因此未跑真实 app smoke；后续触及编辑器 runtime 生命周期或最终收口时补 `npm run tauri:build:app-smoke`。

剩余风险：

- `EditorPane.tsx` 仍包含 clipboard/image paste、scroll/typewriter、table UI handlers 和 CodeMirror extension 装配。
- 后续可继续拆 clipboard runtime 或 scroll runtime，再进入 Markdown core / workspace index 复用阶段。

### Checkpoint 4D：编辑器滚动跳转 runtime 分层

改动范围：

- `src/domains/editor/runtime/editorScrollRuntime.ts`
- `src/domains/editor/runtime/editorScrollRuntime.test.ts`
- `src/domains/editor/components/EditorPane.tsx`

实现结果：

- 从 `EditorPane.tsx` 的 imperative handle 中抽出滚动/跳转 runtime：
  - `jumpToEditorLine()`
  - `setEditorScrollRatio()`
  - `scrollEditorToLine()`
- `EditorPane.tsx` 继续暴露原有 `jumpToLine`、`setScrollRatio`、`scrollToLine`，但只负责取当前 CodeMirror view 后委托 runtime。
- 保留既有行为：
  - `jumpToLine` 仍 clamp 行号、移动光标、居中滚动、触发行闪烁，并在 2 秒后清除闪烁。
  - `setScrollRatio` 仍按 `scrollTop / maxScroll` 设置编辑器滚动位置。
  - `scrollToLine` 仍使用 CodeMirror 自身 `scrollIntoView(..., { y: 'start' })`，不移动光标。
- 新增 `editorScrollRuntime.test.ts`，覆盖行号 clamp 和闪烁清理调度、滚动比例计算、只滚动不移动选区。
- `EditorPane.tsx` 行数降到 1208 行；滚动跳转操作不再散落在组件 imperative handle 内。

验证：

```bash
npm test -- --run src/domains/editor/runtime/editorScrollRuntime.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
git diff --check
```

结果：

- 聚焦测试通过：2 个测试文件、26 项测试通过。
- 第一次 `npm run build` 暴露测试注入的 `setTimeout` 类型过宽；已收窄为 runtime 实际需要的调度器接口。
- `npm run build` 复跑通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动 imperative 滚动/跳转 runtime，不改变 scroll listener、横向滚动条、typewriter mode、table toolbar、clipboard、导出或文件系统行为。
- 因此未跑真实 app smoke；后续触及编辑器 runtime 生命周期或最终收口时补 `npm run tauri:build:app-smoke`。

剩余风险：

- `EditorPane.tsx` 仍包含 clipboard/image paste、table UI handlers、context menu handlers 和 CodeMirror extension 装配。
- Phase 4 若继续深化，下一步优先拆 clipboard/image paste runtime；否则可进入 Phase 5，把 Markdown core 与 workspace index 复用做深。

### Checkpoint 4E：编辑器剪贴板图片 runtime 分层

改动范围：

- `src/domains/editor/runtime/editorClipboardRuntime.ts`
- `src/domains/editor/runtime/editorClipboardRuntime.test.ts`
- `src/domains/editor/components/EditorPane.tsx`

实现结果：

- 从 `EditorPane.tsx` 抽出 clipboard/image runtime：
  - `insertTextAtSelection()`
  - `handleEditorClipboardImagePaste()`
  - `handleEditorImageDrop()`
- runtime 通过依赖注入读取当前文档、toast 文案、错误格式化和图片保存函数；不直接耦合 React store 或 i18n。
- `EditorPane.tsx` 继续负责事件监听和当前文档/i18n 接线，用户可见行为保持不变：
  - 粘贴图片前仍要求当前文档已保存。
  - 图片保存仍使用原有 `saveClipboardImage()` 和 assets 路径规则。
  - 拖拽图片按原逻辑保存到文档 assets。
  - Alt 拖拽仍优先插入原生文件路径 markdown 图片链接。
  - 粘贴/拖拽失败仍通过原 toast 文案提示。
- 新增 `editorClipboardRuntime.test.ts`，覆盖文本插入、剪贴板图片保存并插入 markdown、未保存文档提示、Alt 拖拽原生路径插入。
- `EditorPane.tsx` 行数降到 1144 行；clipboard/image paste 逻辑不再散落在组件内。

验证：

```bash
npm test -- --run src/domains/editor/runtime/editorClipboardRuntime.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
git diff --check
```

结果：

- 聚焦测试通过：2 个测试文件、27 项测试通过。
- 第一次 `npm run build` 暴露抽离后残留的未使用 `insertAtSelection` wrapper；已删除。
- `npm run build` 复跑通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只移动前端 clipboard/image paste runtime，不改变图片保存算法、Tauri 文件系统写入、表格粘贴、rich copy、CodeMirror view 生命周期或真实 app 拖拽验证。
- 因此未跑 `npm run tauri:build:app-smoke`；最终收口时补真实 app smoke。

剩余风险：

- `EditorPane.tsx` 仍包含表格 UI handlers、context menu handlers、rich copy command 分支和 CodeMirror extension 装配。
- Phase 4 的主要 runtime seam 已建立；后续可选择再拆 editor command switch，或进入 Phase 5 做 Markdown core / workspace index 复用。

## Phase 5：Markdown core、workspace index 与 preview/export 一致性

### Checkpoint 5A：Markdown document model 扩展图片和特殊块

改动范围：

- `src/domains/markdown/documentModel.ts`
- `src/domains/markdown/documentModel.test.ts`

实现结果：

- 在现有 `parseMarkdownDocumentModel()` 基础上新增结构化字段：
  - `images`：Markdown 图片引用，包含 alt、target、line、column。
  - `blocks`：特殊块占位，覆盖 Callout、`details` / Toggle、Mermaid fenced block、KaTeX block。
- 新增导出函数：
  - `extractMarkdownDocumentImages()`
  - `extractMarkdownDocumentBlocks()`
- 保留既有 front matter、heading、link 解析行为；图片仍不进入 `links`，避免 backlink 误判。
- 本 checkpoint 只扩展 Markdown core 的表达能力，不改 workspace index、诊断、预览、导出或 UI 调用方。

验证：

```bash
npm test -- --run src/domains/markdown/documentModel.test.ts src/domains/workspace/services/workspaceIndex.test.ts src/lib/markdownToHtml.test.ts
npm run build
git diff --check
```

结果：

- 聚焦测试通过：3 个测试文件、33 项测试通过。
- `npm run build` 通过；保留既有 KaTeX 动态导入和 Vite 大 chunk 警告。
- `git diff --check` 通过。

跳过项：

- 本 checkpoint 只增强 Markdown document model，不改变索引、诊断、预览渲染、导出渲染或真实 app 行为。
- 因此未跑真实 app smoke；后续让诊断/导出预检消费该 model 时补对应测试。

剩余风险：

- workspace index 当前只消费 front matter、headings、links；`images` / `blocks` 尚未进入索引或诊断。
- 下一步可让 image diagnostics 或 heading diagnostics 复用 document model，减少重复正则扫描。
