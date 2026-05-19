# Prism 架构优化全阶段计划

> 用途：作为 `/goal` 的详细执行计划。短 goal 只引用本文件，避免 prompt 过长。

## 总目标

在不改变 Prism 产品定位、不破坏当前妙言风格、不回退现有写作/预览/保存/导出能力的前提下，完成第一轮系统性架构深化。重点是让核心模块更深、更清晰、更可测试、更适合长期维护。

## 产品与工程边界

- Prism 仍是本地优先、单文档单窗口、Markdown 源码可见的写作器。
- 不新增 Notion 数据库、完整块编辑器、云同步、实时协作、插件市场、AI 写作平台。
- 不做视觉换皮，不回到 OpenAI 原型风格；新 UI 必须贴合当前妙言风格。
- 不新增外部依赖，除非明确说明必要性并暂停等待确认。
- 不做发布、签名、公证、生产发布动作。
- 不 reset、checkout、revert 或覆盖无关脏改。

## 执行原则

- 按 checkpoint 小步推进，每个 checkpoint 先说明目标、影响文件、风险等级、验证命令。
- 优先迁移纯函数、建立 seam、补测试，再移动调用方。
- 每个 checkpoint 完成后更新验证记录，能安全提交就 commit 并 push。
- 不一次性重写大模块；目标是架构迁移和行为保持，不是重做产品。

## 10 个必须完成的优化项

### 1. App.tsx 瘦身

问题：

- `src/App.tsx` 承担文档生命周期、工作区导航、导出任务 UI、toast、恢复、诊断、快捷键、modal 接线等职责。
- 继续增长会导致每次改 UI 状态都要理解全局交互。

目标：

- 抽出有名字的深模块或 hooks，例如：
  - `useDocumentLifecycle`
  - `useWorkspaceNavigation`
  - `useExportTaskUi`
  - `useDiagnostics`
  - `useAppShortcuts`
- App.tsx 保留组合层职责，不直接承载大量业务分支。

验证：

- `src/App.recovery.test.tsx`
- 与拆出 hook 对应的新增测试
- `npm test -- --run`

### 2. 导出 pipeline 分层

问题：

- `src/domains/export/exportPipeline.ts` 已经是巨型 module，资源处理、分页保护、PDF/PNG/DOCX/HTML、Mermaid、KaTeX、图片、失败诊断混在一起。

目标：

- 在 `src/domains/export/` 下拆出内部 module：
  - `assets`：本地图片、SVG、Mermaid、KaTeX、HTML 视觉块、链接图片。
  - `pagination`：atomic block、heading + visual block group、spacer、PDF/PNG/DOCX 共享分页策略。
  - `diagnostics`：导出阶段、格式、路径、warning、错误原因、下一步建议。
  - `rendering`：可复用的渲染 frame、DOM 准备、图片尺寸/栅格化工具。
- 保持现有 HTML/PDF/PNG/DOCX 行为不回退。
- 不新增导出格式，不重写导出算法。

验证：

- `npm test -- --run src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts`

### 3. 统一 Markdown 渲染核心

问题：

- 预览、导出、链接诊断、关系图谱、front matter、source line 各自理解 Markdown，长期会出现预览和导出不一致。

目标：

- 梳理 Markdown core / document model seam。
- 统一或复用：
  - Markdown AST / HTML 生成
  - source line 信息
  - links / assets / headings / front matter
  - diagnostics 输入
- 不做完整 WYSIWYG，不隐藏 Markdown 源码。

验证：

- `src/lib/markdownToHtml.test.ts`
- 链接、front matter、workspace index、导出相关测试

### 4. 命令系统瘦身

问题：

- `src/domains/commands/registry.ts` 同时包含命令定义、启用条件、执行逻辑、导出逻辑、文件逻辑。

目标：

- 按类别拆分：
  - `fileCommands`
  - `editCommands`
  - `viewCommands`
  - `exportCommands`
  - `workspaceCommands`
  - `documentInfoCommands`
- 保持统一 registry interface。
- 不恢复全功能命令面板；`Cmd+P` 只做快速打开，`Cmd+Shift+F` 只做全文搜索。

验证：

- `src/domains/commands/registry.test.ts`
- `src/domains/commands/platform.test.ts`
- `src/App.recovery.test.tsx`

### 5. 统一诊断模型

问题：

- 链接错误、排版提示、导出失败、Mermaid/KaTeX 渲染错误分散，UI 已收敛为 `ERROR`，架构仍未完全收敛。

