# Prism 写作效率 Smoke 验证

> 日期：2026-05-15
> 目标：验证 Markdown 高频写作能力在真实桌面编辑器工作流中可用。
> 计划来源：`docs/archive/dirty-data-2026-05-30/historical-docs/prism-product-optimization-plan.md` 第 4 节“写作效率工具”。
> 当前状态：已补图片粘贴文件写入、同秒冲突、标题锚点补全/诊断一致性和轻量 wiki 内链补全自动化回归；macOS 真实 `.app` 已通过系统剪贴板图片粘贴、快速打开键盘、链接补全/诊断、表格命令、列表续写/退出、PRD 模板插入、大纲搜索和选区统计 smoke；Finder / Explorer 拖拽、Option / Alt 原路径和 Windows 桌面路径仍未通过真实桌面 smoke。2026-05-15 曾尝试 macOS Finder 拖拽，但当前自动化工具无法安全完成跨应用文件拖入，不能作为产品通过证据。

## 1. 覆盖范围

本 smoke 覆盖：

- 图片粘贴：保存到当前文档旁的 `assets/<document-name>/`，插入相对路径。
- 图片拖拽：默认复制到 assets，按住 Option / Alt 时插入原路径链接。
- 链接补全：工作区 Markdown 文件路径、当前文档 heading anchor。
- 内链补全：`[[note]]` 只补全工作区 Markdown 文件，插入去掉 `.md` / `.markdown` / `.txt` 后缀的工作区相对目标。
- 链接诊断：缺失文件、缺失 heading、空链接。
- 表格命令：插入表格、格式化、增删行列。
- 列表体验：回车续写、空项退出、Tab / Shift+Tab 缩进。
- Markdown 模板：通用模板和学术模板。
- 快速打开：`Mod+P` 搜索工作区文件，最近打开加权。
- 大纲导航：标题层级展示、标题搜索、点击跳源码。
- 字数统计：中文、英文、字符、阅读时间、选区统计。

本 smoke 不覆盖：

- 完整 WYSIWYG。
- 文件树重命名、删除、移动等工作区文件管理。
- 导出产物；导出见 `docs/verification/prism-complex-export-smoke.md`。

## 2. 现有自动化覆盖

当前自动测试已覆盖主要 helper 和命令入口：

- `src/domains/editor/extensions/imagePaste.test.ts`：图片 MIME、assets 路径、中文文档名、拖拽图片识别、Windows 路径归一、Tauri fs 写入 contract、同秒文件名冲突后缀。
- `src/domains/editor/extensions/linkCompletion.test.ts`：Markdown link target 触发、heading anchor、标题末尾标点 slug、工作区相对路径补全、`[[note]]` wiki 内链触发和去扩展名目标补全。
- `src/domains/editor/extensions/linkDiagnostics.test.ts`：中文/英文 heading slug、标题末尾标点 slug、缺失文件、缺失 heading、空链接。
- `src/domains/editor/extensions/tables.test.ts`：插入表格、格式化、增删行列、避免误伤普通正文。
- `src/domains/editor/extensions/markdownLists.test.ts`：无序、有序、任务列表续写、空项退出、缩进和反缩进。
- `src/domains/editor/extensions/templates.test.ts`：通用模板、学术模板、插入边界和非法模板 id 防护。
- `src/domains/editor/components/EditorPane.integration.test.tsx`：真实挂载 CodeMirror 编辑器后，验证 `prism-editor-command`、`prism-format`、`prism-block-format` 能触发表格插入、模板插入、行内加粗和任务列表，并忽略非法模板 id；同时覆盖剪贴板图片 paste、普通图片 drop 复制到 assets、Alt / Option 图片 drop 插入原路径、Alt / Option 缺原生路径提示，列表 Enter 续写、空项退出、Tab / Shift+Tab 缩进的 CodeMirror keymap 路径，以及 Markdown 链接补全和 `[[note]]` wiki 内链补全的当前文档 / 工作区上下文。
- `src/domains/workspace/services/fileTree.test.ts`：快速打开排序、最近打开加权。
- `src/domains/workspace/components/OutlinePanel.test.tsx`：大纲标题渲染、搜索过滤、无匹配空状态，以及过滤后点击仍跳到原源码行。
- `src/domains/workspace/services/writingStats.test.ts` 和 `StatusBar.test.tsx`：中文/英文/字符/阅读时间和选区统计展示。
- `src/domains/commands/registry.test.ts`：快速打开、表格、模板、导出等命令注册到菜单和命令面板。

