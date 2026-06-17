# Prism 多视角产品、体验、跨平台美学与工程可行性评审

> 日期：2026-06-16  
> 范围：评审、证据收集、任务拆解；本轮不直接改代码。  
> 结论类型：repo-grounded review，优先使用 `CONTEXT.md`、ADR、当前源码、性能记录和官方/一手资料。  

## 总览结论

Prism 当前不是一个“缺基础能力”的 Markdown 编辑器。仓库已经具备 Tauri 2 + React + TypeScript 桌面壳、单文档单窗口、编辑/分栏/预览、自动保存、KaTeX、Mermaid、导出诊断、主题契约、工作区索引和完整预览性能专项。产品核心方向也已经在 `CONTEXT.md` 和 ADR-0005 中明确：Prism 是 Typora 式单文档单窗口、本地优先 Markdown 写作器，当前主视觉是妙言风格，而不是继续扩展旧 OpenAI 极简原型。

本轮没有发现需要打断评审立刻改代码的发布阻断，但发现了 3 类 P0/P1 级高风险链路：全局快捷键可能抢占输入框；打开文件入口在“新窗口/同窗口”和“大文件保护”上不一致；完整预览虽然已有 jsdom 基准优化，但仍缺真实 Tauri WebView 大文档交互基准。它们直接影响写作连续性、默认 app 打开行为、长文档性能和迁移用户第一印象。

美学上，Prism 的风险不是“不够现代”，而是视觉治理还没有完全从历史 OpenAI token 迁移到跨平台一致的 Prism/Miaoyan 产品语言：`tokens.css` 注释仍以 OpenAI 原型为源头，`miaoyan.css` 中有大量 AppKit 兼容和 `!important` 覆盖，状态栏仍出现关系图谱入口。应把后续设计工作从“换风格”转为“跨平台写作器气质收口”：更清晰的设计 token、可回归的排版截图、低频功能入口治理、真实桌面动效和性能感知。

路线图排序原则：先保写作链路不打断，再保文件打开/默认 app 行为一致，再做真实性能和排版可回归，最后再扩展迁移体验、品牌气质和更丰富的微反馈。AI、云同步、协作、插件市场、重型关系图谱、数据库属性和完整 block editor 暂不做。

## 证据目录

- 产品定位：`CONTEXT.md:3` 说明 Prism 是 Markdown 桌面编辑器和 Typora 式单文档单窗口；`CONTEXT.md:17`-`20` 明确没有标签页，新文档等于新窗口；`CONTEXT.md:22`-`24` 强调写作器增强型，不做知识库工作台。
- 视觉方向：`CONTEXT.md:12`-`15` 和 `docs/adr/0005-adopt-miaoyan-style.md:1`-`15` 明确当前主视觉是妙言风格，OpenAI 原型仅作历史参考。
- 状态栏边界：`CONTEXT.md:43`-`64` 约束状态栏只承载紧凑统计、`ERROR n`、导出状态和既有入口，不收纳文档信息入口。
- 功能边界：`CONTEXT.md:104`-`123` 限定链接、反链、图谱、属性、块操作都必须轻量；`CONTEXT.md:137`-`148` 明确 AI、插件、云同步、协作不进入当前核心。
- 导出方向：`CONTEXT.md:130`-`135` 要求导出保真、稳定、可诊断，而不是继续堆格式。
- 性能记录：`docs/verification/prism-preview-full-render-performance-2026-06-12.md:155`-`205` 记录 1MB 完整预览 jsdom 基准已优化到 `markdownToHtmlMs 61.9ms`、`domWriteMs 626.4ms`、`scrollSyncScanMs 33.9ms`，但也说明缺真实 WebView 大文档 harness。
- 快捷键链路：`src/app/useAppShortcuts.ts:25`-`35` 全局命中命令即 `preventDefault`；`src/domains/commands/categories/editorCommands.ts:21`-`118` 注册 `Cmd/Ctrl+Z/X/C/V/A/F/H` 等编辑命令；`src/app/useAppShortcuts.test.tsx:11`-`47` 目前没有输入框豁免测试。
- 打开文件链路：菜单打开在 `src/domains/commands/categories/fileCommands.ts:82`-`130` 含 10MB 提示和已有文档新窗口逻辑；文件树/最近文件在 `src/lib/fileActions.ts:315`-`330` 直接同窗口切换，仅有 dirty document 保护；`src/app/useAppCommandContext.ts:162`-`175` 将最近文件和工作区文件都路由到 `openFile`。
- 文件关联：前端和 Rust IO 支持 `txt`，见 `src/domains/workspace/services/fileAssociation.ts:1`-`10`、`src-tauri/src/domain/document_io.rs:62`-`84`、`src-tauri/src/commands/file_scope.rs:8`-`18`；但 Tauri bundle 只关联 `md/markdown`，见 `src-tauri/tauri.conf.json:53`-`61`；非 macOS 启动参数只接收 `.md/.markdown`，见 `src-tauri/src/commands/startup_files.rs:50`-`59`；另存为 Markdown 会把非 md/markdown 补成 `.md`，见 `src/app/useSaveExportDialogModel.ts:31`-`35`。
- 预览搜索与源码定位：`src/domains/editor/components/SplitView.tsx:156`-`249` 每次预览搜索会清除 mark、TreeWalker 遍历 `#write` 文本节点并改写 DOM；`SplitView.tsx:433`-`439` 在预览模式定位源码时只等一个 `requestAnimationFrame`；`SplitView.tsx:736`-`745` 默认 preview-only 会延迟挂载 editor。
- 工作区索引：`src/domains/workspace/hooks/useWorkspaceIndexModel.ts:222`-`260` 原生索引不可用且文件数超过 500 时会构建空 documents index；`src/components/shell/CommandPalette.tsx:78`-`112` 快速打开/全文搜索依赖 workspace index 或 fallback。
- 主题系统：`src/domains/themes/themeContract.ts:21`-`75` 已有编辑器、预览、导出、Mermaid、选择态契约；`src/domains/themes/themeCss.ts:91`-`124` 有用户主题 CSS 安全校验；`src/styles/tokens.css:3`-`7` 仍写 OpenAI token 来源；`src/styles/miaoyan.css:135`-`202` 定义妙言主题色、字体、预览字号、行高、最大宽度。
- 状态栏现状：`src/domains/workspace/components/StatusBar.tsx:190`-`233` 仍保留 `ERROR`、后台导出、关系图谱、专注、导出等右区入口。
- 官方/一手对比资料：Typora 官网与支持文档（https://typora.io/、https://support.typora.io/）、妙言 GitHub（https://github.com/tw93/MiaoYan）、MarkText GitHub（https://github.com/marktext/marktext）、Tauri v2 配置文档（https://v2.tauri.app/reference/config/）、Apple HIG（https://developer.apple.com/design/human-interface-guidelines/）、Microsoft Windows app design 文档（https://learn.microsoft.com/windows/apps/design/）、GNOME HIG（https://developer.gnome.org/hig/）。

