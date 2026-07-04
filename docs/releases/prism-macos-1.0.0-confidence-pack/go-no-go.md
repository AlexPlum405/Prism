# Go / Conditional Go / No-Go

> Status: Go for macOS DMG v1

## Current Recommendation

**Go** for the macOS 1.0.0 manual DMG release.

## Why Go

The core release evidence is strong:

- Fail count is 0.
- P0 and P1 Blocked are 0.
- Rich copy, export actions, diagnostics, file opening, worker fallback, destructive-operation sandboxing, large workspace benchmark, and performance logging have direct evidence.
- macOS installed app has been used for real startup/file-opening smoke.
- `npm run build` passes after this confidence-pack pass.
- Focused regression tests for Error Boundary, editor scroll runtime, and i18n pass.
- Chinese, English, and Japanese now have complete i18n key coverage.
- Real Finder screenshots prove Markdown document icons render in Finder after LaunchServices refresh.
- First-run documents have real installed-app evidence after macOS Documents authorization.
- Final RC build produced the patched local DMG and installed `/Applications/Prism.app` passed smoke.
- Release copy, known limitations, and promotional page prototype are present in this confidence pack.

## Explicit Release Scope

This Go applies to a manual macOS DMG release.

It does not claim:

- Auto-updater delivery, because `TAURI_SIGNING_PRIVATE_KEY` was unavailable during final RC build.
- Windows/Linux official release readiness, because those platforms still require real-device validation.
- Day-one GIF/video marketing assets, because still screenshots are sufficient for the 1.0.0 release bar and motion assets are deferred.

## No-Go Triggers

- Any P0/P1 regression appears.
- Export main path fails in macOS installed app.
- Finder icons remain blank, clipped, or visibly broken.
- English or Japanese UI has obvious machine-translated core copy.
- Promotional screenshots cannot show Prism's core product value without test artifacts or debug traces.
