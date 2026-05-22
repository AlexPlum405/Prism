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

## 6. Phase 2：真实 app smoke 扩展

### Checkpoint 2A：四格式导出产物证据写入 app smoke

目标：

- 扩展 `npm run tauri:build:app-smoke`，让真实 app smoke 报告不仅证明 Prism.app 能启动、编辑和打开基础入口，也能包含 HTML / PDF / PNG / DOCX 四格式导出产物检查证据。

影响文件：

- `scripts/run-app-smoke.mjs`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中等。只改 smoke 自动化脚本和验证记录，不改用户运行时代码；但 `npm run tauri:build:app-smoke` 会额外运行一次聚焦复杂导出产物测试。

实现结果：

- `scripts/run-app-smoke.mjs` 新增 `generateAndValidateComplexExportArtifacts()`。
- app smoke 会调用现有复杂导出产物测试生成 `.codex-smoke/complex-export/out/complex-export.{html,pdf,png,docx}`。
- app smoke 自己读取并检查产物：
  - HTML：标题、TOC、表格、Mermaid、KaTeX、本地图片路径、引用占位。
  - PDF：非空、页数至少 1、第一页 A4 尺寸。
  - PNG：非空、PNG signature、可由 `sharp` 读取宽高。
  - DOCX：zip 内存在 `word/document.xml`、中文标题、代码文本、表格文本、媒体文件，且 Mermaid 源码 `graph TD` 不泄漏。
- `.codex-smoke/app-smoke/evidence/report.json` 新增 `exportArtifacts` 字段，同时在 `steps` 里记录 `complex export artifacts generated and validated`。

if-else 覆盖：

- 如果复杂导出 focused test 失败：app smoke 失败，不写通过报告。
- 如果某个导出产物不存在或为空：app smoke 失败。
- 如果 HTML / PDF / PNG / DOCX 结构检查不满足：app smoke 失败。
- 如果真实 app 基础链路失败：仍按原 smoke 失败路径写入 `failure.log`。

验证：

```bash
node --check scripts/run-app-smoke.mjs
npm test -- --run src/domains/commands/exportCommand.integration.test.ts
npm test -- --run src/domains/export/exportPipeline.test.ts -t "writes complex export smoke artifacts for all supported formats"
npm run tauri:build:app-smoke
git diff --check
```

结果：

- `node --check scripts/run-app-smoke.mjs` 通过。
- `npm test -- --run src/domains/commands/exportCommand.integration.test.ts` 通过。1 个测试文件、1 项测试通过。
- `npm test -- --run src/domains/export/exportPipeline.test.ts -t "writes complex export smoke artifacts for all supported formats"` 通过。1 个测试文件、1 项测试通过、48 项跳过。
- `npm run tauri:build:app-smoke` 通过。Tauri release app bundle 构建成功；真实 app smoke 通过启动打开 Markdown、`ERROR` 诊断入口、`Cmd+P` 快速打开、基础编辑保存、导出菜单入口、设置中心入口、四格式导出产物生成与检查。
- smoke 证据报告：`.codex-smoke/app-smoke/evidence/report.json`，生成时间 `2026-05-22T02:13:07.683Z`。
- 导出产物证据目录：`.codex-smoke/complex-export/out`。
- 产物检查摘要：
  - HTML：`complex-export.html`，11911 bytes。
  - PDF：`complex-export.pdf`，1549 bytes，1 页，第一页 `595.28 x 841.89`。
  - PNG：`complex-export.png`，68 bytes，`1 x 1`，PNG。该尺寸来自当前 focused test 的 `html2canvas` mock，本 checkpoint 只把产物存在性和结构检查纳入 app smoke；真实视觉尺寸与保真度仍由 Phase 1 / Phase 6 的导出专项继续覆盖。
  - DOCX：`complex-export.docx`，12809 bytes，2 个媒体文件。

剩余风险：

