# Prism 优雅架构现代化验证记录

> 启动日期：2026-05-21
> 计划文件：`docs/prism-elegant-architecture-modernization-plan.md`
> Goal 文件：`docs/prism-elegant-architecture-modernization-goal.md`
> 目标：按 Phase 0 到 Phase 10 完成行为保持型架构现代化，让 App、导出、编辑器、平台事件、Tauri native command 的职责收敛，同时保持本地优先、单文档单窗口、Markdown 源码可见、当前妙言风格和既有用户功能不回退。

## 基线

- 当前 HEAD：`3daefb8 优化主题导入弹窗交互`。
- 最近已完成背景：主题导入弹窗已改为 Prism/Miaoyan 风格内部弹窗，并已推送到 `origin/main`。
- 工作树开始状态：
  - `?? docs/prism-elegant-architecture-modernization-plan.md`：本轮计划文件，纳入 Checkpoint 0。
  - `?? docs/prism-elegant-architecture-modernization-goal.md`：本轮 goal 文件，纳入 Checkpoint 0。
  - `?? .antigravitycli/`：本地 scratch，无关脏改，不提交。
  - `?? temp_script_check.js`：本地原型/检查 scratch，无关脏改，不提交。
- 已读上下文：
  - `AGENTS.md`
  - `CONTEXT.md`
  - `docs/adr/0001-adopt-openai-minimal-design.md`
  - `docs/adr/0002-css-token-naming.md`
  - `docs/adr/0003-bundle-fonts-locally.md`
  - `docs/adr/0004-focus-mode-soft-dim.md`
  - `docs/adr/0005-adopt-miaoyan-style.md`
  - `docs/verification/`
  - 当前 `git status --short`
  - 当前 `git diff --stat`
  - 当前 `git diff --name-only`
  - 最近 `git log --oneline -20`
- 当前关键膨胀点行数：
  - `src/App.tsx`：1357 行。
  - `src/domains/export/exportPipeline.ts`：3209 行。
  - `src/domains/editor/components/EditorPane.tsx`：1424 行。
  - `src-tauri/src/lib.rs`：963 行。
- 当前事件与平台直接依赖基线：
  - `window.dispatchEvent(new CustomEvent(...))` / `window.addEventListener(...)` 仍分布在 `App.tsx`、`EditorPane.tsx`、`SplitView.tsx`、`FileTree.tsx`、`fileActions.ts`、命令模块和若干测试中。
  - 前端 Tauri 直接调用仍分布在 `App.tsx`、`fileActions.ts`、`settings/store.ts`、`themes`、`commands/categories/*`、`document`、`editor`、`PreviewPane.tsx` 等路径。

## Phase 0：架构基线与证据冻结

### Checkpoint 0A：计划与验证入口落地

改动范围：

- `docs/prism-elegant-architecture-modernization-plan.md`
- `docs/prism-elegant-architecture-modernization-goal.md`
- `docs/verification/prism-elegant-architecture-modernization.md`

实现结果：

- 记录本轮 10 个 phase 的架构现代化目标、边界、风险、验证分层和完成标准。
- 建立本验证文档，后续每个 checkpoint 在这里追加证据。
- 明确无关脏改：`.antigravitycli/`、`temp_script_check.js` 不提交、不覆盖。
- 本 checkpoint 不改业务代码，不改变任何用户可见行为。

验证：

```bash
git diff --check --cached
```

结果：

- 通过。未发现尾随空白或 diff 格式问题。

跳过项：

- 本 checkpoint 只落地文档和验证入口，不触及 TypeScript、React、Tauri、Rust、文件系统、导出或真实 app 启动。
- 因此不跑 `npm test -- --run`、`npm run build`、`cargo test`、`npm run tauri:build:app-smoke`；后续触及对应风险面时按分层补齐。

剩余风险：

- 后续 Phase 1 到 Phase 10 尚未实现。
- `App.tsx`、`exportPipeline.ts`、`EditorPane.tsx`、`src-tauri/src/lib.rs` 仍是主要重构对象。
