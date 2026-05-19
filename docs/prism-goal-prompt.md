# Prism 架构优化 `/goal` 入口

> 更新日期：2026-05-20
> 用途：把长任务细节留在本文件和计划/验证文档里，`/goal` 只保留极短入口。

## 直接复制的短 goal

如已有旧 goal，先执行：

```text
/goal clear
```

再执行：

```text
/goal 在 /Users/Alex/AI/project/Prism 中，按 docs/prism-goal-prompt.md 的「架构优化续跑合约」继续执行，继承已验证进度，不重跑已完成 checkpoint；把剩余架构优化项一次性做到验证、记录、commit、push 和最终 app smoke 全闭环，只有遇到该文档定义的暂停条件才停。
```

## 架构优化续跑合约

### 开始前必须读取

- `AGENTS.md`
- `CONTEXT.md`
- `docs/adr/`
- `docs/prism-architecture-optimization-full-plan.md`
- `docs/verification/prism-architecture-optimization-full-run.md`
- 当前 `git status --short`
- 当前 `git diff`
- 最近提交：`git log --oneline -14`

### 当前已完成进度

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

### 剩余必须完成项

按风险从小到大继续，不要跳过最终收口：

1. 主包性能优化：先处理 `highlight.js` 或其他污染 main chunk 的静态依赖，记录优化前后 `npm run build` chunk 结果。
2. 文件安全层深化：整理保存、另存、外部变更、恢复、冲突、访达双击打开、工作区刷新相关边界，不改变用户可见文件行为。
3. 真实 App smoke 自动化：完善 `Prism.app` smoke harness，覆盖启动、`Cmd+P`、设置、`ERROR`、导出保存弹窗、文件树同步、基础编辑/保存。
4. 最终 completion audit：逐条核对 10 个优化项、验证证据、commit/push、剩余风险。

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

- 文档改动：`git diff --check`。
- 纯 TypeScript / React 小改：相关聚焦测试 + `npm test -- --run`。
- 架构、导出、文件安全、命令系统、工作区索引改动：相关聚焦测试 + `npm test -- --run` + `npm run build` + `git diff --check`。
- Tauri / Rust / capabilities / 真实 app 链路改动：补 `cargo check/test` 或对应 Tauri smoke。
- 最终收口必须跑：
  - `npm test -- --run`
  - `npm run build`
  - `git diff --check`
  - `npm run tauri:build:app-smoke`
  - 重启本地 `Prism.app`

### 完成条件

全部剩余 checkpoint 已实现，验证通过，`docs/verification/prism-architecture-optimization-full-run.md` 已补齐，所有可提交改动已 commit 并 push 到 `origin/main`，最终汇报 commit hash、push 状态、验证证据、跳过项原因、剩余风险。

### 暂停条件

只有遇到以下情况才暂停：

- 需要用户确认产品定位或架构方向。
- 需要破坏性 git 操作。
- 需要新增外部依赖。
- 需要凭据、签名、公证、生产发布权限。
- 存在用户数据安全风险。
- 现有测试/构建暴露与本 checkpoint 无关但会阻塞最终 gate 的失败，需要先说明归因。
