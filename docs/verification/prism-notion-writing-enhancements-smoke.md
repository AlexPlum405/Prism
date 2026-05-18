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

## 2026-05-18 Phase 5：YAML Front Matter 轻量属性面板

改动范围：

- 新增 front matter 属性读写服务，支持 title、tags、description、author、date、status、export。
- 新增“文档属性”modal，状态栏 `META` 入口打开；应用后写回 Markdown 顶部 YAML Front Matter。
- 保留未知 YAML 字段；遇到无效 YAML 时禁止可视化覆盖，提示用户回到源码修正。

非破坏性约束：

- Front matter 仍是唯一数据源，没有数据库、隐藏副本或 Properties 表格视图。
- 未修改现有导出 front matter 解析逻辑；新面板只负责编辑 Markdown 源文本。
- 状态栏只增加一个小型 `META` 入口，沿用现有诊断按钮视觉。

验证命令：

```bash
npm test -- --run src/domains/editor/extensions/frontMatterProperties.test.ts src/domains/editor/components/DocumentPropertiesPanel.test.tsx src/domains/workspace/components/StatusBar.test.tsx
npm test -- --run
npm run build
git diff --check
```

结果：

- Phase 5 相关测试：3 files / 13 tests passed。
- `npm test -- --run`：64 files / 386 tests passed。
- `npm run build`：通过；保留既有 Vite chunk size warning。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke。本阶段未触及 Tauri 权限、发布配置、安装器、updater 或文件关联。

## 2026-05-18 Phase 6：块级源码操作

改动范围：

- 新增 `src/domains/editor/extensions/blockOperations.ts`，以纯源码范围计算实现段落上/下移、章节上/下移、复制当前章节、选区转引用、选区转 NOTE / WARNING / TIP Callout、选区转无序 / 有序 / 任务列表。
- `EditorPane` 通过既有 `prism-editor-command` 和 `prism-block-format` 事件接入块级操作；`foldCurrentHeading` 使用 CodeMirror fold range 折叠当前标题，不引入 WYSIWYG block editor。
- 命令系统新增“块级源码操作”菜单和命令面板项，全部派发到现有编辑器命令入口。
- 补充纯函数测试、真实挂载 CodeMirror 的命令接线测试、命令菜单 / 命令面板暴露测试。

非破坏性约束：

- 未重写编辑器生命周期、预览、导出 pipeline、状态栏、主题系统、toast、滚动条或视觉 token。
- 所有新能力只操作 Markdown 源码范围；不会引入数据库、拖拽 block editor、完整 WYSIWYG 或隐藏数据副本。
- 既有引用 / 列表菜单命令继续通过 `prism-block-format` 入口工作；有选区或当前行时转换源码块，保持 Markdown 为唯一真实数据源。

验证命令：

```bash
npm test -- --run src/domains/editor/extensions/blockOperations.test.ts src/domains/editor/components/EditorPane.integration.test.tsx src/domains/commands/registry.test.ts
npm test -- --run
npm run build
git diff --check
```

结果：

- Phase 6 相关测试：3 files / 48 tests passed。
- `npm test -- --run`：65 files / 396 tests passed。
- `npm run build`：通过；保留既有 Vite dynamic import / chunk size warning。
- `git diff --check`：通过。

跳过项：

- 未跑 Tauri app / 发布级 smoke。本阶段只新增前端编辑器源码操作和命令注册，不触及 Tauri 权限、打包、updater、安装器、文件关联或导出渲染主链路。

## 2026-05-18 人工测试反馈修复：斜杠菜单视觉与 Front Matter 预览

问题现象：

- `/` 斜杠菜单使用 CodeMirror 默认 autocomplete 样式，显示默认图标、蓝色选中条和系统化详情气泡，不符合 Prism OpenAI 极简视觉。
- YAML front matter 在预览中按普通 Markdown 渲染，`title/tags/description/author/date/status/export` 被挤成段落和列表，干扰正文阅读。

改动范围：

- `src/styles/global.css`：为 `.cm-tooltip-autocomplete` / completion info 添加 Prism 风格的白底、细边框、6.08px 圆角、轻阴影、Inter 字体、紧凑行高，并隐藏 CodeMirror 默认类型图标。
- `src/lib/markdownToHtml.ts`：新增可选 `stripFrontMatter` 渲染选项；只在预览需要时隐藏顶部 YAML front matter，并通过保留空行维持 source line 偏移。
- `PreviewPane` 调用 `markdownToHtml(renderContent, { stripFrontMatter: true })`；导出 pipeline 和默认 `markdownToHtml` 行为保持不变，避免改变“Front matter 覆盖关闭时按普通内容导出”的既有语义。

验证命令：

```bash
npm test -- --run src/lib/markdownToHtml.test.ts src/domains/editor/components/PreviewPane.test.tsx
npm test -- --run src/domains/export/exportPipeline.test.ts
npm test -- --run
npm run build
git diff --check
```

结果：

- `markdownToHtml.test.ts` + `PreviewPane.test.tsx`：2 files / 37 tests passed。
- `exportPipeline.test.ts`：1 file / 49 tests passed。
- `npm test -- --run`：65 files / 398 tests passed。
- `npm run build`：通过；保留既有 Vite dynamic import / chunk size warning。
- `git diff --check`：通过。

备注：

- 第一次全量测试中 `exportPipeline.test.ts` 的 PDF 链接图片用例在 5s 边界超时；单独重跑该文件通过，随后全量重跑通过，判断为并发测试耗时抖动，不是本次预览/斜杠菜单改动引入的行为回退。
