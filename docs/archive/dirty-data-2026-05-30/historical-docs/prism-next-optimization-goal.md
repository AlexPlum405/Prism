# Prism 下一阶段优化 `/goal`

> 状态：待实施
> 日期：2026-05-21
> 计划文件：`docs/prism-next-optimization-implementation-plan.md`
> 说明：这是当前唯一推荐使用的 Prism 优化 goal。历史计划与旧 goal 文件已标记为“已完成 / 历史归档”，不要按旧文件续跑。

## 可直接复制的 goal

```text
/goal 在 /Users/Alex/AI/project/Prism 中，按 docs/prism-next-optimization-implementation-plan.md 一次性完成 Prism 下一阶段优化。

开始前先读：AGENTS.md、CONTEXT.md、docs/adr/、docs/prism-next-optimization-implementation-plan.md、docs/verification/、当前 git status、当前 git diff、最近 git log --oneline -20。注意：旧计划和旧 goal 文件已标记为“已完成 / 历史归档”，只作为背景，不作为 active plan；当前唯一待实施计划是 docs/prism-next-optimization-implementation-plan.md。

目标：按计划文件完成 Phase 0 到 Phase 8。优先补齐导出保真、真实 app smoke、大文档性能、文件安全与 Finder 打开同步、工作区索引/搜索/链接/反链、DOCX/图片/HTML 富内容、主题/模板/中文写作检查、发布可信链路。保持 Prism 本地优先、单文档单窗口、Markdown 源码可见、当前妙言风格和既有用户功能不回退。

范围边界：不要引入完整 WYSIWYG、云同步、移动端、实时协作、Notion database、Obsidian 式插件市场、AI 写作平台或未经确认的新外部依赖。不要 reset、checkout、revert 或覆盖无关脏改。当前可能存在图标资产改动和本地 .codex-output 裁图产物，必须先识别并只提交本 checkpoint 相关文件。

执行方式：按 phase/checkpoint 小步推进，但目标是一次性跑完全计划。每个 checkpoint 开始前汇报目标、影响文件、风险等级和精确验证命令；完成后更新必要 docs/verification 证据，说明改动、验证结果、跳过哪些重验证及原因、剩余风险。验证通过且可安全提交时立即 commit 并 push 到 origin/main，再进入下一个 checkpoint。

验证分层：文档改动只跑 git diff --check；TS/React 小改跑相关测试 + npm run build + git diff --check；编辑器、导出、命令系统、工作区改动跑相关测试 + npm test -- --run + npm run build + git diff --check；文件系统、Tauri、Rust command、真实 app 路径改动补 cargo check/test，并跑 npm run tauri:build:app-smoke；发布、签名、公证、updater、安装器相关改动必须跑发布级构建和人工验证。

重点验收：HTML/PDF/PNG/DOCX 导出高清且保真，复杂块不被分页切断，DOCX 中 Mermaid PNG-first，图片链接保留；app-smoke 覆盖四格式导出、主题导入、Finder 打开文件树同步、后台导出、链接/反链/关系图谱；长文输入优先流畅；文件保存、冲突、恢复、删除、外部打开安全；搜索、[[ ]]、反链、关系图谱共用工作区索引。

完成条件：Phase 0 到 Phase 8 全部完成或只剩明确外部阻塞；最终 npm test -- --run、npm run build、git diff --check、npm run tauri:build:app-smoke 通过；必要 verification 文档已更新；所有可提交改动已 commit 并 push 到 origin/main；本地 src-tauri/target/release/bundle/macos/Prism.app 已重启；最终汇报 phase 完成情况、commit hash、push 状态、验证证据、跳过项原因和剩余风险。

暂停条件：需要改变产品定位、需要破坏性 git 操作、需要新增高风险外部依赖、需要凭据/签名/公证/生产发布权限、存在用户数据安全风险、或计划文件与当前代码现实发生重大冲突时，暂停并说明可选方案。
```