目标：

- 建立 `PrismDiagnostic` 或等价 module：
  - `kind`
  - `severity`
  - `source`
  - `line/column`
  - `message`
  - `reason`
  - `action`
  - `quickFix`（可选）
- 状态栏 `ERROR`、诊断面板、导出预检复用同一诊断 interface。
- 普通排版建议默认不计入 `ERROR`。

验证：

- `LinkDiagnosticsPanel.test.tsx`
- `TypographyDiagnosticsPanel.test.tsx`
- `StatusBar.test.tsx`
- 导出预检相关 App 测试

### 6. 工作区索引深化

问题：

- 快速打开、全文搜索、`[[` 页面链接、反向链接、关系图谱都依赖工作区文档信息，应统一成为底层能力。

目标：

- 深化 `workspaceIndex`：
  - 标题
  - 路径
  - 链接
  - front matter
  - 正文摘要
  - 最近文档排序信号
- 减少各入口重复扫描。
- 大工作区可为后续 Worker 化预留 seam，但本阶段不强制引入 Worker。

验证：

- `workspaceIndex.test.ts`
- `quickOpen` / `backlinks` / `relationGraph` / `documentLinks` 相关测试

### 7. CSS / 设计系统拆分

问题：

- `src/styles/global.css` 过大，样式影响面难判断。

目标：

- 在不改变视觉的前提下拆分为更清晰的层：
  - `tokens.css`
  - `miaoyan.css`
  - `shell.css`
  - `editor.css`
  - `preview.css`
  - `export.css`
  - `diagnostics.css`
- 保持组件级 CSS module 的局部结构。
- 不做视觉换皮。

验证：

- `npm test -- --run`
- `npm run build`
- 真实 app 启动后人工看关键页面：主界面、设置、快速打开、ERROR、导出弹窗。

### 8. 主包性能优化

问题：

- 已知 main chunk 偏大，首屏可能被 highlight.js、Markdown preview、关系图谱或导出依赖污染。

目标：

- 记录优化前后的 `npm run build` chunk 结果。
- 优先处理：
  - `highlight.js` 按语言或按功能懒加载。
  - Markdown preview 重依赖延迟到预览/分栏模式。
  - 关系图谱依赖只在打开图谱时加载。
  - 确保导出相关依赖不污染主入口。
- 不为了体积破坏启动、预览、导出稳定性。

验证：

- `npm run build`
- 记录 main chunk 变化；如果未下降，说明原因。

### 9. 文件安全层深化

问题：

- 保存、另存、外部文件变更、恢复快照、冲突处理、访达双击打开、工作区刷新都属于本地写作安全，但分散在多个层。

目标：

- 整理为更深的本地文件安全 module：
  - `DocumentFileSession`
  - `WorkspaceFileSession`
  - `FileConflictDetector`
  - `RecoverySnapshotStore`
- 不改变文件系统权限和用户可见行为。

验证：

- `useAutoSave.test.tsx`
- `useExternalFileChangeMonitor.test.tsx`
- `useRecoveryQueue.test.tsx`
- `conflictResolution.test.ts`
- `store.test.ts`
- 必要时补真实 app smoke 说明。

### 10. 真实 App smoke 自动化

问题：

- 自动化单测很多，但真实 `.app` 的菜单、快捷键、窗口、导出弹窗、文件树同步仍需要更稳定的验证链路。

目标：

- 建立或完善真实 `Prism.app` smoke harness。
- 至少覆盖：
  - 启动
  - `Cmd+P`
  - 设置中心
  - `ERROR` 诊断
  - 导出保存弹窗
  - 文件树同步
  - 基础编辑/保存路径
- 证据写入 `docs/verification/` 或 `.codex-smoke/`。

验证：

- `npm run tauri:build:app-smoke`
- smoke 脚本或人工测试记录
- 重启本地 Prism.app

## 最终验证门槛

- `npm test -- --run`
- `npm run build`
- `git diff --check`
- `npm run tauri:build:app-smoke`
- 重启本地 `Prism.app`
- docs/verification/ 已更新完整证据。
- 所有 checkpoint 均已 commit 并 push 到 `origin/main`。

## 暂停条件

- 需要改变产品定位或用户已确认交互策略。
- 需要大规模重写核心算法。
- 需要新增外部依赖。
- 需要破坏性 git 操作。
- 需要凭据、签名、公证、生产发布权限。
- 某阶段风险足以影响已有用户数据安全。

