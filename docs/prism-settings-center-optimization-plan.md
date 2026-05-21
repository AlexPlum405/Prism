# Prism 设置中心完整优化 Plan

> 状态：已完成 / 历史归档
> 归档日期：2026-05-21
> 说明：本文件仅保留历史背景，不再作为后续 active plan 使用。当前待实施计划以 `docs/prism-next-optimization-implementation-plan.md` 为准。

> 版本：1.0.3 设置中心专项  
> 目标文件：`docs/prism-settings-center-optimization-plan.md`  
> 参考原型：`docs/prism-settings-center-prototype.html`  
> 执行原则：按本文执行，分阶段 commit + push；不要扩散到无关功能。

## 1. 背景与问题

当前 Prism 已经有 `SettingsModal`、settings store、主题契约、导出域和统一命令系统，但设置中心仍像“功能堆叠面板”，没有形成清晰的产品边界。

当前主要问题：

- 菜单入口不合理：此前新增了顶级 `Prism` 菜单；当前产品判断是自绘跨平台菜单，不应为了少量入口新增品牌菜单。
- 设置项边界混乱：`专注模式 / 打字机模式` 是当前视图动作，不是长期偏好。
- 暴露了半成品能力：`auto/light/dark` 外壳外观底层字段存在，但完整深浅外观没有产品化，不应出现在设置中心。
- 主题设置缺位：写作主题是 Prism 的核心体验，却不在设置中心里。
- 字体设置不够产品化：当前字体下拉暴露 CSS 字体串，且不支持用户导入字体。
- 导出设置不完整：已有 HTML 包含主题、PNG scale，但 PDF 纸张/边距仍是固定代码。
- 自动保存设置过于工程化：当前暴露毫秒级间隔，普通用户不需要理解 500ms/10000ms。

本轮目标不是重做整个 Prism，而是把“设置中心”这条产品线做完整。

## 2. 产品目标

将设置中心重构为 Prism 的长期偏好中心：

- 菜单入口符合桌面软件直觉。
- 设置中心 UI 与当前写作主题一致。
- 设置项只展示真实可用、长期生效的能力。
- 用户可导入本地字体，并应用到编辑器和预览。
- PDF 导出可配置纸张和边距。
- 自动保存可配置开关和清晰的保存策略。
- DOCX 导出可使用导入字体，并尽量嵌入字体文件。
- 导出模板系统可配置并被 PDF/HTML/PNG/DOCX 使用。
- 用户可设置默认导出目录。
- Prism 可显示最近文档，并可恢复上次窗口。

成功状态：

- 用户从 `文件 -> 设置中心` 打开设置。
- 用户能在设置中心完成写作主题、字体、排版、导出、保存相关配置。
- 所有设置重启后仍生效。
- 设置中心在五个主题下都像 Prism 原生界面，而不是独立的网页式面板。

## 3. 当前代码事实

当前相关模块：

- 设置 UI：`src/components/shell/SettingsModal.tsx`
- 设置状态：`src/domains/settings/types.ts`
- 设置 store：`src/domains/settings/store.ts`
- 设置 normalize：`src/domains/settings/normalize.ts`
- 命令定义：`src/domains/commands/registry.ts`
- 菜单模型：`src/domains/commands/menuModel.ts`
- 快捷键面板分类：`src/components/shell/ShortcutPanel.tsx`
- 主题契约：`src/domains/themes/themeContract.ts`
- 编辑器字体消费：`src/domains/editor/components/EditorPane.tsx`
- 预览字体消费：`src/domains/editor/components/PreviewPane.tsx`
- 自动保存：`src/domains/document/hooks/useAutoSave.ts`
- 导出类型：`src/domains/export/types.ts`
- 导出实现：`src/domains/export/exportPipeline.ts`
- 导出入口：`src/domains/commands/registry.ts`
- 最近文档基础服务：`src/domains/workspace/services/recentFiles.ts`
- 打开文件入口：`src/hooks/useBootstrap.ts`

当前已经真实可用的设置：

- `defaultViewMode`
- `fontSize`
- `editorFontFamily`
- `editorLineHeight`
- `previewFontFamily`
- `previewFontSize`
- `showLineNumbers`
- `contentTheme`
- `exportDefaults.pngScale`
- `exportDefaults.htmlIncludeTheme`
- `shortcutStyle`
- `autoSaveInterval`

当前不应继续作为 UI 暴露的设置：

- `theme: auto/light/dark`
  - 底层字段可暂时保留以兼容旧配置。
  - UI 不展示，避免承诺完整外壳深浅适配。
- `exportDefaults.format`
  - 当前导出菜单是四个独立命令，不存在统一导出工作台。
  - 该字段可兼容保留，但本轮 UI 不展示。
- `autoSaveInterval`
  - 底层仍可用于实现策略，但 UI 不直接展示毫秒级滑杆。

## 4. 菜单需求

### 4.1 顶部菜单最终结构

删除顶级 `Prism` 菜单。

`文件` 菜单包含：

- 新建
- 新建窗口
- 打开
- 打开文件夹
- 保存
- 另存为
- 在文件管理器中显示
- 导出
- 设置中心
- 关闭文稿

`帮助` 菜单包含：

- 命令面板
- 键盘快捷键
- Markdown 参考
- GitHub 仓库
- 反馈问题
- 关于 Prism

### 4.2 命令要求

- `preferences`
  - label：`设置中心`
  - category：`文件`
  - shortcut：`Mod+,`
  - run：打开 `SettingsModal`
- `commandPalette`
  - category：`帮助`
  - 保持快捷键 `Mod+Shift+P`
- `showShortcuts`
  - category：`帮助`
- `about`
  - category：`帮助`

### 4.3 快捷键面板

`ShortcutPanel` 的分类顺序删除 `Prism`，建议顺序：

```ts
['文件', '编辑', '插入', '格式', '视图', '主题', '窗口', '帮助']
```

