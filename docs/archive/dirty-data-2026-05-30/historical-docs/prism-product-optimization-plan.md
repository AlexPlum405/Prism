# Prism 产品与工程优化方案

> 状态：已完成 / 历史归档
> 归档日期：2026-05-21
> 说明：本文件仅保留历史背景，不再作为后续 active plan 使用。当前待实施计划以 `docs/prism-next-optimization-implementation-plan.md` 为准。

> 生成日期：2026-05-14  
> 用途：作为 Prism 1.0.x 之后产品优化、工程重构、issue 拆分与 Codex `/goal` 长任务执行的本地依据。  
> 当前定位：开源、跨 macOS / Windows、中文长文友好、导出可靠、本地优先的 Markdown 写作器。

## 1. 总体判断

Prism 下一阶段不追求 Obsidian / Logseq 式知识库平台，也不做 Typora 式全量 WYSIWYG。主线定位为：

> 开源、跨 macOS / Windows、中文长文友好、导出可靠、本地优先的 Markdown 写作器。

默认取舍：

- 1.0.x 不做完整 WYSIWYG、云同步、移动端、图谱、插件市场。
- 优先级：文件安全与发布可信 > 写作效率 > 预览同步 > 导出工作台 > 专业扩展 > 插件生态。
- Pandoc 作为可选外部增强，不作为 Prism 启动或基础导出的必需依赖。
- 视觉以当前 app 的妙言风格为主，`docs/prism-openai-redesign.html` 仅作为历史 OpenAI 原型保留，不回退 Win11 Fluent。
- Prism 继续坚持单文档单窗口；文件树是导航入口，不引入标签页。

调研参考：

- Typora 将导出、Pandoc、YAML front matter 导出配置作为核心能力。
- Obsidian 的核心插件覆盖 Backlinks、Canvas、Properties、File recovery、Templates、Sync / Publish。
- Zettlr 强调 Zotero、CSL、Pandoc 多格式导出。
- Tauri 2 已有官方 updater / deep-link 插件。
- CodeMirror 6 官方推荐用 extension / facet / state field 组织编辑能力。

## 2. 产品信任与发布治理

目标：让用户相信 Prism 是一个可以长期写作和交付文档的工具，而不是一次性 demo。

实现细节：

- 统一版本与许可证：`package.json`、README、Tauri config、GitHub Release 全部使用同一版本；README 的 MIT / ISC 冲突必须修正为仓库真实许可证。
- 建立发布检查清单：每次 release 前跑 `npm test`、`npm run build`、`npm run tauri:build`，并检查 README 下载链接、截图、版本号、更新日志。
- 接入 Tauri updater：使用官方 updater plugin，GitHub Release 提供 updater JSON，字段包含 `version`、`notes`、`pub_date`、`url`、`signature`。
- macOS 发布补齐签名与公证：未签名只允许保留在 nightly / dev release；正式版 README 不再让用户长期依赖“右键打开”。
- 增加 issue 模板：`bug_report` 要求系统、Prism 版本、视图模式、主题、最小 Markdown；`export_bug` 要求源文件片段、目标格式、导出设置、实际产物截图。

验收标准：

- README、release、应用内 about、Tauri config 版本一致。
- 正式 release 有可复现构建步骤、更新日志和安装说明。
- 用户能通过应用内更新入口检查新版本。

## 3. 文件安全、自动保存与恢复

目标：防止用户丢稿，优先补齐外部修改、保存失败、冲突处理和恢复能力。

实现细节：