## 子 agent 协作情况

本轮有效并入两个子 agent 视角：重度 Markdown 用户视角、产品经理视角。迁移、跨平台视觉、阅读排版、品牌、交互动效、工程可行性子 agent 在本地执行中没有稳定返回或已中断，因此这些视角由主线程按同一结构补齐。报告没有把主线程补充内容伪装成子 agent 输出。

## 各视角独立意见

### 1. 重度 Markdown 用户视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | 全局快捷键可能抢输入框、弹窗和搜索框默认行为。 | `useAppShortcuts.ts:25`-`35` 无 target 豁免；`editorCommands.ts:21`-`118` 注册常见编辑快捷键；测试只覆盖 Escape 和命令执行。 | 写作、重命名、设置、命令面板输入时可能出现复制/粘贴/全选/撤销不符合用户预期，是写作连续性的最高风险。 | 增加 `isEditableTarget` 豁免：`input`、`textarea`、`select`、`contenteditable`、CodeMirror 已处理事件不被二次接管；只让真正全局命令继续走 command registry。 | P0 | 在输入框中 `Cmd/Ctrl+A/C/V/Z/F/H` 不触发 app command；CodeMirror 正文仍可执行编辑命令。 | `src/app/useAppShortcuts.ts`、`src/app/useAppShortcuts.test.tsx`、命令面板/设置/搜索相关测试 |
| 2 | 打开文件入口策略不一致：菜单打开已有文档时新窗口，文件树/最近文件直接替换当前窗口。 | 菜单打开见 `fileCommands.ts:82`-`130`；文件动作见 `fileActions.ts:315`-`330`；最近/工作区文件路由见 `useAppCommandContext.ts:162`-`175`。 | 用户从 Typora 式单文档心智进入时，会困惑“为什么这次替换当前文档、那次开新窗口”。 | 明确规则：主菜单/系统打开/默认 app 打开遵循单文档新窗口；工作区文件树和快速打开可同窗口，但需有可见的“在新窗口打开”入口和 dirty guard。 | P1 | 同一测试矩阵覆盖菜单、文件树、最近文件、命令面板、系统参数；行为与文案一致。 | `src/domains/commands/categories/fileCommands.ts`、`src/lib/fileActions.ts`、`src/lib/openWindow.ts` |
| 3 | 大文件保护只在菜单打开路径存在。 | `fileCommands.ts:91`-`101` 有 10MB warning；`fileActions.ts:315`-`330` 无 size check。 | 用户通过最近文件、文件树或默认 app 打开大文件时，可能绕过提醒，造成卡顿或误以为 app 坏了。 | 抽出统一 `openDocumentPolicy`：类型授权、大小提醒、dirty guard、新窗口策略、workspace sync 一次决定。 | P1 | 10MB+ 文件从所有入口打开都出现一致提示或一致性能降级提示。 | `src/lib/fileActions.ts`、`src/domains/commands/categories/fileCommands.ts`、`src-tauri/src/commands/startup_files.rs` |
| 4 | 预览搜索每次对完整 DOM 做清 mark、遍历、替换，长文档高频输入可能抖动。 | `SplitView.tsx:156`-`249`。 | 在完整预览和长文档中，搜索输入每个字符都可能触发大量 DOM 操作，用户感知是搜索框延迟和滚动跳动。 | 增加 debounce、分帧标记或只标记可视附近；长文档优先返回计数和当前命中，再渐进高亮。 | P1 | 1MB 文档预览搜索首字响应 <100ms，输入过程中主线程长任务 <50ms。 | `src/domains/editor/components/SplitView.tsx`、`src/domains/editor/components/SplitView.test.tsx` |
| 5 | preview-only 定位源码存在 editor lazy 挂载竞态。 | `SplitView.tsx:433`-`439` 只等一个 RAF；`SplitView.tsx:736`-`745` preview-only 延迟挂载 editor。 | 用户右键“定位源码”可能切到 split 但没有跳到目标行，削弱预览可编辑感。 | 增加 `pendingJumpLine` 状态，等 EditorPane ready 后执行并高亮；测试覆盖 preview-only 冷启动。 | P1 | preview-only 冷启动右键定位源码 100% 跳到目标行并显示行闪烁/焦点反馈。 | `SplitView.tsx`、`EditorPane` handle、`SplitView.test.tsx` |
| 6 | 工作区索引原生失败且文件数超过 500 时，fallback 会构建空 documents index。 | `useWorkspaceIndexModel.ts:249`-`260`。 | 大工作区用户看见快速打开可能可用但全文搜索结果缺失，容易误以为没有命中。 | 给命令面板明确降级状态：索引不可用、仅文件名搜索、建议缩小工作区或重试。 | P2 | 关闭原生索引模拟大工作区时，UI 显示降级文案且不承诺全文搜索。 | `useWorkspaceIndexModel.ts`、`CommandPalette.tsx` |
| 7 | 预览右键菜单已有复制、复制为 Markdown/HTML、定位源码和导出，但需要验证键盘路径一致。 | `SplitView.tsx:406`-`430` 和 `SplitView.tsx:584`-`615`。 | 重度用户会同时用右键和快捷键；不一致会破坏 muscle memory。 | 给 preview-only、split、edit 三种模式建立复制/搜索/定位 smoke 矩阵。 | P2 | 3 个视图模式下右键和快捷键结果一致，复制内容符合当前可见选区。 | `SplitView.tsx`、`SplitView.test.tsx` |
| 8 | 选区浮动工具栏、斜杠菜单和块操作仍在产品语境中规划，但不能抢当前基础链路优先级。 | `CONTEXT.md:66`-`72`、`118`-`123`。 | 这些功能会提升效率，但如果先做，会掩盖打开/搜索/性能基础问题。 | 作为 P2/P3 增量做，前提是快捷键、打开策略、真实性能基准先过。 | P2 | 入口只出现在正文编辑区，不影响预览和系统输入控件。 | Editor extensions、Command registry、Context menu |

