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