- 扩展文档状态模型：`DocumentState.currentDocument` 增加 `lastKnownMtime`、`lastKnownSize`、`saveStatus: idle | dirty | saving | saved | failed | conflict`、`saveError`。
- 打开文件时记录磁盘 stat：读取内容后调用 Tauri fs stat，保存 `mtime / size`，后续保存前先比较磁盘状态。
- 外部修改检测：应用获得焦点、定时低频检查、保存前检查三处触发；若磁盘文件已变且本地 dirty，进入 conflict 状态。
- 冲突 UI：Toast + modal，提供三个明确动作：`重新加载磁盘版本`、`保留我的版本并另存为`、`覆盖磁盘版本`；默认高亮“另存为”。
- 自动保存策略产品化：设置中心只展示 `关闭 / 平衡 / 高频`，内部映射为 disabled / 2000ms / 500ms；失败时不清 dirty，状态栏显示错误入口。
- 文件恢复：在 appData 下维护 `recovery/` 快照，每个文档按 path hash 保存最近 10 个版本；崩溃或保存失败后在启动时提示恢复。
- 最近文档从 localStorage 迁移到 settings store；localStorage 只做兼容读取，首次加载后写入 settings 并清理旧 key。

验收标准：

- 外部编辑同一文件后，Prism 不会静默覆盖。
- 保存失败不会把文档标记为 saved。
- 崩溃或异常退出后，用户能看到可恢复版本。

## 4. 写作效率工具

目标：补齐 Markdown 高频写作的摩擦点，但不进入复杂 WYSIWYG。

实现细节：

- 图片粘贴：拦截剪贴板图片，默认保存到当前文档旁的 `assets/<document-name>/`，插入相对路径 Markdown；未保存文档则先弹保存对话框。
- 图片拖拽：拖入图片文件时复制到同一 assets 目录；按住 Option / Alt 时只插入原路径链接。
- 链接补全：输入 `](` 后触发工作区文件路径补全；支持 `#heading` 补全当前文档标题。
- 无效链接诊断：新增轻量 Markdown link scanner，检查相对文件、图片、标题锚点；状态栏显示问题数，点击打开问题列表。
- 表格辅助：命令面板增加“插入表格”“格式化当前表格”“添加行/列”“删除行/列”；实现只操作源码 Markdown，不做复杂可视化表格编辑。
- 列表体验：回车延续有序 / 无序 / 任务列表；空列表项回车退出列表；Tab / Shift+Tab 调整缩进。
- Markdown 模板：内置 README、PRD、会议纪要、周报、技术方案、公众号长文模板；从命令面板和文件菜单进入，插入到新文档或当前光标。

验收标准：

- 图片粘贴后文件落盘、路径相对、预览可见。
- 表格命令只改当前表格，不破坏周边正文。
- 链接诊断能指出不存在的文件和错误 heading。

## 5. 编辑器内核模块化

目标：把编辑器能力从 React 组件中拆出来，降低后续功能叠加风险。

实现细节：

- `EditorPane` 只保留生命周期、extension 装配和 imperative handle；格式化、搜索、列表、图片粘贴、链接补全、诊断全部迁移到 `src/domains/editor/extensions/`。
- 使用 CodeMirror 6 Compartment 管理动态设置：字体、主题、行号、换行、只读、诊断开关不重建 EditorView。
- 删除生产 console：现有 content sync 和 update listener 的 `console.log` 改为开发环境 debug logger，默认关闭。
- 统一编辑命令入口：菜单、右键、快捷键、命令面板都调用 command registry；不再通过多个 window custom event 分散处理。
- 保留源码编辑路线：不引入 ProseMirror / Tiptap，不做块级富文本，避免 MarkText 类维护债。

验收标准：

- 粗体、斜体、标题、列表、搜索和打字机模式在拆分后行为不退化。
- 切换主题、字号、行号、换行不重建编辑器、不丢 selection。
- 生产环境没有编辑器同步日志刷屏。

## 6. 预览同步与渲染诊断

目标：让源码编辑和预览之间形成可信映射，尤其适合长文、图表和公式文档。

实现细节：