### 2. Typora / 妙言 / MarkText 迁移用户视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | Prism 的“Typora 式”应解释为单文档沉浸写作和可靠预览，不应承诺完整 WYSIWYG 心智。 | `CONTEXT.md:3`、`CONTEXT.md:25`-`27` 三态视图；Typora 官方资料强调 Markdown 编辑器和实时预览体验。 | 迁移用户若期待 Typora 一体化编辑预览，可能把 Prism 的 edit/split/preview 三态看成完成度差距。 | 首次迁移文案和快捷键页明确 Prism 的三态模型：源码是主编辑面，预览是完整阅读/导出基准。 | P2 | 新用户 5 分钟内能找到三态切换、默认预览和源码定位。 | onboarding、Shortcuts、ViewModeSwitch、Help |
| 2 | 妙言迁移用户会期待轻量本地写作器气质，但 Prism 当前语境强调跨平台，不应只按 macOS 原生拟态评判。 | ADR-0005 和 `CONTEXT.md:12`-`15`；妙言一手资料来自 `tw93/MiaoYan`。 | 如果过度贴 macOS，Windows/Linux 用户会觉得像移植品；如果过度通用，又丢失妙言式写作温度。 | 保留妙言式内容优先和中文排版，但把窗口结构、菜单、状态和文件关联做成跨平台一致能力。 | P1 | macOS/Windows/Linux 截图中主结构一致，平台差异只体现在系统菜单、窗口 chrome 和文件管理器措辞。 | `src/styles/miaoyan.css`、Tauri config、i18n |
| 3 | MarkText 迁移用户可能期待开源、简洁、Markdown-first，但 Prism 的导出诊断和 Tauri 桌面集成可以形成差异化。 | MarkText 官方 GitHub；`CONTEXT.md:130`-`135`；`src/domains/export/preflight.ts:224`-`240`。 | 如果只对齐编辑体验，Prism 会被看成“另一个 Markdown 编辑器”；导出保真/诊断是更强迁移理由。 | 迁移页重点展示本地文件、安全保存、完整预览、导出诊断和主题契约，而非泛泛“现代”。 | P1 | 迁移清单中每个卖点可在 app 内 1-2 步验证。 | docs/help、About/Welcome、Export |
| 4 | `.txt` 支持当前跨层口径不一致，会影响从其他编辑器拖入纯文本或设置默认打开。 | 前端/Rust 支持 `txt`，Tauri association 和 startup args 不完整。 | 迁移用户常把 `.txt`、`.md` 混用；入口不一致会造成“文件可以从 dialog 打开但双击打不开”。 | 做产品取舍：要么正式支持 Text Document profile；要么 UI 隐藏 txt，只保留内部读写能力。 | P1 | `.txt` 从 dialog、拖拽、系统双击、CLI args、保存另存路径行为一致。 | `fileAssociation.ts`、`tauri.conf.json`、`startup_files.rs`、`useSaveExportDialogModel.ts` |
| 5 | 快捷键映射需要给迁移用户稳定入口，不宜只埋在菜单。 | `editorCommands.ts:21`-`168` 已有大量命令；`CommandPalette.tsx` 支持快捷键展示。 | Typora/MarkText 用户依赖肌肉记忆，缺迁移表会放大差距感。 | 提供“Typora/MarkText 常用快捷键对照”帮助页，只写已实现项，不承诺未实现项。 | P2 | 帮助页列出的每个快捷键都有自动化测试或命令注册。 | `src/domains/commands`、Help/Shortcuts |
| 6 | 导出预设是迁移痛点，应围绕“保真”和“失败可诊断”而非更多格式。 | `CONTEXT.md:130`-`135`；`SettingsModal.tsx` 已有导出默认设置；`preflight.ts` 有诊断基础。 | 迁移用户最怕“预览好看，导出翻车”。 | 将导出失败详情、资源缺失、KaTeX/Mermaid 错误、分页风险做成可读检查清单。 | P1 | 有错误的文档导出前显示可理解诊断，点击可定位源码。 | `src/domains/export/preflight.ts`、Diagnostics panel、Export job |
| 7 | 默认 app 打开行为是迁移第一印象，当前需补全跨平台 smoke。 | `tauri.conf.json:53`-`61`、`startup_files.rs:50`-`59`。 | 用户设置 Prism 为默认 Markdown app 后，双击/右键打开失败会直接流失。 | 建立默认 app 打开 smoke：macOS Opened event、Windows/Linux args、含空格/中文路径、多文件。 | P0 | 三平台至少有脚本化或手工记录的默认打开验证表。 | `src-tauri/src/commands/startup_files.rs`、`src/hooks/useBootstrap.ts`、Tauri config |

