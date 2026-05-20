# Prism Theme Pack v1 实现方案

本文档定义 Prism 可插拔主题包第一版的产品目标、实现边界、四阶段任务、验证策略和 Computer Use 手工测试方案。执行时以本文为准，不再重新讨论已确认的产品边界。

## 1. 预期目标

Prism Theme Pack v1 的目标是把当前写死在代码里的内容主题，升级为可导入、可切换、可删除、可重载、可参与导出的本地写作主题包系统。

完成后应满足：

- 内置主题继续稳定可用：`miaoyan`、`inkstone`、`slate`、`mono`、`nocturne`。
- 用户可以从设置中心导入主题文件夹、`.zip`、`.prism-theme`。
- `.prism-theme` 本质是 zip，允许一层根目录，必须包含 `theme.json`。
- 主题安装后统一复制到 `appData/themes/{themeId}/`，运行时不依赖原始导入路径。
- 用户主题可以通过下拉框切换，菜单栏主题菜单也显示可用用户主题。
- 异常用户主题不进入菜单栏；设置中心显示但禁用，并标明异常。
- 自定义主题允许完整 scoped CSS，能覆盖内容体验外观，但不能破坏窗口结构和核心交互可达性。
- 主题可携带本地字体和本地预览图，不允许远程资源。
- HTML/PDF/PNG 尽量视觉保真；DOCX 使用主题基础字体、颜色、代码、图表配置做结构化保真。
- 主题失败时不白屏、不崩溃；能回退到 `miaoyan` 并给出可理解提示。

## 2. 已确认产品边界

### 2.0 视觉与产品定位

- Prism 当前主视觉以妙言风格为准，不再按旧 OpenAI 风格回退。
- 本需求只做可插拔主题包能力，不重做窗口布局、侧栏结构、标题栏、编辑区主交互和状态栏信息架构。
- 设置中心新增入口要沿用当前 Prism/Miaoyan 的轻量、克制、低噪声风格：仍用下拉框管理主题，不改成卡片市场。
- Prism 继续保持本地优先、单文档单窗口、Markdown 源码编辑器定位，不扩展成 Notion database、完整 block editor、云同步、实时协作或插件市场。

### 2.1 CSS 开放等级

选择 B 级能力：

- 允许主题 CSS 覆盖外壳、侧栏、状态栏、浮层、编辑器、预览、导出弹窗。
- 所有 CSS 必须 scoped 到 `html[data-content-theme='{themeId}']`。
- CSS 必须通过安全过滤和允许区域校验。
- 禁止 JS、远程 URL、`@import`、全局未限定选择器、危险布局规则。

### 2.2 安装形态

第一版同时支持：

- 主题文件夹导入。
- `.zip` 导入。
- `.prism-theme` 导入。

内部统一安装到：

```txt
appData/themes/{themeId}/
```

### 2.3 字体与预览图

允许主题包携带本地字体：

```txt
fonts/*.ttf
fonts/*.otf
fonts/*.woff
fonts/*.woff2
```

禁止：

```txt
@import
url(http://...)
url(https://...)
url(javascript:...)
```

预览图可选：

```txt
preview.png
preview.jpg
```

第一版设置中心仍使用下拉框，预览图不作为 UI 必需项。

### 2.4 外观可覆盖范围

允许覆盖内容体验外观：

- `.app-sidebar`
- `.sidebar`
- `.file-tree-*`
- `.statusbar`
- `.cmdk`
- `.modal`
- `.settings-*`
- `.compat-search-panel`
- `.custom-context-menu`
- `.cm-editor`
- `.preview-compat--{themeId}`
- `.prism-export-*`
- `.prism-diagnostics-*`

禁止破坏窗口结构和核心交互可达性：

- 不允许隐藏标题栏、主窗口、编辑器主体、设置入口。
- 不允许破坏 Tauri 拖拽区和窗口按钮。
- 不允许用超高 z-index 覆盖整个应用。
- 不允许对核心结构使用危险的 `display: none`、`pointer-events: none`、全屏 fixed overlay。

### 2.5 失败策略

导入时严格校验：

- 缺 `theme.json` 直接失败。
- `id` 不合法直接失败。
- `schemaVersion` 不支持直接失败。
- CSS 未 scoped 直接失败。
- CSS 含远程 URL 或危险规则直接失败。
- 字体文件缺失直接失败。
- 主题 id 命中内置主题直接失败。

