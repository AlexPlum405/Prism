# Prism 能力地图（Capability Map）

> 用途：**内部决策**。回答“用户能完成什么任务、成熟到什么程度、证据在哪、下一步该建/该留/该缓/该停”。  
> 不是功能宣传页，也不是命令目录。命令、设置、格式由代码自动生成在附录。  
> 基线：v1.0.0 / `7adcc2fb`。最近重构：2026-11-19。

## 0. 怎么读这份文档

这份文档分三层，解决的问题不同：

| 层 | 内容 | 维护方式 | 用途 |
| --- | --- | --- | --- |
| 能力地图 | 60–80 项用户任务能力 | 人工维护 | 判断现状、优先级、取舍 |
| 证据 | 测试、发布记录、已知限制 | 人工补链接 | 判断“是否真的可用” |
| 自动附录 | 命令、设置项、文件/导出格式 | `npm run capabilities:sync` | 防止清单腐烂 |

**状态定义：**

| 状态 | 含义 | 进入条件 |
| --- | --- | --- |
| Stable | 可日常依赖 | 有测试、有真机验证、无已知阻塞 |
| Beta | 可用但仍在收敛 | 有测试，但边界或平台验证不完整 |
| Limited | 能力存在但受条件限制 | 依赖外部工具、平台或特定配置 |
| Not supported | 当前明确不做或未实现 | 产品边界或路线图未排期 |
| Retired | 已移除 | 保留历史，不直接删除行 |

**决策定义：**

- `Keep`：保留现状，不再扩投入。
- `Build`：下一阶段投入。
- `Defer`：有价值，但当前不做。
- `Stop`：停止扩张，逐步收敛或移除。

## 1. 核心判断

Prism 的竞争点不是“功能数量”，而是这条闭环：

**打开本地文稿 → 保持写作心流 → 看见可信结果 → 导出可交付文件。**

因此能力分层如下：

| 层级 | 目标 | 代表能力 |
| --- | --- | --- |
| P0 核心闭环 | 不断稿、不打扰、能交付 | 打开/保存、源码编辑、自动保存、预览、诊断、四种导出 |
| P1 写作增强 | 长文更顺手 | 斜杠菜单、模板、表格、块操作、工作区导航、反链/图谱 |
| P2 差异化 | 别人替代不了 | 单窗混合编辑、导出书签、预览/导出一致性、诊断可信 |
| 暂不做 | 与定位冲突或维护成本过高 | 完整 WYSIWYG、AI、插件市场、云同步、协作、移动端 |

## 2. 能力地图

### A. 开始、保存与恢复

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-FILE-01 | 快速开始一篇文稿 | 新建、新建窗口、默认新窗口 | Stable | `fileCommands.test.ts` | Keep |
| CAP-FILE-02 | 打开本地文件或文件夹 | 文件/文件夹打开，文件夹作为工作区 | Stable | `fileCommands.test.ts` | Keep |
| CAP-FILE-03 | 不丢稿地保存 | 保存、另存为、关闭前处理、自动保存 | Stable | `useAutoSave.test.tsx`、`fileSafety.test.ts` | Keep |
| CAP-FILE-04 | 回到刚才的工作 | 最近文件、会话恢复（文件/文件夹/视图/滚动） | Stable | `recentFiles.test.ts` | Keep |
| CAP-FILE-05 | 从系统直接打开 | 文件关联、启动文件、`file-opened` 事件 | Limited | `startupFiles.ts`、macOS 包配置 | Keep |
| CAP-FILE-06 | 处理文件位置 | 访达显示、复制路径、文件属性、打印 | Stable | `fileCommands.test.ts` | Keep |
| CAP-FILE-07 | 处理保存冲突 | 磁盘冲突检测、外部变更监控、冲突弹窗 | Stable | `conflictResolution.test.ts` | Keep |
| CAP-FILE-08 | 异常后恢复 | 恢复快照、恢复弹窗 | Stable | `recovery.test.ts` | Keep |
| CAP-FILE-09 | 从其他格式迁入 | 文件级导入：网页（.html/.htm/.xhtml）、Word（.docx）、Markdown、纯文本 → 新建 `.md`；内嵌图片落到同级 `assets/` 并改写相对路径；同名文件自动加序号 | Stable | `docxImport.test.ts`、`htmlImport.test.ts`、`importDocumentFlow.test.ts` | Keep |