### 3. 产品经理视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | 核心定位已足够清晰：本地优先、单文档、写作器增强型。 | `CONTEXT.md:17`-`24`、`137`-`148`。 | 继续扩展协作、云、AI、插件会稀释 Prism 的可信赖写作器定位。 | 把路线图分成写作连续性、完整预览、导出可信、轻量组织四条，不做平台化叙事。 | P0 | Roadmap 中 P0/P1 任务 80% 以上直接服务当前文档写作链路。 | Product docs、Command registry、StatusBar |
| 2 | 导出保真/失败诊断是 Prism 的强差异化，应继续升为核心卖点。 | `CONTEXT.md:130`-`135`；`preflight.ts:224`-`240`。 | 这比新增冷门格式更能带来专业用户信任。 | P1 做导出诊断产品化：错误分组、定位源码、重试、失败阶段说明。 | P1 | 导出失败反馈包含阶段、路径、原因、下一步，且可跳转。 | Export preflight、Export job、Diagnostics |
| 3 | 长文档完整预览是战略承诺，但需要真实 app 性能证据。 | 性能记录 `docs/verification/...:155`-`205`。 | 只靠 jsdom benchmark 无法证明 WebView 下滚动、菜单、搜索、右键不卡。 | P0 建真实 Tauri 大文档 harness，先测再决定是否分阶段 DOM commit。 | P0 | 1MB/3MB 文档打开、预览切换、搜索、滚动、右键响应有可重复数字。 | `PreviewPane.performance.test.tsx`、`scripts/run-app-smoke.mjs`、Tauri smoke |
| 4 | 状态栏和命令面板应承担低频功能收口，不应继续扩展常驻按钮。 | `CONTEXT.md:43`-`64`；`StatusBar.tsx:190`-`233`。 | 状态栏变成工具箱会冲淡写作界面。 | 关系图谱、属性、反链默认进命令面板；状态栏只留 `ERROR`、导出、专注等高频/状态项。 | P1 | 默认状态栏右侧按钮数量收敛，图谱不作为常驻主入口。 | `StatusBar.tsx`、`CommandPalette.tsx` |
| 5 | `.txt` 支持需要产品口径先行，不能让实现层自然扩散。 | 多层支持不一致。 | 入口混乱会造成支持边界不可解释。 | 决策：Markdown-first + optional plain text profile；不要让 `.txt` 享有 Markdown 预览/导出语义。 | P1 | 文档类型 profile 决策进入 `CONTEXT.md` 或 ADR。 | Document profile、file association |
| 6 | 图谱、属性、模板、块操作都可以做，但应按 `CONTEXT.md` 顺序增量，不做 Notion/Obsidian 化。 | `CONTEXT.md:104`-`123`、`152`-`168`。 | 提前做重型组织功能会改变 Prism 的目标用户和复杂度。 | P2/P3：先命令面板和斜杠菜单，再轻量链接/反链/图谱。 | P2 | 每个新增入口有使用频率假设和退场标准。 | Workspace index、CommandPalette、Diagnostics |
| 7 | 暂不做能力需要明确写入 roadmap，避免反复讨论。 | `CONTEXT.md:137`-`148`、`142`-`145`。 | 团队会被 AI/云/协作/插件热点牵引。 | P3 明确“暂不做”：AI 平台化、云同步、实时协作、插件市场、完整 block editor、3D 图谱。 | P3 | Roadmap 的 P3/Not now 区域有理由和重评条件。 | Product docs |

### 4. 跨平台视觉系统视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | 当前主视觉来自妙言，但跨平台产品气质不能只等于 macOS 原生。 | ADR-0005；Tauri window config 使用 overlay title bar：`tauri.conf.json:13`-`29`。 | Windows/Linux 上如果仍按 AppKit 细节实现，会显得移植感强。 | 定义 Prism 自有跨平台壳：左侧工作区、中心写作、右上视图模式、底部紧凑状态；平台差异仅在系统 chrome 和菜单。 | P1 | 三平台截图中结构、密度、颜色层级一致；平台差异有 ADR 说明。 | `tauri.conf.json`、shell CSS、TitleBar |
| 2 | token 语义仍混有历史 OpenAI 方向。 | `tokens.css:3`-`7` 仍写 OpenAI 风格；ADR-0005 已取代 ADR-0001。 | 新 UI 容易继续引用旧原型语义，造成视觉治理分裂。 | 不急着大重构，先增加 token audit：哪些是历史名、哪些是当前功能 token、哪些是主题 token。 | P2 | 新 UI 不再新增 OpenAI-only token；文档列出 token 层级。 | `src/styles/tokens.css`、`src/styles/miaoyan.css` |
| 3 | 主题系统已经有契约，不应误判为“缺主题系统”。 | `themeContract.ts:21`-`75`、`themeCss.ts:91`-`124`。 | 错误地重做主题系统会浪费工程成本。 | 聚焦截图回归和 token 收口，而不是重建主题架构。 | P2 | 每套内置主题有预览截图基准，用户主题安全校验保持通过。 | `src/domains/themes`、`src/styles/content-themes.css` |
| 4 | 控件密度整体接近桌面写作器，但状态栏入口仍有产品边界冲突。 | `StatusBar.tsx:190`-`233`。 | 低频图谱入口出现在常驻区会让产品偏知识库工作台。 | 将关系图谱入口移入命令面板/文档菜单，状态栏仅在有明确状态时出现。 | P1 | 默认空文档或普通文档状态栏不显示图谱入口。 | `StatusBar.tsx`、Command palette |
| 5 | 图标目前多为手写 SVG，跨平台一致性可控但维护成本高。 | `StatusBar.tsx:7`-`60` 手写多个图标。 | 新增图标容易风格不一，且无统一尺寸/描边规范。 | 建立 Prism icon spec：16/20px grid、线宽、填充、hover/active；必要时引入统一图标库或本地 icon set。 | P3 | 新增图标有视觉 lint 或截图 review，状态栏图标尺寸不抖动。 | StatusBar、TitleBar、menus |
| 6 | 官方跨平台规范都强调清晰层级、平台惯例和用户控制，不支持把 macOS 细节直接移植为唯一审美。 | Apple HIG、Microsoft Windows app design、GNOME HIG。 | Prism 需要建立“写作器产品气质”而非“某平台皮肤”。 | 设计系统文档按 macOS/Windows/Linux 分出必须适配项和统一项。 | P2 | 每个跨平台差异都有“统一/平台化/不支持”的决策表。 | `docs/adr`、design docs |

