# Release Screenshots And Motion Plan

> Status: still screenshots accepted for 1.0.0; motion assets deferred

Release screenshots must be recaptured from the current app. Full-feature test screenshots can inform angles but should not be reused directly.

## Capture Rules

- Use current macOS app with the latest Dock and document icons.
- Use a dedicated release fixture, not test fixture paths.
- Use consistent window size and theme.
- Avoid debug overlays, error states unless the shot is about diagnostics, temporary folders, and test names.
- Save still screenshots under `screenshots/`.
- Save source sequences for GIF/video under `promo-page/assets/`.

## Shot List

| ID | Filename | Purpose | Status |
|---|---|---|---|
| 01 | `01-local-markdown-writing.png` | Calm local Markdown writing surface | Captured |
| 02 | `02-split-preview-longform.png` | Split editing and polished long-form preview | Captured |
| 03 | `03-diagrams-formulas-preview.png` | Mermaid / PlantUML / Markmap / KaTeX preview | Captured |
| 04 | `04-export-diagnostics.png`, `04-export-diagnostics-panel.png` | Export risk and diagnostics panel | Captured |
| 05 | `05-export-success-actions.png` | Export success with open/reveal actions | Pending |
| 06 | `06-workspace-search-links.png` | Workspace search, links, backlinks, graph | Pending |
| 07 | `i18n/zh-01-main-window.png`, `i18n/zh-02-settings.png`, `i18n/en-01-main-window.png`, `i18n/en-02-settings.png`, `i18n/ja-01-main-window.png`, `i18n/ja-02-settings.png` | Chinese / English / Japanese UI evidence | Captured |
| 08 | `finder-icons/01-finder-list-view.png`, `finder-icons/02-finder-small-icon-view.png`, `finder-icons/03-finder-large-icon-view.png` | Finder Markdown/Text document icon proof | Captured; Pass for `.md`, `.markdown`, `.txt`, `.json`, and `.sql` |
| 09 | `09-themes-preview.png` | Release theme quality | Pending |
| 10 | `10-first-run-documents.png` | First-run Prism documents and guide | Captured; Pass after clean cold start with `lastSession` cleared |

## Captured Still Evidence

The current package contains enough still screenshots for a macOS release review: writing surface, split preview, diagrams/formulas, diagnostics, Finder icons, three-language UI, and first-run documents are all captured from the installed app or current release build.

The remaining screenshot gaps are promotional rather than P0 release blockers: export success actions, workspace search/link graph, and theme comparison can still improve the landing page and motion package.

## Motion Assets

| Asset | Purpose | Status |
|---|---|---|
| `hero-writing-preview.mp4` | Hero animation: write Markdown, preview updates | Pending |
| `diagram-export-flow.mp4` | Diagram preview to export | Pending |
| `diagnostics-fix-loop.mp4` | Error diagnostic to source fix | Pending |
| `finder-open-file.mp4` | Finder document icon to Prism open | Pending |

## Promotion Page Usage

The promotional page prototype now references accepted still screenshots directly. Motion assets are deferred from the 1.0.0 release bar and should be generated after the first macOS release if the launch page needs video/GIF.