### B. 写作与编辑

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-WRITE-01 | 直接写 Markdown | CodeMirror 6 源码编辑、撤销/重做、剪贴板 | Stable | `EditorPane.integration.test.tsx` | Keep |
| CAP-WRITE-02 | 找到并替换内容 | 文档内查找/替换、工作区全文搜索 | Stable | `search.test.ts`、`CommandPalette.test.tsx` | Keep |
| CAP-WRITE-03 | 快速排版 | 行内格式、标题、段落、清除格式、自动排版 | Stable | `formatting.test.ts` | Keep |
| CAP-WRITE-04 | 插入结构化内容 | 列表、引用、代码、公式、脚注、目录、YAML | Stable | `editorCommands.test.ts` | Keep |
| CAP-WRITE-05 | 编辑表格 | 插入、增删行列、对齐、移动、排序、四种复制 | Stable | `tables.test.ts` | Keep |
| CAP-WRITE-06 | 写提示块/折叠块 | Callout、Toggle | Stable | `callouts.test.ts` | Keep |
| CAP-WRITE-07 | 调整段落/章节 | 段落与章节上下移、复制、删除、折叠 | Stable | `blockOperations.test.ts` | Keep |
| CAP-WRITE-08 | 不记语法也能写 | 斜杠菜单、10 种模板、`[[` 链接补全 | Stable | `slashMenu.test.ts` | Keep |
| CAP-WRITE-09 | 选中后快速操作 | 选区浮动工具栏、表格浮动工具栏 | Stable | `SelectionFloatingToolbar.test.tsx` | Keep |
| CAP-WRITE-10 | 快速插图 | 粘贴/拖拽入库到 `assets/<doc>/` | Beta | `imagePaste.test.ts` | Keep |
| CAP-WRITE-11 | 控制图片大小 | `{width=320}` / `{width=40%}` 属性；预览/PDF/PNG 一致，DOCX 按版心折算；缩放手柄待补 | Beta | `imageSize.test.ts`、`docxImage.test.ts` | Keep |
| CAP-WRITE-12 | 单窗所见即所得 | 视图「单窗」：标题按级别放大、粗/斜/删除线真实生效、行内代码带底色、引用带竖线、列表换圆点、任务列表换真复选框、表格按表头/对齐/斑马纹渲染、图片与分隔线按成品渲染、代码块整块底色；光标所在行（或所在表格）回源码，点表格或用方向键走到表格边界即可进入 | Beta | `wysiwygPreview.test.ts` | Keep |

### C. 视图与写作心流

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-FLOW-01 | 在源码/单窗/分栏/预览间切换 | 四态互斥，`Cmd+1/2/3/4`（⌘4 为单窗） | Stable | `ViewModeSwitch.test.tsx` | Keep |
| CAP-FLOW-02 | 单窗写作不打断 | 单窗模式内即写即见，不再来回切预览；表格显示为真表格，点一下才回源码编辑 | Beta | `wysiwygPreview.test.ts`、`ViewModeSwitch.test.tsx` | Keep |
| CAP-FLOW-03 | 专注写作 | 专注模式 `F8`、打字机模式 `F9` | Stable | `typewriter.test.ts` | Keep |
| CAP-FLOW-04 | 演示文稿 | 基于分隔线的演示叠加层 | Beta | `presentation.test.ts` | Keep |
| CAP-FLOW-05 | 快速定位结构 | 侧栏文件树、大纲、快速打开 | Stable | `FileTree.test.tsx`、`quickOpen.test.ts` | Keep |
| CAP-FLOW-06 | 调整显示 | 自动换行、行号、缩放、DevTools | Stable | `viewCommands.test.ts` | Keep |