### 5. 阅读排版美学视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | 默认预览行宽可能偏宽，尤其中文长文在大屏上会增加阅读疲劳。 | `miaoyan.css:196`-`202` 和 `themeContract.ts:91`-`99` 设 `maxWidth: 1000`、`fontSize: 16`、`lineHeight: 1.74`。 | 宽屏预览阅读会显得散，标题/正文节奏弱。 | 建排版截图矩阵后再调：默认中文正文建议评估 760-860px 阅读列宽，表格/代码块允许突破。 | P2 | 1200/1440/1920 宽度截图中正文每行汉字数和表格可读性达标。 | `miaoyan.css`、`themeContract.ts`、PreviewPane |
| 2 | 字体选择有鲜明中文气质，但跨平台字体 fallback 需真实验证。 | `miaoyan.css:161`-`163`、`themeContract.ts:86`-`99`。 | Windows/Linux 字体 fallback 可能破坏妙言式排版。 | 为 macOS/Windows/Linux 截图记录实际 font-family 命中；缺失时用 bundled font 或平台 fallback 策略补齐。 | P2 | 三平台 font fallback 截图和 computed style 记录完整。 | `src/assets/fonts`、theme contract |
| 3 | 代码块、表格、KaTeX、Mermaid 已是完整预览性能重点，但排版审美需要单独回归。 | 性能记录覆盖表格、代码、KaTeX、Mermaid；`markdownToHtml.test.ts` 有大量功能用例。 | 性能优化可能改变表格 DOM、source map 和视觉细节。 | 增加 preview typography fixture：标题、段落、列表、表格、引用、代码、公式、Mermaid、暗色。 | P1 | 每次主题/预览优化都有截图 diff 或人工截图记录。 | `PreviewPane.test.tsx`、Playwright/screenshots |
| 4 | 暗色模式和多主题存在，但默认主题品质应先被锁定。 | `themeContract.ts` 包含多套主题；`content-themes.css` 存在主题样式。 | 主题越多，默认体验越容易被稀释。 | 先锁 `miaoyan` 默认主题的阅读质量，再把其他主题按同一 fixture 回归。 | P2 | 默认主题通过全部 typography fixture，再扩展到其他主题。 | `src/domains/themes`、`src/styles/content-themes.css` |
| 5 | 引用、Callout、Toggle 要保持 Markdown 源码可读，视觉不应做成重卡片。 | `CONTEXT.md:74`-`95`。 | 过度卡片化会破坏长文连续阅读和导出保真。 | 轻量边线/背景/标题层级即可，重点是扫描性和导出一致。 | P2 | 预览、HTML/PDF/DOCX 导出中 Callout/Toggle 可读且不过度抢眼。 | Markdown extensions、Export CSS |
| 6 | Mermaid/公式的错误状态需要视觉上可定位但不吓人。 | `preflight.ts:62`-`143`、`169`-`221`。 | 渲染错误如果只在导出前暴露，会打断写作；如果常驻强警告，会制造焦虑。 | preview 内轻量 error affordance，状态栏聚合 `ERROR n`，点击定位源码。 | P1 | Mermaid/KaTeX 错误在预览和诊断面板中可见、可定位、可理解。 | Diagnostics、PreviewPane、StatusBar |

### 6. 品牌与产品气质视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | Prism 的产品气质应是“可靠、安静、本地、完整预览”，而不是“AI 写作平台”或“知识库工作台”。 | `CONTEXT.md:22`-`24`、`137`-`148`。 | 品牌表达如果追热点，会稀释用户对文件安全和写作稳定的信任。 | 品牌文案围绕本地写作、完整预览、可信导出、轻量组织。 | P1 | 空状态、About、帮助页不出现云/AI/协作承诺。 | i18n、Help/About、empty states |
| 2 | “Prism” 这个名字有多面折射的隐喻，但当前界面识别更多来自妙言主题，独立品牌资产还不够明确。 | `package.json:2`-`4` 描述偏功能；`tauri.conf.json:46`-`52` 有图标资源。 | 用户可能记住“像妙言的编辑器”，而不是 Prism 自身。 | 做轻量品牌系统：app icon 使用规范、启动/空状态一句话、导出页 footer 可选品牌。 | P2 | app 首屏、空文档、About 中能识别 Prism，不依赖导航小字。 | icons、About、empty state |
| 3 | 状态栏和图谱入口会改变品牌气质，从写作器滑向知识管理工具。 | `CONTEXT.md:104`-`109` 允许轻量图谱但不做重型；`StatusBar.tsx:209`-`217` 常驻图谱按钮。 | 品牌叙事容易变成“功能很多”，而不是“写得稳”。 | 图谱降为命令/文档菜单入口，只有用户主动调用时呈现。 | P1 | 默认界面第一眼仍是文档和写作区域，不是功能工具台。 | StatusBar、RelationGraph |
| 4 | 启动体验和默认 app 打开行为是品牌可信感的一部分。 | Tauri association 和 startup args 证据。 | 双击文件打不开、打开后空白或错窗口，会比视觉细节更伤品牌。 | P0 smoke 覆盖双击、拖拽、命令行参数、最后会话恢复冲突。 | P0 | 设置默认 app 后双击 `.md/.markdown` 路径可靠打开目标文档。 | Tauri startup、Bootstrap |
| 5 | 错误文案和导出诊断决定 Prism 是否像成熟工具。 | `CONTEXT.md:130`-`135`；`preflight.ts` 诊断基础。 | 一行底层错误会让产品显得半成品。 | 所有文件/导出/渲染错误都按“发生阶段、对象、原因、下一步”输出。 | P1 | 用户不看 devtools 也能理解失败原因和下一步。 | i18n、preflight、file safety |
| 6 | 默认主题已有鲜明中文写作气质，但品牌不应被“复刻妙言”锁死。 | ADR-0005 的措辞是“贴近妙言式体验”，不是复刻。 | 后续跨平台扩展可能被误判为背离视觉方向。 | 定义 Prism 自身的 5 个视觉词：安静、清晰、纸感、精确、克制；用截图规范而不是竞品相似度验收。 | P2 | 设计评审不再只问“像不像妙言”，而问是否符合 Prism 视觉词。 | design docs、screenshots |

### 7. 交互动效与微反馈视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | 完整预览性能优化已做，但用户感知性能还缺“加载/处理中/可操作”反馈。 | 性能记录说明 DOM write 仍约 626ms；`PreviewPane` 有异步后处理。 | 长文档切换预览时即使最终快，瞬时无反馈也会像卡死。 | 预览渲染、KaTeX/Mermaid hydrate、导出 preflight 增加轻量状态，不用假进度条。 | P1 | 1MB 文档切换预览时 100ms 内有稳定反馈，完成后消失。 | PreviewPane、SplitView、export progress |
| 2 | 预览搜索当前会直接滚动到命中，缺少渐进反馈和大文档节流。 | `SplitView.tsx:247`、`579`-`650`。 | 搜索输入中滚动跳动会让用户失去位置感。 | 输入阶段先更新计数和当前命中，Enter/next 时再滚动；长文档 debounce。 | P1 | 搜索输入不会每键强制滚动；Next/Prev 明确高亮当前命中。 | SplitView search |
| 3 | 源码定位有闪烁反馈，但冷启动等待不可靠。 | `SplitView.tsx:371`-`375` 有 preview line flash；`433`-`439` 有单 RAF 竞态。 | 用户看不到“定位已完成/失败”，会重复点击。 | pending jump 状态：切 split、editor ready、jump、flash；失败时 toast。 | P1 | preview-only 定位源码可观测，失败有反馈。 | SplitView、EditorPane |
| 4 | 保存状态不放状态栏是正确方向，但左上文件名区域需要承担完整保存反馈。 | `CONTEXT.md:50`。 | 如果保存失败/冲突反馈不明显，用户对本地写作安全失去信任。 | 文件名区显示保存中、未保存、保存失败、冲突；状态栏不重复。 | P1 | 保存失败和磁盘冲突 1 秒内被用户发现并可打开详情。 | Document store、TitleBar/FileName |
| 5 | 右键菜单、命令面板、状态栏浮层需要统一动效节奏。 | `tokens.css:114`-`119` 已有 duration/easing；诊断 popover CSS 已存在。 | 微反馈不统一会显得拼装，尤其跨平台更明显。 | 统一 120ms hover、160-200ms popover、尊重 reduced motion。 | P2 | 所有浮层开合/hover/active 过渡时长来自 token。 | `tokens.css`、popover/menu CSS |
| 6 | 导出后台状态已有入口，但成功/失败后的持留规则需稳定。 | `CONTEXT.md:62`；`StatusBar.tsx:199`-`207`。 | 导出耗时任务如果反馈消失太快或一直占位，都会打断写作。 | 导出中常驻、成功 2 秒消失、失败保留且可点开详情。 | P1 | 导出成功/失败/取消三种状态有一致 toast/status 行为。 | Export job、StatusBar、Toast |

