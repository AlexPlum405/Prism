# Prism 下一阶段优化验证记录

> 状态：进行中
> 启动日期：2026-05-21
> 计划文件：`docs/prism-next-optimization-implementation-plan.md`
> Goal 文件：`docs/prism-next-optimization-goal.md`
> 当前 active plan：`docs/prism-next-optimization-implementation-plan.md`

## 1. 目标拆解

本轮目标是按 `docs/prism-next-optimization-implementation-plan.md` 完成 Phase 0 到 Phase 8：

1. Phase 0：基线收口。
2. Phase 1：导出保真二期。
3. Phase 2：真实 app smoke 扩展。
4. Phase 3：大文档性能专项。
5. Phase 4：文件安全与 Finder 打开同步。
6. Phase 5：工作区索引、搜索、链接、反链。
7. Phase 6：DOCX / 图片 / HTML 富内容增强。
8. Phase 7：主题、模板、中文写作检查。
9. Phase 8：发布可信链路。

产品边界保持不变：本地优先、单文档单窗口、Markdown 源码可见、当前妙言风格、现有编辑/分栏/预览三态、导出按钮、专注模式按钮、右上角视图切换和左侧文件树不回退。

## 2. Prompt-to-artifact checklist

| 要求 | 证据 | 状态 |
| --- | --- | --- |
| 开始前读取 `AGENTS.md` | 已读取，确认始终中文、当前妙言风格、增量推进和真实验证要求 | 已完成 |
| 开始前读取 `CONTEXT.md` | 已读取，确认本地优先、单文档单窗口、妙言风格、状态栏、导出、链接、模板、图谱边界 | 已完成 |
| 开始前读取 `docs/adr/` | 已读取 ADR-0001 到 ADR-0005，确认 ADR-0005 已取代旧 OpenAI 唯一视觉方向 | 已完成 |
| 开始前读取当前 active plan | `docs/prism-next-optimization-implementation-plan.md` | 已完成 |
| 开始前读取 `docs/verification/` | 已列出当前 verification 文档，后续证据写入本文 | 已完成 |
| 开始前检查 `git status` / `git diff` / 最近 log | 当前 `git status --short` 仅有 `.codex-output/` 未跟踪；最近提交包含 `8910137` 和 `0bd0d4f` | 已完成 |
| 旧计划和旧 goal 不再污染 active plan | 旧计划/旧 goal 已在顶部标记“已完成 / 历史归档” | 已完成 |
| 当前唯一 active plan | `docs/prism-next-optimization-implementation-plan.md` 顶部标记“状态：待实施”“当前唯一待实施计划：是” | 已完成 |
| `.codex-output/` 作为本地裁图产物不提交 | 本 checkpoint 将 `.codex-output/` 加入 `.gitignore` | 已完成 |

## 3. Phase 0：基线收口

### Checkpoint 0A：计划文件与旧计划归档

已完成并推送：

- `0bd0d4f 更新 Prism 应用图标`
- `8910137 归档历史计划并新增下一阶段优化计划`

实现结果：

- 新增 `docs/prism-next-optimization-implementation-plan.md`。
- 新增 `docs/prism-next-optimization-goal.md`。
- 历史计划和旧 goal 文件顶部已标记为“已完成 / 历史归档”。
- 图标资产已单独提交，未混入计划文档提交。

验证：

```bash
git diff --check
```

结果：

- 通过。文档归档提交前已执行。

### Checkpoint 0B：统一验证记录与本地输出忽略

目标：

- 建立本轮后续 Phase 1 到 Phase 8 的统一验证记录。
- 将 `.codex-output/` 明确识别为本地裁图输出，加入 `.gitignore`，避免后续 checkpoint 误提交。

影响文件：

- `.gitignore`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 低。只涉及忽略规则和文档证据，不改变运行时代码。

验证命令：

```bash
git diff --check
```

## 4. Phase 1：导出保真二期

### Checkpoint 1A：超高原子块导出分页保护

目标：

- 避免单个超高图片、SVG、Mermaid、KaTeX、HTML 视觉块在 PDF / PNG 分页准备阶段因为最低缩放限制仍跨页，从而出现“一张图被两页切开”的情况。

影响文件：

- `src/domains/export/pagination.ts`
- `src/domains/export/pagination.test.ts`

实现结果：

- 新增 `EXPORT_MIN_ATOMIC_SCALE = 0.05`，允许极高原子块继续缩小到一页内，而不是固定卡在 0.2。
- 超高原子块缩放后设置 `max-height` 为当前导出页可用高度，强化“视觉块不要跨页”的导出意图。
- 新增回归测试，覆盖 1200px 高原子图片在 100px 页高下缩放到 `scale(0.0817)`，且不插入分页 spacer。

if-else 覆盖：

- 如果原子块高度小于一页：不缩放。
- 如果原子块高度超过一页且可缩放：按页高缩放，最低允许到 `EXPORT_MIN_ATOMIC_SCALE`。
- 如果原子块高度极端巨大：至少不再因 0.2 下限提前停止缩放；仍保留 0.05 作为可读性和布局保护下限。

验证：

```bash
npm test -- --run src/domains/export/pagination.test.ts src/domains/export/exportPipeline.test.ts
```

结果：

- 通过。2 个测试文件、53 项测试通过。

收口验证：

```bash
npm test -- --run
npm run build
git diff --check
```

结果：

- `npm test -- --run` 通过。115 个测试文件、593 项测试通过。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `git diff --check` 通过。

待补验证：

```bash
npm run tauri:build:app-smoke
```

结果：

- 通过。Tauri release app bundle 构建成功。
- app smoke 通过：启动打开 Markdown、`ERROR` 诊断入口、`Cmd+P` 快速打开、基础编辑保存、导出菜单入口、设置中心入口。
- 证据报告写入 `.codex-smoke/app-smoke/evidence/report.json`。

## 5. 剩余 Phase

后续按计划继续推进：

- Phase 1：导出保真二期。
- Phase 2：真实 app smoke 扩展。
- Phase 3：大文档性能专项。
- Phase 4：文件安全与 Finder 打开同步。
- Phase 5：工作区索引、搜索、链接、反链。
- Phase 6：DOCX / 图片 / HTML 富内容增强。
- Phase 7：主题、模板、中文写作检查。
- Phase 8：发布可信链路。

每个 checkpoint 完成后必须继续追加本文件。
