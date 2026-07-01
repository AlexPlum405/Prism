# PRISM-FF-132 导出打开产物动作安装版复测

日期：2026-07-01
App：`/Applications/Prism.app`
Bundle ID：`com.prism.editor.v1`
文档：`/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md`
产物：`/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.html`

## 修复点

- 导出成功 toast 中的“打开”和“显示位置”动作点击后不自动关闭。
- 导出成功且带动作的 toast 显示时间统一延长到 15 秒，避免用户和自动化验收来不及点击后续动作。

## 验证步骤

1. 使用安装版 Prism 打开默认指南文档。
2. 通过右下角导出按钮选择 `导出为 HTML`。
3. 因产物已存在，确认 `替换并导出`。
4. 截图确认成功 toast 显示 `HTML 导出完成`、产物文件名、`打开` 和 `显示位置` 两个动作。
5. 点击 `打开`，等待外部应用响应。
6. 重新执行一次 HTML 导出，截图确认成功 toast 再次出现。
7. 点击 `显示位置`，等待 Finder 响应。

## 实际结果

- `打开` 动作触发后，前台应用变为 `Google Chrome`，Chrome 打开本地文件：
  `/Users/Alex/Documents/Prism/Examples/Prism%20Markdown%20语法指南.html`。
- `显示位置` 动作触发后，前台应用变为 `Finder`，Finder 打开 `Examples` 目录并选中 `Prism Markdown 语法指南.html`。
- 两次复测中的 HTML 产物均更新了修改时间：
  - 打开动作复测：`Jul  1 14:38:47 2026`
  - 显示位置复测：`Jul  1 14:44:24 2026`

## 证据

- `screenshots/35-installed-export-open-actions-retest/01-html-export-success-toast.png`
- `screenshots/35-installed-export-open-actions-retest/02-open-action-external-app.png`
- `screenshots/35-installed-export-open-actions-retest/03-html-export-success-toast-for-reveal.png`
- `screenshots/35-installed-export-open-actions-retest/04-reveal-action-finder-location.png`
- `logs/app-smoke-installed-ff132-20260701/open-action-evidence.txt`
- `logs/app-smoke-installed-ff132-20260701/reveal-action-evidence.txt`

## 结论

`PRISM-FF-132` 已在真实安装版中复测通过，可从 `Blocked` 改为 `Pass`。Windows/Linux 导出、权限拒绝、破坏性操作和压力测试仍需真实环境或用户确认，不在本次改 Pass。
