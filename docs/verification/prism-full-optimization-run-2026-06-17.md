# Prism 全量优化执行验证记录

> 日期：2026-06-17  
> 分支：`codex/prism-full-optimization`  
> 当前启动提交：`ecfd85369066b228a4f4ce1e3c8e94e7cd602c62`  
> 已验证文档基线：`550ff87d4b28f2351a2c38b92ce7705a624660c6`  
> 优化计划基线：`34601027558390fe2c068dc7721c44cd00ab1d4b`  

## 环境

| 项 | 值 |
|---|---|
| 记录时间 | 2026-06-17 19:18:47 CST |
| 系统 | macOS 26.5 25F71 |
| Node | v25.9.0 |
| npm | 11.12.1 |
| Rust | rustc 1.95.0 (59807616e 2026-04-14) |
| Cargo | cargo 1.95.0 (f2d3ce0bd 2026-03-21) |
| Tauri CLI | tauri-cli 2.10.1 |

## 执行原则

- 每个 P0/P1/P2 优化项完成后必须记录变更摘要、涉及文件、风险等级、验证命令、结果、证据路径、未验证风险和对应提交。
- 文档-only 变更至少跑 `git diff --check`；代码变更按影响范围跑相关 Vitest、Rust test、build 或 app smoke。
- 涉及 Tauri、文件关联、启动参数、真实 app 链路的项，优先跑 `npm run tauri:build:app-smoke`；如果当前环境不能覆盖 Windows/Linux 真机，记录残余风险和待补验矩阵。
- UI/视觉项必须尽量提供 fixture、截图、computed style 或可复现 smoke 证据；不能只用主观描述作为验收。

## 任务矩阵

| ID | 状态 | 风险 | 最小验证 |
|---|---|---|---|
| P0-01 全局快捷键输入框豁免 | 已完成 | 中 | `npm test -- --run src/app/useAppShortcuts.test.tsx` |
| P0-02 默认 app 打开与启动 smoke | 已完成 | 高 | `npm test -- --run src/hooks/useBootstrap.test.tsx src/lib/openWindow.test.ts`、`npm run tauri:build:app-smoke` |
| P0-03 真实 Tauri WebView 长文档性能基准 | 已完成：基准已建立，3MB 真实性能风险待后续优化 | 高 | `PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose`、`node scripts/run-preview-webview-benchmark.mjs` |
| P1-01 统一打开文件策略 | 已完成 | 高 | `npm test -- --run src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts` |
| P1-02 DocumentProfile 落地 | 已完成 | 高 | `npm test -- --run src/lib/fileActions.test.ts src/hooks/useBootstrap.test.tsx`、`cargo test` |
| P1-03 预览搜索节流和渐进高亮 | 已完成 | 中 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx` |
| P1-04 preview-only 源码定位 ready 队列 | 已完成 | 中 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx` |
| P1-05 状态栏图谱条件显示 | 已完成 | 中 | `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx src/components/shell/CommandPalette.test.tsx` |
| P1-06 导出诊断产品化 | 已完成 | 高 | `npm test -- --run src/domains/export/preflight.test.ts` |
| P1-07 保存、冲突、导出微反馈统一 | 已完成 | 中 | `npm test -- --run src/lib/fileActions.test.ts` 和相关 UI/store tests |
| P2-01 默认阅读排版调优 | 已完成 | 中 | `npm test -- --run src/domains/themes/themeContract.test.ts`、截图记录 |
| P2-02 token 语义审计 | 未开始 | 低 | `git diff --check`、必要 theme tests |
| P2-03 迁移帮助页 | 未开始 | 低 | 文档检查、相关命令/快捷键测试 |
| P2-04 命令面板信息架构 | 未开始 | 中 | `npm test -- --run src/components/shell/CommandPalette.test.tsx` |
| P2-05 主题截图回归 | 未开始 | 中 | `npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themeCss.test.ts`、截图记录 |
| P2-06 跨平台壳与控件密度审计 | 未开始 | 中 | 截图审查、相关 component tests |
| P2-07 微反馈与动效节奏统一 | 未开始 | 中 | UI tests、手工 smoke、reduced-motion 检查 |
| P2-08 品牌与空状态收口 | 未开始 | 低 | 文档检查、截图审查 |
| P2-09 斜杠菜单第一版 | 未开始 | 中 | 新增 editor extension tests、必要 SplitView tests |
| P2-10 选区浮动工具栏第一版 | 未开始 | 中 | EditorPane tests 或手工 smoke + 截图 |
| P2-11 图标规范 | 未开始 | 低 | 文档检查、截图审查、相关 UI tests |

