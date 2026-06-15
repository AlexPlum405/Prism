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
  - `docs/archive/dirty-data-2026-05-30/prism-rust-core-modernization-goal.md`

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

## Phase 4：Rust 工作区文件树

### 目标

把工作区文件树扫描接入 Rust command，降低大目录扫描对 WebView 的压力，同时保持 `loadFolderTree(folderPath)` 作为前端唯一入口和 TS fallback。

### 改动范围

- 新增 `src-tauri/src/domain/workspace_tree.rs`：
  - `LoadWorkspaceTreeOptions`
  - `FileNodeDto`
  - Markdown / Text 文件筛选
  - 忽略目录规则
  - 最大递归深度
  - preview 提取
  - 空目录剪枝
  - 系统根目录保护
- 新增 `src-tauri/src/commands/workspace_tree.rs`：
  - `load_workspace_tree`
- `src-tauri/src/commands/mod.rs`、`src-tauri/src/domain/mod.rs`、`src-tauri/src/lib.rs` 注册 workspace tree command。
- 新增 `src/platform/tauri/workspaceTree.ts`。
- `src/domains/workspace/lib/loadFolderTree.ts` 改为 native-first，native 不可用或返回非数组时 fallback 到既有 TS `readDir` 实现。

### 风险等级

中。该阶段影响打开文件夹、刷新文件树、文件操作后刷新、Finder 打开文件时侧栏同步。通过保留 `loadFolderTree` 函数签名和 fallback 控制风险。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test workspace_tree
cd src-tauri && cargo check
npm test -- --run src/domains/workspace/services/fileTree.test.ts src/lib/fileActions.test.ts src/hooks/useBootstrap.test.tsx
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test workspace_tree`：通过，2 个 Rust workspace tree 测试。
- `cargo check`：通过。
- TS 聚焦测试：通过，3 个测试文件、23 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 已覆盖工作区树服务、文件操作刷新和启动恢复。
- 未跑真实 app smoke：本 phase 保留 TS fallback，且不改窗口、file association、capabilities、打包、签名或发布链路。

### 剩余风险

- Rust preview 提取是轻量规则，和前端旧实现保持方向一致但不是完整 Markdown AST。
- 子目录权限错误当前会跳过不可读 entry 或返回 workspace 读取错误，后续可接入 diagnostics warning。
- 工作区索引、全文搜索、反链和图谱仍由前端计算，Phase 5 继续迁移。

## Phase 5：Rust 工作区索引

### 目标

把工作区索引构建迁到 Rust，统一读取 Markdown 文档、解析标题/front matter/链接、生成反链和 recent 信息；搜索、反链展示和关系图谱算法继续复用前端现有逻辑，基于返回的 `WorkspaceIndex` 运行。

### 改动范围

- 新增 `src-tauri/src/domain/workspace_index.rs`：
  - `BuildWorkspaceIndexInput`
  - `CurrentDocumentOverride`
  - `RecentFileDto`
  - `WorkspaceIndexedDocumentDto`
  - `WorkspaceIndexDto`
  - heading/front matter/markdown link/wiki link 轻量解析
  - current document override
  - recent rank
  - backlinksByPath
- 新增 `src-tauri/src/commands/workspace_index.rs`：
  - `build_workspace_index`
- `src-tauri/src/commands/mod.rs`、`src-tauri/src/domain/mod.rs`、`src-tauri/src/lib.rs` 注册 workspace index command。
- 新增 `src/platform/tauri/workspaceIndex.ts`。
- 新增 `src/domains/workspace/services/workspaceIndexNative.ts`，把 native DTO 转回现有 `WorkspaceIndex` 的 `Map` 结构。
- `src/domains/workspace/hooks/useWorkspaceIndexModel.ts` 改为 native-first，native 不可用或返回无效 DTO 时 fallback 到原 TS `readWorkspaceIndexSources + buildWorkspaceIndex`。同时用稳定 `recentFilesKey` 避免数组引用变化导致反复 indexing。

### 风险等级

中高。该阶段影响快速打开、全文搜索、`[[` 链接补全、反链和图谱的数据源。控制方式是只迁 index build，保留前端搜索/图谱算法和 fallback。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test workspace_index
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/domains/workspace/services/backlinks.test.ts src/domains/workspace/services/relationGraph.test.ts
cd src-tauri && cargo check
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test workspace_index`：通过，1 个 Rust workspace index 测试。
- TS 工作区索引/反链/图谱聚焦测试：通过，4 个测试文件、10 个测试。
- `cargo check`：通过。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 已覆盖 workspace index hook、workspace index service、backlinks 和 relation graph。
- 未跑真实 app smoke：本 phase 保留 TS fallback，且不改 UI、窗口、file association、capabilities、打包、签名、updater 或发布链路。

### 剩余风险

- Rust Markdown parser 是第一版轻量规则，不是完整 Markdown AST；复杂链接、复杂 YAML 和标题 slug 未来可继续对齐前端 parser。
- 搜索和关系图谱算法仍在前端执行；后续可以把 search / relation graph 作为第二段 Rust 化。
- 大工作区索引目前仍是一次性 command 返回；后续如遇超大目录可改为 job/streaming。

## Phase 6：Rust 导出 Job

### 目标

导出渲染继续由现有 WebView / export pipeline 完成，只把导出任务状态、进度、成功、失败、取消标记迁到 Rust 管理；前端保留现有 `export.progress` event、toast、后台导出 UI 和失败诊断链路。

### 改动范围

- 新增 `src-tauri/src/domain/export_job.rs`：
  - `ExportJobDto`
  - `CreateExportJobInput`
  - `UpdateExportJobInput`
  - `CompleteExportJobInput`
  - `FailExportJobInput`
  - `ExportJobStore`
  - create/update/complete/fail/cancel/get/list 领域函数。
- 新增 `src-tauri/src/commands/export_jobs.rs`：
  - `create_export_job`
  - `update_export_job`
  - `complete_export_job`
  - `fail_export_job`
  - `cancel_export_job`
  - `get_export_job`
  - `list_export_jobs`
- `src-tauri/src/domain/error.rs` 为 `PrismCommandError` 增加 `Deserialize`，支持前端把结构化失败原因写回 Rust job。
- `src-tauri/src/commands/mod.rs`、`src-tauri/src/domain/mod.rs`、`src-tauri/src/lib.rs` 注册 export job store 和 commands。
- 新增 `src/platform/tauri/exportJobs.ts` 作为 native command adapter。
- 新增 `src/domains/export/jobs/exportJobClient.ts`，提供 native-first export job client；native command 不可用或测试环境返回无效 DTO 时使用本地内存 fallback。
- `src/domains/commands/categories/exportCommands.ts` 在导出开始后创建 job，在 `onProgress` 同步 job 进度，在导出成功/失败时写入 complete/fail job。现有导出 toast、后台按钮和失败诊断不变。

### 风险等级

中。该阶段触碰导出命令入口，但不改 HTML/PDF/PNG/DOCX 渲染、导出设置、清晰度策略、toast UI 或失败诊断 UI。Job 写入失败不会阻断真实文件导出。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test export_jobs
cd src-tauri && cargo check
npm test -- --run src/domains/commands/exportCommand.integration.test.ts src/hooks/useExportTaskUi.test.tsx src/domains/export/isolatedWebviewExport.test.ts
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test export_jobs`：通过，3 个 Rust export job 测试。
- `cargo check`：通过。
- 导出命令 / 导出 UI / isolated webview 聚焦测试：通过，3 个测试文件、5 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 的前端风险面集中在导出命令、导出任务 UI 和 isolated webview 导出，已跑对应聚焦测试；导出渲染 pipeline 本身没有重构。
- 未跑真实 app smoke：本 phase 不改窗口生命周期、file association、Tauri capabilities、打包、签名、updater 或安装器链路；导出文件行为由 integration test 覆盖。
- 未实现前台取消按钮：本 phase 已提供 Rust `cancel_export_job` 和前端 `throwIfExportCancelled` 基础能力，UI 入口与 pipeline 检查点可在后续专门阶段接入。

### 剩余风险

- 导出 job 当前仍是内存态，app 重启后不会恢复历史 running job。
- `useExportTaskUi.ts` 仍监听现有 app event，没有切到 job polling/订阅；这是为了保持现有 toast 与后台状态行为不变。
- pipeline 取消检查点尚未接入，用户触发取消后的真正中断能力需要后续阶段逐步把 `throwIfExportCancelled(jobId)` 放进 Mermaid/PDF/PNG/DOCX 长耗时节点。

## Phase 7：Rust 导出资源与预检

### 目标

把本地导出资源的解析、读取和图片资源预检能力接入 Rust command；前端仍保留现有 TS 路径和诊断 UI，避免影响 HTML/PDF/PNG/DOCX 渲染保真。

### 改动范围

- 新增 `src-tauri/src/domain/export_resources.rs`：
  - `ResolveResourceInput`
  - `ResourceRefDto`
  - `ResourceBytesDto`
  - `PreflightExportInput`
  - `ExportResourceDiagnosticDto`
  - 本地/外部/file URL/unsupported protocol/未保存相对路径解析
  - MIME 判断
  - 资源读取
  - Markdown 图片资源轻量预检
- 新增 `src-tauri/src/commands/export_resources.rs`：
  - `resolve_export_resource`
  - `read_export_resource`
  - `preflight_export`
- `src-tauri/src/commands/mod.rs`、`src-tauri/src/domain/mod.rs`、`src-tauri/src/lib.rs` 注册 export resource commands。
- 新增 `src/platform/tauri/exportResources.ts` 作为 native adapter。
- 新增 `src/domains/export/resources/exportResourceClient.ts`，提供 native-first resource client；native 不可用或测试环境返回无效 DTO 时 fallback 到现有 fs plugin。
- `src/domains/export/assets.ts` 的 `readLocalExportMedia()` 在已有同步路径解析通过后优先调用 Rust `read_export_resource`，失败再走 `readFile` fallback。
- `src/domains/export/preflight.ts` 的本地图片存在性检查优先走 Rust resource resolve，失败再走现有 `exists` fallback。
- `src/domains/export/assets.test.ts`、`src/domains/export/preflight.test.ts` 补充 native invoke mock，保持测试环境 fallback 行为稳定。

### 风险等级

中。该阶段影响本地图片读取和导出前图片缺失检测，但不改导出渲染器、不改诊断 UI、不改 Mermaid/KaTeX/表格/链接检查。所有 native resource 调用都保留 fallback。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test export_resources
cd src-tauri && cargo check
npm test -- --run src/domains/export/assets.test.ts src/domains/export/preflight.test.ts src/domains/export/exportPipeline.test.ts
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test export_resources`：通过，3 个 Rust export resources 测试。
- `cargo check`：通过。
- 导出资源 / 预检 / export pipeline 聚焦测试：通过，3 个测试文件、59 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 的主要风险面已由 assets、preflight、exportPipeline 覆盖。
- 未跑真实 app smoke：本 phase 不改窗口、file association、capabilities、打包、签名、updater 或安装器链路；导出资源行为由自动化测试覆盖。
- 未把所有链接/引用文件诊断迁入 Rust：当前先迁本地媒体资源解析与图片预检，链接、引用文件和复杂 Markdown AST 仍保留现有前端实现。

### 剩余风险

- Rust Markdown 图片扫描是轻量规则，复杂嵌套括号/引用式图片仍以现有前端诊断和 export pipeline 为主。
- 绝对路径资源仍按当前 Prism 兼容行为允许解析，权限错误只在读取阶段转为结构化错误。
- 资源读取返回 bytes 后仍由前端渲染和 DOCX/PDF 适配器决定如何处理 SVG、WebP 等格式。

## Phase 8：PDF capture 能力深化

### 目标

保持 WebView 渲染保真，同时让 native PDF capture 的平台能力检测明确化：macOS 使用 WebKit `createPDF`，Windows/Linux 直接走 raster fallback，不再把“不支持 native capture”当成一次失败导出来提示。

### 改动范围

- `src-tauri/src/commands/pdf_capture.rs` 新增：
  - `PdfCaptureCapability`
  - `get_pdf_capture_capability`
  - 平台能力判断：macOS `supported=true, engine=webkit_create_pdf`；Windows `supported=false, reason=webview2_pdf_capture_not_enabled`；Linux/其他平台 `supported=false, reason=webkitgtk_pdf_capture_not_enabled`。
- `src-tauri/src/lib.rs` 注册 `get_pdf_capture_capability`。
- 新增 `src/platform/tauri/pdfCapture.ts`，封装 native PDF capture capability/capture commands。
- 新增 `src/domains/export/pdf/pdfCaptureClient.ts`，提供 capability 读取和 capture 调用；旧版本或测试环境 capability command 不可用时保守保留旧 capture 尝试。
- `src/domains/export/exportPipeline.ts`：
  - `exportPdfWithWebkitCapture` 收口为 `exportPdfWithNativeCapture`。
  - Tauri export worker 中先读取 capability。
  - capability 支持时才进入 native capture。
  - capture 失败时保留现有 warning + raster fallback。
  - capability 不支持时直接 raster fallback，不额外 warning。
- `src/domains/export/exportPipeline.test.ts` 更新 native PDF 测试 mock，并增加“不支持 native capability 时直接 raster 且无 warning”的覆盖。

### 风险等级

中。该阶段影响 PDF 导出分支选择，但不改变 native capture 的实际分页/合成逻辑，也不改变 raster fallback 的清晰度和分页逻辑。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test pdf_capture
cd src-tauri && cargo check
npm test -- --run src/domains/export/exportPipeline.test.ts src/domains/export/pdf/pdfLinks.test.ts
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test pdf_capture`：通过，3 个 Rust pdf capture 测试。
- `cargo check`：通过。
- PDF export pipeline / PDF link 聚焦测试：通过，2 个测试文件、52 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 的风险面集中在 PDF capture 分支、PDF 链接和 fallback，已跑对应聚焦测试。
- 未跑真实 app smoke：本 phase 不改签名、安装器、updater 或 file association。macOS native capture 真实输出仍建议在发布打包前集中 smoke。
- 未实现 Windows native PDF capture：当前显式标记为 unsupported，按计划直接使用 raster pipeline。

### 剩余风险

- capability 只解决“是否进入 native capture”的决策，不优化 native capture 的具体速度。
- macOS native capture 仍依赖 WebKit `createPDF`，真实页面过高时仍按现有 batch 逻辑拆分。
- 文案仍沿用现有 WebKit fallback warning；后续如果要多平台统一措辞，可单独调整 i18n。

## Phase 9：设置和主题存储 Rust 化

### 目标

设置文件、主题目录、主题包 manifest/css 扫描、主题删除和主题目录打开接入 Rust/Tauri；设置中心 UI、主题包解析、ZIP 解压、主题 CSS 运行时注入逻辑不变。

### 改动范围

- 新增 `src-tauri/src/domain/settings_store.rs`：
  - `settings_config_path`
  - `read_settings_file_at`
  - `write_settings_file_at`
- 新增 `src-tauri/src/commands/settings_store.rs`：
  - `read_settings_file`
  - `write_settings_file`
- 新增 `src-tauri/src/domain/theme_store.rs`：
  - `themes_directory`
  - `ensure_themes_directory_at`
  - `read_theme_package_source_at`
  - `scan_installed_themes_at`
  - `delete_user_theme_at`
  - `ThemePackageSourceDto`
  - `ThemeScanResultDto`
- 新增 `src-tauri/src/commands/theme_store.rs`：
  - `get_themes_directory`
  - `scan_installed_themes`
  - `read_theme_package_source`
  - `delete_user_theme`
  - `open_themes_directory`
- `src-tauri/src/commands/mod.rs`、`src-tauri/src/domain/mod.rs`、`src-tauri/src/lib.rs` 注册 settings/theme store commands。
- 新增 `src/platform/tauri/settingsStorage.ts` 和 `src/platform/tauri/themeStore.ts`。
- `src/domains/settings/store.ts`：
  - `loadSettings()` 优先 `read_settings_file`，无 native 时 fallback 旧 appData path。
  - `saveSettings()` 优先 `write_settings_file`，无 native 时 fallback 旧 `appDataDir + writeTextFile`。
  - 旧版 config migration 逻辑保留。
- `src/domains/themes/themeStorage.ts`：
  - 主题目录优先由 Rust ensure/返回。
  - installed theme scan 优先 Rust 读取 manifest/css，再用现有 TS `parseThemeManifest` / `validateThemePackageInput` 做契约校验。
  - 主题删除、打开主题目录优先 Rust，失败 fallback 原 TS/opener 实现。
- `src/domains/settings/pathPersistence.test.ts` 更新 native command mock，让 legacy migration 继续覆盖 fallback 路径。

### 风险等级

中高。该阶段影响设置读写、主题列表、异常主题展示、主题目录打开和用户主题删除。控制方式是 native-first + TS fallback，并保留现有设置中心 UI 与主题校验逻辑。

### 验证

```bash
cd src-tauri && cargo fmt
cd src-tauri && cargo test settings_store
cd src-tauri && cargo test theme_store
cd src-tauri && cargo check
npm test -- --run src/domains/settings/pathPersistence.test.ts src/domains/themes/themeInstaller.test.ts src/domains/themes/themeRegistry.test.ts src/components/shell/SettingsModal.test.tsx
npm run build
git diff --check
```

结果：

- `cargo fmt`：已执行。
- `cargo test settings_store`：通过，1 个 Rust settings store 测试。
- `cargo test theme_store`：通过，1 个 Rust theme store 测试。
- `cargo check`：通过。
- 设置路径 / 主题安装解析 / 主题注册 / 设置中心聚焦测试：通过，4 个测试文件、24 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 phase 的风险面已由 settings path persistence、theme installer、theme registry 和 SettingsModal 聚焦测试覆盖。
- 未跑真实 app smoke：本 phase 不改窗口、file association、打包、签名、updater 或发布链路。
- 未把 ZIP / `.prism-theme` 解压迁到 Rust：当前继续使用前端 `fflate` 和既有校验，避免引入新的 Rust 解压依赖和更大行为变更。

### 剩余风险

- Rust theme scan 当前只做目录、manifest/css 读取；主题 manifest 语义校验、字体/预览图资源校验仍由 TypeScript 负责。
- 主题导入事务仍在前端实现，replace 失败恢复逻辑未迁入 Rust。
- 设置文件 schema normalize 仍在 TypeScript；Rust 只负责稳定读写和 appData 路径。

## Phase 10：前端体验层瘦身

### Checkpoint 10.1：导出 UI Controller

### 目标

在不改变用户可见行为和妙言风格的前提下，先抽出 App 中最独立的导出保存弹窗、导出进度 toast、导出失败弹窗，为后续继续拆分 App controller 留边界。

### 改动范围

- 新增 `src/app/controllers/ExportUiController.tsx`：
  - 导出/保存文件名弹窗
  - 导出清晰度选择
  - 覆盖确认
  - 普通 toast 渲染
  - 导出前台进度 toast
  - 导出失败诊断弹窗
- `src/App.tsx`：
  - 移除导出 UI 相关 JSX。
  - 保留 `useSaveExportDialogModel`、`useExportTaskUi`、`useAppToast` 状态归属，避免改变命令上下文和保存/导出请求链路。
  - 改为渲染 `ExportUiController`。
- App 行数：`849 -> 696`。本 checkpoint 未触碰 `EditorPane.tsx`，避免混入当前工作树中已有的编辑器/斜杠菜单/Callout 未提交改动。

### 风险等级

中。该 checkpoint 移动 App 渲染结构，但不改 hook 状态、事件、toast 类名、modal 类名、导出确认逻辑或文案。

### 验证

```bash
npm test -- --run src/app/useSaveExportDialogModel.test.tsx src/hooks/useExportTaskUi.test.tsx
npm test -- --run src/App.recovery.test.tsx src/domains/editor/components/EditorPane.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/runtime/editorBlockCommands.test.ts src/domains/editor/runtime/editorTableRuntime.test.ts src/domains/editor/runtime/editorClipboardRuntime.test.ts src/app/useSaveExportDialogModel.test.tsx src/hooks/useExportTaskUi.test.tsx
npm run build
git diff --check
```

结果：

- 导出保存弹窗 / 导出任务 UI 聚焦测试：通过，2 个测试文件、5 个测试。
- Phase 10 App/Editor 聚焦测试：通过，8 个测试文件、67 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未继续拆 `EditorPane.tsx`：当前工作树已有与插入图片、Callout、Toggle、斜杠菜单相关的未提交编辑器改动；本 checkpoint 不混入这些未提交改动。
- 未把 `App.tsx` 降到 350 行以内：本 checkpoint 先抽离导出 UI，后续还需继续抽 `DocumentSafetyController`、`DocumentPanelsController`、`WorkspaceController`。
- 未跑真实 app smoke：本 checkpoint 只移动前端 JSX 归属，不改 Tauri capability、窗口生命周期、file association、打包、签名或 updater。

### 剩余风险

- `App.tsx` 仍有 696 行，文档安全弹窗、文档面板、侧栏/状态栏 wiring 仍待拆分。
- `EditorPane.tsx` 仍有 1312 行，命令适配、表格控制、剪贴板控制和 runtime 初始化仍待继续拆。
- 新 controller 目前是 props-driven UI controller，下一步可把导出 UI hook wiring 一并迁入 controller，但需要先确认不会影响 command context 的 `requestExportPath` / `requestSavePath`。

### Checkpoint 10.2：文档安全 Controller

### 目标

继续缩小 `App.tsx` 的渲染职责，把未保存切换提示、恢复快照提示、保存冲突提示三类文档安全弹窗集中到独立 controller。该 checkpoint 只搬迁 JSX 归属，不改变恢复、丢弃、重载、另存为或覆盖保存逻辑。

### 改动范围

- 新增 `src/app/controllers/DocumentSafetyController.tsx`：
  - `DirtyDocumentSwitchModal`
  - `RecoveryModal`
  - `SaveConflictModal`
- `src/App.tsx`：
  - 移除三类文档安全弹窗的直接渲染。
  - 保留恢复、冲突处理、脏文档切换状态和 handler 归属。
  - 改为通过 `DocumentSafetyController` 传入当前状态和回调。
- App 行数：`696 -> 686`。本 checkpoint 未触碰 `EditorPane.tsx`，避免混入当前工作树中已有的编辑器/菜单/Callout 未提交改动。

### 风险等级

低。该 checkpoint 只移动 modal 渲染层，不改变状态机、事件处理、错误文案、按钮行为或样式类名。

### 验证

```bash
npm test -- --run src/App.recovery.test.tsx src/domains/document/components/DirtyDocumentSwitchModal.test.tsx src/domains/document/components/RecoveryModal.test.tsx src/domains/document/components/SaveConflictModal.test.tsx
npm run build
git diff --check
```

结果：

- 文档恢复 / 脏文档切换 / 保存冲突弹窗聚焦测试：通过，4 个测试文件、17 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 checkpoint 的风险面集中在文档安全 modal，已由对应聚焦测试覆盖。
- 未跑真实 app smoke：本 checkpoint 只移动 React JSX 归属，不改 Tauri capability、窗口生命周期、文件打开、打包、签名或 updater。
- 未继续拆 `EditorPane.tsx`：当前工作树已有与插入图片、Callout、Toggle、斜杠菜单相关的未提交编辑器改动，继续拆会增加混入无关改动的风险。

### 剩余风险

- `App.tsx` 仍有 686 行，文档诊断、属性、链接、反链、图谱、侧栏和状态栏 wiring 仍待拆分。
- Phase 10 的 App 层瘦身还未完成到 350 行以内。
- 后续若继续拆 `DocumentPanelsController` 或 `WorkspaceController`，仍需保持 props-driven 搬迁，避免同时重构状态归属。

### Checkpoint 10.3：文档面板 Controller

### 目标

继续缩小 `App.tsx` 的渲染职责，把文档诊断、反链、当前文档链接、关系图谱、文档属性和中文排版诊断面板集中到独立 controller。该 checkpoint 仍只搬迁 JSX 归属，不改变面板交互、样式、快捷键关闭、图谱懒加载或跳转逻辑。

### 改动范围

- 新增 `src/app/controllers/DocumentPanelsController.tsx`：
  - `DocumentDiagnosticsPanel`
  - `BacklinksPanel`
  - `DocumentLinksPanel`
  - lazy `RelationGraphPanel`
  - `DocumentPropertiesPanel`
  - `TypographyDiagnosticsPanel`
- 新增 `src/app/controllers/DocumentPanelsController.test.tsx`：
  - 覆盖诊断跳转和反链选择委托。
  - 覆盖关系图谱节点双击时先关闭面板再打开目标文档。
- `src/App.tsx`：
  - 移除上述面板组件和 `lazy` / `Suspense` 直接 import。
  - 保留 `useDocumentDiagnosticsModel`、`useDocumentNavigationModel`、文档属性状态和 handler 归属。
  - 改为渲染 `DocumentPanelsController`。
- 本 checkpoint 未触碰 `EditorPane.tsx`，也不提交当前工作树中已有的 SettingsModal 初始分区未提交改动。

### 风险等级

中低。该 checkpoint 移动多个面板渲染位置，但不改变面板内部实现、状态来源、回调语义、CSS 类名或可见文案。

### 验证

```bash
npm test -- --run src/app/controllers/DocumentPanelsController.test.tsx src/domains/editor/components/DocumentDiagnosticsPanel.test.tsx src/domains/editor/components/DocumentPropertiesPanel.test.tsx src/domains/editor/components/TypographyDiagnosticsPanel.test.tsx src/domains/workspace/components/BacklinksPanel.test.tsx src/domains/workspace/components/DocumentLinksPanel.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx
npm run build
git diff --check
```

结果：

- 文档面板 controller 与各面板聚焦测试：通过，7 个测试文件、16 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 checkpoint 的风险面集中在文档面板组合和回调转发，已由 controller 新测试和各面板既有测试覆盖。
- 未跑真实 app smoke：本 checkpoint 只移动 React JSX 归属，不改 Tauri capability、窗口生命周期、文件打开协议、打包、签名或 updater。
- 未继续拆 `EditorPane.tsx`：当前工作树已有与插入图片、Callout、Toggle、斜杠菜单相关的未提交编辑器改动，继续拆会增加混入无关改动的风险。

### 剩余风险

- `App.tsx` 仍承担侧栏、状态栏、全局 context menu、命令面板、关于/设置等 wiring。
- Phase 10 的 App 层瘦身仍未完成到 350 行以内。
- `DocumentPanelsController` 仍是 props-driven 组合层，后续如要进一步收敛，可在不改行为的前提下把文档面板状态聚合到专门 hook。

### Checkpoint 10.4：工作区 Controller

### 目标

继续缩小 `App.tsx` 的工作区渲染职责，把侧栏、编辑区容器、状态栏和全局 context menu 集中到 `WorkspaceController`。该 checkpoint 仍保留 App 对工作区状态、命令 handler、文件 action handler、editor ref 和文档视图实例的归属，不改变用户可见布局和交互。

### 改动范围

- 新增 `src/app/controllers/WorkspaceController.tsx`：
  - 渲染 `app-main`、侧栏、传入的文档视图、状态栏和全局 context menu。
  - 通过 props 转发 sidebar hover、文件点击、大纲跳转、状态栏按钮、导出菜单、工作区菜单和 context menu action。
  - 支持传入 `documentView`，让 App 继续持有 `DocumentView` 的 `editorRef`，避免在本 checkpoint 改动编辑器 ref 归属。
- 新增 `src/app/controllers/WorkspaceController.test.tsx`：
  - 覆盖侧栏 / 文档视图 / 状态栏组合渲染与新建文件按钮委托。
  - 覆盖全局 context menu action 按来源 kind 转发。
- `src/App.tsx`：
  - 移除 `StatusBar`、`Sidebar`、`ContextMenu` 直接渲染。
  - 保留 `DocumentView` 实例、`editorRef`、工作区状态、命令上下文、文件 action 和状态栏数据计算。
  - 改为渲染 `WorkspaceController`。
- 本 checkpoint 未触碰 `EditorPane.tsx`，也不提交当前工作树中已有的 SettingsModal 初始分区未提交改动。

### 风险等级

中。该 checkpoint 移动主工作区骨架、状态栏和 context menu 渲染位置，但不改变工作区 store、文件 action、命令系统、编辑器 ref、状态栏组件内部实现或 CSS 类名。

### 验证

```bash
npm test -- --run src/app/controllers/WorkspaceController.test.tsx src/domains/workspace/components/StatusBar.test.tsx
npm run build
git diff --check
```

结果：

- 工作区 controller 与状态栏聚焦测试：通过，2 个测试文件、9 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：本 checkpoint 的风险面集中在 workspace UI 组合、状态栏 wiring 和 context menu action 转发，已由新增 controller 测试与 StatusBar 既有测试覆盖。
- 未跑真实 app smoke：本 checkpoint 只移动 React JSX 归属，不改 Tauri capability、窗口生命周期、文件打开协议、打包、签名或 updater。
- 未继续拆 `EditorPane.tsx`：当前工作树已有与插入图片、Callout、Toggle、斜杠菜单相关的未提交编辑器改动，继续拆会增加混入无关改动的风险。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、文档恢复/冲突状态、导出 hook、文档导航 hook、设置/关于/命令面板等 wiring。
- Phase 10 的 App 层瘦身仍未完成到 350 行以内。
- `WorkspaceController` 目前仍是 props-driven 组合层；后续如要进一步瘦身，可把工作区 hover/context menu 状态收进专门 hook，但需要更完整 App smoke。

### Checkpoint 10.5：Editor runtime seam

### 目标

在不触碰当前未提交编辑器功能增量的前提下，为 `EditorPane.tsx` 拆分建立第一个 runtime seam：把 CodeMirror state/view 创建和当前标题折叠范围 helper 移出组件文件。该 checkpoint 是后续继续拆 `editorCommandAdapter`、table controller、clipboard controller 的安全落点。

### 改动范围

- 新增 `src/domains/editor/runtime/createEditorRuntime.ts`：
  - `createEditorRuntime`：集中创建 `EditorState` 和 `EditorView`。
  - `getEditorPhrases`：集中维护 CodeMirror 内置文案映射。
- 新增 `src/domains/editor/runtime/createEditorRuntime.test.ts`：
  - 覆盖 CodeMirror view 创建。
  - 覆盖 CodeMirror 文案映射。
- 新增 `src/domains/editor/runtime/editorCommandAdapter.ts`：
  - `getCurrentHeadingFoldRange`：从 `EditorPane.tsx` 移出当前标题折叠范围查找。
- `src/domains/editor/components/EditorPane.tsx`：
  - 改用 `createEditorRuntime` 创建编辑器实例。
  - 改从 runtime 引入 `getEditorPhrases` 和 `getCurrentHeadingFoldRange`。
- 本 checkpoint 未提交当前工作树中已有的插入图片、Callout、Toggle、斜杠菜单等编辑器功能未提交改动。

### 风险等级

中。该 checkpoint 触碰 CodeMirror 初始化入口，但只移动 state/view 创建和纯 helper，不改变扩展数组、事件监听、表格逻辑、剪贴板逻辑或编辑命令语义。

### 验证

```bash
npm test -- --run src/domains/editor/runtime/createEditorRuntime.test.ts src/domains/editor/components/EditorPane.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
git diff --check
```

结果：

- Editor runtime seam / EditorPane 聚焦测试：通过，3 个测试文件、45 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未把 `onAppEvent('editor.command')` 大 switch 整体迁到 `editorCommandAdapter`：当前 `EditorPane.tsx` 已有未提交的插入图片、Callout、Toggle、斜杠菜单功能增量，直接大拆会把无关改动混入本 goal。
- 未抽 table controller / clipboard controller：同上，当前编辑器区域存在未提交功能改动，本 checkpoint 先建立可验证 seam。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、文件打开协议、打包、签名或 updater。

### 剩余风险

- `EditorPane.tsx` 仍较大，command switch、table toolbar/action、paste/drop image 和 runtime extension 组装仍在组件内。
- `createEditorRuntime` 当前只接管 state/view 创建，还未完全接管 extension 组装。
- 若要继续完成完整 EditorPane 拆分，需要先处理或提交当前工作树中已有的编辑器功能增量，否则无法保证提交边界干净。

### Checkpoint 10.6：Editor table controller seam

### 目标

在不改变表格编辑行为的前提下，把表格浮动工具栏的位置计算从 `EditorPane.tsx` 移到 `editorTableController`。该 checkpoint 继续建立 EditorPane 拆分落点，但不触碰当前未提交的插入图片、Callout、Toggle、斜杠菜单功能增量。

### 改动范围

- 新增 `src/domains/editor/runtime/editorTableController.ts`：
  - `getEditorTableToolbarState`：根据选区、表格块和宿主 DOM 计算工具栏可见性与位置。
  - `HIDDEN_TABLE_TOOLBAR_STATE`：统一隐藏状态。
- 新增 `src/domains/editor/runtime/editorTableController.test.ts`：
  - 覆盖光标在 Markdown 表格内时的 fallback 坐标。
  - 覆盖非表格区域和范围选区时隐藏工具栏。
- `src/domains/editor/components/EditorPane.tsx`：
  - `updateTableToolbar` 改用 `getEditorTableToolbarState`。
  - 保留表格命令执行、复制、转换、粘贴和 toolbar state 设置归属。
- 本 checkpoint 未提交当前工作树中已有的插入图片、Callout、Toggle、斜杠菜单等编辑器功能未提交改动。

### 风险等级

中低。该 checkpoint 只移动表格 toolbar 坐标计算，不改变表格解析、命令执行、剪贴板、粘贴、转换或浮层组件。

### 验证

```bash
npm test -- --run src/domains/editor/runtime/editorTableController.test.ts src/domains/editor/runtime/createEditorRuntime.test.ts src/domains/editor/components/EditorPane.test.ts src/domains/editor/runtime/editorTableRuntime.test.ts
npm run build
git diff --check
```

结果：

- Editor table controller / EditorPane / table runtime 聚焦测试：通过，4 个测试文件、22 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未把所有 table action 完整迁入 `editorTableController`：当前工作树已有未提交编辑器功能增量，本 checkpoint 先迁纯计算，避免扩大提交边界。
- 未跑完整 `npm test -- --run`：风险面集中在表格 toolbar 计算与既有 table runtime，已由新增测试和既有表格测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、文件打开协议、打包、签名或 updater。

### 剩余风险

- `EditorPane.tsx` 仍保留表格命令 handler、表格复制/转换、paste/drop 和 command switch。
- `editorTableController` 当前只接管 toolbar state 计算，还不是完整 table controller。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响，需要先清理或提交这些功能改动后再安全推进。

### Checkpoint 10.7：Editor clipboard controller seam

### 目标

把编辑器 paste/drop 事件的分发逻辑从 `EditorPane.tsx` 移到 `editorClipboardController`，让组件只负责挂载 DOM 事件监听。该 checkpoint 不改变图片粘贴、图片拖放或表格粘贴行为，也不提交当前未提交的插入图片按钮逻辑。

### 改动范围

- 新增 `src/domains/editor/runtime/editorClipboardController.ts`：
  - `hasClipboardImage`
  - `hasDraggedImage`
  - `createEditorClipboardController`
- 新增 `src/domains/editor/runtime/editorClipboardController.test.ts`：
  - 覆盖剪贴板/拖拽图片判断。
  - 覆盖纯文本表格粘贴优先消费。
  - 覆盖图片 dragover 才阻止默认行为。
- `src/domains/editor/components/EditorPane.tsx`：
  - 将 paste/drop/dragover 事件分发改为调用 `clipboardController`。
  - 保留 image deps、notice、当前文档读取和事件监听挂载位置。
- 本 checkpoint 未提交当前工作树中已有的插入图片、Callout、Toggle、斜杠菜单等编辑器功能未提交改动。

### 风险等级

中。该 checkpoint 移动 paste/drop 事件分发逻辑，但复用既有 `editorClipboardRuntime`，不改变保存图片、插入 Markdown、错误提示或表格粘贴逻辑。

### 验证

```bash
npm test -- --run src/domains/editor/runtime/editorClipboardController.test.ts src/domains/editor/components/EditorPane.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/runtime/editorClipboardRuntime.test.ts
npm run build
git diff --check
```

结果：

- Editor clipboard controller / EditorPane / clipboard runtime 聚焦测试：通过，4 个测试文件、50 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未继续拆 command switch：当前工作树已有未提交编辑器功能增量，继续大拆会扩大提交边界。
- 未跑完整 `npm test -- --run`：风险面集中在 paste/drop 事件分发、图片粘贴/拖放和 EditorPane 集成，已由聚焦测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、文件打开协议、打包、签名或 updater。

### 剩余风险

- `EditorPane.tsx` 仍保留 command switch、表格命令 handler、表格复制/转换和多段 UI state。
- `editorClipboardController` 已接管事件分发，但 image deps 仍在组件内组装。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响，需要先清理或提交这些功能改动后再安全推进。

### Checkpoint 10.8：Editor command adapter 基础命令

### 目标

开始拆 `onAppEvent('editor.command')` 大 switch，把不依赖当前未提交功能增量的基础编辑命令迁到 `editorCommandAdapter`。本 checkpoint 只迁移 undo/redo/cut/copy/paste/selectAll/clearFormat/comment，不触碰插入图片、Callout、Toggle、模板、表格等分支。

### 改动范围

- 扩展 `src/domains/editor/runtime/editorCommandAdapter.ts`：
  - `runBasicEditorCommand`
  - 处理基础历史、剪贴板、全选、粘贴、清除格式、HTML 注释包装。
- 新增 `src/domains/editor/runtime/editorCommandAdapter.test.ts`：
  - 覆盖 `selectAll`。
  - 覆盖 `clearFormat`。
  - 覆盖非基础命令返回 `false`。
- `src/domains/editor/components/EditorPane.tsx`：
  - 从 command switch 前置调用 `runBasicEditorCommand`。
  - 移除 switch 内对应基础命令分支。
  - 移除 `undo` / `redo` / `markdownSelectionToRichClipboardInput` 直接依赖。
- 本 checkpoint 未提交当前工作树中已有的插入图片、Callout、Toggle、斜杠菜单等编辑器功能未提交改动。

### 风险等级

中。该 checkpoint 迁移真实命令分发逻辑，但范围限定在基础编辑命令，且保留原有命令语义和异步剪贴板行为。

### 验证

```bash
npm test -- --run src/domains/editor/runtime/editorCommandAdapter.test.ts src/domains/editor/runtime/createEditorRuntime.test.ts src/domains/editor/components/EditorPane.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
git diff --check
```

结果：

- Editor command adapter / EditorPane 聚焦测试：通过，4 个测试文件、48 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未迁移插入图片、Callout、Toggle、模板、表格相关命令：这些区域与当前未提交编辑器功能增量交织，继续迁移会增加混入无关改动的风险。
- 未跑完整 `npm test -- --run`：风险面集中在基础命令分发和 EditorPane 集成，已由 adapter 测试与 EditorPane 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、文件打开协议、打包、签名或 updater。

### 剩余风险

- `EditorPane.tsx` 仍保留非基础命令 switch、表格命令 handler、模板插入、折叠和当前未提交功能增量相关分支。
- `editorCommandAdapter` 目前只接管基础命令和标题折叠 helper，还不是完整 command adapter。
- 完整 EditorPane 拆分仍需要先处理当前未提交编辑器功能增量。

### Checkpoint 10.9：App lifecycle hook

### 目标

继续缩小 `App.tsx` 的窗口级总控职责，把平台标记、设置加载、启动 bootstrap、自动保存、外部文件变更监控、工作区 focus refresh、URL 同步、focus/typewriter body class 和 last session 持久化集中到独立 hook。该 checkpoint 不改变用户可见行为，也不提交当前工作树中已有的 SettingsModal 初始分区未提交改动。

### 改动范围

- 新增 `src/app/useAppLifecycleModel.ts`：
  - 接管 `useBootstrap(settingsReady)`。
  - 接管 `useAutoSave`、`useExternalFileChangeMonitor`、`useWorkspaceFocusRefresh`。
  - 接管运行平台 DOM 标记。
  - 接管当前文档 / 工作区路径到 URL search params 的同步。
  - 接管设置加载完成态。
  - 接管 focus mode / typewriter mode body class。
  - 接管 last session debounce 保存。
- `src/App.tsx`：
  - 移除上述 lifecycle effects 和直接 hook wiring。
  - 保留 selection reset、恢复/冲突、命令上下文、导出和面板 wiring。
- App 行数：工作树版本 `634 -> 543`；staged 版本会避开 SettingsModal 初始分区脏改。

### 风险等级

中。该 checkpoint 移动多个 App lifecycle effect，但不改变 effect 内容、依赖语义、store 读写目标或用户可见 UI。

### 验证

```bash
npm test -- --run src/App.recovery.test.tsx src/domains/document/hooks/useAutoSave.test.tsx src/domains/document/hooks/useExternalFileChangeMonitor.test.tsx src/domains/workspace/hooks/useWorkspaceFocusRefresh.test.tsx
npm run build
git diff --check
```

结果：

- App recovery / platform marker / export wiring 与 lifecycle 相关 hook 聚焦测试：通过，4 个测试文件、26 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 App lifecycle effects、平台标记、自动保存、外部文件变更和 workspace focus refresh，已由 App 与相关 hook 聚焦测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、文件打开协议、打包、签名或 updater。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 lifecycle 抽离无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、关于/设置/命令面板等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.10：App file actions hook

### 目标

继续缩小 `App.tsx` 的窗口级 orchestration 职责，把文件操作分发、脏文档切换提示和启动文件打开集中到独立 hook。该 checkpoint 不改变文件打开、新建、切换文档前保存确认或从 Finder/系统事件打开文件的行为，也不提交当前工作树中已有的 SettingsModal 初始分区未提交改动。

### 改动范围

- 新增 `src/app/useAppFileActionsModel.ts`：
  - 接管 `executeFileAction` 的 store/context wiring。
  - 接管 `requestDirtyDocumentAction` 与 dirty switch prompt 状态。
  - 接管 dirty switch prompt 的 resolve 逻辑。
  - 接管 `useStartupFileOpen` 到 `openFile` action 的转接。
  - 接管文件树点击打开文件的 `handleFileClick`。
- 新增 `src/app/useAppFileActionsModel.test.tsx`：
  - 验证文件 action 会携带保存路径请求和 toast 回调进入统一执行链路。
  - 验证 dirty switch prompt 在用户选择前保持，选择后 resolve 并清空。
  - 验证 startup file open 复用同一文件 action 路径。
- `src/App.tsx`：
  - 移除文件 action、startup open 和 dirty switch prompt 的直接状态/wiring。
  - 保留命令上下文、冲突处理、面板状态、导出和 workspace controller wiring。
- App 行数：staged 版本 `535 -> 499`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

中。该 checkpoint 移动文件操作入口的 wiring，但不改变 `executeFileAction` 本身、文件安全策略、保存路径选择、workspace store 更新或 native 文件打开事件来源。

### 验证

```bash
npm test -- --run src/app/useAppFileActionsModel.test.tsx src/app/useStartupFileOpen.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App file actions / startup open / App recovery 聚焦测试：通过，3 个测试文件、14 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 App 文件 action wiring、dirty switch prompt 和启动文件打开，已由新增 hook 测试、startup hook 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、打包、签名、updater、系统文件关联实现或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的文件 action 抽离无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、关于/设置/命令面板等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.11：App save conflict hook

### 目标

继续缩小 `App.tsx` 的文档安全 orchestration，把保存冲突处理 action、执行中状态、冲突态判断和冲突消失后的状态清理集中到独立 hook。该 checkpoint 不改变重载磁盘版本、另存当前版本、覆盖磁盘版本、缺失原文件重建或失败 toast 的用户行为。

### 改动范围

- 新增 `src/app/useAppSaveConflictModel.ts`：
  - 接管 `conflictAction` 状态。
  - 接管 `hasSaveConflict` 判断。
  - 接管 `reloadConflictedDocument` / `saveConflictedDocumentAs` / `overwriteConflictedDocument` 的分发。
  - 接管冲突处理成功和失败 toast。
  - 接管当前文档离开 conflict 状态后的 action 清理。
- 新增 `src/app/useAppSaveConflictModel.test.tsx`：
  - 验证 reload action 触发磁盘版本重载和成功 toast。
  - 验证 saveAs action 复用当前保存路径请求函数。
  - 验证缺失原文件 overwrite 使用重建成功文案。
  - 验证冲突处理异常会转成失败 toast。
- `src/App.tsx`：
  - 移除保存冲突 action 处理和错误格式化逻辑。
  - 保留 `DocumentSafetyController` 的 UI wiring。
- App 行数：staged 版本 `499 -> 465`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

中。该 checkpoint 移动保存冲突处理逻辑，但不改变底层 conflict resolution service、保存路径请求、toast key 或 `DocumentSafetyController` 交互入口。

### 验证

```bash
npm test -- --run src/app/useAppSaveConflictModel.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App save conflict / App recovery 聚焦测试：通过，2 个测试文件、12 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在保存冲突 action 分发和 App recovery，已由新增 hook 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、文件系统 service、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的保存冲突抽离无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、关于/设置/命令面板等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.12：App workspace context menu hook

### 目标

继续缩小 `App.tsx` 的 workspace wiring，把文件树右键菜单、导出按钮菜单、全局 context menu 状态和 action 分流集中到独立 hook。该 checkpoint 不改变菜单项、菜单位置、文件 action 分发或导出命令分发。

### 改动范围

- 新增 `src/app/useAppWorkspaceContextMenu.ts`：
  - 接管 `globalContextMenu` 状态。
  - 接管文件树菜单项创建和坐标记录。
  - 接管导出菜单项创建和当前 command context 注入。
  - 接管 context menu action 按 `file` / `menu` 来源分发。
  - 接管 context menu 关闭。
- 新增 `src/app/useAppWorkspaceContextMenu.test.tsx`：
  - 验证文件菜单会阻止默认事件并使用当前 file tree mode / sort mode。
  - 验证导出菜单会使用当前 command context 创建命令项。
  - 验证 action 根据来源分发到文件 action 或命令 action。
- `src/App.tsx`：
  - 移除 context menu state、菜单项创建和 inline action 分流。
  - 保留 `WorkspaceController` 的 UI wiring。
- App 行数：staged 版本 `465 -> 449`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低到中。该 checkpoint 只移动 workspace context menu 状态与分发，不改变 `WorkspaceController`、命令注册表、文件 action 或菜单样式。

### 验证

```bash
npm test -- --run src/app/useAppWorkspaceContextMenu.test.tsx src/app/controllers/WorkspaceController.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- Workspace context menu / WorkspaceController / App recovery 聚焦测试：通过，3 个测试文件、13 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 context menu 状态、菜单项创建和 action 分发，已由新增 hook 测试、WorkspaceController 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、文件系统 service、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 workspace context menu 抽离无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、关于/设置/命令面板等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.13：App writing stats hook

### 目标

继续缩小 `App.tsx` 的文档视图状态职责，把光标状态、选区文本、切换文档时清空选区、全文字数统计和选区字数统计集中到独立 hook。该 checkpoint 不改变状态栏展示、编辑器光标回传或选区统计行为。

### 改动范围

- 新增 `src/app/useAppWritingStatsModel.ts`：
  - 接管 `cursor` 状态。
  - 接管 `selectionText` 状态。
  - 接管当前文档路径变化后的选区清理。
  - 接管全文 `writingStats` 和选区 `selectionWritingStats` 计算。
- 新增 `src/app/useAppWritingStatsModel.test.tsx`：
  - 验证当前文档内容会生成全文统计。
  - 验证非空选区才生成选区统计。
  - 验证切换文档会清空选区统计。
- `src/App.tsx`：
  - 移除光标、选区和 `computeWritingStats` 的直接 wiring。
  - 保留 `DocumentView` 与 `WorkspaceController` 的状态传递。
- App 行数：staged 版本 `449 -> 441`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低。该 checkpoint 只移动 React 状态和既有 `computeWritingStats` 调用，不改变统计函数、状态栏 UI 或编辑器事件来源。

### 验证

```bash
npm test -- --run src/app/useAppWritingStatsModel.test.tsx src/domains/workspace/components/StatusBar.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- Writing stats / StatusBar / App recovery 聚焦测试：通过，3 个测试文件、18 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在光标/选区状态与字数统计，已由新增 hook 测试、StatusBar 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、文件系统 service、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 writing stats 抽离无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、关于/设置/命令面板等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.14：App auxiliary modals controller

### 目标

继续缩小 `App.tsx` 的弹窗 JSX 职责，把快捷键面板、命令面板和关于弹窗集中到独立 controller。该 checkpoint 不移动 SettingsModal，因为当前工作树中已有未提交的 SettingsModal 初始分区改动，继续保持提交边界干净。

### 改动范围

- 新增 `src/app/controllers/AppAuxiliaryModalsController.tsx`：
  - 接管 `ShortcutPanel` 渲染。
  - 接管 `CommandPalette` 渲染。
  - 接管 `AboutModal` 渲染。
  - 保持所有 visible、close、execute 和 check update 回调由 App 注入。
- 新增 `src/app/controllers/AppAuxiliaryModalsController.test.tsx`：
  - 验证快捷键面板关闭回调。
  - 验证命令面板关闭和执行回调。
  - 验证关于弹窗关闭和检查更新回调。
- `src/App.tsx`：
  - 移除上述三个 shell 组件的直接 JSX。
  - 仅保留 SettingsModal 的直接渲染，避免混入未提交设置中心改动。
- App 行数：staged 版本 `441 -> 434`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低。该 checkpoint 只移动弹窗 JSX 归属，不改变弹窗组件实现、状态来源、命令执行、检查更新或 UI 样式。

### 验证

```bash
npm test -- --run src/app/controllers/AppAuxiliaryModalsController.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App auxiliary modals / App recovery 聚焦测试：通过，2 个测试文件、9 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在辅助弹窗 JSX 归属和回调透传，已由新增 controller 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 auxiliary modals controller 无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、设置弹窗等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.15：App auxiliary modals model

### 目标

在 10.14 抽出辅助弹窗 JSX 后，继续把快捷键面板、命令面板和关于弹窗的 visible/open/close 状态集中到独立 model。该 checkpoint 不移动 SettingsModal 状态，因为当前工作树中已有未提交的 SettingsModal 初始分区改动。

### 改动范围

- 新增 `src/app/useAppAuxiliaryModalsModel.ts`：
  - 接管快捷键面板 visible/open/close。
  - 接管命令面板 visible、mode、快速打开、全文搜索和关闭。
  - 接管关于弹窗 visible/open/close。
- 新增 `src/app/useAppAuxiliaryModalsModel.test.tsx`：
  - 验证辅助弹窗的打开和关闭状态。
  - 验证全文搜索入口会以 `search` mode 打开命令面板。
- `src/App.tsx`：
  - 移除上述辅助弹窗的本地 state 与 open callbacks。
  - `handleAboutCheckUpdate` 改为调用 model 提供的 `closeAbout` 后执行检查更新命令。
- App 行数：staged 版本仍为 `434`；该 checkpoint 主要减少 App 直接管理的状态职责，而不是进一步减少 JSX 行数。

### 风险等级

低。该 checkpoint 只移动辅助弹窗状态，不改变弹窗组件、命令执行、快捷键入口、全文搜索入口或 UI 样式。

### 验证

```bash
npm test -- --run src/app/useAppAuxiliaryModalsModel.test.tsx src/app/controllers/AppAuxiliaryModalsController.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App auxiliary modals model/controller / App recovery 聚焦测试：通过，3 个测试文件、11 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在辅助弹窗状态和回调透传，已由新增 model 测试、controller 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 auxiliary modals model 无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、设置弹窗等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.16：App recovery model

### 目标

继续缩小 `App.tsx` 的文档安全状态职责，把恢复快照队列、恢复/丢弃回调和恢复提示显示条件集中到独立 model。该 checkpoint 不改变恢复提示显示规则，也保留 `shouldShowRecoveryPrompt` 的 App 级 re-export 以兼容既有测试。

### 改动范围

- 新增 `src/app/useAppRecoveryModel.ts`：
  - 接管 `useRecoveryQueue({ showToast })`。
  - 接管 `recoveryPromptVisible` 计算。
  - 导出 `shouldShowRecoveryPrompt` 供既有 App recovery 测试复用。
- `src/App.tsx`：
  - 移除恢复队列 hook 直连和本地恢复提示计算。
  - 通过 `useAppRecoveryModel` 向 `DocumentSafetyController` 传递恢复状态。
- App 行数：staged 版本 `434 -> 422`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低到中。该 checkpoint 移动恢复提示状态来源，但不改变恢复队列 hook、恢复快照 service、显示规则或弹窗 UI。

### 验证

```bash
npm test -- --run src/App.recovery.test.tsx src/domains/document/hooks/useRecoveryQueue.test.tsx
npm run build
git diff --check
```

结果：

- App recovery / recovery queue 聚焦测试：通过，2 个测试文件、14 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在恢复提示显示规则和 recovery queue wiring，已由 App recovery 与 recovery queue 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 recovery model 无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、文档属性状态、设置弹窗等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.17：App document properties model

### 目标

继续缩小 `App.tsx` 的文档面板状态职责，把文档属性面板的 visible/open/close 和应用 front matter 内容的回调集中到独立 model。该 checkpoint 不改变文档属性面板 UI、front matter 编辑或文档内容更新行为。

### 改动范围

- 新增 `src/app/useAppDocumentPropertiesModel.ts`：
  - 接管文档属性面板 visible/open/close。
  - 接管 `handleApplyDocumentProperties`，继续调用 `useDocumentStore.getState().updateContent(content)`。
- 新增 `src/app/useAppDocumentPropertiesModel.test.tsx`：
  - 验证文档属性面板打开和关闭状态。
  - 验证应用文档属性会更新文档内容。
- `src/App.tsx`：
  - 移除文档属性面板本地 state 和 apply callback。
  - `DocumentPanelsController` 改用 model 提供的 close/apply 回调。
- App 行数：staged 版本 `422 -> 424`；该 checkpoint 主要减少 App 直接管理的状态职责，新增 hook destructuring 使行数略增。

### 风险等级

低。该 checkpoint 只移动文档属性状态和既有 store 写入，不改变面板组件、front matter 解析、文档内容更新或 UI 样式。

### 验证

```bash
npm test -- --run src/app/useAppDocumentPropertiesModel.test.tsx src/app/controllers/DocumentPanelsController.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- Document properties model / DocumentPanelsController / App recovery 聚焦测试：通过，3 个测试文件、12 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在文档属性面板状态和文档内容更新回调，已由新增 model 测试、DocumentPanelsController 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、文件系统 service、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 document properties model 无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、设置弹窗等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.18：App workspace view controller

### 目标

继续缩小 `App.tsx` 的 workspace 渲染职责，把 `WorkspaceController` 加内嵌 `DocumentView` 的大段 JSX 集中到 App 层 controller。该 checkpoint 不改变侧栏、状态栏、文件树、DocumentView、光标、选区、outline 跳转或文件 action 行为。

### 改动范围

- 新增 `src/app/controllers/AppWorkspaceViewController.tsx`：
  - 接管 `WorkspaceController` 渲染。
  - 在 controller 内创建带 `editorRef`、当前文档 key、链接跳转、光标、选区和通知回调的 `DocumentView`。
  - 接管新建文件、文件树视图切换、outline 跳转、专注模式和侧栏切换的短回调转接。
- 新增 `src/app/controllers/AppWorkspaceViewController.test.tsx`：
  - 验证 `DocumentView` 会放入 `WorkspaceController` 并转发光标变化。
  - 验证新建文件、文件树视图切换和 outline 跳转走 App 桥接回调。
- `src/App.tsx`：
  - 移除直接渲染 `WorkspaceController` / `DocumentView` 的大段 JSX。
  - 改为向 `AppWorkspaceViewController` 传递同等状态和回调。
- App 行数：staged 版本 `424 -> 404`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

中。该 checkpoint 移动主要编辑区域与 workspace UI 的 JSX 归属，但不改变底层 `WorkspaceController`、`DocumentView`、store action、文件 action 或样式。

### 验证

```bash
npm test -- --run src/app/controllers/AppWorkspaceViewController.test.tsx src/app/controllers/WorkspaceController.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App workspace view / WorkspaceController / App recovery 聚焦测试：通过，3 个测试文件、12 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 workspace/controller JSX 归属和回调转接，已由新增 controller 测试、WorkspaceController 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater 或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 workspace view controller 无关。

### 剩余风险

- `App.tsx` 仍承担命令上下文、快捷键、导出 hook、文档导航 hook、设置弹窗等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.19：App command wiring model

### 目标

继续缩小 `App.tsx` 的命令系统接线职责，把命令上下文、全局快捷键注册和 About 弹窗里的检查更新回调集中到独立 model。该 checkpoint 不改变菜单结构、命令执行逻辑、快捷键行为、About 弹窗 UI 或更新检查实现。

### 改动范围

- 新增 `src/app/useAppCommandWiringModel.ts`：
  - 包装既有 `useAppCommandContext`，继续向 `App.tsx` 返回 `createCommandContext`、`handleCommandAction` 和 `menuSections`。
  - 接管 `handleAboutCheckUpdate`，保持先关闭 About 弹窗、再执行 `checkUpdate` 命令的既有顺序。
  - 在 model 内调用 `useAppShortcuts`，把快捷键注册从 `App.tsx` 抽离。
- 新增 `src/app/useAppCommandWiringModel.test.tsx`：
  - 验证命令上下文会接入 `useAppShortcuts`。
  - 验证 About 检查更新会先关闭弹窗再执行命令。
- `src/App.tsx`：
  - 用 `useAppCommandWiringModel` 替换直接调用 `useAppCommandContext` 和 `useAppShortcuts`。
  - 移除本地 `handleAboutCheckUpdate`。
- 工作树中仍有未暂存的 SettingsModal 初始分区改动；本 checkpoint 提交时会排除该无关 hunk。

### 风险等级

低。该 checkpoint 只移动命令/快捷键 wiring 的归属，不改变命令 registry、菜单模型、快捷键定义、更新检查命令或任何 UI 样式。

### 验证

```bash
npm test -- --run src/app/useAppCommandWiringModel.test.tsx src/app/useAppShortcuts.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App command wiring / App shortcuts / App recovery 聚焦测试：通过，3 个测试文件、12 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在命令 wiring、快捷键注册和 About 检查更新回调，已由新增 model 测试、App shortcuts 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 command wiring model 无关。

### 剩余风险

- `App.tsx` 仍承担导出 hook、文档导航 hook、设置弹窗状态等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.20：App document insight model

### 目标

继续缩小 `App.tsx` 的文档分析与导航接线职责，把编辑器行号跳转、文档诊断、文档链接、反向链接和关系图谱入口集中到独立 model。该 checkpoint 不改变诊断算法、链接解析、反链索引、图谱 UI、面板 UI 或任何视觉样式。

### 改动范围

- 新增 `src/app/useAppDocumentInsightModel.ts`：
  - 在 model 内创建共享的 `jumpToEditorLine`，统一转接到 `EditorPaneHandle.jumpToLine`。
  - 包装 `useDocumentDiagnosticsModel`，继续使用 Tauri `fs.exists` 作为图片/资源存在性检查。
  - 包装 `useDocumentNavigationModel`，继续复用现有文件打开、toast、工作区索引和图谱入口逻辑。
  - 合并返回 diagnostics 与 navigation 输出，供 `App.tsx` 原样传给现有 controller。
- 新增 `src/app/useAppDocumentInsightModel.test.tsx`：
  - 验证 diagnostics 与 navigation 共用同一个编辑器行号跳转转接。
  - 验证 `fs.exists`、文件树、rootPath、文件 action、toast、workspaceIndex 被正确传入下游 model。
- `src/App.tsx`：
  - 移除本地 `jumpToEditorLine`。
  - 移除直接调用 `useDocumentDiagnosticsModel` 和 `useDocumentNavigationModel`。
  - 改为调用 `useAppDocumentInsightModel`。
- App 行数：staged 版本 `396 -> 382`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低到中。该 checkpoint 移动诊断/导航 hook 的接线位置，并调整 hook 调用顺序，但不改变底层诊断、导航、面板、图谱、文件打开或样式实现。

### 验证

```bash
npm test -- --run src/app/useAppDocumentInsightModel.test.tsx src/app/useDocumentNavigationModel.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App document insight / Document navigation / App recovery 聚焦测试：通过，3 个测试文件、12 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 diagnostics/navigation wiring 与编辑器行号跳转转接，已由新增 model 测试、Document navigation 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 document insight model 无关。

### 剩余风险

- `App.tsx` 仍承担导出 hook、设置弹窗状态、workspace context menu 等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.21：App export UI model

### 目标

继续缩小 `App.tsx` 的导出 UI 接线职责，把 toast、后台导出进度、导出失败诊断、保存/导出路径弹窗和文件存在性检查集中到独立 model。该 checkpoint 不改变导出流程、保存弹窗 UI、导出 toast、后台导出状态栏或文件写入逻辑。

### 改动范围

- 新增 `src/app/useAppExportUiModel.ts`：
  - 在 model 内调用 `useAppToast`。
  - 在 model 内调用 `useExportTaskUi(showToast)`。
  - 在 model 内调用 `useSaveExportDialogModel`，继续注入 Tauri `fs.exists`、导出默认设置、工作区 rootPath 和 `showToast`。
  - 合并返回 toast、导出任务 UI 和保存/导出弹窗状态，供 `App.tsx` 原样传给现有 controller 与文件 action model。
- 新增 `src/app/useAppExportUiModel.test.tsx`：
  - 验证 toast 的 `showToast` 会传给导出任务 UI。
  - 验证保存/导出弹窗继续收到 `fs.exists`、exportDefaults、rootPath 和 `showToast`。
  - 验证合并返回值保持 App 需要的 toast、导出进度和导出路径请求。
- `src/App.tsx`：
  - 移除直接调用 `useAppToast`、`useExportTaskUi` 和 `useSaveExportDialogModel`。
  - 移除 App 对 Tauri `fs.exists` 的直接 import。
  - 改为调用 `useAppExportUiModel`。
- App 行数：staged 版本 `382 -> 376`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低到中。该 checkpoint 聚合导出 UI 相关 hook，涉及 toast 与保存/导出弹窗的接线位置，但不改变底层导出任务、文件存在性判断、保存路径确认、toast 或 controller UI。

### 验证

```bash
npm test -- --run src/app/useAppExportUiModel.test.tsx src/app/useSaveExportDialogModel.test.tsx src/hooks/useExportTaskUi.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App export UI / Save export dialog / Export task UI / App recovery 聚焦测试：通过，4 个测试文件、14 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在导出 UI wiring、toast、保存/导出弹窗和导出任务 UI，已由新增 model 测试、Save export dialog 测试、Export task UI 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或导出底层执行链路。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 export UI model 无关。

### 剩余风险

- `App.tsx` 仍承担设置弹窗状态、workspace context menu、标题派生等 wiring。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.22：App store snapshot model

### 目标

继续缩小 `App.tsx` 顶部的 store 与 i18n 读取职责，把当前文档、设置快照、workspace、locale 和窗口标题派生集中到独立 model。该 checkpoint 不改变 Zustand store、设置默认值、i18n runtime、标题显示规则或任何 UI 样式。

### 改动范围

- 新增 `src/app/useAppStoreSnapshotModel.ts`：
  - 集中读取 `useDocumentStore` 的当前文档。
  - 集中读取 `useSettingsStore` 中 App shell 需要的设置字段。
  - 集中读取 `useWorkspaceStore`。
  - 集中读取 `useI18n` 的 `locale` 与 `localePreference`。
  - 派生 `titleDocName` 与 `titleDirty`。
- 新增 `src/app/useAppStoreSnapshotModel.test.tsx`：
  - 验证 model 能收集文档、设置、workspace 和标题状态。
- `src/App.tsx`：
  - 移除直接 import document/settings/workspace store 和 i18n runtime。
  - 改为消费 `useAppStoreSnapshotModel` 返回的 snapshot。
  - 下游 model/controller 的输入改为从 `settings` snapshot 读取。
- App 行数：staged 版本 `376 -> 365`；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低到中。该 checkpoint 改变 App 读取 store 的位置和字段访问方式，但不改变 store 本身、状态更新函数、i18n 解析、标题规则或 controller UI。

### 验证

```bash
npm test -- --run src/app/useAppStoreSnapshotModel.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App store snapshot / App recovery 聚焦测试：通过，2 个测试文件、9 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 App store/i18n 读取与标题派生，已由新增 snapshot model 测试与 App recovery 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 store snapshot model 无关。

### 剩余风险

- `App.tsx` 仍承担设置弹窗状态、workspace context menu、部分 controller prop mapping。
- Phase 10 的 App 层瘦身仍未达到 350 行以内。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.23：App document insight grouped consumption

### 目标

完成 App 层 350 行以内的瘦身目标，把 `useAppDocumentInsightModel` 的大量拆包变量改为整体对象消费。该 checkpoint 不改变文档诊断、链接跳转、反链、关系图谱、面板 UI、命令行为或任何样式。

### 改动范围

- `src/App.tsx`：
  - 将 `useAppDocumentInsightModel` 的 20 多个返回字段保留在 `documentInsight` 对象上。
  - `AppWorkspaceViewController`、`DocumentPanelsController`、`ExportUiController` 和命令接线改为通过 `documentInsight.*` 访问同一批能力。
  - 保持所有下游 prop、回调和 controller 结构不变。
- App 行数：staged 版本 `365 -> 337`，达到 Phase 10 的 App 层 350 行以内目标；工作树中仍保留未暂存的 SettingsModal 初始分区改动。

### 风险等级

低。该 checkpoint 是同一 model 输出的消费方式调整，不改变下游模型、controller、UI、诊断、导航或文件 action 行为。

### 验证

```bash
npm test -- --run src/app/useAppDocumentInsightModel.test.tsx src/app/useDocumentNavigationModel.test.tsx src/App.recovery.test.tsx
npm run build
git diff --check
```

结果：

- App document insight / Document navigation / App recovery 聚焦测试：通过，3 个测试文件、12 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 document insight 输出消费方式，已由 App recovery 与 document insight/navigation 聚焦测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交 SettingsModal 初始分区相关脏改：该改动已存在于工作树，和本 checkpoint 的 document insight grouped consumption 无关。

### 剩余风险

- `App.tsx` 已低于 350 行，但仍有部分 controller prop mapping 可在后续批次继续整理。
- `EditorPane.tsx` 仍约 1202 行，尚未达到 Phase 10 的 500 行以内目标。
- 完整 EditorPane 拆分仍受当前未提交编辑器功能增量影响。


### Checkpoint 10.24：Editor appearance runtime

### 目标

继续推进 `EditorPane.tsx` 拆分，把 CodeMirror 外观、排版、主题、行号、自动换行和 Markdown 链接补全 extension 工厂移到独立 runtime。该 checkpoint 不改变编辑器初始化流程、主题视觉、补全行为、CodeMirror phrases、表格、剪贴板、搜索或任何 UI 样式。

### 改动范围

- 新增 `src/domains/editor/runtime/editorAppearanceRuntime.ts`：
  - 承载 editor appearance 相关 `Compartment`。
  - 承载暗色编辑器主题判断与 dark theme extension。
  - 承载行号、自动换行、内容主题、排版和链接补全 extension 工厂。
  - 继续复用 `contentThemeFacet`、slash menu completion 和 Markdown link completion。
- 新增 `src/domains/editor/runtime/editorAppearanceRuntime.test.ts`：
  - 验证主题暗色判断。
  - 验证编辑器排版 CSS 变量。
  - 验证行号与自动换行 extension 开关。
- `src/domains/editor/components/EditorPane.tsx`：
  - 移除本地 appearance helper 和 compartment 定义。
  - 改为从 `editorAppearanceRuntime` 导入同等能力。
- EditorPane 行数：staged 版本 `1034 -> 941`；工作树中仍保留未暂存的编辑器功能增量，未混入本 checkpoint。

### 风险等级

低到中。该 checkpoint 移动 CodeMirror 外观 extension 工厂和 compartment 定义，触及编辑器初始化配置，但不改变 extension 输出语义、事件监听、命令分发、表格、剪贴板或 UI 样式。

### 验证

```bash
npm test -- --run src/domains/editor/runtime/editorAppearanceRuntime.test.ts src/domains/editor/components/EditorPane.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
git diff --check
```

结果：

- Editor appearance runtime / EditorPane / EditorPane integration 聚焦测试：通过，3 个测试文件、47 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 editor appearance extension 工厂和 EditorPane 初始化集成，已由新增 runtime 测试、EditorPane 测试与 EditorPane integration 覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交当前工作树中的 Callout/插图/菜单/样式等功能脏改：这些改动已存在于工作树，和本 checkpoint 的 appearance runtime 拆分无关。

### 剩余风险

- `EditorPane.tsx` staged 版本已降到 941 行，但距离 500 行以内仍有较大差距。
- 当前工作树仍有未提交编辑器功能增量，继续大拆 command switch、table UI 或 popover layer 前需要持续精确暂存，避免混入无关功能改动。


### Checkpoint 10.25：Editor table model

### 目标

继续推进 `EditorPane.tsx` 拆分，把表格插入弹窗状态、浮动工具栏状态、表格命令、表格复制、表格转换、表格选中和表格粘贴处理集中到独立 hook。该 checkpoint 不改变表格命令语义、浮动工具栏 UI、插入弹窗 UI、剪贴板格式、表格导航或任何视觉样式。

### 改动范围

- 新增 `src/domains/editor/components/useEditorTableModel.ts`：
  - 维护 `tableInsertVisible` 与 `tableToolbar` 状态。
  - 包装 `getMarkdownTableCommandEdit`、`applyMarkdownTableEdit`、`getMarkdownTableSelection`、`getMarkdownTableSerialization`、`getMarkdownTableToHtmlEdit`、`getHtmlTableToMarkdownEdit` 和 `getMarkdownTablePasteEdit`。
  - 保持 HTML 表格复制继续走 `writeRichClipboard`，Markdown/CSV/TSV 继续走 `navigator.clipboard.writeText`。
  - 表格变更后继续调用 `getEditorTableToolbarState` 刷新浮动工具栏位置。
- 新增 `src/domains/editor/components/useEditorTableModel.test.tsx`：
  - 验证 hook 能对当前 editor view 执行表格命令。
  - 验证选中当前 Markdown 表格后隐藏浮动工具栏。
- `src/domains/editor/components/EditorPane.tsx`：
  - 移除本地表格状态与 handler 实现。
  - 改为消费 `useEditorTableModel` 返回的表格能力。
- EditorPane 行数：staged 版本 `941 -> 846`；工作树中仍保留未暂存的 Callout/插图/Toggle/菜单/样式等功能增量，未混入本 checkpoint。

### 风险等级

低到中。该 checkpoint 移动表格 UI model 与命令处理位置，涉及 CodeMirror 表格编辑、复制和粘贴回调接线，但底层表格 runtime、表格 parser、浮动工具栏组件和插入弹窗组件不变。

### 验证

```bash
npm test -- --run src/domains/editor/components/useEditorTableModel.test.tsx src/domains/editor/runtime/editorTableController.test.ts src/domains/editor/runtime/editorTableRuntime.test.ts src/domains/editor/components/EditorPane.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
git diff --check
```

结果：

- Editor table model / table controller / table runtime / EditorPane / EditorPane integration 聚焦测试：通过，5 个测试文件、50 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在表格 hook、表格 runtime、EditorPane 接线和集成行为，已由新增 hook 测试、表格 controller/runtime 测试、EditorPane 测试与 EditorPane integration 覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交当前工作树中的 Callout/插图/Toggle/菜单/样式/图标等功能脏改：这些改动已存在于工作树，和本 checkpoint 的 table model 拆分无关。

### 剩余风险

- `EditorPane.tsx` staged 版本已降到 846 行，但距离 500 行以内仍有差距。
- 当前工作树仍有未提交编辑器功能增量，继续拆 command switch、popover layer、剪贴板 model 或搜索/滚动接线前需要持续精确暂存，避免混入无关功能改动。


### Checkpoint 10.26：Editor command event model

### 目标

继续推进 `EditorPane.tsx` 拆分，把菜单、右键菜单和命令面板触发的编辑器事件订阅与命令路由集中到独立 hook。该 checkpoint 不改变格式化、标题、段落块、表格、模板、折叠、撤销/重做、复制/粘贴或右键菜单的业务实现。

### 改动范围

- 新增 `src/domains/editor/components/useEditorCommandEventModel.ts`：
  - 统一订阅 `editor.format`、`editor.heading`、`editor.blockFormat` 和 `editor.command`。
  - 统一处理右键菜单 action 到全局 command run event 的转发。
  - 保持 source block operation、表格命令、基础编辑命令、表格插入/复制/转换、模板插入和当前标题折叠的原有路由顺序。
  - 预留 `handleCustomEditorCommand` 扩展点，供后续编辑器功能增量在不改基础路由的情况下挂接特殊命令。
- 新增 `src/domains/editor/components/useEditorCommandEventModel.test.tsx`：
  - 验证格式化、表格、复制和模板事件能路由到对应 handler。
  - 验证未知编辑器命令可以交给功能扩展回调。
  - 验证右键菜单 action 会转发为全局 command run event 并保持 editor focus。
- `src/domains/editor/components/EditorPane.tsx`：
  - 移除本地 app event 订阅与 `onEditorCommand` switch。
  - 改为消费 `useEditorCommandEventModel` 返回的 `handleEditorContextMenuAction`。
- EditorPane 行数：staged 版本 `845 -> 742`；工作树中仍保留未暂存的 Callout/插图/Toggle/菜单/样式等功能增量，未混入本 checkpoint。

### 风险等级

中。该 checkpoint 移动编辑器命令事件路由，影响菜单、命令面板、右键菜单和快捷命令进入编辑器的路径，但底层编辑器 handler、表格 model、模板 model、block operation 和 UI 组件不变。

### 验证

```bash
npm test -- --run src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/editor/components/useEditorTableModel.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/components/EditorPane.test.ts
npm run build
git diff --check
```

结果：

- Editor command event model / Editor table model / EditorPane integration / EditorPane 聚焦测试：通过，4 个测试文件、48 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在编辑器命令事件路由、表格命令接线和 EditorPane 集成行为，已由新增 hook 测试、表格 hook 测试、EditorPane integration 与 EditorPane 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交当前工作树中的 Callout/插图/Toggle/菜单/样式/图标等功能脏改：这些改动已存在于工作树，和本 checkpoint 的 command event model 拆分无关。

### 剩余风险

- `EditorPane.tsx` staged 版本已降到 742 行，但距离 500 行以内仍有差距。
- 当前工作树仍有未提交编辑器功能增量，继续拆 runtime lifecycle、imperative handle、剪贴板 model、滚动/设置同步或 popover layer 前需要持续精确暂存，避免混入无关功能改动。


### Checkpoint 10.27：Editor action model

### 目标

继续推进 `EditorPane.tsx` 拆分，把格式化、模板插入、源码块操作和当前标题折叠这类纯 CodeMirror source action 移到独立 hook。该 checkpoint 不改变格式化语法、模板内容、源码块操作算法、折叠算法、命令事件路由或任何 UI 样式。

### 改动范围

- 新增 `src/domains/editor/components/useEditorActionModel.ts`：
  - 承载 `handleFormat`，继续复用 `getEditorFormatResult`。
  - 承载 `handleTemplateInsert`，继续复用 `getMarkdownTemplateInsertEdit` 和模板 id 校验。
  - 承载 `handleSourceBlockOperation`，继续复用 `getSourceBlockOperationEdit`。
  - 承载 `handleFoldCurrentHeading`，继续复用 `getCurrentHeadingFoldRange` 和 CodeMirror `foldEffect`。
- 新增 `src/domains/editor/components/useEditorActionModel.test.tsx`：
  - 验证选区加粗格式化。
  - 验证 PRD 模板插入。
  - 验证源码选区转任务列表操作。
- `src/domains/editor/components/EditorPane.tsx`：
  - 移除本地 action handler 实现。
  - 改为消费 `useEditorActionModel` 返回的 handler，并继续传给 `useEditorCommandEventModel` 与当前 UI 交互。
- EditorPane 行数：staged 版本 `742 -> 649`；工作树中仍保留未暂存的 Callout/插图/Toggle/菜单/样式等功能增量，未混入本 checkpoint。

### 风险等级

低到中。该 checkpoint 移动 source action handler 的定义位置，影响格式化、模板、源码块操作和折叠命令的接线，但底层算法、命令事件模型和 UI 不变。

### 验证

```bash
npm test -- --run src/domains/editor/components/useEditorActionModel.test.tsx src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/editor/components/useEditorTableModel.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/components/EditorPane.test.ts
npm run build
git diff --check
```

结果：

- Editor action model / Editor command event model / Editor table model / EditorPane integration / EditorPane 聚焦测试：通过，5 个测试文件、51 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 source action handler、命令事件路由和 EditorPane 集成行为，已由新增 hook 测试、命令事件 hook 测试、表格 hook 测试、EditorPane integration 与 EditorPane 测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交当前工作树中的 Callout/插图/Toggle/菜单/样式/图标等功能脏改：这些改动已存在于工作树，和本 checkpoint 的 action model 拆分无关。

### 剩余风险

- `EditorPane.tsx` staged 版本已降到 649 行，但距离 500 行以内仍有差距。
- 当前工作树仍有未提交编辑器功能增量，继续拆 runtime lifecycle、imperative handle、剪贴板 model、滚动/设置同步或 popover layer 前需要持续精确暂存，避免混入无关功能改动。


### Checkpoint 10.28：Editor runtime model

### 目标

完成 Phase 10 的 `EditorPane.tsx` 500 行以内目标，把 CodeMirror 初始化、内容同步、设置 reconfigure、粘贴/drop/滚动监听和编辑器 scroller 暴露集中到独立 runtime hook。该 checkpoint 不改变 CodeMirror extension 列表、快捷键、滚动回调、表格工具栏刷新、图片粘贴/drop、链接补全、主题 reconfigure 或任何 UI 样式。

### 改动范围

- 新增 `src/domains/editor/components/useEditorRuntimeModel.ts`：
  - 承载内容从 props 同步到 CodeMirror 的 effect。
  - 承载 CodeMirror mount-once 初始化，包括表格导航 keymap、搜索面板、Markdown/list/keymap、兼容主题高亮、选择监听、链接补全、主题与排版 extension。
  - 承载 contextmenu、paste、dragover、drop、scroll DOM listener 的注册与清理。
  - 承载 locale、dark theme、content theme、行号、自动换行、排版和链接补全的 reconfigure effect。
  - 返回 `getEditorScroller`，供现有水平滚动条组件继续读取 CodeMirror scroller。
- `src/domains/editor/components/EditorPane.tsx`：
  - 移除本地 CodeMirror 初始化和 runtime sync effects。
  - 改为调用 `useEditorRuntimeModel`。
  - 保留 `EditorPaneHandle`、编辑器 action model、命令事件 model、表格 model、右键菜单 UI、表格弹窗和水平滚动条 UI。
- EditorPane 行数：staged 版本 `649 -> 344`，达到 Phase 10 的 500 行以内目标；工作树中仍保留未暂存的 Callout/插图/Toggle/菜单/样式等功能增量，未混入本 checkpoint。

### 风险等级

中到高。该 checkpoint 移动 CodeMirror runtime lifecycle 和 DOM listener 注册位置，影响编辑器初始化、内容同步、粘贴/drop、滚动、链接补全和设置 reconfigure 接线，但不改变底层 extension、handler、runtime helper 或 UI 组件。

### 验证

```bash
npm test -- --run src/domains/editor/components/useEditorActionModel.test.tsx src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/editor/components/useEditorTableModel.test.tsx src/domains/editor/runtime/editorAppearanceRuntime.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/components/EditorPane.test.ts
npm run build
git diff --check
```

结果：

- Editor action model / Editor command event model / Editor table model / Editor appearance runtime / EditorPane integration / EditorPane 聚焦测试：通过，6 个测试文件、55 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 跳过项

- 未跑完整 `npm test -- --run`：风险面集中在 EditorPane runtime lifecycle、命令/动作/表格接线、appearance reconfigure 和编辑器集成行为，已由新增/既有编辑器聚焦测试覆盖。
- 未跑真实 app smoke：本 checkpoint 不改 Tauri capability、窗口生命周期、打包、签名、updater、安装器或 UI 布局。
- 未提交当前工作树中的 Callout/插图/Toggle/菜单/样式/图标等功能脏改：这些改动已存在于工作树，和本 checkpoint 的 runtime model 拆分无关。

### 剩余风险

- Phase 10 的 `App.tsx < 350` 与 `EditorPane.tsx < 500` 目标均已达成；仍可继续整理当前未提交功能增量带来的额外编辑器 UI 接线，但不再属于本阶段硬性行数目标。
- 当前工作树仍有未提交编辑器功能增量，后续若继续提交 Callout/插图/Toggle/菜单/样式/图标，应按各自功能 checkpoint 单独验证、单独提交。


## Rust Core Phase 2：工作区查询下沉

### 目标

把工作区索引 Module 从“Rust 构建完整索引、前端同步查询”加深为“Rust 持有索引缓存并执行快速打开/全文搜索查询”。前端命令面板继续保留 TypeScript fallback，但优先通过 native Adapter 传入 `rootPath/query/mode/limit/currentDocumentOverride/recentFiles` 这类小参数，避免每次输入都在 WebView 主线程遍历完整 `WorkspaceIndex`。

### 改动范围

- `src-tauri/src/domain/workspace_index.rs`
  - 新增 `QueryWorkspaceIndexInput`、`WorkspaceIndexQueryMode`、`WorkspaceIndexSearchResultDto`。
  - 拆出 `build_workspace_documents`，查询路径复用文档缓存，不为每个搜索词重算 backlink 图。
  - 新增 `query_workspace_index`，覆盖 quick open 排序、全文搜索、recent 空查询、当前未保存文档覆盖。
- `src-tauri/src/commands/workspace_index.rs` / `src-tauri/src/lib.rs`
  - 注册 `query_workspace_index` Tauri command。
- `src/platform/tauri/workspaceIndex.ts` / `src/domains/workspace/services/workspaceIndexNative.ts`
  - 新增 native query Adapter 与 DTO 校验。
- `src/components/shell/CommandPalette.tsx`
  - 命令面板先显示同步 TypeScript fallback，native 查询成功后替换结果。
  - command unavailable 时关闭 native 查询路径，保持 fallback。
  - 透传当前文档内容作为 override，避免 Rust 结果覆盖未保存文档搜索。
- `src/App.tsx` / `src/app/controllers/AppAuxiliaryModalsController.tsx`
  - 将当前文档透传到命令面板，仅用于 native 查询输入。

### 架构判断

这个阶段选择加深 Rust 工作区索引 Module，而不是新增一个浅 Seam。删除这个 Module 后，文件扫描、recent 排序、当前文档覆盖、全文匹配、结果排序和错误处理会重新散落到命令面板、hook 与 TS service 中；因此该 Module 的 Interface 虽然小，但背后承载了更高 Leverage。TypeScript Adapter 仍是真实 Seam：native 可用走 Rust Adapter，native 不可用走现有 TypeScript Implementation，Locality 集中在工作区查询层。

### 验证

```bash
cargo test --manifest-path src-tauri/Cargo.toml workspace_index
cargo test --manifest-path src-tauri/Cargo.toml
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/workspaceIndexNative.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/components/shell/CommandPalette.test.tsx src/app/controllers/AppAuxiliaryModalsController.test.tsx
npm run build
git diff --check
```

结果：

- Rust workspace_index 聚焦测试：通过，5 个测试。
- Rust 全量测试：通过，36 个测试。
- TS 工作区索引/Adapter/命令面板聚焦测试：通过，5 个测试文件、17 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 剩余风险

- Phase 2 当前只下沉快速打开和全文搜索；关系图谱与 backlink 面板仍使用前端 `WorkspaceIndex` 查询。
- native 查询每次仍会重新扫描工作区文件列表来判断活跃文档，虽然文件内容与解析结果会复用 Rust cache；后续可继续把 root-level file manifest / query cache 做成更深的 Module。


## Rust Core Phase 3：工作区索引后台 Job

### 目标

把工作区索引构建从“一次性 native command”推进为 Rust 侧有状态后台 job/session。前端 `useWorkspaceIndexModel` 只通过 `start / get / cancel` 这组小 Interface 管理索引状态；Rust Module 负责 job 状态、结果缓存、失败状态和同一 root 的旧 job 取消。大工作区不再因为超过 500 个 Markdown 文件就直接跳过 native 全文索引，只有 native job 不可用时才回退到轻量 metadata index。

### 改动范围

- 新增 `src-tauri/src/domain/workspace_index_job.rs`
  - `WorkspaceIndexJobStore`
  - `WorkspaceIndexJobDto`
  - `start_workspace_index_job`
  - `get_workspace_index_job`
  - `cancel_workspace_index_job`
  - 同一 root 新 job 会取消旧 running job，旧线程完成后不会覆盖取消状态。
- `src-tauri/src/commands/workspace_index.rs` / `src-tauri/src/lib.rs`
  - 注册 `WorkspaceIndexJobStore` Tauri state。
  - 新增 `start_workspace_index_job`、`get_workspace_index_job`、`cancel_workspace_index_job` commands。
- `src/platform/tauri/workspaceIndex.ts` / `src/domains/workspace/services/workspaceIndexNative.ts`
  - 新增 workspace index job native Adapter。
  - 校验并转换 native job DTO，完成态 job 的 `index` 继续复用 `workspaceIndexFromNativeDto`。
- `src/domains/workspace/hooks/useWorkspaceIndexModel.ts`
  - 从同步 native build 切换为 native job。
  - running job 轮询到 completed 后设置 base index。
  - effect cleanup 会请求取消未完成 job。
  - large workspace fallback 从“直接 metadata”改为“native job 不可用才 metadata”。

### 架构判断

Phase 3 加深的是工作区索引 Module 的状态管理能力，而不是把异步轮询细节散到 UI。删除该 Module 后，job id、running/completed/failed/cancelled 状态、同 root 旧 job 取消、完成结果缓存、错误传播会重新出现在 hook 与多个 command 调用点中；因此这个 Module 通过更小 Interface 提供更高 Leverage，并把 Locality 集中在 Rust native 能力层。TypeScript 侧仍保留 Adapter Seam：native job 可用时走 Rust，native 不可用时走既有 TypeScript Implementation。

### 验证

```bash
cargo test --manifest-path src-tauri/Cargo.toml workspace_index_job
cargo test --manifest-path src-tauri/Cargo.toml workspace_index
npm test -- --run src/domains/workspace/services/workspaceIndexNative.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx
```

当前已通过：

- Rust workspace_index_job 聚焦测试：通过，3 个测试。
- Rust workspace_index / workspace_index_job 聚焦测试：通过，8 个测试。
- TS workspaceIndexNative / useWorkspaceIndexModel 聚焦测试：通过，2 个测试文件、13 个测试。

### 剩余风险

- job 取消目前是状态级取消：running job 会被标记 cancelled，构建线程完成后不会写回结果；但正在进行的底层文件扫描仍可能继续跑到本次 build 返回。后续可以把 cancel token 继续下传到 `collect_workspace_files` 与文档解析循环，实现更细粒度的抢占式取消。
- `progress` 目前是阶段型进度（queued/build/completed），不是逐文件精确进度。后续可以在 `build_workspace_documents` 内部报告 scanned/parsed 计数。
- 关系图谱、backlinks 查询仍消费完整 `WorkspaceIndex`；下一阶段应把 `query_workspace_backlinks` / `query_relation_graph` 也挂到同一个 Rust index session 上，避免重复跨 WebView 搬运大对象。


## Rust Core Phase 4：反链与关系图谱查询下沉

### 执行前评估

结论：执行，收益为正。

Phase 3 已经让 Rust 侧持有 completed workspace index job，但反链和关系图谱仍在前端消费完整 `WorkspaceIndex`：

- `useDocumentNavigationModel` 从 `workspaceIndex.backlinksByPath` 同步读取当前文档反链。
- `RelationGraphPanel` 在 WebView 中调用 `buildRelationGraph(index, ...)`，每次 scope/depth/query/local active path 变化都会遍历完整 documents/links。
- 这两个能力属于 CONTEXT 中“页面链接、反向链接与关系图谱”和“快速打开与工作区搜索共用同一套工作区索引”的同一领域能力，应复用 Rust workspace index session。

收益判断：

- Leverage：同一个 Rust workspace index job 同时服务搜索、反链和图谱查询。
- Locality：反链和图谱的 link adjacency、backlink count、depth/query 过滤集中到 Rust Module。
- Interface 更小：前端从“持有完整 `WorkspaceIndex` 并计算”变为“传 `jobId/currentPath/scope/depth/query/limit`，收小 DTO”。
- 风险可控：保留现有 TypeScript Implementation 作为 fallback；native DTO 校验失败或 native 不可用时 UI 行为不变。

### 改动范围

- `src-tauri/src/domain/workspace_index.rs`
  - 新增 `get_workspace_index_backlinks(index, path)`。
  - 新增 `build_relation_graph(index, input)`，对齐 TS `buildRelationGraph` 的 current/workspace scope、depth、query、limit、node/edge 输出。
  - 新增 `RelationGraphDto` / node / edge / scope DTO。
- `src-tauri/src/domain/workspace_index_job.rs`
  - 新增 completed-job 查询入口，running job 返回 `workspace_index_job_not_ready`。
  - 新增 `query_workspace_backlinks` 与 `query_workspace_relation_graph`。
- `src-tauri/src/commands/workspace_index.rs` / `src-tauri/src/lib.rs`
  - 注册 `query_workspace_backlinks` 与 `query_workspace_relation_graph` commands。
- `src/platform/tauri/workspaceIndex.ts` / `src/domains/workspace/services/workspaceIndexNative.ts`
  - 新增 native Adapter 与 DTO 校验。
- `src/domains/workspace/hooks/useWorkspaceIndexModel.ts`
  - 暴露 `workspaceIndexJobId` 作为 Rust index session handle。
- `src/app/useDocumentNavigationModel.ts`
  - 反链查询 native-first；先设置 TS fallback，native 返回后替换。
- `src/domains/workspace/components/RelationGraphPanel.tsx`
  - 图谱数据 native-first；native 不可用或无 jobId 时继续使用 TS `buildRelationGraph`。
- `src/App.tsx` / `src/app/controllers/DocumentPanelsController.tsx`
  - 透传 `workspaceIndexJobId`。

### 完成后对比

| 项目 | Phase 4 前 | Phase 4 后 |
|---|---|---|
| 反链查询 | WebView 从完整 `WorkspaceIndex.backlinksByPath` 读当前 path | Rust completed job 返回当前 path 的 `BacklinkDto[]`，TS fallback 保留 |
| 图谱查询 | WebView 每次从完整 documents/links 构建 raw edges、adjacency、depth、query filter | Rust completed job 返回当前面板需要的 `RelationGraphDto`，TS fallback 保留 |
| 跨 Seam 数据 | 前端主路径依赖完整 `WorkspaceIndex` 对象 | 查询只传 `jobId/path` 或 `jobId/currentPath/scope/depth/query/limit` |
| 测试表面 | TS service + panel 测试覆盖前端 Implementation | Rust domain/job 测试 + TS Adapter/hook/panel 测试覆盖 native-first 和 fallback |
| 未完成点 | 图谱/反链未复用 Rust session | 已复用 Rust completed job；但 job 内部还不是逐文件可中断进度 |

### 验证

```bash
cargo test --manifest-path src-tauri/Cargo.toml workspace_index
npm test -- --run src/domains/workspace/services/workspaceIndexNative.test.ts src/app/useDocumentNavigationModel.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx src/domains/workspace/services/relationGraph.test.ts
cargo test --manifest-path src-tauri/Cargo.toml
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/workspaceIndexNative.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/app/useDocumentNavigationModel.test.tsx src/app/useAppDocumentInsightModel.test.tsx src/app/controllers/DocumentPanelsController.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx src/domains/workspace/services/relationGraph.test.ts src/components/shell/CommandPalette.test.tsx
npm run build
git diff --check
```

当前已通过：

- Rust workspace_index / workspace_index_job 聚焦测试：通过，11 个测试。
- TS native Adapter / 反链导航 / 图谱面板 / 图谱 fallback 聚焦测试：通过，4 个测试文件、17 个测试。
- Rust 全量测试：通过，42 个测试。
- TS 工作区/导航/图谱/命令面板聚焦测试：通过，9 个测试文件、35 个测试。
- `npm run build`：通过，Vite 仍输出既有 chunk size warning。
- `git diff --check`：通过。

### 后续 Phase 评估

- Phase 5（真正增量刷新）：收益为正，仍建议执行。Phase 4 解决“查询下沉”，Phase 5 解决“重复扫描/重复构建”。
- Phase 6（细粒度进度与可中断）：收益为正，但依赖 Phase 5 的 manifest/loop 改造；建议 Phase 5 后执行。
- Phase 7（`[[` 页面链接补全下沉）：收益为正，但依赖 Rust session 的 link-target 查询；建议 Phase 5/6 后执行。
- Phase 8（清理前端旧索引实现）：当前不执行。现在仍需要 TS fallback；过早删除会降低可靠性，是负收益。


## Rust Core Phase 5：Base index snapshot 增量刷新

### 执行前评估

结论：执行，收益为正，但不做过宽重构。

Phase 3/4 后，Rust 已经承担 workspace index job、搜索、反链和图谱查询。现状仍有一个成本点：每次 base index job 即使文件 manifest 未变化，也会重新执行 link resolution、backlinks map、recent documents 等完整 index 组装。Rust 已有 per-document cache，可以避免重复读取和解析未变文件，但完整 `WorkspaceIndexDto` 仍会被重新组装。

收益判断：

- Leverage：在 Rust workspace index Module 内部增加 base snapshot cache，不改变外部 Interface，却能让 job/search/backlinks/graph 的共同基础索引复用同一份完整快照。
- Locality：manifest 判断、snapshot 命中和失效逻辑集中在 Rust Module，不分散到 hook 或面板。
- 风险控制：仅当 `currentDocumentOverride=null` 且 `recentFiles=[]` 的 base index 构建才启用 snapshot；带 overlay 的查询继续走现有路径，避免缓存未保存内容。

### 改动范围

- `src-tauri/src/domain/workspace_index.rs`
  - `WorkspaceIndexCache` 增加 `base_index` 与 `base_index_signature`。
  - 新增 `WorkspaceFileSignature` 和 `workspace_manifest(files)`。
  - `build_workspace_index` 在 base input 且 manifest 未变化时直接返回上次 `WorkspaceIndexDto` 快照，并刷新 `generatedAt`。
  - manifest 变化后重建完整 index 并更新 snapshot。

### 完成后对比

| 项目 | Phase 5 前 | Phase 5 后 |
|---|---|---|
| 未变化工作区二次 base job | 复用单文件 parse cache，但仍重算完整 index/backlinks | manifest 命中时直接返回完整 base index snapshot |
| 带未保存文档或 recent overlay | 不走完整 snapshot | 仍不走完整 snapshot，避免未保存内容/最近文件污染 base cache |
| manifest 变化 | 重新构建 | 重新构建并更新 snapshot |
| Interface | `build_workspace_index` / job commands | 不变 |

### 验证

```bash
cargo test --manifest-path src-tauri/Cargo.toml workspace_index::tests::reuses_base_index_snapshot_until_manifest_changes
cargo test --manifest-path src-tauri/Cargo.toml
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/workspaceIndexNative.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/app/useDocumentNavigationModel.test.tsx src/app/useAppDocumentInsightModel.test.tsx src/app/controllers/DocumentPanelsController.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx src/domains/workspace/services/relationGraph.test.ts src/components/shell/CommandPalette.test.tsx
npm run build
git diff --check
```

当前已通过：

- Rust snapshot 聚焦测试：通过，验证 manifest 未变时复用 base snapshot，文件大小变化后 snapshot 失效并重建。
- Rust 全量测试：43 passed。
- 前端 workspace/search/backlinks/graph/command palette 相关测试：9 files / 35 tests passed。
- 生产构建：通过，仅保留既有 chunk size warning。
- diff 空白检查：通过。

### 后续 Phase 评估

- Phase 6（细粒度进度与可中断）：收益为正，建议执行。Phase 5 已有 manifest 概念，但 progress 仍是阶段型，cancel 仍是状态级。
- Phase 7（`[[` 页面链接补全下沉）：收益为正，建议在 Phase 6 后执行。
- Phase 8（清理前端旧索引实现）：仍跳过。TS fallback 仍有价值，当前删除是负收益。


## Rust Core Phase 6：细粒度进度与可中断索引构建

### 执行前评估

结论：执行，收益为正。

Phase 3 已把工作区索引变成 Rust job，但当时的取消仍是状态级：前端取消后 job 会被标记 `cancelled`，但底层扫描/解析循环可能继续跑到本次 build 返回。进度也只有 `queued -> build -> completed` 这种阶段型状态，对大工作区没有足够可见性。

收益判断：

- Leverage：在 Rust workspace index Module 增加内部 `WorkspaceIndexBuildOptions`，不扩大 Tauri command Interface，却让 job progress、cancel 和后续索引构建都复用同一个内部 Seam。
- Locality：取消检查、scan/parse/resolve/backlinks/finalize 进度集中在 Rust build Implementation，避免散落到 hook、panel 或 command polling。
- 性能修正：Phase 5 的 base snapshot 命中提前到 manifest 扫描之后、文档解析之前；未变化工作区的二次 base job 不再进入 parse/resolve/backlinks。

### 改动范围

- `src-tauri/src/domain/workspace_index.rs`
  - 新增 `WorkspaceIndexBuildOptions`、`WorkspaceIndexBuildProgress` 与 progress reporter。
  - `collect_workspace_files`、document parse、link resolve、backlinks 构建阶段都检查 cancel token。
  - base snapshot 命中提前到 manifest 后，命中时直接返回完整 index snapshot。
  - 保留原 `build_workspace_index(input)` Interface，新增内部 `build_workspace_index_with_options(input, options)` 供 job Module 使用。
- `src-tauri/src/domain/workspace_index_job.rs`
  - job 启动时把 `cancel_requested` token 和 progress reporter 传入 Rust build。
  - job progress 从粗 `build=0.2` 改成 scan/parse/resolve/backlinks/finalize 连续更新。

### 完成后对比

| 项目 | Phase 6 前 | Phase 6 后 |
|---|---|---|
| 取消 | 标记 job cancelled，但底层扫描/解析仍可能继续 | cancel token 下传到扫描、解析、解析链接和 backlinks 循环，能提前停止 |
| 进度 | queued/build/completed 粗阶段 | scan/parse/resolve/backlinks/finalize 多阶段进度 |
| 未变化 base job | snapshot 命中前仍会构建 documents | manifest 命中后直接返回 snapshot，跳过 parse/resolve/backlinks |
| 外部 Interface | start/get/cancel job commands | 不变 |
| 前端 fallback | TS fallback 保留 | 不变 |

### 验证

```bash
cargo test --manifest-path src-tauri/Cargo.toml workspace_index
cargo test --manifest-path src-tauri/Cargo.toml
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/workspaceIndexNative.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/app/useDocumentNavigationModel.test.tsx src/app/useAppDocumentInsightModel.test.tsx src/app/controllers/DocumentPanelsController.test.tsx src/domains/workspace/components/RelationGraphPanel.test.tsx src/domains/workspace/services/relationGraph.test.ts src/components/shell/CommandPalette.test.tsx
npm run build
git diff --check
```

当前已通过：

- Rust workspace_index / workspace_index_job 聚焦测试：14 passed。
- 新增覆盖：细粒度 progress 阶段、cancel token 中止、snapshot 命中跳过 parse。
- Rust 全量测试：45 passed。
- 前端 workspace/search/backlinks/graph/command palette 相关测试：9 files / 35 tests passed。
- 生产构建：通过，仅保留既有 chunk size warning。
- diff 空白检查：通过。

### 后续 Phase 评估

- Phase 7（`[[` 页面链接补全下沉）：收益为正，建议执行。当前 `[[` 补全仍依赖前端 overlay/index 数据，适合复用 Rust completed job 的 documents/headings。
- Phase 8（清理前端旧索引实现）：仍跳过。当前 native 仍需要 TS fallback 兜底，删除 fallback 对可靠性是负收益。
