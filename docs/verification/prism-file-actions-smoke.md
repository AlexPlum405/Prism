# Prism 文件动作 Smoke 验证

> 日期：2026-05-15
> 目标：验证工作区文件树的核心文件动作不会落到空壳入口，并且删除优先进入系统废纸篓。
> 计划来源：`docs/archive/dirty-data-2026-05-30/historical-docs/prism-product-optimization-plan.md` 第 9 节“工作区、快速打开与链接能力”。
> 当前状态：已补系统废纸篓 Tauri command、macOS Finder trash 超时保护、`~/.Trash` 唯一路径 fallback 和永久删除 fallback 自动化回归；macOS Prism `.app` 文件树删除真实 smoke 已通过；Windows 桌面 smoke 尚未执行。

## 1. 覆盖范围

本 smoke 覆盖：

- 文件删除：默认移到系统废纸篓。
- 废纸篓失败 fallback：失败后必须二次确认，才能永久删除。
- 文件夹删除：同样先走系统废纸篓。
- 重命名：文件树内联重命名，当前文档路径同步更新。
- 创建副本：只允许文件副本，不把文件夹当作文件复制。
- 打开位置：文件用 Finder / Explorer reveal，文件夹直接打开。
- 复制路径：写入系统剪贴板。
- 刷新文件树：不关闭当前文档。

本 smoke 不覆盖：

- Git 操作、文件移动、批量重命名。
- 云端回收站或跨设备同步。
- Obsidian 式插件文件操作。

## 2. 现有自动化覆盖

- `src-tauri/src/lib.rs`：新增 `move_path_to_trash` Tauri command。macOS 先使用可超时终止的 `osascript` 子进程调用 Finder 废纸篓；Finder 失败或超时后 fallback 到用户 `~/.Trash`，并为重名目标生成 `draft 1.md` 这类唯一路径；非 macOS 继续使用 Rust `trash` crate。
- `src/lib/fileActions.ts`：删除流程先确认“移到废纸篓”，调用 `move_path_to_trash`；如果废纸篓失败，再二次确认“永久删除”。
- `src/lib/fileActions.test.ts`：覆盖首次取消不删除任何内容、废纸篓优先、废纸篓失败后取消永久删除、废纸篓失败后二次确认永久删除。
- `src-tauri/src/lib.rs` 单元测试覆盖 `move_path_to_trash` 对不存在路径的拒绝，避免无效路径进入系统废纸篓调用；同时覆盖系统废纸篓子进程正常返回、超时 kill 分支，以及 macOS `~/.Trash` fallback 的重名文件保护。
- `src/lib/fileActionCommands.test.ts`：覆盖文件动作 command contract，避免文件树菜单 action 漂移成未知入口。
- `src/domains/workspace/components/fileTreeContextMenu.test.ts`：覆盖背景、文件、文件夹菜单 action 均可识别。
- `src/domains/workspace/hooks/useWorkspaceFocusRefresh.ts`：在已有工作区重新聚焦或页面重新可见时静默重扫文件树，作为第一版工作区文件监控；不改当前文档状态。
- `src/domains/workspace/hooks/useWorkspaceFocusRefresh.test.tsx`：覆盖窗口 focus 刷新、无工作区不刷新、root path 变化后忽略陈旧结果、visibilitychange 回到 visible 时刷新。
- `cargo test trash`：通过，5 tests。
- `cargo test`：通过，8 tests。
- `cargo check`：通过。

这些测试证明删除 contract 和 Rust command 编译可用；macOS Prism UI 文件树删除已用真实 `.app` 和临时 workspace 验证通过。Windows Explorer 桌面验证仍未执行。

## 3. 自动化阻塞记录

2026-05-15 尝试运行 macOS 系统废纸篓自动化 smoke：

```bash
cargo test smoke_move_path_to_trash_places_file_in_macos_trash -- --ignored
```

结果：测试进入 `trash::delete` 后超过 60 秒未返回。进程检查显示底层命令卡在：

```text
osascript -e tell application "Finder" to delete { POSIX file ".../prism-trash-smoke-....md" }
```

处理：已中断该测试并清理临时 smoke 文件；不把会挂起的 ignored test 留在仓库。当前环境不能用无头自动化方式证明 Finder 废纸篓结果，仍需人工或可靠 UI 自动化执行下方手动 smoke。

2026-05-15 补强 macOS 废纸篓超时保护：