验收：

- 顶部菜单无 `Prism`。
- `文件 -> 设置中心` 可打开设置中心。
- `帮助` 中能看到命令面板、键盘快捷键、关于 Prism。

## 5. 设置中心信息架构

设置中心采用左侧分组，顺序固定：

1. `通用`
2. `写作`
3. `主题`
4. `导出`
5. `文件`
6. `快捷键`
7. `高级`

### 5.1 通用

展示：

- 默认视图
  - 选项：`编辑 / 分栏 / 预览`
  - 数据：`defaultViewMode`
- 启动时恢复上次窗口
  - 数据：`restoreLastSession`
  - 开启后启动时尝试恢复上次文件、文件夹、视图模式、窗口尺寸。
- 最近文档
  - 设置项：最近文档数量。
  - 操作项：清空最近文档。

不展示：

- 语言切换

原因：

- 当前没有完整 i18n 系统。

### 5.2 写作

展示：

- 编辑器字体
- 编辑器字号
- 编辑器行高
- 显示行号
- 预览字体
- 预览字号
- 导入本地字体

字体应用范围：

- 编辑器
- 预览
- 两者

不展示：

- 专注模式
- 打字机模式
- 侧边栏显示

原因：

- 这些是当前工作状态/视图动作，应留在 `视图` 菜单和底部状态栏。

### 5.3 主题

展示五个写作主题卡片：

- `MiaoYan`
- `Inkstone Light`
- `Slate Manual`
- `Mono Lab`
- `Nocturne Dark`

数据：

- `contentTheme`

交互：

- 点击主题卡片立即应用主题。
- 设置中心自身也同步换肤。

不展示：

- 应用外壳浅色/深色。

### 5.4 导出

展示：

- 导出模板
- HTML 包含主题
- PNG 清晰度
- PDF 纸张
- PDF 边距
- 默认导出目录
- DOCX 字体策略

PDF 纸张选项：

- `A4`
- `Letter`

PDF 边距选项：

- `紧凑`
- `标准`
- `宽松`

不展示：

- 默认导出格式

原因：

- 当前产品是四个明确导出动作，不是统一导出工作台。
- 导出模板用于统一样式，不改变四个导出动作的入口。
- 默认导出目录是导出行为设置，归入导出分组，不放在文件保存分组。

### 5.5 文件

展示：

- 自动保存
- 保存策略

自动保存：

- 开启：按策略自动保存已有路径文档。
- 关闭：不自动保存，但 `Cmd+S / Ctrl+S` 仍可手动保存。

保存策略：

- `即时`
- `平衡`
- `省电`

不展示：

- 裸毫秒间隔滑杆。

原因：

- 毫秒值是工程实现，不是产品语言。

### 5.6 快捷键

展示：

- 快捷键文案风格
  - 跟随系统
  - macOS
  - Windows

不展示：

- 快捷键自定义。

原因：

- 当前没有快捷键编辑器，也没有命令冲突检测。

### 5.7 高级

展示：

- 打开字体目录
- 删除导入字体
- 重置设置

重置设置要求：

- 恢复设置默认值。
- 不删除用户文档。
- 不删除已导入字体文件，除非用户在字体管理中明确删除字体。
- 重置后字体设置回退到跟随主题。

## 6. 设置数据结构设计

### 6.1 新增类型

在 `src/domains/settings/types.ts` 中新增：

```ts
export type FontScope = 'editor' | 'preview' | 'both';

export type FontSourceKind = 'theme' | 'builtin' | 'custom' | 'system';

export interface FontSource {
  kind: FontSourceKind;
  value: string;
}

export interface CustomFont {
  id: string;
  displayName: string;
  family: string;
  filename: string;
  format: 'ttf' | 'otf' | 'woff' | 'woff2';
  createdAt: number;
}

export type PdfPaper = 'a4' | 'letter';
export type PdfMargin = 'compact' | 'standard' | 'wide';
export type AutoSaveStrategy = 'instant' | 'balanced' | 'battery';
export type ExportTemplateId = 'theme' | 'business' | 'plain' | 'academic';
export type DefaultExportLocation = 'ask' | 'document' | 'downloads' | 'custom';
export type DocxFontPolicy = 'theme' | 'preview' | 'custom';

export interface RecentFileEntry {
  path: string;
  name: string;
  lastOpened: number;
}

export interface LastSessionState {
  filePath: string | null;
  folderPath: string | null;
  viewMode: DefaultViewMode;
  sidebarVisible: boolean;
  sidebarTab: 'files' | 'outline';
  windowState: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  updatedAt: number;
}
```

### 6.2 SettingsState 扩展

扩展 `SettingsState`：

```ts
export interface SettingsState {
  theme: AppearanceMode;
  contentTheme: ContentTheme;
  fontSize: number;
  editorFontFamily: string;
  editorLineHeight: number;
  previewFontFamily: string;
  previewFontSize: number;
  defaultViewMode: DefaultViewMode;
  exportDefaults: {
    format: ExportDefaultFormat;
    pngScale: number;
    htmlIncludeTheme: boolean;
    pdfPaper: PdfPaper;
    pdfMargin: PdfMargin;
    templateId: ExportTemplateId;
    defaultLocation: DefaultExportLocation;
    customDirectory: string;
    docxFontPolicy: DocxFontPolicy;
  };
  shortcutStyle: ShortcutStyle;
  autoSaveInterval: number;
  autoSaveEnabled: boolean;
  autoSaveStrategy: AutoSaveStrategy;
  showLineNumbers: boolean;
  customFonts: CustomFont[];
  editorFontSource: FontSource;
  previewFontSource: FontSource;
  recentFiles: RecentFileEntry[];
  recentFilesLimit: number;
  restoreLastSession: boolean;
  lastSession: LastSessionState | null;
  windowState: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}
```

### 6.3 默认值

默认值：

