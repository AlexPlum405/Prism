# Prism RC 验证检查点

日期：2026-07-01
App：`/Applications/Prism.app`
Bundle ID：`com.prism.editor.v1`
版本：`1.4.1`

## 本轮目标

继承 `prism-full-functional-2026-06-27` 已有全功能证据，不从头重跑全量测试；先闭环 `PRISM-FF-132 导出打开产物动作`，随后按 Blocked burn-down 计划闭环唯一 P0 Blocked：`PRISM-FF-026 复制为多格式`，并补齐 `PRISM-FF-092 dirty guard` 与 `PRISM-FF-094 文件夹授权失败` 自动化证据。

## 代码改动

- 导出成功 toast 的 `打开` 与 `显示位置` action 增加 `dismissOnClick: false`，点击任一动作后 toast 不再立即关闭。
- 导出成功且带动作的 toast 使用 `EXPORT_ACTION_TOAST_DURATION_MS = 15000`，给用户和自动化复测足够时间点击后续动作。
- `scripts/run-app-smoke.mjs` 增强窗口/截图稳定性：Quick Open 重试、截图尺寸变化按重叠区域比较、退出时清理所有 Prism app 实例。
- 编辑区普通 `copy` 写入 Markdown 源文本 `text/plain` 与渲染后的 `text/html`；`copyPlain` / `copyMd` 保持纯文本语义，显式 `copyHtml` 使用 HTML fallback。
- 空状态“打开文件夹”按钮的授权失败路径改为显示全局 error toast，并阻止继续加载文件树或打开新窗口，避免半加载工作区状态。

## 验证命令

```bash
git status --short --branch
npm test -- --run src/hooks/useExportTaskUi.test.tsx src/domains/commands/registry.test.ts src/domains/commands/exportCommand.integration.test.ts
npm test -- --run src/domains/editor/runtime/editorCommandAdapter.test.ts src/domains/editor/extensions/richCopy.test.ts src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx
npm test -- --run src/lib/fileActions.test.ts src/lib/openDocumentFlow.test.ts src/app/useAppFileActionsModel.test.tsx src/domains/document/components/DirtyDocumentSwitchModal.test.tsx
npm test -- --run src/domains/workspace/components/OpenFolderButton.test.tsx src/domains/commands/categories/workspaceCommands.test.ts src/domains/commands/registry.test.ts
npm run build
npm run tauri:build:app-smoke
PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs
```

当前结果：

- Vitest：3 个测试文件 / 39 条断言通过。
- 富复制回归 Vitest：4 个测试文件 / 53 条测试通过。
- Dirty guard 回归 Vitest：4 个测试文件 / 32 条测试通过。
- 文件夹授权失败回归 Vitest：3 个测试文件 / 41 条测试通过。
- `npm run build`：通过。
- `npm run tauri:build:app-smoke`：通过，完成 app bundle 构建、Markdown 文档图标 patch、本地 bundle smoke。
- `/Applications/Prism.app` 安装版 smoke：通过，覆盖 `.markdown` 中文/空格路径、JSON/SQL/TXT、Markdown、ERROR 诊断、Quick Open、编辑保存、导出菜单、设置中心、HTML/PDF/PNG/DOCX 复杂导出产物。
- 安装版身份：`CFBundleIdentifier = com.prism.editor.v1`，`CFBundleName = Prism`，版本 `1.4.1`。

## PRISM-FF-132 复测结果

状态：Pass

真实安装版步骤：

1. 用 `/Applications/Prism.app` 打开 `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md`。
2. 导出为 HTML，确认 `替换并导出`。
3. 截图确认成功 toast 显示 `HTML 导出完成`、产物文件名、`打开`、`显示位置`。
4. 点击 `打开`，前台应用变为 `Google Chrome`，打开本地 HTML 产物。
5. 再次导出 HTML。
6. 点击 `显示位置`，前台应用变为 `Finder`，Finder 打开 `Examples` 目录并选中 `Prism Markdown 语法指南.html`。

证据：

