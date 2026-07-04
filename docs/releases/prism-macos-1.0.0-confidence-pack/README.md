# Prism macOS 1.0.0 Release Confidence Pack

> Status: Draft v0
> Date: 2026-07-04
> Scope: macOS first official release only. Windows and Linux remain staged releases pending real-device validation.

## Purpose

This package exists to answer one question with evidence:

**Is Prism strong enough to ship its first official macOS release?**

The answer must be based on reproducible artifacts, not intent or optimism. Every release claim in this package links to a local evidence file, a verification report, or an explicit pending item.

## Current Evidence Baseline

- Full functional run: `docs/verification/runs/prism-full-functional-2026-06-27/`
- Manifest: `docs/verification/runs/prism-full-functional-2026-06-27/manifest.json`
- Test report: `docs/verification/runs/prism-full-functional-2026-06-27/test-report.md`
- RC report: `docs/verification/runs/prism-full-functional-2026-06-27/release-candidate-2026-07-01.md`
- Blocked burn-down: `docs/verification/runs/prism-full-functional-2026-06-27/logs/blocked-burn-down-20260701/blocked-burn-down-20260701.md`

Current manifest counts:

| Total | Pass | Fail | Blocked | Not Run |
|---:|---:|---:|---:|---:|
| 168 | 156 | 0 | 12 | 0 |

Priority breakdown:

| Priority | Pass | Fail | Blocked | Not Run |
|---|---:|---:|---:|---:|
| P0 | 88 | 0 | 0 | 0 |
| P1 | 56 | 0 | 0 | 0 |
| P2 | 6 | 0 | 10 | 0 |
| P3 | 6 | 0 | 2 | 0 |

## Release Positioning

Prism 1.0.0 should ship as a differentiated local Markdown writing tool, not as a claim to fully replace Typora or MiaoYan.

Core claim:

> Prism is an open-source, local-first Markdown editor for long-form and technical writing, focused on trustworthy preview, trustworthy export, and actionable diagnostics.

Launch audience:

- Markdown long-form writers
- Technical writers
- Local document heavy users
- Users who like Typora/MiaoYan-style writing but need stronger diagram, formula, export, and diagnostic workflows

## Go / Conditional Go / No-Go

Current draft result: **Conditional Go**.

Why not Go yet:

- Release narrative materials are still draft and need final copy.
- Still screenshots now cover the core macOS release story, but promotional motion assets and final landing-page media selection are not finished.

Why not No-Go:

- Fail count is 0.
- P0/P1 Blocked are 0.
- macOS installed app smoke and multiple code-verified regressions already support the core writing workflow.
- Finder document icon verification and installed `1.0.0` version metadata are now backed by real installed-app evidence.
- Chinese, English, and Japanese have key coverage plus real core UI screenshots.
- First-run Prism documents are verified after macOS Documents authorization: the installed app cold-starts into `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md`.
- Remaining Blocked items are either non-macOS staged-platform items or explicit specialty validation windows.

See: `go-no-go.md`.

## Package Contents

- `release-checklist.md` - macOS 1.0.0 release bar and evidence status
- `copy-and-positioning.md` - README hero copy, Release Notes draft, and positioning language
- `i18n-review.md` - Chinese / English / Japanese release-language review plan and evidence table
- `finder-icon-verification.md` - Finder document icon verification plan and current Info.plist evidence
- `evidence/` - command output, manifest summary, app identity, i18n coverage, and Finder icon evidence
- `screenshots.md` - release screenshot and animation shot list
- `known-limitations.md` - remaining Blocked items and why they do or do not block macOS 1.0.0
- `go-no-go.md` - final release recommendation
- `promo-page/index.html` - static promotional page prototype

## Evidence Rules

- Do not mark evidence as Pass without a real file, screenshot, command output, or explicit report reference.
- Existing full-feature screenshots may be used for angle discovery only; release screenshots must be recaptured.
- Windows/Linux evidence must come from real devices or real environments.
- macOS Finder icon evidence must include real Finder screenshots, not only Info.plist or PNG inspection.
- English/Japanese release quality is judged by Codex, but the review must leave a traceable table of edited strings, screenshots, and remaining risks.