## Phase 0 记录

| 项 | 结果 |
|---|---|
| 当前状态 | `git status --short --branch` 显示 `## codex/prism-full-optimization...origin/codex/prism-full-optimization`，无未提交改动 |
| 当前 diff | `git diff` 为空 |
| 已读上下文 | `AGENTS.md`、`CONTEXT.md`、`docs/adr/`、评审报告、优化计划、执行细则、完整预览性能记录、`package.json`、关键源码目录索引 |
| 子 agent | 已派生 `validation_matrix_review`、`ui_aesthetic_review`、`tauri_document_profile_review`，均为只读审查 |

## 优化项验证记录

### P0-01 全局快捷键输入框豁免

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | `useAppShortcuts` 增加 editable target guard：普通 `input`、`textarea`、`select`、非 CodeMirror `contenteditable` 中的编辑/格式/插入类快捷键保留原生行为；`event.defaultPrevented` 的嵌套控件事件不再被全局快捷键二次处理；CodeMirror 未处理的格式化快捷键仍可进入 app command registry；Escape 在 focus mode 下仍可用 |
| 涉及文件 | `src/app/useAppShortcuts.ts`、`src/app/useAppShortcuts.test.tsx` |
| 风险等级 | 中 |
| 验证命令 | `npm test -- --run src/app/useAppShortcuts.test.tsx` |
| 命令结果 | 通过：1 个测试文件，12 个测试用例 |
| 证据路径 | 本文件；Vitest 命令输出；后续提交 diff |
| 未验证风险 | 当前为 jsdom 单测验证，未在真实 Tauri WebView 中手工按键；Windows/Linux 物理键盘未补验 |
| 对应提交 | `f464af7cb63f211cefc68e15266b181547d524a9` |

### P0-02 默认 app 打开与启动 smoke

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 冷启动 pending files 支持多文件：第一个文件进入当前新窗口，其余文件通过 `openPrismWindow` 新开窗口；运行中 `file-opened` 事件逐个处理，多文件不再只取第一个；当前窗口已有文档时，系统打开文件改为新开窗口，符合单活动文档窗口规则；Tauri 启动参数过滤集中为可测试 helper，保留 `.md/.markdown` 且支持中文、空格和大小写扩展名；app smoke 增加 `.markdown` 中文空格路径启动 fixture、截图 fallback 和 `PRISM_APP_SMOKE_SCOPE=startup` 范围 |
| 涉及文件 | `src/hooks/useBootstrap.ts`、`src/hooks/useBootstrap.test.tsx`、`src/app/useStartupFileOpen.ts`、`src/app/useStartupFileOpen.test.tsx`、`src/app/useAppFileActionsModel.ts`、`src/app/useAppFileActionsModel.test.tsx`、`src/lib/openWindow.test.ts`、`src-tauri/src/commands/startup_files.rs`、`scripts/run-app-smoke.mjs` |
| 风险等级 | 高 |
| 验证命令 | `npm test -- --run src/hooks/useBootstrap.test.tsx src/lib/openWindow.test.ts src/app/useStartupFileOpen.test.tsx src/app/useAppFileActionsModel.test.tsx` |
| 命令结果 | 通过：4 个测试文件，19 个测试用例 |
| 验证命令 | `cargo test --manifest-path src-tauri/Cargo.toml` |
| 命令结果 | 通过：49 个 Rust 单元测试；`src/main.rs` 0 测试；doc-tests 0 测试 |
| 验证命令 | `npm run tauri:build:app-smoke` |
| 命令结果 | 前端 `npm run build` 通过，Tauri release 编译和 `.app` bundle 通过；完整 app smoke 在 P0-02 启动步骤之后的 `ERROR` 面板点击阶段因 `osascript ETIMEDOUT` 失败，未作为完整通过记录 |
| 验证命令 | `PRISM_APP_SMOKE_SCOPE=startup node scripts/run-app-smoke.mjs` |
| 命令结果 | 通过：`.markdown` 中文空格路径启动、随后 `.md` 显式启动覆盖上次会话均写入 `lastSession.filePath` |
| 证据路径 | `.codex-smoke/app-smoke/evidence/report.json`、`.codex-smoke/app-smoke/evidence/00-launch-markdown-chinese-space.png`、`.codex-smoke/app-smoke/evidence/01-launch-source.png` |
| 未验证风险 | Windows/Linux 默认 app 真机未验证；macOS Finder 默认 app 双击未直接手工验证，本轮用 `open -n -a Prism.app <file>` 作为真实 app 替代；完整 app smoke 后续 ERROR 面板交互仍需在后续相关阶段修复或复验 |
| 对应提交 | `e9f59a9196cb2d88874649643858c6b63fda5d42` |