```ts
export const DEFAULT_SETTINGS: SettingsState = {
  theme: 'auto',
  contentTheme: 'miaoyan',
  fontSize: 16,
  editorFontFamily: 'Cascadia Code, Consolas, monospace',
  editorLineHeight: 1.72,
  previewFontFamily: 'inherit',
  previewFontSize: 16,
  defaultViewMode: 'edit',
  exportDefaults: {
    format: 'pdf',
    pngScale: 2,
    htmlIncludeTheme: true,
    pdfPaper: 'a4',
    pdfMargin: 'standard',
    templateId: 'theme',
    defaultLocation: 'document',
    customDirectory: '',
    docxFontPolicy: 'theme',
  },
  shortcutStyle: 'auto',
  autoSaveInterval: 2000,
  autoSaveEnabled: true,
  autoSaveStrategy: 'balanced',
  showLineNumbers: false,
  customFonts: [],
  editorFontSource: { kind: 'theme', value: '' },
  previewFontSource: { kind: 'theme', value: '' },
  recentFiles: [],
  recentFilesLimit: 10,
  restoreLastSession: true,
  lastSession: null,
  windowState: {
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
  },
};
```

### 6.4 字体解析规则

新增 helper：

```ts
resolveFontFamily(source, customFonts, themeFont, builtinFonts)
```

规则：

- `kind: 'theme'`：返回当前主题契约中的字体。
- `kind: 'builtin'`：返回内置字体 family。
- `kind: 'system'`：返回系统字体栈。
- `kind: 'custom'`：
  - 找到 custom font：返回该字体 family。
  - 找不到：返回主题字体。

### 6.5 向后兼容

旧字段继续读取：

- `editorFontFamily`
- `previewFontFamily`
- `autoSaveInterval`
- `theme`
- `exportDefaults.format`

迁移规则：

- 如果旧配置没有 `editorFontSource`：
  - `editorFontFamily === DEFAULT_SETTINGS.editorFontFamily`：迁移为 `{ kind: 'theme', value: '' }`
  - 其他已知内置字体：迁移为 `{ kind: 'builtin', value: builtinId }`
  - 不认识的字符串：保留到 `editorFontFamily`，但 UI 回退为主题字体。
- 如果旧配置没有 `previewFontSource`：
  - `previewFontFamily === 'inherit'`：迁移为 `{ kind: 'theme', value: '' }`
  - 其他已知内置字体：迁移为 `{ kind: 'builtin', value: builtinId }`
- 如果旧配置没有 `autoSaveEnabled`：默认为 `true`。
- 如果旧配置没有 `autoSaveStrategy`：
  - `autoSaveInterval <= 1000`：`instant`
  - `autoSaveInterval <= 4000`：`balanced`
  - 否则：`battery`
- 如果旧配置没有 PDF 设置：`a4 + standard`。
- 如果旧配置没有 `templateId`：`theme`。
- 如果旧配置没有默认导出目录：`document`。
- 如果旧配置没有 `docxFontPolicy`：`theme`。
- 如果旧配置没有最近文档：优先读取旧 `localStorage` 中的 `prism_recent_files`，迁移后写入 settings；读取失败则空数组。
- 如果旧配置没有 `restoreLastSession`：默认为 `true`。

## 7. 字体导入技术方案

### 7.1 目录

字体保存目录：

```text
appData/fonts/
```

设置文件仍为：

```text
appData/config.json
```

### 7.2 新增服务

新增文件：

```text
src/domains/settings/fontService.ts
```

职责：

- 选择字体文件。
- 校验字体扩展名。
- 复制字体到 appData/fonts。
- 注册字体到浏览器运行时。
- 删除字体文件。
- 启动时注册已有字体。

### 7.3 推荐 API

```ts
export interface ImportedFontResult {
  font: CustomFont;
  sourcePath: string;
  targetPath: string;
}

export async function importFontFile(): Promise<ImportedFontResult | null>;
export async function registerCustomFont(font: CustomFont): Promise<void>;
export async function registerCustomFonts(fonts: CustomFont[]): Promise<void>;
export async function removeCustomFontFile(font: CustomFont): Promise<void>;
export async function openFontsDirectory(): Promise<void>;
```

### 7.4 Tauri API 使用

使用：

- `open` from `@tauri-apps/plugin-dialog`
- `readFile`, `writeFile`, `mkdir`, `exists`, `remove` from `@tauri-apps/plugin-fs`
- `appDataDir` from `@tauri-apps/api/path`
- `openPath` from `@tauri-apps/plugin-opener`

复制字体的实现策略：

1. `open({ filters: [{ name: 'Font', extensions: ['ttf', 'otf', 'woff', 'woff2'] }] })`
2. 读取源文件：`readFile(sourcePath)`
3. 确保目录：`mkdir(appData/fonts, { recursive: true })`
4. 写入目标文件：`writeFile(targetPath, bytes)`

不使用原始绝对路径作为运行依赖。

### 7.5 文件名规则

生成目标文件名：

```text
<timestamp>-<safe-base-name>.<ext>
```

safe-base-name 规则：

- 小写。
- 空格转 `-`。
- 只保留字母、数字、中文、`-`、`_`。
- 连续 `-` 合并。
- 长度限制 60。

### 7.6 family 规则

family 生成：

```text
PrismCustomFont-<timestamp>
```

displayName：

- 默认取源文件 basename。
- 去掉扩展名。
- 保留中文。

示例：

```json
{
  "id": "font_1710000000000",
  "displayName": "LXGW WenKai",
  "family": "PrismCustomFont-1710000000000",
  "filename": "1710000000000-lxgw-wenkai.ttf",
  "format": "ttf",
  "createdAt": 1710000000000
}
```

### 7.7 FontFace 注册

注册方式：

```ts
const bytes = await readFile(fontPath);
const blob = new Blob([bytes], { type: getFontMime(font.format) });
const url = URL.createObjectURL(blob);
const face = new FontFace(font.family, `url(${url})`);
await face.load();
document.fonts.add(face);
```

