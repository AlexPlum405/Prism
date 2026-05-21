# Prism 下一阶段优化实施计划

> 状态：待实施
> 日期：2026-05-21
> 当前唯一待实施计划：是
> 说明：后续开发以本文为准。历史计划文件已标记为“已完成 / 历史归档”，仅作为背景资料，不再作为 active plan 使用。

## 1. 总目标

把 Prism 从“功能已经比较多的本地 Markdown 编辑器”，继续打磨成一个可靠、稳定、可长期写作和交付文档的桌面写作器。

本轮优化不追求更多噱头，而是优先补齐真实用户会感知到的核心信任链路：

- 导出保真：HTML / PDF / PNG / DOCX 输出接近 Prism 预览。
- 真实验证：每次关键改动都有可复现 app smoke。
- 长文性能：中文长文、多图、多 Mermaid、多 KaTeX 场景下输入和预览仍可用。
- 文件安全：打开、保存、外部修改、恢复、Finder 打开同步不让用户丢稿或迷路。
- 写作效率：搜索、链接、反链、关系图谱、模板、中文写作检查服务本地写作，不把 Prism 做成 Notion 或 Obsidian 重型知识库。

## 2. 产品边界

必须保持：

- 本地优先。
- 单文档单窗口。
- Markdown 源码可见。
- 当前妙言风格。
- 现有编辑 / 分栏 / 预览三态。
- 现有导出按钮、专注模式按钮、右上角视图切换、左侧文件树。

明确不做：

- 完整 WYSIWYG。
- 云同步、账号系统、移动端。
- 实时协作、评论审阅流。
- Notion database / properties 全量复刻。
- Obsidian 式插件市场和重型知识宇宙。
- AI 写作平台。
- 无确认的破坏性 git 操作。

## 3. 总体执行顺序

| Phase | 名称 | 优先级 | 主要目录 | 完成结果 |
| --- | --- | --- | --- | --- |
| 0 | 基线收口 | P0 | docs / git | 当前计划成为唯一待实施计划，旧计划归档 |
| 1 | 导出保真二期 | P0 | `src/domains/export/**` | 四格式导出稳定、高清、可诊断 |
| 2 | 真实 app smoke 扩展 | P0 | `scripts/run-app-smoke.mjs` | 关键真实链路自动验证 |
| 3 | 大文档性能专项 | P0 | editor / preview / markdown | 长文输入和预览不卡主链路 |
| 4 | 文件安全与 Finder 打开同步 | P0 | document / workspace / Tauri commands | 不丢稿、不误覆盖、外部打开状态正确 |
| 5 | 工作区索引、搜索、链接、反链 | P1 | workspace / editor extensions | `Cmd+P`、全文搜索、`[[ ]]`、反链共用索引 |
| 6 | DOCX / 图片 / HTML 富内容增强 | P1 | export adapters | Word 结果更接近预览 |
| 7 | 主题、模板、中文写作检查 | P2 | themes / templates / diagnostics | 体验增强但不扩展成平台 |
| 8 | 发布可信链路 | P3 | release scripts / Tauri config | 正式发布前补签名、公证、更新器、Windows 验证 |

每个 phase 都必须小步 checkpoint 推进。一个 checkpoint 开始前先说明目标、影响文件、风险等级、验证命令；结束后更新验证证据，验证通过再进入下一个 checkpoint。

## 4. Phase 0：基线收口

### 目标

- 当前文件成为唯一 active plan。
- 旧计划文件全部标记为“已完成 / 历史归档”。
- 当前图标改动与后续优化计划分开处理，不混在一个提交里。

### 实施路线

1. 新增本文。
2. 新增 `docs/prism-next-optimization-goal.md`。
3. 给旧计划 / 旧 goal 文件顶部增加状态块。
4. 跑 `git diff --check`。

### if-else

- 如果工作树有图标改动：不要回滚；只在后续提交时单独 stage。
- 如果 `.codex-output/` 存在：视为本地裁图产物，不纳入计划提交。
- 如果发现旧计划仍写“作为当前依据”：在顶部状态块明确覆盖其 active 语义。
- 如果旧计划内容有历史价值：不删除，只归档。

### 验证

```bash
git diff --check
```

## 5. Phase 1：导出保真二期

### 目标

