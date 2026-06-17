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
| P0-02 默认 app 打开与启动 smoke | 未开始 | 高 | `npm test -- --run src/hooks/useBootstrap.test.tsx src/lib/openWindow.test.ts`、`npm run tauri:build:app-smoke` |
| P0-03 真实 Tauri WebView 长文档性能基准 | 未开始 | 高 | `PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose`、新增真实 app harness |
| P1-01 统一打开文件策略 | 未开始 | 高 | `npm test -- --run src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts` |
| P1-02 DocumentProfile 落地 | 未开始 | 高 | `npm test -- --run src/lib/fileActions.test.ts src/hooks/useBootstrap.test.tsx`、`cargo test` |
| P1-03 预览搜索节流和渐进高亮 | 未开始 | 中 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx` |
| P1-04 preview-only 源码定位 ready 队列 | 未开始 | 中 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx` |
| P1-05 状态栏图谱条件显示 | 未开始 | 中 | `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx src/components/shell/CommandPalette.test.tsx` |
| P1-06 导出诊断产品化 | 未开始 | 高 | `npm test -- --run src/domains/export/preflight.test.ts` |
| P1-07 保存、冲突、导出微反馈统一 | 未开始 | 中 | `npm test -- --run src/lib/fileActions.test.ts` 和相关 UI/store tests |
| P2-01 默认阅读排版调优 | 未开始 | 中 | `npm test -- --run src/domains/themes/themeContract.test.ts`、截图记录 |
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