这些测试证明算法、命令注册、图片写入 contract 和部分 CodeMirror 命令事件可用；macOS 真实 `.app` 已补系统剪贴板图片粘贴和快速打开键盘路径。普通图片 drop / Alt 原路径 drop / Alt 缺路径提示已有 CodeMirror DOM 接线回归，但 Finder / Explorer 系统文件拖拽和剩余桌面命令仍不能只靠组件级自动化替代。

## 3. Smoke 工作区

建议固定使用仓库内临时目录，验证完成后可删除：

```text
.codex-smoke/writing-efficiency/
  workspace/
    index.md
    docs/
      guide.md
      api.md
    assets/
      drag-source.png
```

`index.md` 初始内容：

```markdown
# 写作效率 Smoke

## 已存在标题

正文段落 English word 与中文混排。

[缺失文件](docs/missing.md)
[缺失标题](#不存在标题)
[空链接]()

| Name|Score |
|---|---:|
| Prism|10|

- 第一项
- [x] 已完成任务
```

## 4. 操作步骤

### 4.1 打开工作区与快速打开

1. 启动 Prism。
2. 打开 `.codex-smoke/writing-efficiency/workspace/` 文件夹。
3. 打开 `index.md`。
4. 按 `Mod+P`。
5. 输入 `guide`，确认 `docs/guide.md` 出现在结果中。
6. 打开 `docs/guide.md` 后再次 `Mod+P`，清空输入，确认最近打开文件靠前。

通过标准：

- `Mod+P` 能打开快速打开模式。
- 路径片段能命中文件。
- 最近打开加权可见。

### 4.2 大纲导航

1. 切到侧边栏“大纲”。
2. 确认 `写作效率 Smoke`、`已存在标题` 按层级显示。
3. 在大纲搜索框输入 `已存在`。
4. 确认只保留匹配标题。
5. 点击匹配项。

通过标准：

- 大纲搜索只过滤标题列表，不修改正文。
- 无匹配时显示明确空状态。
- 点击过滤后的标题仍跳到对应源码行。

### 4.3 图片粘贴

1. 确保当前文档已保存为 `index.md`。
2. 从截图工具或图片编辑器复制一张 PNG 到剪贴板。
3. 在正文中粘贴。

通过标准：

- 当前文档旁出现 `assets/index/` 目录。
- 目录内出现 `image-YYYYMMDD-HHMMSS.png` 或同类唯一文件名。
- 编辑器插入相对路径：`![image-...](assets/index/image-....png)`。
- 预览中图片可见。
- 未保存文档时，Prism 明确提示先保存，不静默失败。

### 4.4 图片拖拽与 Option / Alt 原路径

1. 从 Finder / Explorer 把 `assets/drag-source.png` 拖进编辑器。
2. 再按住 Option / Alt 拖入同一图片。

通过标准：

- 普通拖拽复制到当前文档旁的 `assets/index/` 并插入相对路径。
- Option / Alt 拖拽不复制文件，插入原路径链接。
- 如果当前系统事件不暴露原路径，Prism 给出“无法读取拖拽文件原始路径”提示。

### 4.5 链接补全、内链补全与链接诊断

1. 在正文输入 `[Guide](`。
2. 确认补全项包含 `docs/guide.md`、`docs/api.md`。
3. 输入 `[Heading](`。
4. 确认补全项包含 `#写作效率-smoke`、`#已存在标题` 或等价 slug。
5. 输入 `[[`。
6. 确认补全项包含 `docs/guide`、`docs/api`，不包含 `drag-source.png`，也不带 `.md` 后缀。
7. 打开链接诊断入口。

通过标准：

- 工作区 Markdown 文件能作为相对路径补全。
- 当前文档 heading 能作为 anchor 补全。
- `[[note]]` 内链补全只来自工作区 Markdown / 文本文档，并插入工作区相对、无 Markdown 扩展名的目标。
- 链接诊断列出缺失文件、缺失标题、空链接。
- 点击诊断项能跳到对应源码行。

