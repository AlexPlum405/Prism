# Prism 对标差距项技术实现方案（2026-11-18）

> **已被取代**：本文的“五项平均推进”结论不再有效。请以 `docs/plans/prism-writing-flow-three-options-2026-11-19.md` 为准；本文仅保留为早期方案记录。
>
> 目标能力：① 单视图所见即所得；② 图片拖拽入库 + 尺寸调整；③ 更多导入格式和 PDF 书签；④ 轻量自定义 CSS 入口；⑤ 统计维度扩充。  
> 配套文档：`docs/prism-capabilities.md`（能力真源，所有功能落地后必须同步）。  
> 基线提交：`7adcc2fb`。本文只做设计，不包含代码改动。

---

## 1. 方案总览

### 1.1 设计原则

1. **Markdown 源码仍是唯一真源**。所有视觉编辑最终必须落回可读 Markdown，不引入第二份独立文档状态。
2. **预览与导出共用同一渲染管线**。任何新的语法、尺寸、样式或目录语义都必须同时作用于 `PreviewPane` 和 `exportPipeline`，避免“预览好看、导出走样”。
3. **增量交付，不一次性重写编辑器**。先做低风险、高复用项，再做 WYSIWYG。
4. **配置入口统一走设置版本迁移、命令链和三语 i18n**，不允许局部绕过。
5. **不破坏已确认的产品边界**：状态栏只读、命令面板只做快速打开/搜索、不做插件系统/AI/云同步。

### 1.2 推荐实施顺序

用户列出的 5 点按方案编号讨论，但工程上建议按风险与依赖排序：

| 阶段 | 内容 | 理由 |
| --- | --- | --- |
| P0 | 共用底座：settings v2、命令链规范、能力清单同步、测试骨架 | 后续 4 项都会用到 |
| P1 | ④ 自定义 CSS 轻量入口 | 复用现有主题包与安全校验，风险最低 |
| P2 | ⑤ 统计维度扩充 | 纯函数扩展 + 新浮层，不动核心编辑链路 |
| P3 | ② 图片尺寸调整 | 已有拖拽入库链路，只补语法/渲染/交互 |
| P4 | ③ 导入格式 + PDF 书签 | 涉及新 domain 与 pdf-lib 底层对象，边界数据多 |
| P5 | ① 单视图所见即所得 | 风险最高，牵动视图模型、编辑真源和性能基准，最后做 |

### 1.3 共用底座

#### 1.3.1 Settings v2

当前 `CURRENT_SETTINGS_VERSION = 1`。新增字段前一次性升级到 2，避免多次迁移：

```ts
interface SettingsV2Additions {
  pdfBookmarks: boolean;              // 导出 PDF 是否写入书签
  pdfBookmarksOpenLevel: number;      // 默认展开层级，1-3
  customCss: {
    enabled: boolean;
    baseThemeId: string;              // 派生自哪个内置/用户主题
    css: string;                      // 用户原始 CSS
    themeId: string;                  // custom-<hash>
  };
  experimentalLiveMode: boolean;      // P5 前作为实验开关
  imageImport: {
    maxBytes: number;                 // 默认 20MB
    renameConflict: 'suffix' | 'fail';// 默认 suffix
  };
}
```

必须同步修改：

- `src/domains/settings/types.ts`：类型、`DEFAULT_SETTINGS`、`CURRENT_SETTINGS_VERSION`。
- `src/domains/settings/normalize.ts`：v1 → v2 迁移与值域钳制。
- `src/domains/settings/store.ts`：`saveSettings()` 解构白名单，漏写则不持久化。
- `src/components/shell/SettingsModal.tsx`：对应分区 UI。
- `src/domains/i18n/resources.ts`：三语文案。

#### 1.3.2 命令链五处闭环

任何新增入口都要同时改：

1. `src/domains/commands/types.ts`：`CommandId`、`CommandCategory`。
2. `src/domains/commands/categories/*.ts`：定义 `run` / `enabled` / `checked`。
3. `src/domains/commands/menuModel.ts`：菜单结构与 `menuLabelKeys`。
4. `src/domains/i18n/commands.ts`：`Record<CommandId, I18nKey>`。
5. `src/domains/i18n/resources.ts`：zh-CN / en-US / ja-JP 三语。

本方案预计新增命令：

| CommandId | 所属功能 | 菜单位置 |
| --- | --- | --- |
| `liveMode` | ① 单视图所见即所得 | 视图 |
| `showDocumentStatistics` | ⑤ 统计浮层 | 视图 |
| `importDocument` | ③ 导入文件 | 文件 |