### P0-03 真实 Tauri WebView 长文档性能基准

| 项 | 结果 |
|---|---|
| 状态 | 已完成基准建设；测量结果显示 3MB 真实 WebView 预览仍有高风险性能缺口 |
| 变更摘要 | 新增 `scripts/run-preview-webview-benchmark.mjs`，生成 1MB/3MB Markdown fixture，启动打包后的 Tauri release `.app`，记录窗口可见、`lastSession` ready、截图、滚动、搜索、右键菜单尝试和源码定位自动化覆盖状态；输出 JSON 与 Markdown 报告到 `docs/verification/`；`.gitignore` 增加脚本 allowlist |
| 涉及文件 | `.gitignore`、`scripts/run-preview-webview-benchmark.mjs`、`docs/verification/prism-preview-webview-benchmark-2026-06-17.json`、`docs/verification/prism-preview-webview-benchmark-2026-06-17.md` |
| 风险等级 | 高 |
| 验证命令 | `node --check scripts/run-preview-webview-benchmark.mjs` |
| 命令结果 | 通过：脚本语法检查无输出 |
| 验证命令 | `PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose` |
| 命令结果 | 通过：1 个测试文件，1 个测试用例；本轮摘要为 `markdownToHtmlMs 61.7ms`、`domWriteMs 577.2ms`、`scrollSyncScanMs 31.8ms`、`domTargetScanMs 106.2ms`、`domDiagnosticsScanMs 183.8ms` |
| 验证命令 | `node scripts/run-preview-webview-benchmark.mjs` |
| 命令结果 | 通过：脚本完成并写出 JSON/Markdown 报告；1MB fixture 约 1,049,011 bytes，窗口可见 930.6ms，`lastSession` ready 4,534ms，截图 14,947.3ms，滚动和搜索动作通过；3MB fixture 约 3,146,641 bytes，窗口可见 928ms，但 90 秒内未写入目标 `lastSession`，记录为 `timeout`，截图时间 91,991.9ms |
| 证据路径 | `docs/verification/prism-preview-webview-benchmark-2026-06-17.json`、`docs/verification/prism-preview-webview-benchmark-2026-06-17.md`、`.codex-smoke/preview-webview-benchmark/evidence/1mb-preview-opened.png`、`.codex-smoke/preview-webview-benchmark/evidence/1mb-preview-scroll.png`、`.codex-smoke/preview-webview-benchmark/evidence/1mb-preview-search.png`、`.codex-smoke/preview-webview-benchmark/evidence/3mb-preview-timeout.png` |
| 配置恢复检查 | benchmark 后检查本机 Prism config：`defaultViewMode` 仍为 `preview`，`lastSession.filePath` 已恢复为 `docs/reviews/prism-multi-perspective-review-2026-06-16.md`，未停留在 benchmark fixture |
| 未验证风险 | `tauri-driver` 当前环境未安装，DOM commit 使用 `openCommandToLastSessionMs` 和截图时间作为可观测替代指标；右键菜单在 System Events 中返回 `-25200`，源码定位菜单项未自动选择；Windows/Linux WebView 真机未覆盖；3MB 完整预览在真实 app 中没有达到可用 ready 状态，后续性能优化不能把本项视为体验通过 |
| 对应提交 | `4ce5157b06d993d63964271b9a133267566e5368` |