注意：

- 注册失败时不要写入 settings。
- 启动批量注册时，单个字体失败不能阻止其他字体注册。
- 失败字体在 UI 中显示“文件缺失/加载失败”，允许用户删除。

### 7.8 Store actions

在 settings store 中新增：

```ts
importCustomFont: () => Promise<void>;
removeCustomFont: (fontId: string) => Promise<void>;
registerSavedFonts: () => Promise<void>;
setEditorFontSource: (source: FontSource) => void;
setPreviewFontSource: (source: FontSource) => void;
resetSettings: () => Promise<void>;
openFontsDirectory: () => Promise<void>;
```

remove 行为：

- 删除字体文件。
- 从 `customFonts` 移除。
- 如果 `editorFontSource` 引用该字体，回退为 `{ kind: 'theme', value: '' }`。
- 如果 `previewFontSource` 引用该字体，回退为 `{ kind: 'theme', value: '' }`。
- 保存 settings。

### 7.9 字体应用到编辑器

`EditorPane` 当前读取：

- `fontSize`
- `editorFontFamily`
- `editorLineHeight`

改为：

- 保留 `fontSize`
- 保留 `editorLineHeight`
- 用 `resolvedEditorFontFamily` 替代直接读取 `editorFontFamily`

建议在 settings store 或 selector 中提供：

```ts
getResolvedEditorFontFamily(contentTheme): string
getResolvedPreviewFontFamily(contentTheme): string
```

也可在组件内使用 helper 解析，但必须避免复制规则。

### 7.10 字体应用到预览

`PreviewPane` 当前读取：

- `previewFontFamily`
- `previewFontSize`

改为读取：

- `resolvedPreviewFontFamily`
- `previewFontSize`

如果 preview font source 是 theme：

- style 不覆盖 fontFamily，让主题 CSS 生效。

如果是 builtin/custom/system：

- style 写入对应 fontFamily。

### 7.11 字体应用到导出

HTML/PDF/PNG：

- 走 DOM/CSS 渲染路径，应继承当前预览字体。
- 如果使用自定义字体，导出 HTML 必须内联字体或保证 `@font-face` 可用。

本轮实现原则：

- PDF/PNG：通过当前 DOM 渲染，能使用运行时已注册字体即可。
- HTML：若 `htmlIncludeTheme` 开启，自定义字体不要求嵌入为 base64；但导出的 HTML 中应保留可读 fallback。

DOCX：

- 本轮要支持 DOCX 字体策略。
- 默认策略是跟随主题契约。
- 如果用户选择“使用预览字体”，DOCX run/style 使用 resolved preview font family。
- 如果预览字体是导入字体，尝试把字体文件加入 docx document 的 font table 或等价嵌入能力。
- 如果 docx 库当前无法稳定嵌入字体文件，必须至少做到：
  - DOCX 样式使用该字体 family 名。
  - 导出完成前给出非阻断提示：`Word 字体嵌入受限，已写入字体名称；打开设备需安装该字体才能完全一致。`
  - plan 执行者必须在实现记录中说明 docx 库限制。

## 8. PDF 纸张与边距技术方案

### 8.1 类型

新增：

```ts
export type PdfPaper = 'a4' | 'letter';
export type PdfMargin = 'compact' | 'standard' | 'wide';
```

### 8.2 ExportDocumentInput 扩展

在 `src/domains/export/types.ts` 中扩展：

```ts
export interface ExportDocumentInput {
  content: string;
  filename: string;
  contentTheme: ContentTheme;
  htmlIncludeTheme?: boolean;
  pngScale?: number;
  pdfPaper?: PdfPaper;
  pdfMargin?: PdfMargin;
  onProgress?: (message: string) => void;
}
```

### 8.3 纸张映射

PDF 纸张 CSS：

```ts
const pdfPaperSize = {
  a4: 'A4',
  letter: 'Letter',
};
```

### 8.4 边距映射

CSS `@page` margin：

```ts
const pdfPageMargins = {
  compact: '12mm 12mm 14mm',
  standard: '18mm 18mm 20mm',
  wide: '25mm 25mm 28mm',
};
```

### 8.5 实现位置

当前 `collectExportCss()` 中有固定：

```css
@page { margin: 18mm 18mm 20mm; }
```

改造方式：

- `collectExportCss` 接收参数：

```ts
async function collectExportCss(options?: {
  pdfPaper?: PdfPaper;
  pdfMargin?: PdfMargin;
})
```

- 在生成 CSS 时写入：

```css
@page {
  size: A4;
  margin: 18mm 18mm 20mm;
}
```

### 8.6 导出入口传参

`handleExport` 调用 `exportDocument` 时传入：

```ts
pdfPaper: context.settingsStore.exportDefaults.pdfPaper,
pdfMargin: context.settingsStore.exportDefaults.pdfMargin,
```

### 8.7 UI 文案

PDF 纸张：

- `A4`
- `Letter`

PDF 边距：

- `紧凑`
- `标准`
- `宽松`

不显示毫米值为主文案。可在 hint 中显示：

- 紧凑：适合长文
- 标准：推荐
- 宽松：适合正式文档

## 9. DOCX 字体嵌入技术方案

### 9.1 产品目标

用户导入字体后，不只是在编辑器和预览里可见，也应尽量带到 Word 导出中。

本轮目标分两级：

1. 必须实现：DOCX 样式使用用户选择的字体 family。
2. 尽量实现：将导入字体文件嵌入 DOCX。

如果 `docx` 库无法稳定支持字体文件嵌入，不能伪装完成；必须在导出提示和最终汇报中明确限制。

### 9.2 设置项

导出分组增加：

```ts
docxFontPolicy: 'theme' | 'preview' | 'custom'
```

UI 文案：