- 这一步没有自动操作 macOS 保存面板逐一点击四个真实导出菜单项，避免把 smoke 变成脆弱的系统 UI 自动化；它补齐的是 app smoke 报告中的导出产物证据。后续 Phase 2 仍需继续覆盖主题切换 / 主题导入、Finder 双击同步、后台导出、链接跳转、反链、关系图谱等真实链路。

### Checkpoint 2B：Finder/openFile 后文件树同步补丁

目标：

- 修复从 Finder / OS open-file 事件打开当前工作区内新文件时，正文已打开但左侧文件树仍停留在旧树的问题。
- 加固 `Cmd+P` app smoke，避免把光标闪烁或背景窗口变化误判为快速打开面板已出现。

影响文件：

- `src/lib/fileActions.ts`
- `src/lib/fileActions.test.ts`
- `scripts/run-app-smoke.mjs`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中等。涉及真实打开文件链路和 app smoke 自动化；不改 UI 结构，不改变左侧边栏、标题栏、导出按钮或专注模式按钮。

实现结果：

- `handleOpenFile()` 在打开文件后分三种情况处理文件树：
  - 当前没有工作区：使用文件父目录作为工作区并刷新树。
  - 文件不在当前工作区内：切到文件父目录并刷新树。
  - 文件在当前工作区内但现有 `fileTree` 找不到该路径：刷新当前工作区树。
- 如果文件已经在当前树里，不做额外刷新，避免普通文件树点击/快速打开时重复扫描。
- `run-app-smoke.mjs` 的 `Cmd+P` 步骤改为物理 `key code 35 using command down`，更接近真实 `KeyP`；同时将快速打开面板截图变化阈值从 `0.006` 提高到 `0.025`，避免光标闪烁导致误判。

if-else 覆盖：

- 如果 Finder 打开的文件在当前工作区外：切换 `rootPath` 到父目录，刷新树。
- 如果 Finder 打开的文件在当前工作区内但树里没有：保留 `rootPath`，刷新树。
- 如果打开的文件已经在树里：不刷新树。
- 如果 `Cmd+P` 没有真的打开快速打开面板：app smoke 会在截图变化阶段失败，而不是继续等待 `target.md`。

验证：

```bash
node --check scripts/run-app-smoke.mjs
npm test -- --run src/lib/fileActions.test.ts src/app/useStartupFileOpen.test.tsx
npm run build
npm run tauri:build:app-smoke
git diff --check
```

结果：

- `node --check scripts/run-app-smoke.mjs` 通过。
- `npm test -- --run src/lib/fileActions.test.ts src/app/useStartupFileOpen.test.tsx` 通过。2 个测试文件、10 项测试通过。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- 第一次 `npm run tauri:build:app-smoke` 在 `Cmd+P` 打开 target 文件处失败，失败原因是 smoke 脚本把非面板变化误判成快速打开已出现；据此加固了快捷键触发和截图阈值。
- 重跑 `npm run tauri:build:app-smoke` 通过。真实 app smoke 通过启动打开 Markdown、`ERROR` 诊断入口、`Cmd+P` 快速打开 target 文件、基础编辑保存、导出菜单入口、设置中心入口、四格式导出产物生成与检查。
- smoke 证据报告：`.codex-smoke/app-smoke/evidence/report.json`，生成时间 `2026-05-22T02:26:37.735Z`；`Cmd+P` 步骤的 `lastSession.filePath` 为 `.codex-smoke/app-smoke/workspace/target.md`。

剩余风险：

- 这一步用单元测试覆盖 Finder/openFile 的工作区树同步分支，用 app smoke 覆盖真实启动和快速打开链路；尚未把 Finder 双击事件本身做成可复现系统级自动点击，因为 macOS Launch Services 与默认应用绑定会让 smoke 变脆。后续 Phase 4 文件安全专项还需要继续覆盖 dirty 切换、外部修改冲突和恢复快照。

