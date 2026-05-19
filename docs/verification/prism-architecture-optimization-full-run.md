# Prism 架构优化全阶段验证记录

> 启动日期：2026-05-20  
> 计划文件：`docs/prism-architecture-optimization-full-plan.md`  
> 目标：按 checkpoint 完成 10 个架构优化项，同时保持现有写作、预览、保存、恢复、搜索、诊断、导出能力不回退。

## 基线

- `fc5d828`：记录 Prism 架构优化全阶段计划。
- 工作树：开始执行时 `main...origin/main`，无未提交改动。
- 已读上下文：`AGENTS.md`、`CONTEXT.md`、`docs/adr/`、计划文件、`docs/verification/`。

## Checkpoint 2A：导出分页与失败诊断分层

改动范围：

- `src/domains/export/pagination.ts`
- `src/domains/export/pagination.test.ts`
- `src/domains/export/diagnostics.ts`
- `src/domains/export/diagnostics.test.ts`
- `src/domains/export/exportPipeline.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出导出分页保护模块 `pagination.ts`，集中承载 atomic block 标记、标题与视觉块分组、分页 spacer、超高视觉块缩放、分页阈值常量。
- `exportPipeline.ts` 继续通过同一公开函数调用分页逻辑，HTML/PDF/PNG/DOCX 的现有导出路径不改变算法。
- 从 `registry.ts` 抽出导出失败诊断模块 `diagnostics.ts`，集中承载引用路径校验、Pandoc 状态、导出设置、warning、错误堆栈等诊断文本生成。
- 命令注册层保留导出编排与 toast 行为，不再内联导出诊断细节。
- 新增聚焦测试覆盖分页模块和诊断模块，原有导出 pipeline 与命令注册测试保持通过。

验证：

```bash
npm test -- --run src/domains/export/pagination.test.ts src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts
```

结果：

- 7 个测试文件通过。
- 85 项测试通过。

跳过项：

- 本 checkpoint 只迁移 TypeScript 纯函数边界和新增单元测试，不改变 Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。
