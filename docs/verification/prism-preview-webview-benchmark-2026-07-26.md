# Prism Real WebView Preview Benchmark

> Generated: 2026-07-26T14:27:27.642Z（issue #1 修复后一轮）

This benchmark launches the packaged Tauri `.app` with 1MB and 3MB Markdown fixtures. DOM commit is recorded as an observable substitute because `tauri-driver` is not available in this environment.

Fixtures 现已注入原生 HTML `<details>` 折叠块、GFM 任务列表与行内 `<kbd>`，以便真正命中预览快速路径的按块委派逻辑（issue #1；此前 fixture 完全不含 HTML，即 issue #3 记录的盲点）。委派块数量：1MB 390 个 / 3MB 1158 个。

| Fixture | View mode | Bytes | Status | Visible ms | Last session ms | Screenshot ms | Actions / error |
|---|---:|---:|---|---:|---:|---:|---|
| 1mb | preview | 1048885 | pass | 1037.1 | 1508.3 | 5882.6 | scrollPageDown:pass, searchFirstTerm:pass, contextMenuAttempt:error, sourceLocateFromPreview:notAutomated |
| 3mb | preview | 3146515 | pass | 1014 | 3527.7 | 7870.2 | scrollPageDown:pass, searchFirstTerm:pass, contextMenuAttempt:error, sourceLocateFromPreview:notAutomated |

## issue #1 修复前后对比（同一 fixture，各打一次 release `.app`）

修复前读数取自 `git show HEAD:src/lib/markdownToHtml.ts` 还原后重新打包实测。

| 指标 | 修复前 | 修复后 |
|---|---:|---:|
| 1MB 打开→会话就绪 | 2514.3ms | **1508.3ms** |
| 1MB 打开→截图完成 | 7056.2ms | **5882.6ms** |
| 3MB 打开→会话就绪 | 12094.6ms | **3527.7ms** |
| 3MB 打开→截图完成 | 15842.2ms | **7870.2ms** |
| 1MB / 3MB 预览滚动 action | 198.0 / 206.9ms | 215.9 / 212.5ms |
| 1MB / 3MB 预览搜索 action | 309.1 / 294.4ms | 306.9 / 296.7ms |

"打开→窗口可见"两次分别为 before 1133.4 / 345.1ms、after 1037.1 / 1014.0ms，波动大于差异，不作为结论。

JSON report: `docs/verification/prism-preview-webview-benchmark-2026-07-26.json`
