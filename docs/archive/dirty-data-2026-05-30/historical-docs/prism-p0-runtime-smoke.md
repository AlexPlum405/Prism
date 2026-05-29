# Prism P0 运行时 Smoke 验证

> 日期：2026-05-15  
> 目标：验证 P0 文件安全与发布可信改动在真实 macOS Tauri bundle 中可运行，尤其是收紧 fs scope 后的非对话框打开路径。

## 1. 验证环境

- macOS，本机 release bundle：`src-tauri/target/release/bundle/macos/Prism.app`
- 版本：`1.4.0`
- 验证入口：macOS `open -a Prism.app <file>` 文件打开事件
- 临时文件：仓库内 `.codex-smoke/fs-scope/smoke.md`，验证后删除

## 2. 本次发现的问题

首次 smoke 暴露出设置路径拼接问题：

- `appDataDir()` 在当前 Tauri 运行时返回的路径没有结尾 `/`
- 旧代码把设置文件拼成了 `~/Library/Application Support/com.prism.editor.v1config.json`
- 该路径不在 `$APPDATA/**` scope 内；收紧 fs 权限后会导致设置读写、最近文件和 lastSession 持久化失败

修复：

- `src/domains/settings/store.ts` 的 `config.json` 路径改为 `joinPath(appDataDir, 'config.json')`
- `src/domains/settings/fontService.ts` 的 `fonts/` 路径和导入字体目标路径改为 `joinPath(...)`
- `src-tauri/src/lib.rs` 增加 `read_legacy_settings_config`，只在新配置缺失时读取历史拼错的单一配置文件
- 新增 `src/domains/settings/pathPersistence.test.ts` 覆盖 appData 无尾部分隔符和旧配置迁移场景
- `App.tsx` 增加 `settingsReady` 启动闸门：设置加载完成前不运行 `useBootstrap`，也不写 lastSession
- `useBootstrap(enabled)` 只在启动闸门打开后按 `URL file/folder -> pending file -> lastSession` 的顺序执行

## 3. 运行时验证结果

执行 release bundle 打开 Markdown 文件后，Prism 成功写入正确位置：

```text
~/Library/Application Support/com.prism.editor.v1/config.json
```

配置文件中出现了本次打开的文档：

```json
{
  "recentFiles": [
    {
      "path": "/Users/Alex/AI/project/Prism/.codex-smoke/fs-scope/smoke.md",
      "name": "smoke.md"
    }
  ],
  "lastSession": {
    "filePath": "/Users/Alex/AI/project/Prism/.codex-smoke/fs-scope/smoke.md",
    "folderPath": "/Users/Alex/AI/project/Prism/.codex-smoke/fs-scope",
    "viewMode": "edit"
  }
}
```

结论：

- macOS 文件打开事件能进入 Prism
- `grant_markdown_file_scope` 能支撑非对话框文件读取
- 文档父目录能作为工作区路径进入会话状态
- `$APPDATA/**` scope 下的设置写入恢复正常
- 历史错误路径中的设置能迁移到 `$APPDATA/config.json`

补充验证：

- 当 `$APPDATA/config.json` 已存在且包含 lastSession 时，`open -a Prism.app <file>` 冷启动现在会优先打开传入文件，而不是恢复 lastSession
- 这一路径通过真实 release bundle 验证：配置中的 `recentFiles[0]` 和 `lastSession.filePath` 均更新为本次 smoke 文件

## 4. 验证命令

```bash
npm test -- --run scripts/generate-updater-manifest.test.ts
npm test -- --run
npm run build
TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/prism-updater.key" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npm run tauri:build
npm run release:manifest
npm run release:manifest:check
open -n -a /Users/Alex/AI/project/Prism/src-tauri/target/release/bundle/macos/Prism.app /Users/Alex/AI/project/Prism/.codex-smoke/fs-scope/smoke.md
```

结果：

- `npm test -- --run scripts/generate-updater-manifest.test.ts` 通过：2 tests，覆盖 `latest.json` 生成、URL / signature 写入，以及 `.sig` 漂移后 `--check` 失败。
- `npm test -- --run` 通过：26 files / 95 tests
- `npm run build` 通过，仅保留既有 Vite chunk size warning
- `npm run tauri:build` 通过，并生成 DMG、`.app.tar.gz` 与 `.sig`
- `npm run release:manifest` 通过，生成 `src-tauri/target/release/bundle/macos/latest.json`
- `npm run release:manifest:check` 通过，确认 `latest.json` 的版本、平台 URL 和 signature 与当前 `.sig` 一致
- 真实 App smoke 通过：无既有 lastSession、已有 lastSession 两种文件打开路径均通过
- `git diff --check` 通过
- `rg '"path": "\\*\\*"' src-tauri/capabilities` 无命中
- `rg 'console\.(log|debug|info)' src` 无命中

## 5. 验证限制

- Computer Use 连接 Prism 返回 `connectionInvalid`
- `screencapture` 返回 `could not create image from display`
- 因此本次可视 UI 没有截图证据，采用真实 App 进程、macOS 文件打开事件和 `$APPDATA/config.json` 写入结果作为运行时证据

## 6. 后续仍需人工确认

- 通过 App 内菜单打开文件夹，确认文件树完整展示
- 通过 App 内保存和导出对话框确认目标路径写入
- Apple Developer ID 签名与公证仍需真实证书环境验证
- GitHub Release 的 `latest.json` 和 Windows updater 产物仍需发布环境验证
