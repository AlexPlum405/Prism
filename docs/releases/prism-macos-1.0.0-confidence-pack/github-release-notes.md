## Prism 1.0.0 for macOS

Prism 1.0.0 is the first official macOS release.

Prism is a free, open-source Markdown editor for local writing. It keeps files on disk, gives Markdown a refined editor and preview surface, and helps writers carry the same document quality into export.

Highlights:

- Local Markdown and text document editing
- Edit, split, and preview writing modes
- Themes tuned for typography, code, tables, quotes, and preview
- Rich preview for Mermaid, PlantUML, Markmap, KaTeX, tables, images, and long documents
- Export to HTML, PDF, PNG, and DOCX
- Diagnostics for broken links, missing images, render failures, and export risks
- First-run Prism documents with examples and guides
- Finder document icons for Markdown and selected text/source documents
- Chinese, English, and Japanese UI, with README coverage in all three languages
- Open-source and free

Install:

1. Download `Prism_1.0.0_aarch64.dmg`.
2. Open the DMG.
3. Drag Prism to Applications.

Checksum:

```text
sha256:d28d0a545fb98c92327867a64b1fe824c799bf9d079e95a10af018bfb96e5b04
```

## Known Limitations

- macOS is the first official release platform. Windows and Linux builds are staged until real-device validation is complete.
- Auto-updater delivery is not included in this release because `TAURI_SIGNING_PRIVATE_KEY` was unavailable during the final RC build.
- Full offline network-blocked rendering proof, high-DPI matrix validation, and long-running memory pressure tests remain post-1.0 hardening items.

## Verification Summary

- Full-feature manifest: 168 total / 156 pass / 0 fail / 12 blocked
- P0: 88 pass / 0 fail / 0 blocked
- P1: 56 pass / 0 fail / 0 blocked
- Final installed-app smoke: Pass
- Public DMG download smoke: Pass
- Release asset digest verified: `sha256:d28d0a545fb98c92327867a64b1fe824c799bf9d079e95a10af018bfb96e5b04`
