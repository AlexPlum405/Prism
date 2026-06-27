# Prism

> 本地写作、完整预览、可信导出。

Prism 是一个跨平台 Markdown 桌面编辑器，适合写技术文档、研究笔记、产品方案、长文稿和可导出的正式材料。它直接读写本地文件，不把写作流程绑定到云端账号。

## 特点

- **清晰**：编辑、分栏、预览三种视图，单文档单窗口，写作心智简单
- **完整**：支持 GFM、表格、任务列表、脚注、KaTeX、Mermaid、PlantUML、Markmap 和本地图片预览
- **可信**：导出 PDF、Word、HTML、PNG 前后给出进度、成功反馈和失败诊断
- **本地**：支持 Markdown 和常见文本文件，如 `.txt`、`.json`、`.sql`
- **可迁移**：保留 Markdown 源码，不把文档锁进私有格式

## 首次使用

1. 打开一个 Markdown 文件，或打开一个包含 Markdown 文档的文件夹
2. 使用左侧文件树在工作区内切换文稿
3. 在标题栏确认保存状态，Prism 会自动保存已打开的本地文档
4. 在设置中选择默认视图、编辑字体、预览字体、主题和导出偏好
5. 如果只想查看文档，可切换到完整预览；如果要边写边看，可使用分栏

## 快捷键

### 文档与窗口

- `command + o` - 打开文件
- `command + p` - 快速打开工作区文件
- `command + shift + f` - 全文搜索工作区
- `command + s` - 保存
- `command + ,` - 打开设置
- `command + option + p` - 启动 Prism 演示预览

### 编辑与预览

- `command + f` - 查找
- `command + h` - 替换
- `command + k` - 插入链接
- `command + shift + k` - 插入代码块
- `command + shift + m` - 插入公式块
- `command + shift + x` - 插入任务列表
- `command + shift + l` - 自动排版当前 Markdown 文档
- `command + /` - 切换到编辑视图

## 实用功能

### 三态视图

- **编辑**：专注 Markdown 源码，适合快速输入和结构调整
- **分栏**：左侧编辑，右侧预览，适合检查排版和图表
- **预览**：完整阅读视图，适合作为导出前的排版基准

### Tab 快捷输入

在编辑器中输入 `/table` 等指令后按 `Tab`，Prism 会展开对应片段。

内置指令包括：`/time`, `/table`, `/img`, `/video`, `/markmap`, `/mermaid`, `/plantuml`, `/fold`, `/task`。

也可以从菜单栏 **格式 > Tab快捷输入** 直接插入同一批片段。

### Markdown 自动排版

粘贴或整理文稿后，可以按 `command + shift + l`，或从菜单栏选择 **格式 > 自动排版**。Prism 会保守整理标题、列表、任务项和空行，代码围栏内部内容不会被重写。

### 图表与知识关系

- Mermaid 用于流程图、时序图、状态图、思维导图等
- PlantUML / PUML 用于类图、组件图、时序图等
- Markmap 用于 Markdown 思维导图
- 当前文档存在链接关系时，状态栏会显示图谱入口
- 链接、反链、图谱和诊断面板用于检查文档之间的关系

### 演示预览

带有独立一行 `---` 分隔符的文档可以进入演示预览。演示预览复用 Prism 的 Markdown 渲染链路，因此表格、代码、公式、图表、HTML 布局都能在幻灯片中使用。

当前支持：

- `command + option + p` 启动
- 在编辑区或预览区右键选择 **演示预览**
- 左右方向键、空格、回车翻页
- `Esc` 退出
- `<!-- .slide: data-background="..." -->` 设置背景
- `<!-- .slide: data-background-iframe="..." -->` 设置网页背景
- `class="fragment"` 的元素按步骤渐显

## 与妙言文档能力对照

Prism 已覆盖妙言指南中的基础 Markdown、表格、代码高亮、数学公式、Mermaid、PlantUML/PUML、Markmap、引用、任务列表、脚注、分隔线、emoji、预览复选框勾选、Tab 快捷输入和 PPT/演示预览核心流程。

本轮补齐的兼容项：

- `H~2~O` 下标语法
- `16^世纪^` 上标语法
- `/time`, `/table`, `/img`, `/video`, `/markmap`, `/mermaid`, `/plantuml`, `/fold`, `/task` 的 `Tab` 展开
- 菜单栏 `格式 > Tab快捷输入`
- `command + option + p` 演示预览
- `command + shift + l` 自动排版
- `swift [1|2-4]` 这类 Reveal 风格代码高亮参数不会污染代码语言识别

Prism 不追求完全复刻 Reveal.js 的全部高级配置。演示预览优先保证 Markdown 文档在 Prism 内直接可讲、可读、可翻页。

## 为什么做 Prism

很多 Markdown 工具要么偏向实时预览，要么偏向知识库，要么偏向导出。Prism 选择把边界收紧：一个本地文件，一个可靠预览，一个可信导出链路。写作者可以保留 Markdown 的透明性，也能得到足够完整的桌面写作体验。
