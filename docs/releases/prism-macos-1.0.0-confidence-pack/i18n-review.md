# Chinese / English / Japanese Release-Grade Review

> Status: Key coverage Pass; core UI screenshot review Pass

## Standard

Chinese, English, and Japanese must reach release-grade quality before macOS 1.0.0:

- No missing strings
- No obvious mistranslation
- No machine-translation tone
- Consistent terminology
- No layout-breaking long labels
- Key error, diagnostic, and export feedback must be understandable

Codex is responsible for final judgment, but the judgment must be traceable.

## Required Evidence

| Evidence | Status | Path |
|---|---|---|
| i18n key coverage check | Pass | `evidence/i18n-key-coverage.md` |
| Terminology table | Pass | This file |
| English copy review | Pass | `screenshots/i18n/en-01-main-window.png`, `screenshots/i18n/en-02-settings.png` |
| Japanese copy review | Pass | `screenshots/i18n/ja-01-main-window.png`, `screenshots/i18n/ja-02-settings.png` |
| Core UI screenshots in Chinese | Pass | `screenshots/i18n/zh-01-main-window.png`, `screenshots/i18n/zh-02-settings.png` |
| Core UI screenshots in English | Pass | `screenshots/i18n/en-01-main-window.png`, `screenshots/i18n/en-02-settings.png` |
| Core UI screenshots in Japanese | Pass | `screenshots/i18n/ja-01-main-window.png`, `screenshots/i18n/ja-02-settings.png` |
| Long-label overflow check | Pass | Settings sidebar and main settings rows reviewed in the screenshots above |
| Remaining language risks | Low | Non-core dialogs can still be polished after 1.0.0, but no release blocker was found in core UI |

## Key Coverage Result

On 2026-07-04, the release pass found 36 Japanese keys falling back to English. These were added to `src/domains/i18n/resources.ts`.

Current automated result:

| Locale | Keys | Missing | Extra |
|---|---:|---:|---:|
| zh-CN | 1106 | 0 | 0 |
| en-US | 1106 | 0 | 0 |
| ja-JP | 1106 | 0 | 0 |

Validation:

```bash
npm test -- --run src/domains/i18n/i18n.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests  3 passed (3)
```

## Terminology Table Draft

| Concept | zh-CN | en-US | ja-JP | Notes |
|---|---|---|---|---|
| Preview | 预览 | Preview | プレビュー | UI mode and rendered output |
| Edit | 编辑 | Edit | 編集 | Source editing mode |
| Split | 分栏 | Split | 分割 | Edit + preview mode |
| Export | 导出 | Export | エクスポート | HTML/PDF/PNG/DOCX |
| Diagnostics | 诊断 | Diagnostics | 診断 | ERROR panel and export diagnostics |
| Workspace | 工作区 | Workspace | ワークスペース | Local folder root |
| Markdown Document | Markdown 文档 | Markdown Document | Markdown ドキュメント | Core profile |
| Text Document | 文本文档 | Text Document | テキストドキュメント | Compatible text profile |

## Review Scope

- Nine menu groups
- Six settings sections
- Empty state / default guide
- Edit / split / preview
- ERROR diagnostics panel
- Export dialog, export success, export failure diagnostic
- About and Check for Updates
- File open, save, recovery, conflict prompts
- First-run documents

## Context Screenshot Pass

Captured after installing the rebuilt `/Applications/Prism.app`:

| Locale | Main window | Settings window | Result |
|---|---|---|---|
| zh-CN | `screenshots/i18n/zh-01-main-window.png` | `screenshots/i18n/zh-02-settings.png` | Pass |
| en-US | `screenshots/i18n/en-01-main-window.png` | `screenshots/i18n/en-02-settings.png` | Pass |
| ja-JP | `screenshots/i18n/ja-01-main-window.png` | `screenshots/i18n/ja-02-settings.png` | Pass |

Observed:

- Main window menus, sidebar labels, view-mode labels, status-bar labels, and settings labels switch correctly for all three languages.
- English settings copy is idiomatic enough for release and shows no visible overflow at `1280x860`.
- Japanese settings copy is readable at `1280x860`; sidebar wrapping is acceptable and does not clip or overlap controls.
- A Japanese wording issue was found and fixed in `src/domains/i18n/resources.ts`: `auto はシステム言語に従います` became `自動はシステム言語に従います`.

## Current Risk

The missing-key risk is closed.

The remaining risk is no longer a release blocker for macOS 1.0.0. Dialog-specific copy such as rare conflict prompts, destructive-operation prompts, and platform-specific messages should continue to be reviewed as post-1.0 polish, but the core writing/settings UI has enough real screenshot evidence to ship.
