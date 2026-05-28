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

## Phase 1：前端 Tauri seam 收口

### 目标

在不新增 Rust command、不改变用户行为的前提下，把生产代码中直接调用 Tauri fs/path/dialog/opener/core 的入口统一迁到 `src/platform/tauri/` adapter 后面，为后续 Rust command DTO、结构化错误和领域服务迁移留 seam。

### 改动范围

- 新增 `src/platform/tauri/fileSystem.ts`，统一包装 `@tauri-apps/plugin-fs`。
- 新增 `src/platform/tauri/path.ts`，统一包装 `@tauri-apps/api/path`。
- 调整 `src/platform/tauri/opener.ts` 为惰性 wrapper，避免测试 mock 缺少完整导出时在 module import 阶段失败。
- 将以下生产代码的 Tauri fs/path/opener/core 直接 import 改为 platform adapter：
  - `src/lib/fileActions.ts`
  - `src/app/useSaveExportDialogModel.ts`
  - `src/hooks/useBootstrap.ts`
  - `src/domains/settings/store.ts`
  - `src/domains/settings/fontService.ts`
  - `src/domains/themes/themeStorage.ts`
  - `src/domains/themes/themeInstaller.ts`
  - `src/domains/document/fileSnapshot.ts`
  - `src/domains/document/services/fileSafety.ts`
  - `src/domains/document/services/recovery.ts`
  - `src/domains/document/components/OpenFileButton.tsx`
  - `src/domains/workspace/lib/loadFolderTree.ts`
  - `src/domains/workspace/hooks/useWorkspaceIndexModel.ts`
  - `src/domains/workspace/components/OpenFolderButton.tsx`
  - `src/domains/editor/components/PreviewPane.tsx`
  - `src/domains/editor/extensions/imageDiagnostics.ts`
  - `src/domains/editor/extensions/imagePaste.ts`
  - `src/domains/export/assets.ts`
  - `src/domains/export/exportPipeline.ts`
  - `src/domains/commands/categories/fileCommands.ts`

### 风险等级

中低。代码路径覆盖文件读取、保存、导出、设置、主题、工作区和图片诊断，但本 phase 只替换 import/adapter，不改变业务分支、数据结构或 UI。

### 验证

```bash
rg -n "@tauri-apps/(plugin-fs|api/path|plugin-dialog|plugin-opener|api/core)|\binvoke\(" src/domains src/lib src/hooks src/app --glob '!**/*.test.*'
npm test -- --run src/lib/fileActions.test.ts src/domains/settings/pathPersistence.test.ts src/domains/themes/themeInstaller.test.ts src/domains/themes/themeRegistry.test.ts src/domains/document/services/fileSafety.test.ts src/domains/document/services/recovery.test.ts src/domains/workspace/services/fileTree.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/domains/export/assets.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/categories/fileCommands.test.ts src/hooks/useBootstrap.test.tsx src/app/useSaveExportDialogModel.test.tsx src/domains/editor/components/PreviewPane.test.tsx
npm run build
git diff --check
```

结果：

- 生产代码直接 Tauri import audit：通过，除 `src/platform/tauri/` adapter 外无匹配。
- 聚焦测试：通过，14 个测试文件、129 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 是 adapter seam 收口，已覆盖文件、设置、主题、工作区、导出、命令、启动和预览相关聚焦测试。
- 未跑 `cargo test` / `cargo check`：本 phase 不改 Rust。
- 未跑真实 app smoke：本 phase 不改窗口生命周期、文件关联、Tauri capabilities、签名、打包、updater、安装器或发布链路。

### 剩余风险

- `src/platform/tauri/` 目前仍是轻量 wrapper，尚未引入统一 `PrismCommandError` 和 Result normalizer。
- 文件 IO、工作区索引、搜索、反链/图谱、导出任务、资源读取等仍主要由前端业务层驱动。
- 当前工作树仍有本 phase 之外的未提交改动；提交时需只 stage Phase 1 相关 hunk，避免混入图标、菜单、设置中心和插入块等无关改动。

## Phase 2：Rust command 错误模型落地

### 目标

建立 Rust/TypeScript 两侧统一的 native command 错误模型，让后续 Rust 化能力可以返回 `code/message/hint/path/stage`，同时不一次性重写旧 command 的返回类型。

### 改动范围

- 新增 `src-tauri/src/domain/mod.rs`。
- 新增 `src-tauri/src/domain/error.rs`：
  - `PrismCommandError`
  - `PrismResult<T>`
  - `with_hint` / `with_path` / `with_stage`
- 新增 `src-tauri/src/domain/path.rs`：
  - `canonicalize_existing_path(path, stage)`
  - `ensure_file(path, stage)`
  - `ensure_directory(path, stage)`
  - `path_to_string(path)`
- `src-tauri/src/lib.rs` 引入 `mod domain;`，并让旧 `canonicalize_existing_path` 复用 domain path helper，再继续向旧 command 暴露 `Result<PathBuf, String>`，保持前端行为不变。
- `src-tauri/src/commands/file_scope.rs` 复用 `ensure_file` / `ensure_directory`，但仍保留旧 command 的字符串错误返回。
- 新增 `src/platform/tauri/result.ts`：
  - `PrismCommandError`
  - `PrismNativeError`
  - `normalizeNativeError`
