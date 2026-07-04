# GitHub Draft Release Evidence

> Captured: 2026-07-04 11:15 CST
> Scope: GitHub Releases cleanup and macOS 1.0.0 draft release

## Cleanup

The previous GitHub Release entries were removed so that Prism 1.0.0 can be the first stable GitHub Release.

Deleted releases and their associated release tags:

```text
v1.4.1
v1.0.5
v1.4.0
v1.0.3
v1.2.0
v1.1.0
v1.0.0
```

Command pattern:

```bash
gh release delete <tag> --cleanup-tag --yes
```

After cleanup, `gh release list --limit 100` returned no releases.

Remaining remote tags that were not GitHub Releases:

```text
v1.0.2
v0.1.1
```

These were not deleted because the requested cleanup scope was GitHub Releases. They can be removed separately if the GitHub Tags page also needs to be reset.

## New Draft Release

Command summary:

```bash
gh release create v1.0.0 \
  /Users/Alex/Downloads/Prism_1.0.0_aarch64.dmg \
  --title "Prism 1.0.0 for macOS" \
  --notes "<public release notes extracted from github-release-draft.md>" \
  --target "2f89d3c001dc77785514c2a2b3515a4a0dbd7351" \
  --draft
```

Current GitHub Release list:

```text
Prism 1.0.0 for macOS    Draft    v1.0.0    2026-07-04T03:14:55Z
```

Draft release API evidence:

```text
name=Prism 1.0.0 for macOS
tagName=v1.0.0
isDraft=true
isPrerelease=false
publishedAt=null
targetCommitish=2f89d3c001dc77785514c2a2b3515a4a0dbd7351
url=https://github.com/AlexPlum405/Prism/releases/tag/untagged-79ca82395b7849bc4069
```

GitHub uses an `untagged-...` URL for this draft release before publication; the release metadata still reports `tagName=v1.0.0`.

## Asset

Uploaded asset:

```text
name=Prism_1.0.0_aarch64.dmg
size=30751755
contentType=application/x-apple-diskimage
state=uploaded
downloadCount=0
digest=sha256:ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993
```

Local upload copy:

```text
/Users/Alex/Downloads/Prism_1.0.0_aarch64.dmg
sha256=ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993
size=29M
```

## Publish Status At Capture Time

At the time this draft evidence was captured, the GitHub Release was still a draft and had not been publicly published.

It was later published after explicit human approval. See:

```text
docs/releases/prism-macos-1.0.0-confidence-pack/evidence/github-published-release.md
```
