# Prism 专业写作能力 Smoke 验证

> 日期：2026-05-15  
> 目标：验证 Prism 的第一版专业写作能力在不引入数据库、图谱、云同步或完整 WYSIWYG 的前提下，能支持引用占位、Pandoc 回退和中文排版诊断。  
> 计划来源：`docs/archive/dirty-data-2026-05-30/historical-docs/prism-product-optimization-plan.md` 第 8 节“专业写作扩展”。

## 1. 覆盖范围

本 smoke 覆盖：

- Pandoc citekey 语法识别：`[@doe2024]`、`[@doe2024; @smith2023, p. 12]`、`[-@doe2024]`。
- 邮箱和 `mailto:` 链接不误报为 citekey。
- 预览中 citekey 渲染为占位。
- HTML 导出在 Pandoc 不可用时回退内置导出，并保留 citekey 占位。
- 设置中心的 bibliography / CSL / Pandoc 状态显示。
- 中文排版诊断：中英文间距、中文语境半角标点、标题层级跳跃、连续空行。
- 中文排版诊断只提示并跳源码，不自动改正文。

本 smoke 不覆盖：

- Zotero / CSL 在线下载 / 文献数据库。
- PDF / PNG / DOCX 的完整参考文献生成。
- 自动修复中文排版。
- 图谱、Properties 或插件市场。

## 2. 现有自动化覆盖

- `src/domains/editor/extensions/citations.test.ts`
  - 识别 Pandoc citekey。
  - 识别 suppress-author 引用 `[-@key]`，以及包含 `/`、`+` 等字符的真实 citekey。
  - 不把普通邮箱、方括号内邮箱和 `mailto:` 链接误识别为 citekey。
- `src/lib/markdownToHtml.test.ts`
  - citekey 渲染为 `.prism-citation` 占位。
  - citekey 不进入链接、inline code 或 fenced code block。
- `src/domains/export/exportPipeline.test.ts`
  - Pandoc 可用时会调用 `render_citations_with_pandoc`。
  - Pandoc 不可用或失败时回退内置导出，并保留 citekey 占位和 warning。
  - Pandoc 返回 HTML 会先清理危险 URL、事件属性、inline style 和 `<script>`。
- `src/components/shell/SettingsModal.test.tsx`
  - Pandoc 路径、参考文献文件、CSL 样式文件、就绪/回退提示和路径后缀提示。
- `src/domains/editor/extensions/typographyDiagnostics.test.ts`
  - 中英文间距、半角标点、标题层级、连续空行。
  - fenced code、inline code、Markdown 链接/图片目标不误报。
  - 1200 节、超过 10 万字符的中文长文 fixture 在 1500ms 宽松预算内完成扫描，并继续忽略代码块和链接目标。
- `src/domains/editor/components/TypographyDiagnosticsPanel.test.tsx`
  - 诊断面板只展示问题和跳源码动作。
  - 250 条诊断长列表能渲染首尾项、点击晚段问题跳到对应源码行，并支持 Escape 关闭。

## 3. 当前阻塞

真实 Pandoc citeproc smoke 尚未完成。本机当前状态见 `docs/verification/prism-pandoc-citation-html-smoke.md`：

```text
pandoc --version
zsh:1: command not found: pandoc
```

因此，当前只能确认自动化分支和回退行为，不能确认真实 `library.bib` / CSL 样式生成的最终参考文献 HTML。

## 4. 本轮记录

2026-05-15 补强自动化证据：

- `src/domains/editor/extensions/typographyDiagnostics.test.ts` 新增中文排版长文 micro benchmark：生成 1200 节、超过 10 万字符的中文写作 fixture，验证扫描在 1500ms 宽松预算内完成。
- 同一测试确认 fenced code 和 Markdown 链接目标里的“这是Prism编辑器”不会产生误报。
- `src/domains/editor/components/TypographyDiagnosticsPanel.test.tsx` 新增 250 条诊断长列表组件回归：确认首尾项与 `250:3` 位置渲染、点击第 250 条调用 `onSelect(250)`，Escape 调用关闭回调。
- `npm test -- --run src/domains/editor/components/TypographyDiagnosticsPanel.test.tsx`：通过，1 file / 3 tests。
- `npm test -- --run src/domains/editor/extensions/typographyDiagnostics.test.ts`：通过，1 file / 7 tests。
- `src/lib/markdownToHtml.test.ts` 扩展 citation 占位误报防护：`[@key]` 出现在链接文字、inline code 或 fenced code block 时不会生成 `.prism-citation`。
- `src/domains/editor/extensions/citations.ts` 扩展 Pandoc citekey 解析：支持 suppress-author `[-@doe/2024]` 和 `@team+paper_2026` 这类更真实的 key 字符；`citations.test.ts` 保持普通邮箱、带连字符邮箱和 `mailto:` 不误报。
- `src/lib/markdownToHtml.test.ts` 新增 suppress-author / rich citekey 占位回归：`[-@doe/2024; @team+paper_2026]` 会渲染为 `.prism-citation`，并保留 `data-citekeys="doe/2024 team+paper_2026"`。
- `npm test -- --run src/domains/editor/extensions/citations.test.ts src/lib/markdownToHtml.test.ts`：通过，2 files / 26 tests。
- `npm test -- --run`：通过，54 files / 311 tests。
- `npm run build`：通过，仅有既有 Vite large chunk warning。
- `git diff --check`：通过。

待真实 smoke 完成后，在此追加：

```text
日期：
Prism 版本：
Pandoc 状态：
BibTeX / CSL：
HTML citeproc：
Pandoc 回退：
中文排版长文：
诊断跳转：
结论：
```
