# Prism 文件系统权限边界

> 目标：让 Prism 仍然能编辑用户明确选择的文档和工作区，但不再把 Tauri fs 权限静态放开到整个磁盘。

## 1. 静态权限

`src-tauri/capabilities/default.json` 不允许再出现下面这种全盘 scope：

```json
{ "identifier": "fs:allow-read-text-file", "allow": [{ "path": "**" }] }
```

当前静态权限只做两件事：

- 启用 Prism 实际使用的 fs 命令：读文件、读目录、写文件、创建目录、删除、重命名、复制。
- 固定允许 `$APPDATA/**`，用于 `config.json`、恢复快照和导入字体。

用户文档、工作区和导出目标不靠静态 `**`，而靠显式用户动作或受限授权进入运行时 scope。

## 2. 动态授权来源

| 来源 | 授权方式 | 说明 |
| --- | --- | --- |
| 打开文件对话框 | Tauri dialog 自动允许所选文件，Prism 再授权该 Markdown 文件的安全父目录 | 用于打开文档并加载同级工作区树 |
| 打开文件夹对话框 | `recursive: true`，Tauri dialog 递归允许所选文件夹 | 用于工作区文件树 |
| 保存 / 导出对话框 | Tauri dialog 自动允许目标文件 | 用于保存 Markdown 和导出产物 |
| 文件关联 / CLI / 最近会话 | Rust 命令 `grant_markdown_file_scope` / `grant_workspace_directory_scope` | 因为这些路径不是由当前窗口的 dialog 返回，需要显式补 scope |
| appData | 静态 `$APPDATA/**` | 设置、恢复快照、导入字体 |

## 3. Rust scope 命令

`src-tauri/src/lib.rs` 提供两个受限命令：

- `grant_markdown_file_scope(path)`：只接受已存在的 `.md`、`.markdown`、`.txt` 文件；允许该文件，并在父目录不是敏感目录时递归允许父目录。
- `grant_workspace_directory_scope(path)`：只接受已存在的目录；拒绝系统目录、磁盘根目录和用户主目录整体授权。

拒绝用户主目录整体授权是刻意取舍：如果用户直接打开 `~/note.md`，Prism 仍可打开该文件，但不会把整个 home 递归放进工作区 scope。

## 4. 回归检查

发布前检查：

```bash
rg '"path": "\\*\\*"' src-tauri/capabilities
npm test -- --run
npm run build
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/prism-updater.key")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
```

`rg` 不应命中能力文件。若未来为了某个功能重新引入全盘 scope，必须先写清楚原因、替代方案和移除计划。

## 5. 运行时 smoke

P0 运行时验证记录见 `docs/archive/dirty-data-2026-05-30/historical-docs/prism-p0-runtime-smoke.md`。

当前已验证：

- release bundle 在无既有 lastSession、已有 lastSession 两种场景下，都可以通过 macOS 文件打开事件加载 Markdown 文件。
- 非对话框文件路径会先进入 `grant_markdown_file_scope`，再读取文档。
- 收紧权限后，设置文件必须位于 `$APPDATA/config.json`，不能再写到 appData 目录外。
- 历史拼错的设置路径只通过 `read_legacy_settings_config` 做一次性迁移，不重新放开静态全盘 scope。
- 启动编排以 settings hydration 为闸门，文件打开优先级高于 lastSession 恢复。
