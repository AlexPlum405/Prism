# Prism Codex `/goal` Prompt

> 更新日期：2026-05-20
> 用途：启动或重建 Prism 架构优化长任务 goal。详细内容放在 `docs/prism-architecture-optimization-full-plan.md`，执行证据放在 `docs/verification/prism-architecture-optimization-full-run.md`，不要把完整计划塞进 `/goal`。

## 推荐短版

如果已有旧 goal，先清掉：

```text
/goal clear
```

再粘贴：

```text
/goal 在 /Users/Alex/AI/project/Prism 中，继续并一次性完成 docs/prism-architecture-optimization-full-plan.md 定义的全部 Prism 架构优化 checkpoint。

开始前读 AGENTS.md、CONTEXT.md、docs/adr/、docs/prism-architecture-optimization-full-plan.md、docs/verification/prism-architecture-optimization-full-run.md、当前 git status 和 git diff。继承验证记录和已推送 commit，不从头重跑；只补未闭环项。

严格按计划文件执行：每个 checkpoint 先汇报目标/影响文件/风险/验证命令，完成后更新验证记录、commit、push，再继续下一个。保持本地优先、单文档单窗口、Markdown 源码可见和当前妙言风格；不做破坏性 git、新依赖、发布动作或计划外产品扩张。

完成条件：全部 checkpoint 闭环，并通过 npm test -- --run、npm run build、git diff --check、npm run tauri:build:app-smoke、重启 Prism.app；最终汇报证据、commit hash、push 状态和剩余风险。遇到产品/架构确认、凭据、签名公证、用户数据安全或破坏性操作需求时暂停。
```

## 续跑提示

如果是 resume 旧会话，先发这一句对齐进度：

```text
先根据 docs/verification/prism-architecture-optimization-full-run.md 和 git log 对齐已完成 checkpoint，只列出剩余未闭环项，然后从下一个最小安全 checkpoint 继续，不要重做已验证并已推送的阶段。
```