### P1-01 统一打开文件策略

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 新增 `openDocumentFlow` 作为共享打开策略和流程：集中当前支持类型校验、10MB 大文件确认、入口到当前窗口/新窗口的决策、脏文档切换保护、最近文件更新和工作区同步；主菜单打开、空状态打开按钮、文件树/快速打开/最近文件、运行中系统打开、冷启动/会话恢复打开路径均接入共享流程；启动恢复保留可中止保护，避免晚完成的启动读取覆盖用户已打开的文档 |
| 涉及文件 | `src/lib/openDocumentFlow.ts`、`src/lib/openDocumentFlow.test.ts`、`src/lib/fileActions.ts`、`src/lib/fileActions.test.ts`、`src/domains/commands/categories/fileCommands.ts`、`src/domains/commands/categories/fileCommands.test.ts`、`src/domains/document/components/OpenFileButton.tsx`、`src/app/useAppFileActionsModel.ts`、`src/app/useAppFileActionsModel.test.tsx`、`src/hooks/useBootstrap.ts`、`src/domains/i18n/resources.ts` |
| 风险等级 | 高 |
| 验证命令 | `npm test -- --run src/lib/openDocumentFlow.test.ts src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts src/app/useAppFileActionsModel.test.tsx src/hooks/useBootstrap.test.tsx` |
| 命令结果 | 通过：5 个测试文件，39 个测试用例；覆盖策略决策、文件树/快速打开 current-window 行为、主菜单共享流程、运行中系统打开共享流程、冷启动 pending files 和 last-session 竞争保护 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 证据路径 | 本文件；相关 Vitest/build 命令输出；`src/lib/openDocumentFlow.test.ts` |
| 未验证风险 | 当前仍只支持 P1-02 前的 `.md/.markdown/.txt` 边界，`.sql/.json` 等 Text Document 将在 P1-02 扩展；本轮未跑真实 app 手工菜单/文件树 smoke，行为由 jsdom 单测和 build 覆盖；大文件确认在真实 Tauri dialog 中未手工点击验证 |
| 对应提交 | `e08f3f8c2cb18cdb1ac794c5a794bf376dc2ad86` |

### P1-02 DocumentProfile 落地

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 引入 Markdown Document / Text Document profile 单一判断源；Markdown 仅包含 `.md/.markdown`，Text Document 第一批支持 `.txt/.text/.sql/.json/.jsonc/.yaml/.yml/.toml/.xml/.csv/.tsv/.log/.ini/.conf/.env`；打开对话框、共享打开流程、冷启动/系统打开、Rust 文件授权、读写、工作区树、原生索引、前端 fallback 索引和全文搜索统一接受支持文档；Text Document 强制编辑模式，不触发 Markdown 预览、导出、Markdown 链接诊断、图片/渲染/排版诊断、链接补全、页面链接、反链或关系图谱；Tauri bundle 增加 Text Document 文件关联 |
| 涉及文件 | `src/domains/workspace/services/fileAssociation.ts`、`src/domains/document/store.ts`、`src/lib/openDocumentFlow.ts`、`src/hooks/useBootstrap.test.tsx`、`src/lib/fileActions.test.ts`、`src/domains/workspace/services/workspaceIndex.ts`、`src/domains/workspace/services/workspaceIndexNative.ts`、`src/domains/workspace/services/relationGraph.ts`、`src/app/useDocumentDiagnosticsModel.ts`、`src/app/useDocumentNavigationModel.ts`、`src/domains/commands/categories/*Commands.ts`、`src-tauri/src/domain/document_io.rs`、`src-tauri/src/domain/workspace_index.rs`、`src-tauri/src/domain/workspace_tree.rs`、`src-tauri/src/commands/startup_files.rs`、`src-tauri/src/commands/file_scope.rs`、`src-tauri/tauri.conf.json` |
| 风险等级 | 高 |
| 验证命令 | `npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/relationGraph.test.ts src/lib/openDocumentFlow.test.ts src/lib/fileActions.test.ts src/domains/document/store.test.ts src/hooks/useBootstrap.test.tsx src/domains/commands/categories/fileCommands.test.ts src/app/useDocumentDiagnosticsModel.test.tsx src/app/useDocumentNavigationModel.test.tsx src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/domains/commands/categories/viewCommands.test.ts src/domains/commands/categories/workspaceCommands.test.ts src/domains/commands/registry.test.ts src/domains/workspace/components/StatusBar.test.tsx src/components/shell/CommandPalette.test.tsx --reporter verbose` |
| 命令结果 | 通过：14 个测试文件，101 个测试用例；覆盖 Text Document 打开边界、启动 explicit/pending files、工作区索引/搜索、关系图谱过滤、Markdown 诊断禁用、导航面板禁用、命令启用条件和文档 store 编辑模式保护；输出中有既有 jsdom `localStorage.setItem is not a function` mock 警告，无失败 |
| 验证命令 | `cargo test --manifest-path src-tauri/Cargo.toml` |
| 命令结果 | 通过：50 个 Rust 单元测试，`src/main.rs` 0 测试，doc-tests 0 测试；覆盖 `.sql/.json/.env` 等 Text Document 读写授权、启动参数过滤、工作区树、原生索引、全文搜索和关系图谱 Markdown-only 行为 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 验证命令 | `jq '.bundle.fileAssociations' src-tauri/tauri.conf.json` |
| 命令结果 | 通过：配置中同时存在 Markdown Document 关联和 Text Document 关联；Text Document 扩展列表包含 `.txt/.text/.sql/.json/.jsonc/.yaml/.yml/.toml/.xml/.csv/.tsv/.log/.ini/.conf/.env` |
| 验证命令 | `npm run tauri:build:app-smoke` |
| 命令结果 | 未完整通过：前置 `npm run build` 通过，Tauri release 编译通过，`.app` bundle 成功生成到 `src-tauri/target/release/bundle/macos/Prism.app`；app smoke 的 `.markdown` 中文空格路径启动和 Markdown fixture 启动步骤通过；后续 ERROR 诊断面板可视化判断失败，日志为 `ERROR diagnostic panel did not visibly open.`，截图阶段同时出现 `screencapture` window/rect fallback 失败，输出截图为黑屏 |
| 证据路径 | `.codex-smoke/app-smoke/evidence/00-launch-markdown-chinese-space.png`、`.codex-smoke/app-smoke/evidence/01-launch-source.png`、`.codex-smoke/app-smoke/evidence/failure.log`、本文件；相关 Vitest/Rust/build 命令输出 |
| 未验证风险 | Windows/Linux 默认 app 文件关联未真机验证；macOS Finder 双击 `.sql/.json/.env` 关联未手工验证；本轮 app smoke 未完成 ERROR 面板之后的导出/设置等后半段交互，失败更像当前环境截图/可视化自动化限制，但仍需后续 P1/P2 阶段复验；P1-05 仍需进一步实现“有链接关系才显示图谱按钮”，本项只保证 Text Document 永不触发图谱 |
| 对应提交 | `c33648c7cbb0752fba174136702241ebf822bb55` |