- 跟随主题
- 使用预览字体
- 指定字体

默认：

- `theme`

### 9.3 DOCX 字体解析

新增 helper：

```ts
resolveDocxFont(input, settings, themeContract): {
  family: string;
  customFont?: CustomFont;
  canEmbed: boolean;
}
```

规则：

- `theme`：使用 `themeContract.export.docx.font`。
- `preview`：
  - preview font source 是 theme：使用 theme docx font。
  - preview font source 是 builtin/system：使用对应 family。
  - preview font source 是 custom：使用 custom font family，并返回 customFont。
- `custom`：使用用户在 DOCX 字体下拉中指定的字体；如果未指定，回退 theme。

### 9.4 docx 导出修改

当前 `exportDocx` 使用：

```ts
const theme = docxThemeByContentTheme[input.contentTheme];
```

改造：

- `ExportDocumentInput` 增加：

```ts
docxFontFamily?: string;
docxFontFile?: {
  filename: string;
  format: 'ttf' | 'otf' | 'woff' | 'woff2';
};
docxFontPolicy?: DocxFontPolicy;
```

- `theme.font` 在生成 document 前被 resolved font 覆盖。
- heading、paragraph、table、code block 的 font 都统一使用 resolved font；代码字体仍使用 `theme.codeFont`，不强行套正文自定义字体。

### 9.5 字体嵌入策略

执行者必须先验证当前 `docx` 包是否支持字体嵌入 API。

实现顺序：

1. 检查 `docx` 包类型和文档，确认是否有 font table / obfuscated font / external font embed API。
2. 如果支持：读取 appData/fonts 中的字体文件，传入 DOCX document。
3. 如果不支持：不要 hack OOXML zip，先交付字体 family 写入，并把 limitation 写进最终说明。

不允许：

- 只在 UI 上写“嵌入字体”，但导出文件不带任何效果。
- 为了嵌入字体引入大型二进制处理库，除非构建和包体影响可控。

### 9.6 验收

- 选择“跟随主题”：DOCX 使用主题字体。
- 选择“使用预览字体”：DOCX 正文字体名与预览字体一致。
- 使用导入字体导出 DOCX 后，在 Word/Pages 中检查正文 font family。
- 如果字体文件成功嵌入，在未安装字体的设备上仍能显示；如果不能嵌入，必须明确提示限制。

## 10. 导出模板系统技术方案

### 10.1 产品目标

导出模板是导出样式预设，不是新主题系统。它决定导出文件的密度、标题、边距、字体策略和代码块样式，但默认仍可跟随当前写作主题。

### 10.2 模板范围

本轮内置四个模板：

- `theme`：跟随当前写作主题，默认。
- `business`：更适合正式文档，边距宽、标题清晰、表格边线明确。
- `plain`：纯净兼容，适合外发和平台粘贴。
- `academic`：更适合长文，标题层级清楚，引用和脚注更稳。

### 10.3 类型

```ts
export interface ExportTemplate {
  id: ExportTemplateId;
  label: string;
  description: string;
  pdfMargin: PdfMargin;
  docxFontPolicy: DocxFontPolicy;
  codeStyle: 'theme' | 'boxed' | 'plain';
  tableStyle: 'theme' | 'grid' | 'minimal';
}
```

内置模板常量：

```ts
export const EXPORT_TEMPLATES: Record<ExportTemplateId, ExportTemplate> = {
  theme: { ... },
  business: { ... },
  plain: { ... },
  academic: { ... },
};
```

### 10.4 设置项

`exportDefaults.templateId`

UI：

- 卡片或 select 均可。
- 推荐使用小卡片：名称 + 一句话说明。

### 10.5 数据流

导出时：

1. 从 settings 获取 `templateId`。
2. 查找 `EXPORT_TEMPLATES[templateId]`。
3. 合并用户显式设置：
   - 用户选择的 PDF paper 永远优先。
   - 用户选择的 PDF margin 优先；如果用户没改，则模板默认 margin 生效。
   - 用户选择的 DOCX font policy 优先；否则模板默认策略生效。
4. 将 resolved export options 传给 HTML/PDF/PNG/DOCX adapters。

### 10.6 文件组织

新增：

```text
src/domains/export/templates.ts
```

职责：

- 定义模板。
- 提供 `resolveExportOptions(settings)`。
- 不包含 UI 代码。

### 10.7 验收

- 切换模板后 PDF/DOCX 导出样式有可见差异。
- `theme` 模板与当前写作主题保持一致。
- `plain` 模板导出的 HTML/DOCX 更少装饰。
- 模板不影响源 Markdown 内容。

## 11. 默认导出目录技术方案

### 11.1 产品目标

用户不应该每次导出都从随机目录开始。设置中心提供默认导出位置。

### 11.2 设置项

`exportDefaults.defaultLocation`

选项：

- `ask`：每次询问，默认打开上次目录或 home。
- `document`：文档所在文件夹。
- `downloads`：下载文件夹。
- `custom`：用户指定目录。

`exportDefaults.customDirectory`

- 仅 defaultLocation 为 custom 时有效。

### 11.3 Tauri API

使用：

- `open({ directory: true })`
- `downloadDir` from `@tauri-apps/api/path`
- `exists` from fs

### 11.4 App 导出路径逻辑

当前 `requestExportPath` 初始目录：

```ts
input.documentPath ? dirname(input.documentPath) : workspace.rootPath || await homeDir()
```

改为：

```ts
resolveDefaultExportDirectory({
  defaultLocation,
  customDirectory,
  documentPath,
  rootPath,
})
```

规则：

- `document`：有 documentPath 用 dirname；否则 rootPath；否则 home。
- `downloads`：downloadDir；失败回退 home。
- `custom`：customDirectory 存在则用；不存在提示并回退 home。
- `ask`：沿用当前行为。

### 11.5 UI

导出分组增加：

