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
