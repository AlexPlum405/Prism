# Prism full-run optimization goal

```text
/goal 在 /Users/Alex/AI/project/Prism 中，读取并严格执行 docs/goals/prism-full-optimization-execution-details-2026-06-17.md，一次性完成 Prism 优化计划。

开始前先读细则文件指定的全部上下文、当前 `git status --short --branch` 和 `git diff`；继承当前已验证文档基线，不从头重做评审。

目标：完成细则定义的 P0/P1/P2 优化项；每项实现后按细则验证、记录证据、提交并推送。

范围边界：遵守 CONTEXT.md、ADR-0006、ADR-0007 和本地细则；不实现 P3 暂不做项，不做无关重构，不覆盖无关脏改。需要调整目标时先显式更新 goal。

完成条件和暂停条件全部按细则执行；最终汇报分支、commit hash、验证命令、push 状态和未验证风险。
```