### 4.6 表格命令

1. 把光标放在现有表格内。
2. 通过命令面板或菜单执行“格式化当前表格”。
3. 继续执行“添加行”“添加列”“删除行”“删除列”。

通过标准：

- 格式化只修改当前表格，不影响上下正文。
- 添加/删除行列位置符合当前光标所在单元格。
- 撤销可以回到执行前状态。

### 4.7 列表体验

1. 在 `- 第一项` 行末按 Enter。
2. 在空列表项处再次 Enter。
3. 在任务列表项按 Enter。
4. 对列表项按 Tab / Shift+Tab。

通过标准：

- 无序列表续写 `- `。
- 空列表项退出列表。
- 任务列表续写为未勾选项。
- Tab / Shift+Tab 调整 Markdown 缩进。

### 4.8 模板

1. 打开命令面板。
2. 搜索并执行 PRD、会议纪要、周报、技术方案、公众号长文、论文草稿、读书笔记、研究摘要、白皮书模板。

通过标准：

- 无当前文档时，新建文档并填入模板。
- 有当前文档时，在光标位置插入模板。
- 学术模板只是 Markdown skeleton，不引入数据库或外部依赖。

### 4.9 字数统计与选区统计

1. 观察状态栏统计。
2. 选中一段包含中文和 English words 的文本。

通过标准：

- 未选中文本时显示全文统计。
- 选中文本时显示选区统计。
- tooltip 或 title 中包含中文字数、英文词数、字符数、预计阅读时间。

## 5. 通过标准

全部章节通过，且没有 P0/P1 问题，即可认为“写作效率 smoke 通过”。

P0 问题：

- 图片粘贴或拖拽导致内容丢失、编辑器崩溃或写入错误目录。
- 表格命令破坏表格外正文。
- 快速打开打开错误文件。
- 链接诊断点击跳转到错误位置。

P1 问题：

- Option / Alt 原路径在某平台不可用但没有明确提示。
- 字数统计明显卡顿或选区统计不更新。
- 模板插入破坏周围段落边界。

## 6. 本轮记录

2026-05-15 补强自动化证据：