### 8. 工程性能与架构可行性视角

| # | 关键发现 | 证据 | 影响 | 建议 | 优先级 | 可验证指标 | 可能涉及文件或模块 |
|---:|---|---|---|---|---|---|---|
| 1 | 快捷键输入框豁免是低成本高收益，风险集中在命令分发测试。 | 证据见快捷键链路。 | 不修会持续影响所有弹窗/搜索/设置输入。 | 小范围改 `useAppShortcuts`，补 target tests。 | P0 | `npm test -- --run src/app/useAppShortcuts.test.tsx` 覆盖通过。 | `useAppShortcuts.ts` |
| 2 | 打开文件策略应抽成策略模块，否则后续默认 app、拖拽、最近文件会继续分叉。 | `fileCommands.ts` 与 `fileActions.ts` 两套逻辑。 | 每新增入口都可能漏大文件提示、dirty guard 或新窗口策略。 | 建 `documentOpenPolicy` 或 `openDocumentFlow`，先集中判定，不先重写 UI。 | P1 | 菜单/文件树/最近/默认 app 共用测试 fixture。 | `fileCommands.ts`、`fileActions.ts`、`useBootstrap.ts` |
| 3 | 完整预览性能不能靠虚拟化快速解决，因为产品目标是完整预览。 | 性能记录标题和目标写明不改成首屏虚拟化或懒加载。 | 直接虚拟化会破坏搜索、复制、导出、源码定位。 | 先测真实 WebView，再评估分阶段 DOM commit、局部后处理和搜索节流。 | P0 | 真实 app harness 输出可复现 JSON 指标。 | PreviewPane、markdownRenderService、Tauri smoke |
| 4 | 预览搜索优化中等成本，关键是不要破坏选择复制和源码映射。 | `SplitView.tsx` 预览搜索直接改写 DOM；scroll map 依赖 DOM/sidecar。 | naive 高亮可能影响复制结果或定位源码。 | 建独立 search highlighter module，测试复制文本、源码定位、HTML 结构恢复。 | P1 | 搜索前后 preview raw selected text 不含额外噪声，clear mark 后 DOM 正常。 | SplitView、search module |
| 5 | `.txt` 支持应通过 DocumentProfile 深化，而不是继续在 Markdown helper 中散落。 | `fileAssociation.ts`、`document_io.rs`、`startup_files.rs`、`ensureMarkdownExtension` 不一致。 | 文件类型语义会泄漏到保存、预览、导出、索引、关联。 | 建轻量 `DocumentProfile`: markdown/text；text 只编辑/保存/搜索，不默认预览/导出语义。 | P1 | `.txt` profile 测试覆盖打开、保存、另存、索引、系统打开。 | document domain、workspace services、Tauri |
| 6 | 主题系统已有深模块潜力，当前风险是 token 和 CSS override 的局部性不足。 | `themeContract.ts` 深契约；`miaoyan.css` 大量全局 override。 | 新主题或跨平台视觉调优会散布在多个 CSS 文件。 | 逐步把预览排版参数从全局 CSS 收到 theme contract 和 generated vars。 | P2 | 修改主题排版只需改 contract 或单一主题文件，截图回归稳定。 | `src/domains/themes`、`src/styles` |
| 7 | 状态栏收口是低风险 UI 调整，但需要产品验收避免误删入口。 | `CONTEXT.md` 保留既有导出/专注；图谱入口与文档有冲突。 | 删除入口可能影响已有用户习惯。 | 先降级图谱为命令面板入口，并保留菜单路径；观察使用反馈。 | P1 | 命令面板可打开图谱，状态栏默认不露出低频入口。 | StatusBar、CommandPalette |

## 交叉共识

1. 先修写作链路稳定性。快捷键输入框豁免、打开文件策略、默认 app 打开 smoke，比新增编辑功能更优先。
2. Prism 的强差异化不是“功能最多”，而是本地可靠、完整预览、导出可诊断、中文长文排版舒服。
3. 完整预览是产品承诺，不能轻易改成虚拟化；但必须补真实 WebView 性能指标。
4. 视觉方向应从“像妙言”升级为“Prism 自己的跨平台写作器气质”，同时保留妙言式轻量、克制和中文排版优势。
5. 状态栏必须降噪，命令面板承接低频能力。图谱、属性、反链、模板都应服务当前文档，不把 Prism 推向工作台。
6. `.txt` 支持不是单个配置问题，而是产品语义和 DocumentProfile 问题。
7. 排版和主题改动需要截图回归，否则性能优化、主题扩展和跨平台调整会互相踩踏。

## 争议点与建议取舍

- 是否追 Typora 的所见即所得：不建议。Prism 可以保持三态互斥，用预览保障阅读和导出，用源码保障可控性。迁移文案要讲清楚差异。
- `.txt` 是否正式支持：建议支持，但作为 plain text profile，而不是伪装成 Markdown。若短期没资源，就从系统关联和 UI 入口中收口，避免半支持。
- 是否把图谱作为主入口：不建议。图谱可以存在，但默认收进命令面板，避免产品气质偏 Obsidian。
- 是否为了性能做预览虚拟化：暂不建议。先做真实 WebView harness 和分阶段 DOM commit 评估，避免破坏完整复制、搜索、导出和源码定位。
- 是否继续沿用 OpenAI token 命名：短期保留以降低风险，P2 做 token 语义审计和文档化，不做大爆炸重命名。
- 是否做 AI/云/协作/插件：暂不做。除非后续用户明确改变 Prism 定位，否则不进入 P0-P2。

