# Finder Icon Verification

> Status: Pass with real Finder screenshots

## Requirement

Markdown and supported text documents must show Prism document icons in real Finder views before macOS 1.0.0.

## Current Configuration Evidence

Observed `/Applications/Prism.app/Contents/Info.plist` includes:

- Bundle ID: `com.prism.editor.v1`
- App icon: `icon.icns`
- Markdown document icon: `PrismMarkdownSignatureDocument`
- Text document icon: `PrismTextDocument`
- Markdown UTIs include `com.prism.editor.markdown`, `net.daringfireball.markdown`, `public.markdown`, `net.ia.markdown`, `com.unknown.md`
- Text document type includes `.txt`, `.text`, `.sql`, `.json`, `.jsonc`, `.yaml`, `.yml`, `.toml`, `.xml`, `.csv`, `.tsv`, `.log`, `.ini`, `.conf`, `.env`

Current asset paths:

- `src-tauri/icons/document-markdown.icns`
- `src-tauri/icons/document-markdown.png`
- `src-tauri/icons/document-text.icns`
- `src-tauri/icons/document-text.png`
- `src-tauri/icons/icon.icns`

Detailed command output: `evidence/app-identity-and-document-icons.md`

## Real Finder Evidence

| Case | Status | Screenshot |
|---|---|---|
| `.md` list view | Pass | `screenshots/finder-icons/01-finder-list-view.png` |
| `.md` small icon view | Pass | `screenshots/finder-icons/02-finder-small-icon-view.png` |
| `.md` large icon view | Pass | `screenshots/finder-icons/03-finder-large-icon-view.png` |
| `.markdown` list view | Pass | `screenshots/finder-icons/01-finder-list-view.png` |
| `.markdown` large icon view | Pass | `screenshots/finder-icons/03-finder-large-icon-view.png` |
| `.txt` text document icon | Pass | `screenshots/finder-icons/03-finder-large-icon-view.png` |
| `.sql` text document icon | Pass | `screenshots/finder-icons/03-finder-large-icon-view.png` |
| `.json` text document icon | Pass | `screenshots/finder-icons/03-finder-large-icon-view.png` |

Detailed screenshot notes: `evidence/finder-icon-real-screenshots.md`

## Pass Criteria

- No blank icons
- No checkerboard artifacts
- No canvas residue
- No clipped edges
- Icon remains recognizable at small sizes
- Markdown and text document icons are visually related but distinguishable
- Icon style is simpler and more elegant than the previous temporary icon

## Current Judgment

Finder icon verification is strong enough to prove Markdown and supported text/source document icon replacement is working in real Finder views after LaunchServices refresh.

`mdls` still reports `.json` as kind `JSON Document`, which is acceptable: the release claim is about Finder document icon rendering after Prism is registered as handler, not renaming Apple's system UTI kind.