### D. 预览与渲染

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-RENDER-01 | 看见标准 Markdown | GFM、表格、任务列表、删除线、高亮、上下标 | Stable | `markdownToHtml.test.ts` | Keep |
| CAP-RENDER-02 | 写公式 | KaTeX 行内/块级 | Stable | `markdownToHtml.test.ts` | Keep |
| CAP-RENDER-03 | 画流程图 | Mermaid | Stable | `markdownToHtml.test.ts` | Keep |
| CAP-RENDER-04 | 画 UML/思维导图 | PlantUML、Markmap | Stable | `plantUml.test.ts`、`markmap.test.ts` | Keep |
| CAP-RENDER-05 | 代码可读 | highlight.js 高亮 | Stable | `codeHighlight.test.ts` | Keep |
| CAP-RENDER-06 | 复制结果 | 富文本复制、图表复制图片/源码 | Beta | `previewClipboardHtml.test.ts` | Keep |
| CAP-RENDER-07 | 从预览回到源码 | Cmd+点击跳行、滚动映射 | Beta | `previewScrollMap.test.ts` | Keep |
| CAP-RENDER-08 | 大文档不卡 | worker 渲染、>300KB 快速路径 | Beta | `markdownRenderService.test.ts` | Keep |
| CAP-RENDER-09 | 预览不执行危险内容 | 剥离 script/iframe/style、危险 URL | Stable | `markdownToHtml.test.ts` | Keep |

### E. 检查与可靠性

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-TRUST-01 | 知道文稿哪里有问题 | 文档诊断面板，按类别分组、点击跳行 | Stable | `DocumentDiagnosticsPanel.test.tsx` | Keep |
| CAP-TRUST-02 | 找出断链/坏图 | 链接、图片诊断，磁盘复核避免误报 | Stable | `linkDiagnostics.test.ts` | Keep |
| CAP-TRUST-03 | 找出标题/表格/渲染问题 | 标题锚点、表格、渲染诊断 | Beta | `diagnostics/adapters.test.ts` | Keep |
| CAP-TRUST-04 | 改善中文排版 | 排版建议（`info` 级） | Beta | `typographyDiagnostics.test.ts` | Keep |
| CAP-TRUST-05 | 导出前知道风险 | 导出预检、失败诊断 | Stable | `preflight.test.ts`、`diagnostics.test.ts` | Keep |
| CAP-TRUST-06 | 回滚到历史版本 | 无版本历史，只有恢复快照 | Not supported | `GLOSSARY.md` | Defer |

### F. 导出与交付

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-EXPORT-01 | 导出网页 | HTML，含主题 | Stable | `goldenSampleFidelity.test.ts` | Keep |
| CAP-EXPORT-02 | 导出 PDF | A4/Letter、页边距、页码、页眉页脚、链接注释、阅读器书签 | Stable | `exportPipeline.test.ts`、`pdfBookmarks.test.ts` | Keep |
| CAP-EXPORT-03 | 导出图片 | PNG，清晰度倍数 | Stable | `pngAssembly.test.ts` | Keep |
| CAP-EXPORT-04 | 导出 Word | DOCX，字体策略 | Beta | `docxDocument.test.ts` | Keep |
| CAP-EXPORT-05 | 套用版式 | 4 种模板、目录、Front Matter 覆盖 | Beta | `templates.test.ts`、`toc.test.ts` | Keep |
| CAP-EXPORT-06 | 快速重复导出 | 按上次设置、覆盖上次 | Stable | `exportCommand.integration.test.ts` | Keep |
| CAP-EXPORT-07 | 后台导出 | 进度、取消、完成/失败反馈 | Stable | `exportJobClient.test.ts` | Keep |
| CAP-EXPORT-08 | 引用文献 | Pandoc + bibliography/CSL | Limited | `pandocCitation.test.ts` | Keep |
| CAP-EXPORT-09 | PDF 阅读器书签 | 导出时按标题生成 /Outlines，页内跳转；中文标题按 UTF-16BE 写入 | Stable | `pdfBookmarks.test.ts`、`exportPipeline.test.ts` | Keep |

