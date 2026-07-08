# 导出 Smoke

## 1. UI HTML 导出

在 `windows-smoke.md` 上打开导出菜单，使用默认清晰度导出了 HTML。

窗口级截图：

- `screenshots/09-export-dialog.png`：Prism 导出菜单弹出状态。

输出文件：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\Examples\windows-smoke.html
```

大小：

```text
423587 bytes
```

## 2. 复杂导出 smoke

命令：

```text
npm test -- --run src/domains/export/exportPipeline.test.ts -t "writes complex export smoke artifacts for all supported formats"
```

结果：通过。

产物已经复制到：

```text
docs/releases/prism-windows-1.0.0-confidence-pack/artifacts/export/
```

文件：

- `complex-export.html`
- `complex-export.pdf`
- `complex-export.png`
- `complex-export.docx`
- `windows-smoke.html`

窗口级截图：

- `screenshots/10-export-results.png`：资源管理器窗口本体，能看到上述 5 个导出产物。

这个 smoke 还验证了：

- HTML 含标题、目录、表格、Mermaid、KaTeX、图片和引用标记。
- PDF 是 A4 页面。
- PNG 有合法 PNG 签名。
- DOCX 含 `document.xml` 和媒体文件。

## 3. 预检与坏链接 / 缺图诊断

命令：

```text
npm test -- --run src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/export/preflight.test.ts
```

结果：通过。

```text
Test Files  2 passed (2)
Tests       15 passed (15)
```

覆盖项：

- 缺失本地图片会产生 image diagnostic。
- 缺失 Markdown 文件、空链接目标、缺失标题锚点会产生 link diagnostic。
- Mermaid、KaTeX、重复标题锚点、Markdown 表格错误会在导出预检中暴露。
- 无错误的 MiaoYan 兼容表格不会阻止导出。

结论：导出诊断能识别坏链接 / 缺图，并且不会阻止无错误文档导出。

## 4. 中文、空格、括号路径

复杂路径：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\路径 Smoke (中文 空格)\复杂 路径 (测试).md
```

结果：

- Prism 可打开该路径下的 Markdown。
- 路径复制保留 `\\?\C:\...` Windows 长路径语义。
- 复杂导出 smoke 和 UI HTML 导出均成功落盘，产物已收集到 `artifacts/export/`。
