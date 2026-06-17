# Prism 图标规范

> 状态：P2-11 第一版  
> 日期：2026-06-18  
> 适用范围：Prism 桌面应用内 UI 图标、窗口控件、状态栏按钮、标题栏视图切换、菜单勾选、浮层工具按钮和品牌/app 图标资产。

## 目标

Prism 的图标系统服务跨平台 Markdown 写作器气质：安静、清楚、密度稳定、内容优先。新增图标必须在 macOS、Windows、Linux 三个平台都成立，不能只复刻某一个系统，也不能把按钮做成重装饰图案。

本规范不要求一次性替换全部手写 SVG。P2-11 的交付目标是建立可执行规则，后续新增或触达的图标按规则收口。

## 当前事实源

| 区域 | 现状 | 规范化结论 |
|---|---|---|
| App icon | `docs/assets/prism-icon-red-panda-app-icon.png` 通过 `scripts/generate-brand-icons.mjs` 生成 `src-tauri/app-icon.png`、PNG、ICO、ICNS 和 Windows logo assets | app icon 使用位图品牌资产链路，不和 UI 小图标共用 inline SVG 规则 |
| Tauri bundle | `src-tauri/tauri.conf.json` 使用 `icons/32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.icns`、`icon.ico` | 发布图标以生成脚本和 Tauri 配置为准 |
| 状态栏 | `StatusBar.tsx` 多数 inline SVG 使用 `viewBox="0 0 20 20"`，CSS 渲染为 14px，按钮命中区 22px | 状态栏图标视觉尺寸 14px，按钮固定 22px，不随 hover/active 改变尺寸 |
| 视图切换 | `ViewModeSwitch.tsx` 使用 20px 源网格，CSS 渲染为 18px，按钮 23px | 标题栏主功能切换可以用 18px 图标，但按钮尺寸稳定 |
| Windows/Linux 窗口控件 | `TitleBar.tsx` 使用 `viewBox="0 0 12 12"`，CSS 渲染为 12px，窗口按钮 44x40；MiaoYan 主题下 34x28 | 系统窗口控件是例外网格，按平台控件密度处理 |
| 菜单勾选 | `MenuDropdown.tsx` 使用 12px check icon | 菜单/勾选图标可使用 12px 细图标，不进入通用 toolbar 尺寸 |
| 选区格式工具栏 | `SelectionFloatingToolbar.tsx` 使用 B/I/U/S/H/`<>`/`[]`/`>` 文本符号 | 文本格式符号是编辑器语义例外，允许不用 SVG，但尺寸和命中区仍按 toolbar 规则 |

## 网格与尺寸

### 源网格

- 通用 UI 图标使用 `viewBox="0 0 20 20"`。
- 仅窗口控件、菜单勾选、极小状态标记可以使用 `12x12` 或 `16x16` 源网格。
- App icon、文件关联图标和导出内容中的 Mermaid/SVG 不适用 UI 小图标网格。

### 渲染尺寸

| 场景 | 图标视觉尺寸 | 命中区 | 备注 |
|---|---:|---:|---|
| 状态栏 icon-only button | 14px | 22x22 | 工作区、导出、关系图谱、专注模式等 |
| 标题栏视图切换 | 18px | 23x23 | edit / split / preview |
| 浮动工具栏 | 14-16px 或等效文本符号 | 28x28 | 表格工具栏、选区格式工具栏 |
| 命令面板/菜单行 | 12-14px | 跟随行高 | 勾选、搜索、轻量状态 |
| Windows/Linux 窗口控件 | 12px | 44x40 或主题覆盖值 | 最小化、最大化、关闭 |
| 空状态/品牌 mark | 按布局定义 | 不作为按钮时无命中区 | 不复用为操作 icon |

图标 hover、active、disabled 状态不得改变图标尺寸、按钮尺寸、布局 gap 或周围文字位置。

## 形态规则

### 默认形态

- 同一控件组内只能选择一种主形态：填充图标或线性图标，不混用。
- 现有状态栏和视图切换以填充图标为主；新增同组图标优先保持填充轮廓。
- 新增线性图标默认 `strokeWidth="1.4"`、`strokeLinecap="round"`、`strokeLinejoin="round"`，颜色使用 `currentColor`。
- 填充图标使用 `fill="currentColor"`，不内嵌硬编码色值。
- 网络/图谱类图标允许采用“线性边 + 填充节点”的混合形态，但只在关系图谱、拓扑、链接关系语义中使用。

