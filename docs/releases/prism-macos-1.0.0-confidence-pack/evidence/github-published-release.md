# GitHub Published Release Evidence

> Captured: 2026-07-04 11:26 CST
> Scope: macOS 1.0.0 public GitHub Release

## Publish Command

The `v1.0.0` Draft Release was published after explicit human approval.

```bash
gh release edit v1.0.0 --draft=false
```

GitHub returned the public Release URL:

```text
https://github.com/AlexPlum405/Prism/releases/tag/v1.0.0
```

## Published Release Metadata

`gh release view v1.0.0 --json tagName,name,isDraft,isPrerelease,url,assets,targetCommitish,createdAt,publishedAt` reported:

```text
name=Prism 1.0.0 for macOS
tagName=v1.0.0
isDraft=false
isPrerelease=false
publishedAt=2026-07-04T03:26:28Z
targetCommitish=2f89d3c001dc77785514c2a2b3515a4a0dbd7351
url=https://github.com/AlexPlum405/Prism/releases/tag/v1.0.0
```

`gh release list --limit 100` reported:

```text
Prism 1.0.0 for macOS    Latest    v1.0.0    2026-07-04T03:26:28Z
```

## Asset

Uploaded asset after publication:

```text
name=Prism_1.0.0_aarch64.dmg
size=30751755
contentType=application/x-apple-diskimage
state=uploaded
downloadCount=1
digest=sha256:ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993
url=https://github.com/AlexPlum405/Prism/releases/download/v1.0.0/Prism_1.0.0_aarch64.dmg
```

Local upload copy checksum:

```text
ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993  /Users/Alex/Downloads/Prism_1.0.0_aarch64.dmg
```

The GitHub asset digest matches the local DMG SHA256.

## Status

Prism 1.0.0 is now the public `Latest` GitHub Release for macOS.

## Post-Publication Copy Sync

Captured: 2026-07-04 22:23 CST

The public Release body was updated after README and promo-page copy were finalized, so the GitHub page no longer carries the older launch wording.

Source file:

```text
docs/releases/prism-macos-1.0.0-confidence-pack/github-release-notes.md
```

Command:

```bash
gh release edit v1.0.0 --repo AlexPlum405/Prism --notes-file docs/releases/prism-macos-1.0.0-confidence-pack/github-release-notes.md
```

Verification command:

```bash
gh release view v1.0.0 --repo AlexPlum405/Prism --json body,isDraft,isPrerelease,assets,publishedAt,targetCommitish,url
```

Verified public body excerpt:

```text
Prism is a free, open-source Markdown editor for local writing. It keeps files on disk, gives Markdown a refined editor and preview surface, and helps writers carry the same document quality into export.
```
