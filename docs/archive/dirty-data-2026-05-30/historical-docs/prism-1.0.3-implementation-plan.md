# Prism 1.0.3 详细优化实施方案

> 状态：已完成 / 历史归档
> 归档日期：2026-05-21
> 说明：本文件仅保留历史背景，不再作为后续 active plan 使用。当前待实施计划以 `docs/prism-next-optimization-implementation-plan.md` 为准。

## 1. 产品目标

Prism 1.0.3 的目标不是成为 Typora 式所见即所得编辑器，也不在本阶段扩展插件、云同步或知识图谱，而是把定位收束为：

> 开源、跨 macOS / Windows、审美克制、导出可靠的本地 Markdown 写作器。

对应的产品承诺：

- **Beautiful writing, plain Markdown**：保持源码 Markdown 的可控性，但让写作界面足够安静、精致、稳定。
- **One document, perfectly exported**：以单文档为核心，把 PDF / HTML / Word / PNG 导出做成可依赖的生产能力。
- **macOS taste, Windows included**：保留 macOS 风格的克制与细节，同时把 Windows 当作一等平台处理。

## 2. 实施原则

- 不引入 Redux、XState 或大型新状态库，继续使用 Zustand。
- 不引入 Pandoc 作为 1.0.3 必需依赖，避免破坏开箱即用体验。
- 不实现 Typora 式 WYSIWYG，继续强化源码编辑、预览、搜索和导出。
- 不再新增空壳菜单。任何菜单、快捷键、右键菜单、命令面板入口都必须对应真实命令。
- 每个主题都必须覆盖编辑、预览、搜索、导出、代码高亮、Mermaid、选区等关键区域。
- Windows 体验必须在架构层保留入口，不把路径、快捷键、保存位置等逻辑散落在组件里。

## 3. 主线一：统一 Command System

### 3.1 技术选择

使用 TypeScript typed command registry、React hooks 与现有 Zustand store context。

### 3.2 目录结构

```txt
src/domains/commands/
  index.ts
  types.ts
  platform.ts
  registry.ts
  menuModel.ts
```

### 3.3 核心类型

```ts
type CommandId = 'new' | 'open' | 'save' | 'exportPdf' | 'bold' | ...

interface CommandDefinition {
  id: CommandId;
  label: string;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: ShortcutBinding;
  enabled?: (context: CommandContext) => boolean;
  checked?: (context: CommandContext) => boolean;
  run: (context: CommandContext) => void | Promise<void>;
}
```

### 3.4 实现方式

第一阶段先建立命令注册表，并让 `runCommand()` 复用现有 `executeMenuAction()`，避免一次性重写所有行为逻辑。随后逐步把 `executeMenuAction()` 里的 switch 拆成独立命令 handler。

接入点：

- `MenuBar`：读取 `getMenuSections(context)`，不再自己维护 checked 状态。
- `CommandPalette`：读取 `getCommandPaletteItems(context)`，快捷键按平台渲染。
- `App` 全局快捷键：通过 `findCommandByKeyboardEvent(event)` 找命令，再调用 `handleMenuAction(commandId)`。
- 状态栏导出菜单：从 registry 读取导出命令，避免状态栏和顶部菜单各写一份。
- 右键菜单：后续迁移到 registry，保留上下文菜单特有的 visible/disabled 条件。

### 3.5 为什么用这个技术

TypeScript 联合类型能在编译期阻止无效命令 id；registry 能把菜单、快捷键、命令面板、右键菜单统一到单一事实源；React/Zustand context 能复用当前 store，不需要引入新状态体系。

### 3.6 优势

- 命令只定义一次，避免菜单和快捷键漂移。
- enabled / checked / shortcut 统一计算。
- macOS 显示 `⌘`，Windows/Linux 显示 `Ctrl`。
- 命令面板可以天然复用所有真实命令。

### 3.7 不足与风险

- 初期迁移会触碰 `App.tsx`、`MenuBar`、`menuActions` 等多个入口。
- 若直接删除旧 switch，风险较高；因此 1.0.3 采用“registry 先接管入口，handler 后续拆分”的渐进策略。

### 3.8 验收标准

- 任一命令只定义一次。
- 顶部菜单、命令面板、全局快捷键至少共享同一 `CommandId` 和 shortcut 定义。
- 不再出现“即将推出”的空壳命令入口。
- 当前视图、主题、侧边栏、专注模式、打字机模式、状态栏显示 checked 状态正确。

## 4. 主线二：导出工作台产品化

### 4.1 技术选择

使用 Unified / remark AST、浏览器 DOM 渲染中间层、Mermaid DOM hydration、html2canvas、docx 与 Tauri fs。

