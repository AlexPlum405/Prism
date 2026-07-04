<div align="center">

# Prism

**Turn Markdown into polished documents.**

Prism is a free, open-source Markdown editor for local writing. It keeps your files on disk, gives Markdown a refined editor and preview surface, and helps you export documents without losing the page.

<p>
  <a href="README.md">English</a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
  ·
  <a href="README.ja-JP.md">日本語</a>
</p>

<p>
  <a href="https://github.com/AlexPlum405/Prism/releases/tag/v1.0.0">
    <img src="https://img.shields.io/badge/Download-Prism%201.0.0-7A3DAD?style=for-the-badge" alt="Download Prism 1.0.0">
  </a>
  <a href="https://github.com/AlexPlum405/Prism/releases/latest">
    <img src="https://img.shields.io/github/v/release/AlexPlum405/Prism?style=for-the-badge&color=315f43" alt="Latest release">
  </a>
  <img src="https://img.shields.io/badge/macOS-Apple%20Silicon-242321?style=for-the-badge" alt="macOS Apple Silicon">
  <img src="https://img.shields.io/badge/License-MIT-1C5D33?style=for-the-badge" alt="MIT License">
</p>

<img src="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/prism-hero-writing.gif" alt="Prism split writing and preview" width="920">

<sub>
  Prism 1.0.0 for macOS Apple Silicon ·
  <a href="https://github.com/AlexPlum405/Prism/releases/download/v1.0.0/Prism_1.0.0_aarch64.dmg">Download DMG</a>
  · SHA256:
  <code>ef995e02a2a8aa1a4319d7929688c9c4f59125af6b7cc13fd8601a3f99919993</code>
</sub>

</div>

---

## Why Prism

Markdown is easy to write, but the result often still looks like a draft. Prism is built for the part after typing: the layout, the preview, the relationships between files, and the moment a document needs to leave the editor.

Prism 1.0.0 focuses on five things:

- **A document-like writing surface**: edit, split, and preview modes for notes, essays, and technical documents.
- **Themes with real personality**: MiaoYan, Inkstone, Slate, Mono, and Nocturne Dark each tune typography, tables, code, and blocks.
- **Knowledge structure**: links, backlinks, and a graph view for local Markdown workspaces.
- **Three languages**: Chinese, English, and Japanese UI are part of the product, not a post-release note.
- **Export that respects the preview**: HTML, PDF, PNG, and DOCX export with diagnostics for broken resources and render risks.

## See It

| Themes | Languages |
| --- | --- |
| <a href="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/prism-themes.mp4"><img src="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/posters/prism-themes.png" alt="Prism themes" width="460"></a> | <a href="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/prism-languages.mp4"><img src="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/posters/prism-languages.png" alt="Prism Chinese English Japanese interface" width="460"></a> |

| Knowledge graph | Diagrams and formulas |
| --- | --- |
| <a href="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/prism-knowledge-graph.mp4"><img src="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/posters/prism-knowledge-graph.png" alt="Prism knowledge graph" width="460"></a> | <a href="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/prism-diagrams-formulas.mp4"><img src="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/posters/prism-diagrams-formulas.png" alt="Prism diagrams and formulas" width="460"></a> |

| Export | Local files |
| --- | --- |
| <a href="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/prism-export.mp4"><img src="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/posters/prism-export.png" alt="Prism export" width="460"></a> | <img src="docs/releases/prism-macos-1.0.0-confidence-pack/promo-page/assets/prism-local-file.gif" alt="Open local Markdown files with Prism" width="460"> |

## Download

| Platform | Status | Download |
| --- | --- | --- |
| macOS Apple Silicon | Released | [Prism_1.0.0_aarch64.dmg](https://github.com/AlexPlum405/Prism/releases/download/v1.0.0/Prism_1.0.0_aarch64.dmg) |
| Windows | Staged | Real-device validation pending |
| Linux | Staged | Real-device validation pending |

Prism 1.0.0 is the first official public release. It is currently published for macOS Apple Silicon first. Windows and Linux builds will be released after real-device validation.

## Features

### Writing

- Local Markdown and text document editing
- Edit, split, and preview modes
- Auto-save and dirty-state tracking
- Search, replace, selection, and keyboard-driven editing
- Sidebar file tree, outline, context menus, and status bar

### Preview

- GitHub Flavored Markdown
- Code highlighting
- Tables, task lists, blockquotes, links, marks, and horizontal rules
- KaTeX math
- Mermaid diagrams
- PlantUML diagrams
- Markmap mind maps

### Knowledge

- Wiki-style links
- Current links and backlinks
- Document properties
- Relation graph for local Markdown workspaces

### Export

- HTML
- PDF
- PNG
- Word `.docx`
- Export diagnostics for missing images, broken links, render failures, and export risks

## Themes

Prism themes are not simple color filters. Each theme owns its own font, background, code, table, blockquote, and preview treatment.

- **MiaoYan**: polished long-form writing
- **Inkstone**: paper-and-ink editorial tone
- **Slate**: structured technical documents
- **Mono**: black-and-white notes and drafts
- **Nocturne Dark**: a true dark writing surface

## Known Limits

- Auto-updater delivery is not included in 1.0.0 because the updater signing private key was not available for this release.
- Windows and Linux are not official 1.0.0 platforms yet.
- Full offline network-blocked rendering proof, HiDPI matrix validation, and long-running memory pressure runs remain post-1.0 hardening work.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 |
| Frontend | React 18 + TypeScript |
| Editor | CodeMirror 6 |
| State | Zustand |
| Build | Vite |
| Markdown | unified, remark, rehype |
| Math | KaTeX |
| Diagrams | Mermaid, PlantUML, Markmap |
| Export | docx, pdf-lib, html2canvas |
| Tests | Vitest + Testing Library |

## Development

### Prerequisites

- Node.js 18+
- Rust 1.77+
- Tauri 2 prerequisites for your platform

### Run Locally

```bash
git clone https://github.com/AlexPlum405/Prism.git
cd Prism
npm install
npm run tauri:dev
```

### Build

```bash
npm run build
npm run tauri:build
```

Artifacts are written to:

```text
src-tauri/target/release/bundle/
```

### Test

```bash
npm test
npm run build
```

## Contributing

Issues and pull requests are welcome. For visual bugs, include:

- OS and app version
- View mode: edit, split, or preview
- Current theme
- A screenshot or minimal Markdown sample

## License

[MIT](LICENSE)