### G. 工作区与知识

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-NAV-01 | 浏览工作区 | 文件树（当前层级/递归）、右键菜单 | Stable | `FileTree.test.tsx` | Keep |
| CAP-NAV-02 | 快速找文件 | `Cmd+P` 快速打开 | Stable | `quickOpen.test.ts` | Keep |
| CAP-NAV-03 | 全文搜索 | `Cmd+Shift+F` | Stable | `workspaceIndexQuery.test.ts` | Keep |
| CAP-NAV-04 | 文档之间跳转 | `[[` 页面链接、出链面板 | Stable | `documentLinks.test.ts` | Keep |
| CAP-NAV-05 | 找到谁引用了我 | 反链面板 | Stable | `backlinks.test.ts` | Keep |
| CAP-NAV-06 | 看关系图 | 轻量关系图谱，1–2 跳 | Beta | `relationGraph.test.ts` | Keep |
| CAP-NAV-07 | 管理文档元数据 | Front Matter 属性面板 | Beta | `frontMatterProperties.test.ts` | Keep |
| CAP-NAV-08 | 重型知识图谱 | 标签宇宙图、块节点、3D、常驻右栏 | Not supported | `GLOSSARY.md` | Stop |

### H. 外观与个性化

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-THEME-01 | 换写作风格 | 6 个内置内容主题 | Stable | `themeContract.test.ts` | Keep |
| CAP-THEME-02 | 换界面外观 | 5 个 UI 主题 + light/dark/auto | Stable | `SettingsModal.test.tsx` | Keep |
| CAP-THEME-03 | 安装自己的主题 | 用户主题包（manifest + CSS + 字体） | Beta | `themeInstaller.test.ts` | Keep |
| CAP-THEME-04 | 调字体与字号 | 内置/系统/自定义字体、字号、行高 | Stable | `fontService.test.ts` | Keep |
| CAP-THEME-05 | 不改主题包也能微调 | 设置内正文行宽与强调色；完整 CSS 入口仍暂缓 | Beta | `normalize.test.ts`、`SettingsModal.test.tsx` | Keep |
| CAP-THEME-06 | 界面风格一致 | 设计令牌四层治理 | Stable | ADR-0002/0008 | Keep |
| CAP-THEME-07 | 按需查看写作统计 | 视图菜单「写作统计」：字数、中英文、段落、句子、阅读时间 | Beta | `DocumentStatisticsPanel.test.tsx`、`writingStats.test.ts` | Keep |

### I. 系统、语言与设置

| ID | 用户任务 | 当前能力 | 状态 | 证据 | 决策 |
| --- | --- | --- | --- | --- | --- |
| CAP-SYS-01 | 用母语操作 | 中文/英文/日文，跟随系统 | Stable | `i18n.test.ts` | Keep |
| CAP-SYS-02 | 用系统菜单和快捷键 | macOS 原生菜单、Win/Linux 自绘菜单、快捷键面板 | Stable | `appMenuLabels.test.ts` | Keep |
| CAP-SYS-03 | 调整偏好 | 设置 6 分区 | Stable | `SettingsModal.test.tsx` | Keep |
| CAP-SYS-04 | 获得帮助/更新 | 关于、Markdown 参考、迁移指南、GitHub、反馈、检查更新 | Limited | `updateService.test.ts` | Keep |
| CAP-SYS-05 | 在目标平台使用 | macOS 正式；Windows/Linux 待真机验证 | Limited | `README.md` | Keep |
| CAP-SYS-06 | 数据留在本地 | 本地文件、无账号、无云同步 | Stable | `GLOSSARY.md` | Keep |

## 3. 明确不做 / 暂不做

| 边界 | 当前结论 | 原因 | 如果要做，前置条件 |
| --- | --- | --- | --- |
| 换 ProseMirror 的双引擎 WYSIWYG | 暂不做 | 会出现第二套文档模型，撤销/搜索/诊断/导出要各写一遍；现有单窗层已覆盖写作需要 | 单窗层在长文档上出现性能或保真瓶颈 |
| 自定义 CSS 入口 | 暂缓 | 已有主题包与行宽/强调色控件；完整 CSS 的支持与安全成本高 | 先验证令牌控件的使用率 |
| 版本历史 | 不做 | 与恢复快照定位不同，成本高 | 用户明确需要回滚工作流 |
| AI / 插件 / 云同步 / 协作 / 移动端 | 不做 | 与本地优先写作器定位冲突 | 产品定位改变 |

## 4. 自动附录