## 7. Phase 3：大文档性能专项

### Checkpoint 3A：预览渲染按文档大小分层降频

目标：

- 降低长文连续输入时 `markdownToHtml` 反复运行的频率，保证编辑器输入优先。
- 对超大文档给出轻量“预览更新中”状态，避免用户误以为预览卡死。

影响文件：

- `src/domains/editor/components/PreviewPane.tsx`
- `src/domains/editor/components/PreviewPane.test.tsx`
- `src/styles/preview.css`
- `src/domains/i18n/resources.ts`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中等。触及预览渲染节流和一个轻量状态提示，不改变 Markdown 渲染语义、不改编辑器主体、不引入新依赖。

实现结果：

- 小文档 `<= 30KB`：继续使用 `120ms` debounce，保持即时感。
- 中等文档 `> 30KB 且 <= 300KB`：使用 `220ms` debounce，减少连续输入时预览重算。
- 大文档 `> 300KB`：使用 `600ms` debounce，并在预览区显示轻量 `预览更新中` 状态。
- 状态提示采用当前妙言风格的低对比小浮层，不改变标题栏、状态栏、左侧文件树或导出按钮。
- 新增单元测试覆盖：
  - size-aware debounce 阈值。
  - 大文档 pending 状态显示。
  - 600ms 之前不 rerun `markdownToHtml`，到点后只跑一次最新内容。

if-else 覆盖：

- 如果文档小于等于 30KB：使用原有 120ms 节流。
- 如果文档介于 30KB 到 300KB：中等节流，不显示状态提示。
- 如果文档超过 300KB：更强节流并显示 pending 状态。
- 如果内容已同步到 `renderContent`：清除 pending 状态。

验证：

```bash
npm test -- --run src/lib/markdownToHtml.test.ts src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/SplitView.test.tsx
npm run build
npm exec vite build -- --sourcemap
git diff --check
```

结果：

- `npm test -- --run src/lib/markdownToHtml.test.ts src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/SplitView.test.tsx` 通过。3 个测试文件、51 项测试通过。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `npm exec vite build -- --sourcemap` 通过。主要大 chunk 仍为既有 `main`、`vendor-markdown`、`mermaid.core` 等；本 checkpoint 未新增阻断。

剩余风险：

- 这一步先完成无新依赖、低风险的 size-aware render queue；尚未把 Markdown -> HTML 主流程迁到 Web Worker。Phase 3 后续仍应继续评估 worker 渲染、preview-only 立即补齐、Mermaid 分批上限和更真实的大文档输入性能 smoke。

### Checkpoint 3B：预览独占立即补齐与 Mermaid 分批渲染

目标：

- 用户从分栏切到预览独占时，立即补齐最新 Markdown 渲染结果，不继续等待大文档 debounce。
- Mermaid 图表数量较多时按小批次渲染并让出浏览器帧，避免一次性占满预览主链路。

影响文件：

- `src/domains/editor/components/PreviewPane.tsx`
- `src/domains/editor/components/PreviewPane.test.tsx`
- `src/domains/editor/components/SplitView.tsx`
- `src/domains/editor/components/SplitView.test.tsx`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中等。触及预览调度和 Mermaid hydrate 队列；不改变 Markdown 解析语义、不改变现有 UI 入口、不引入新依赖。

实现结果：

- `PreviewPane` 新增 `renderStrategy`，默认 `deferred`；当 `SplitView` 处于 `preview` 独占模式时传入 `immediate`。
- 大文档在分栏连续输入时仍按 600ms 合并渲染；一旦切到预览独占，立即把最新 `content` 写入 `renderContent` 并清除 `预览更新中`。
- Mermaid 预览 hydrate 新增分批策略：10 个以内保持逐个让出；超过 10 个时每 3 个图表为一批，批次之间让出一帧。
- 新增测试覆盖 preview-only 立即补齐、`SplitView` 策略传递，以及 11 个 Mermaid 图表时按 3 个一批让出。

