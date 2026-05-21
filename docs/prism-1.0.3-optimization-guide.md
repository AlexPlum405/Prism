# Prism 1.0.3 产品优化指导方案

> 状态：已完成 / 历史归档
> 归档日期：2026-05-21
> 说明：本文件仅保留历史背景，不再作为后续 active plan 使用。当前待实施计划以 `docs/prism-next-optimization-implementation-plan.md` 为准。

日期：2026-05-14

## 1.0.3 核心定位

Prism 1.0.3 的目标不是继续做一个“像 Typora / 妙言的 Markdown 编辑器”，而是收束为：

> 开源、跨 macOS / Windows、审美克制、导出可靠的本地 Markdown 写作器。

这意味着 1.0.3 不追求插件生态、云同步、知识图谱或大型知识库能力，而是优先把单文档写作、主题一致性、导出完成度和双平台体验打磨到稳定可信。

Prism 最有机会占据的位置是：

- 比 Typora 更开放。
- 比妙言更跨平台。
- 比 Obsidian 更轻。
- 比 MarkText 更精致。
- 比 Zettlr / iA Writer 更适合“本地 Markdown + 漂亮导出”的日常工作流。

## 竞品结论

### Typora

Typora 的核心优势是成熟的所见即所得编辑体验、极低干扰的单文档写作心智、稳定导出和较好的系统集成。Prism 短期不应直接硬刚 Typora 的 WYSIWYG 编辑模型，而应围绕“源码编辑 + 高质量预览 + 高质量导出”形成清晰差异。

### 妙言

妙言的优势是 macOS 原生气质、审美统一、本地写作体验和轻量产品感。Prism 已经通过 Miaoyan compatibility mode 找到了接近妙言的体验入口，但 Prism 的机会在于跨平台和主题契约，而不是简单复刻妙言。

### MarkText

MarkText 的价值在于免费、开源、跨平台和 Markdown 编辑器基础能力完整。但从产品完成度、维护观感、视觉细节和导出体验来看，Prism 有机会做成更精致、更可信的开源跨平台选择。

### Obsidian

Obsidian 的优势是本地 Markdown、插件生态、双链、图谱和知识库扩展能力。Prism 不应进入 Obsidian 的知识系统战场，而应保持更轻的单文档写作定位。未来可以增加 wikilink、backlink、快速打开等能力，但不要让它们成为 1.0.3 主线。

### Zettlr

Zettlr 更适合学术写作、Pandoc、引用管理和长文工程。Prism 可以借鉴它的导出可靠性和长文稳定性，但不应复制学术工作台复杂度。

### iA Writer

iA Writer 的优势是写作专注、排版克制和品牌识别。Prism 可以学习它的克制感、默认体验和专注模式，但 Prism 的差异应落在开源、本地 Markdown 和跨平台导出。

## Prism 当前优势

### 1. 开源跨平台潜力

Prism 使用 Tauri 2 + React + TypeScript，天然具备 macOS / Windows 双平台基础。妙言的强项是 macOS 原生，但也因此难以覆盖 Windows 用户。Prism 可以服务“喜欢妙言审美，但需要 Windows 或双平台”的用户。

### 2. 单文档定位清晰

Prism 当前采用单文档单窗口模型，没有标签页，文件树是导航而不是文档容器。这让它更接近 Typora 的轻量写作心智，也避免 Obsidian 式知识库复杂度。

### 3. 主题架构具备差异化

Miaoyan compatibility mode 已经证明：主题不应只是换色，而应覆盖编辑器、预览、搜索、导出、代码高亮和状态栏等完整写作环境。这个方向可以成为 Prism 的长期差异化。

### 4. 导出能力有成为王牌的潜力

Prism 已经支持 HTML、PDF、Word (.docx)、PNG 图像导出。如果 Mermaid、表格、代码块、字体、分页和主题一致性能继续稳定下来，导出会成为 Prism 对 Typora / Zettlr 的核心竞争点。

### 5. GitHub 传播友好

Prism 的开源属性、截图、主题系统、导出能力和双平台潜力都适合 GitHub 传播。README、截图、演示视频和 roadmap 需要围绕这个定位强化。

## Prism 当前不足

### 1. 编辑体验还不是 Typora 级

Prism 当前是 CodeMirror 源码编辑 + 分栏/预览模式，而不是 Typora 式 live rendering。短期不要承诺 Typora 级 WYSIWYG，而应把源码编辑体验做到稳定、漂亮、快捷、可恢复。

### 2. 导出尚未产品化

虽然 Prism 已有四种导出格式，但导出还没有形成“导出工作台”。用户需要更明确的格式选择、纸张/尺寸、主题、代码样式、Mermaid 渲染、Word 样式模板和导出进度反馈。

### 3. 设置系统偏薄

Prism 需要一个真正的设置中心，覆盖字体、主题、默认视图、编辑行为、导出偏好、快捷键、文件行为和 Windows/macOS 平台差异。

### 4. 命令体系尚未统一

菜单、右键菜单、状态栏按钮、快捷键和命令面板当前仍存在多套入口。长期应统一为一个 typed command registry，各入口只负责展示和触发命令。

### 5. 核心模块偏大

`EditorPane`、`SplitView`、`exportDocument` 已经承担了较多职责。继续堆功能会增加回归风险，需要按领域能力拆分。