- `src/domains/editor/extensions/imagePaste.test.ts` 新增 `saveClipboardImage` 文件写入回归：验证未存在 assets 目录时会调用 `mkdir(..., { recursive: true })`，并把剪贴板图片 bytes 写入当前文档旁的 `assets/<document-name>/`。
- `src/domains/editor/extensions/imagePaste.test.ts` 新增同秒冲突回归：当 `image-YYYYMMDD-HHMMSS.png` 已存在时，下一张图写入 `image-YYYYMMDD-HHMMSS-2.png`，避免覆盖旧图片。
- `npm test -- --run src/domains/editor/extensions/imagePaste.test.ts`：通过，7 tests。
- `src/domains/editor/extensions/headingSlug.ts` 新增统一标题锚点 slug contract，`linkCompletion.ts` 和 `linkDiagnostics.ts` 共享同一规则，避免标题末尾中文/英文标点导致补全值和诊断值不一致。
- `src/domains/editor/extensions/linkCompletion.test.ts` 和 `linkDiagnostics.test.ts` 新增“发布计划（第一版）!”这类标点标题回归：补全生成 `#发布计划第一版`，诊断不再把同一锚点误报为缺失。
- `npm test -- --run src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts`：通过，8 tests。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增组件级命令接线回归：真实挂载 CodeMirror 后通过全局 `prism-editor-command` 事件插入表格、插入 PRD 模板、全选后执行行内加粗，通过 `prism-block-format` 插入任务列表，并确保非法模板 id 不改正文。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增 heading 菜单事件回归：`prism-heading` 的 `h2` payload 能把当前行改成二级标题，非法 payload 会被忽略且不改正文。
- `src/domains/editor/components/EditorPane.tsx` 对 `prism-heading` payload 增加 `h1`-`h6` 校验，避免无效全局事件打断编辑器。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增无效 `prism-block-format` / `prism-editor-command` payload 回归：缺失 detail 或缺失字段时不会抛错，也不会改正文。
- `src/domains/editor/components/EditorPane.tsx` 对 block format 和 editor command 全局事件增加字符串字段守卫，避免菜单或命令面板异常 payload 打断编辑器。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增图片事件接线回归：真实挂载 CodeMirror 后，`paste` 剪贴板图片会调用当前文档资产保存 pipeline 并插入 Markdown 图片；普通 `drop` 图片会复制到当前文档 assets 并插入相对 Markdown 图片；Alt / Option `drop` 图片会插入原始路径 Markdown 链接且不会复制到 assets；Alt / Option `drop` 取不到原生路径时显示“当前运行环境无法读取拖拽文件原始路径”并保持正文不变。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增列表键盘路径回归：通过真实挂载的 CodeMirror view 触发 `Enter` 续写列表、空项再次 `Enter` 退出列表、`Tab` 缩进和 `Shift+Tab` 反缩进。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增链接补全上下文回归：真实挂载 CodeMirror 后，在 `](` 触发位置启动补全，确认建议包含当前文档 heading、同目录 Markdown、上级 README，并排除图片文件。
- `src/domains/workspace/components/OutlinePanel.tsx` 新增大纲搜索框，支持按 heading 文本过滤大纲列表；过滤不改变源码行号，点击结果仍跳到原始标题行。
- `src/domains/workspace/components/OutlinePanel.test.tsx` 新增大纲搜索回归：标题渲染、搜索过滤、无匹配空状态、过滤后点击跳源码行。
- `npm test -- --run src/domains/editor/components/EditorPane.integration.test.tsx`：通过，1 file / 15 tests。
- `npm test -- --run src/domains/workspace/components/OutlinePanel.test.tsx`：通过，1 file / 4 tests。
- `src/domains/editor/extensions/linkCompletion.ts` 新增轻量 `[[note]]` wiki 内链补全：优先识别 `[[` 触发上下文，只读取工作区 Markdown / Markdown-like 文档，补全值为工作区相对路径并移除 `.md` / `.markdown` / `.txt` 后缀；不实现图谱、反链或 wiki link 渲染。
- `src/domains/editor/extensions/linkCompletion.test.ts` 新增 wiki 内链触发和补全回归：`[[docs/gu` 能触发查询，`[[closed]]` 不触发；补全包含 `docs/guide`、`docs/api`、`README`，排除图片文件。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增真实挂载 CodeMirror 后的 wiki 内链补全上下文回归：输入 `[[` 启动补全，确认建议来自工作区 Markdown 文件且不包含图片或图片去扩展名。
- `npm test -- --run src/domains/editor/extensions/linkCompletion.test.ts src/domains/editor/components/EditorPane.integration.test.tsx`：通过，2 files / 18 tests。
- `npm test -- --run`：通过，54 files / 308 tests。
- `npm run build`：通过，仅有既有 Vite large chunk warning。
- `git diff --check`：通过。

本轮仍未执行真实桌面 UI 操作；真实系统剪贴板、Finder / Explorer 拖拽和 Option / Alt 修饰键仍需桌面 smoke。CodeMirror 命令事件、paste、drop、列表 keymap 和链接补全上下文已有组件级回归，但不能替代完整人工 smoke。

2026-05-15 macOS 真实系统剪贴板图片粘贴 smoke：

- 使用 `npm run tauri:build:app-smoke` 生成的真实 `Prism.app`。
- 准备临时工作区：`.codex-smoke/writing-efficiency/workspace/`。
- 打开 `index.md`：`open -n -a src-tauri/target/release/bundle/macos/Prism.app .codex-smoke/writing-efficiency/workspace/index.md`。
- 通过 Swift/AppKit 将 `.codex-smoke/writing-efficiency/workspace/assets/clipboard-source.png` 写入 macOS `NSPasteboard`，类型包含 `public.png`、`Apple PNG pasteboard type`、`public.tiff`。
- 初次用合成 `Cmd+V` 未触发 Prism 图片保存；改用原生菜单 `Edit > Paste` 后成功触发 paste path。
- 产物：
  - `.codex-smoke/writing-efficiency/workspace/assets/index/image-20260515-141341.png`
  - `file` 识别为 `PNG image data, 64 x 64, 8-bit/color RGB, non-interlaced`
- `index.md` 中已插入相对路径：

```markdown
![image-20260515-141341.png](assets/index/image-20260515-141341.png)
```