### 4.2 目标目录结构

```txt
src/domains/export/
  index.ts
  types.ts
  exportPipeline.ts
  renderMarkdownDocument.ts
  renderMermaid.ts
  exportSettings.ts
  adapters/
    html.ts
    pdf.ts
    docx.ts
    png.ts
```

### 4.3 数据流

```txt
Markdown
  -> remark AST
  -> HTML document model
  -> Mermaid image hydration
  -> theme application
  -> HTML / PDF / DOCX / PNG adapter
  -> Tauri fs write
```

### 4.4 为什么用这个技术

当前导出逻辑集中在 `exportDocument.ts`，HTML、PDF、PNG、DOCX 共享不足。使用 AST 和中间层后，表格、Mermaid、代码块、KaTeX、图片等复杂节点可以先统一解析，再分别适配不同输出格式。

### 4.5 优势

- Mermaid、表格、代码块只需要在 pipeline 层修一次。
- 格式 adapter 职责清晰，便于定位问题。
- 导出进度可拆成阶段提示，减少“卡住”的体感。
- 后续可加入模板、页眉页脚、纸张尺寸、主题导出预设。

### 4.6 不足与风险

- DOCX 与 HTML/CSS 模型天然不同，无法完全共享浏览器样式。
- DOCX 表格、代码块、Mermaid 需要专门映射，不能只依赖 HTML 字符串。
- PDF/PNG 继续依赖浏览器 DOM，必须控制渲染容器生命周期，避免把预览页面卡空。

### 4.7 验收标准

- 四种导出都正确处理中文、表格、Mermaid、KaTeX、代码块、图片。
- HTML 导出可滚动，结构完整。
- PDF 导出不让当前预览区域长时间空白。
- Word 不出现空白表格，Mermaid 以图片而不是源码导出。

## 5. 主线三：编辑器模块化

### 5.1 技术选择

使用 CodeMirror 6 extensions、ViewPlugin、StateField 与 Compartment。

### 5.2 目标目录结构

```txt
src/domains/editor/extensions/
  formatting.ts
  search.ts
  selection.ts
  markdownHighlight.ts
  typewriter.ts
  contextMenu.ts
  index.ts
```

### 5.3 实现方式

`EditorPane.tsx` 最终只负责：

- 创建和销毁 `EditorView`
- 装配 extensions
- 暴露 imperative handle
- 将外部文档内容同步到 editor

格式化、搜索、选区装饰、Markdown 代码高亮、打字机模式、右键菜单逐步移动到 extension 文件。

### 5.4 为什么用这个技术

CodeMirror 的正确扩展点就是 extension 与 StateField。如果继续把能力写在 React 组件里，undo history、selection、search state、decorations 很容易互相影响。

### 5.5 优势

- 每个编辑能力可独立测试。
- Command System 能直接调用 editor command。
- 未来新增编辑能力不会继续撑大 `EditorPane.tsx`。

### 5.6 不足与风险

- CodeMirror extension 抽象门槛较高。
- 拆分时必须保护 undo history、selection restore、search restore。

### 5.7 验收标准

- 粗体、斜体、下划线、删除线可撤销。
- 搜索跨编辑、预览、分栏保持 query、replace、当前命中项。
- 切换视图不丢当前搜索项。
- 当前匹配项尽量滚动到窗口中间。

## 6. 主线四：设置中心补齐

### 6.1 技术选择

继续使用 Zustand store、Tauri appData `config.json` 与 React controlled form。

### 6.2 新增设置字段

- `editorLineHeight`
- `previewFontFamily`
- `previewFontSize`
- `defaultViewMode`
- `exportDefaults`
- `shortcutStyle`

### 6.3 UI 分组

设置中心保留现有 `SettingsModal`，逐步分成：

- 编辑器
- 外观
- 导出
- 快捷键
- 文件

### 6.4 为什么用这个技术

项目已经使用 Zustand 与 appData JSON，继续沿用可以减少迁移成本；用户配置保持本地、透明、可恢复。

### 6.5 优势

- 不引入新状态库。
- 与现有 `config.json` 兼容。
- 导出和主题效果可以被用户稳定复现。

### 6.6 不足与风险

- 配置项增多后 UI 容易复杂，必须按核心体验克制分组。
- 嵌套默认值需要迁移合并，不能简单浅合并。

### 6.7 验收标准

- 旧 config 可正常加载。
- 缺失字段回落默认值。
- 设置变更即时影响编辑器、预览和导出默认值。

## 7. 主线五：Theme Contract 制度化

### 7.1 技术选择

使用 TypeScript theme contract、CSS custom properties 与 export theme adapters。

### 7.2 目标文件