图片尺寸调整、PDF 书签、自定义 CSS 保存属于指针交互或设置项，不新增命令；如果后续需要“重置自定义 CSS”，再新增 `resetCustomCss`。

#### 1.3.3 Tauri 分层

- 新增原生调用一律放 `src/platform/tauri/*`，不扩散 Tauri API 直连。
- 外部 HTML / DOCX / 主题 CSS / 图片字节都属于边界数据，先校验再使用。
- 大文件解析、导入转换、PDF 后处理放 `src/lib` 或 worker，不阻塞输入。

#### 1.3.4 能力清单同步

每个功能落地 PR 必须同步 `docs/prism-capabilities.md`：

| 功能 | 需要更新的 CAP ID |
| --- | --- |
| ① 单视图所见即所得 | `CAP-EDIT-020`、`CAP-VIEW-001` |
| ② 图片尺寸 | `CAP-EDIT-018`、`CAP-EDIT-019` |
| ③ 导入 / PDF 书签 | `CAP-FILE-012`、`CAP-EXPORT-011` |
| ④ 自定义 CSS | `CAP-THEME-008` |
| ⑤ 统计 | `CAP-STAT-001`、`CAP-STAT-004` |

---

## 2. 共用渲染契约：所有功能的基础设施

当前 `markdownToHtml` 有 unified 管线和大文档 fast path 两条实现；`PreviewPane` 会做 KaTeX/Mermaid/Markmap 后处理；`exportPipeline` 又用 `export-worker` 独立窗口重新渲染。若 5 项功能各自打补丁，必然出现预览/导出不一致。因此先引入一个轻契约，不重写渲染器。

### 2.1 RenderMetadata

在 `src/lib/markdownRenderCore.ts` 的输出中增加可选元数据：

```ts
interface RenderedDocument {
  html: string;
  blocks: RenderedBlock[];
  diagnostics: RenderDiagnostic[];
}

interface RenderedBlock {
  id: string;                 // 由文档路径 + 起止偏移 hash
  kind: 'heading' | 'paragraph' | 'list' | 'code' | 'table' | 'image' | 'quote' | 'html' | 'other';
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  source: string;
}
```

- 完整管线：从 mdast `position` 生成 `blocks`。
- fast path：在分段渲染时同步生成 block range，不能只输出 HTML。
- 预览 DOM 节点继续保留 `data-source-line`，新增 `data-block-id`、`data-source-start`、`data-source-end`。

用途：

- ① WYSIWYG 的块内编辑与回写；
- ② 图片 resize 定位到源范围；
- ③ PDF 书签获取标题所在页与坐标；
- ⑤ 统计可按块缓存；
- ④ 自定义 CSS 通过 `data-block-id` 做稳定选择器。

### 2.2 RenderOptions

统一预览/导出选项：

```ts
interface RenderOptions {
  purpose: 'preview' | 'export' | 'live';
  themeId?: string;
  enableImageSize?: boolean;
  enableBookmarkAnchors?: boolean;
  collectBlocks?: boolean;
}
```

`markdownRenderService.render(markdown, options)` 与 `exportPipeline` 共用同一函数语义。导出 worker 通过 payload 传同样的 options。

### 2.3 验收

- 同一 Markdown fixture 在 preview / export / live 三种 purpose 下，正文 HTML 语义一致。
- block 元数据可由源码位置反查、由 DOM `data-block-id` 正查。
- 大文档（1MB / 3MB）下元数据生成开销可测，不显著高于现有渲染。

---

# ① 单视图所见即所得模式

## 3. 目标与边界

### 3.1 目标

用户在一个页面里看到接近最终排版效果的文档，点击段落即可编辑，Markdown 标记只在当前编辑块内临时显现或完全隐藏；不需要左右分栏。

### 3.2 非目标

- 不做 Notion 式 block database、拖拽把手、嵌套块树。
- 不把预览整块设为 `contenteditable`。
- 不引入 ProseMirror/Tiptap 作为第二文档模型。
- Text Document 不提供此模式。
- 不承诺“所有 Markdown 语法都在富文本层直接编辑”；代码、图表、公式等复杂块保留源码编辑入口。

## 4. 技术方案

### 4.1 为什么不能直接给预览加 `contenteditable`

当前 `PreviewPane` 每次内容变化都会 `dangerouslySetInnerHTML` 整块覆盖；KaTeX/Mermaid/Markmap 会替换节点；本地图片会换成 blob URL。CodeMirror 的 `view.state.doc` 是唯一可写真源。直接把预览变成可编辑区会产生：