<!-- CAPABILITIES:APPENDIX:START -->
> 本节由 `npm run capabilities:sync` 从代码生成，**不要手改**。`npm run capabilities:check` 会校验是否过期。

### A. 命令（157）

```text
new, newWindow, open, importDocument, openFolder, quickOpen, save, saveAs, openDocumentProperties, showDocumentLinks, showBacklinks, showRelationGraph, showDocumentDiagnostics, showDocumentStatistics, templateReadme, templatePrd, templateMeeting, templateWeekly, templateTechnicalPlan, templateArticle, templatePaperDraft, templateReadingNote, templateResearchSummary, templateWhitePaper, print, openCurrentLocation, copyCurrentFilePath, fileProperties, closeDocument, exportHtml, exportPdf, exportDocx, exportPng, exportWithPrevious, exportOverwritePrevious, exportSettings, undo, redo, cut, copy, paste, pastePlain, selectAll, showSearch, workspaceSearch, showReplace, copyPlain, copyMd, copyHtml, link, insertImage, insertCallout, insertToggle, codeBlock, mathBlock, quote, orderedList, unorderedList, taskList, insertTable, formatTable, addTableRow, addTableColumn, deleteTableRow, deleteTableColumn, alignTableColumnLeft, alignTableColumnCenter, alignTableColumnRight, insertTableRowAbove, insertTableRowBelow, insertTableColumnLeft, insertTableColumnRight, moveTableRowUp, moveTableRowDown, moveTableColumnLeft, moveTableColumnRight, selectTable, copyTableMarkdown, copyTableHtml, copyTableCsv, copyTableTsv, sortTableAsc, sortTableDesc, convertTableToHtml, convertHtmlTableToMarkdown, hr, footnote, linkReference, toc, yaml, bold, italic, underline, strikethrough, inlineCode, paragraph, h1, h2, h3, h4, h5, h6, increaseHeading, decreaseHeading, clearFormat, autoFormat, moveParagraphUp, moveParagraphDown, duplicateParagraph, deleteParagraph, moveSectionUp, moveSectionDown, duplicateSection, foldCurrentHeading, selectionQuote, selectionCallout, selectionCalloutNote, selectionCalloutWarning, selectionCalloutTip, selectionCalloutImportant, selectionUnorderedList, selectionOrderedList, selectionTaskList, sourceMode, splitMode, previewMode, presentationMode, toggleSidebar, showFiles, showDocs, showOutline, focusMode, typewriterMode, wordWrap, wysiwygMode, statusBar, actualSize, zoomIn, zoomOut, devTools, themeMiaoyan, themeInkstone, themeSlate, themeMono, themeNocturne, themeCarbon, minimize, fullscreen, alwaysOnTop, preferences, mdReference, migrationGuide, showShortcuts, checkUpdate, github, feedback, about
```

### B. 设置项（32 个顶层键 + 16 个导出键）

顶层：`settingsVersion`、`locale`、`theme`、`uiTheme`、`contentTheme`、`fontSize`、`editorFontFamily`、`editorLineHeight`、`previewFontFamily`、`previewFontSize`、`previewLineWidth`、`previewAccent`、`defaultViewMode`、`exportDefaults`、`shortcutStyle`、`autoSaveEnabled`、`autoSaveInterval`、`autoSaveStrategy`、`showLineNumbers`、`wordWrap`、`previewChartCopyDefault`、`customFonts`、`editorFontSource`、`previewFontSource`、`recentFiles`、`recentFilesLimit`、`exportHistory`、`pandoc`、`citation`、`restoreLastSession`、`lastSession`、`windowState`

导出：`format`、`pngScale`、`htmlIncludeTheme`、`pdfPaper`、`pdfMargin`、`pdfPageNumbers`、`pageHeaderFooter`、`pageHeaderText`、`pageFooterText`、`templateId`、`frontMatterOverrides`、`toc`、`defaultLocation`、`customDirectory`、`docxFontPolicy`、`docxCustomFontId`

### C. 文件与导出格式

Markdown 扩展名：`md`、`markdown`

Text 扩展名：`txt`、`text`、`sql`、`json`、`jsonc`、`yaml`、`yml`、`toml`、`xml`、`csv`、`tsv`、`log`、`ini`、`conf`、`env`