if-else 覆盖：

- 如果当前是编辑/分栏：预览继续走 size-aware debounce。
- 如果当前是预览独占：立即渲染最终内容，不显示过期预览。
- 如果 Mermaid 数量不超过 10：保持原有逐个让出节奏。
- 如果 Mermaid 数量超过 10：按 3 个一批渲染，批次间让出一帧。

验证：

```bash
npm test -- --run src/lib/markdownToHtml.test.ts src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/SplitView.test.tsx
npm run build
npm exec vite build -- --sourcemap
git diff --check
```

结果：

- `npm test -- --run src/lib/markdownToHtml.test.ts src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/SplitView.test.tsx` 通过。3 个测试文件、54 项测试通过。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `npm exec vite build -- --sourcemap` 通过。`main`、`vendor-markdown`、`mermaid.core` 等大 chunk 仍为既有体积风险，本 checkpoint 没有新增阻断。
- `git diff --check` 通过。

## 8. Phase 4：文件安全与 Finder 打开同步

### Checkpoint 4A：dirty 文档切换保护

目标：

- 从文件树、快速打开、链接、反链、图谱或 Finder/open-file 链路打开另一个文件前，如果当前文稿有未保存改动，必须先让用户选择保存、另存为、放弃或取消。
- 点击当前已打开的同一个文件时，不再重新从磁盘读取并覆盖当前未保存内容。

影响文件：

- `src/lib/fileActions.ts`
- `src/lib/fileActions.test.ts`
- `src/App.tsx`
- `src/domains/document/components/DirtyDocumentSwitchModal.tsx`
- `src/domains/document/components/DirtyDocumentSwitchModal.test.tsx`
- `src/domains/i18n/resources.ts`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中等。触及所有 `openFile` 文件切换入口；不改变文件树视觉、不移动现有入口、不引入新依赖。

实现结果：

- `executeFileAction(openFile)` 在读取目标文件前先检查当前文档是否 dirty。
- 如果目标路径就是当前文档：只同步文件树，不重新 `readTextFile`，避免覆盖未保存内容。
- 如果目标路径不同且当前文档 dirty：通过 Prism 风格弹窗让用户选择 `保存`、`另存为`、`放弃改动`、`取消`。
- 选择 `保存`：先写回当前文档，再打开目标文件；保存失败则保持当前文档，不切换。
- 选择 `另存为`：复用 Prism 自有保存面板，不走 macOS 原生提示；保存取消时不切换。
- 选择 `放弃改动`：明确丢弃当前未保存内容并打开目标文件。
- 选择 `取消`：不读取目标文件，当前文档保持不变。

if-else 覆盖：

- 如果当前文档干净：按原链路打开目标文件并同步工作区树。
- 如果当前文档 dirty 且目标是同一路径：不重载、不覆盖、不刷新文稿内容。
- 如果当前文档 dirty 且用户取消：不打开目标文件。
- 如果当前文档 dirty 且用户保存：保存成功后再打开目标文件。
- 如果没有 dirty 切换确认入口：文件动作服务会阻止切换并提示，不静默覆盖。

验证：

```bash
npm test -- --run src/lib/fileActions.test.ts src/domains/document/components/DirtyDocumentSwitchModal.test.tsx src/domains/document/components/SaveConflictModal.test.tsx src/domains/document/hooks/useAutoSave.test.tsx src/domains/document/hooks/useExternalFileChangeMonitor.test.tsx src/domains/document/hooks/useRecoveryQueue.test.tsx
npm test -- --run src/domains/document src/domains/workspace src/lib/fileActions.test.ts src/app/useStartupFileOpen.test.tsx
npm run build
git diff --check
npm run tauri:build:app-smoke
```

结果：

