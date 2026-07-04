# Post-Release Download Smoke

> Captured: 2026-07-04 22:02 CST
> Scope: Public GitHub Release asset for Prism 1.0.0

## Release

```text
url=https://github.com/AlexPlum405/Prism/releases/tag/v1.0.0
asset=Prism_1.0.0_aarch64.dmg
```

## Commands

```bash
rm -rf /tmp/prism-post-release-smoke
mkdir -p /tmp/prism-post-release-smoke
cd /tmp/prism-post-release-smoke
gh release download v1.0.0 --repo AlexPlum405/Prism --pattern 'Prism_1.0.0_aarch64.dmg'
shasum -a 256 Prism_1.0.0_aarch64.dmg
mkdir -p /tmp/prism-post-release-smoke/mount
hdiutil attach -nobrowse -readonly -mountpoint /tmp/prism-post-release-smoke/mount Prism_1.0.0_aarch64.dmg
find /tmp/prism-post-release-smoke/mount -maxdepth 2 -print
plutil -p /tmp/prism-post-release-smoke/mount/Prism.app/Contents/Info.plist | rg 'CFBundleIdentifier|CFBundleName|CFBundleShortVersionString|CFBundleVersion'
hdiutil detach /tmp/prism-post-release-smoke/mount
```

## Result

Downloaded DMG checksum:

```text
ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993  Prism_1.0.0_aarch64.dmg
```

Mounted DMG contents:

```text
/tmp/prism-post-release-smoke/mount
/tmp/prism-post-release-smoke/mount/.VolumeIcon.icns
/tmp/prism-post-release-smoke/mount/Applications
/tmp/prism-post-release-smoke/mount/Prism.app
/tmp/prism-post-release-smoke/mount/Prism.app/Contents
```

Bundled app identity:

```text
CFBundleIdentifier=com.prism.editor.v1
CFBundleName=Prism
CFBundleShortVersionString=1.0.0
CFBundleVersion=1.0.0
```

Interpretation:

- The public GitHub Release DMG downloads successfully.
- Its SHA256 matches the published checksum.
- The DMG mounts read-only.
- The bundled app reports the expected Prism identity and `1.0.0` version.
- This smoke did not overwrite `/Applications/Prism.app`; the installed-app smoke remains covered by `final-rc-build-and-smoke.md`.
