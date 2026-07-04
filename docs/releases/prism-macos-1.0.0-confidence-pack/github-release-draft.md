# GitHub Release

> Target tag: `v1.0.0`
> Target platform: macOS Apple Silicon
> Release decision: Go for manual DMG
> Public status: Published

## Title

Prism 1.0.0 for macOS

## Asset

Preferred DMG:

```text
src-tauri/target/release/bundle/macos/Prism_1.0.0_aarch64.dmg
```

Preserved upload copy after workspace cleanup:

```text
/Users/Alex/Downloads/Prism_1.0.0_aarch64.dmg
```

SHA256:

```text
ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993
```

If the public DMG asset needs to be replaced later and generated artifacts have been cleaned, rebuild and re-check the checksum first:

```bash
npm run tauri:build
npm run release:mac-dmg:skip-finder
shasum -a 256 src-tauri/target/release/bundle/macos/Prism_1.0.0_aarch64.dmg
```

## Release Notes

Public release notes are maintained in `github-release-notes.md` and are used as the source for `gh release edit --notes-file`.

## Known Limitations

- macOS is the first official release platform. Windows and Linux builds are staged until real-device validation is complete.
- Auto-updater delivery is not included in this release evidence because `TAURI_SIGNING_PRIVATE_KEY` was unavailable during the final RC build.
- Full offline network-blocked rendering proof, high-DPI matrix validation, and long-running memory pressure tests remain post-1.0 hardening items.

## Verification Summary

- Full-feature manifest: 168 total / 156 pass / 0 fail / 12 blocked
- P0: 88 pass / 0 fail / 0 blocked
- P1: 56 pass / 0 fail / 0 blocked
- Final installed-app smoke: Pass
- Preferred RC DMG SHA256: `ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993`

## Published Release

The GitHub Release has been published:

```text
tag=v1.0.0
title=Prism 1.0.0 for macOS
asset=Prism_1.0.0_aarch64.dmg
target=2f89d3c001dc77785514c2a2b3515a4a0dbd7351
isDraft=false
isPrerelease=false
publishedAt=2026-07-04T03:26:28Z
url=https://github.com/AlexPlum405/Prism/releases/tag/v1.0.0
```

Evidence:

```text
docs/releases/prism-macos-1.0.0-confidence-pack/evidence/github-draft-release.md
docs/releases/prism-macos-1.0.0-confidence-pack/evidence/github-published-release.md
```

Review the public page:

```bash
gh release view v1.0.0 --web
```
