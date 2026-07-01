# Blocked Burn-down Report - 2026-07-01

## 本轮目标

按附件计划先闭环唯一 P0 Blocked：`PRISM-FF-026 复制为多格式`。本轮不从头重跑全量测试，不伪造 Windows/Linux、权限拒绝、破坏性操作或压力测试结果。

## 结果

- `PRISM-FF-026`：Blocked -> Pass
- `PRISM-FF-092`：Blocked -> Pass/code-verified
- `PRISM-FF-094`：Blocked -> Pass/code-verified
- `PRISM-FF-135`：Blocked -> Pass/code-verified
- `PRISM-FF-138`：Blocked -> Pass/code-verified
- `PRISM-FF-162`：Blocked -> Pass/code-verified
- `PRISM-FF-118`：Blocked -> Pass/code-verified
- `PRISM-FF-134`：Blocked -> Pass/code-verified
- `PRISM-FF-103`：Blocked -> Pass/code-verified
- `PRISM-FF-105`：Blocked -> Pass/code-verified
- `PRISM-FF-120`：Blocked -> Pass/code-verified
- `PRISM-FF-096`：Blocked -> Pass/code-verified
- `PRISM-FF-097`：Blocked -> Pass/code-verified
- `PRISM-FF-116`：Blocked -> Pass/code-verified
- `PRISM-FF-165`：Blocked -> Pass/code-verified
- 总计：Pass 154 / Fail 0 / Blocked 14 / Not Run 0
- P0：Pass 88 / Fail 0 / Blocked 0 / Not Run 0
- P1：Pass 56 / Fail 0 / Blocked 0 / Not Run 0
- P2：Pass 5 / Fail 0 / Blocked 11 / Not Run 0
- P3：Pass 5 / Fail 0 / Blocked 3 / Not Run 0

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

结果：

- Vitest：4 个测试文件 / 53 条测试通过。
- Dirty guard Vitest：4 个测试文件 / 32 条测试通过。
- Folder authorization Vitest：3 个测试文件 / 41 条测试通过。
- Settings persistence failure Vitest：4 个测试文件 / 35 条测试通过。
- Error Boundary injected render Vitest：4 个测试文件 / 8 条测试通过。
- Markdown Worker fallback Vitest：1 个测试文件 / 14 条测试通过。
- Workspace index cancellation Vitest：3 个测试文件 / 21 条测试通过。
- Workspace index Rust：17 条测试通过。
- Settings migration Vitest：2 个测试文件 / 15 条测试通过。
- Theme/font/graph fallback Vitest：7 个测试文件 / 39 条测试通过。
- Theme store Rust：1 条测试通过。
- Destructive file actions sandbox Vitest：4 个测试文件 / 31 条测试通过。
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

## PRISM-FF-138 Error Boundary

本轮不在真实 App 暴露崩溃开关；通过测试组件安全注入 render 阶段异常。

验证：

- 子组件 render 抛出 `Injected render failure`。
- `AppErrorBoundary` 显示 `role=alert` fallback。
- fallback 包含 `Prism 渲染失败` 标题、说明文本、错误消息和 component stack。
- 页面不白屏，异常不会穿透导致测试进程失败。

证据：

- `logs/unit-tests/error-boundary-injected-render-20260702.log`

## PRISM-FF-162 Worker Fallback

本轮不在真实 App 暴露禁用 Worker 开关；通过 `WorkerFactory` mock 安全覆盖预览渲染 Worker 降级路径。

验证：

- 无 Worker 环境返回与 `markdownToHtml` 字节一致的主线程 HTML。
- 主线程降级路径正确渲染表格、代码、KaTeX 和 callout。
- Worker 运行期失败时 terminate worker、释放首个 pending 请求并降级主线程渲染。
- Worker 回包 error 时使用原请求内容主线程重渲染。
- Worker 路径下三语 front matter 文案保持正确。

证据：

- `logs/unit-tests/markdown-worker-fallback-20260702.log`