## P0/P1/P2/P3 优化路线图

### P0：立即做，写作与打开链路不可继续含糊

1. 全局快捷键输入框豁免。
2. 默认 app 打开/启动参数/最后会话恢复 smoke 矩阵。
3. 真实 Tauri WebView 长文档性能 harness。

### P1：下一阶段，统一高频路径和可靠反馈

1. 统一打开文件策略：菜单、文件树、最近文件、快速打开、系统打开共享大文件提示、dirty guard、新窗口/同窗口规则。
2. `.txt` 产品口径与系统入口一致，优先 DocumentProfile。
3. 预览搜索长文档节流和渐进高亮。
4. preview-only 源码定位等待 editor ready。
5. 状态栏降噪，图谱/属性/反链进入命令面板。
6. 导出诊断产品化，错误可定位、可理解。
7. 保存/冲突/导出中/导出失败的微反馈统一。

### P2：后续 phase，建立可回归的体验质量

1. 排版截图基准：正文、标题、代码、表格、引用、公式、Mermaid、暗色。
2. 跨平台设计 token 审计和 Prism 视觉词文档。
3. 迁移帮助：Typora/妙言/MarkText 心智差异、快捷键对照、导出预设。
4. 命令面板信息架构整理，承接低频能力。
5. 主题系统截图回归和默认主题品质锁定。
6. 斜杠菜单、浮动工具栏、轻量块操作按 `CONTEXT.md` 顺序增量进入。

### P3：暂不做或只保留研究入口

1. AI 自动写作、聊天侧栏、agent 工作流。
2. 云同步、账号系统、实时协作、评论审阅。
3. 插件市场、第三方执行型插件 API。
4. Notion 式数据库属性、relation/rollup/formula。
5. Obsidian 式重型知识宇宙图、3D 图谱、常驻图谱侧栏。
6. 完整 block editor、隐藏 Markdown 源码的块数据库。

## 可执行 task 清单