- 默认导出位置：segmented/select。
- 自定义目录：当选择 custom 时显示路径和“选择...”按钮。

### 11.6 验收

- 选择文档所在文件夹，导出弹窗默认目录为当前文档目录。
- 选择下载文件夹，导出弹窗默认目录为 Downloads。
- 选择自定义目录，导出弹窗默认目录为该目录。
- 自定义目录不存在时不崩溃，有 toast 提示并回退。

## 12. 最近文档与恢复上次窗口技术方案

### 12.1 产品目标

Prism 是单文档单窗口写作器，但用户仍需要快速回到最近写过的文档，并能在启动时恢复上次状态。

### 12.2 当前基础

当前已有：

```text
src/domains/workspace/services/recentFiles.ts
```

但它使用 localStorage，且没有完整接入设置中心。

### 12.3 本轮策略

- 最近文档迁移到 settings/config.json。
- 保留 localStorage 读取兼容，用于迁移旧数据。
- 最近文档数量由设置控制，默认 10。
- 恢复上次窗口由设置控制，默认开启。

### 12.4 数据结构

使用前文 `RecentFileEntry` 和 `LastSessionState`。

更新时机：

- 成功打开文件后 addRecentFile。
- 成功保存新文件后 addRecentFile。
- 当前文档路径、文件夹路径、viewMode、sidebar 状态变化时 debounce 写入 lastSession。
- 窗口关闭前尽量写入 lastSession。

### 12.5 启动恢复

`useBootstrap` 当前根据 URL query 加载 `file` / `folder`。

优先级：

1. URL query 显式 file/folder。
2. Tauri pending files。
3. `restoreLastSession === true` 且 lastSession 有有效 file/folder。
4. 空窗口。

恢复前必须校验：

- filePath 存在。
- folderPath 存在。
- 读取失败时跳过，不弹阻断错误。

### 12.6 UI

通用分组：

- 启动时恢复上次窗口：toggle。
- 最近文档数量：`5 / 10 / 20`。
- 清空最近文档：按钮。

文件菜单：

- 必须新增 `打开最近文档` 子菜单。
- 菜单最多展示最近 10 个。
- 为空时 disabled：`无最近文档`。

### 12.7 验收

- 打开文件后出现在最近文档列表。
- 保存新文件后出现在最近文档列表。
- 清空最近文档后列表为空。
- 开启恢复后，重启 app 自动打开上次文件。
- 关闭恢复后，重启 app 不自动打开上次文件。
- URL query 和系统打开文件优先于恢复上次窗口。

## 13. 自动保存策略技术方案

### 13.1 类型

新增：

```ts
export type AutoSaveStrategy = 'instant' | 'balanced' | 'battery';
```

### 13.2 策略映射

```ts
export const AUTO_SAVE_INTERVAL_BY_STRATEGY: Record<AutoSaveStrategy, number> = {
  instant: 500,
  balanced: 2000,
  battery: 8000,
};
```

### 13.3 SettingsState

新增：

```ts
autoSaveEnabled: boolean;
autoSaveStrategy: AutoSaveStrategy;
```

保留：

```ts
autoSaveInterval: number;
```

原因：

- 兼容旧配置。
- 内部 hook 仍可接收 interval。

### 13.4 Store actions

新增：

```ts
setAutoSaveEnabled: (enabled: boolean) => void;
setAutoSaveStrategy: (strategy: AutoSaveStrategy) => void;
```

`setAutoSaveStrategy` 行为：

- 设置 `autoSaveStrategy`
- 同步设置 `autoSaveInterval = AUTO_SAVE_INTERVAL_BY_STRATEGY[strategy]`
- 保存 settings

### 13.5 Hook 改造

当前：

```ts
useAutoSave(autoSaveInterval)
```

改为：

```ts
useAutoSave({
  enabled: autoSaveEnabled,
  interval: autoSaveInterval,
})
```

hook 行为：

- `enabled === false`：清理已有 timer，直接 return。
- 没有文档：清理 timer。
- 文档不 dirty：清理 timer。
- 文档 path 为空：不自动保存。
- 文档 path 非空且 dirty：按 interval 保存。

手动保存不受 `autoSaveEnabled` 影响。

### 13.6 UI

文件分组展示：

- 自动保存：toggle
- 保存策略：segmented control

保存策略文案：

- 即时
- 平衡
- 省电

当自动保存关闭：

- 保存策略控件 disabled。
- hint 显示“关闭后仅手动保存”。

## 14. 设置中心 UI 技术方案

### 14.1 文件组织

推荐拆分：

```text
src/components/shell/SettingsModal.tsx
src/components/shell/SettingsModal.module.css
src/components/shell/settings/
  SettingsNavigation.tsx
  SettingsSection.tsx
  FontSettings.tsx
  ThemeSettings.tsx
  ExportSettings.tsx
  FileSettings.tsx
```

如果时间有限，可先保留单文件，但必须：

- 删除 inline style。
- 使用 className。
- 避免继续扩大一个巨大 JSX 文件。

### 14.2 UI 结构

弹窗结构：

```text
modal
  header
  body
    sidebar navigation
    content
      section header
      rows/groups
```

左侧导航状态：

- 本地 React state：`activeSection`
- 默认：`general`
- 点击切换，不影响 settings。

### 14.3 主题化方式

设置中心使用 CSS custom properties。

来源：

- 当前 `contentTheme`
- `themeContract`

实现建议：

1. 在 `SettingsModal` 中读取 `contentTheme`。
2. 获取 contract。
3. 把关键 token 写到 modal root style：

```ts
style={{
  '--settings-bg': contract.preview.background,
  '--settings-panel': contract.editor.background,
  '--settings-text': contract.editor.text,
  '--settings-muted': contract.editor.secondaryText,
  '--settings-line': contract.export.docx.border,
  '--settings-accent': contract.export.docx.accent,
  '--settings-font': contract.editor.fontFamily,
  '--settings-code-font': contract.editor.codeFontFamily,
} as CSSProperties}
```

