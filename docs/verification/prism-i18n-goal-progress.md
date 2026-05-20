# Prism i18n goal 进度账本

## 目标

一次性完成 Prism 桌面应用 `zh-CN` / `en-US` / `ja-JP` / `auto` 四种界面语言切换能力，并用代码、测试、构建与可视化/替代验证证明完成。

## 初始 inventory

- 项目约束：已读取 `AGENTS.md`、`CONTEXT.md`、`package.json`、`vite.config.ts`、`src/`、`src-tauri/` 文件列表。
- Windows 打包约束：`vite.config.ts` 当前为 `base: './'`，必须保持。
- 主要 UI 文案来源：
  - `src/App.tsx`：保存/导出弹窗、导出进度/失败、冲突处理 toast、链接/工作区 toast、未命名标题。
  - `src/components/shell/*`：关于、设置、快捷键、命令面板、菜单、标题栏、Toast、上下文菜单。
  - `src/domains/commands/**`：菜单/快捷键面板/命令入口的 label、category、toast、确认框和错误提示。
  - `src/domains/workspace/components/*`：侧栏、状态栏、文件树、最近文档、链接/反链/图谱面板。
  - `src/domains/editor/components/*`：编辑区搜索、属性面板、诊断面板、预览空态/提示。
  - `src/lib/fileActions.ts`：文件树右键操作、确认框、属性信息和 toast。
  - `src/lib/markdownToHtml.ts`：Front Matter 预览面板的生成型 UI 文案。
- 非 UI 或暂不迁移内容：
  - 测试 fixture、Markdown 示例内容、用户文档内容、模板插入正文、日志前缀、CSS 注释。

## Checkpoints

### 2026-05-20 基座设计

- 计划新增 `src/domains/i18n/`：locale 类型、资源、运行时 resolver、React hook、测试。
- 计划扩展 settings：新增 `locale`，支持 normalize、persist、runtime apply。
- 计划优先迁移：设置中心语言选择、菜单/命令/快捷键、主窗口弹窗、命令面板、状态栏与常见 toast。

### 2026-05-20 基座与第一批迁移

- 已新增 `src/domains/i18n/`：
  - `types.ts`：`auto` / `zh-CN` / `en-US` / `ja-JP` 类型与校验。
  - `resources.ts`：三语资源表。
  - `runtime.ts`：auto 解析、fallback、`document.documentElement.lang`、订阅与格式化。
  - `useI18n.ts`：React 订阅 hook。
  - `commands.ts`：命令 label/category 的统一本地化映射。
- 已接入 settings：
  - `SettingsState.locale` / `DEFAULT_SETTINGS.locale`。
  - `normalizeSettings` 校验 locale。
  - `useSettingsStore.setLocale` 持久化并立即应用运行时 locale。
  - `saveSettings` 写入 locale。
- 已迁移高可见 UI 区域：
  - 设置中心：新增界面语言选项，并迁移设置页主要文案。
  - 菜单/快捷键：菜单 section、菜单组、命令 label、快捷键面板走 i18n。
  - 命令面板：快速打开/全文搜索标题、placeholder、空态、match label。
  - 标题栏、关于弹窗、状态栏。
  - App 主保存/导出弹窗、导出前台进度、导出失败弹窗、常见 toast。
  - 恢复快照弹窗、保存冲突弹窗。
  - 文件右键运行时操作、确认框、属性弹窗、错误 toast。
  - 导出命令运行时 toast/action/failure 文案。
- 已新增/更新测试：
  - `src/domains/i18n/i18n.test.ts`
  - `src/domains/settings/normalize.test.ts`
  - `src/components/shell/SettingsModal.test.tsx`
- 验证：
  - `npm run build` 通过。
  - `npm test -- --run src/domains/i18n/i18n.test.ts src/domains/settings/normalize.test.ts src/components/shell/SettingsModal.test.tsx src/lib/fileActions.test.ts src/lib/fileActionCommands.test.ts src/domains/commands/registry.test.ts src/components/shell/CommandPalette.test.tsx src/domains/workspace/components/StatusBar.test.tsx src/App.recovery.test.tsx` 通过，77 tests。