### P1-03 预览搜索节流和渐进高亮

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 将预览搜索高亮拆成可取消的任务：输入阶段先清理旧 mark，等待 140ms debounce 后按 `requestAnimationFrame` 分帧批量写入 `.preview-search-match`；Next/Prev 会取消待处理任务并立即重建高亮，且只在切换命中时滚动到 `.preview-search-match--current`；内容或视图恢复时保留搜索高亮但不强制滚动；现有预览复制、右键源码定位和 scroll map 行为保持不变 |
| 涉及文件 | `src/domains/editor/components/SplitView.tsx`、`src/domains/editor/components/SplitView.test.tsx` |
| 风险等级 | 中 |
| 验证命令 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx --reporter verbose` |
| 命令结果 | 通过：1 个测试文件，17 个测试用例；新增用例覆盖预览搜索输入 139ms 内不写 mark、不滚动，debounce 后才出现高亮；Next 会立即滚动并把当前命中移动到第二个结果 |
| 验证命令 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx src/domains/editor/components/SearchPanel.test.tsx src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/previewDomTargets.test.ts --reporter verbose` |
| 命令结果 | 通过：4 个测试文件，50 个测试用例；覆盖搜索面板 live input、预览复制、源码定位、预览渲染调度、DOM target 扫描和 scroll map 回归；输出中有既有 PreviewPane `act(...)` 警告和 jsdom `--localstorage-file` 警告，无失败 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 证据路径 | 本文件；相关 Vitest/build 命令输出；`src/domains/editor/components/SplitView.test.tsx` |
| 未验证风险 | 本项未跑真实 Tauri WebView 1MB/3MB 搜索首字延迟实测；当前证据证明输入阶段不会每键同步改写预览 DOM 或滚动，真实长文档搜索体感仍需在后续性能 smoke 或 P0-03 benchmark 迭代中补量化 |
| 对应提交 | `cf2c60c18812718eec25c7082e425bf0b33b0ec4` |