4. CSS module 使用这些变量。

注意：

- 不直接把整个 App 切换成 dark/light。
- Nocturne 下必须保证所有文字对比度可读。
- 菜单、select、button、toggle、主题卡片都使用同一套 token。

### 14.4 控件规范

- 二元开关：toggle
- 互斥小集合：segmented control
- 多字体列表：select
- 导入：button + dialog
- 删除字体：危险按钮，二次确认
- 主题：卡片网格

### 14.5 状态反馈

字体导入：

- 开始：按钮显示“导入中...”
- 成功：toast `字体已导入`
- 失败：toast `字体导入失败`

删除字体：

- 成功：toast `字体已删除`
- 失败：toast `字体删除失败`

重置设置：

- 二次确认。
- 成功：toast `设置已重置`

## 15. 主题卡片实现

主题卡片展示：

- 主题名称
- 简短描述
- 颜色 swatch

映射：

```ts
const themeDescriptions = {
  miaoyan: '中文写作优先，温润、留白、克制',
  inkstone: '纸张、墨石、低频朱砂点缀',
  slate: '蓝灰、石板、冷青',
  mono: '黑白优先，少量语义色',
  nocturne: '暗色写作，少量琥珀强调',
};
```

点击：

- `settings.setContentTheme(theme)`

checked：

- 当前 `contentTheme === theme`

## 16. 字体 UI 详细行为

### 16.1 内置字体列表

建议内置字体 options：

- 跟随主题
- 系统字体
- 霞鹜文楷
- JetBrains Mono
- IBM Plex Sans
- Newsreader
- Source Serif 4

这些字体当前已经在 `src/assets/fonts/` 中存在或已有系统 fallback。

### 16.2 字体 select value

建议 value 格式：

```text
theme:
system:
builtin:<id>
custom:<fontId>
```

示例：

```text
builtin:jetbrains-mono
custom:font_1710000000000
```

### 16.3 应用范围

导入字体后弹出或显示应用范围：

- 编辑器
- 预览
- 两者

默认：

- 两者

如果用户在导入前已经在“编辑器字体”区域点击导入：

- 默认应用编辑器。

如果用户在“预览字体”区域点击导入：

- 默认应用预览。

如果只有一个统一导入按钮：

- 默认应用两者。

### 16.4 删除字体

字体管理列表每项显示：

- displayName
- format
- 导入日期
- 当前使用标识：`编辑器使用中` / `预览使用中`
- 删除按钮

删除前确认：

```text
删除字体“xxx”？如果当前正在使用，会自动回退到跟随主题。
```

## 17. 高级功能

### 17.1 打开字体目录

行为：

- 确保 `appData/fonts` 存在。
- 使用 opener 打开目录。

失败：

- toast `无法打开字体目录`

### 17.2 重置设置

行为：

- settings 回到默认值。
- `customFonts` 保留还是清空？

本轮决策：

- 重置设置不删除字体文件。
- `customFonts` 元数据保留。
- `editorFontSource / previewFontSource` 回到 theme。

原因：

- 字体文件是用户导入资产，重置设置不应悄悄删除资产。

如果用户要删除字体，必须在字体管理里显式删除。

## 18. 导出实现详细要求

### 18.1 HTML

继续使用现有逻辑：

- `htmlIncludeTheme === true`：收集并内联 CSS。
- `htmlIncludeTheme === false`：输出最小 HTML。

要求：

- 设置中心里的 HTML 包含主题 toggle 直接写入 `exportDefaults.htmlIncludeTheme`。

### 18.2 PNG

继续使用现有逻辑：

- `pngScale` 传入导出渲染。

要求：

- UI 支持 `1x / 2x / 3x`。
- 默认 `2x`。

### 18.3 PDF

新增：

- `pdfPaper`
- `pdfMargin`

要求：

- PDF 导出 CSS 使用 `@page size`。
- PDF 导出 CSS 使用设置中的 margin。
- 不影响 HTML 导出滚动。
- 不影响 PNG 导出尺寸逻辑。

### 18.4 DOCX

本轮实现：

- DOCX 字体策略。
- DOCX 正文字体跟随主题、预览字体或指定字体。
- 导入字体用于 DOCX 时，尽量嵌入字体文件。
- 如果 `docx` 库无法稳定嵌入字体文件，必须给出非阻断提示，并至少写入字体 family。

保持：

- 代码块仍使用主题契约中的 code font。
- Mermaid 仍以图片方式进入 DOCX。
- 表格、代码块、标题样式继续走现有 AST 映射，但使用导出模板调整密度和边线。

新增：

- `docxFontPolicy`
- `docxFontFamily`
- `docxFontFile`

## 19. 文件保存实现详细要求

### 19.1 自动保存开关

默认开启。

关闭时：

- 不自动保存。
- 不改变 dirty 状态。
- 不影响手动保存。

### 19.2 保存策略

策略与 interval 映射：

| 策略 | interval | 文案 |
|---|---:|---|
| instant | 500 | 即时 |
| balanced | 2000 | 平衡 |
| battery | 8000 | 省电 |

设置保存策略后：

- 更新 `autoSaveStrategy`
- 更新 `autoSaveInterval`

### 19.3 useAutoSave 测试点

必须覆盖：

- disabled 时不写文件。
- dirty false 时不写文件。
- path 空时不写文件。
- enabled 且 dirty 且有 path 时按 interval 写文件。

## 20. 分阶段执行顺序

每阶段完成后 commit + push。

### 阶段 1：保存 plan 与菜单修正

变更：

- 保留本文档。
- 删除顶级 Prism 菜单。
- 设置中心移入文件菜单。
- 帮助菜单恢复命令面板、快捷键、关于。

验证：

- `npm run test -- --run src/domains/commands/registry.test.ts`
- `npm run build`

提交建议：

