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
