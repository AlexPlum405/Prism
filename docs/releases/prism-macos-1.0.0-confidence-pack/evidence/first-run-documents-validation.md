# First-Run Documents Validation

> Captured: 2026-07-04 05:10 CST
> Scope: installed macOS app at `/Applications/Prism.app`

## Result

Pass for the current authorized macOS profile.

Prism cold-started into the bundled Prism workspace and opened:

```text
/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md
```

Screenshot evidence:

```text
docs/releases/prism-macos-1.0.0-confidence-pack/screenshots/10-first-run-documents.png
```

## Verification Steps

1. Quit Prism.
2. Clear `lastSession` in the test config so the run does not rely on previous-session restore.
3. Launch `/Applications/Prism.app`.
4. Wait for bootstrap.
5. Capture the Prism main window with `screencapture -l`.
6. Inspect the written config.

Observed config after launch:

```json
{
  "filePath": "/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md",
  "folderPath": "/Users/Alex/Documents/Prism",
  "viewMode": "edit",
  "scrollState": {
    "editorRatio": 0,
    "previewRatio": 0
  },
  "sidebarVisible": true,
  "sidebarTab": "files"
}
```

## macOS Documents Authorization Note

During the first run on this machine, macOS showed the real system prompt:

```text
"Prism" wants to access files in the Documents folder.
```

After choosing Allow, Prism continued into the default workspace and guide document. The post-authorization cold start was then captured as `10-first-run-documents.png`.

This verifies the user-visible recovery path, but it does not fully close the broader manifest item `PRISM-FF-148` because that item still needs a repeatable permission-reset script or a clean macOS profile run before it can be marked Pass in the full functional manifest.