### P1-04 preview-only 源码定位 ready 队列

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 为 preview-only 下的“跳到源码/在编辑器中定位源码”增加 pending source jump 队列：从预览触发源码定位时先记录目标行并切换到 split，最多等待 60 帧直到 `EditorPane` ref ready 后再执行 `jumpToLine`，从而触发编辑器滚动和行闪烁；重复定位会覆盖 pending 行，避免旧请求晚到；如果编辑器始终不可用，清理 pending 并通过 notice 展示“暂时无法定位源码”反馈；渲染阶段同步 `viewModeRef`，减少 view mode 切换与 rAF 的竞态 |
| 涉及文件 | `src/domains/editor/components/SplitView.tsx`、`src/domains/editor/components/SplitView.test.tsx`、`src/domains/i18n/resources.ts` |
| 风险等级 | 中 |
| 验证命令 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx --reporter verbose` |
| 命令结果 | 通过：1 个测试文件，18 个测试用例；新增用例模拟 preview-only 冷启动、`EditorPane` 延迟暴露 ref，确认点击“跳到源码”后先切换到 split，等待 editor ready 后调用 `jumpToLine(9)` |
| 验证命令 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/SearchPanel.test.tsx src/domains/editor/components/previewDomTargets.test.ts --reporter verbose` |
| 命令结果 | 通过：4 个测试文件，51 个测试用例；覆盖预览源码按钮、链接打开、预览复制、搜索、高亮、DOM target、Mermaid/KaTeX 诊断源码定位回归；输出中有既有 PreviewPane `act(...)` 警告和 jsdom `--localstorage-file` 警告，无失败 |
| 验证命令 | `npm test -- --run src/domains/i18n/i18n.test.ts src/domains/editor/components/SplitView.test.tsx --reporter verbose` |
| 命令结果 | 通过：2 个测试文件，21 个测试用例；确认新增 `editor.preview.sourceLocateFailed` 在 `zh-CN/en-US/ja-JP` 中完整 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 证据路径 | 本文件；相关 Vitest/build 命令输出；`src/domains/editor/components/SplitView.test.tsx` |
| 未验证风险 | 当前为 jsdom 组件级验证，未在真实 Tauri WebView 中手工验证右键菜单“在编辑器中定位源码”和诊断按钮的实际动画体感；快速连续定位已通过 pending 覆盖策略约束，但未录制真实交互视频 |
| 对应提交 | `4dd96f621af3bc047faf4d01d479fb8f8d48300e` |

### P1-05 状态栏图谱条件显示

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 新增 `hasWorkspaceIndexDocumentRelations()` / `getWorkspaceIndexDocumentRelations()` 查询，统一按当前 Markdown Document 的已解析出链和工作区反链判断是否存在文档关系；状态栏 prop 从 `hasSavedPath` 收敛为 `hasDocumentRelations`，无关系时不渲染图谱按钮；Text Document、外部 URL、未解析目标和索引未知状态不触发图谱按钮；命令上下文携带 `workspaceIndex`，`showRelationGraph` 命令启用条件与状态栏同源 |
| 涉及文件 | `src/domains/workspace/services/workspaceIndexQuery.ts`、`src/domains/workspace/services/index.ts`、`src/domains/workspace/components/StatusBar.tsx`、`src/app/controllers/AppWorkspaceViewController.tsx`、`src/app/controllers/WorkspaceController.tsx`、`src/domains/commands/types.ts`、`src/app/useAppCommandContext.ts`、`src/domains/commands/categories/workspaceCommands.ts` 及对应测试 |
| 风险等级 | 中 |
| 验证命令 | `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx src/app/controllers/AppWorkspaceViewController.test.tsx src/app/controllers/WorkspaceController.test.tsx src/domains/workspace/services/workspaceIndex.test.ts src/domains/commands/categories/workspaceCommands.test.ts src/components/shell/CommandPalette.test.tsx src/domains/commands/registry.test.ts --reporter verbose` |
| 命令结果 | 通过：7 个测试文件，52 个测试用例；覆盖状态栏图谱按钮显隐、当前文档已解析出链、当前文档反链、Text Document 禁用、外链/未解析目标不触发、工作区命令启用条件、命令面板快速打开/全文搜索回归；输出中有既有 `localStorage.setItem is not a function` mock 警告和 `--localstorage-file` 警告，无失败 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 证据路径 | 本文件；相关 Vitest/build 命令输出；`src/app/controllers/AppWorkspaceViewController.test.tsx`；`src/domains/workspace/components/StatusBar.test.tsx`；`src/domains/commands/categories/workspaceCommands.test.ts` |
| 未验证风险 | 当前为 jsdom 和 build 验证，未在真实 Tauri WebView 中手工打开有出链/反链文档观察状态栏按钮显隐；命令启用条件依赖当前 `workspaceIndex`，索引尚未完成时按钮会先隐藏，之后随索引完成出现，未录制真实索引完成前后的视觉过渡 |
| 对应提交 | `faffd14fa8ec8872c6117d0db04a006be6880491` |