HTML / PDF / PNG / DOCX 都尽量接近 Prism 预览，重点覆盖中文、表格、代码块、Mermaid、KaTeX、SVG、本地图片、Callout、Toggle、图片链接和分页。

### 技术路线

- 建立或深化统一 `ExportRenderContract`。
- 所有格式共享同一套 Markdown 解析、主题 token、图片解析、Mermaid hydration、KaTeX 渲染、Callout / Toggle 标准化结果。
- `HTML` 作为最接近预览的标准输出。
- `PDF` 优先使用 macOS WebKit 矢量 PDF capture。
- `PNG` 使用高清 tile/stitch 策略，不自动降清晰度。
- `DOCX` 对基础 Markdown 做结构化映射，对复杂视觉块做图片化保真。

### 主要文件

- `src/domains/export/exportService.ts`
- `src/domains/export/exportPipeline.ts`
- `src/domains/export/adapters/html.ts`
- `src/domains/export/adapters/pdf.ts`
- `src/domains/export/adapters/png.ts`
- `src/domains/export/adapters/docx.ts`
- `src/domains/export/render/**`
- `src/domains/export/pagination.ts`
- `src/domains/export/diagnostics.ts`

### if-else

- 如果导出 HTML：保留语义结构、主题 CSS、图片链接、Callout、Toggle、KaTeX、Mermaid 结果。
- 如果导出 PDF：优先 WebKit 矢量链路；如果 WebKit 初始化失败，显示可理解失败诊断，不静默转成糊图。
- 如果导出 PNG：使用用户选择的清晰度；如果画布超过浏览器上限，改用分块渲染拼接；如果分块仍失败，提示用户降低清晰度或分段导出，不自动降级。
- 如果导出 DOCX 且内容是普通 Markdown：映射 heading、paragraph、blockquote、table、code、task list、image、link。
- 如果导出 DOCX 且内容是 Mermaid：PNG-first，高分辨率嵌入；SVG 只作为 fallback 或内部保留。
- 如果导出 DOCX 且内容是普通 SVG 图片：可保留 SVG + PNG fallback。
- 如果图片包裹链接：HTML 保留 `<a><img /></a>`；PDF 写 link annotation；DOCX 写 hyperlink relationship。
- 如果 block 是 Mermaid、图片、大表格、代码块：默认避免分页切断。
- 如果单个 block 高于一页：允许整块缩放到页宽或页高，但不把一张图截成两页。
- 如果导出预计耗时较长：开始前提示“高清导出可能较慢，可切到后台继续编辑”；不因耗时自动降低清晰度。
- 如果导出失败：诊断必须包含格式、阶段、源文件、输出路径、主题、清晰度、错误原因、下一步建议。

### 验证

```bash
npm test -- --run src/domains/export
npm run build
git diff --check
npm run tauri:build:app-smoke
```

## 6. Phase 2：真实 app smoke 扩展

### 目标

把真实 app smoke 从“能打开和基础编辑”扩展成“能证明核心链路没有坏”。

### 技术路线

- 扩展 `scripts/run-app-smoke.mjs`。
- 固定 smoke workspace 和 fixture。
- 每个 smoke 输出截图、产物路径、JSON report。
- 用文件产物检查、截图差异、bundle 检查代替纯人工判断。

### 必测链路

- 启动打开 Markdown。
- 编辑、保存、重新打开。
- `Cmd+P` 快速打开。
- 四格式导出入口与产物生成。
- 主题切换 / 主题导入基本链路。
- Finder 双击打开文件后文件树同步。
- 后台导出状态显示且前台可继续输入。
- Markdown 链接、`[[ ]]`、反链条目点击跳转。
- 关系图谱打开、搜索、点击节点跳转。

### if-else

- 如果 Computer Use 可用：补真实点击、截图、视觉检查。
- 如果 Computer Use 不可用：使用 `npm run tauri:build:app-smoke` 作为 fallback，并记录原因。
- 如果 DOCX 不能自动用 Word / Pages 打开：检查 docx zip 内 `word/document.xml`、`word/media/*`、`word/_rels/document.xml.rels`。
- 如果 PDF 视觉难自动判断：转 PNG 后检查非空、文字像素、分页块是否断裂。
- 如果 smoke 中某一步失败：先判断是否本 checkpoint 引入；相关失败必须修，无关历史失败记录归因。

