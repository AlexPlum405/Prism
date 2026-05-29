# Prism 架构优化续跑 `/goal` 入口

> 状态：已完成 / 历史归档
> 归档日期：2026-05-21
> 说明：本文件是旧 goal prompt，仅保留历史背景。当前 goal 以 `docs/prism-next-optimization-goal.md` 为准。

> 更新日期：2026-05-20
> 用途：把长任务细节留在本文件，`/goal` 只保留极短入口。

## 直接复制的短 goal

如果当前已有旧 goal，先执行：

```text
/goal clear
```

再执行：

```text
/goal 在 /Users/Alex/AI/project/Prism 中，按 docs/prism-goal-prompt.md 续跑 Prism 架构优化；继承已验证进度，不重跑已完成 checkpoint，只完成剩余真实 App smoke 自动化与最终审计，验证通过后更新证据、commit、push，并重启 Prism.app。
```

## 架构优化续跑合约

### 开始前读取

- `AGENTS.md`
- `CONTEXT.md`
- `docs/adr/`
- `docs/prism-architecture-optimization-full-plan.md`
- `docs/verification/prism-architecture-optimization-full-run.md`
- 当前 `git status --short`
- 当前 `git diff`
- 最近提交：`git log --oneline -20`

### 已完成进度

以下 checkpoint 已有验证记录并已推送到 `origin/main`，不要从头重做：

- `fc5d828`：记录架构优化全阶段计划
- `3a79836`：拆分导出分页和诊断模块
- `47cff0c`：抽离导出渲染辅助模块
- `b549824`：拆分导出资产工具
- `2997de0`：拆分编辑器命令定义
- `ce504c7`：拆分视图和辅助命令定义
- `86e4516`：拆分导出命令编排
- `1d86448`：抽离 App 导出任务和 Toast 状态
- `fd51366`：抽离 App 工作区索引 Hook
- `75b6c76`：建立统一诊断模型底座
- `a2d61a2`：精简架构优化 goal prompt
- `083a303`：建立 Markdown 文档模型核心
- `1a75a68`：拆分文件和工作区命令
- `450ed20`：拆分全局样式层
- `2ce2a6d`：精简架构优化 goal 入口
- `a4277f2`：裁剪主包高亮依赖
- `12eaa7a`：深化文件安全层边界

### 剩余必须完成项

1. 真实 App smoke 自动化：完善 `Prism.app` smoke harness，覆盖启动、`Cmd+P`、设置中心、`ERROR`、导出保存弹窗、文件树同步、基础编辑/保存路径。
2. 最终 completion audit：逐条核对 10 个架构优化项、验证证据、commit/push、跳过项原因和剩余风险。

### 执行规则

- 每个 checkpoint 开始前先汇报：目标、影响文件、风险等级、精确验证命令。
- 每个 checkpoint 只做最小安全补丁，不做视觉换皮，不改变当前妙言风格。
- 保持 Prism 定位：本地优先、单文档单窗口、Markdown 源码可见。
- 不新增 Notion database、完整 block editor、云同步、实时协作、插件市场、AI 写作平台。
- 不新增外部依赖；如确实必要，暂停并说明收益、风险、替代方案。
- 不执行 `reset`、`checkout`、`revert`，不覆盖无关脏改。
- 每个 checkpoint 完成后更新 `docs/verification/prism-architecture-optimization-full-run.md`，能安全提交就立即 commit 并 push。
- commit message 用中文。

### 验证规则

- smoke harness 改动：相关脚本/聚焦验证 + `npm run tauri:build:app-smoke` + `git diff --check`。
- 最终收口必须跑：`npm test -- --run`、`npm run build`、`git diff --check`、`npm run tauri:build:app-smoke`。
- 最终还必须重启本地 `Prism.app`，不能用浏览器替代真实 app。

### 完成条件

剩余 smoke 自动化和最终审计都已完成，`docs/verification/prism-architecture-optimization-full-run.md` 已补齐，最终 gate 全部通过，所有可提交改动已 commit 并 push 到 `origin/main`，本地 `Prism.app` 已重启。最终汇报 commit hash、push 状态、验证证据、跳过项原因和剩余风险。

### 暂停条件

只有遇到以下情况才暂停：

- 需要用户确认产品定位或架构方向。
- 需要破坏性 git 操作。
- 需要新增外部依赖。
- 需要凭据、签名、公证、生产发布权限。
- 存在用户数据安全风险。
- 现有测试/构建暴露与本 checkpoint 无关但会阻塞最终 gate 的失败，需要先说明归因。
