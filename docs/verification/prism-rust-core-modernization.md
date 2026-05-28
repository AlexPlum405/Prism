# Prism Rust Core Modernization 验证记录

> 启动日期：2026-05-28
> 计划文件：`docs/prism-rust-core-modernization-implementation-plan.md`
> 目标：按 Phase 0 到 Phase 10 把 Prism 的本地能力层逐步迁到 Rust / Tauri，React / CodeMirror 继续负责编辑器、预览、设置中心、菜单、状态栏、弹窗、主题 CSS 和用户交互。

## 基线

- 当前 HEAD：`9560990 试用 16A 应用图标`，本地 `main` 与 `origin/main` 对齐。
- 本轮开始前已读：
  - `AGENTS.md`
  - `CONTEXT.md`
  - `docs/adr/0001-adopt-openai-minimal-design.md`
  - `docs/adr/0002-css-token-naming.md`
  - `docs/adr/0003-bundle-fonts-locally.md`
  - `docs/adr/0004-focus-mode-soft-dim.md`
  - `docs/adr/0005-adopt-miaoyan-style.md`
  - `docs/prism-rust-core-modernization-implementation-plan.md`
  - `docs/verification/`
  - 当前 `git status --short`
  - 当前 `git diff --stat`
  - 当前 `git diff --name-only`
- 当前关键文件行数：
  - `src/App.tsx`：849 行。
  - `src/domains/export/exportPipeline.ts`：2704 行。
  - `src/domains/editor/components/EditorPane.tsx`：1312 行。
  - `src-tauri/src/lib.rs`：103 行。
- 当前已有 Rust command 分组：
  - `src-tauri/src/commands/file_scope.rs`
  - `src-tauri/src/commands/pandoc.rs`
  - `src-tauri/src/commands/pdf_capture.rs`
  - `src-tauri/src/commands/settings.rs`
  - `src-tauri/src/commands/startup_files.rs`
  - `src-tauri/src/commands/system_open.rs`
  - `src-tauri/src/commands/trash.rs`

## 无关脏改识别

本轮开始时工作树已有多组未提交改动。执行 Rust Core Modernization 时必须只 stage 当前 phase 相关文件，不覆盖、不 reset、不 checkout、不 revert 这些既有改动。

明确避开的无关改动：

- 小熊猫/16A 图标与图标生成脚本：
  - `src-tauri/app-icon.png`
  - `src-tauri/icons/*`
  - `docs/assets/prism-icon-red-panda-*.png`
  - `scripts/generate-brand-icons.mjs`
  - `scripts/generate-windows-icon.mjs`
  - `package.json`
- 菜单、提示块、折叠块、插入图片等上一轮功能改动：
  - `src/domains/commands/categories/editorCommands.ts`
  - `src/domains/commands/menuModel.ts`
  - `src/domains/commands/registry.test.ts`
  - `src/domains/editor/components/EditorPane.tsx`
  - `src/domains/editor/components/EditorPane.integration.test.tsx`
  - `src/domains/editor/components/CalloutPickerPopover.tsx`
  - `src/domains/editor/extensions/calloutSnippets.ts`
  - `src/domains/editor/extensions/*`
  - `src/domains/i18n/*`
  - `src/styles/floating.css`
  - `src/styles/miaoyan.css`
- 设置中心指定页与导出设置入口等既有未提交改动：
  - `src/App.tsx`
  - `src/components/shell/SettingsModal.tsx`
  - `src/components/shell/SettingsModal.test.tsx`
  - `src/domains/commands/categories/exportCommands.ts`
- 本地 ignore 调整：
  - `.gitignore`
- Goal prompt 草稿：
  - `docs/prism-rust-core-modernization-goal.md`

## Phase 0：基线冻结

### 目标

记录当前行为和验证入口，不改业务代码，不做 Rust 原生 UI 重写，不移除 WebView，不重写 CodeMirror。

### 改动范围

- `docs/prism-rust-core-modernization-implementation-plan.md`
- `docs/verification/prism-rust-core-modernization.md`

### 风险等级

低。只新增/记录文档，不触碰 React、CodeMirror、Tauri command、Rust、文件系统、导出、设置中心或 UI 样式。

### 验证

```bash
git diff --check
git diff --check --cached
```

结果：

- `git diff --check`：通过。
- `git diff --check --cached`：通过。

### 跳过项

- 未跑 `npm test -- --run`：本 phase 不改 TypeScript/React 行为。
- 未跑 `npm run build`：本 phase 不改构建输入代码。
- 未跑 `cargo test` / `cargo check`：本 phase 不改 Rust。
- 未跑真实 app smoke：本 phase 不改文件关联、窗口生命周期、Tauri capabilities、native PDF capture、安装器、updater、签名或打包链路。

### 剩余风险

- Phase 1 到 Phase 10 尚未执行。
- 前端业务代码仍有多处直接 import Tauri fs/dialog/opener/core/path/event/window/webview 相关 API。
- 文档 IO、工作区树、工作区索引、导出 job、导出资源、PDF capture capability、设置/主题存储仍未按本计划迁到 Rust 主实现。
- `App.tsx` 和 `EditorPane.tsx` 仍未按本计划进一步瘦身。