- `npm test -- --run src/lib/fileActions.test.ts src/domains/document/components/DirtyDocumentSwitchModal.test.tsx src/domains/document/components/SaveConflictModal.test.tsx src/domains/document/hooks/useAutoSave.test.tsx src/domains/document/hooks/useExternalFileChangeMonitor.test.tsx src/domains/document/hooks/useRecoveryQueue.test.tsx` 通过。6 个测试文件、31 项测试通过。
- `npm test -- --run src/domains/document src/domains/workspace src/lib/fileActions.test.ts src/app/useStartupFileOpen.test.tsx` 通过。29 个测试文件、115 项测试通过。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `git diff --check` 通过。
- `npm run tauri:build:app-smoke` 通过。真实 app smoke 通过启动打开 Markdown、`ERROR` 诊断入口、`Cmd+P` 快速打开 target 文件、基础编辑保存、导出菜单入口、设置中心入口、四格式导出产物生成与检查。
- smoke 证据报告：`.codex-smoke/app-smoke/evidence/report.json`，生成时间 `2026-05-22T03:09:24.728Z`，`steps` 共 8 项。

### Checkpoint 4B：干净文稿外部修改自动刷新

目标：

- 当前文稿没有未保存改动时，如果磁盘文件被外部修改，Prism 自动刷新为磁盘最新内容。
- 当前文稿有未保存改动时，继续保留冲突保护，不自动覆盖用户正在编辑的内容。
- 刷新过程中如果用户开始编辑或切换到其他文稿，不应用过期读取结果。

影响文件：

- `src/domains/document/hooks/useExternalFileChangeMonitor.ts`
- `src/domains/document/hooks/useExternalFileChangeMonitor.test.tsx`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中等。触及外部文件变化监控和当前文稿状态刷新；不改变文件树视觉、不移动现有入口、不引入新依赖。

实现结果：

- 外部变化监控不再只检查 dirty 文稿，clean 文稿也会在 focus 和低频 timer 中做 `stat`。
- 如果磁盘快照未变化：不读取文件，不改变当前文稿。
- 如果磁盘快照变化且当前文稿 dirty：沿用原冲突链路，标记 `saveStatus: conflict`。
- 如果磁盘快照变化且当前文稿 clean：读取磁盘最新内容并重新 `openDocument`，同步 `lastKnownMtime` 与 `lastKnownSize`。
- 读取完成前再次检查当前文稿路径和 dirty 状态，避免异步读取覆盖用户新编辑或新切换的文稿。

if-else 覆盖：

- 如果当前没有打开文稿：不检查。
- 如果当前文稿正在保存或已经处于冲突：不重复检查。
- 如果磁盘版本未变化：不刷新，不触发 `readTextFile`。
- 如果磁盘版本变化且文稿是 dirty：只标冲突，不读取覆盖。
- 如果磁盘版本变化且文稿是 clean：自动刷新为磁盘最新内容。
- 如果读取期间文稿变 dirty：保留用户本地编辑，不应用磁盘内容。
- 如果读取期间切换到其他文稿：不把旧文稿读取结果写到新文稿。

验证：

```bash
npm test -- --run src/domains/document/hooks/useExternalFileChangeMonitor.test.tsx
npm test -- --run src/domains/document src/domains/workspace src/lib/fileActions.test.ts src/app/useStartupFileOpen.test.tsx
npm run build
git diff --check
npm run tauri:build:app-smoke
```

结果：

- `npm test -- --run src/domains/document/hooks/useExternalFileChangeMonitor.test.tsx` 通过。1 个测试文件、7 项测试通过。
- `npm test -- --run src/domains/document src/domains/workspace src/lib/fileActions.test.ts src/app/useStartupFileOpen.test.tsx` 通过。29 个测试文件、118 项测试通过；测试环境仅输出既有 `--localstorage-file` warning。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `git diff --check` 通过。
- `npm run tauri:build:app-smoke` 通过。真实 app smoke 通过启动打开 Markdown、`ERROR` 诊断入口、`Cmd+P` 快速打开 target 文件、基础编辑保存、导出菜单入口、设置中心入口、四格式导出产物生成与检查。
- smoke 证据报告：`.codex-smoke/app-smoke/evidence/report.json`，生成时间 `2026-05-22T03:18:05.841Z`，`steps` 共 8 项。