运行时软回退：

- 当前主题缺失或损坏时回退 `miaoyan`。
- 用户尝试切换到异常主题时先快速检查，失败则不切换并提示。
- 字体加载失败时保留主题，但提示字体已回退。
- Mermaid 或 DOCX 子配置异常时使用 `miaoyan` fallback。

### 2.6 主题 id 与版本规则

主题 id 只能包含：

```txt
a-z
0-9
-
_
```

原因：id 会进入 CSS selector、className、目录名、Mermaid cache key、导出内联样式。

内置主题 id 保留，用户主题不能使用：

```txt
miaoyan
inkstone
slate
mono
nocturne
```

`schemaVersion` 控制 Prism 是否能加载主题。第一版只支持 `1`。

`version` 只用于展示，不参与兼容判断。

### 2.7 同 id 与删除规则

- 不允许覆盖内置主题。
- 同 id 用户主题允许确认后替换。
- 替换时必须先完整校验新主题，再备份旧主题，再替换。
- 替换失败必须恢复旧主题。
- 删除只允许删除用户主题。
- 删除当前主题前先回退 `miaoyan`，再删除 appData 里的主题目录。

### 2.8 设置中心入口

第一版继续使用下拉框，不做主题卡片。

设置中心 > 外观：

- `内容主题` 下拉框。
- `导入主题`：只安装，不应用。
- `导入并应用主题`：安装成功后切换到新主题。
- `打开主题目录`。
- `重新加载用户主题`。
- `删除当前用户主题`。

主题导入和管理只放设置中心。菜单栏只保留主题切换，不放导入、删除、重载。

### 2.9 菜单栏规则

- 菜单栏主题菜单显示内置主题和可用用户主题。
- 当前主题显示 checked 状态。
- 异常用户主题不进入菜单栏。
- 异常用户主题只在设置中心显示，并标明异常。

## 3. 主题包格式

推荐结构：

```txt
WarmPaper.prism-theme
├── theme.json
├── theme.css
├── preview.png
├── fonts/
│   └── WarmPaper.woff2
└── README.md
```

`theme.json` 示例：

```json
{
  "schemaVersion": 1,
  "id": "warm-paper",
  "name": "暖纸",
  "author": "Alex",
  "version": "1.0.0",
  "description": "适合中文长文和公众号预览",
  "isDark": false,
  "fonts": [
    {
      "family": "Warm Paper Serif",
      "file": "fonts/WarmPaper.woff2"
    }
  ],
  "previewImage": "preview.png",
  "contract": {
    "editor": {
      "background": "#fbfaf6",
      "text": "#25211c",
      "secondaryText": "#7d7468",
      "fontFamily": "\"Warm Paper Serif\", \"PingFang SC\", serif",
      "codeFontFamily": "\"JetBrains Mono\", Menlo, monospace",
      "lineHeight": 1.76
    },
    "preview": {
      "background": "#fbfaf6",
      "text": "#25211c",
      "fontFamily": "\"Warm Paper Serif\", \"PingFang SC\", serif",
      "fontSize": 16,
      "lineHeight": 1.78,
      "maxWidth": 960,
      "writeClass": "markdown-body heti warm-paper-write"
    },
    "search": {
      "background": "#f0ece3",
      "text": "#25211c",
      "secondaryText": "#7d7468",
      "fieldBackground": "#fbfaf6",
      "fieldBorder": "#d8d0c2",
      "focus": "#6b5a3e",
      "shadow": "0 10px 24px rgba(44, 35, 24, 0.14)",
      "fontFamily": "\"Warm Paper Serif\", \"PingFang SC\", serif"
    },
    "export": {
      "writeClass": "markdown-body heti warm-paper-write",
      "docx": {
        "font": "Songti SC",
        "codeFont": "Menlo",
        "text": "25211C",
        "muted": "756D62",
        "accent": "6B5A3E",
        "fill": "F3EFE6",
        "border": "D8D0C2"
      }
    },
    "code": {
      "background": "#f3efe6",
      "inlineBackground": "#eee7db",
      "text": "#25211c",
      "comment": "#8c8274",
      "keyword": "#7a4f34",
      "string": "#506f48",
      "meta": "#7b6150",
      "attribute": "#516c72",
      "symbol": "#6b5a3e"
    },
    "mermaid": {
      "theme": "base",
      "fontSize": 15,
      "fontFamily": "\"Warm Paper Serif\", \"PingFang SC\", serif",
      "fontLoadFamily": "\"Warm Paper Serif\"",
      "themeVariables": {
        "background": "#fbfaf6",
        "primaryColor": "#fffdf8",
        "primaryTextColor": "#25211c",
        "primaryBorderColor": "#6b5a3e",
        "lineColor": "#6b5a3e",
        "textColor": "#25211c"
      }
    },
    "selection": {
      "background": "#ded6c7",
      "text": "#25211c",
      "matchBackground": "rgba(107, 90, 62, 0.15)",
      "currentMatchBackground": "#6b5a3e",
      "currentMatchText": "#fbfaf6"
    }
  }
}
```

