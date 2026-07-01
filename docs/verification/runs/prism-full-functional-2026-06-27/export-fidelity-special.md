# Prism 导出保真专项

日期：2026-07-01
App：`/Applications/Prism.app`
Bundle ID：`com.prism.editor.v1`
测试目录：`docs/verification/runs/prism-full-functional-2026-06-27/`

## 结论

当前导出保真主链路已闭环为 Pass：HTML、PDF、PNG、DOCX 四种基础导出可由真实安装版 Prism 生成有效产物；复杂图表 fixture 覆盖 Mermaid、PlantUML、Markmap、本地 SVG、表格和数学公式，相关预览和导出证据已归档。

本专项不把历史 pre-fix 失败截图删除。旧截图用于证明曾经的问题，当前状态以 `manifest.json` 中对应用例的最新 `actual`、`screenshots` 和 `logEvidence` 为准。

仍未通过真实环境证明的导出项保持 Blocked：Windows 导出、Linux 导出、连续大图内存压力。Blocked 不等同于 Pass。

## 验收矩阵

| 范围 | 用例 | 当前状态 | 关键证据 |
|---|---|---|---|
| 基础 HTML 导出 | `PRISM-FF-071` | Pass | `fixtures/computer-use-real-app/real-open-markdown.html`，`logs/computer-use-real-app/export-artifact-validation.log` |
| 基础 PDF 导出 | `PRISM-FF-072` | Pass | `fixtures/computer-use-real-app/real-open-markdown.pdf`，`logs/computer-use-real-app/export-artifact-validation.log` |
| 基础 PNG 导出 | `PRISM-FF-073` | Pass | `fixtures/computer-use-real-app/real-open-markdown.png`，尺寸 `4160x4800`，未降到 1x |
| 基础 DOCX 导出 | `PRISM-FF-074` | Pass | `fixtures/computer-use-real-app/real-open-markdown.docx`，zip 校验和 `textutil` 提取通过 |
| Front Matter 覆盖导出 | `PRISM-FF-078` | Pass | `screenshots/29-installed-frontmatter-export-toc-smoke/01-frontmatter-html-export-success.png`，`logs/computer-use-real-app/frontmatter-export-html-check-20260701.log` |
| PDF 链接注释 | `PRISM-FF-122` | Pass | `logs/computer-use-real-app/pdf-link-annotations-pdf-lib-20260701.log`，确认 `/Subtype /Link` 与 GitHub URI |
| 本地资源解析 | `PRISM-FF-123` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-204-export-local-resource-html-chrome-window.png` |
| PNG 分片边界 | `PRISM-FF-124` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-205-png-export-slice-top.png`、`PRISM-CU-206-png-export-slice-middle.png`、`PRISM-CU-207-png-export-slice-bottom.png` |
| PDF 分页避切 | `PRISM-FF-125` | Pass | `screenshots/32-installed-p1-fix-retest/05-real-complex-pdf-page-1.png`、`05-real-complex-pdf-page-2.png`，`logs/computer-use-real-app/p1-fix-installed-retest-20260701.md` |
| DOCX 图片 fallback | `PRISM-FF-126` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-208-docx-wps-diagrams-page-window.png`，`logs/computer-use-real-app/docx-complex-inspection.log` |
| DOCX 表格宽度 | `PRISM-FF-127` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-209-docx-wps-table-math-page-window.png`，OOXML 表宽 `9866 dxa` |
| DOCX 公式 | `PRISM-FF-128` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-209-docx-wps-table-math-page-window.png`，公式 token 存在且 WPS 可见 |
| HTML 自包含 | `PRISM-FF-129` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-203-html-export-self-contained-chrome-window.png`，`remoteAssets=0` |
| 导出失败诊断 | `PRISM-FF-130` | Pass | `screenshots/06-diagnostics/PRISM-FF-130-case-130.png` |
| 导出取消 | `PRISM-FF-131` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-222-export-cancel-dialog-window.png`、`PRISM-CU-223-export-cancel-status-restored-window.png` |
| 导出打开产物动作 | `PRISM-FF-132` | Pass | `screenshots/35-installed-export-open-actions-retest/01-html-export-success-toast.png`、`02-open-action-external-app.png`、`04-reveal-action-finder-location.png` |
| 后台导出状态 | `PRISM-FF-133` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-224-export-success-open-actions-window.png` |
| macOS PDF capture | `PRISM-FF-149` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-238-pdf-link-export-complete-window.png` |

## 图表与公式

| 范围 | 用例 | 当前状态 | 关键证据 |
|---|---|---|---|
| KaTeX | `PRISM-FF-041` | Pass | `screenshots/05-preview-rendering/PRISM-FF-041-katex-katex.png`，复杂导出 PDF/DOCX/HTML 同时覆盖公式区域 |
| Mermaid | `PRISM-FF-042` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-123-complex-diagrams-preview-mermaid-window.png`，复杂 PDF 第 1 页可见 |
| PlantUML 离线渲染 | `PRISM-FF-043` | Pass | `screenshots/31-plantuml-regression/PRISM-CU-301-installed-plantuml-prism-label-pass.png`，`logs/plantuml-regression/plantuml-png-regression-20260701.log` |
| Markmap | `PRISM-FF-044` | Pass | `screenshots/15-computer-use-real-app/PRISM-CU-125-complex-diagrams-preview-markmap-window.png`，复杂 PDF 第 2 页可见 |
| 表格 | `PRISM-FF-035/036/037/127` | Pass | 表格插入、浮动工具栏、TSV/排序和 DOCX 宽度均有独立截图证据 |