## 9. Phase 5：工作区索引、搜索、链接、反链

### Checkpoint 5A：工作区索引大目录分批读取

目标：

- `Cmd+P`、全文搜索、`[[ ]]`、反链和关系图谱继续共用同一套 `workspaceIndex`。
- 大工作区索引不再一次性并发读取所有 Markdown 文件，降低打开大目录时的 I/O 峰值和前台卡顿风险。
- 单个文件读取失败时跳过该文件，不阻塞整套索引。

影响文件：

- `src/domains/workspace/hooks/useWorkspaceIndexModel.ts`
- `src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中低。只调整 workspace index 的读取调度，不改变索引结构、链接解析语义、命令面板 UI 或现有文件树入口。

实现结果：

- 少量文件 `<= 40`：保持原来的并发读取，保证小工作区即时感。
- 大目录 `> 40`：按 `20` 个文件一批读取，批次之间让出一次事件循环。
- 不可读取文件继续被过滤，不影响可读取文档进入索引。
- 当前未保存文稿仍覆盖磁盘旧内容进入索引，反链和搜索不会因为未保存编辑变旧。

if-else 覆盖：

- 如果没有 workspace root：清空索引状态。
- 如果没有 Markdown 文件：清空索引来源并停止 indexing。
- 如果文件数量少：一次并发读取。
- 如果文件数量多：分批读取并保持 `workspaceIndexing` 状态。
- 如果某个文件读取失败：跳过该文件，其余文档继续索引。
- 如果当前文稿有未保存改动：用当前内存正文覆盖磁盘读取结果。

验证：

```bash
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/components/shell/CommandPalette.test.tsx src/domains/editor/extensions/linkCompletion.test.ts
npm test -- --run src/domains/workspace src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts
npm run build
git diff --check
npm run tauri:build:app-smoke
```

结果：

- `npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/components/shell/CommandPalette.test.tsx src/domains/editor/extensions/linkCompletion.test.ts` 通过。4 个测试文件、14 项测试通过。
- `npm test -- --run src/domains/workspace src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts` 通过。18 个测试文件、66 项测试通过。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `git diff --check` 通过。
- `npm run tauri:build:app-smoke` 通过。真实 app smoke 通过启动打开 Markdown、`ERROR` 诊断入口、`Cmd+P` 快速打开 target 文件、基础编辑保存、导出菜单入口、设置中心入口、四格式导出产物生成与检查。
- smoke 证据报告：`.codex-smoke/app-smoke/evidence/report.json`，生成时间 `2026-05-22T03:28:13.290Z`，`steps` 共 8 项。

### Checkpoint 5B：同文档标题链接直接跳转

目标：

- 文档链接面板和预览转发的 Markdown 同文档标题链接 `#anchor` 不再被当成“打开另一个文件”。
- 即使当前没有 workspace root，同文档标题链接也能直接跳到当前文稿标题行。
- 缺失标题仍给出明确提示，不静默失败、不创建文件。

影响文件：

- `src/app/useDocumentNavigationModel.ts`
- `src/app/useDocumentNavigationModel.test.tsx`
- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 中低。只扩展文档导航模型里的同文档锚点分支，不改变跨文档链接、反链、图谱、文件树或命令面板行为。

实现结果：

- `openDocumentLink('#标题')` 会先解析当前文稿标题 slug。
- 找到标题时直接 `jumpToLine`，不要求 workspace root，不调用 `openFile`。
- 找不到标题时显示现有链接未找到提示。
- 文档链接面板选择 `[跳转](#标题)` 时复用同一跳转分支。