### P1-06 导出诊断产品化

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 文档诊断面板从扁平列表改为按来源分组，导出预检问题可按链接、图片、渲染、锚点、表格、导出类扫描；导出失败事件新增结构化字段，失败弹窗直接展示阶段、文档路径、输出路径、错误原因和下一步建议，同时保留完整诊断文本用于复制；导出失败 toast 的“查看诊断”复用同一结构化事件 |
| 涉及文件 | `src/domains/editor/components/DocumentDiagnosticsPanel.tsx`、`src/app/controllers/ExportUiController.tsx`、`src/domains/commands/categories/exportCommands.ts`、`src/hooks/useExportTaskUi.ts`、`src/platform/events/eventTypes.ts`、`src/domains/i18n/resources.ts`、`src/styles/diagnostics.css`、`src/styles/export.css` 及对应测试 |
| 风险等级 | 高 |
| 验证命令 | `npm test -- --run src/domains/export/preflight.test.ts src/domains/export/diagnostics.test.ts src/hooks/useExportTaskUi.test.tsx src/domains/editor/components/DocumentDiagnosticsPanel.test.tsx src/domains/commands/registry.test.ts src/App.recovery.test.tsx --reporter verbose` |
| 命令结果 | 通过：6 个测试文件，46 个测试用例；覆盖导出预检图片/Mermaid/KaTeX/标题锚点/表格诊断、失败诊断文本、导出失败结构化事件、诊断面板分组、失败弹窗结构化详情、导出命令失败 toast 与复制诊断回归；输出中有既有 App ref/act、`localStorage.setItem is not a function` 和 `--localstorage-file` 警告，无失败 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 证据路径 | 本文件；相关 Vitest/build 命令输出；`src/domains/export/preflight.test.ts`；`src/domains/editor/components/DocumentDiagnosticsPanel.test.tsx`；`src/App.recovery.test.tsx`；`src/domains/commands/registry.test.ts` |
| 未验证风险 | 当前为 jsdom 与 build 验证，未在真实 Tauri WebView 中手工执行一次失败导出并检查弹窗视觉；本轮没有新增分页预检算法，只把现有预检和失败阶段反馈产品化，分页/资源更细粒度风险仍需后续导出保真专项继续扩展 |
| 对应提交 | `e34de864babf0e120fdfa1374825038d2a9de63a` |

### P1-07 保存、冲突、导出微反馈统一

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 标题栏文件名区域从单一未保存圆点升级为保存状态徽标，覆盖未保存、保存中、保存失败和文件冲突，tooltip 暴露具体失败/冲突原因；底部状态栏继续不渲染保存状态，并移除历史 `.saveStatus` 死样式；导出 UI 新增 `export.result` 事件和 `exportFeedback` 状态，导出成功/取消在状态栏短暂显示，导出失败保留状态栏按钮并可重新打开结构化失败详情，关闭失败弹窗不再丢失失败状态 |
| 涉及文件 | `src/components/shell/TitleBar.tsx`、`src/components/shell/TitleBar.module.css`、`src/domains/workspace/components/StatusBar.tsx`、`src/domains/workspace/components/StatusBar.module.css`、`src/hooks/useExportTaskUi.ts`、`src/app/controllers/ExportUiController.tsx`、`src/app/controllers/AppWorkspaceViewController.tsx`、`src/app/controllers/WorkspaceController.tsx`、`src/domains/commands/categories/exportCommands.ts`、`src/platform/events/*`、`src/domains/i18n/resources.ts` 及对应测试 |
| 风险等级 | 中 |
| 验证命令 | `npm test -- --run src/components/shell/TitleBar.test.tsx src/domains/workspace/components/StatusBar.test.tsx src/hooks/useExportTaskUi.test.tsx src/app/controllers/AppWorkspaceViewController.test.tsx src/app/controllers/WorkspaceController.test.tsx src/domains/commands/registry.test.ts src/App.recovery.test.tsx src/lib/fileActions.test.ts --reporter verbose` |
| 命令结果 | 通过：8 个测试文件，76 个测试用例；覆盖标题栏未保存/保存中/保存失败/冲突徽标，状态栏不显示保存状态，导出中后台恢复，成功/取消短暂反馈，失败状态保留并可重开详情，导出命令成功/取消/失败事件，文件切换保存保护回归；输出中有既有 `localStorage.setItem is not a function`、App ref/act 和 `--localstorage-file` 警告，无失败 |
| 验证命令 | `npm test -- --run src/domains/i18n/i18n.test.ts src/platform/events/appEvents.test.ts --reporter verbose` |
| 命令结果 | 通过：2 个测试文件，5 个测试用例；确认新增 `export.result` 事件和 `titlebar/status/export` 三语 key 完整 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 证据路径 | 本文件；相关 Vitest/build 命令输出；`src/components/shell/TitleBar.test.tsx`；`src/domains/workspace/components/StatusBar.test.tsx`；`src/hooks/useExportTaskUi.test.tsx`；`src/App.recovery.test.tsx`；`src/domains/commands/registry.test.ts` |
| 未验证风险 | 当前为 jsdom 组件/Hook/App 测试和 production build 验证，未在真实 Tauri WebView 中手工观察标题栏保存徽标、导出成功短暂消失和导出失败状态栏入口的视觉节奏；Windows/Linux 真机标题栏密度与系统 chrome 仍待 P2-06 补截图审查 |
| 对应提交 | `11de0a660914b6d3b9c2d7d7705d4981cd375e7b` |