导出格式：`html`、`pdf`、`docx`、`png`

导入 → Markdown（网页）：`html`、`htm`、`xhtml`

导入 → Markdown（Word）：`docx`

可直接导入（原文保留）：`md`、`markdown`、`mdown`、`mkd`、`txt`、`text`、`csv`、`tsv`、`log`、`json`、`yaml`、`yml`

<!-- CAPABILITIES:APPENDIX:END -->

## 5. 维护规则

1. **能力地图只增不滥**：稳定在 60–80 项；同类能力合并，不把命令当能力。
2. **状态必须有证据**：标 `Stable` 必须能指向测试或发布验证；没有证据只能标 `Beta` / `Limited`。
3. **命令/设置/格式不手写**：改完代码运行 `npm run capabilities:sync`；CI 运行 `npm run capabilities:check`。
4. **每个功能变更同一 PR 更新本文档**：修改对应 `CAP-*` 行、决策与变更记录；未同步视为未完成。
5. **产品边界变化同步 `GLOSSARY.md` 或新增 ADR**。

## 6. 变更记录

| 日期 | 提交/PR | 变更 |
| --- | --- | --- |
| 2026-11-18 | 基线 `7adcc2fb` | 初版能力清单，按实现分类，含 154 个 CommandId 附录 |
| 2026-11-19 | 本次重构 | 改为“用户任务能力地图 + 证据 + 自动附录”；收敛为 72 项能力；新增 Keep/Build/Defer/Stop 决策；命令/设置/格式改为脚本生成 |
| 2026-11-19 | 写作心流第一批 | 图片尺寸属性、单窗预览、写作统计浮层、外观行宽/强调色落地；`CAP-WRITE-11/12`、`CAP-THEME-05/07` 同步 |
| 2026-11-19 | 真机验收修复 | 导入来源改走独立的只读授权（`grant_import_file_scope`，白名单含 html/docx），不再复用只认 Markdown/Text 的打开授权；`saveSettings` 白名单补入 `livePreview`、`previewLineWidth`、`previewAccent`，单窗预览与外观控件不再重启丢失 |
| 2026-11-19 | 文件级导入 | `CAP-FILE-09` 从 Not supported 转为 Stable：新增「导入为 Markdown」（网页/Word/纯文本 → `.md`），图片拆到 `assets/`；合并原 `CAP-FILE-10`，从不做清单移除 |
| 2026-11-19 | PDF 书签 | `CAP-EXPORT-09` 从 Not supported 转为 Stable：按标题写 /Outlines，原生捕获与光栅化两条通路共用分页参数；`CAP-EXPORT-02` 补书签能力与测试锚点 |
| 2026-11-20 | 外观收敛 + 侧栏图标 | 启动窗口默认 1440×1000 → 1240×840，并按显示器可用区再收窄 12%（`window_fit`），从 Finder 打开的文档窗口同样生效；侧栏页脚图标改为按渲染尺寸画网格（16 单位画布 / 1px 线 / 整数坐标），灰边像素由 34% 降到 0；视图切换图标换成「导轨 + 三级缩进」，与平铺态共用墨迹框 |
| 2026-11-23 | 标题栏单行化 | 妙言外壳撤销独立菜单栏，文件/编辑/插入/格式/导航/视图/导出/窗口/帮助 回到标题栏，与红绿灯、文件名同一行；`.app-chrome` 组合头与 `MenuBar` 组件一并移除，菜单只保留一处实现（`TitleBar.renderInlineMenu`） |
| 2026-11-23 | 单窗所见即所得 | 旧「单窗预览」只是藏标记，读起来仍是源码，判定为无效功能并删除；视图模式新增第四档「单窗」：标题按级别放大、粗体/斜体/删除线真实生效、行内代码带底色、引用带竖线、列表换圆点、图片与分隔线按成品渲染、代码块整块底色，光标所在行回源码；表格按表头/对齐/斑马纹渲染，点击或方向键把光标送进表格后整块回源码（不做成 ProseMirror 双引擎，装饰层可撤销）。编辑器语法树补 GFM，与预览口径一致 |