## PRISM-FF-118 Workspace Index Cancellation

本轮不使用真实大工作区反复切换；通过临时 fixture、mock running native job 和 Rust 域测试覆盖取消语义。

验证：

- 前端 hook 从 root A 快速切换到 root B 时，会调用 `cancelWorkspaceIndexJobNativeModel('workspace-index-a')`。
- 新 root B 的 native job 完成后，当前 `workspaceIndex.rootPath` 为 `/workspace-b`。
- 旧 root A 的文档不会进入当前索引。
- Rust `workspace_index` 确认 cancel flag 会中断 build。
- Rust `workspace_index_job` 确认启动同 root 新 job 会取消旧 running job，已完成 job 的 cancel 是 no-op。

证据：

- `logs/unit-tests/workspace-index-cancellation-20260702.log`
- `logs/unit-tests/workspace-index-cancellation-rust-20260702.log`

## PRISM-FF-134 / PRISM-FF-103 / PRISM-FF-105 / PRISM-FF-120 Config Resource Checks

本轮不写入真实 App Support 配置、themes 或 fonts 目录；通过 mock appData、native DTO、临时目录和组件测试覆盖配置资源类路径。

验证：

- 设置迁移：legacy config 可读取并写回 appData，旧 schema 与临时 PDF 页眉页脚字段可升级，非法持久化值会回退默认值。
- 用户主题包扫描：native scan 的 valid theme 进入可用主题，invalid theme 保留错误原因；Rust `theme_store` 可在临时 themes 目录扫描有效/无效包，并删除用户主题。
- 自托管字体：导入字体复制到 appData/fonts，FontFace 从本地 `readFile` bytes 注册；已保存 customFonts 重新注册时也只读本地文件。
- 图谱 native fallback：native relation graph 查询失败时记录 warning 并回退 TypeScript graph，节点仍可见。

证据：

- `logs/unit-tests/settings-migration-legacy-config-20260702.log`
- `logs/unit-tests/theme-font-graph-fallback-20260702.log`
- `logs/unit-tests/theme-store-rust-20260702.log`

## PRISM-FF-096 / PRISM-FF-097 Destructive File Actions Sandbox

本轮不对真实用户文件执行 GUI 删除或重命名；通过 mock 文件系统、native trash 和 throwaway 路径覆盖高风险逻辑。

验证：

- 删除当前打开文件优先调用 `move_path_to_trash`，不触发永久 `remove`。
- 删除成功后当前文档关闭，workspace fileTree 刷新，并显示移到废纸篓反馈。
- 重命名当前打开文档的父文件夹时调用 `rename(oldDir, newDir)`。
- 当前打开文档路径从旧目录前缀替换为新目录前缀。
- 重命名后 workspace fileTree 刷新，并显示重命名完成反馈。
- `src/domains/editor/runtime/editorScrollRuntime.test.ts`
  - 增加真实 `lineFlashField` 覆盖，验证源码定位 flash 装饰在清理回调触发前保持、触发后移除。
- `src/domains/workspace/services/workspaceIndex.performance.test.ts`
  - 将大工作区全文搜索 benchmark 提升到 1200 文档，并与 1501 文档索引构建 benchmark 一起作为超大工作区代码级证据。

证据：

- `logs/unit-tests/destructive-file-actions-sandbox-20260702.log`
- `logs/unit-tests/preview-source-flash-code-verified-20260702.log`
- `logs/unit-tests/workspace-large-index-benchmark-20260702.log`

## 剩余范围

附件计划中的可自动化 Blocked 降噪项已闭环，P0/P1 Blocked 已清零，超大工作区已用 benchmark 补证据。后续剩余项应按 macOS 原生集成、平台真机矩阵、断网/高 DPI、内存释放和导出大图压力分别推进。

Windows/Linux 继续保持真机回填，不伪造验证；压力和断网类测试需要专门时间窗口与隔离环境。
