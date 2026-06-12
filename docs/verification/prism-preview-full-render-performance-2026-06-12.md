# Prism 完整预览性能优化记录

> 日期：2026-06-12
> 目标：约 1MB Markdown 文档完整预览最快，不改成首屏虚拟化或懒加载预览。

## 基准命令

显式开启 1MB 混合 Markdown 完整预览基准：

```bash
PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx
```

该基准构造约 1MB Markdown，覆盖标题、长段落、表格、代码块、Callout、wiki link、KaTeX、Mermaid placeholder 和本地图片引用。记录：

- `markdownToHtmlMs`：Markdown 到 HTML 的完整转换耗时。
- `domWriteMs`：`#write.innerHTML` 写入耗时。
- `domTargetScanMs`：当前 DOM 后处理目标扫描耗时。
- `mediaTargetCount` / `katexErrorCount` / `mermaidPlaceholderCount`：图片、KaTeX 错误、Mermaid placeholder 数量。

## 2026-06-12 基线

命令：

```bash
PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose
```

环境：本机 Vitest/jsdom，Node 运行时；该数字用于 repo 内同机同命令前后对比，不代表真实 Tauri WebView 绝对耗时。

| 指标 | 中位数 / 数量 |
|---|---:|
| Markdown 内容长度 | 1,048,751 |
| HTML 长度 | 11,323,428 |
| `markdownToHtmlMs` | 5,026.4 ms |
| `domWriteMs` | 3,531.7 ms |
| `domTargetScanMs` | 739.7 ms |
| 图片目标 | 359 |
| KaTeX 错误目标 | 0 |
| Mermaid placeholder | 431 |

单次样本：

| 样本 | `markdownToHtmlMs` | `domWriteMs` | `domTargetScanMs` |
|---:|---:|---:|---:|
| 0 | 5,076.0 ms | 3,176.0 ms | 739.7 ms |
| 1 | 4,956.0 ms | 3,531.7 ms | 712.7 ms |
| 2 | 5,026.4 ms | 3,650.7 ms | 947.6 ms |
