# Prism design token audit

> 日期：2026-06-17  
> 范围：P2-02 token 语义审计  
> 依据：`CONTEXT.md`、ADR-0006、ADR-0008、`src/styles/tokens.css`、`src/styles/miaoyan.css`、`src/styles/content-themes.css`、`src/domains/themes/themeContract.ts`

## 结论

Prism 当前不适合做一次性 token 重命名。`--c-*` 名称来自历史 OpenAI 原型，但已经成为基础中性色、边框、hover、selection、动画和全局壳的稳定层；直接改名会影响状态栏、诊断、菜单、标题栏、导出渲染和多个 inline style。P2-02 的正确收口是文档化分层并禁止新增 OpenAI-only / Fluent-only / AppKit-only 语义。

## 当前分层

| 层级 | 代表 token | 当前来源 | 允许新增 | 迁移规则 |
|---|---|---|---|---|
| 历史核心层 | `--c-*`、`--font-*`、`--shadow-*`、`--duration-*`、`--ease-*` | `src/styles/tokens.css` | 允许，但命名必须解释为 Prism 跨平台写作器语义 | 作为基础 UI 真源继续保留，值可随主题调整 |
| 过渡兼容层 | `--bg-*`、`--text-*`、`--accent*`、`--stroke-*`、`--elevation-*`、`--radius-*` | `tokens.css` 和主题文件 | 不允许新增公共语义 | 只供旧 module CSS、导出背景读取和渐进迁移；按组件清理 |
| 主题层 | `--theme-*`、`--miaoyan-*`、`--inkstone-*`、`--slate-*`、`--mono-*`、`--nocturne-*`、`--preview-*`、`themeContract.ts` | `miaoyan.css`、`content-themes.css`、`themeContract.ts` | 允许，但必须同步主题契约或截图验证 | 主题专属值集中在主题文件和 contract，不散落到普通组件 |
| 组件局部层 | `--compat-*` 等 | 组件或兼容模块内部 | 允许局部使用 | 不作为跨模块 API；多个组件共用时上提到主题层或核心层 |

## 取证摘要

- `src/styles/tokens.css` 定义 `--c-*` 基础真源、动画、阴影、圆角，以及旧 `--bg-*` / `--text-*` / `--accent*` 兼容别名。
- `src/styles/miaoyan.css` 同时承担妙言主题真源、跨主题 AppKit/MiaoYan 外壳兼容，以及 `--compat-search-*` 局部搜索面板变量。
- `src/styles/content-themes.css` 为 `inkstone/slate/mono/nocturne` 定义主题私有前缀、`--theme-*` 通用主题别名和 `--preview-*` 预览参数。
- `src/domains/themes/themeContract.ts` 已覆盖 `editor`、`preview`、`search`、`export`、`code`、`mermaid`、`selection`，是主题能力契约，不需要重建主题系统。
- `docs/adr/0002-css-token-naming.md` 的“Batch 1 后不再两套并存”已经与现状不符；本轮由 ADR-0008 收束为渐进迁移。

## rg 证据

已执行以下审计命令：

```bash
rg -n --count-matches -- "--c-[A-Za-z0-9-]+" src/styles/tokens.css src/styles/miaoyan.css src/styles/content-themes.css src/components src/domains
rg -n --count-matches -- "--bg-[A-Za-z0-9-]+|--text-[A-Za-z0-9-]+|--accent[A-Za-z0-9-]*" src/styles/tokens.css src/styles/miaoyan.css src/styles/content-themes.css src/components src/domains
rg -n --count-matches -- "--theme-[A-Za-z0-9-]+" src/styles/miaoyan.css src/styles/content-themes.css src/components src/domains
rg -n --count-matches -- "--miaoyan-[A-Za-z0-9-]+|--inkstone-[A-Za-z0-9-]+|--slate-[A-Za-z0-9-]+|--mono-[A-Za-z0-9-]+|--nocturne-[A-Za-z0-9-]+" src/styles/miaoyan.css src/styles/content-themes.css src/components src/domains
rg -n --count-matches -- "--compat-[A-Za-z0-9-]+" src/styles/miaoyan.css src/styles/content-themes.css src/components src/domains
```

关键结果：

- `--c-*` 命中分布在 `tokens.css`、`miaoyan.css`、`content-themes.css`、shell CSS、状态栏、诊断、导出和设置面板，说明它已经是基础 UI 层。
- `--bg-*` / `--text-*` / `--accent*` 仍命中 `tokens.css`、主题文件、文件树、侧栏、导出背景和部分 editor runtime，说明它们不能立刻删除。
- `--theme-*` 命中主题文件、shell CSS、状态栏、导出 CSS 和主题测试，说明主题通用别名已经被跨模块读取。
- `--miaoyan-*` 和其他主题前缀主要集中在主题 CSS、shell/statusbar 少量兼容覆盖中，后续跨主题组件应优先改读 `--theme-*`。
- `--compat-*` 当前只在 `miaoyan.css` 搜索面板兼容段内出现，符合组件局部变量定位。

## 新增 UI 规则

1. 新 shell、状态栏、诊断、命令面板和普通控件默认用 `--c-*`、`--duration-*`、`--ease-*`、`--shadow-*`。
2. 新内容主题能力必须先进入 `themeContract.ts`，再映射到 `--theme-*` / `--preview-*`，并补主题测试或截图。
3. 新跨主题组件不要直接依赖 `--miaoyan-*`；如果必须兼容妙言，应同时给 `--theme-*` fallback。
4. 新代码不新增 `--bg-*`、`--text-*`、`--accent*` 公共别名；既有读取可以在组件迁移时逐步改掉。
5. 组件局部变量必须以组件或兼容模块为边界，不能被其他模块读取。

## 风险

- 直接重命名 `--c-*` 或删除过渡别名会造成广泛视觉回归，本阶段明确不做。
- 主题 CSS 中仍有大量硬编码颜色和 `!important` 覆盖，属于 P2-05/P2-06/P2-07 后续截图和动效治理范围。
- Windows/Linux 字体 fallback 和系统 chrome 密度仍需 P2-06 真机或截图审查补证。
