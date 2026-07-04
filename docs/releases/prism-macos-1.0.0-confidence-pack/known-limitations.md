# Known Limitations

> Status: Release v1

These items remain Blocked in the full-feature manifest. They must be transparent in release decision-making, but they do not automatically block the macOS first release.

## Current Blocked Items

| ID | Priority | Feature | Release Impact |
|---|---|---|---|
| PRISM-FF-148 | P2 | macOS sandbox authorization | Partially verified in this release pack: real Documents prompt appeared, and after Allow the installed app opened the default Prism workspace and guide. Still Blocked in the full manifest until a repeatable permission-reset / clean-profile run is added. |
| PRISM-FF-150 | P2 | Windows titlebar layout | Does not block macOS. Windows staged release. |
| PRISM-FF-151 | P2 | Windows file association | Does not block macOS. Windows staged release. |
| PRISM-FF-152 | P2 | Windows path handling | Does not block macOS. Windows staged release. |
| PRISM-FF-153 | P2 | Windows export | Does not block macOS. Windows staged release. |
| PRISM-FF-154 | P2 | Linux titlebar layout | Does not block macOS. Linux staged release. |
| PRISM-FF-155 | P2 | Linux file association | Does not block macOS. Linux staged release. |
| PRISM-FF-156 | P2 | Linux export | Does not block macOS. Linux staged release. |
| PRISM-FF-157 | P2 | Offline rendering | Needs network-blocked proof. Current export artifacts show no obvious remote references but not full offline proof. |
| PRISM-FF-159 | P2 | High DPI | Needs dedicated 1x/2x/4x and display scaling matrix. |
| PRISM-FF-163 | P3 | Memory release | Needs long-running memory pressure script/window. |
| PRISM-FF-164 | P3 | Large PNG export memory | Needs repeated 4x large PNG pressure run. |

## Release Interpretation

macOS 1.0.0 can still ship if:

- The macOS sandbox authorization risk is described accurately: current release-pack evidence covers the Allow path, while repeatable permission-reset automation remains pending.
- Windows/Linux are clearly marked as later staged releases.
- Offline, high-DPI, and memory pressure items are listed as known validation gaps, not hidden failures.
- Auto-updater signing is not claimed unless `TAURI_SIGNING_PRIVATE_KEY` is provided and a signed updater artifact is generated.

## Release Pack Findings

These findings came from the 1.0.0 confidence-pack pass, not from the original full-feature manifest:

| Finding | Status | Release Impact |
|---|---|---|
| Finder `.json` document icon verification | Closed | Retest after LaunchServices refresh shows `.json` rendering the Prism document icon in real Finder screenshots. |
| Markdown and text document icons are visually identical | Closed | Accepted for 1.0.0; the release claim is a cleaner unified Prism document icon, not per-extension artwork. |
| Source and installed app version alignment | Closed | Source config and installed app now report `1.0.0`. |
| English/Japanese key coverage and contextual screenshots | Closed | Key coverage is Pass, and zh-CN/en-US/ja-JP main + settings screenshots are captured. |
| First-run Prism documents after authorization | Partially Closed | Real macOS Documents authorization was observed; after Allow, cold start opened `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md`. Full manifest closure still needs repeatable permission reset evidence. |
| Auto-updater signing | Deferred | Final RC generated local app/DMG artifacts, but updater signing was not completed because `TAURI_SIGNING_PRIVATE_KEY` was unavailable. This does not block a manual DMG release. |

## Not Allowed

- Do not mark Windows/Linux items Pass without real-device evidence.
- Do not claim offline support is fully verified until a real network-blocked run exists.
- Do not claim memory pressure stability from a single export.