- 双向滚动同步：编辑器上报 top line 和 scroll ratio；预览 DOM 每个 heading / block 带 `data-source-line`，按最近 source line 映射滚动。
- 点击预览跳源码：点击预览段落、标题、代码块时定位到对应源码行，并短暂高亮。
- Mermaid / KaTeX 错误可定位：渲染失败块显示错误摘要和“跳到源码”按钮；错误信息进入诊断面板。
- 长文性能：Markdown HTML 生成做 debounce；Mermaid 渲染按 placeholder 队列分批，缓存 `contentHash + theme` 的 SVG。
- 预览位置记忆：每个文档记录 viewMode、editor scroll、preview scroll，切换视图和重开文档后恢复。
- HTML 安全：外链只允许 http / https 调用 opener；本地 file 链接走显式确认；预览中不执行用户脚本。

验收标准：

- 分栏模式下编辑滚动和预览滚动大致对齐。
- 点击预览中的标题、段落、代码块可以跳回源码位置。
- Mermaid / KaTeX 出错时用户知道是哪段源码导致。

## 7. 导出工作台

目标：把 HTML / PDF / PNG / DOCX 从“能导出”升级为“可靠、可预期、可配置、可复现”。

实现细节：

- 建立统一导出中间层：Markdown -> remark AST -> Prism document model -> adapter；HTML / PDF / PNG / DOCX 共享解析、Mermaid hydration、KaTeX、主题 token。
- 导出设置：支持模板、纸张 A4 / Letter、页边距 compact / standard / wide、页眉页脚、页码、目录、代码块样式、表格样式、默认导出目录。
- YAML front matter 覆盖导出：默认关闭；设置中开启后允许当前文件覆盖 title、author、date、template、paper、margin、toc。
- “上次导出”能力：记录每个文件最近一次成功导出的 format / path / settings，菜单提供“按上次设置导出”和“覆盖上次导出文件”。
- DOCX 保真：结构化映射 heading、paragraph、blockquote、table、code、task list；Mermaid 先转 PNG / SVG 图片再插入；字体策略使用主题 / 预览 / 自定义字体。
- 可选 Pandoc 增强：设置中心检测 pandoc 路径；若存在，额外开放 LaTeX、RTF、ODT、EPUB；若不存在，不显示为主能力，只在高级导出里提示配置。
- 导出进度和失败诊断：进度分为解析、渲染图表、应用主题、生成文件、写入磁盘；失败时提供可复制诊断文本。

验收标准：

- 四种导出都正确处理中文、表格、Mermaid、KaTeX、代码块、图片。
- PDF/PNG 导出不让当前预览区域长时间空白。
- DOCX 不出现空白表格，Mermaid 以图片而不是源码导出。

## 8. 设置中心与偏好系统

目标：设置中心成为 Prism 的长期偏好中心，而不是半成品能力的堆叠面板。

实现细节：

- 设置中心分组固定：通用、写作、主题、导出、文件、快捷键、高级。
- 通用：默认视图、恢复上次窗口、最近文档数量、清空最近文档。
- 写作：编辑器字体、字号、行高、行号、自动换行、预览字体、预览字号、导入本地字体。
- 主题：五套内容主题卡片，点击即应用；设置中心自身跟随内容主题。
- 导出：模板、PDF 纸张 / 边距、HTML 是否带主题、PNG scale、默认目录、DOCX 字体策略、Pandoc 路径检测。
- 文件：自动保存策略、恢复快照数量、图片默认保存位置、外部修改处理默认动作。
- 高级：开发者工具、清理缓存、导出诊断日志、重置所有设置。
- 设置持久化必须深合并默认值；旧 config 缺字段时自动补齐，不破坏用户已有设置。

验收标准：

- 设置改动重启后仍然存在。
- 五套内容主题下设置中心都像 Prism 原生界面。
- 不展示未产品化的外壳深浅色切换或空壳功能。

## 9. 工作区、快速打开与链接能力

目标：让单文档单窗口也具备高效项目导航能力。

实现细节：

