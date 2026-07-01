# P1 Fix Installed Retest - 2026-07-01

App: /Applications/Prism.app
Bundle ID: com.prism.editor.v1
Fixture: docs/verification/runs/prism-full-functional-2026-06-27/fixtures/computer-use-real-app/real-complex-diagrams-export.md

## PRISM-FF-095 / P1-FILE-004 文件属性信息

步骤：
1. 打开安装版 Prism 到 real-complex-diagrams-export.md。
2. 点击应用内菜单 文件。
3. 确认菜单中出现“文件属性”。
4. 点击“文件属性”。

实际结果：
- 弹出属性信息对话框。
- 对话框显示名称、完整路径、类型、大小、创建时间、修改时间、访问时间、只读状态。
- 证据截图：screenshots/32-installed-p1-fix-retest/01-file-properties-dialog.png

状态：Pass

## PRISM-FF-104 / P1-SETTINGS-003 打开主题目录

步骤：
1. 在安装版 Prism 打开设置中心。
2. 切到“外观”。
3. 点击“打开主题目录”。

实际结果：
- Prism 显示成功 toast：已打开主题目录。
- toast 中显示路径 /Users/Alex/Library/Application Support/com.prism.editor.v1/themes。
- 证据截图：screenshots/32-installed-p1-fix-retest/02-theme-directory-toast.png

系统窗口查询：
Finder windows=2
- themes
- level-maas-ai


状态：Pass

## PRISM-FF-125 / P2-EXPORT-002 PDF 分页避切

步骤：
1. 打开安装版 `/Applications/Prism.app` 到 `real-complex-diagrams-export.md`。
2. 点击状态栏“导出”菜单，选择“导出为 PDF”。
3. 在导出对话框中确认预检无阻断错误，目标为 `real-complex-diagrams-export.pdf`，清晰度为“极致 4x”。
4. 覆盖导出同名 PDF。
5. 使用 `pdfinfo` 和 `pdftoppm -png -r 144` 检查真实产物。

实际结果：
- Prism 前台任务完成后回到普通编辑状态。
- 新 PDF 产物创建/修改时间为 2026-07-01 11:16:35，2 页 A4。
- 第 1 页 Mermaid 和 PlantUML 图表完整，`PlantUML Relationship` 标题没有孤立在页底，PlantUML `Prism` 节点文字可见。
- 第 2 页 `Markmap Mind Map` 标题与 Markmap 图表同页，Local Resource、表格和数学公式完整可见，没有文字被分页切成上下两半。
- 证据截图：screenshots/32-installed-p1-fix-retest/05-real-complex-pdf-page-1.png、screenshots/32-installed-p1-fix-retest/05-real-complex-pdf-page-2.png
- 元数据日志：logs/computer-use-real-app/real-complex-pdf-postfix-pdfinfo-20260701.log、logs/computer-use-real-app/real-complex-pdf-postfix-stat-20260701.log

状态：Pass