### 几何

- 小图标尽量使用简单闭合形和少量路径，避免 14px 下糊成灰块。
- 轮廓角保持轻微圆角；线性图标优先 round cap / round join。
- 视觉重心必须居中。若图形天然偏重，需要在 path 内微调，不要用 CSS transform 在 hover/active 状态修正。
- 不使用复杂渐变、阴影、滤镜、发光或多色填充作为 UI 小图标。

## 状态与颜色

图标颜色由容器状态控制，SVG 本身只读取 `currentColor`。

| 状态 | 颜色来源 | 行为 |
|---|---|---|
| 默认 | `--c-graphite`、`--c-ash`、主题 secondary text | 低对比、可扫视 |
| Hover | `--c-void` 或主题 text | 只提升颜色/背景，不放大图标 |
| Active | `--c-void`、`--theme-accent`、`--miaoyan-accent` | 只在当前模式或已开启功能上使用 |
| Disabled | 主题 muted/secondary 透明度 | 不能和默认状态混淆 |
| Error/Failed | 现有错误色混合规则，例如 `#b42318` 与 token 混合 | 只用于保存失败、导出失败、诊断错误 |
| Close hover | 平台窗口控件例外，Windows/Linux 关闭按钮可使用红色背景 | 不扩展到普通 destructive action |

新增图标不得直接引入 OpenAI-only、Fluent-only、AppKit-only token 名称。颜色规则遵守 ADR-0008：优先 `--c-*`、主题 token 或组件局部变量。

## 交互与可访问性

- icon-only button 必须有本地化 `aria-label`，并同步提供 `title` 作为桌面 tooltip。
- 纯装饰 SVG 必须设置 `aria-hidden="true"` 和 `focusable="false"`。
- toolbar 必须使用合适的语义容器，例如 `role="toolbar"` 与本地化 `aria-label`。
- 如果按钮已有可见文本且文本足够表达操作，可不重复 aria-label；但图标仍应装饰化。
- 不用圆角文字胶囊代替熟悉符号。格式化符号 B/I/U/S、代码、链接、引用属于编辑器语义例外。
- Tooltip 文案描述动作，不描述图标外观；例如“查看关系图谱”，不是“图谱图标”。

## 文件与实现规则

新增图标优先放在使用它的组件附近，保持 inline SVG，除非同一图标被三个以上组件复用。复用达到阈值时再提升到共享 `Icon*` 组件，避免过早建立图标库。

新增图标组件必须满足：

```tsx
const IconExample = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="..." />
  </svg>
);
```

线性图标示例：

```tsx
const IconExampleLine = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="..." />
  </svg>
);
```

禁止事项：

- SVG 内写死普通 UI 颜色。
- hover/active 时切换为另一套 path 导致布局或重心跳动。
- 在状态栏新增文字+图标的大按钮，除非 CONTEXT.md 已明确这是状态反馈。
- 为单个新增图标引入整套图标依赖。
- 用 app icon 位图裁切成普通 toolbar 图标。

## 验收清单

每次新增或触达图标时至少检查：

- 图标源网格符合本规范，或明确属于窗口控件/菜单/品牌例外。
- 图标渲染尺寸和按钮命中区稳定，hover/active 不引发布局位移。
- 默认、hover、active、disabled/error 状态使用 token 或 `currentColor`。
- icon-only button 有本地化 `aria-label` 和 `title`；装饰 SVG 有 `aria-hidden` 和 `focusable=false`。
- macOS / Windows / Linux 模拟截图或真实截图中没有尺寸抖动、错位或过重视觉噪音。
- 相关组件测试或截图脚本通过；只改文档时至少跑 `git diff --check` 和规范关键字检查。

## 暂不做

- 不在 P2-11 全量替换 `StatusBar`、`ViewModeSwitch`、`TitleBar` 中的既有手写 SVG。
- 不引入外部图标库作为当前必要依赖。
- 不重绘 app icon；app icon 继续使用现有生成脚本和 Tauri 配置。
- 不把关系图谱内部节点、Mermaid 渲染 SVG、导出文档内 SVG 纳入 UI 图标规范。