`theme.css` 示例：

```css
html[data-content-theme='warm-paper'] {
  --theme-main-bg: #fbfaf6;
  --theme-pane-bg: #f6f1e8;
  --theme-text: #25211c;
  --theme-secondary-text: #7d7468;
  --theme-divider: #d8d0c2;
  --theme-accent: #6b5a3e;
}

html[data-content-theme='warm-paper'] .app-sidebar {
  background: var(--theme-pane-bg);
}

html[data-content-theme='warm-paper'] .cm-editor {
  background: var(--theme-main-bg);
}

html[data-content-theme='warm-paper'] .preview-compat--warm-paper #write {
  max-width: 960px;
}
```

## 4. 实现阶段

这次 goal 要一次性跑完，但实现过程按四阶段推进。每个阶段都要形成可验证闭环，阶段之间可以连续执行，不需要等用户确认，除非触发暂停条件。

### 阶段 1：主题 Registry 与用户主题读取

目标：启动时能扫描 appData 主题目录，加载合法用户主题，并让设置中心和菜单栏能切换这些主题。

建议新增或调整：

- `src/domains/themes/themeRegistry.ts`
- `src/domains/themes/themePackage.ts`
- `src/domains/themes/themeCss.ts`
- `src/domains/themes/themeStorage.ts`
- `src/domains/themes/themeErrors.ts`
- `src/domains/settings/types.ts`
- `src/domains/settings/normalize.ts`
- `src/domains/settings/store.ts`
- `src/components/shell/SettingsModal.tsx`
- `src/domains/commands/categories/themeCommands.ts`
- `src/domains/editor/components/PreviewPane.tsx`
- `src/domains/editor/components/EditorPane.tsx`

关键实现：

- 保留内置主题为静态 `builtInThemeContracts`。
- 新增 runtime `themeRegistry`，包含 built-in、user、invalid 三类主题元数据。
- `getThemeContract(themeId)` 先查 registry，缺失时 fallback `miaoyan`。
- `contentTheme` 设置从固定 union 扩展为字符串型 `ThemeId`，但内置主题仍保留类型约束辅助。
- `isContentTheme` 改为兼容内置主题和已注册用户主题；未知主题在 runtime 不能直接应用。
- 设置加载时先初始化 theme registry，再应用 `contentTheme`。
- 如果配置里的当前主题缺失或异常，自动回退 `miaoyan` 并保存。
- CSS 注入用 `<style data-prism-theme-style="{themeId}">`。
- 用户主题 class 继续使用 `preview-compat--{themeId}`。
- 菜单栏主题命令动态来自 registry，而不是固定五个命令。

阶段 1 验证：

- 单元测试 registry 注册、fallback、异常主题。
- 设置 normalize 保留用户主题 id，但应用前会校验 registry。
- PreviewPane 用户主题 class 和 Mermaid config 使用 registry。
- 菜单栏只显示可用主题。

### 阶段 2：导入、删除、重载

目标：用户能从设置中心导入主题、导入并应用、打开主题目录、重载主题、删除当前用户主题。

建议新增或调整：

- `src/domains/themes/themeInstaller.ts`
- `src/domains/themes/themeZip.ts` 或 Tauri Rust command
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
- `src/components/shell/SettingsModal.tsx`
- `src/domains/settings/store.ts`

关键实现：