- 编辑被下一次渲染覆盖；
- DOM 无法可靠 diff 回 Markdown；
- 图表/公式节点被改坏；
- 搜索、撤销、诊断、导出全部失去一致性。

因此采用**源码锚定的块内编辑（source-anchored block editing）**。

### 4.2 视图模型

新增第四态 `live`，但保持三态 UI 的连续性：

```ts
type ViewMode = 'edit' | 'split' | 'preview' | 'live';
```

- `ViewModeSwitch` 增加“单视图”按钮，快捷键建议 `Cmd+4`。
- `viewModeForProfile()`：Text Document 强制回到 `edit`。
- `live` 模式下 `SplitView` 只渲染 `LivePreviewPane`，不复用 `PreviewPane` 的整块覆盖策略。
- `lastSession.viewMode` 支持 `live`，旧值无需迁移。

### 4.3 新增模块

```text
src/domains/editor/live/
  LivePreviewPane.tsx          // 渲染后的单视图容器
  BlockEditorOverlay.tsx       // 当前编辑块的 CodeMirror 叠加层
  useLiveEditSession.ts        // 会话状态：activeBlockId、selection、退出条件
  liveCommands.ts              // live 块内命令到 CodeMirror transaction 的映射
  blockNavigation.ts           // 上下块移动、边界退出
```

### 4.4 编辑会话

```ts
interface BlockEditSession {
  blockId: string;
  sourceRange: { from: number; to: number };
  draft: string;
  caretOffset: number;
  startedAt: number;
}
```

行为：

1. 单击渲染块 → 进入编辑会话。
2. 在当前块位置挂载一个轻量 CodeMirror 实例（或复用隐藏主编辑器的 range 视图），内容是该块 Markdown 源码。
3. 用户输入时只更新 session draft，不解析全文。
4. 提交时机：`blur` / `Escape` / `Cmd+Enter` / 切换到其他块。
5. 提交时用主编辑器 `dispatch({ changes: { from, to, insert: draft } })` 写回。
6. 主文档变化后再重渲染该块及受影响块，不整页重排。

关键点：**撤销/重做仍然走主 CodeMirror history**，因此搜索、诊断、自动保存、导出全部自然同步。

### 4.5 富文本交互映射

在 `liveCommands.ts` 中把常用格式命令映射到块内 transaction：

| 用户操作 | 实现 |
| --- | --- |
| Cmd+B / Cmd+I | 对当前块选区执行 `toggleMarkdownWrap` |
| 链接按钮 | 插入 `[text](url)` 或调用现有 link 命令 |
| 标题 | 修改块首 `#` 数量，提交后块类型变化 |
| 任务列表点击 | 复用 `updateTaskCheckboxMarkdown` |
| 表格操作 | 进入表格块源码编辑，复用 `editorTableController` |
| 图片点击 | 选中图片，显示 resize handles；双击进入源码块 |

复杂块（Mermaid/KaTeX/PlantUML/Markmap）默认只读；双击进入源码块编辑，提交后重新执行后处理。

### 4.6 命令可用性

扩展 `CommandContext`：

```ts
interface CommandContext {
  viewMode?: ViewMode;
  liveSession?: BlockEditSession | null;
}
```

在 `isCommandEnabled` 中：

- `sourceMode/splitMode/previewMode/liveMode` 互斥 checked；
- 需要光标的操作（如表格插入）在 `live` 且无 active block 时禁用，并给出“先点击一个段落”的 disabledReason；
- 全局命令（保存、导出、搜索）保持可用。

### 4.7 性能策略

- 输入期间不调用 `markdownToHtml` 全文渲染。
- 提交块后只渲染变更块：`renderMarkdownBlock(source, options)`。
- 后处理按块执行，不重新初始化所有 Mermaid/KaTeX 实例。
- 使用 `performanceInstrumentation.ts` 记录：进入 live 耗时、块提交耗时、DOM commit 耗时。
- 进入 P5 前必须先跑 `CONTEXT.md` 要求的真实 WebView 1MB/3MB 基准。

### 4.8 测试与验收

| 类型 | 用例 |
| --- | --- |
| 单元 | block range 与源码偏移一致；提交后 Markdown 字符串精确匹配 |
| 组件 | 点击块进入编辑；Escape 取消；blur 提交；块间导航 |
| 集成 | live → 编辑 → 预览 → 导出内容一致；撤销/重做跨块正确 |
| 性能 | 3MB 文档进入 live < 可设定阈值；输入路径无全文解析 |
| 真机 | 中文长文、代码块、表格、公式、图表、图片均可编辑或明确降级为源码块 |