### 验证

```bash
npm run tauri:build:app-smoke
git diff --check
```

## 7. Phase 3：大文档性能专项

### 目标

10 万字中文长文、几十张图片、多个 Mermaid / KaTeX 场景下，编辑器输入优先流畅，预览可以稍延迟但不能卡死前台。

### 技术路线

- Markdown -> HTML 生成按文档大小分层。
- 小文档继续轻量 debounce。
- 中大文档使用 worker 或 isolated render queue。
- Mermaid 分批 hydrate，缓存 `contentHash + theme + scale`。
- 预览 source-line mapping 保持稳定。
- CodeMirror 设置继续使用 Compartment 更新，不重建 EditorView。
- 大依赖保持 lazy chunk：Mermaid、relation graph、export pipeline、DOCX、PDF。

### if-else

- 如果文档小于 30KB：主线程 debounce 渲染，保证即时感。
- 如果文档 30KB 到 300KB：worker 渲染，150-250ms debounce。
- 如果文档超过 300KB：预览降频，显示轻量“预览更新中”状态。
- 如果 Mermaid 数量超过 10：队列分批渲染，每批让出一帧。
- 如果用户持续输入：编辑器优先，预览延迟合并。
- 如果用户切到 preview-only：立即补齐最终渲染。
- 如果 worker 失败：回退主线程渲染并给出诊断，不让预览永久空白。

### 验证

```bash
npm test -- --run src/lib/markdownToHtml.test.ts src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/SplitView.test.tsx
npm run build
npm exec vite build -- --sourcemap
git diff --check
```

## 8. Phase 4：文件安全与 Finder 打开同步

### 目标

用户从 Finder 双击文件、保存、外部修改、冲突处理、恢复快照时，Prism 状态可信，不丢稿、不迷路。

### 技术路线

- `document` domain 负责 dirty / saving / saved / failed / conflict / recovery。
- `workspace` domain 负责文件树、recent files、当前 workspace、Finder 打开同步。
- Tauri command 继续按能力拆分：`startup_files.rs`、`file_scope.rs`、`trash.rs`。
- 保存前比较 `mtime + size`。
- Finder / OS 打开文件事件统一走 startup file adapter。

### if-else

- 如果 Finder 打开的文件在当前 workspace 内：打开文件并选中文件树节点。
- 如果 Finder 打开的文件不在当前 workspace 内：使用文件父目录作为临时 workspace，或提示是否切换工作区。
- 如果当前文档 dirty 且要打开新文件：先提示保存、另存为、放弃。
- 如果磁盘文件变化且本地 dirty：进入 conflict，默认推荐“保留我的版本并另存为”。
- 如果磁盘文件变化但本地不 dirty：提示重新加载或自动刷新，具体按设置策略。
- 如果保存失败：保持 dirty，写 recovery，状态进入 failed。
- 如果恢复快照存在：启动时展示恢复入口；恢复后文档仍为 dirty，用户确认保存才写回原文件。
- 如果删除文件：优先系统废纸篓；失败后才二次确认永久删除。

### 验证

```bash
npm test -- --run src/domains/document src/domains/workspace
npm run build
git diff --check
npm run tauri:build:app-smoke
```

## 9. Phase 5：工作区索引、搜索、链接、反链

### 目标

`Cmd+P`、全文搜索、`[[ ]]`、反链、关系图谱共用同一套 workspace index，避免功能各扫各的、结果不一致。

### 技术路线

- 建立 `workspaceIndex` module。
- 索引 Markdown 文件路径、标题、front matter、outlinks、backlinks、mtime。
- `Cmd+P` 只做快速打开，不平铺所有命令。
- `Cmd+Shift+F` 做全文搜索。
- `[[` 补全使用 index。
- 关系图谱只显示当前文档 1-2 跳。

### if-else

- 如果无 workspace：索引当前文档所在目录。
- 如果文件数量较少：同步扫描即可。
- 如果文件数量较多：分批扫描并显示索引状态。
- 如果文件改动：优先增量刷新；失败则全量重建。
- 如果同名文档多个：展示相对路径。
- 如果链接目标不存在：进入 `ERROR n` 诊断，不自动创建。
- 如果用户点击链接：相对路径优先；绝对路径必须在授权范围内。
- 如果关系图节点过多：默认当前文档 1 跳，用户手动扩展到 2 跳。

