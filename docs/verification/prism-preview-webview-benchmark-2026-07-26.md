# Prism Real WebView Preview Benchmark

> Generated: 2026-07-27T08:10:50.710Z

This benchmark launches the packaged Tauri `.app` with 1MB and 3MB Markdown fixtures.

**Metric caveats.** `Visible ms` includes the cost of the `swift` window probe that detected it (~260ms warm, ~960ms cold); the JSON also reports `openCommandToVisibleEarliestMs` as the lower bound. `Last session ms` includes a 500ms lifecycle debounce plus up to 500ms of poll lag, so roughly 750ms of it is fixed harness cost independent of document size. Per-action `actionMs` measures the `osascript` process including its hardcoded delays and returns once keystrokes are delivered — it is not an app response time.

| Fixture | View mode | Bytes | Status | Visible ms | Last session ms | Screenshot ms | Actions / error |
|---|---:|---:|---|---:|---:|---:|---|
| 1mb | preview | 1048885 | pass | 1780 | 2523.4 | 31007.7 | scrollPageDown:pass, searchFirstTerm:pass, contextMenuAttempt:error, sourceLocateFromPreview:notAutomated |
| 3mb | preview | 3146515 | pass | 525.8 | 6073.2 | 12902.6 | scrollPageDown:pass, searchFirstTerm:pass, contextMenuAttempt:error, sourceLocateFromPreview:notAutomated |

## Stage breakdown (in-app instrumentation)

Measured by performance marks inside the packaged WebView, not inferred. `domCommit→paint` is two `requestAnimationFrame` ticks after React commits the HTML, so it approximates first paint rather than measuring compositing directly.

| Fixture | doc read ms | markdown render ms | markdown→domCommit ms | domCommit→paint ms | post-process ms | lastSession debounce ms |
|---|---:|---:|---:|---:|---:|---:|
| 3mb | 16 | 424 | 92 | 4725 | - | 5131 |

JSON report: `docs/verification/prism-preview-webview-benchmark-2026-07-26.json`