主要风险：块边界随 Markdown 语法变化（列表嵌套、表格）容易错。缓解方式是将 block range 生成集中在 `RenderMetadata` 并用 golden fixture 回归。

---

# ② 图片拖拽入库 + 尺寸调整

## 5. 现状与目标

拖拽/粘贴入库已实现：`imagePaste.ts` 写入 `assets/<doc>/`，`editorClipboardRuntime.ts` 插入相对 Markdown 链接，Alt+拖拽保留原路径。缺失的是尺寸语法、渲染、缩放交互、诊断和导出一致性。

## 6. 技术方案

### 6.1 尺寸语法

选择**Markdown link title 命名空间**，不引入 HTML 私有属性：

```md
![封面](assets/article/cover.png "prism:width=640,height=360")
```

规则：

- token 必须以 `prism:` 开头，避免与用户正常 title 冲突。
- `width` / `height` 均为正整数 px，范围 1–8192。
- 只写 width 时按图片原始比例推算 height；只写 height 同理。
- 无法解析的 token 不破坏图片，只产生 `info`/`warning` 诊断。
- 大文档 fast path 与 unified 管线必须同时支持。

不采用 `style="width:..."`：预览安全过滤会剥离可疑 style，导出链路也会处理内联声明。不采用 `{width=...}`：当前 remark/rehype 管线未启用该属性语法，改造面更大。

### 6.2 数据结构

```ts
interface PrismImageSize {
  width?: number;
  height?: number;
  source: 'intrinsic' | 'user';
}

interface PrismImageTarget {
  src: string;
  alt: string;
  title?: string;
  size?: PrismImageSize;
  sourceRange: { from: number; to: number };
}
```

新增 `src/domains/markdown/imageSize.ts`：

- `parseImageSizeToken(title)`；
- `formatImageSizeToken(size)`；
- `resolveImageSize(size, intrinsic)`；
- 供 `markdownToHtml.ts`、`imageDiagnostics.ts`、`docxImage.ts` 共用。

### 6.3 渲染落点

1. `markdownToHtml.ts` 的 unified 管线：rehype 阶段把 size token 转成 `width` / `height` / `data-prism-sized` 属性。
2. `renderCommonMarkdownInline()` 的 fast path：同步输出同样属性。
3. `PreviewPane` / `LivePreviewPane`：通过 `previewDomTargets.ts` 收集带 `data-prism-sized` 的 `<img>`。
4. 导出：HTML/PDF/PNG 自然继承 HTML 属性；DOCX 在 `docx/docxImage.ts: constrainDocxImageSize` 中优先使用用户尺寸，再退回纸张约束。

### 6.4 拖拽入库增强

改造 `handleEditorImageDrop`：

```ts
interface ImageImportRequest {
  files: Array<{ name: string; bytes: Uint8Array; mime: string }>;
  source: 'drop' | 'paste' | 'filePicker';
  altHeld: boolean;
  targetDocumentPath: string;
}
```

新增 `src/domains/editor/assets/imageImportJob.ts`：

- 支持多图批量导入；
- 校验 MIME + 扩展名 + `maxBytes`；
- 冲突按 `image-<ts>-<n>.<ext>` 后缀处理；
- 写盘失败返回可诊断错误，不插入坏链接；
- 插入的 Markdown 通过一次 CodeMirror transaction 完成，保证可撤销；
- Alt+拖拽仍保留原路径，不写 assets。

### 6.5 缩放交互

新增 `src/domains/editor/components/ImageResizeOverlay.tsx`：

- 选中预览/live 中的图片时显示四角手柄；
- pointerdown 记录初始尺寸与鼠标位置；
- pointermove 使用 CSS transform 预览，不写源码；
- pointerup 计算最终 width/height，更新 link title 的 `prism:` token；
- Shift 锁定比例；Escape 取消；双击图片进入源码块；
- 手柄不进入导出 HTML，导出前由 CSS `@media print` 和 `stripEditorOnlyAttributes` 清理。

### 6.6 诊断

扩展 `imageDiagnostics.ts`：

| 诊断 | 级别 |
| --- | --- |
| `prism:` token 数值非法 | warning |
| width/height 超过上限 | warning |
| 尺寸与原始比例偏差 > 30% | info |
| 图片文件不存在 | error（沿用现有） |

### 6.7 测试与验收

