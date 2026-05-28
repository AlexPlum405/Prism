# Prism Rust Core Modernization 实施计划

> 状态：待实施
> 日期：2026-05-28
> 范围：Prism 本地能力层 Rust 化，不做 Rust 原生 UI 重写
> 目标：React / CodeMirror 继续负责写作体验，Rust / Tauri 接管文件系统、工作区索引、搜索、反链/图谱数据、导出任务、PDF capture、资源读取、系统集成和错误诊断。

## 1. 背景与结论

Prism 当前是 Tauri 2 + React + TypeScript 架构。用户可见的编辑器、预览、设置中心、菜单、状态栏、弹窗、主题 CSS、用户交互都运行在系统 WebView 中。这个选择对 Markdown 写作器是合理的，因为 CodeMirror、HTML 预览、Mermaid、KaTeX、CSS 主题和导出保真都依赖成熟 Web 能力。

本计划不做以下事情：

- 不把 UI 改成 egui / Iced / Slint / SwiftUI / Qt。
- 不移除 WebView。
- 不重写 CodeMirror 编辑器。
- 不改变当前妙言风格。
- 不改变单文档单窗口定位。
- 不做插件市场、云同步、实时协作、移动端或数据库式 Properties。

本计划要做的是把当前散在前端里的重 IO、系统集成和后台能力逐步移动到 Rust。最终结构：

```text
React / CodeMirror:
- 编辑器
- 预览
- 设置中心
- 菜单、状态栏、弹窗
- 主题 CSS
- 用户交互

Rust / Tauri:
- 文件系统
- 工作区索引
- 搜索
- 反链/图谱数据
- 导出任务
- PDF capture
- 资源读取
- 系统集成
- 错误诊断
```

## 2. 当前代码基线

当前主要架构压力点：

- `src/App.tsx`：窗口级总控，约 800+ 行，承担文档、导出、恢复、冲突、诊断、面板、菜单、快捷键等职责。
- `src/domains/export/exportPipeline.ts`：约 2700+ 行，HTML/PDF/PNG/DOCX、Mermaid、KaTeX、图片、分页、WebKit PDF、DOCX OpenXML 修补混在同一个 module。
- `src/domains/editor/components/EditorPane.tsx`：约 1100+ 行，CodeMirror 初始化、命令事件、表格、搜索、图片粘贴、右键菜单、滚动条、toolbar 混在一起。
- `src/domains/workspace/hooks/useWorkspaceIndexModel.ts`：前端批量读取 Markdown 文件并构建索引，大工作区可能拖慢 WebView。
- `src/lib/fileActions.ts`：文件操作、文档切换保护、文件树刷新、系统打开、toast 处理交织。
- `src-tauri/src/lib.rs` 和 `src-tauri/src/commands/*`：已有 Rust commands，但还未形成完整本地能力层。

已有正向基础：

- 已有领域目录：`document`、`editor`、`export`、`workspace`、`themes`、`commands`、`settings`、`diagnostics`。
- 已有 typed app events：`src/platform/events/appEvents.ts`。
- 已有部分 Tauri adapter：`src/platform/tauri/nativeCommands.ts`、`dialogs.ts`、`opener.ts`。
- 已有 Rust command 分组：`file_scope`、`pandoc`、`pdf_capture`、`startup_files`、`system_open`、`trash`、`settings`。
- 测试覆盖较多，适合行为保持型重构。

## 3. 架构原则

### 3.1 先建 seam，再迁实现

每个阶段先定义前端 TypeScript interface 和 Rust command DTO。第一步让旧实现挂到新 interface 后面，第二步再切 Rust implementation。不要直接删旧路径。

### 3.2 每个阶段都要有 fallback

Rust 化能力至少保留一个发布周期的 TypeScript fallback。例外：明确只能由系统层实现的能力，例如 macOS WebKit PDF capture。

### 3.3 Rust 接管本地能力，不接管编辑体验

Rust 不负责 UI、CodeMirror、预览 DOM、CSS 主题、Mermaid/KaTeX DOM 渲染。Rust 负责资源、路径、任务、索引、扫描、系统能力和结构化错误。

### 3.4 错误必须结构化

前端不能再只展示底层字符串。Rust command 统一返回错误码、阶段、路径、用户建议。前端按错误码决定 toast、modal、diagnostics。

### 3.5 验证按风险分层

小 adapter 迁移不跑完整 app smoke。涉及文件安全、导出、Rust command、系统窗口、文件关联时才跑真实 app smoke。

## 4. 目标目录

### 4.1 前端目标目录