```txt
src/domains/themes/themeContract.ts
```

每个主题必须声明：

- editor tokens
- preview tokens
- search tokens
- export tokens
- code tokens
- mermaid tokens
- selection tokens

### 7.3 为什么用这个技术

当前主题已经覆盖很多区域，但 token 分散在 CSS、导出代码、预览组件、编辑器组件中。Theme Contract 可以把“一个主题必须完整覆盖哪些区域”制度化。

### 7.4 优势

- 新主题有固定验收清单。
- 导出和预览更一致。
- 减少“某主题某区域漏改”的问题。

### 7.5 不足与风险

- 完全 token 化需要多轮迁移。
- 复杂排版仍可能需要主题专属 CSS。

### 7.6 验收标准

- 五个主题都能通过 contract completeness 检查。
- 编辑、分栏、预览、搜索、菜单、导出使用一致 token 来源。

## 8. 主线六：Workspace 与 Windows 一等体验

### 8.1 技术选择

使用 Tauri fs / opener / dialog APIs、平台检测与 workspace domain services。

### 8.2 目标目录结构

```txt
src/domains/workspace/
  services/
    platform.ts
    path.ts
    recentFiles.ts
    fileAssociation.ts
    quickOpen.ts
```

### 8.3 实现方式

将最近文件、快速打开、文件树排序、全局搜索、路径复制、文件关联等能力逐步收敛到 workspace domain。

Windows 专项：

- 快捷键显示 `Ctrl` / `Alt` / `Shift`
- 路径分隔符处理
- 保存弹窗默认目录
- 文件关联测试
- 安装包 smoke checklist
- 窗口行为差异记录

### 8.4 为什么用这个技术

Tauri 已经提供跨平台系统 API，集中在 workspace domain 里封装，可以减少组件层平台判断和路径拼接。

### 8.5 优势

- 双平台行为集中管理。
- 路径、快捷键、窗口行为不再散落。
- 为 Windows 正式发布打基础。

### 8.6 不足与风险

- Windows 验证需要真实机器或 CI runner。
- Tauri 窗口行为存在平台差异，不能只靠 macOS 推断。

### 8.7 验收标准

- macOS 显示 `⌘` 文案，Windows 显示 `Ctrl` 文案。
- 文件打开、保存、导出、路径复制在双平台一致可用。
- Windows 安装包有独立 smoke checklist。

## 9. 推荐实施顺序

1. Command System：统一菜单、快捷键、右键菜单、命令面板的入口。
2. Export Domain：拆出导出 pipeline 和四个 adapter。
3. Editor Extensions：拆分搜索、格式化、选区、typewriter、context menu。
4. Settings Center：补齐编辑、外观、导出、快捷键、文件设置。
5. Theme Contract：让主题覆盖范围制度化。
6. Windows 验收：补安装包、文件关联、路径、快捷键文案检查。

## 10. 测试计划

- 单元测试：
  - command registry 的 enabled / checked / run
  - shortcut 平台渲染与 keyboard event 匹配
  - formatting wrapper
  - search pattern
  - theme contract completeness
  - export AST mapping
- 组件测试：
  - MenuBar
  - ContextMenu
  - CommandPalette
  - SettingsModal
  - SearchPanel
  - StatusBar
- 导出回归文档：
  - 标题
  - 列表
  - 表格
  - Mermaid
  - KaTeX
  - 代码块
  - 中文
  - 图片
- 构建验证：
  - `npm run build`
  - 必要时 `npm run tauri -- build --bundles app`
- 人工验收：
  - macOS 检查菜单、快捷键、导出。
  - Windows 检查安装包、文件关联、路径、快捷键文案。

## 11. 风险控制

- Command System 先以 registry 接管入口，旧 `executeMenuAction()` 暂时作为 handler 层保留。
- 导出域拆分时先写 adapter 包装层，再迁移 `exportDocument.ts` 内部逻辑。
- EditorPane 拆分时每次只移动一个 extension，移动后立即验证 undo、selection、search。
- SettingsState 新字段必须有默认值与迁移合并逻辑。
- Theme Contract 先做 completeness 检查，再逐步把 CSS token 收敛到 contract。

## 12. 当前阶段落地范围

本阶段先完成 1.0.3 架构的低风险底座：

- 新增本实施方案文档。
- 新增 Command Registry，并接入菜单、命令面板、全局快捷键、状态栏导出菜单。
- 新增 Theme Contract 基础文件，为后续主题一致性检查做准备。
- 扩展 SettingsState 的 1.0.3 字段，并保持旧配置向后兼容。

导出工作台、Editor Extensions 深度拆分、设置中心完整 UI、Windows 真机验收将在后续阶段按本方案继续推进。