- 解析单测：合法/非法 token、只宽/只高、用户 title 共存。
- 渲染快照：小文档管线与 >300KB fast path 输出一致。
- 交互测试：拖拽多图、冲突命名、Alt 引用、撤销。
- 导出测试：HTML/PDF/PNG 属性一致；DOCX 使用用户尺寸。
- 真机：从 Finder 拖入 PNG/JPG/WebP/GIF，本地路径含中文与空格。

主要风险：路径重写与保存后目录变化。缓解：复用现有 `linkRewriteFlow.ts`，导入后立即记录 sourcePath，与“另存为/移动文档”流程共用重写入口。

---

# ③ 更多导入格式和 PDF 书签

## 7. 导入格式

### 7.1 范围

| 优先级 | 格式 | 策略 |
| --- | --- | --- |
| P1 | HTML / HTM | 复用 `htmlToMarkdown.ts`，本地资源迁入 assets |
| P1 | DOCX | 优先 Pandoc adapter；无 Pandoc 时给出可行动诊断 |
| P2 | EPUB | 解压 OPF/HTML，按章节拆分为多个 Markdown |
| P2 | OPML | 转换为标题 + 列表 |
| P3 | PDF 文本导入 | 有损，低优先级；与“PDF 书签导出”无关 |

### 7.2 新增 domain

```text
src/domains/import/
  types.ts
  registry.ts
  adapters/
    htmlAdapter.ts
    docxAdapter.ts
    epubAdapter.ts
    opmlAdapter.ts
  services/
    importedAssetWriter.ts
    importReport.ts
```

```ts
interface ImportAdapter {
  id: 'html' | 'docx' | 'epub' | 'opml';
  extensions: string[];
  labelKey: I18nKey;
  canHandle(path: string, bytes: Uint8Array): Promise<boolean>;
  convert(context: ImportContext): Promise<ImportResult>;
}

interface ImportResult {
  documents: Array<{
    suggestedFileName: string;
    markdown: string;
  }>;
  assets: Array<{ relativePath: string; bytes: Uint8Array }>;
  warnings: ImportWarning[];
  sourcePath: string;
}
```

### 7.3 打开链路

当前 `openDocumentFlow.ts` 假定读到的内容就是 Markdown，并写回原路径。导入必须走独立流程，绝不覆盖源文件：

1. `importDocument` 命令打开导入对话框，使用 `DOCUMENT_FILE_FILTERS` 扩展的 import filters。
2. 读文件字节 → `detectImportAdapter` → `convert`。
3. 写入目标目录：默认源文件同级的 `Imported/<name>/`，避免污染工作区根目录。
4. 写入 assets、生成 `import-report.json`（可选，仅保留警告）。
5. 打开生成的第一个 `.md`，默认新窗口（符合单活动文档窗口决策）。
6. 通过 Toast 显示“导入完成，n 个警告”，点击打开报告。

### 7.4 文件关联

- `fileAssociation.ts` 增加 `IMPORT_FILE_EXTENSIONS` 与 `IMPORT_FILE_FILTERS`。
- `tauri.conf.json` 可为 HTML/DOCX 增加“打开方式”关联，但不设为默认，避免普通文档双击行为突变。
- 启动文件链路中如收到导入格式，走 `handleImportRequest`，不走 `assertSupportedOpenDocumentPath`。

### 7.5 HTML adapter 细节

- 复用 `convertHtmlToMarkdown`，不要另起一套 Turndown。
- 处理 `<base href>` 与相对资源路径：
  - 本地资源 → 写入 `Imported/<name>/assets/`；
  - 远程 http(s) 资源默认保留原 URL，除非设置开启下载；
  - data URL → 解码写入 assets。
- 保留 `<details>`、表格、代码块；危险标签仍按预览安全策略清理。

### 7.6 DOCX adapter 细节

- 通过 `src/platform/tauri/nativeCommands.ts` 调用 Rust pandoc 检测/执行能力。
- Pandoc 参数建议：`-f docx -t gfm+raw_html --extract-media=<assetsDir>`。
- 若 Pandoc 不可用：诊断中写明“需要安装 Pandoc 或改用 HTML 导入”，不静默失败。
- 评估替代方案：轻量 `mammoth` 可做 docx→HTML，但必须做依赖体积与离线可用性评估后再决定是否引入。

## 8. PDF 书签（大纲树）

### 8.1 目标

导出的 PDF 在阅读器中显示标题书签，点击跳转到对应页。它是 PDF reader outline，不是正文里的目录页；两者并存且互不替代。

### 8.2 数据流

```
ExportTocItem (toc.ts)
  → 分页后 heading DOM 收集
  → PdfOutlineItem { title, level, pageIndex, x, y }
  → addPdfOutlines(pdf, items)
  → finalizePdfDocument()
```