### P2-01 默认阅读排版调优

| 项 | 结果 |
|---|---|
| 状态 | 已完成 |
| 变更摘要 | 新增预览排版回归 fixture 和 Playwright 截图脚本，覆盖标题、中文正文、列表、任务、表格、普通引用、Callout、Toggle、代码块、inline code、KaTeX placeholder、Mermaid placeholder 与暗色模式；默认 `miaoyan` 和暗色 `nocturne` 预览写作列从 1000px 收敛到 920px，并同步 theme contract；调整标题层级、段距、列表缩进、普通引用、表格、代码块、inline code 和 Callout 覆盖规则，避免宽屏发散、引用 fit-content 碎裂和 Callout 被普通 blockquote 样式覆盖 |
| 涉及文件 | `.gitignore`、`src/styles/miaoyan.css`、`src/styles/content-themes.css`、`src/domains/themes/themeContract.ts`、`src/domains/themes/themeContract.test.ts`、`scripts/run-preview-typography-snapshots.mjs`、`docs/verification/fixtures/prism-typography-fixture.md`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/` |
| 风险等级 | 中 |
| 验证命令 | `node --check scripts/run-preview-typography-snapshots.mjs` |
| 命令结果 | 通过：脚本语法检查无输出 |
| 验证命令 | `node scripts/run-preview-typography-snapshots.mjs` |
| 命令结果 | 通过：生成 `miaoyan/nocturne` 两套主题在 1200/1440/1920 宽度下的 6 张截图和 README 指标；computed metrics 显示两套主题 `writeWidth=920`、估算中文行长 57.5 字、段落行高比 1.74、页面级横向溢出均为 `no`；Nocturne 正文对背景对比度为 13.43:1 |
| 验证命令 | `test ! -e docs/verification/prism-preview-typography-snapshots-2026-06-17/preview-typography-fixture.html` |
| 命令结果 | 通过：截图脚本不再写出内嵌完整 CSS 的 HTML 证据文件，仓库只保留 Markdown fixture、README 指标和 PNG 截图 |
| 验证命令 | `npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themeCss.test.ts --reporter verbose` |
| 命令结果 | 通过：2 个测试文件，7 个测试用例；新增用例确认 `miaoyan` 和 `nocturne` 的 preview maxWidth 均为 920 |
| 验证命令 | `npm run build` |
| 命令结果 | 通过：`tsc` 和 `vite build` 均成功；Vite 仍输出既有 chunk-size warning |
| 验证命令 | `git diff --check` |
| 命令结果 | 通过：无 whitespace error |
| 证据路径 | `docs/verification/fixtures/prism-typography-fixture.md`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/README.md`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/miaoyan-1200.png`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/miaoyan-1440.png`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/miaoyan-1920.png`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/nocturne-1200.png`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/nocturne-1440.png`、`docs/verification/prism-preview-typography-snapshots-2026-06-17/nocturne-1920.png` |
| 截图审查 | 已用本地图片检查 `miaoyan-1440.png` 与 `nocturne-1440.png`：截图非空，正文、普通引用、Callout、Toggle、表格均可见，暗色块边界和正文对比可辨 |
| 未验证风险 | 当前截图是 Playwright 渲染的独立 preview fixture，不是完整 Tauri WebView 真实窗口截图；Windows/Linux 字体渲染差异、真实系统 chrome 密度和 WebView 滚动体感仍需 P2-06 或跨平台真机补验；本项只调默认/暗色阅读排版，不把所有内置主题同步重排，完整主题截图回归留给 P2-05 |
| 对应提交 | 待提交后回填 |