- 设置中心仍使用下拉框。
- 新增按钮：`导入主题`、`导入并应用主题`、`打开主题目录`、`重新加载用户主题`、`删除当前用户主题`。
- `导入主题`：安装成功后刷新列表，不应用。
- `导入并应用主题`：安装成功后切换到新主题并保存设置。
- `.prism-theme` 和 `.zip` 作为 zip 处理；支持文件夹导入。
- zip 解包必须防路径穿越：拒绝 `../`、绝对路径、空路径、写出目标目录外。
- 当前 package.json 没有直接声明 zip 库；实现时不要依赖传递依赖。可选方案：
  - Rust 侧增加明确 zip crate，Tauri command 负责解包和路径校验。
  - 或前端增加明确直接依赖，如 `fflate`/`jszip`，并在 TypeScript 层做路径校验。
- 同 id 规则：
  - 命中内置主题：拒绝。
  - 命中用户主题：弹确认，确认后先校验新主题，再备份旧目录，再替换，失败恢复旧目录。
- 删除当前用户主题：先切回 `miaoyan`，再删除目录。
- 重新加载：重新读取 appData themes，重新校验、注入 CSS、刷新菜单和下拉框。

阶段 2 验证：

- 合法文件夹主题导入成功。
- 合法 zip 和 `.prism-theme` 导入成功。
- 路径穿越 zip 被拒绝。
- 内置 id 被拒绝。
- 同 id 用户主题替换确认后成功，失败恢复旧主题。
- 删除当前主题后回退 `miaoyan`。

### 阶段 3：导出链路接入

目标：HTML/PDF/PNG/DOCX 导出都读取用户主题 contract 和必要 CSS。

建议调整：

- `src/domains/export/exportSettings.ts`
- `src/domains/export/exportPipeline.ts`
- `src/domains/export/adapters/html.ts`
- `src/domains/export/adapters/pdf.ts`
- `src/domains/export/adapters/png.ts`
- `src/domains/export/adapters/docx.ts`
- `src/domains/export/rendering.ts`
- `src/domains/export/diagnostics.ts`
- `src/domains/editor/components/PreviewPane.tsx`

关键实现：

- HTML 导出：
  - 注入用户主题 contract 产生的 CSS variables。
  - 注入 sanitized `theme.css`。
  - 注入或引用本地字体，确保离线可打开。
- PDF/PNG：
  - 复用同一套预览 DOM 和用户主题 CSS。
  - 等待字体和 Mermaid 渲染完成后再截图/打印。
- DOCX：
  - 使用用户主题的 `export.docx`。
  - 复杂 CSS 不做完整 Word 映射。
  - Mermaid、复杂 SVG、复杂 HTML 优先图片化，保持视觉接近预览。
- 导出诊断增加主题信息：
  - 当前主题 id、名称、来源 built-in/user/fallback。
  - 用户主题 CSS 是否启用。
  - 字体是否回退。

阶段 3 验证：

- 用户主题下 HTML 导出包含主题样式。
- PDF/PNG 基础视觉跟随主题，不回退到内置主题。
- DOCX 使用用户主题 docx 字体、颜色和代码块配置。
- Mermaid 使用用户主题 contract。
- 导出失败诊断能说明主题来源和 fallback 状态。

### 阶段 4：样例主题、文档、Computer Use smoke

目标：提供样例主题包和真实 app 验收证据，证明端到端可用。

建议新增：

- `docs/examples/themes/warm-paper/theme.json`
- `docs/examples/themes/warm-paper/theme.css`
- `docs/examples/themes/bad-unsafe-css/theme.json`
- `docs/examples/themes/bad-unsafe-css/theme.css`
- `docs/examples/themes/broken-missing-font/theme.json`
- `docs/verification/prism-theme-pack-v1-smoke.md`

样例主题至少包含：

- 一个合法主题：`warm-paper`。
- 一个不安全 CSS 主题：验证导入失败。
- 一个缺失字体主题：验证错误提示。

Computer Use smoke 写入 `docs/verification/prism-theme-pack-v1-smoke.md`，记录：

- app 启动方式。
- 测试文件路径。
- 导入主题步骤。
- 设置中心截图观察点。
- 编辑/预览/菜单栏/导出检查结果。
- 已跑命令和结果。

## 5. 自动验证策略

按风险分层执行，不为了文档改动跑发布级 smoke。

阶段内建议命令：

```bash
npm test -- --run src/domains/themes
npm test -- --run src/domains/settings
npm test -- --run src/components/shell/SettingsModal.test.tsx
npm test -- --run src/domains/editor/components/PreviewPane.test.tsx
npm test -- --run src/domains/export
npm test -- --run
npm run build
git diff --check
```

