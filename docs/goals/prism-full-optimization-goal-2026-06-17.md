# Prism full-run optimization goal

```text
/goal 在 /Users/Alex/AI/project/Prism 中，按 docs/goals/prism-full-optimization-execution-details-2026-06-17.md 一次性完成 Prism 优化计划。

开始前先读：AGENTS.md、CONTEXT.md、docs/adr/、docs/reviews/prism-multi-perspective-review-2026-06-16.md、docs/plans/prism-optimization-plan-2026-06-17.md、docs/goals/prism-full-optimization-execution-details-2026-06-17.md、docs/verification/prism-preview-full-render-performance-2026-06-12.md、package.json、当前 `git status --short --branch` 和 `git diff`。

目标：以 full-run 方式完成本地执行细则文件中定义的 P0、P1、P2 全部优化项；每个优化项完成后都要验证、更新证据、提交并推送。继承已验证基线提交 `34601027558390fe2c068dc7721c44cd00ab1d4b`，不要从头重做评审。

范围边界：严格遵守 CONTEXT.md、ADR-0006、ADR-0007 和本地执行细则；不实现 P3 暂不做项，不做无关重构，不覆盖无关脏改。若发现目标、范围或验收标准需要调整，先显式更新 goal 并说明原因，再继续。

执行方式：按本地执行细则逐项推进。可派生只读子 agent 做验证矩阵、UI/美学审查、Tauri/DocumentProfile 风险审查；主线程负责最终实现、冲突处理、验证、提交和推送。

验证分层：每个优化项都必须执行细则中指定的最小相关测试或 smoke，并写入 `docs/verification/prism-full-optimization-run-2026-06-17.md`；最终必须跑相关测试、`git diff --check`、`npm run build`，涉及 Tauri/文件关联/真实 app 链路时跑 `npm run tauri:build:app-smoke` 或记录阻塞原因。

完成条件：本地执行细则中的 P0/P1/P2 优化项全部完成或有明确 goal 更新；验证记录完整；所有 checkpoint 已提交并推送；最终工作树干净，并汇报分支、commit hash、验证命令、push 状态和未验证风险。

暂停条件：需要 destructive git 操作、产品定位重大变更、证书/私钥/账号/付费闭源资料、生产凭据，或当前环境无法继续验证且没有可靠替代证据。
```
