# Prism Real WebView Preview Benchmark

> Generated: 2026-06-17T12:01:09.861Z

This benchmark launches the packaged Tauri `.app` with 1MB and 3MB Markdown fixtures. DOM commit is recorded as an observable substitute because `tauri-driver` is not available in this environment.

| Fixture | View mode | Bytes | Status | Visible ms | Last session ms | Screenshot ms | Actions / error |
|---|---:|---:|---|---:|---:|---:|---|
| 1mb | preview | 1049011 | pass | 930.6 | 4534 | 14947.3 | scrollPageDown:pass, searchFirstTerm:pass, contextMenuAttempt:error, sourceLocateFromPreview:notAutomated |
| 3mb | preview | 3146641 | timeout | 928 | - | 91991.9 |  |

JSON report: `docs/verification/prism-preview-webview-benchmark-2026-06-17.json`
