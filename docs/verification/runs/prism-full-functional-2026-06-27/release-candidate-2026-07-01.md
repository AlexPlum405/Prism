# Prism RC 验证检查点

日期：2026-07-01
App：`/Applications/Prism.app`
Bundle ID：`com.prism.editor.v1`
版本：`1.4.1`

## 本轮目标

继承 `prism-full-functional-2026-06-27` 已有全功能证据，不从头重跑全量测试；先闭环 `PRISM-FF-132 导出打开产物动作`，随后按 Blocked burn-down 计划闭环唯一 P0 Blocked：`PRISM-FF-026 复制为多格式`，并补齐 `PRISM-FF-092 dirty guard`、`PRISM-FF-094 文件夹授权失败`、`PRISM-FF-135 设置持久化错误`、`PRISM-FF-138 Error Boundary`、`PRISM-FF-162 Worker 降级`、`PRISM-FF-118 索引任务取消`、配置资源类与破坏性文件操作 Blocked 自动化证据。

## 代码改动

- 导出成功 toast 的 `打开` 与 `显示位置` action 增加 `dismissOnClick: false`，点击任一动作后 toast 不再立即关闭。
- 导出成功且带动作的 toast 使用 `EXPORT_ACTION_TOAST_DURATION_MS = 15000`，给用户和自动化复测足够时间点击后续动作。
- `scripts/run-app-smoke.mjs` 增强窗口/截图稳定性：Quick Open 重试、截图尺寸变化按重叠区域比较、退出时清理所有 Prism app 实例。
- 编辑区普通 `copy` 写入 Markdown 源文本 `text/plain` 与渲染后的 `text/html`；`copyPlain` / `copyMd` 保持纯文本语义，显式 `copyHtml` 使用 HTML fallback。
- 空状态“打开文件夹”按钮的授权失败路径改为显示全局 error toast，并阻止继续加载文件树或打开新窗口，避免半加载工作区状态。
- 设置保存失败路径改为显示全局 error toast，保留 native 错误原因，同时继续吞掉异常，避免设置中心或调用方崩溃。

## 验证命令

```bash
git status --short --branch
npm test -- --run src/hooks/useExportTaskUi.test.tsx src/domains/commands/registry.test.ts src/domains/commands/exportCommand.integration.test.ts
npm test -- --run src/domains/editor/runtime/editorCommandAdapter.test.ts src/domains/editor/extensions/richCopy.test.ts src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx
npm test -- --run src/lib/fileActions.test.ts src/lib/openDocumentFlow.test.ts src/app/useAppFileActionsModel.test.tsx src/domains/document/components/DirtyDocumentSwitchModal.test.tsx
npm test -- --run src/domains/workspace/components/OpenFolderButton.test.tsx src/domains/commands/categories/workspaceCommands.test.ts src/domains/commands/registry.test.ts
npm test -- --run src/domains/settings/pathPersistence.test.ts src/components/shell/SettingsModal.test.tsx src/domains/settings/citationSettings.test.ts src/domains/settings/normalize.test.ts
npm test -- --run src/components/shell/AppErrorBoundary.test.tsx src/hooks/useAppToast.test.tsx src/app/useAppAuxiliaryModalsModel.test.tsx src/app/useAppCommandWiringModel.test.tsx
npm test -- --run src/lib/markdownRenderService.test.ts
npm test -- --run src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/domains/workspace/services/workspaceIndexNative.test.ts src/domains/workspace/services/workspaceIndex.test.ts
cargo test workspace_index --manifest-path src-tauri/Cargo.toml
npm test -- --run src/domains/settings/pathPersistence.test.ts src/domains/settings/normalize.test.ts
npm test -- --run src/domains/themes/themePackage.test.ts src/domains/themes/themeRegistry.test.ts src/domains/themes/themeStorage.test.ts src/domains/themes/themeInstaller.test.ts src/components/shell/SettingsModal.test.tsx src/domains/settings/fontService.test.ts src/domains/workspace/components/RelationGraphPanel.test.tsx
cargo test theme_store --manifest-path src-tauri/Cargo.toml
npm test -- --run src/lib/fileActions.test.ts src/domains/workspace/components/fileTreeContextMenu.test.ts src/domains/workspace/components/FileTree.test.tsx src/app/useAppWorkspaceContextMenu.test.tsx
npm run build
npm run tauri:build:app-smoke
PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs
```

当前结果：

- Vitest：3 个测试文件 / 39 条断言通过。
- 富复制回归 Vitest：4 个测试文件 / 53 条测试通过。
- Dirty guard 回归 Vitest：4 个测试文件 / 32 条测试通过。
- 文件夹授权失败回归 Vitest：3 个测试文件 / 41 条测试通过。
- 设置持久化失败回归 Vitest：4 个测试文件 / 35 条测试通过。
- Error Boundary 注入异常回归 Vitest：4 个测试文件 / 8 条测试通过。
- Markdown Worker 降级回归 Vitest：1 个测试文件 / 14 条测试通过。
- Workspace index cancellation 回归 Vitest：3 个测试文件 / 21 条测试通过。
- Workspace index Rust 回归：17 条测试通过。
- Settings migration 回归 Vitest：2 个测试文件 / 15 条测试通过。
- Theme/font/graph fallback 回归 Vitest：7 个测试文件 / 39 条测试通过。
- Theme store Rust 回归：1 条测试通过。
- Destructive file actions sandbox 回归 Vitest：4 个测试文件 / 31 条测试通过。
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

## PRISM-FF-135 复测结果

状态：Pass/code-verified

说明：本项验证设置保存失败时的可见反馈和 UI 稳定性。为避免修改真实 app data 权限、污染用户配置，本轮使用 mock native `settings_write_failed` 做代码级自动化覆盖：