### 验证

```bash
npm test -- --run src/domains/workspace src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts
npm run build
git diff --check
npm run tauri:build:app-smoke
```

## 10. Phase 6：DOCX / 图片 / HTML 富内容增强

### 目标

Word / WPS / Pages 打开后，正文、链接、图片、Mermaid、KaTeX、Callout、Toggle、行内 HTML 尽量不丢信息。

### if-else

- 如果是 `<mark>`：DOCX 映射 highlight。
- 如果是 `<kbd>`：映射为等宽 run + 灰底/边框；不支持时退成等宽文本。
- 如果是 `<abbr title>`：正文显示缩写，title 可做脚注或忽略，但不能丢正文。
- 如果是 `<details>`：DOCX 不支持交互折叠，导出为 summary 标题 + 展开内容。
- 如果是 Callout：映射为浅色块引用。
- 如果是复杂 HTML：优先结构化；结构化失败则截图嵌入。
- 如果是 Mermaid：PNG-first。
- 如果是 KaTeX：能结构化则结构化；否则高分辨率图片化。
- 如果图片有链接：写 hyperlink relationship。

### 验证

```bash
npm test -- --run src/domains/export/adapters/docx.ts src/domains/export/exportPipeline.test.ts
npm run build
git diff --check
```

## 11. Phase 7：主题、模板、中文写作检查

### 目标

做体验增强，不做平台扩张。

### if-else

- 如果导入主题 id 是内置主题：直接失败，不允许覆盖。
- 如果导入主题 id 与用户主题重复：确认后替换；失败保留旧主题。
- 如果用户手动删坏主题文件：设置主题时快速检查，失败则菜单移除、设置中心标异常。
- 如果导入成功：不自动应用；提供“导入”和“导入并应用主题”两个动作。
- 如果模板插入空文档：作为整篇模板。
- 如果模板插入已有文档：插入到光标处。
- 如果中文写作检查开启：只提示，不静默修改正文。
- 如果检查项很多：折叠分组，不塞满状态栏，只通过 `ERROR n` 或诊断面板进入。

### 验证

```bash
npm test -- --run src/domains/themes src/domains/editor/extensions/templates.test.ts src/domains/editor/extensions/typographyDiagnostics.test.ts
npm run build
git diff --check
```

## 12. Phase 8：发布可信链路

### 目标

正式发布前补齐 macOS / Windows 安装、更新、签名、公证、文件关联和版本一致性。

### if-else

- 如果没有 Apple Developer ID：只能发 dev / nightly，不标 stable。
- 如果 notarization 失败：release 阻塞，记录错误日志。
- 如果 updater manifest 缺 signature：检查更新入口给明确错误，不崩溃。
- 如果 Windows installer 未验证：不标 Windows stable。
- 如果 DMG Finder 美化失败：允许 fallback DMG，但 release note 说明限制。
- 如果版本号不一致：发布前阻塞。

### 验证

```bash
npm test -- --run
npm run build
npm run tauri:build
npm run release:manifest:check
git diff --check
```

## 13. 统一验证分层

- 文档改动：`git diff --check`。
- TS/React 小改：相关测试 + `npm run build` + `git diff --check`。
- 编辑器、导出、命令系统、工作区：相关测试 + `npm test -- --run` + `npm run build` + `git diff --check`。
- 文件系统、Tauri、Rust command、真实 app 路径：补 `cargo check` 或 `cargo test`，并跑 `npm run tauri:build:app-smoke`。
- 发布、签名、公证、updater、安装器：必须跑发布级构建和人工验证。

## 14. 完成标准

每个 checkpoint 必须满足：

- 功能真实可用。
- 妙言风格不被破坏。
- 编辑、保存、预览、导出、文件树不回退。
- 有自动测试或真实 app smoke 证据。
- 更新必要验证文档。
- 可提交时单独 commit，不混入无关脏改。

整个计划完成时必须满足：

- Phase 0 到 Phase 8 全部完成或明确记录外部阻塞。
- 最终 `npm test -- --run`、`npm run build`、`git diff --check`、`npm run tauri:build:app-smoke` 通过。
- 本地 Prism.app 已重启。
- 所有可提交改动已 commit 并 push 到 `origin/main`。