- `screenshots/35-installed-export-open-actions-retest/01-html-export-success-toast.png`
- `screenshots/35-installed-export-open-actions-retest/02-open-action-external-app.png`
- `screenshots/35-installed-export-open-actions-retest/03-html-export-success-toast-for-reveal.png`
- `screenshots/35-installed-export-open-actions-retest/04-reveal-action-finder-location.png`
- `logs/computer-use-real-app/export-open-actions-installed-retest-20260701.md`
- `logs/app-smoke-installed-ff132-20260701/open-action-evidence.txt`
- `logs/app-smoke-installed-ff132-20260701/reveal-action-evidence.txt`

## PRISM-FF-026 复测结果

状态：Pass

真实安装版步骤：

1. 用 `/Applications/Prism.app` 打开 `docs/verification/runs/prism-full-functional-2026-06-27/fixtures/blocked-burn-down/rich-copy-multi-format.md`。
2. 执行 `Cmd+A` / `Cmd+C`。
3. 用 Swift 直接读取 `NSPasteboard.general.types`、plain text 和 HTML 内容摘要。

结果：

- 剪贴板类型包含 `public.html`、`Apple HTML pasteboard type`、`public.utf8-plain-text`、`NSStringPboardType`。
- plain text 保留 Markdown 源文本。
- HTML 长度为 2989，包含 `<strong>`、`href` 和 `<table>`。

证据：

- `screenshots/36-blocked-burn-down/PRISM-FF-026-copy-installed-app.png`
- `logs/blocked-burn-down-20260701/prism-ff-026-copy-installed-app.log`
- `logs/unit-tests/rich-copy-multi-format-20260701.log`
- `logs/app-smoke-blocked-burn-down-20260701/report.json`

## PRISM-FF-092 复测结果

状态：Pass/code-verified

说明：旧真实安装版复测无法稳定制造“点击文件树切换时仍 dirty”的前置条件，因为自动保存先于切换完成。本轮不伪造成真实 UI 弹窗复测，改用代码级自动化证明产品逻辑：

- `workspace-navigation` policy 启用 `dirtyGuard: true`。
- 弹窗暴露保存、另存为、放弃改动、取消。
- cancel 保持当前 dirty 文档。
- discard 放弃 dirty 编辑后打开目标。
- save 先保存当前文档再打开目标。
- saveAs 请求新路径写入后再打开目标。
- 保存前发现外部磁盘变化时停留当前文档并进入 conflict。

证据：

- `logs/unit-tests/dirty-guard-switch-20260701.log`
- `logs/computer-use-real-app/dirty-guard-switch-check.log`

## PRISM-FF-094 复测结果

状态：Pass/code-verified

说明：本项验证“打开文件夹”时授权失败的用户反馈和状态回滚。为避免真实拒绝 macOS 用户目录权限、污染系统授权状态，本轮使用 mock 授权拒绝做代码级自动化覆盖：

- `grantWorkspaceDirectoryScope` 抛出 `permission denied` 后显示全局 error toast。
- 不继续调用 `loadFolderTree`。
- 不打开新 Prism 窗口。
- `workspace.rootPath` 保持 `null`。
- 文件树保持空数组，避免半加载 workspace。

证据：

- `logs/unit-tests/folder-authorization-failure-20260702.log`
- `logs/app-smoke-folder-authorization-failure-20260702/report.json`

## 当前统计

```json
{
  "total": 168,
  "Pass": 142,
  "Fail": 0,
  "Blocked": 26,
  "Not Run": 0,
  "screenshotFiles": 434,
  "manifestScreenshots": 1016,
  "uniqueManifestScreenshots": 455,
  "computerUseRealAppEvidence": 245
}
```

## 剩余 Blocked 分类

- Windows/Linux 真机：无真实 Windows/Linux 设备，不伪造导出和文件关联验证。
- 权限拒绝/破坏性操作：需要用户明确确认后才能执行拒绝权限、删除、重命名父目录等破坏性或半破坏性路径。
- 注入故障/断网/Worker/内存压力：需要专门故障注入、断网环境或长时间压力采样，本轮不把未执行项改 Pass。
- 短暂动画类证据：预览源码 flash 等需要录屏或可控动画时长专项复测。

## 结论

本轮已形成可发布候选检查点：Fail 仍为 0，`PRISM-FF-132` 与 `PRISM-FF-026` 已真实闭环为 Pass，`PRISM-FF-092` 与 `PRISM-FF-094` 已通过自动化补证据降噪，P0 Blocked 已清零；剩余非通过项均保持 Blocked 且不伪造验证。