- 快速打开：基于当前 workspace 文件树做 fuzzy search，支持文件名、路径片段、最近打开加权；快捷键 `Mod+P`。
- 大纲增强：支持 heading 搜索、点击跳转、拖拽暂不做；大纲项显示层级但保持当前妙言风格。
- 工作区文件监控：优先使用 Tauri / Rust 侧 watcher；若实现成本过高，第一版用应用聚焦时刷新 + 手动刷新按钮。
- 文件树操作安全：删除默认移到系统废纸篓；若 Tauri API 不支持废纸篓，则删除前二次确认并显示不可恢复。
- 内链能力：`[[note]]` 作为可选轻量语法，第一版只解析并补全工作区 markdown 文件，不做图谱。
- 标签 / 属性：解析 YAML front matter 的 tags / title / description；第一版只用于搜索和导出元数据，不做 Obsidian Properties 数据库视图。

验收标准：

- `Mod+P` 能快速打开工作区 Markdown 文件。
- 文件树刷新不会丢失当前文档状态。
- 删除、重命名、移动操作都有明确成功 / 失败反馈。

## 10. 专业写作扩展

目标：为学术、产品、技术文档用户提供专业但可选的增强能力。

实现细节：

- 引用系统第一版只支持 BibTeX / CSL JSON 文件导入，语法采用 Pandoc citekey：`[@doe2024]`。
- 设置中配置 bibliography file 和 CSL style；预览中 citekey 渲染为可点击引用占位；导出时若 Pandoc 可用则生成完整参考文献。
- 学术模板：论文草稿、读书笔记、研究摘要、白皮书；模板只生成 Markdown，不引入数据库。
- 中文排版工具：中英文间距检查、全角 / 半角标点提示、标题层级检查、连续空行检查；默认只提示，不自动改写。
- 字数统计升级：显示中文字数、英文词数、字符数、阅读时间、选区统计；状态栏保留简洁入口。

验收标准：

- 没有 Pandoc 时，引用功能不会破坏基础预览和导出。
- 中文排版检查只提示，不静默修改正文。
- 字数统计在长文中不会明显拖慢输入。

## 11. 对外扩展能力

目标：先开放低风险扩展点，再考虑插件生态。

实现细节：

- CLI：提供 `prism open <file>`、`prism export <file> --format pdf --theme miaoyan`；CLI 只调用现有导出 pipeline，不另写逻辑。
- Deep link：注册 `prism://open?path=...` 和 `prism://export?...`，使用 Tauri deep-link plugin；macOS scheme 必须写入 config。
- 插件 API 延后到核心稳定后：第一版只开放 command、export adapter、theme package 三类扩展点。
- 主题包格式：一个 `theme.json` + 可选 CSS，字段映射到 Prism theme contract；导入后保存到 appData/themes。
- 导出模板格式：一个 `template.json` + CSS，声明支持 HTML / PDF / PNG / DOCX 的能力；不允许执行 JS。
- Web Clipper 暂不做完整浏览器扩展；先提供“从剪贴板生成 Markdown 文档”和 URL metadata 抓取命令。

验收标准：

- CLI 和 deep link 都调用同一套打开 / 导出逻辑。
- 导入主题和模板不允许执行任意脚本。
- 插件能力不上线前，用户界面不展示插件市场入口。

## 12. 内部架构与质量

目标：让后续 agent 或开发者能持续迭代，而不是不断堆组件状态。

实现细节：

- Command System 成为单一事实源：命令 id、label、shortcut、enabled、checked、run 全部集中；菜单、命令面板、快捷键面板只读 registry。
- Export domain 拆 adapter：`html / pdf / png / docx / pandoc` 各自只负责输出；共享解析和主题应用不重复实现。
- Settings domain 增加迁移版本：`settingsVersion` 从 1 开始；每次 schema 变化写 migration，测试覆盖旧 config。
- Workspace domain 负责路径、文件树、recent files、watcher、quick open；组件不直接拼路径。
- Document domain 负责 dirty / save / conflict / recovery；UI 不直接调用 `writeTextFile`。
- 日志系统：封装 `logger.debug / info / warn / error`，生产默认只保留 warn / error；导出诊断日志时可临时开启 debug。
- Tauri permissions 收紧：当前 `fs:**` 过宽；正式版改为用户选择的文件 / 文件夹、appData、downloads / custom export directory 范围。