if-else 覆盖：

- 如果是 Markdown 同文档标题链接且标题存在：跳到当前文稿标题行。
- 如果是 Markdown 同文档标题链接但标题不存在：提示链接目标未找到。
- 如果是普通相对 Markdown 链接：继续用 workspace index / file tree 解析目标文件。
- 如果是 Wiki 链接：保持原有 workspace 文档解析逻辑。

验证：

```bash
npm test -- --run src/app/useDocumentNavigationModel.test.tsx src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/editor/components/SplitView.test.tsx
npm test -- --run src/domains/workspace src/app/useDocumentNavigationModel.test.tsx src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts
npm run build
git diff --check
npm run tauri:build:app-smoke
```

结果：

- `npm test -- --run src/app/useDocumentNavigationModel.test.tsx src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/editor/components/SplitView.test.tsx` 通过。3 个测试文件、19 项测试通过。
- `npm test -- --run src/domains/workspace src/app/useDocumentNavigationModel.test.tsx src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts` 通过。19 个测试文件、69 项测试通过。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `git diff --check` 通过。
- `npm run tauri:build:app-smoke` 通过。真实 app smoke 通过启动打开 Markdown、`ERROR` 诊断入口、`Cmd+P` 快速打开 target 文件、基础编辑保存、导出菜单入口、设置中心入口、四格式导出产物生成与检查。
- smoke 证据报告：`.codex-smoke/app-smoke/evidence/report.json`，生成时间 `2026-05-22T03:35:47.875Z`，`steps` 共 8 项。

## 10. Phase 6：DOCX / 图片 / HTML 富内容增强

### Checkpoint 6A：DOCX 富内容链路验证收口

目标：

- 确认 DOCX 导出已覆盖计划中的正文、链接、图片、Mermaid、KaTeX、Callout、Toggle、行内 HTML 和复杂视觉块 fallback。
- 不重复改动已实现的 DOCX 适配逻辑，只补当前计划的验证证据。

影响文件：

- `docs/verification/prism-next-optimization-run.md`

风险等级：

- 低。文档验证收口，不改运行时代码。

现有实现确认：

- 图片包裹链接会写入 DOCX hyperlink relationship。
- 普通 SVG 图片保留 SVG + PNG fallback；Mermaid 走 PNG-first，不把 SVG 作为首选显示资源。
- `<mark>`、`<kbd>`、`<abbr>` 等安全行内 HTML 不再以源码标签形式泄漏到 DOCX 正文。
- Callout / Toggle 导出为可读结构，不泄漏 `<details>` 源标签。
- Mermaid、KaTeX、复杂 HTML block 可走高保真图片 fallback。
- DOCX 图片 drawing id 有稳定规范化，降低 WPS/Word 兼容问题。

if-else 覆盖：

- 如果是 `<mark>`：映射为高亮 run。
- 如果是 `<kbd>`：映射为等宽键帽文本。
- 如果是 `<abbr title>`：正文保留缩写文字，不泄漏原始 HTML。
- 如果是 `<details>`：导出为 summary + 展开内容。
- 如果是 Callout：导出为可读块引用样式。
- 如果是 Mermaid：PNG-first 嵌入。
- 如果是复杂 HTML / KaTeX：结构化不足时图片化 fallback。
- 如果图片有链接：写入 hyperlink relationship。

验证：

```bash
npm test -- --run src/domains/export/adapters/docx.ts src/domains/export/exportPipeline.test.ts src/domains/export/assets.test.ts
npm run build
git diff --check
```

结果：

- `npm test -- --run src/domains/export/adapters/docx.ts src/domains/export/exportPipeline.test.ts src/domains/export/assets.test.ts` 通过。2 个测试文件、54 项测试通过；测试环境仅输出既有 `--localstorage-file` warning。
- `npm run build` 通过。仅保留既有 Vite large chunk warning。
- `git diff --check` 通过。