- 截图证据：
  - `.codex-smoke/writing-efficiency/edit-mode-before-paste.png`
  - `.codex-smoke/writing-efficiency/image-paste-menu-after-failed-save.png`
- 限制：
  - 这只验证 macOS 系统剪贴板图片粘贴，尚未验证 Finder / Explorer 拖拽。
  - Option / Alt 原路径拖拽仍未执行。
  - 本次 smoke 期间曾用 `Cmd+/` 聚焦编辑器，临时 fixture 的第一行被 CodeMirror 注释命令改为 HTML 注释；该变更只影响 `.codex-smoke/` fixture，不影响产品代码。

2026-05-15 macOS 真实 `.app` 快速打开键盘 smoke：

- 使用同一个 `npm run tauri:build:app-smoke` 生成的 `Prism.app` 和 `.codex-smoke/writing-efficiency/workspace/`。
- 真实键盘路径：在 Prism 激活状态下按 `Mod+P` 打开快速打开；输入 `gui` 后结果列表出现 `guide.md`，路径为 `docs`。
- 回车打开结果后，窗口标题变为 `guide.md`；文件树中 `docs/guide.md` 被选中；编辑区显示 `# Guide`；状态栏显示已保存。
- 清空搜索时，快速打开结果列表可见 `index.md`、`api.md`、`guide.md` 等工作区文件，证明空查询能读取当前 workspace 文件列表。
- 截图证据：
  - `.codex-smoke/writing-efficiency/quick-open-guide-search-keystroke-real-app.png`
  - `.codex-smoke/writing-efficiency/quick-open-guide-opened-by-keyboard.png`
  - `.codex-smoke/writing-efficiency/quick-open-empty-real-app-2.png`
- 限制：
  - 本 smoke 验证了路径片段搜索和键盘打开结果；最近打开加权仍主要依赖 `src/domains/workspace/services/fileTree.test.ts`，没有额外截图证明排序权重。
  - 这不覆盖链接补全、表格命令、列表体验、模板插入、Finder / Explorer 真实拖拽图片和 Option / Alt 原路径。

2026-05-15 补强图片拖拽组件级接线：

- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增普通图片 drop 回归：真实挂载 CodeMirror 后，未按 Alt / Option 时会调用当前文档资产保存 pipeline，插入 `assets/<document>/...` 相对 Markdown 图片，并且不会读取原生文件路径。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 新增 Alt / Option 缺原生路径回归：取不到 native path 时显示“当前运行环境无法读取拖拽文件原始路径”，不调用 assets 复制 pipeline，也不改正文。
- `npm test -- --run src/domains/editor/components/EditorPane.integration.test.tsx`：通过，1 file / 15 tests。
- `npm test -- --run src/domains/editor/extensions/imagePaste.test.ts`：通过，1 file / 7 tests。
- 限制：这仍是 DOM 事件级回归，不替代 macOS Finder 真实拖入、Windows Explorer 真实拖入和 Option / Alt 修饰键差异的桌面 smoke。

2026-05-15 macOS Finder 图片拖拽真实 smoke 尝试：

- 使用同一个 `npm run tauri:build:app-smoke` 生成的 `Prism.app`，打开 `.codex-smoke/writing-efficiency/workspace/index.md`。
- 准备真实 Finder 文件：`.codex-smoke/writing-efficiency/workspace/assets/drag-source.png`，`file` 识别为 `PNG image data, 64 x 64, 8-bit/color RGB, non-interlaced`。
- 用 Finder `reveal POSIX file` 打开 `assets` 目录并选中 `drag-source.png`。
- 尝试 1：Computer Use 跨应用 drag 从 Finder 文件行拖到 Prism 右侧可见编辑区；结果没有触发 Prism drop pipeline，`index.md` 和 `assets/index/` 均无新增内容。
- 尝试 2：通过 macOS `CGEvent` 发送真实鼠标 down / drag / up，从 Finder 文件行拖到 Prism 可见编辑区；结果仍未触发 Prism drop pipeline，反而在 Finder 内把临时 `assets/index` 文件夹和 `drag-source.png` 移动到 `/Users/Alex/index`。已把临时文件恢复回 `.codex-smoke/writing-efficiency/workspace/assets/`。
- 结论：当前工具链无法安全、可复现地完成 Finder -> Prism 的真实跨应用文件拖拽验证。本项仍不能宣称通过；普通 drop、Alt / Option 原路径和缺路径提示继续只由 `EditorPane.integration.test.tsx` 的 DOM 事件级回归覆盖。
- 下一步：需要人工手动 smoke，或换用能可靠暴露系统拖拽数据的 UI 自动化工具；Windows Explorer 拖拽仍需 Windows 机器验证。

