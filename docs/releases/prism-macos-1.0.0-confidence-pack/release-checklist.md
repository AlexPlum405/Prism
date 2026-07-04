# macOS 1.0.0 Release Checklist

> Status: Draft v0

## Summary

Current recommendation: **Conditional Go**.

| Gate | Status | Evidence |
|---|---|---|
| P0 all Pass | Pass | `manifest.json`: P0 88 Pass / 0 Blocked |
| P1 all Pass | Pass | `manifest.json`: P1 56 Pass / 0 Blocked |
| Fail count is 0 | Pass | `manifest.json`: Fail 0 |
| macOS app launches and opens supported files | Pass | `logs/unit-tests/macos-file-association-startup-smoke-20260702.log` |
| Core edit / preview / export workflow | Pass | `test-report.md`, `release-candidate-2026-07-01.md` |
| Build gate | Pass | `evidence/build-and-test-validation.md` |
| Focused regression tests | Pass | `evidence/build-and-test-validation.md` |
| Rich copy P0 closed | Pass | `logs/blocked-burn-down-20260701/prism-ff-026-copy-installed-app.log` |
| Export success actions and diagnostics | Pass | `release-candidate-2026-07-01.md` |
| Markdown/Text document icons configured | Pass | `evidence/app-identity-and-document-icons.md` |
| Finder icon real-world verification | Pass | `finder-icon-verification.md`, `evidence/finder-icon-real-screenshots.md` |
| Chinese/English/Japanese key coverage | Pass | `evidence/i18n-key-coverage.md` |
| Chinese/English/Japanese contextual UI review | Pass | `i18n-review.md`, `screenshots/i18n/` |
| Version metadata matches 1.0.0 | Pass | Source config and installed app report `1.0.0` |
| First-run Prism documents and guide | Pass | `evidence/first-run-documents-validation.md`, `screenshots/10-first-run-documents.png` |
| Release narrative materials | Draft | `copy-and-positioning.md`, `promo-page/index.html` |
| Release screenshots / GIF / video source | Partial | Still screenshots captured; GIF/video source pending in `screenshots.md` |
| Known limitations clearly documented | Draft | `known-limitations.md` |

## Required Before Go

1. Finish README first-screen copy and macOS 1.0.0 Release Notes.
2. Decide whether the first public page requires GIF/video on day one. If yes, capture the motion assets listed in `screenshots.md`.
3. Review the promotional page with the accepted still screenshots now wired into `promo-page/index.html`.
4. Update `go-no-go.md` from Conditional Go to Go only if all required evidence is present.

## Non-Blocking For macOS 1.0.0

These remain important but do not block macOS first release if clearly documented:

- Windows titlebar, file association, path handling, export
- Linux titlebar, file association, export
- Full offline network-blocked rendering proof
- Full high-DPI 1x/2x/4x matrix
- Long-running memory release pressure
- Repeated 4x large PNG export memory pressure

## Current Command Evidence

Latest observed status:

```text
Total 168 / Pass 156 / Fail 0 / Blocked 12 / Not Run 0
P0 88 Pass / 0 Fail / 0 Blocked / 0 Not Run
P1 56 Pass / 0 Fail / 0 Blocked / 0 Not Run
P2 6 Pass / 0 Fail / 10 Blocked / 0 Not Run
P3 6 Pass / 0 Fail / 2 Blocked / 0 Not Run
```

Additional release-pack evidence captured on 2026-07-04:

```text
i18n key coverage: zh-CN 1106 / en-US 1106 / ja-JP 1106, missing 0
i18n test: src/domains/i18n/i18n.test.ts, 3 passed
i18n contextual screenshots: zh-CN/en-US/ja-JP main window + settings window captured
Finder document icons: .md, .markdown, .txt, .json, .sql show Prism icon in real Finder screenshots
Installed app version: 1.0.0
Focused regression tests: 3 files / 8 tests passed
npm run build: passed with non-blocking Vite chunk/externalization warnings
macOS app smoke: npm run tauri:build:app-smoke passed
First-run documents: installed app cold start opened /Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md after macOS Documents authorization
```
