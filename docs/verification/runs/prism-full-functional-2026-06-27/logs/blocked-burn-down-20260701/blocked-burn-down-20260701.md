# Blocked Burn-down Report - 2026-07-01

## 本轮目标

按附件计划先闭环唯一 P0 Blocked：`PRISM-FF-026 复制为多格式`。本轮不从头重跑全量测试，不伪造 Windows/Linux、权限拒绝、破坏性操作或压力测试结果。

## 结果

- `PRISM-FF-026`：Blocked -> Pass
- `PRISM-FF-092`：Blocked -> Pass/code-verified
- `PRISM-FF-094`：Blocked -> Pass/code-verified
- `PRISM-FF-135`：Blocked -> Pass/code-verified
- 总计：Pass 143 / Fail 0 / Blocked 25 / Not Run 0
- P0：Pass 88 / Fail 0 / Blocked 0 / Not Run 0
- P1：Pass 47 / Fail 0 / Blocked 9 / Not Run 0

## 代码变更

- `src/domains/editor/runtime/editorCommandAdapter.ts`
  - 普通 `copy` 改为写入 Markdown 源文本 `text/plain` 与渲染后的 `text/html`。
  - `copyPlain` / `copyMd` 保持纯 Markdown 文本。
  - `copyHtml` 显式 HTML 复制在缺少 rich clipboard API 时回退 HTML 源码。
- `src/domains/editor/extensions/richCopy.ts`
  - `writeRichClipboard` 增加 fallback 策略，普通富复制默认回退 plain text，显式 HTML 复制可回退 HTML source。
- `src/domains/editor/components/SplitView.tsx`
  - 预览态 `copyHtml` 使用 HTML fallback。
- `src/domains/editor/components/useEditorTableModel.ts`
  - 表格 HTML 复制使用 HTML fallback。
- `src/domains/settings/store.ts`
  - 设置保存失败时发出全局 error toast，并保留错误原因；异常不继续向上抛出，避免设置 UI 崩溃。
- `src/domains/i18n/resources.ts`
  - 补充设置保存失败的中英日文案。

## 真实安装版证据

Fixture：

```text
docs/verification/runs/prism-full-functional-2026-06-27/fixtures/blocked-burn-down/rich-copy-multi-format.md
```

验证动作：

```text
1. 替换 /Applications/Prism.app。
2. 用真实安装版打开 fixture。
3. 执行 Cmd+A / Cmd+C。
4. 用 Swift 读取 NSPasteboard.general。
```

剪贴板类型：

```text
public.html
Apple HTML pasteboard type
public.utf8-plain-text
NSStringPboardType
com.apple.WebKit.custom-pasteboard-data
```

内容摘要：

```text
plain-length: 259
html-length: 2989
html-has-strong: true
html-has-link: true
html-has-table: true
```

证据：

- `screenshots/36-blocked-burn-down/PRISM-FF-026-copy-installed-app.png`
- `logs/blocked-burn-down-20260701/prism-ff-026-copy-installed-app.log`

## 自动化验证

```bash
npm test -- --run src/domains/editor/runtime/editorCommandAdapter.test.ts src/domains/editor/extensions/richCopy.test.ts src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx
npm test -- --run src/lib/fileActions.test.ts src/lib/openDocumentFlow.test.ts src/app/useAppFileActionsModel.test.tsx src/domains/document/components/DirtyDocumentSwitchModal.test.tsx
npm test -- --run src/domains/workspace/components/OpenFolderButton.test.tsx src/domains/commands/categories/workspaceCommands.test.ts src/domains/commands/registry.test.ts
npm test -- --run src/domains/settings/pathPersistence.test.ts src/components/shell/SettingsModal.test.tsx src/domains/settings/citationSettings.test.ts src/domains/settings/normalize.test.ts
npm run build
npm run tauri:build:app-smoke
PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs
```

结果：

- Vitest：4 个测试文件 / 53 条测试通过。
- Dirty guard Vitest：4 个测试文件 / 32 条测试通过。
- Folder authorization Vitest：3 个测试文件 / 41 条测试通过。
- Settings persistence failure Vitest：4 个测试文件 / 35 条测试通过。
- Build：通过。
- App smoke：12 个步骤全部 pass，报告见 `logs/app-smoke-blocked-burn-down-20260701/report.json`、`logs/app-smoke-folder-authorization-failure-20260702/report.json` 与 `logs/app-smoke-settings-persistence-failure-20260702/report.json`。

## PRISM-FF-092 Dirty Guard

旧真实安装版复测无法稳定制造“点击文件树切换时仍 dirty”的前置条件，因为自动保存先于切换完成。本轮不把该旧 UI 时序伪造成通过，改用代码级自动化补证据：

- `workspace-navigation` 的 open document policy 为 `dirtyGuard: true`。
- `DirtyDocumentSwitchModal` 暴露保存、另存为、放弃改动、取消四个动作。
- cancel：保持当前 dirty 文档，不读取目标文件。
- discard：不保存 dirty 编辑，直接打开目标文件。
- save：先写当前 dirty 文档，再打开目标文件。
- saveAs：请求新路径，写入 dirty 编辑，再打开目标文件。
- 保存前发现外部磁盘变化：停留当前文档并进入 conflict。

证据：

- `logs/unit-tests/dirty-guard-switch-20260701.log`
- `logs/computer-use-real-app/dirty-guard-switch-check.log`（旧真实 UI 时序阻塞日志，作为 precondition 风险说明保留）

## PRISM-FF-094 Folder Authorization Failure

本轮不真实拒绝 macOS 用户目录权限，不修改系统安全设置；通过 mock 授权失败覆盖可控拒绝路径。

修复：

- 空状态 `OpenFolderButton` 捕获 `grantWorkspaceDirectoryScope` 失败后发出全局 error toast。
- 失败后不调用 `loadFolderTree`。
- 失败后不打开新窗口。
- 失败后 `workspace.rootPath` 保持 `null`，`fileTree` 保持空数组，避免半加载状态。
- 命令面板/菜单 `openFolder` 路径继续由 workspace command 与 registry 测试覆盖；`runCommand` 仍有命令级失败 toast fallback。

证据：

- `logs/unit-tests/folder-authorization-failure-20260702.log`
- `logs/app-smoke-folder-authorization-failure-20260702/report.json`

## PRISM-FF-135 Settings Persistence Failure

本轮不修改真实 app data 权限，不污染用户配置；通过 mock native `settings_write_failed` 覆盖配置写入失败路径。

修复：

- `saveSettings` 捕获设置持久化异常后发出全局 error toast。
- toast 标题使用本地化的设置保存失败文案，正文保留 native 错误原因。
- 异常不向上抛出，设置中心和调用方不会崩溃。
- 非 native-unavailable 的真实写入失败不会误走 legacy `writeTextFile` fallback。
- 内存中的设置变更保留，用户可继续操作并在权限恢复后再次保存。

证据：

- `logs/unit-tests/settings-persistence-failure-20260702.log`
- `logs/app-smoke-settings-persistence-failure-20260702/report.json`

## 剩余范围

下一阶段按附件计划进入可自动化 Blocked 降噪，优先：

- `PRISM-FF-138` Error Boundary
- `PRISM-FF-162` Worker 降级
- `PRISM-FF-118` 索引任务取消

破坏性/权限类测试仍需独立沙盒；Windows/Linux 继续保持真机回填，不伪造验证。