新增 `src/domains/export/pdf/pdfOutlines.ts`：

```ts
interface PdfOutlineItem {
  title: string;
  level: number;
  pageIndex: number;      // 0-based
  x: number;
  y: number;              // PDF point, origin top-left after conversion
}
```

### 8.3 坐标与分页

- 复用 `pdfLinks.ts` 的 DOM rect → PDF point 换算。
- 在 `prepareExportAtomicPagination` 之后收集标题位置，确保不与分页切断冲突。
- 目标使用 `/XYZ x y 0`，保持阅读器缩放行为自然。

### 8.4 pdf-lib 底层写入

pdf-lib 没有高层 outline API，沿用现有 `addPdfUriAnnotation` 的 `pdf.context.obj` 范式构造：

- `/Outlines` 根对象；
- `/Outline` 层级链：`Parent` / `First` / `Last` / `Prev` / `Next`；
- `/Dest [pageRef /XYZ x y 0]`；
- 设置到 `pdf.catalog` 的 `/Outlines`。

### 8.5 三条通路统一收口

当前 PDF 有三条路径：

1. WebKit 原生捕获；
2. 光栅化；
3. 降级。

在每条路径末尾统一调用 `finalizePdfDocument(pdf, context)`，内部做：

- overlay chrome（现有）；
- link annotations（现有）；
- outlines（新增）。

不能只在其中一条路径加书签，否则不同环境下结果不一致。

### 8.6 设置与 i18n

- `ExportDefaults.pdfBookmarks`、`pdfBookmarksOpenLevel`。
- `resolveExportOptions` 透传。
- 三语导出设置文案与诊断文案。
- 默认 `pdfBookmarks = true`，但设置中可关闭。

### 8.7 测试与验收

- `toc.ts` → outline item 映射单测。
- 用 `pdf-lib` 重新加载导出结果，断言 outline 数量、标题、层级、目标页。
- 三条 PDF 通路分别跑 golden fixture。
- 真机在 macOS Preview 中检查点击跳转。

主要风险：分页后标题位置错页。缓解：在分页 fixture 中加入跨页标题、H1–H6 跳级、Callout 内标题等边界用例。

---

# ④ 自定义 CSS 轻量入口

## 9. 目标与边界

### 9.1 目标

用户无需手动构造主题包，就能在设置里写少量 CSS，调整预览排版，并且导出结果与预览一致。

### 9.2 非目标

- 不做完整主题市场或可视化主题编辑器。
- 不开放任意 JS、外部字体 URL、`@import`、固定定位覆盖。
- 不修改 `--c-*` 核心令牌与 `--bg-*` 过渡别名。
- 不把 CSS 写进 Markdown 文件，保持内容安全过滤不变。

## 10. 技术方案

### 10.1 核心思路：派生主题包，而不是另起注入通道

现有用户主题包已经具备：

- `themePackage.ts`：manifest + CSS + 字体；
- `themeCss.ts`：作用域、危险声明、url 白名单校验；
- `themeRegistry.ts` / `applyThemeRuntime`：运行时注入；
- 导出 worker 从磁盘扫描用户主题包。

因此轻量入口应**把用户 CSS 编译成一个用户主题包并落盘**，而不是只在当前窗口 `<style>` 注入。否则导出 worker 读不到，预览/导出不一致。

### 10.2 数据流

```text
Settings → Appearance → 自定义 CSS（高级）
  → debounce 400ms
  → scopeCss(rawCss, themeId)
  → validateThemeCss(scopedCss, themeId)
  → buildDerivedThemePackage(baseTheme, scopedCss)
  → installUserTheme(package)
  → setContentTheme(themeId)
  → applyThemeRuntime()
  → 导出 worker 从 themes 目录读取同一主题
```

### 10.3 新增模块

```text
src/domains/themes/
  customCss.ts             // scopeCss / validateCustomCss / line mapping
  derivedTheme.ts          // buildDerivedThemePackage / gcDerivedThemes
```

```ts
interface CustomCssRequest {
  baseThemeId: string;
  css: string;
}

interface CustomCssResult {
  themeId: string;          // custom-<sha256(base + css).slice(0,12)>
  scopedCss: string;
  warnings: string[];
}
```

### 10.4 scopeCss 规则

- `:root` 替换为 `html[data-content-theme="<id>"]`。
- 裸选择器自动加前缀：`html[data-content-theme="<id>"] .markdown-body ...`。
- `@media` / `@supports` 递归处理内部规则。
- `@keyframes` 原样保留。
- 保留原始行号映射，校验错误能报“第 N 行”。