- `saveSettings` 不向调用方抛出异常，设置中心不会崩溃。
- 内存中的设置变更保持可见。
- 非 native-unavailable 的真实写入失败不会误走 legacy `writeTextFile` fallback。
- 发出全局 error toast，标题为设置保存失败，正文保留 `permission denied` 等错误原因。

证据：

- `logs/unit-tests/settings-persistence-failure-20260702.log`
- `logs/app-smoke-settings-persistence-failure-20260702/report.json`

## PRISM-FF-138 复测结果

状态：Pass/code-verified

说明：本项验证 React render 异常时不白屏。为避免在真实 App 暴露崩溃开关，本轮使用测试组件安全注入 render 阶段异常：

- 子组件抛出 `Injected render failure`。
- `AppErrorBoundary` 捕获后显示 `role=alert` fallback。
- fallback 包含 `Prism 渲染失败` 标题、说明文本、错误消息和 component stack。

证据：

- `logs/unit-tests/error-boundary-injected-render-20260702.log`

## PRISM-FF-162 复测结果

状态：Pass/code-verified

说明：本项验证 Markdown 预览 Worker 不可用或失败时的主线程降级。为避免在真实 App 暴露禁用 Worker 开关，本轮使用 `WorkerFactory` mock 安全覆盖：

- 无 Worker 环境返回与 `markdownToHtml` 字节一致的 HTML。
- Worker runtime error 后释放 pending 请求并降级主线程渲染。
- Worker 回包 error 后用原请求内容主线程重渲染。
- 富内容和三语 front matter 文案保持一致。

证据：

- `logs/unit-tests/markdown-worker-fallback-20260702.log`

## PRISM-FF-118 复测结果

状态：Pass/code-verified

说明：本项验证快速切换工作区时旧索引任务取消、新索引结果不串 root。为避免真实大工作区反复切换，本轮使用临时 fixture、mock running native job 和 Rust 域测试覆盖：

- 前端 hook 从 root A 切到 root B 时调用 `cancelWorkspaceIndexJobNativeModel('workspace-index-a')`。
- root B job 完成后，当前 `workspaceIndex.rootPath` 为 `/workspace-b`。
- 旧 root A 文档不会进入当前索引。
- Rust 层 cancel flag 会中断 build。
- Rust job store 启动同 root 新 job 会取消旧 running job。

证据：

- `logs/unit-tests/workspace-index-cancellation-20260702.log`
- `logs/unit-tests/workspace-index-cancellation-rust-20260702.log`

## PRISM-FF-134 / 103 / 105 / 120 复测结果

状态：Pass/code-verified

说明：本组验证配置迁移、用户主题包扫描、自托管字体和图谱 native fallback。为避免污染真实 App Support 配置、themes 或 fonts 目录，本轮使用 mock appData、native DTO、临时目录和组件测试覆盖：

- 旧设置可迁移并写回 appData，旧 schema 和旧 PDF 字段可升级，非法值回退默认。
- native theme scan 的 valid/invalid 结果可进入可用/异常主题列表；Rust 临时 themes 目录可扫描有效/无效包。
- 导入字体复制到 appData/fonts，FontFace 从本地 bytes 注册，已保存字体也从本地文件重新注册。
- native relation graph 查询失败时回退 TypeScript graph，节点仍可见。

证据：

- `logs/unit-tests/settings-migration-legacy-config-20260702.log`
- `logs/unit-tests/theme-font-graph-fallback-20260702.log`
- `logs/unit-tests/theme-store-rust-20260702.log`

## PRISM-FF-096 / 097 复测结果

状态：Pass/code-verified

说明：本组验证删除当前打开文件和重命名当前父文件夹。为避免误伤真实文档，本轮使用 mock 文件系统、native trash 和 throwaway 路径覆盖：

- 删除当前打开文件优先调用系统废纸篓，不触发永久删除。
- 删除成功后当前文档关闭，工作区文件树刷新，并显示成功反馈。
- 重命名当前父文件夹时更新当前打开文档路径前缀。
- 重命名后工作区文件树刷新，并显示成功反馈。

证据：

- `logs/unit-tests/destructive-file-actions-sandbox-20260702.log`

## 当前统计

```json
{
  "total": 168,
  "Pass": 156,
  "Fail": 0,
  "Blocked": 12,
  "Not Run": 0,
  "screenshotFiles": 434,
  "manifestScreenshots": 1016,
  "uniqueManifestScreenshots": 455,
  "computerUseRealAppEvidence": 245
}
```

## 剩余 Blocked 分类

- Windows/Linux 真机：无真实 Windows/Linux 设备，不伪造导出和文件关联验证。
- macOS 原生集成：文件关联已用安装版 `open -a` 启动矩阵验证；沙盒授权仍需要真实系统授权流程复测，不用推测替代。
- 断网/高 DPI：需要专门断网或网络拦截环境，以及 1x/2x/4x 与跨显示器缩放矩阵。
- 性能与压力：性能日志已用 `localStorage.prism.previewPerf=1` 的代码级测试验证；内存释放、导出大图内存仍需要专用脚本和时间窗口，本轮不把未执行项改 Pass。

## 结论

本轮已形成可发布候选检查点：Fail 仍为 0，`PRISM-FF-132` 与 `PRISM-FF-026` 已真实闭环为 Pass；`PRISM-FF-092`、`PRISM-FF-094`、`PRISM-FF-135`、`PRISM-FF-138`、`PRISM-FF-162`、`PRISM-FF-118`、`PRISM-FF-116`、`PRISM-FF-165`、`PRISM-FF-147`、`PRISM-FF-161`、配置资源类与破坏性文件操作 Blocked 已通过自动化补证据降噪；P0/P1 Blocked 已清零；剩余非通过项均保持 Blocked 且不伪造验证。