| ID | Task | 用户影响 | 证据来源 | 推荐改法 | 风险 | 优先级 | 验收标准 | 建议验证命令 |
|---|---|---|---|---|---|---|---|---|
| T-01 | 修复全局快捷键抢输入框 | 防止搜索框、设置、重命名、弹窗输入被 `Cmd/Ctrl+A/C/V/Z/F/H` 打断。 | `useAppShortcuts.ts:25`-`35`、`editorCommands.ts:21`-`118`。 | 增加 editable target guard，CodeMirror 正文由编辑器命令处理。 | 可能误拦截本应全局的命令。 | P0 | 普通 input 中快捷键不触发 app command，正文快捷键不回退。 | `npm test -- --run src/app/useAppShortcuts.test.tsx` |
| T-02 | 建默认 app 打开 smoke | 确保双击 `.md/.markdown`、命令行参数、最后会话恢复不会打开错文档。 | `tauri.conf.json:53`-`61`、`startup_files.rs:50`-`59`、`useBootstrap.test.tsx`。 | 扩展 app smoke 或新增启动文件测试矩阵，覆盖中文/空格路径。 | 当前环境可能无法覆盖 Windows/Linux 真机。 | P0 | smoke 文档记录 macOS 和可脚本化路径，跨平台待真机补充。 | `npm test -- --run src/hooks/useBootstrap.test.tsx src/lib/openWindow.test.ts` |
| T-03 | 建真实 WebView 长文档性能 harness | 证明完整预览在真实 Tauri/WebView 下可用。 | 性能记录 `docs/verification/...:155`-`205`。 | 基于 `tauri:build:app-smoke` 增加打开 1MB/3MB fixture、切预览、滚动、搜索、右键测量。 | harness 本身受机器和平台影响，需要固定环境记录。 | P0 | 生成 JSON 指标，包含打开、切换、DOM commit、搜索、滚动响应。 | `PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx`，新增 app harness 后补跑 |
| T-04 | 统一打开文件策略模块 | 消除菜单、文件树、最近文件、快速打开行为分叉。 | `fileCommands.ts:82`-`130`、`fileActions.ts:315`-`330`。 | 抽 `openDocumentPolicy`，集中大小提示、dirty guard、窗口策略、workspace sync。 | 改动触及多个入口，需防回归。 | P1 | 所有入口行为符合单文档规则，测试矩阵通过。 | `npm test -- --run src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts` |
| T-05 | `.txt` DocumentProfile 决策与落地 | 避免纯文本半支持。 | `fileAssociation.ts:1`-`10`、`document_io.rs:62`-`84`、`tauri.conf.json:53`-`61`、`startup_files.rs:50`-`59`。 | 引入 markdown/text profile；系统关联、启动参数、另存扩展、预览/导出口径统一。 | 可能扩大测试面；若正式关联 txt，会影响系统默认 app 期望。 | P1 | `.txt` 各入口一致；另存 `.txt` 不被强制改 `.md`。 | `npm test -- --run src/lib/fileActions.test.ts src/hooks/useBootstrap.test.tsx`，Rust 相关用 `cargo test` |
| T-06 | 预览搜索节流和渐进高亮 | 长文档搜索不抖动。 | `SplitView.tsx:156`-`249`、`579`-`650`。 | debounce 输入、分帧标记、Next/Prev 再滚动；模块化 highlighter。 | DOM 改写可能影响复制和源码定位。 | P1 | 1MB 文档搜索输入不卡，清除 mark 后 DOM 正常。 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx` |
| T-07 | preview-only 源码定位 ready 队列 | 预览中右键定位源码可靠。 | `SplitView.tsx:433`-`439`、`736`-`745`。 | `pendingJumpLine` 等 EditorPane mounted 后执行并 flash。 | 需处理用户快速切换视图。 | P1 | preview-only 冷启动定位源码 100% 成功。 | `npm test -- --run src/domains/editor/components/SplitView.test.tsx` |
| T-08 | 状态栏降噪 | 第一屏回到写作器气质。 | `CONTEXT.md:43`-`64`、`StatusBar.tsx:190`-`233`。 | 图谱/属性/反链转命令面板；状态栏保留 `ERROR`、导出、专注、统计。 | 用户可能找不到图谱入口。 | P1 | 命令面板能打开图谱，状态栏默认不显示低频图谱按钮。 | `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx src/components/shell/CommandPalette.test.tsx` |
| T-09 | 导出诊断产品化 | 导出失败可理解、可定位、可修复。 | `CONTEXT.md:130`-`135`、`preflight.ts:224`-`240`。 | 错误按链接、图片、渲染、表格、导出阶段分组，提供源码定位。 | Mermaid/KaTeX 诊断可能耗时。 | P1 | 有错文档导出前/失败后显示阶段、原因、下一步。 | `npm test -- --run src/domains/export/preflight.test.ts` |
| T-10 | 保存/冲突/导出微反馈统一 | 增强本地文件安全感。 | `CONTEXT.md:50`、`62`，文件安全 store。 | 文件名区域承担保存状态；导出状态遵循中/成/败持留规则。 | 文案和状态源可能重复。 | P1 | 保存失败、冲突、导出失败均 1 秒内可见且不重复。 | 相关 store/UI tests，至少 `npm test -- --run src/lib/fileActions.test.ts` |
| T-11 | 排版截图基准 | 防止主题/性能改动破坏阅读美学。 | `miaoyan.css:196`-`202`、`themeContract.ts:91`-`99`。 | 建 fixture 和 Playwright 截图，覆盖标题、段落、表格、代码、引用、公式、Mermaid、暗色。 | 截图在平台间有字体差异。 | P2 | 默认主题截图可人工或自动比对。 | `npm test -- --run src/domains/themes/themeContract.test.ts`，新增截图脚本后补跑 |
| T-12 | token 语义审计 | 从历史 OpenAI token 迁移到 Prism 跨平台语言。 | `tokens.css:3`-`7`、ADR-0005。 | 文档化 token 层级；禁止新增 OpenAI-only 语义。 | 大改 token 会引入视觉回归，先审计不重命名。 | P2 | token audit doc 存在，新 UI 引用规则明确。 | `git diff --check`，视觉截图 |
| T-13 | 迁移帮助页 | 降低 Typora/妙言/MarkText 用户认知成本。 | 官方/一手资料和 `CONTEXT.md` 三态模型。 | 写已实现能力对照：视图、快捷键、主题、导出、文件模型。 | 不能承诺未实现功能。 | P2 | 帮助页中每条能力都能在 app 验证。 | 文档检查 + 快捷键测试 |
| T-14 | 命令面板信息架构整理 | 低频能力可发现但不常驻打扰。 | `CommandPalette.tsx:78`-`112`、`CONTEXT.md:125`-`128`。 | 分组：文件、当前文档、导出、诊断、链接、设置；显示降级状态。 | 命令太多可能降低快速打开效率。 | P2 | 快速打开与全文搜索模式清晰，降级文案准确。 | `npm test -- --run src/components/shell/CommandPalette.test.tsx` |
| T-15 | 主题截图回归 | 保证默认主题和内置主题质量。 | `themeContract.ts:21`-`75`、`themeCss.ts:91`-`124`。 | 每套主题同一 fixture 截图；用户主题安全校验继续保留。 | 字体差异导致截图噪声。 | P2 | 内置主题截图集可审查，安全校验测试通过。 | `npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themeCss.test.ts` |
| T-16 | 斜杠菜单第一版 | 提升写作效率但不引入 block editor。 | `CONTEXT.md:69`-`72`。 | 只做标准 Markdown/HTML 片段插入，键盘可操作。 | 过度 Notion 化。 | P2 | `/mer`、`/table` 等插入标准源码，Esc/Enter 可用。 | 新增 editor extension tests |
| T-17 | 浮动工具栏第一版 | 选区格式化更顺手。 | `CONTEXT.md:66`-`68`。 | 使用 CodeMirror `coordsAtPos`，仅源码编辑区触发。 | 位置计算和滚动容器复杂。 | P2 | 选区上方稳定出现，不遮挡输入，不在预览触发。 | 新增 EditorPane tests/manual smoke |
| T-18 | 明确 P3 不做清单 | 防止路线被热点稀释。 | `CONTEXT.md:137`-`148`。 | Roadmap/README/CONTEXT 保留“暂不做”说明和重评条件。 | 可能被误解为永远不做。 | P3 | 文档说明“当前不做”和“何时重评”。 | 文档检查 |

## 建议执行顺序

立即做：T-01、T-02、T-03。它们分别守住输入、系统打开和真实性能证据，是后续体验优化的前提。

下一阶段：T-04、T-05、T-06、T-07、T-08、T-09、T-10。它们把高频路径统一起来，并把性能、错误和状态反馈产品化。

后续 phase：T-11 到 T-17。它们提升迁移体验、视觉系统、排版质量和编辑效率，但应在 P0/P1 稳定后进入。

暂不做：T-18 中列出的 AI、云、协作、插件、重型图谱和完整 block editor。除非用户重新定义产品定位，否则不进入近期实施。

## 建议验证命令

本轮只改评审文档，最低验证：

```bash
git status --short --branch
test -f docs/reviews/prism-multi-perspective-review-2026-06-16.md
rg -n "重度 Markdown|Typora|产品经理|跨平台视觉|阅读排版|品牌|交互动效|工程性能|P0|P1|P2|P3" docs/reviews/prism-multi-perspective-review-2026-06-16.md
git diff --check
```

后续实施时建议按影响范围补跑：

```bash
npm test -- --run src/app/useAppShortcuts.test.tsx
npm test -- --run src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts
npm test -- --run src/domains/editor/components/SplitView.test.tsx
npm test -- --run src/domains/editor/components/PreviewPane.test.tsx
PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose
npm test -- --run src/components/shell/CommandPalette.test.tsx src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx
npm test -- --run src/domains/export/preflight.test.ts
npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themeCss.test.ts
npm run build
```

## 未验证风险

- 本轮没有运行 Prism 真机 UI，也没有做 macOS/Windows/Linux 三平台默认 app 打开真机验证。
- 外部竞品只使用官方/一手资料做迁移心智校准，没有安装或实测 Typora、妙言、MarkText 的当前版本。
- 长文档性能结论来自仓库 jsdom/Node 记录和源码审查，真实 Tauri WebView 的拖动、搜索、右键和菜单响应仍需新增 harness。
- 视觉和排版建议基于 CSS/token/主题契约审查，尚未生成跨平台截图基准。
- P0/P1 优先级是基于用户价值、实现成本、风险和跨平台一致性的评审排序，不代表已经完成修复。
