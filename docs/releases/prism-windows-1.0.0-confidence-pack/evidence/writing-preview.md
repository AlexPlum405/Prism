# 写作与预览

## Markdown 预览

验证文件：`Documents\PrismWindowsSmoke\Examples\windows-smoke.md`

已验证内容：

- 标题
- 任务列表
- 表格
- Mermaid 图
- KaTeX 公式

## 结果

点击 `预览` 后，Prism 把 Markdown 渲染成了可读的排版视图，页面里能看到：

- `Windows Smoke`
- 任务列表的复选框状态
- 结构化表格
- Mermaid 的 `A -> B`
- `E = mc^2` 公式

## 视图状态

当前文档仍保留 `Markdown 文稿` / `排版` 入口，说明写作模式和预览模式都在同一个窗口里可切换。

分栏视图截图：

- `screenshots/05-split-preview.png`：Prism 窗口级截图，左侧为 Markdown 编辑区，右侧为预览区；能看到标题、任务列表、表格、Mermaid 和 KaTeX。

## 搜索 / 替换

在 `keyboard-smoke.md` 中验证：

- `Ctrl+F` 打开查找栏。
- `Ctrl+H` 展开替换栏。
- 替换栏显示 `查找`、`替换`、`全部替换` 控件。

结果：通过。

## 知识图谱入口

在 `GraphSmoke` 互链工作区中验证：

- Markdown 文档 `a.md` 有链接关系时，状态栏出现 `查看关系图谱`。
- 打开图谱面板后可见 `Graph Smoke A`、`Graph Smoke B` 两个节点。
- 文本文件 `plain.txt` 显示为 `文本文件`，没有关系图谱入口。

截图：`screenshots/15-relation-graph.png`。

## 长文预览

临时长文：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\long-preview-export-smoke.md
```

规模：约 186126 字符 / 5034 行。

结果：Prism 可以打开并切换到预览视图，窗口级截图见 `screenshots/16-long-preview.png`。

## 图片粘贴 / 拖拽

命令：

```text
npm test -- --run src/domains/editor/extensions/imagePaste.test.ts src/domains/editor/runtime/editorClipboardRuntime.test.ts src/domains/editor/runtime/editorClipboardController.test.ts src/domains/editor/components/EditorPane.integration.test.tsx -t "image|drop|clipboard|Alt|Option|drag"
```

结果：通过。

摘要：

- Test Files：`4 passed (4)`。
- Tests：`24 passed | 31 skipped (55)`。

覆盖：

- 剪贴板图片保存到 assets。
- 拖拽图片复制。
- Alt / Option drop 插入原路径。
- 读取不到原路径时给出提示。

说明：该项有自动化覆盖，本轮未补人工拖拽 UI 截图。

## 快捷键与主题语言

主题、语言和快捷键细节见 [ui-and-shortcuts.md](./ui-and-shortcuts.md)。