## 1.0.3 产品承诺

1. **Beautiful writing, plain Markdown**  
   写作体验要漂亮，但文件必须保持普通、干净、可迁移。

2. **One document, perfectly exported**  
   不做复杂知识库，先把一个 Markdown 文档从编辑到导出做到极致。

3. **macOS taste, Windows included**  
   审美向妙言/Typora 的克制方向靠近，但 Windows 不是附属版本，而是一等公民。

## 1.0.3 优先级

### P0：统一 Command System

目标：菜单、快捷键、右键菜单、命令面板、状态栏动作全部调用同一批命令。

建议建立统一命令注册表，每个命令至少包含：

- `id`
- `label`
- `category`
- `shortcut`
- `enabled(context)`
- `checked(context)`
- `run(context)`

收益：

- 避免菜单和快捷键不一致。
- 避免未实现命令散落在 UI 各处。
- 让未来 Windows/macOS 快捷键差异更容易管理。
- 让命令面板成为真实能力入口，而不是另一个平行列表。

### P0：导出工作台产品化

目标：把 HTML / PDF / Word / PNG 从“能导出”升级为“可靠、可预期、可配置、可复现”。

重点：

- Mermaid 导出必须是图，而不是原始代码。
- Word 表格必须按表格渲染，不允许空白。
- 代码块导出要接近编辑/预览效果，包括字体、行距、背景、语法高亮。
- PDF 导出不能让预览页面明显卡死或空白。
- HTML 导出必须可滚动，且保留主题排版。
- 导出交互要先确认保存位置，再进入明确进度状态。

建议将导出拆成 pipeline：

1. Markdown parse
2. HTML render
3. Mermaid render
4. Theme apply
5. Format adapter

### P1：设置中心补齐

目标：让用户能稳定控制 Prism 的主要行为，而不是依赖代码默认值。

建议 1.0.3 设置中心至少覆盖：

- 内容主题
- 界面主题
- 编辑字体与字号
- 预览字体与字号
- 默认视图模式
- 是否显示状态栏
- 是否显示侧边栏
- 导出默认格式
- PDF/PNG 默认尺寸或缩放
- 快捷键查看入口

### P1：主题契约制度化

目标：每个主题都是完整 compatibility mode，不是局部 CSS 覆盖。

每个主题必须覆盖：

- editor tokens
- preview tokens
- search tokens
- export tokens
- code highlight tokens
- Mermaid tokens
- selection tokens

主题验收必须包含：

- 编辑页
- 分栏页
- 预览页
- 搜索栏
- 右键菜单
- 导出 HTML/PDF/Word/PNG

### P2：Windows 一等体验

目标：Windows 不是“能跑”，而是体验可信。

重点：

- 快捷键文案按平台显示。
- 文件关联稳定。
- 安装包稳定。
- 路径处理稳定。
- 窗口行为符合 Windows 习惯。
- 导出默认目录和保存弹窗符合 Windows 用户预期。

## 架构优化路线

### Command Registry

将菜单、快捷键、右键菜单、状态栏、命令面板统一接入命令注册表。任何 UI 入口不得私有实现一套动作。

### Editor Extensions

将 CodeMirror 能力拆成独立扩展：

- formatting
- search
- selection
- markdown highlighting
- typewriter
- context menu

`EditorPane` 只负责装配，不继续承载所有编辑器行为。

### Export Domain

将导出能力从单个大文件拆成领域模块：

- Markdown/HTML 中间层
- Mermaid 渲染
- PDF adapter
- DOCX adapter
- PNG adapter
- HTML adapter
- Export progress
- Export save flow

所有格式共享同一份主题和 Markdown 语义结果，减少“预览好了但 Word/PDF 坏了”的问题。

### Theme Contract

把主题从样式集合升级为协议。每个主题必须显式声明编辑、预览、搜索、导出、代码和 Mermaid 的 tokens。

### Workspace Layer

未来文件能力应收敛到 workspace domain：

- 最近文件
- 快速打开
- 全局搜索
- 文件树排序
- 版本历史
- wikilink/backlink

这些能力不能直接塞进 editor domain。

## 不做什么

1.0.3 不优先做：

- 插件系统
- 云同步
- 多人协作
- 知识图谱
- 发布平台
- 完整 Typora 式 WYSIWYG

这些能力会扩大复杂度，削弱 Prism 当前最有机会的产品位置。

## 验收标准

1. README、截图、演示视频和产品文案都能清楚表达 Prism 的定位。
2. 菜单、右键、快捷键、命令面板不会出现互相矛盾或未实现入口。
3. 同一文档在编辑、预览、导出中的主题气质一致。
4. HTML / PDF / Word / PNG 四种导出均能处理表格、Mermaid、代码块和中文字体。
5. Windows 和 macOS 的核心体验都可作为正式版本发布。

## 参考链接

- Typora: https://typora.io/
- Typora Export: https://support.typora.io/Export/
- Typora Store: https://store.typora.io/
- MiaoYan: https://github.com/tw93/MiaoYan
- MarkText: https://github.com/marktext/marktext
- Obsidian: https://obsidian.md/
- Zettlr: https://zettlr.com/
- iA Writer: https://ia.net/writer