```text
src/
  platform/
    events/
      appEvents.ts
      eventTypes.ts
    tauri/
      nativeCommands.ts
      result.ts
      fileSystem.ts
      dialogs.ts
      opener.ts
      path.ts
      documentIo.ts
      workspaceTree.ts
      workspaceIndex.ts
      exportJobs.ts
      exportResources.ts
      pdfCapture.ts
      settingsStorage.ts
      themeStorageNative.ts

  domains/
    document/
      services/
        documentIo.ts
        documentSession.ts
        fileSafety.ts
        recovery.ts
    workspace/
      services/
        workspaceTreeClient.ts
        workspaceIndexClient.ts
        workspaceSearch.ts
        relationGraph.ts
    export/
      jobs/
        exportJobClient.ts
      resources/
        exportResourceClient.ts
      pdf/
        pdfCaptureClient.ts
    editor/
      runtime/
        createEditorRuntime.ts
        editorCommandAdapter.ts
        editorTableController.ts
        editorClipboardController.ts
```

### 4.2 Rust 目标目录

```text
src-tauri/src/
  lib.rs
  commands/
    mod.rs
    document_io.rs
    workspace_tree.rs
    workspace_index.rs
    workspace_search.rs
    export_jobs.rs
    export_resources.rs
    pdf_capture.rs
    settings_store.rs
    theme_store.rs
    file_scope.rs
    startup_files.rs
    system_open.rs
    trash.rs
    pandoc.rs

  domain/
    mod.rs
    error.rs
    path.rs
    document_io.rs
    recovery.rs
    markdown_model.rs
    workspace_tree.rs
    workspace_index.rs
    export_job.rs
    export_resources.rs
    settings_store.rs
    theme_store.rs

  platform/
    mod.rs
    macos.rs
    windows.rs
    linux.rs
```

## 5. 通用接口规范

### 5.1 Rust 错误类型

新增 `src-tauri/src/domain/error.rs`：

```rust
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PrismCommandError {
    pub code: String,
    pub message: String,
    pub hint: Option<String>,
    pub path: Option<String>,
    pub stage: Option<String>,
}

pub type PrismResult<T> = Result<T, PrismCommandError>;

impl PrismCommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            hint: None,
            path: None,
            stage: None,
        }
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }

    pub fn with_stage(mut self, stage: impl Into<String>) -> Self {
        self.stage = Some(stage.into());
        self
    }

    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }
}
```

标准错误码：

```text
file_not_found
not_a_file
not_a_directory
permission_denied
unsupported_file_type
invalid_path
invalid_workspace
external_modified
external_deleted
write_failed
read_failed
index_failed
export_cancelled
export_timeout
export_resource_missing
export_resource_unsupported
native_unsupported
unknown_error
```

### 5.2 TypeScript 错误类型

新增 `src/platform/tauri/result.ts`：

```ts
export interface PrismCommandError {
  code: string;
  message: string;
  hint?: string | null;
  path?: string | null;
  stage?: string | null;
}

export class PrismNativeError extends Error {
  code: string;
  hint?: string | null;
  path?: string | null;
  stage?: string | null;

  constructor(error: PrismCommandError) {
    super(error.message);
    this.name = 'PrismNativeError';
    this.code = error.code;
    this.hint = error.hint;
    this.path = error.path;
    this.stage = error.stage;
  }
}

export function normalizeNativeError(error: unknown): PrismNativeError {
  if (error instanceof PrismNativeError) return error;
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return new PrismNativeError(error as PrismCommandError);
  }
  return new PrismNativeError({
    code: 'unknown_error',
    message: error instanceof Error ? error.message : String(error),
  });
}
```

### 5.3 Native command adapter

更新 `src/platform/tauri/nativeCommands.ts`：

```ts
import { invoke } from '@tauri-apps/api/core';
import { normalizeNativeError } from './result';

export async function invokeNativeCommand<Result>(
  command: string,
  args?: Record<string, unknown>,
): Promise<Result> {
  try {
    return await invoke<Result>(command, args);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}
```

要求：

- 业务层不再直接 import `@tauri-apps/api/core`。
- 测试 mock `src/platform/tauri/nativeCommands.ts`，不散 mock Tauri plugin。
- 新 command 名称统一 snake_case。

## 6. Phase 0：基线冻结

### 目标

记录当前行为和验证入口，不改业务代码。

### 文件

新增：

- `docs/prism-rust-core-modernization-implementation-plan.md`
- `docs/verification/prism-rust-core-modernization.md`

验证文档记录：

- 当前 dirty worktree 说明。
- 当前架构关键文件。
- 当前测试命令。
- 后续每阶段验证结果追加位置。

### 验证

```bash
git diff --check
```

### 完成条件

- 计划文档存在。
- verification 文档存在。
- 明确“不从 Rust 原生 UI 重写开始”。

## 7. Phase 1：前端 platform seam 收口

### 目标

先不新增 Rust command，只把前端对 Tauri plugin 的直接调用收口到 `src/platform/tauri/`。