- `src/platform/tauri/nativeCommands.ts` 捕获 Tauri `invoke` 异常并统一转换为 `PrismNativeError`。
- 新增 `src/platform/tauri/result.test.ts` 覆盖结构化错误、旧字符串错误和重复归一化。

### 风险等级

中。`invokeNativeCommand` 现在会把 legacy string/native Error 包装成 `PrismNativeError`，错误的 `message` 保持兼容，但 `name/code` 会更结构化。正常成功路径不变。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test
cd src-tauri && cargo check
npm test -- --run src/platform/tauri/result.test.ts src/lib/fileActions.test.ts src/domains/settings/pathPersistence.test.ts src/domains/export/exportPipeline.test.ts src/hooks/useBootstrap.test.tsx
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test`：通过，16 个 Rust 测试。
- `cargo check`：通过。
- TS 聚焦测试：通过，5 个测试文件、73 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 影响 native command adapter 和 Rust domain helper，已覆盖 native command 调用方、导出、设置、启动和新增错误归一化测试。
- 未跑真实 app smoke：本 phase 不改用户可见 UI、窗口生命周期、file association、capabilities、打包、updater、签名或发布链路。

### 剩余风险

- 大多数旧 Rust command 仍返回 `Result<T, String>`，只是已有 domain error 基础设施。
- 前端 UI 层暂未按错误码做差异化 toast/modal/diagnostics；后续阶段需要逐步消费 `PrismNativeError.code`。
- 文件 IO、工作区索引、搜索、反链/图谱、导出任务和资源读取仍未迁到 Rust 主实现。

## Phase 3：Rust 文档 IO

### 目标

把打开文档、读取快照、写入文档的核心 IO 能力接入 Rust command，同时保留 TypeScript fallback，避免 native command 不可用时影响当前桌面写作链路。

### 改动范围

- 新增 `src-tauri/src/domain/document_io.rs`：
  - `FileSnapshotDto`
  - `DocumentFileSessionDto`
  - `WriteDocumentInput`
  - `DocumentWriteResult`
  - 文档读取、写入、快照、扩展名校验、外部修改/删除检测。
- 新增 `src-tauri/src/commands/document_io.rs`：
  - `get_file_snapshot`
  - `read_document_file`
  - `write_document_file`
- `src-tauri/src/commands/mod.rs`、`src-tauri/src/domain/mod.rs`、`src-tauri/src/lib.rs` 注册 document IO command。
- 新增 `src/platform/tauri/documentIo.ts` 作为前端 native adapter。
- 新增 `src/domains/document/services/documentIo.ts` 作为业务层 document IO seam：native-first，command 不可用或测试环境返回空 DTO 时 fallback 到旧 TS fs。
- `src/domains/document/fileSnapshot.ts` 改为优先 native 快照，native 不可用时 fallback 到 `stat`。
- `src/domains/document/services/fileSafety.ts` 继续作为文件安全边界，读写实现委托给 `documentIo`，并按 `PrismNativeError.code` 识别 missing / permission-denied。
- `src/domains/document/hooks/useAutoSave.ts` 写入时传入 `expectedSnapshot`，减少检测后写入前的竞态。
- `src/domains/commands/categories/fileCommands.ts` 保存/关闭前保存时把已验证快照传给写入层。
- `src/lib/fileActions.ts` 的打开文件、切换前保存、新建文件改走 document IO seam。
- `src/domains/document/components/OpenFileButton.tsx` 和 `src/hooks/useBootstrap.ts` 的打开文档路径改走 document IO seam。
- `src/platform/tauri/result.ts` 补充 native command unavailable 判断，支持测试环境和旧版本 fallback。

### 风险等级

中高。该阶段穿过打开、保存、自动保存、冲突检测和启动恢复路径。控制方式是 native-first + fallback，并保留既有 `fileSafety` 边界和现有 UI 调用形态。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test document_io
cd src-tauri && cargo check
npm test -- --run src/domains/document/services/fileSafety.test.ts src/domains/document/hooks/useAutoSave.test.tsx src/domains/document/services/conflictResolution.test.ts src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts src/platform/tauri/result.test.ts
npm test -- --run src/hooks/useBootstrap.test.tsx
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test document_io`：通过，4 个 Rust document IO 测试。
- `cargo check`：通过。
- 文档 IO / 保存冲突 TS 聚焦测试：通过，6 个测试文件、36 个测试。
- `useBootstrap` 聚焦测试：通过，1 个测试文件、6 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 已覆盖 document IO、文件安全、自动保存、冲突处理、文件命令、Finder 打开/切换和启动恢复。
- 未跑真实 app smoke：本 phase 不改窗口生命周期、file association、Tauri capabilities、安装器、签名、updater 或发布链路。真实打开/保存 smoke 留到文件 IO 与工作区树迁移稳定后集中做。

### 剩余风险

- `write_document_file` 已支持 `expectedSnapshot`，但部分另存为/覆盖路径仍按兼容旧行为写入，后续可继续细分 create-new / replace 语义。
- 前端仍有部分非文档正文 IO 直接走 TS fs，例如恢复快照文件、复制/重复文件、工作区树和导出资源。
- 后续 Phase 4/5 仍需把工作区树、索引和搜索从 WebView 迁到 Rust。
