# Final RC Build And Installed-App Smoke

> Captured: 2026-07-04 10:35 CST
> Scope: macOS 1.0.0 local DMG release candidate

## Build Window

```text
build_start_utc=2026-07-04T02:23:24Z
build_end_utc=2026-07-04T02:35:13Z
```

## Commands

```bash
npm run tauri:build
npm run release:mac-dmg:skip-finder
```

`npm run tauri:build` completed the frontend build, Rust release build, `.app`, `.app.tar.gz`, and DMG artifact generation. The command exited nonzero only at the updater signing step because `TAURI_SIGNING_PRIVATE_KEY` was not set.

`npm run release:mac-dmg:skip-finder` then patched the macOS document icons into the bundled app and regenerated the local DMG without running Finder verification.

## Artifacts

Preferred local RC artifact:

```text
src-tauri/target/release/bundle/macos/Prism_1.0.0_aarch64.dmg
size=29M
sha256=ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993
```

Supplemental artifacts:

```text
src-tauri/target/release/bundle/macos/Prism.app.tar.gz
size=27M
sha256=bdb44e0717f7cffd8519af2b0537892241cc549eda32156646940f4fef1a3368

src-tauri/target/release/bundle/dmg/Prism_1.0.0_aarch64.dmg
size=29M
sha256=42644e5ca1f86b7ef6a96c69499726619e0866fc5e842d689ae8d6d557005db9
```

Release interpretation:

- Use `src-tauri/target/release/bundle/macos/Prism_1.0.0_aarch64.dmg` for the macOS 1.0.0 draft release because it is built from the document-icon-patched `.app`.
- The generated artifacts were local build outputs and were cleaned after this summary was written. Rebuild with the commands above if the binary asset needs to be regenerated.
- Auto-updater signing is not included in this evidence because the signing private key was unavailable.

## Installed App

The RC `.app` was copied to `/Applications/Prism.app`, quarantine metadata was removed, document icons were patched again, and Markdown/text default handlers were registered.

Installed app identity:

```text
CFBundleIdentifier=com.prism.editor.v1
CFBundleName=Prism
CFBundleShortVersionString=1.0.0
CFBundleVersion=1.0.0
```

Document icon resources:

```text
/Applications/Prism.app/Contents/Resources/PrismMarkdownSignatureDocument.icns
/Applications/Prism.app/Contents/Resources/PrismTextDocument.icns
```

## Final Installed-App Smoke

Command:

```bash
PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs
```

Result: Pass.

Covered smoke checks:

- `.markdown` file startup with Chinese-space path
- JSON startup
- SQL startup
- TXT startup
- Markdown startup
- ERROR diagnostic opens from status bar
- `Cmd+Shift+P` opens workspace target file
- Basic edit plus `Cmd+S` writes fixture file
- Export menu opens
- Settings center opens
- Complex export artifacts generated and validated for HTML, PDF, PNG, and DOCX

Smoke evidence report:

```text
.codex-smoke/app-smoke/evidence/report.json
generatedAt=2026-07-04T02:34:00.207Z
appPath=/Applications/Prism.app
configRestoredAfterRun=true
```

The raw `.codex-smoke` directory is a local generated artifact and is not retained in the repository after cleanup.

## Release Decision Impact

This closes the macOS 1.0.0 installed-app confidence gap for a manual DMG release.

The remaining release caveats are explicit and non-hidden:

- Windows and Linux are staged until real-device validation.
- Auto-updater signing is not part of this RC evidence without `TAURI_SIGNING_PRIVATE_KEY`.
- Motion assets for the promotional page can be deferred; they are not required to prove the app binary.