### 新增文件

`src/platform/tauri/fileSystem.ts`：

```ts
import {
  copyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs';

export const fileSystem = {
  copyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
};
```

`src/platform/tauri/path.ts`：

```ts
import { appDataDir, downloadDir, homeDir } from '@tauri-apps/api/path';

export const nativePath = {
  appDataDir,
  downloadDir,
  homeDir,
};
```

### 迁移文件

把以下文件中的 Tauri plugin import 替换为 platform adapter：

- `src/lib/fileActions.ts`
- `src/domains/workspace/lib/loadFolderTree.ts`
- `src/domains/settings/store.ts`
- `src/domains/settings/fontService.ts`
- `src/domains/themes/themeStorage.ts`
- `src/domains/themes/themeInstaller.ts`
- `src/domains/document/services/recovery.ts`
- `src/domains/document/services/fileSafety.ts`
- `src/domains/document/hooks/useAutoSave.ts`
- `src/domains/document/hooks/useExternalFileChangeMonitor.tsx`
- `src/domains/export/assets.ts`
- `src/domains/export/exportPipeline.ts`

### 实施步骤

1. 新增 adapter 文件。
2. 每次迁移 1-3 个文件，跑对应测试。
3. 不改函数签名，不改行为。
4. 测试里逐步从 mock Tauri plugin 改为 mock adapter。
5. `rg "@tauri-apps/plugin-fs|@tauri-apps/api/core|@tauri-apps/plugin-dialog|@tauri-apps/plugin-opener" src`，确认剩余直接调用只存在于 `src/platform/tauri/` 和暂不迁移的低风险文件。

### if-else

- 如果测试大量失败：只回退本阶段 adapter import，不回退业务逻辑。
- 如果某个文件 mock 改动过大：先保留原 mock，下一小阶段再改测试。
- 如果 `@tauri-apps/api/window` 用于 UI 窗口行为，可暂时保留在 shell 层，后续再收口。

### 验证

```bash
npm test -- --run src/lib/fileActions.test.ts src/domains/settings/pathPersistence.test.ts src/domains/themes/themeInstaller.test.ts src/domains/document/services/fileSafety.test.ts
npm run build
git diff --check
```

## 8. Phase 2：Rust command 错误模型落地

### 目标

让 Rust commands 开始统一返回结构化错误，为后续迁移打基础。

### 新增 Rust 文件

- `src-tauri/src/domain/mod.rs`
- `src-tauri/src/domain/error.rs`
- `src-tauri/src/domain/path.rs`

`domain/path.rs` 提供：

```rust
pub fn canonicalize_existing_path(path: &str, stage: &str) -> PrismResult<PathBuf>;
pub fn ensure_file(path: &Path, stage: &str) -> PrismResult<()>;
pub fn ensure_directory(path: &Path, stage: &str) -> PrismResult<()>;
pub fn path_to_string(path: &Path) -> String;
```

### 修改 Rust

- `src-tauri/src/lib.rs` 引入 `mod domain;`
- 新 commands 优先使用 `PrismResult<T>`。
- 旧 commands 暂时不一次性全部改，避免风险。

### TS

- 完成 `src/platform/tauri/result.ts`
- 更新 `invokeNativeCommand<Result>()`

### 验证

```bash
cd src-tauri && cargo test
cd src-tauri && cargo check
npm run build
git diff --check
```

## 9. Phase 3：Rust 文档 IO

### 目标

打开、保存、文件快照、恢复快照、冲突检查逐步从前端 TS 迁到 Rust。

### Rust DTO