## 复杂导出产物

复杂 fixture：

`fixtures/computer-use-real-app/real-complex-diagrams-export.md`

真实安装版 Prism 已生成并归档：

- `fixtures/computer-use-real-app/real-complex-diagrams-export.html`
- `fixtures/computer-use-real-app/real-complex-diagrams-export.pdf`
- `fixtures/computer-use-real-app/real-complex-diagrams-export.png`
- `fixtures/computer-use-real-app/real-complex-diagrams-export.docx`

复核摘要：

- HTML：可通过 `file://` 离线打开，结构检查无远程资产和相对本地资产引用。
- PDF：修复后为 2 页 A4，Mermaid、PlantUML、Markmap、表格、数学公式没有明显缺失或分页切半。
- PNG：复杂图表产物尺寸为 `4108x11072`，三段切片未见明显拼接白缝。
- DOCX：WPS 可打开，包内包含 7 个媒体资源和 6 个 drawing，表格宽度和公式可读性通过复核。

## 仍需单独复测

| 用例 | 状态 | 原因 | 建议复测方式 |
|---|---|---|---|
| `PRISM-FF-153` Windows 导出 | Blocked | 无 Windows 真机 | 在真实 Windows 环境回填 HTML/PDF/PNG/DOCX 产物和截图 |
| `PRISM-FF-156` Linux 导出 | Blocked | 无 Linux 真机 | 在真实 Linux 环境回填 HTML/PDF/PNG/DOCX 产物和截图 |
| `PRISM-FF-164` 导出大图内存 | Blocked | 未执行连续 4x PNG 压力导出 | 使用专用长文档和进程内存采样脚本执行压力测试 |

## 历史失败证据说明

以下证据保留为 pre-fix 记录，不代表当前 manifest 仍 Fail：

- `screenshots/15-computer-use-real-app/PRISM-CU-137-complex-export-png-plantuml-crop.png`
- `screenshots/15-computer-use-real-app/PRISM-CU-139-complex-export-pdf-page-1.png`
- `screenshots/15-computer-use-real-app/PRISM-CU-139-complex-export-pdf-page-2.png`
- 早期 PlantUML `Prism` 节点文字缺失截图

当前 PlantUML、PDF 分页和复杂 PNG 结论应以 `screenshots/31-plantuml-regression/` 与 `screenshots/32-installed-p1-fix-retest/` 为准。

## 回归建议

发布前建议至少执行：

```bash
jq '.counts' docs/verification/runs/prism-full-functional-2026-06-27/manifest.json
npm run build
npm run tauri:build:app-smoke
PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs
node scripts/run-plantuml-png-regression.mjs
git diff --check
```

如果只改文档和验证记录，可以只跑：

```bash
jq '.counts' docs/verification/runs/prism-full-functional-2026-06-27/manifest.json
git diff --check
```