### 10.5 声明白名单

允许：

- CSS 自定义属性：仅 `--theme-*`、`--preview-*` 与主题契约变量；
- 排版相关：`font-*`、`line-height`、`letter-spacing`、`color`、`background*`、`border*`、`padding`、`margin`、`text-*`、`table*`。

拒绝：

- `position: fixed`、`pointer-events`、`z-index`、`display: none` 作用于核心 surface；
- `@import`、`@font-face`、外部 `url()`；
- `expression()`、`javascript:`、`vbscript:`；
- `@page`（v1 不开放打印页面样式，避免与导出分页冲突）。

复用 `themeCss.ts` 的 `validateThemeCss` 与 `validateDangerousDeclarations`，不要重写一套弱校验。

### 10.6 UI

在 `SettingsModal.tsx` 的 Appearance 分区增加折叠区：

- 基础主题下拉；
- CSS 编辑器（纯 textarea，可后续升级为 CodeMirror CSS 模式）；
- “应用”按钮；
- “重置”按钮；
- 校验错误列表，点击定位行；
- 提示“仅影响当前内容主题，源码不会被修改”。

保存策略：点击“应用”才落盘，避免每次输入创建主题；同一 hash 复用现有主题；最多保留最近 5 个派生主题，回收未使用的旧主题。

### 10.7 导出一致性

- 派生主题在 `appData/themes/custom-<hash>/` 下包含 `theme.json` + `theme.css`。
- 导出 worker `initializeThemeRegistry()` 已扫描用户主题目录，因此可读取。
- `collectExportCss()` 收集注入的 stylesheet，CSS 自动进入 HTML/PDF/PNG。
- DOCX 若采用图片化复杂块，同样继承渲染后的视觉效果。

### 10.8 测试与验收

- scope 单测：`@media`、伪类、`:root`、多选择器。
- 安全单测：所有禁止项必须被拒绝并给出中文/英文/日文错误 key。
- 派生主题单测：同输入同 id；不同输入不覆盖旧主题。
- 一致性测试：同一文档在自定义主题下 preview / HTML / PDF / PNG 截图对齐。
- 边界测试：浅色/深色、正文字号 14/20、日文长文案。

主要风险：用户 CSS 与主题契约变量冲突。缓解：只允许主题层令牌，禁止核心层；校验阶段给出替代变量建议。

---

# ⑤ 统计维度扩充

## 11. 目标与边界

### 11.1 目标

提供更完整的写作统计，但不让状态栏重新变成多指标工具栏。

### 11.2 非目标

- 不在标题栏常驻新增按钮或指标。
- 不做写作目标、连续打卡、云端统计。
- 不把统计塞进诊断面板的错误计数。

## 12. 技术方案

### 12.1 领域模型扩展

保持 `wordCount` 不变，向后兼容：

```ts
interface WritingStatsV2 {
  wordCount: number;          // 现有
  chineseChars: number;       // 现有
  englishWords: number;       // 现有
  characters: number;         // 现有
  readingMinutes: number;     // 现有，底层已算
  sentences: number;          // 新增
  paragraphs: number;         // 新增
  nonBlankLines: number;      // 新增
  cjkChars: number;           // 现有 chineseChars 的语义化别名
  nonCjkWords: number;        // 现有 englishWords 的语义化别名
  punctuationCount: number;   // 新增
  readingSeconds: number;     // 新增，更细粒度
}
```

`stripMarkdownNoise()` 继续作为统一清洗入口，统计前先移除代码块、链接 URL、图片语法、HTML 标签等噪音；是否计入代码块可由设置控制，v1 默认不计入。

### 12.2 分句规则

- 中文终止符：`。！？!?；;…`；
- 英文终止符：`.` 后接空白或字符串末尾；
- 排除小数 `3.14`、常见缩写 `e.g.` / `i.e.` / `Mr.`；
- 连续终止符合并计一句；
- 纯标题、列表项仍计入句子，避免长文统计偏低。

### 12.3 性能

- `computeWritingStatsV2()` 保持纯函数。
- 文档 >300KB 时迁移到 `src/lib/writingStats.worker.ts`，复用现有 worker 创建模式。
- 以内容 hash 做 memo，输入防抖 250ms。
- 选区统计复用同一函数，只传选区字符串。

### 12.4 UI 落点

新增：

```text
src/domains/editor/components/DocumentStatisticsPanel.tsx
```

