# 打印与帮助外链安装版复测记录

日期：2026-07-01

App：`/Applications/Prism.app`

Bundle ID：`com.prism.editor.v1`

版本：`1.4.1`

测试文档：`fixtures/computer-use-real-app/real-complex-diagrams-export.md`

## 构建与替换

- `npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/categories/fileCommands.test.ts src-tauri/windowConfig.test.ts` 通过：3 个文件 / 44 条测试。
- `npm run build` 通过。
- `npm run tauri:build:app-smoke` 通过，真实 app smoke 显示 `Cmd+Shift+P opens workspace target file`。
- 已备份旧 `/Applications/Prism.app` 并替换为 `src-tauri/target/release/bundle/macos/Prism.app`。
- 已执行 `node scripts/patch-macos-document-icons.mjs /Applications/Prism.app`。

## 打印复测

- 打开真实安装版 Prism 和 `real-complex-diagrams-export.md`。
- 点击窗口内 `文件` 菜单。
- AX 菜单项包含 `打印 ⌘P`。
- 截图：`screenshots/33-installed-print-help-retest/01-file-menu-print-entry.png`。
- 按 `Cmd+P`。
- macOS 系统打印 sheet 出现，包含 Page 1 of 1、Printer、Presets、Copies、Pages、PDF、Cancel 和 Print 按钮。
- 因当前没有选择打印机，Print 按钮禁用；截图后点击 Cancel，未执行打印。
- 截图：`screenshots/33-installed-print-help-retest/02-native-print-dialog.png`。

## 帮助外链复测

- 打开真实安装版 Prism 的 `帮助` 菜单。
- 菜单项包含 `Prism 迁移帮助`。
- 点击后默认浏览器 Chrome 打开：
  `https://github.com/AlexPlum405/Prism/blob/codex/prism-full-optimization/docs/help/prism-migration-guide.md`
- Chrome 标题：
  `Prism/docs/help/prism-migration-guide.md at codex/prism-full-optimization · AlexPlum405/Prism`
- 页面不再是 GitHub `File not found`。
- 截图：`screenshots/33-installed-print-help-retest/03-migration-guide-github-page.png`。

## 结论

- `PRISM-FF-142 / P1-PRINT-001`：Pass。
- `PRISM-FF-143 / P1-HELP-002`：Pass。