验收标准：

- 关键 domain 有单元测试。
- 菜单、快捷键、命令面板不会出现命令漂移。
- 新增文件能力不绕过 Document / Workspace domain。

## 13. Public Interfaces / Types

建议新增或调整的公共类型：

- `DocumentState.currentDocument` 新增保存与磁盘状态字段：`saveStatus`、`saveError`、`lastKnownMtime`、`lastKnownSize`、`recoveryId`。
- `SettingsState` 新增：`settingsVersion`、`fileSafety`、`imageHandling`、`pandoc`、`exportHistory`、`diagnostics`。
- `ExportDocumentInput` 新增：`frontMatterOverrides`、`toc`、`headerFooter`、`lastExportPath`、`pandocOptions`。
- Command registry 新增命令：`quickOpen`、`pasteImage`、`insertTable`、`formatTable`、`checkLinks`、`recoverDocument`、`exportWithPrevious`、`exportOverwritePrevious`、`openSettings`、`configurePandoc`。
- Deep link 协议：`prism://open?path=<encoded>`、`prism://export?path=<encoded>&format=pdf|html|docx|png`。
- 主题包最小接口：`id`、`name`、`tokens`、`preview`、`editor`、`export`；导出模板最小接口：`id`、`name`、`formats`、`css`、`docxStyleMap`。

## 14. Test Plan

必须覆盖：

- 单元测试：settings migration、路径处理、recent files、link scanner、table formatter、front matter export overrides、export settings normalization。
- CodeMirror 测试：列表续写、Tab 缩进、格式化撤销、图片粘贴插入、链接补全、搜索状态恢复。
- 导出测试：包含中文、表格、代码块、Mermaid、KaTeX、图片、YAML front matter 的 golden markdown，分别验证 HTML / PDF / PNG / DOCX。
- 文件安全测试：外部修改冲突、保存失败、恢复快照、无路径新文档自动保存跳过、另存为后 recent files 更新。
- E2E 测试：打开文件夹、快速打开、编辑保存、切换主题、预览同步、点击预览跳源码、四格式导出。
- 发布测试：macOS / Windows tauri build、updater JSON 校验、签名产物检查、README 链接检查。
- 性能基准：10 万字中文文档、100 个标题、50 张图片、20 个 Mermaid、20 个 KaTeX 块；记录编辑输入延迟、预览刷新时间、导出耗时。

## 15. 分阶段执行建议

### Phase 1：可信基础

- 统一版本 / 许可证 / README / release 信息。
- 修正生产日志。
- 建立 release checklist 和 issue 模板。
- 补 `saveStatus`，修保存失败不清 dirty。

### Phase 2：文件安全

- 增加 `mtime / size` 检测。
- 实现外部修改冲突 UI。
- 实现 recovery 快照。
- 最近文档迁移到 settings store。

### Phase 3：编辑效率

- 拆编辑器 extensions。
- 实现图片粘贴 / 拖拽。
- 实现列表续写、表格辅助、链接补全和链接诊断。

### Phase 4：预览与导出

- 做预览 source line mapping。
- 做点击预览跳源码。
- 重构 export pipeline。
- 增加导出进度、失败诊断和上次导出。

### Phase 5：专业与扩展

- Pandoc 可选增强。
- BibTeX / CSL 引用。
- CLI / deep link。
- 主题包和导出模板格式。

## 16. 明确非目标

- 不做完整 WYSIWYG。
- 不做云同步。
- 不做移动端。
- 不做实时协作。
- 不做图谱视图。
- 不做 Obsidian 式插件市场。
- 不做数据库式 Properties 表格视图。
- 不把 Pandoc 作为基础能力的必需依赖。