- 轻量浮层，宽度约 360–420px，与 `DocumentDiagnosticsPanel` 视觉一致。
- 菜单：视图 → 文稿统计（`showDocumentStatistics`）。
- 内容分区：
  - 全文：字数、中文字、英文词、句数、段落数、非空行、标点数、预计阅读时间；
  - 选区：同样指标，无选区时显示空态；
  - 说明：统计规则入口，解释是否计入代码块。
- 状态区保持只显示字数；hover tooltip 可增加“详见 视图 → 文稿统计”，不新增按钮。

### 12.5 i18n

新增三语 key，例如：

- `stats.title`
- `stats.wordCount`
- `stats.chineseChars`
- `stats.englishWords`
- `stats.sentences`
- `stats.paragraphs`
- `stats.readingTime`
- `stats.selectionEmpty`
- `stats.methodNote`

三语必须同时补齐，否则不进入发布。

### 12.6 测试与验收

- 纯函数 golden fixture：中英混排、代码块、表格、链接、空行、缩写、小数。
- 选区统计与全文统计一致性。
- 大文档 worker 路径与主线程路径结果一致。
- 面板快照：中/英/日三语无溢出。
- 真机确认状态区没有新增常驻指标。

主要风险：统计口径争议。缓解：在面板内提供“统计规则”说明，并把口径写入 `CONTEXT.md`。

---

## 13. 全量测试与验收矩阵

| 层级 | 命令/方式 | 覆盖 |
| --- | --- | --- |
| 类型 | `npx tsc --noEmit` | 命令链、设置、类型契约 |
| 单元 | `npx vitest run --testTimeout=60000` | 解析、统计、主题校验、PDF outline 对象 |
| 组件 | Testing Library | live 块编辑、resize 手柄、统计浮层、CSS 设置 |
| 集成 | Vitest | preview/export/live 一致性；导入→打开→导出 |
| 导出 golden | `goldenSampleFidelity.test.ts` 扩展 | 尺寸、书签、自定义 CSS |
| 真机 smoke | `npm run macos:build-smoke` | 原生菜单、文件关联、导出、窗口 |
| 性能 | 真实 WebView 1MB/3MB fixture | live 模式、图片 resize、统计 worker |
| 三语 | i18n key 覆盖 + 截图 | 所有新增 UI |

---

## 14. 风险登记

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| WYSIWYG 与 CodeMirror 单真源冲突 | 编辑丢失、撤销错乱 | 所有写回走 CodeMirror transaction；不引入第二文档状态 |
| 大文档渲染与块定位开销 | 输入卡顿 | 块级重渲染、worker、真实 WebView 基准前置 |
| 图片尺寸语法与现有 title 冲突 | 用户内容被误解析 | `prism:` 命名空间；非法 token 只警告不改写 |
| 导入格式边界数据复杂 | 安全/崩溃风险 | 字节校验、非破坏性写盘、适配器隔离、Pandoc 失败可诊断 |
| PDF 三条分页路径不一致 | 书签错页 | 统一 `finalizePdfDocument()`；三条路径 golden 测试 |
| 自定义 CSS 逃逸主题作用域 | 破坏 UI/导出 | 派生用户主题包 + 现有严格校验 + 声明白名单 |
| 状态栏回潮 | 违背已确认决策 | 统计只进菜单浮层；状态区保持不变 |
| 能力文档滞后 | 团队与用户认知不一致 | 每个 PR 强制同步 `docs/prism-capabilities.md` |

---

## 15. 需要新增的 ADR

建议在对应阶段落码前分别新增：

| ADR | 决策 |
| --- | --- |
| ADR-0009 | 单视图采用源码锚定块编辑，不引入 ProseMirror 第二真源 |
| ADR-0010 | 图片尺寸采用 Markdown title 的 `prism:` 命名空间 |
| ADR-0011 | 导入采用分批 adapter registry，非破坏性写入 `Imported/` |
| ADR-0012 | 自定义 CSS 编译为派生用户主题包，禁止跨作用域注入 |
| ADR-0013 | 统计维度进按需浮层，状态区规则不变 |

每个 ADR 必须同步更新 `CONTEXT.md` 术语/决策与 `docs/prism-capabilities.md` 对应 CAP ID。

---

## 16. 完成定义

一项能力只有同时满足以下条件才算完成：

1. 功能在真实 app 中可完成核心动作；
2. preview / export / 设置 / i18n / 命令链全部同步；
3. 相关测试与质量门禁通过；
4. 性能基准无回退；
5. `docs/prism-capabilities.md` 对应 CAP ID 状态已更新并写入变更记录；
6. 如改变产品边界，ADR 与 `CONTEXT.md` 已同步。