```text
重构设置中心菜单入口
```

### 阶段 2：settings schema 与迁移

变更：

- 扩展 settings types。
- 扩展 DEFAULT_SETTINGS。
- 扩展 normalize。
- 扩展 store actions。
- 添加 settings normalize 测试。

验证：

- `npm run test -- --run src/domains/settings/normalize.test.ts`
- `npm run build`

提交建议：

```text
扩展设置中心配置模型
```

### 阶段 3：字体服务

变更：

- 新增 font service。
- 实现导入、注册、删除、打开目录。
- 启动时注册已导入字体。

验证：

- 添加 font service 单元测试。
- 手工导入字体。
- `npm run build`

提交建议：

```text
新增本地字体导入服务
```

### 阶段 4：设置中心 UI 重构

变更：

- SettingsModal 改为左侧分组。
- 接入主题化 token。
- 接入字体导入、主题切换、导出设置、文件保存设置。
- 删除专注/打字机/外壳深浅 UI。

验证：

- 组件测试或人工测试。
- 五个主题人工检查。
- `npm run build`

提交建议：

```text
重构主题化设置中心
```

### 阶段 5：导出系统设置接入

变更：

- 导出模板系统。
- 默认导出目录。
- PDF 导出读取 paper/margin。
- DOCX 字体策略与字体嵌入尝试。
- HTML/PDF/PNG/DOCX 都读取 resolved export options。

验证：

- 切换模板后导出样式有差异。
- 默认导出目录生效。
- 导出 PDF 检查纸张/边距。
- DOCX 字体策略生效。
- `npm run test -- --run`
- `npm run build`

提交建议：

```text
接入导出模板与PDF/DOCX设置
```

### 阶段 6：文件保存与会话恢复

变更：

- useAutoSave 支持 enabled/strategy。
- 最近文档迁移到 settings。
- 恢复上次窗口。
- 打开最近文档菜单或设置中心列表。

验证：

- 关闭自动保存检查 dirty 状态。
- 最近文档新增、清空、数量限制生效。
- 重启 app 恢复上次文件和窗口状态。
- URL query / 系统打开文件优先于恢复会话。
- `npm run test -- --run`
- `npm run build`

提交建议：

```text
接入保存策略与会话恢复
```

### 阶段 7：整体验收与启动

验证：

- `npm run build`
- `npm run test -- --run`
- `npm run tauri dev`

提交建议：

```text
完成设置中心优化验收
```

## 21. 测试计划

### 21.1 单元测试

settings normalize：

- 旧配置缺失新字段时使用默认值。
- 旧 `autoSaveInterval` 正确迁移到 strategy。
- 非法 `pdfPaper` 回退 `a4`。
- 非法 `pdfMargin` 回退 `standard`。
- customFonts 非数组时回退空数组。
- editor/preview font source 非法时回退 theme。

font service：

- 允许 ttf/otf/woff/woff2。
- 拒绝其他扩展。
- safe filename 生成稳定。
- remove font 时清理引用。

command registry：

- `preferences` category 为 `文件`。
- `commandPalette / showShortcuts / about` category 为 `帮助`。

export：

- PDF CSS 包含 `@page size: A4`。
- PDF CSS 包含对应 margin。
- PNG scale 仍传入渲染。
- export template resolver 正确合并模板默认值和用户显式设置。
- default export directory resolver 覆盖 ask/document/downloads/custom。
- DOCX font resolver 能输出 theme/preview/custom 字体策略。

auto save：

- disabled 不写文件。
- enabled 按 interval 写文件。

recent session：

- add recent file 去重并按 lastOpened 排序。
- recent files limit 生效。
- lastSession normalize 能处理缺失/非法字段。
- restore bootstrap 优先级为 URL query、pending files、last session、空窗口。

### 21.2 组件/交互测试

- 设置中心打开默认在 `通用`。
- 点击左侧分组切换内容。
- 点击主题卡片更新 `contentTheme`。
- 字体选择更新编辑器字体。
- 字体选择更新预览字体。
- 删除当前使用字体后回退主题字体。
- 自动保存关闭后策略控件 disabled。

### 21.3 人工验收

- 五个主题下设置中心可读、无重叠、无色彩失真。
- 导入 `.ttf` 成功。
- 导入 `.otf` 成功。
- 导入 `.woff2` 成功。
- 重启 app 后字体仍可选择。
- 删除字体后 UI 和编辑区正常。
- PDF A4/Letter 导出可见差异。
- PDF 紧凑/标准/宽松边距可见差异。
- 四个导出模板导出效果有可见差异。
- 默认导出目录按设置打开。
- DOCX 正文字体跟随设置。
- DOCX 导入字体嵌入成功或给出明确限制提示。
- 自动保存关闭时编辑后不会自动落盘。
- 自动保存开启时按策略落盘。
- 最近文档列表新增、清空、数量限制正确。
- 开启恢复上次窗口后重启能回到上次文件。

## 22. 验收命令

必须运行：

```bash
npm run build
npm run test -- --run
```

最后启动：

```bash
npm run tauri dev
```

如果 `git push origin main` 因 SSH 失败，可使用：

```bash
git push https://github.com/AlexPlum405/Prism.git main
git fetch https://github.com/AlexPlum405/Prism.git main:refs/remotes/origin/main
```

## 23. 非目标

本轮不做：

- 完整应用外壳浅色/深色切换。
- 快捷键自定义。
- i18n 语言切换。
- 无关样式重构。
- 无关功能重构。

明确纳入本轮：

- DOCX 字体策略与字体嵌入尝试。
- 导出模板系统。
- 默认导出目录。
- 最近文档与恢复上次窗口。

## 24. 最终交付要求

完成后必须说明：

- 修改了哪些设置中心能力。
- 哪些未做以及原因。
- 构建和测试结果。
- 最新 commit hash。
- 是否已 push。
- `npm run tauri dev` 是否已启动。
