# Release Screenshots And Motion Plan

> Status: still screenshots accepted; 1.0.0 motion assets generated

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
| 01 | `01-local-markdown-writing.png` | Local Markdown writing surface | Captured |
| 02 | `02-split-preview-longform.png` | Split editing and polished long-form preview | Captured |
| 03 | `03-diagrams-formulas-preview.png` | Mermaid / PlantUML / Markmap / KaTeX preview | Captured |
| 04 | `04-export-diagnostics.png`, `04-export-diagnostics-panel.png` | Export risk and diagnostics panel | Captured |
| 05 | `promo-page/assets/prism-export.mp4` | Export flow and diagnostics | Generated motion asset |
| 06 | `promo-page/assets/prism-knowledge-graph.mp4` | Links, backlinks, and graph | Generated motion asset |
| 07 | `i18n/zh-01-main-window.png`, `i18n/zh-02-settings.png`, `i18n/en-01-main-window.png`, `i18n/en-02-settings.png`, `i18n/ja-01-main-window.png`, `i18n/ja-02-settings.png` | Chinese / English / Japanese UI evidence | Captured |
| 08 | `finder-icons/01-finder-list-view.png`, `finder-icons/02-finder-small-icon-view.png`, `finder-icons/03-finder-large-icon-view.png` | Finder Markdown/Text document icon proof | Captured; Pass for `.md`, `.markdown`, `.txt`, `.json`, and `.sql` |
| 09 | `promo-page/assets/prism-themes.mp4` | Release theme quality | Generated motion asset |
| 10 | `10-first-run-documents.png` | First-run Prism documents and guide | Captured; Pass after clean cold start with `lastSession` cleared |

## Captured Still Evidence

The current package contains enough still screenshots for a macOS release review: writing surface, split preview, diagrams/formulas, diagnostics, Finder icons, three-language UI, and first-run documents are all captured from the installed app or current release build.

Additional promotional motion assets are generated under `promo-page/assets/` from real Prism screenshots. The demo workspace under `promo-page/demo-workspace/` is reserved for future real-app reshoots.

## Motion Assets

| Asset | Purpose | Status |
|---|---|---|
| `promo-page/assets/prism-hero-writing.mp4` / `.gif` | Hero animation: split writing and preview | Generated |
| `promo-page/assets/prism-themes.mp4` | Theme switching and theme quality | Generated |
| `promo-page/assets/prism-languages.mp4` | Chinese / English / Japanese UI | Generated |
| `promo-page/assets/prism-knowledge-graph.mp4` | Links, backlinks, and relation graph | Generated |
| `promo-page/assets/prism-diagrams-formulas.mp4` | Mermaid / PlantUML / Markmap / KaTeX | Generated |
| `promo-page/assets/prism-export.mp4` | Export and diagnostics | Generated |
| `promo-page/assets/prism-local-file.gif` | Finder document icon and local file flow | Generated |

## Promotion Page Usage

The promotional page prototype now references the generated MP4/GIF assets directly. Root README files use the hero GIF plus poster links to MP4 files so GitHub rendering stays stable.