### 2026-05-20 完成迁移与最终审计

- 继续迁移范围：
  - 主题错误、主题安装、主题 CSS、主题 registry/storage/package 的用户可见错误统一走 i18n。
  - 命令分类内部枚举改为稳定英文 category，并通过 `src/domains/i18n/commands.ts` 统一本地化。
  - 导出诊断、导出质量、导出模板、导出 pipeline、独立导出 WebView worker 的进度/警告/错误文案统一走 i18n。
  - 编辑器上下文菜单、slash 菜单 label/detail、文档属性、链接诊断、排印诊断、搜索、预览空态、工作区文件树/链接/反链/图谱/状态栏等 UI 文案完成迁移。
  - `src-tauri/src/lib.rs` 中可能透传到 UI/诊断的中文原生错误改为英文底层错误，避免英文/日文界面出现中文错误详情；平台行为未改。
- 明确不迁移范围：
  - `src/domains/editor/extensions/templates.ts` 与 `slashMenu.ts` 的 `insert` 是写入用户 Markdown 的模板正文。
  - `src/domains/export/goldenFixture.ts` 是导出验收 fixture，用于证明中文正文不被翻译。
  - `src/styles/**`、源码注释、字体 README、命令 `keywords` 中的中文 alias、字体名 `霞鹜文楷` 均不是 UI 翻译目标。
- 视觉/运行时验证：
  - 启动 Vite 本地页面并用 Playwright 注入 Tauri mock 验证设置中心语言切换。
  - `auto` + `zh-CN` 浏览器语言：`document.documentElement.lang = zh-CN`，主菜单/空态/设置为中文。
  - 切到 `en-US`：`document.documentElement.lang = en-US`，主菜单/空态/设置为英文。
  - 切到 `ja-JP`：`document.documentElement.lang = ja-JP`，主菜单/空态/设置为日文。
  - 切回 `auto`：回到 `zh-CN`，并触发 settings 写入。
- 最终验证：
  - `npm test -- --run src/domains/i18n/i18n.test.ts` 通过，3 tests。
  - `npm test -- --run src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/i18n/i18n.test.ts` 通过，54 tests。
  - `cargo fmt; cargo test` 通过，4 Rust tests。
  - `npm test -- --run` 通过，91 files / 496 tests。
  - `npm run build` 通过，包含 `tsc`；仅有 Vite 既有 chunk size / KaTeX 动态导入提示。
  - 硬编码审计命令：`rg -n "[\u4e00-\u9fff]" src src-tauri --glob "!**/*.test.*" --glob "!src/domains/i18n/resources.ts"`；剩余项已分类为注释、CSS 注释、字体文档/字体名、命令搜索 alias、Markdown 模板正文、导出 fixture。
  - `vite.config.ts` 保持 `base: './'`。
  - `git diff --name-only` 未出现 macOS 图标、签名、公证、release、Windows 安装包路径配置改动。

## 剩余 checklist

- [x] 统一 i18n 基座，三语资源 key 完全一致。
- [x] 支持 `auto` / `zh-CN` / `en-US` / `ja-JP`。
- [x] 设置中切换语言，立即生效并持久化。
- [x] `document.documentElement.lang` 随有效语言更新。
- [x] 主窗口、菜单、命令面板、设置、状态栏、Toast、快捷键面板、上下文菜单、弹窗、错误提示已迁移。
- [x] 用户 Markdown 内容和预览正文不被翻译。
- [x] TypeScript 类型检查通过。
- [x] 单元测试覆盖 locale 解析、持久化、fallback、key 完整性。
- [x] 构建通过，`vite.config.ts` 保持 `base: './'`。
- [x] 平台分支无无关改动。
- [x] 最终完成审计和验证证据补齐。