- `src-tauri/src/lib.rs` 不再在 macOS 上直接调用会无限等待的 `trash::delete`；改为启动 `osascript` 子进程执行 Finder delete。
- `wait_for_child_output_with_timeout()` 给系统废纸篓子进程设置 8 秒超时；超时后 kill 子进程并返回 `移到系统废纸篓超时`。
- 前端删除流程会把这个错误当作废纸篓失败，继续进入已有“永久删除 / 不可撤销”二次确认，而不是让用户卡在删除动作中。
- 初始 `tell application "Finder" to delete POSIX file ...` 真实 smoke 返回 Finder `-1728`，说明 Finder 无法稳定解析该 AppleScript 目标。
- 已改为 `tell application "Finder" to delete (POSIX file (item 1 of argv) as alias)`。
- 修正后真实 smoke 通过：`osascript` 返回 0，输出目标为 `.Trash` 中的 document file，源文件路径消失。
- `cargo test trash`：通过，4 tests。
- `cargo test`：通过，7 tests。
- `cargo check`：通过。
- `npm run tauri -- build --bundles app`：前端 build、Rust release 编译和 `.app` bundle 生成成功；命令最终仍因缺少 `TAURI_SIGNING_PRIVATE_KEY` 在 updater 签名阶段返回 1，该项属于发布签名环境阻塞，不是本批 Rust command 编译失败。
- 限制：这证明当前 macOS Finder AppleScript 路径可以把真实文件移入系统废纸篓，但仍没有通过 Prism UI 文件树完成删除操作；Windows Explorer 废纸篓仍未验证。

2026-05-15 Prism `.app` 文件树 UI smoke 准备：

- 使用 `npm run tauri:build:app-smoke` 生成的 `src-tauri/target/release/bundle/macos/Prism.app`。
- 准备临时工作区：

```text
.codex-smoke/file-actions-ui/workspace/
  draft.md
  keep.md
  folder/nested.md
```

- 执行 `open -n -a src-tauri/target/release/bundle/macos/Prism.app .codex-smoke/file-actions-ui/workspace/draft.md`。
- Prism 窗口可见，标题为 `draft.md`，文件树显示 `folder/nested.md`、`draft.md`、`keep.md`，编辑区显示 `Delete me through Prism UI.`。
- 截图证据：`.codex-smoke/file-actions-ui/prism-file-actions-open.png`。
- Computer Use 读取 Prism 仍返回 `codex app-server exited before returning a response`；改用 `screencapture` 成功保留截图。
- 第一次真实 UI 删除暴露 Finder AppleScript 在 App 进程内 8 秒超时，前端正确进入“永久删除 / 不可撤销”二次确认；本次已取消永久删除，测试文件未丢。

2026-05-15 修复并复测 macOS Prism `.app` 文件树删除：

- `move_existing_path_to_trash()` 保留 Finder AppleScript 作为第一选择；Finder 失败或超时后，改为 fallback 到用户 `~/.Trash`。
- fallback 使用 `std::fs::rename` 移动目标文件，并在废纸篓已有同名文件时生成唯一文件名，避免覆盖用户废纸篓中的既有文件。
- `macos_user_trash_fallback_moves_file_with_unique_name()` 覆盖 `draft.md` 已存在时，源文件进入 `draft 1.md`，既有废纸篓文件内容不变。
- 使用 `npm run tauri:build:app-smoke` 生成的 `src-tauri/target/release/bundle/macos/Prism.app` 复测临时 workspace。
- 真实 UI 操作：右键 `ui-delete-20260515175002.md` -> “删除” -> “移到废纸篓”。
- 结果：没有再弹永久删除确认；Prism 文件树移除目标；编辑区回到“请打开一个 Markdown 文件开始编辑”的安全空状态；toast 显示“已移到系统废纸篓”。
- 终端检查：源文件不存在，`~/.Trash/ui-delete-20260515175002.md` 存在，`keep.md` 仍存在。
- 限制：macOS 阻止当前终端读取 `~/.Trash/ui-delete-20260515175002.md` 内容，返回 `Operation not permitted`；本 smoke 只以路径存在、文件大小存在、源文件消失和 Prism UI 状态作为证据。
- 截图证据：`.codex-smoke/file-actions-ui/evidence/01-ui-delete-after-trash.png`。
- 验证命令：`cargo test trash` 通过 5 tests；`cargo test` 通过 8 tests；`cargo check` 通过；`npm run tauri:build:app-smoke` 通过。

