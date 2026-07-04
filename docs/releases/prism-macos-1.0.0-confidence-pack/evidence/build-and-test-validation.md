# Build And Test Validation

> Captured: 2026-07-04 03:13 CST
> Supplemental validation: 2026-07-04 05:16 CST
> Final RC validation: 2026-07-04 10:35 CST

## Final RC Build And Installed-App Smoke

Evidence file:

- `evidence/final-rc-build-and-smoke.md`

Build commands:

```bash
npm run tauri:build
npm run release:mac-dmg:skip-finder
```

Result:

- Frontend build passed.
- Rust release build passed.
- `.app`, `.app.tar.gz`, and DMG artifacts were generated.
- `npm run tauri:build` exited nonzero only at updater signing because `TAURI_SIGNING_PRIVATE_KEY` was not set.
- The patched local RC DMG was generated at `src-tauri/target/release/bundle/macos/Prism_1.0.0_aarch64.dmg`.

Preferred local RC DMG:

```text
sha256=ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993
```

Installed-app smoke command:

```bash
PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs
```

Result:

```text
Pass: startup, file opening, diagnostics, quick open, edit/save, export menu, settings, and HTML/PDF/PNG/DOCX complex export smoke.
```

Release interpretation:

- macOS 1.0.0 is acceptable as a manual DMG release candidate.
- Auto-updater signing remains outside this RC because the signing private key was unavailable.
- Raw build and smoke directories are generated artifacts and can be deleted after this evidence summary is recorded.

## Targeted Tests

Command:

```bash
npm test -- --run src/domains/settings/pathPersistence.test.ts src/app/useStartupFileOpen.test.tsx src/app/useAppFileActionsModel.test.tsx src/hooks/useBootstrap.test.tsx src/components/shell/AppErrorBoundary.test.tsx src/domains/editor/runtime/editorScrollRuntime.test.ts src/domains/i18n/i18n.test.ts
```

Result:

```text
Test Files  7 passed (7)
Tests  36 passed (36)
```

Notes:

- `AppErrorBoundary.test.tsx` intentionally renders a component that throws. React/jsdom prints the injected error stack during the test, but the test result is Pass.

## Rust Startup File Tests

Command:

```bash
cargo test startup_files
```

Result:

```text
2 passed; 0 failed
```

Release interpretation:

- Startup-file filtering accepts supported Markdown/text file extensions without an existence preflight, which prevents macOS protected-directory permission checks from dropping valid startup files before the frontend can request access.

## Build

Command:

```bash
npm run build
```

Result:

```text
tsc && vite build
✓ 2845 modules transformed.
✓ built in 8.34s
```

Warnings:

```text
Module "node:module" has been externalized for browser compatibility,
imported by "@kookyleo/graphviz-anywhere-web/dist/viz.js".

Some chunks are larger than 500 kB after minification.
```

Release interpretation:

- Build gate is currently Pass.
- The warnings are not new release blockers, but chunk size and browser externalization should remain visible as post-1.0 hardening items.

## macOS App Smoke

Command:

```bash
npm run tauri:build:app-smoke
```

Result:

```text
[app-smoke] pass launch opens .markdown fixture with Chinese space path
[app-smoke] pass launch opens JSON fixture without blank screen
[app-smoke] pass launch opens SQL fixture without blank screen
[app-smoke] pass launch opens TXT fixture without blank screen
[app-smoke] pass launch opens markdown fixture
[app-smoke] pass ERROR diagnostic opens from status bar
[app-smoke] pass Cmd+Shift+P opens workspace target file
[app-smoke] pass basic edit and Cmd+S save writes fixture file
[app-smoke] pass export menu opens from status bar
[app-smoke] pass settings center opens with Cmd+,
[app-smoke] pass complex export artifacts generated and validated: HTML/PDF/PNG/DOCX
[app-smoke] pass wrote app smoke evidence report
```

Evidence file:

- `.codex-smoke/app-smoke/evidence/report.json`

Release interpretation:

- The rebuilt macOS `.app` passes real startup, file-opening, editing, saving, export-entry, settings-entry, and export-artifact smoke.

## First-Run Documents

Evidence file:

- `evidence/first-run-documents-validation.md`

Screenshot:

- `screenshots/10-first-run-documents.png`

Release interpretation:

- After the macOS Documents authorization prompt was allowed once, a cold start with `lastSession` cleared opened `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md` inside `/Users/Alex/Documents/Prism`.
- This supports the first-run documents experience for the current authorized macOS profile.
- The broader sandbox authorization manifest item remains documented because a repeatable TCC reset / clean-profile automation is still separate from this release-pack evidence.