2026-05-15 macOS 真实 `.app` 链接、命令、大纲和统计 smoke：

- 使用 `npm run tauri:build:app-smoke` 生成的 `Prism.app`，打开 `.codex-smoke/writing-efficiency/workspace/index.md`。
- 链接诊断：状态栏显示 `LINK 3`；点击后弹出“链接问题”面板，列出缺失文件 `docs/missing.md`、缺失标题 `#不存在标题`、空链接三类问题；点击“缺失标题”后编辑器跳到第 8 行，状态栏显示 `LN 8 COL 1`。
- 链接补全：在真实编辑器输入 `[Guide](` 后弹出补全面板，候选包含 `#写作效率-smoke`、`#已存在标题`、`docs/api.md`、`docs/guide.md`、`index.md`；键盘选中 `docs/guide.md` 后插入 `[Guide](docs/guide.md)`，链接问题数从 4 回落到 3。
- `[[note]]` 内链补全：输入 `[[` 后弹出工作区 Markdown 候选，包含 `docs/api`、`docs/guide`、`index`，不显示图片文件，也不带 `.md` 后缀。
- 表格命令：把光标放入现有表格，通过命令面板执行“格式化当前表格”，表格从 `| Name|Score |` 格式化为对齐后的 `| Name  | Score |` / `| ----- | ----: |` / `| Prism |    10 |`，表格上下正文未被改动。
- 列表体验：在 `- 第一项` 行末按 Enter 续写出空 `- `；在空列表项再次按 Enter 后退出列表，生成普通空行。
- 模板：命令面板搜索 `PRD` 并执行“PRD 模板”，在当前光标位置插入 Markdown-only PRD skeleton，包含 `# PRD：功能名称`、背景、目标、非目标、用户故事、功能范围、验收标准、风险与依赖。
- 大纲：切换“大纲”页后标题层级可见；搜索 `目标` 后只保留 `目标`、`非目标` 两个匹配项。
- 字数统计：选中“正文段落 English word 与中文混排。”后状态栏从全文统计切换为选区统计，显示 `选区 中 9 EN 2 字符 21 1 分钟`。
- 截图证据：
  - `.codex-smoke/writing-efficiency/link-diagnostics-real-app.png`
  - `.codex-smoke/writing-efficiency/link-diagnostic-jump-real-app.png`
  - `.codex-smoke/writing-efficiency/link-completion-real-app.png`
  - `.codex-smoke/writing-efficiency/link-completion-insert-real-app.png`
  - `.codex-smoke/writing-efficiency/wiki-link-completion-real-app.png`
  - `.codex-smoke/writing-efficiency/table-format-command-real-app.png`
  - `.codex-smoke/writing-efficiency/list-continuation-exit-real-app.png`
  - `.codex-smoke/writing-efficiency/template-prd-command-real-app.png`
  - `.codex-smoke/writing-efficiency/selection-writing-stats-real-app.png`
  - `.codex-smoke/writing-efficiency/outline-search-real-app.png`
- 限制：
  - 这次 smoke 覆盖 macOS 真实 `.app` 的键盘、命令面板、状态栏和大纲路径；没有覆盖 Finder / Explorer 真实拖拽。
  - `[[note]]` 只验证候选展示，未执行候选插入；插入路径仍由 `EditorPane.integration.test.tsx` 覆盖。
  - 本次验证继续使用 `.codex-smoke/` 临时 fixture，不提交 smoke 产物。

待真实 smoke 完成后，在此追加：

```text
日期：
Prism 版本：
运行方式：
平台：
快速打开：
图片粘贴：
图片拖拽：
Option/Alt 原路径：
链接补全：
链接诊断：
表格命令：
列表体验：
模板：
字数统计：
结论：
```
