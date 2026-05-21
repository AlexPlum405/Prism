# Prism 优雅架构现代化 `/goal`

> 日期：2026-05-21
> 计划文件：`docs/prism-elegant-architecture-modernization-plan.md`

## 可直接复制的 goal

```text
/goal 在 /Users/Alex/AI/project/Prism 中，按 docs/prism-elegant-architecture-modernization-plan.md 一次性完成 Prism 优雅架构现代化全阶段重构。

开始前先读：AGENTS.md、CONTEXT.md、docs/adr/、docs/prism-elegant-architecture-modernization-plan.md、docs/verification/、当前 git status、当前 git diff、最近 git log --oneline -20。先确认工作树中哪些是无关脏改，不能 reset、checkout、revert 或覆盖无关改动。

目标：在不改变 Prism 本地优先、单文档单窗口、Markdown 源码可见、当前妙言风格和既有用户功能的前提下，完成计划文件中的 Phase 0 到 Phase 10。核心成果是让 App.tsx 回到组合层，导出链路形成 strategy + pipeline，EditorPane 拆成 CodeMirror runtime + command adapter，platform/Tauri 能力通过 adapter 收敛，全局 CustomEvent 迁移到 typed app events，Rust native commands 按能力拆分，并补齐验证证据。

范围边界：这是行为保持型架构重构，不做视觉换皮，不新增产品功能，不引入 Notion database、完整 WYSIWYG、云同步、实时协作、插件市场、AI 写作平台、发布签名、公证或生产 release。默认不新增外部依赖；如必须新增，暂停并说明必要性、替代方案、体积、许可证和离线影响。

执行方式：按计划文件分 phase/full-run 推进，但每个 phase 内使用 checkpoint 小步提交。每个 checkpoint 开始前汇报目标、影响文件、风险等级和精确验证命令；完成后更新 docs/verification/prism-elegant-architecture-modernization.md 或同等证据，说明改动、验证结果、跳过哪些重验证及原因、剩余风险。验证通过且可安全提交时立即 commit 并 push 到 origin/main，再进入下一 checkpoint。

验证分层：纯文档只跑 git diff --check；TS/React 结构迁移跑相关测试 + npm run build + git diff --check；App 装配、命令、编辑器、导出相关改动跑相关测试 + npm test -- --run + npm run build + git diff --check；Tauri/Rust/native command 改动补 cd src-tauri && cargo test 或 cargo check，并跑 npm run tauri:build:app-smoke；最终收口必须跑 npm test -- --run、npm run build、git diff --check、npm run tauri:build:app-smoke，并重启 src-tauri/target/release/bundle/macos/Prism.app。

特殊情况：如果发现现有测试失败，先判断是否由本 checkpoint 引入；相关失败必须修复，无关历史失败要记录命令、摘要和归因。Computer Use 不可用时使用 npm run tauri:build:app-smoke 作为真实 app 验证 fallback，并记录原因。任何影响保存、另存、恢复、冲突、删除、废纸篓、导出覆盖的改动必须保守处理并补回归测试。

完成条件：Phase 0 到 Phase 10 全部完成，verification 证据完整，核心链路打开/编辑/保存/预览/搜索/链接跳转/主题/导出无回退，最终 gate 全部通过，所有可提交改动已 commit 并 push 到 origin/main，本地 Prism.app 已重启。最终汇报 phase 完成情况、commit hash 列表、push 状态、验证证据、跳过项原因和剩余风险。

暂停条件：需要改变产品定位或架构方向、需要破坏性 git 操作、需要新增外部依赖、需要凭据/签名/公证/生产发布权限、存在用户数据安全风险、或计划文件与当前代码现实发生重大冲突时，暂停并说明可选方案。
```
