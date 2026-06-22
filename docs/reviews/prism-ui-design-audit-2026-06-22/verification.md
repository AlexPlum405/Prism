# Prism UI 修复截图验证

本轮截图只采用 `screenshots-expanded-after/` 目录。此前误截到其他应用窗口的截图已作废并从工作区移除，不作为证据使用。

## 窗口来源

- 应用路径：`/Applications/Prism.app/`
- Bundle ID：`com.prism.editor.v1`
- 窗口 owner：`Prism`
- 验证样本文档目录：`docs/reviews/prism-ui-design-audit-2026-06-22/workspace/`

## 截图索引

| 截图 | 验证点 |
| --- | --- |
| `01-prism-empty-state.png` | Prism 空状态和基础窗口结构 |
| `02-markdown-preview-filetree-statusbar.png` | Markdown 预览、文件侧栏、状态栏层级 |
| `03-markdown-split-source-preview.png` | 分栏状态下源码/预览并置 |
| `04-markdown-edit-source.png` | 编辑状态下源码区域和状态栏 |
| `05-quick-open-light-overlay.png` | 命令面板浮层减轻后的视觉重量 |
| `06-document-search-hit-feedback.png` | 文档搜索命中反馈 |
| `07-json-text-document-statusbar.png` | JSON 文本文件显示“文本文件”状态 |
| `08-json-export-disabled-reasons.png` | JSON 文本文件导出禁用原因 |
| `09-markdown-relation-graph-button.png` | Markdown 有链接关系时显示图谱按钮 |
| `10-markdown-relation-graph-panel-with-edge.png` | 关系图谱能解析链接并显示边 |
| `11-sql-text-document-statusbar-no-graph.png` | SQL 文本文件显示“文本文件”且不显示图谱按钮 |
| `12-sql-export-disabled-reasons.png` | SQL 文本文件导出菜单显示“仅 Markdown 文稿可导出” |
| `13-json-text-document-statusbar-no-graph.png` | JSON 文本文件不显示图谱按钮 |
| `14-markdown-export-enabled-menu.png` | Markdown 文稿导出格式可用，未显示“仅 Markdown 文稿可导出” |

## 本轮重点确认

- 普通文本文件，包括 `.sql`、`.json`，可以被 Prism 打开并以文本文件形态呈现。
- 文本文件状态栏显示“文本文件”，并隐藏关系图谱入口。
- Markdown 文稿存在真实链接关系时显示图谱按钮，图谱面板能显示节点和边。
- 文本文件的导出菜单保留原位置，但每个不可用导出项显示明确禁用原因。
- Markdown 文稿的 PDF、Word、HTML、PNG 导出菜单项保持可用。