2026-05-15 补强删除确认自动化：

- `src/lib/fileActions.test.ts` 新增首次确认取消回归：用户取消“移到废纸篓”确认框时，不调用 `moveToTrash`，也不调用永久删除。
- `npm test -- --run src/lib/fileActions.test.ts`：通过，1 file / 4 tests。

2026-05-15 补强工作区刷新证据：

- `src/domains/workspace/hooks/useWorkspaceFocusRefresh.ts` 新增工作区聚焦刷新 hook；`App.tsx` 在 settings ready 后启用。
- hook 只在已有 `rootPath` 时响应 `window.focus` 和 `document.visibilitychange`，调用 `loadFolderTree(rootPath)` 后回写 file tree。
- 如果刷新结果返回前工作区 root 已变化，旧结果会被忽略，避免覆盖新工作区文件树。
- `npm test -- --run src/domains/workspace/hooks/useWorkspaceFocusRefresh.test.tsx`：通过，1 file / 4 tests。
- `npm test -- --run src/App.recovery.test.tsx src/hooks/useBootstrap.test.tsx src/domains/workspace/hooks/useWorkspaceFocusRefresh.test.tsx`：通过，3 files / 14 tests。

2026-05-19 修复 Finder 外部打开文件树不同步：

- 现象：Prism 已有旧工作区时，从 Finder 双击另一个目录里的 Markdown 文件，当前文档会切换，但左侧文件树仍停留在旧工作区。
- 根因：`src/lib/fileActions.ts` 的 `handleOpenFile()` 只在 `rootPath` 为空时加载文件父目录；运行中 `file-opened` 事件、最近文件和部分文档链接都会复用该路径，因此旧 rootPath 存在时不会刷新文件树。
- 修复：打开文件不在当前 `rootPath` 内时，自动把工作区切到该文件父目录并重新 `loadFolderTree()`；若文件已经在当前工作区内，则保持现有工作区，避免打断用户正在浏览的文件树。
- `src/lib/fileActions.test.ts` 新增两条回归：外部文件会切换 rootPath 和 fileTree；当前工作区内文件不会重载文件树。
- `npm test -- --run src/lib/fileActions.test.ts src/hooks/useBootstrap.test.tsx`：通过，2 files / 11 tests。
- `npm test -- --run`：通过，74 files / 439 tests。
- `npm run build`：通过，仅有既有 Vite large chunk warning。
- `git diff --check`：通过。

## 4. 手动 Smoke 步骤

准备工作区：

```text
.codex-smoke/file-actions/
  workspace/
    draft.md
    keep.md
    folder/
      nested.md
```

操作：

1. 启动 Prism，打开 `workspace/`。
2. 右键 `draft.md`，选择“删除”。
3. 在确认框中选择“移到废纸篓”。
4. 确认文件树不再显示 `draft.md`，Finder / Explorer 废纸篓中可以找到该文件。
5. 右键 `folder/`，重复删除流程，确认整个文件夹进入废纸篓。
6. 新建一个文件，执行重命名，确认当前打开文档路径同步更新。
7. 对 `keep.md` 执行“创建副本”，确认同目录出现副本。
8. 执行“复制文件路径”，粘贴到文本框确认路径正确。
9. 执行“打开位置”，确认 Finder / Explorer 定位到目标文件。

## 5. 通过标准

- 删除默认进入系统废纸篓，不直接永久删除。
- 废纸篓失败时，必须出现包含“永久删除”和“不可撤销”的二次确认。
- 删除当前打开文档后，编辑区关闭或切换到安全状态，不保留已不存在路径的 dirty 文档。
- 文件树刷新后不会丢失当前文档保存状态。
- 所有失败路径都显示明确 toast 或对话框，不静默失败。

## 6. 未完成记录

macOS Prism UI 文件树删除已通过真实 `.app` smoke：测试文件从 workspace 消失并进入 `~/.Trash`，保留文件未受影响，当前编辑区进入安全空状态。

仍未完成：

- Windows Explorer 废纸篓 smoke 尚未执行。
- 文件夹删除、重命名、创建副本、复制路径、打开位置仍只有自动化 contract 或手动协议，没有全部逐项完成真实桌面 smoke。
- 真实“废纸篓失败后永久删除”路径只验证到二次确认出现并取消，没有执行不可逆永久删除。