`src-tauri/src/domain/document_io.rs`：

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshotDto {
    pub mtime_ms: Option<f64>,
    pub size: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentFileSessionDto {
    pub path: String,
    pub name: String,
    pub content: String,
    pub known_snapshot: Option<FileSnapshotDto>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteDocumentInput {
    pub path: String,
    pub content: String,
    pub expected_snapshot: Option<FileSnapshotDto>,
    pub create_new: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWriteResult {
    pub path: String,
    pub snapshot: FileSnapshotDto,
}
```

### Rust commands

`src-tauri/src/commands/document_io.rs`：

```rust
#[tauri::command]
pub fn get_file_snapshot(path: String) -> PrismResult<FileSnapshotDto>;

#[tauri::command]
pub fn read_document_file(path: String) -> PrismResult<DocumentFileSessionDto>;

#[tauri::command]
pub fn write_document_file(input: WriteDocumentInput) -> PrismResult<DocumentWriteResult>;
```

实现规则：

- `read_document_file`
  - canonicalize path。
  - 必须是文件。
  - 扩展名必须是 `.md` / `.markdown` / `.txt`。
  - 读 UTF-8 文本。
  - 返回 name、content、snapshot。
- `write_document_file`
  - 如果有 `expected_snapshot`，写入前 stat 当前文件。
  - mtime/size 不一致返回 `external_modified`。
  - 文件不存在返回 `external_deleted`，除非 `create_new=true`。
  - 写入后重新 stat，返回新 snapshot。
- `get_file_snapshot`
  - 文件不存在返回 `file_not_found`。
  - 权限错误返回 `permission_denied`。

### 前端 adapter

`src/platform/tauri/documentIo.ts`：

```ts
import { invokeNativeCommand } from './nativeCommands';

export interface FileSnapshotDto {
  mtimeMs: number | null;
  size: number | null;
}

export interface DocumentFileSessionDto {
  path: string;
  name: string;
  content: string;
  knownSnapshot: FileSnapshotDto | null;
}

export function readDocumentFileNative(path: string) {
  return invokeNativeCommand<DocumentFileSessionDto>('read_document_file', { path });
}

export function writeDocumentFileNative(input: {
  path: string;
  content: string;
  expectedSnapshot?: FileSnapshotDto | null;
  createNew?: boolean;
}) {
  return invokeNativeCommand<{ path: string; snapshot: FileSnapshotDto }>('write_document_file', { input });
}

export function getFileSnapshotNative(path: string) {
  return invokeNativeCommand<FileSnapshotDto>('get_file_snapshot', { path });
}
```

`src/domains/document/services/documentIo.ts`：

- 导出业务 interface。
- 捕获 `PrismNativeError`。
- 失败时 fallback 到当前 TS `readTextFile/writeTextFile/stat` 逻辑。

### 迁移顺序

1. `src/domains/document/fileSnapshot.ts` 改为优先 `getFileSnapshotNative`。
2. `src/domains/document/services/fileSafety.ts` 的 read/write session 改为 `documentIo`。
3. `src/domains/document/hooks/useAutoSave.ts` 改为 `writeDocumentSession`。
4. `src/domains/commands/categories/fileCommands.ts` 的打开/保存改为 `documentIo`。
5. `src/lib/fileActions.ts` 的打开文件、保存 dirty before switch 改为 `documentIo`。

### if-else

- 如果 native 返回 `external_modified`：调用 `markSaveConflict(..., 'external-modified')`。
- 如果 native 返回 `external_deleted`：调用 `markSaveConflict(..., 'missing')`。
- 如果 native 返回 `unsupported_file_type`：toast，不打开。
- 如果 native command 不存在：fallback TS。
- 如果新文档没有 path：仍由前端弹保存路径。

### 测试

Rust：

```bash
cd src-tauri && cargo test document_io
```

TS：

```bash
npm test -- --run src/domains/document/services/fileSafety.test.ts src/domains/document/hooks/useAutoSave.test.tsx src/domains/document/services/conflictResolution.test.ts src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts
```

手工 smoke：

- 打开 `.md`。
- 编辑后保存。
- 另存为。
- 外部修改同一文件，再保存，出现保存冲突。
- 删除磁盘文件，再保存，出现缺失提示。

## 10. Phase 4：Rust 工作区文件树

### 目标

文件树扫描从 WebView 前端迁到 Rust，降低大目录扫描对 UI 的影响。

### Rust DTO

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNodeDto {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub children: Option<Vec<FileNodeDto>>,
    pub preview: Option<String>,
    pub size: Option<u64>,
    pub created_at: Option<f64>,
    pub modified_at: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadWorkspaceTreeOptions {
    pub max_depth: Option<usize>,
    pub include_preview: Option<bool>,
}
```

### Rust command

```rust
#[tauri::command]
pub fn load_workspace_tree(
    root_path: String,
    options: Option<LoadWorkspaceTreeOptions>,
) -> PrismResult<Vec<FileNodeDto>>;
```

### 实现规则

- 默认 max depth = 8。
- 忽略目录：
  - `node_modules`
  - `.git`
  - `dist`
  - `build`
  - `target`
  - `.next`
  - `.cache`
  - `__pycache__`
  - `venv`
  - `.venv`
- 只纳入 `.md` / `.markdown` / `.txt`。
- 目录如果递归后 children 为空，不返回。
- 文件 preview 复制当前 TS `extractPreview` 规则：
  - 去 front matter。
  - 去表格分隔行。
  - 去代码块和数学块。
  - 链接保留 label。
  - 图片移除。
  - 标题保留文本。
  - 最多 100 字符。

### 前端 adapter

`src/platform/tauri/workspaceTree.ts`：

```ts
export function loadWorkspaceTreeNative(rootPath: string, options?: {
  maxDepth?: number;
  includePreview?: boolean;
}) {
  return invokeNativeCommand<FileNode[]>('load_workspace_tree', { rootPath, options });
}
```

`src/domains/workspace/lib/loadFolderTree.ts`：

- 改为优先 native。
- native 失败时 fallback 现有 TS `readDir` 实现。
- 保持导出函数名 `loadFolderTree(folderPath)` 不变。

### if-else

- root 是系统敏感目录：Rust 返回 `invalid_workspace`。
- 权限不足的子目录：跳过，记录 warning。第一版可以只 `console.warn`，第二版进入 diagnostics。
- 某个文件 read preview 失败：preview 为空，不阻断树。
- native 不支持：fallback TS。

### 验证

```bash
cd src-tauri && cargo test workspace_tree
npm test -- --run src/domains/workspace/services/fileTree.test.ts src/lib/fileActions.test.ts
npm run build
git diff --check
```

手工 smoke：

- 打开文件夹。
- 新建文件。
- 新建文件夹。
- 重命名文件。
- 删除文件。
- 点击刷新。
- 从 Finder 双击工作区内新文件，侧栏应刷新并选中正确文档。

## 11. Phase 5：Rust 工作区索引、搜索、反链、图谱

### 目标

快速打开、全文搜索、`[[` 链接补全、反链、关系图谱共用一套 Rust 工作区索引。

### Rust DTO

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentDocumentOverride {
    pub path: String,
    pub content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildWorkspaceIndexInput {
    pub root_path: String,
    pub current_document_override: Option<CurrentDocumentOverride>,
    pub recent_files: Vec<RecentFileDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexedDocumentDto {
    pub path: String,
    pub name: String,
    pub relative_path: String,
    pub title: String,
    pub headings: Vec<HeadingDto>,
    pub links: Vec<LinkDto>,
    pub front_matter: FrontMatterDto,
    pub has_content: bool,
    pub size: Option<u64>,
    pub modified_at: Option<f64>,
    pub last_opened: Option<f64>,
    pub recent_rank: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexDto {
    pub root_path: String,
    pub documents: Vec<WorkspaceIndexedDocumentDto>,
    pub backlinks_by_path: std::collections::HashMap<String, Vec<BacklinkDto>>,
    pub recent_documents: Vec<WorkspaceIndexedDocumentDto>,
    pub generated_at: u64,
}
```

### Rust commands

```rust
#[tauri::command]
pub fn build_workspace_index(input: BuildWorkspaceIndexInput) -> PrismResult<WorkspaceIndexDto>;

#[tauri::command]
pub fn search_workspace_index(input: SearchWorkspaceInput) -> PrismResult<Vec<SearchResultDto>>;

#[tauri::command]
pub fn get_relation_graph(input: RelationGraphInput) -> PrismResult<RelationGraphDto>;
```

第一版可以只实现 `build_workspace_index`，搜索和图谱先由前端基于返回 index 计算。第二版再移动搜索和图谱算法。

### Markdown 解析规则

Rust `markdown_model.rs` 第一版用轻量 parser，不引入过重依赖：

- heading：`^#{1,6}\s+(.+)$`
- markdown link：`[label](target)`
- image：`![alt](target)`
- wiki link：`[[target]]`、`[[target|label]]`
- front matter：文档开头 `---` 到下一段 `---`
- title 优先级：
  1. front matter `title`
  2. 第一个 heading
  3. 文件名去扩展名

后续如需要更严格 Markdown，可引入 `pulldown-cmark` 或 `markdown` crate，但第一版不要为了完美解析阻塞迁移。

### 前端迁移

`src/platform/tauri/workspaceIndex.ts`：

```ts
export function buildWorkspaceIndexNative(input: BuildWorkspaceIndexInput) {
  return invokeNativeCommand<WorkspaceIndexDto>('build_workspace_index', { input });
}
```

`src/domains/workspace/hooks/useWorkspaceIndexModel.ts`：

- 保持 hook 输出不变：
  - `workspaceIndex`
  - `workspaceIndexing`
- 内部改为：
  1. rootPath 为空：返回 null。
  2. debounce 300ms。
  3. 优先 native build。
  4. native 失败 fallback 当前 TS `readWorkspaceIndexSources + buildWorkspaceIndex`。
  5. current document override 始终覆盖磁盘内容。

### if-else

- 文件很多：
  - 第一版同步返回，但分批读取。
  - 第二版增加 job 式 index。
- 某个文件 UTF-8 失败：
  - 跳过该文件 content，保留文件节点。
- 链接无法解析：
  - `resolvedPath = null`。
- 当前文档未保存：
  - 不传 override path，前端只在当前文档相关 UI 使用临时模型，不进入 workspace backlinks。

### 验证

新增 fixture：

```text
src-tauri/tests/fixtures/workspace-index-small/
src-tauri/tests/fixtures/workspace-index-links/
```

测试：

```bash
cd src-tauri && cargo test workspace_index
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/domains/workspace/services/backlinks.test.ts src/domains/workspace/services/relationGraph.test.ts
npm run build
git diff --check
```

手工 smoke：

- `Cmd+P` 搜文件。
- `Cmd+Shift+F` 搜正文。
- 输入 `[[` 补全文件和标题。
- 查看反链并点击跳转。
- 打开关系图谱并点击节点跳转。

## 12. Phase 6：Rust 导出 Job

### 目标

导出渲染仍由 WebView 完成，但任务状态、取消、失败、后台状态由 Rust 管理。

### Rust state

`src-tauri/src/domain/export_job.rs`：

```rust
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportJobDto {
    pub id: String,
    pub format: String,
    pub document_path: Option<String>,
    pub output_path: Option<String>,
    pub status: String,
    pub stage: String,
    pub message: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub error: Option<PrismCommandError>,
    pub cancel_requested: bool,
}

#[derive(Default)]
pub struct ExportJobStore {
    jobs: std::sync::Mutex<std::collections::HashMap<String, ExportJobDto>>,
}
```

`src-tauri/src/lib.rs`：

```rust
.manage(commands::export_jobs::ExportJobStore::default())
```

### Rust commands

```rust
create_export_job(input: CreateExportJobInput) -> PrismResult<ExportJobDto>
update_export_job(input: UpdateExportJobInput) -> PrismResult<ExportJobDto>
complete_export_job(input: CompleteExportJobInput) -> PrismResult<ExportJobDto>
fail_export_job(input: FailExportJobInput) -> PrismResult<ExportJobDto>
cancel_export_job(job_id: String) -> PrismResult<ExportJobDto>
get_export_job(job_id: String) -> PrismResult<ExportJobDto>
list_export_jobs() -> PrismResult<Vec<ExportJobDto>>
```

### 前端

新增：

- `src/platform/tauri/exportJobs.ts`
- `src/domains/export/jobs/exportJobClient.ts`
- `src/hooks/useExportJobUi.ts`

迁移：

- `src/domains/commands/categories/exportCommands.ts`
  - `handleExport()` 开始时 `createExportJob`。
  - `onProgress` 同步 `updateExportJob`。
  - 成功 `completeExportJob`。
  - 失败 `failExportJob`。
- `src/hooks/useExportTaskUi.ts`
  - 第一阶段兼容旧 `prism-export-progress` event。
  - 第二阶段改为读取 job state。

### 取消机制

在以下关键阶段检查取消：

- 开始导出前。
- Markdown 转 HTML 后。
- Mermaid 渲染前后。
- PDF 每个 batch 后。
- PNG canvas 渲染前。
- DOCX 每个大块处理后。

前端 helper：

```ts
export async function throwIfExportCancelled(jobId: string) {
  const job = await getExportJob(jobId);
  if (job.cancelRequested) throw new ExportCancelledError(jobId);
}
```

### if-else

- 用户点后台：只隐藏 toast，job 继续 running。
- 用户点取消：Rust 标记 `cancelRequested=true`，前端下一检查点抛 `ExportCancelledError`。
- worker 崩溃：主窗口 timeout 后 `failExportJob`。
- app 关闭：如果有 running job，前端提示确认。

### 验证

```bash
cd src-tauri && cargo test export_jobs
npm test -- --run src/hooks/useExportTaskUi.test.tsx src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts
npm run build
git diff --check
```

手工 smoke：

- PDF 导出前台状态。
- 切后台后状态栏显示导出中。
- 取消导出。
- 导出失败时打开失败诊断。

## 13. Phase 7：Rust 导出资源与预检

### 目标

本地图片、SVG、引用文件、资源路径、导出预检由 Rust 统一处理。

### Rust DTO

```rust
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveResourceInput {
    pub document_path: Option<String>,
    pub raw_src: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceRefDto {
    pub raw_src: String,
    pub resolved_path: Option<String>,
    pub kind: String,
    pub mime_type: Option<String>,
    pub exists: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceBytesDto {
    pub bytes: Vec<u8>,
    pub mime_type: String,
    pub path: String,
}
```

### Rust commands

```rust
resolve_export_resource(input: ResolveResourceInput) -> PrismResult<ResourceRefDto>
read_export_resource(input: ResolveResourceInput) -> PrismResult<ResourceBytesDto>
preflight_export(input: ExportPreflightInput) -> PrismResult<Vec<ExportDiagnosticDto>>
```

### 实现规则

- 支持相对路径、绝对路径、file URL。
- 外部 URL 不下载，只返回 `kind=external_url`。
- 越权路径返回 `permission_denied`。
- 不存在返回 `export_resource_missing`。
- SVG 读取时只返回 bytes，不在 Rust 中渲染。
- mime 按扩展名判断，必要时补 magic number。

### 前端迁移

- `src/domains/export/assets.ts`
  - `resolveExportMediaPath` 优先 Rust。
  - `readLocalExportMedia` 优先 Rust。
  - 保留现有 TS fallback。
- `src/domains/export/preflight.ts`
  - 图片、链接、引用文件检查优先 Rust。

### if-else

- 外部 URL：不阻断导出。
- 缺失本地图片：preflight error。
- SVG 在 DOCX 中不稳定：warning，后续由 DOCX renderer rasterize。
- 文件太大：warning，不自动降清晰度。

### 验证

```bash
cd src-tauri && cargo test export_resources
npm test -- --run src/domains/export/assets.test.ts src/domains/export/preflight.test.ts src/domains/export/exportPipeline.test.ts
npm run build
git diff --check
```

手工 smoke：

- Markdown 本地图片导出 HTML/PDF/PNG/DOCX。
- 缺失图片触发诊断。
- SVG 图片导出。
- 带空格、中文路径图片导出。

## 14. Phase 8：PDF capture 能力深化

### 目标

保持 WebView 渲染保真，同时让 native PDF capture 的能力检测和错误处理更清楚。

### Rust

扩展 `src-tauri/src/commands/pdf_capture.rs`：

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfCaptureCapability {
    pub supported: bool,
    pub engine: String,
    pub reason: Option<String>,
}

#[tauri::command]
pub fn get_pdf_capture_capability() -> PdfCaptureCapability;
```

平台策略：

- macOS：`supported=true, engine=webkit_create_pdf`
- Windows：第一版 `supported=false, reason=webview2_pdf_capture_not_enabled`
- Linux：`supported=false, reason=webkitgtk_pdf_capture_not_enabled`

前端：

- `src/platform/tauri/pdfCapture.ts`
- `src/domains/export/pdf/pdfCaptureClient.ts`
- `exportPdfWithWebkitCapture` 改名 `exportPdfWithNativeCapture`
- 根据 capability 决定 native/raster。

### if-else

- macOS native 支持：优先 native。
- native capture 失败：warning + fallback raster。
- 用户选择最高质量：不自动降级，只提示耗时。
- Windows 暂不支持 native：直接 raster，不报错。

### 验证

```bash
cd src-tauri && cargo test pdf_capture
npm test -- --run src/domains/export/exportPipeline.test.ts src/domains/export/pdf/pdfLinks.test.ts
npm run build
git diff --check
```

手工 smoke：

- macOS PDF 导出高清。
- 大文档 PDF 不永久卡死。
- PDF 链接保留。
- 失败时诊断清楚说明 native fallback。

## 15. Phase 9：设置和主题存储 Rust 化

### 目标

设置文件、主题包扫描、主题导入、异常主题检测迁到 Rust，设置中心 UI 不变。

### Rust commands

```rust
read_settings_file() -> PrismResult<String>
write_settings_file(contents: String) -> PrismResult<()>
read_legacy_settings_config() -> PrismResult<Option<String>>

scan_installed_themes() -> PrismResult<ThemeScanResultDto>
install_theme_package(input: InstallThemeInput) -> PrismResult<InstallThemeResultDto>
delete_user_theme(theme_id: String) -> PrismResult<()>
validate_theme(theme_id: String) -> PrismResult<ThemeValidationResultDto>
open_themes_directory() -> PrismResult<()>
```

### 迁移

- `src/domains/settings/store.ts`
  - `getConfigPath/readTextFile/writeTextFile/appDataDir` 改走 Rust settings storage。
- `src/domains/themes/themeStorage.ts`
  - scan/read/install/delete/open 改走 Rust。
- `SettingsModal.tsx`
  - UI 逻辑不变，只换 model 调用。

### if-else

- 内置主题 id：直接拒绝导入。
- 同 id 用户主题：前端确认后 replace。
- replace 失败：Rust 恢复旧主题目录。
- 主题目录损坏：scan 返回 invalid，设置中心显示异常，但主题下拉菜单移除。
- 应用主题前 validate 失败：提示主题异常，不应用。

### 验证

```bash
cd src-tauri && cargo test settings_store theme_store
npm test -- --run src/domains/settings/pathPersistence.test.ts src/domains/themes/themeInstaller.test.ts src/domains/themes/themeRegistry.test.ts src/components/shell/SettingsModal.test.tsx
npm run build
git diff --check
```

手工 smoke：

- 打开设置中心不白屏。
- 导入主题。
- 导入并应用主题。
- 同 id 主题确认替换。
- 手动破坏主题目录后设置中心显示异常。

## 16. Phase 10：前端体验层瘦身

### 目标

Rust 本地能力稳定后，再整理前端 module。此阶段不改变用户可见行为。

### App.tsx 拆分

新增：

- `src/app/controllers/ExportUiController.tsx`
- `src/app/controllers/DocumentSafetyController.tsx`
- `src/app/controllers/DocumentPanelsController.tsx`
- `src/app/controllers/WorkspaceController.tsx`

迁移：

- save dialog、export progress、export failure modal -> `ExportUiController`
- recovery modal、save conflict modal、dirty switch modal -> `DocumentSafetyController`
- backlinks、document links、relation graph、properties、diagnostics -> `DocumentPanelsController`
- sidebar hover、status bar wiring、workspace context menu -> `WorkspaceController`

目标：

- `App.tsx` 降到 350 行以内。
- 每个 controller 有独立测试。

### EditorPane.tsx 拆分

新增：

- `src/domains/editor/runtime/createEditorRuntime.ts`
- `src/domains/editor/runtime/editorCommandAdapter.ts`
- `src/domains/editor/runtime/editorTableController.ts`
- `src/domains/editor/runtime/editorClipboardController.ts`

迁移：

- CodeMirror 初始化 -> `createEditorRuntime`
- `onAppEvent('editor.command')` 大 switch -> `editorCommandAdapter`
- table toolbar/action -> `editorTableController`
- paste/drop image -> `editorClipboardController`

目标：

- `EditorPane.tsx` 降到 500 行以内。
- 编辑器行为保持不变。

### 验证

```bash
npm test -- --run src/App.recovery.test.tsx src/domains/editor/components/EditorPane.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/runtime/editorBlockCommands.test.ts src/domains/editor/runtime/editorTableRuntime.test.ts src/domains/editor/runtime/editorClipboardRuntime.test.ts
npm run build
git diff --check
```

手工 smoke：

- 编辑文本。
- 快捷键。
- 表格编辑。
- 图片粘贴。
- 搜索替换。
- 斜杠菜单。
- 预览/分栏/编辑切换。

## 17. Git 与提交规则

- 每个 phase 单独提交。
- 如果 phase 很大，每个 checkpoint 单独提交。
- commit message 用中文。
- 不 reset、checkout、revert 或覆盖无关脏改。
- 每次提交前：

```bash
git status --short
git diff --check
```

- 能安全 push 的 checkpoint 及时 push。
- 如果工作树已有无关改动，提交时只 stage 本阶段文件。

## 18. 完整验证矩阵

### 文档变更

```bash
git diff --check
```

### 前端 adapter / model 改动

```bash
npm test -- --run <相关测试>
npm run build
git diff --check
```

### Rust command 改动

```bash
cd src-tauri && cargo test
cd src-tauri && cargo check
npm run build
git diff --check
```

### 文件安全链路

```bash
npm test -- --run src/domains/document/services/fileSafety.test.ts src/domains/document/hooks/useAutoSave.test.tsx src/domains/document/services/conflictResolution.test.ts src/lib/fileActions.test.ts
cd src-tauri && cargo test document_io
npm run build
git diff --check
```

### 工作区索引链路

```bash
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/domains/workspace/services/backlinks.test.ts src/domains/workspace/services/relationGraph.test.ts
cd src-tauri && cargo test workspace_index
npm run build
git diff --check
```

### 导出链路

```bash
npm test -- --run src/domains/export/exportPipeline.test.ts src/domains/export/assets.test.ts src/domains/export/preflight.test.ts src/domains/commands/exportCommand.integration.test.ts
cd src-tauri && cargo test export_jobs export_resources pdf_capture
npm run build
git diff --check
```

### 真实 app smoke

只在以下情况跑：

- 文件打开/保存/文件关联变化。
- Rust/Tauri capabilities 变化。
- 导出 native capture 变化。
- app lifecycle/window 行为变化。
- 安装器、签名、公证、updater、DMG/NSIS/MSI 变化。

命令：

```bash
npm run tauri -- build --bundles app
```

注意：如果构建最后因为缺少 `TAURI_SIGNING_PRIVATE_KEY` 失败，但 `Prism.app` bundle 已生成，需要如实说明“bundle 已生成，updater 签名失败”。

## 19. 最终完成标准

全部完成后应满足：

- 前端业务代码不再散落直接调用 Tauri fs/dialog/opener/core。
- 文档 IO、文件快照、保存冲突主要由 Rust 实现。
- 工作区树、索引、搜索、反链、图谱数据主要由 Rust 实现。
- 导出任务状态、后台、取消、失败诊断由 Rust job 管理。
- 导出资源读取和预检主要由 Rust 实现。
- PDF capture 能力有平台 capability 判断和清晰 fallback。
- 设置/主题存储主要由 Rust 实现。
- `App.tsx` 和 `EditorPane.tsx` 明显瘦身。
- 当前妙言风格、单文档单窗口、编辑/预览/分栏、导出、文件树、设置中心全部保持可用。