如果新增或修改 Rust/Tauri 命令：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

如果触及真实 app 启动、Tauri capability、导入 zip/文件夹、导出真实文件：

```bash
npm run tauri:build:app-smoke
```

不要因为主题 UI 小改动跑 DMG、签名、公证、updater、安装器级验证；只有触及这些链路才做发布级 smoke。

## 6. Computer Use 手工测试方案

使用真实 macOS `Prism.app`，不要用浏览器替代。

### 准备

- 构建或启动最新 app。
- 准备一个复杂 Markdown 文件，包含：
  - h1-h4
  - 段落、列表、任务列表
  - blockquote
  - Callout
  - Toggle
  - 表格
  - fenced code
  - inline code
  - Mermaid
  - KaTeX
  - 本地图片
  - `<mark>`、`<kbd>`、`<abbr>`
- 准备三个主题：
  - 合法 `warm-paper`
  - 不安全 CSS 主题
  - 缺字体或缺 CSS 的异常主题

### 测试 1：导入但不应用

1. 打开 Prism。
2. 打开设置中心 > 外观。
3. 点击 `导入主题`。
4. 选择合法主题。
5. 观察：下拉框出现新主题，但当前主题不变。
6. 打开菜单栏主题菜单，观察新主题出现。

### 测试 2：导入并应用

1. 点击 `导入并应用主题`。
2. 选择合法主题或另一个合法主题。
3. 观察：设置保存，编辑器、预览、侧栏、状态栏、菜单浮层切换到新主题。
4. 重启 app。
5. 观察：用户主题仍然生效。

### 测试 3：核心 UI 跟随主题

1. 切换到用户主题。
2. 打开命令面板。
3. 打开搜索面板。
4. 打开右键菜单。
5. 打开导出弹窗。
6. 观察这些浮层没有回退到 `miaoyan`，也没有文字重叠、透明异常、不可点击区域。

### 测试 4：预览复杂 Markdown

1. 打开复杂 Markdown 文件。
2. 切换编辑/分栏/预览三态。
3. 观察：
   - 源码编辑器配色跟随主题。
   - 预览正文、标题、表格、代码块、Callout、Toggle 跟随主题。
   - Mermaid 正常渲染，文字和箭头不丢失。
   - KaTeX 正常显示。

### 测试 5：导出

1. 在用户主题下分别导出 HTML/PDF/PNG/DOCX。
2. 观察：
   - HTML/PDF/PNG 基础视觉跟随主题。
   - DOCX 字体、颜色、代码块、Mermaid 图片跟随主题基础配置。
   - 导出诊断里能看到当前主题来源。

### 测试 6：异常主题

1. 导入不安全 CSS 主题。
2. 观察：导入失败，显示明确原因。
3. 手动破坏已安装用户主题目录，例如删除 `theme.css` 或字体。
4. 回到 Prism，点击 `重新加载用户主题`。
5. 观察：
   - 该主题在设置中心显示为异常并禁用。
   - 菜单栏不再显示该主题。
   - 尝试应用该主题时提示异常，不切换。

### 测试 7：删除与替换

1. 当前使用用户主题时点击删除。
2. 观察：先回退 `miaoyan`，再删除用户主题。
3. 导入同 id 用户主题。
4. 观察：提示确认替换。
5. 取消时旧主题保留。
6. 确认时新主题校验通过后替换；失败时旧主题保留。

## 7. 完成条件

本需求完成必须同时满足：

- 四个阶段全部实现。
- 设置中心能完成导入、导入并应用、打开目录、重载、删除。
- 菜单栏能切换内置主题和可用用户主题。
- 异常主题处理符合本文规则。
- HTML/PDF/PNG/DOCX 导出接入用户主题。
- 样例主题与异常主题样例已加入文档目录。
- 自动测试、构建、diff check 通过。
- 需要时真实 app smoke 通过，并更新 `docs/verification/prism-theme-pack-v1-smoke.md`。
- 所有改动已提交并推送。

## 8. 暂停条件

遇到以下情况先暂停并说明，不要硬做：

- 需要破坏性 git 操作，如 reset、checkout、revert 用户改动。
- 需要发布签名、公证、生产发布权限。
- 需要引入高风险第三方依赖且无法确认许可证或安全性。
- 主题 CSS 安全策略无法同时满足可用性和恢复能力。
- 现有无关脏改阻止安全提交，且无法只提交本需求文件。
