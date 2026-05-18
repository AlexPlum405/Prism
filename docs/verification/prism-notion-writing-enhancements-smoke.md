# Prism Notion-inspired 写作增强验证记录

> 目标：以增量、非破坏方式补齐斜杠菜单、Callout / Toggle、页面链接与反向链接、模板、轻量属性、块级源码操作。

## 2026-05-18 Phase 1：斜杠菜单最小基础设施

改动范围：

- 新增 `src/domains/editor/extensions/slashMenu.ts`，提供 `/` 触发的 Markdown snippet completion。
- 在 `EditorPane` 现有 CodeMirror `autocompletion.override` 中追加 slash completion source。
- 补充纯函数测试与挂载编辑器集成测试。

非破坏性约束：

- 未重写编辑器生命周期、命令系统、预览、导出、状态栏、主题或滚动条。
- 新能力仅作为 CodeMirror completion extension 接入，可独立移除。
- 插入内容保持标准 Markdown 或安全 HTML：表格、Mermaid、KaTeX、Callout、`details/summary`、代码块、模板、导出 front matter。

验证命令：

```bash
npm test -- --run src/domains/editor/extensions/slashMenu.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
npm test -- --run
npm run build
git diff --check
```

结果：

- `slashMenu.test.ts` + `EditorPane.integration.test.tsx`：2 files / 19 tests passed。
- `npm test -- --run`：60 files / 371 tests passed。
- `npm run build`：通过；保留既有 Vite chunk size warning。
- `git diff --check`：通过。

跳过项：

- 未跑 Tauri app / 发布级 smoke。本阶段只接入前端编辑器 completion，不涉及 Tauri 权限、打包、updater、安装器、文件关联或导出渲染主链路。

## 2026-05-18 Phase 2：Callout / Toggle 预览与导出

改动范围：

- 新增 `src/domains/editor/extensions/callouts.ts`，识别 `> [!NOTE]`、`> [!WARNING]`、`> [!TIP]`。
- `markdownToHtml` 在 Markdown AST 层把支持的 callout 标记为 `.prism-callout`，保留正文 source line。
- `global.css` 在 `.preview-compat` 范围内追加 Callout 和 `details/summary` 样式。
- DOCX 导出在原 blockquote 映射上识别 callout，移除源 marker；对 `details/summary` 采用“折叠标题 + 展开正文”的文档兜底。

非破坏性约束：

- 未改变普通 blockquote 的 Markdown 语义；只有首行匹配 `[!NOTE|WARNING|TIP]` 的引用块才增强。
- Toggle 仍使用安全 HTML `<details><summary>...</summary>...</details>`，没有引入富文本 block editor。
- 预览样式只追加到 `.preview-compat`，不改外壳、状态栏、toast、滚动条或主题 token。

验证命令：

```bash
npm test -- --run src/domains/editor/extensions/callouts.test.ts src/lib/markdownToHtml.test.ts src/domains/export/exportPipeline.test.ts
npm test -- --run
npm run build
git diff --check
```

结果：

- Callout / markdownToHtml / exportPipeline 相关测试：3 files / 72 tests passed。
- `npm test -- --run`：61 files / 375 tests passed。
- `npm run build`：通过；保留既有 Vite chunk size warning。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke。本阶段未触及 Tauri 权限、安装器、updater、文件关联或发布配置。

## 2026-05-18 Phase 3：模板系统复核与斜杠菜单整合

现状复核：

- `MARKDOWN_TEMPLATES` 已内置 README、PRD、会议纪要、周报、技术方案、公众号长文、论文草稿、读书笔记、研究摘要、白皮书。
- 文件菜单和命令面板已暴露模板命令；无打开文档时创建新 Markdown 文档，有打开文档时派发编辑器插入事件。
- Phase 1 的 `/` 斜杠菜单已把所有 `MARKDOWN_TEMPLATES` 作为 Markdown snippet 接入。
- 模板内容全部是 Markdown 文本，没有数据库、Properties、云端或 WYSIWYG 依赖。

改动范围：

- 本 checkpoint 不新增业务代码，只记录验证证据。原因：目标功能已经由既有实现和 Phase 1 slash menu 覆盖，重复实现会增加破坏风险。

验证命令：

```bash
npm test -- --run src/domains/editor/extensions/templates.test.ts src/domains/editor/extensions/slashMenu.test.ts src/domains/commands/registry.test.ts src/domains/editor/components/EditorPane.integration.test.tsx
git diff --check
```

结果：

- 4 files / 46 tests passed。
- `git diff --check`：通过。

跳过项：

- 未跑全量测试和 build。本 checkpoint 只追加验证文档，业务代码保持上一阶段已验证状态。

## 2026-05-18 Phase 4：页面链接与反向链接

改动范围：

- `[[...]]` 补全增加当前文档标题项，并把选择结果落成标准 Markdown 相对链接。
- 新增轻量 backlinks 扫描服务，识别 Markdown 链接和 `[[wiki]]` 链接对当前文档的引用。
- App 基于当前工作区 Markdown 文件异步扫描反向链接；限制最多 200 个文件、单文件 1MB，避免长文工作区阻塞前台。
- 状态栏增加 `BACKLINK n` 入口；点击打开反向链接 modal，选择后打开引用文件并跳转到对应行。

非破坏性约束：

- 保留现有 `](` 文件/标题补全；`[[...]]` 只增强接受补全后的插入行为。
- 不引入图谱、数据库、实时索引服务或 watcher；仍依赖本地工作区文件树和显式读取。
- Backlinks 展示复用现有 modal / statusbar 视觉语言，没有改动主布局。

验证命令：

```bash
npm test -- --run src/domains/editor/extensions/linkCompletion.test.ts src/domains/workspace/services/backlinks.test.ts src/domains/workspace/components/StatusBar.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx
npm test -- --run
npm run build
git diff --check
```

结果：

- Phase 4 相关测试：4 files / 30 tests passed。
- `npm test -- --run`：62 files / 379 tests passed。
- `npm run build`：通过；保留既有 Vite chunk size warning。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke。本阶段是前端工作区扫描和编辑器补全增强，不触及 Tauri 权限、安装器、updater 或文件关联配置。
