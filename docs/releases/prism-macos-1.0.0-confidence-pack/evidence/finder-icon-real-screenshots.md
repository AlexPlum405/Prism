# Finder Icon Real Screenshot Evidence

> Captured: 2026-07-04 03:14 CST
> Fixture folder: `docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/`

## Fixture Files

- `prism-guide.md`
- `release-notes.markdown`
- `plain-note.txt`
- `data.json`
- `query.sql`

## Screenshot Files

| View | Screenshot | Result |
|---|---|---|
| List view | `screenshots/finder-icons/01-finder-list-view.png` | `.md`, `.markdown`, `.txt`, `.json`, and `.sql` all show Prism-style document icons. |
| Small icon view | `screenshots/finder-icons/02-finder-small-icon-view.png` | `.md`, `.markdown`, `.txt`, `.json`, and `.sql` all show Prism-style document icons after LaunchServices refresh. |
| Large icon view | `screenshots/finder-icons/03-finder-large-icon-view.png` | `.md`, `.markdown`, `.txt`, `.json`, and `.sql` are visible, unclipped, non-blank, and free of checkerboard residue. |

## Commands Used

```bash
mkdir -p docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures
touch docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/prism-guide.md
touch docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/release-notes.markdown
touch docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/plain-note.txt
touch docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/data.json
touch docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/query.sql
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/Prism.app
qlmanage -r cache
killall Finder
screencapture -x -l <Finder window id> screenshots/finder-icons/01-finder-list-view.png
screencapture -x -l <Finder window id> screenshots/finder-icons/02-finder-small-icon-view.png
screencapture -x -l <Finder window id> screenshots/finder-icons/03-finder-large-icon-view.png
```

## Supporting Metadata

```bash
mdls -name kMDItemContentType -name kMDItemContentTypeTree -name kMDItemKind \
  docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/prism-guide.md \
  docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/release-notes.markdown \
  docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/query.sql \
  docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/plain-note.txt \
  docs/releases/prism-macos-1.0.0-confidence-pack/evidence/finder-icon-fixtures/data.json
```

Observed:

- `.md` and `.markdown`: `kMDItemContentType = "net.daringfireball.markdown"`, kind `Markdown Document`.
- `.sql`: kind `Prism Text Document`.
- `.txt`: kind `纯文本文稿`.
- `.json`: kind `JSON Document`.

## Release Interpretation

Current result: **Pass**.

Pass:

- Markdown documents are not blank in real Finder views.
- `.md` and `.markdown` use the Prism-style document icon at large size.
- `.txt`, `.sql`, and `.json` also display the Prism-style document icon in large Finder icon view.
- The rendered document icon is not clipped and does not show checkerboard residue.

Notes:

- `.json` still reports kind `JSON Document` through Spotlight metadata, but Finder renders the Prism document icon after Prism is registered as handler.
- The current Markdown/Text document icons are visually aligned by design. The release claim does not require separate artwork per text-like extension.
