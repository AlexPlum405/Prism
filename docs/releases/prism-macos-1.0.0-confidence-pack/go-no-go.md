# Go / Conditional Go / No-Go

> Status: Conditional Go draft

## Current Recommendation

**Conditional Go** for macOS 1.0.0.

## Why Conditional Go

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

But release confidence is not complete:

- Core still screenshots are captured, but promotional motion assets are not captured.
- Release copy is still draft.

## Conditions To Move To Go

1. `copy-and-positioning.md` has final README hero and Release Notes copy.
2. `known-limitations.md` is linked from release notes or README.
3. `promo-page/index.html` passes visual review with the accepted real screenshots now wired in.
4. Day-one GIF/video requirement is either completed or explicitly deferred from the 1.0.0 release bar.

## No-Go Triggers

- Any P0/P1 regression appears.
- Export main path fails in macOS installed app.
- Finder icons remain blank, clipped, or visibly broken.
- English or Japanese UI has obvious machine-translated core copy.
- Promotional screenshots cannot show Prism's core product value without test artifacts or debug traces.
