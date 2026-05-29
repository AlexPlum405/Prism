<div align="center">

# Prism

**A quiet, native-feeling Markdown editor for writers who care about typography.**

<p>
  <a href="README.md">English</a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p>
  <a href="https://github.com/AlexPlum405/Prism/releases/latest">
    <img src="https://img.shields.io/github/v/release/AlexPlum405/Prism?style=flat-square&color=315f43" alt="Latest release">
  </a>
  <img src="https://img.shields.io/github/downloads/AlexPlum405/Prism/total?style=flat-square&color=315f43" alt="Downloads">
  <img src="https://img.shields.io/github/stars/AlexPlum405/Prism?style=flat-square&color=315f43" alt="Stars">
  <img src="https://img.shields.io/badge/Tauri-2.x-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=111" alt="React">
  <img src="https://img.shields.io/badge/CodeMirror-6-1f2937?style=flat-square" alt="CodeMirror 6">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
</p>

<p>
  <a href="#download">Download</a>
  ·
  <a href="#why-prism">Why Prism</a>
  ·
  <a href="#screenshots">Screenshots</a>
  ·
  <a href="#development">Development</a>
</p>

<a href="docs/prism-promo-video/prism-promo-showcase-final.mp4">
  <img src="docs/prism-promo-video/prism-promo-showcase-poster.png" alt="Prism product video poster" width="920">
</a>

<sub>Click the poster to open the 36-second MP4 product video with sound.</sub>

</div>

---

## Why Prism

Most Markdown editors can render Markdown. Prism focuses on how writing feels.

Prism is a desktop Markdown editor built with Tauri, React, TypeScript, and CodeMirror 6. It is designed for calm long-form writing, polished preview typography, Chinese and mixed-language documents, and export workflows that preserve the visual quality of the page.

It is currently best suited for:

- Long-form Chinese writing
- Technical notes and product documents
- README and documentation drafts
- Markdown documents with code, tables, diagrams, and formulas
- Exporting themed documents to HTML, PDF, Word, or PNG

## Highlights

| What you get | Why it matters |
| --- | --- |
| Edit / Split / Preview modes | Switch between focused writing, live comparison, and clean reading. |
| Chinese-first typography | Comfortable spacing, centered preview, and themes tuned for mixed Chinese and technical content. |
| CodeMirror 6 editor core | Reliable editing, selection, search, replace, and keyboard-driven workflows. |
| Markdown power features | GFM, syntax highlighting, Mermaid, KaTeX, tables, task lists, blockquotes, and more. |
| Five content themes | MiaoYan, Inkstone, Slate, Mono, and Nocturne Dark, each with its own visual tokens. |
| Product-grade export | Export HTML, PDF, Word (`.docx`), and PNG with themed rendering and Prism-native save dialogs. |
| Desktop workspace | Sidebar, file tree, outline, context menu, status bar, and auto-save. |

## Download

Current source version: **v1.4.1**

Stable builds are published through [GitHub Releases](https://github.com/AlexPlum405/Prism/releases/latest). Release asset names can vary by platform and signing status, so use the latest release page as the source of truth.

| Platform | Download |
| --- | --- |
| macOS Apple Silicon | [Latest release](https://github.com/AlexPlum405/Prism/releases/latest) |
| Windows installer | [Latest release](https://github.com/AlexPlum405/Prism/releases/latest) |
| Windows portable | [Latest release](https://github.com/AlexPlum405/Prism/releases/latest) |

Some development builds may be unsigned. Signed and notarized macOS builds should be treated as the target for stable releases.

## Screenshots

### Split writing

<img src="docs/screenshot/prism-intro/assets/split.png" alt="Prism split mode with editor and preview" width="920">

### Focused editing

<img src="docs/screenshot/prism-intro/assets/edit.png" alt="Prism edit mode" width="920">

### Preview typography

<img src="docs/screenshot/prism-intro/assets/preview-typography.png" alt="Prism preview typography" width="920">

### Code and diagrams

<p>
  <img src="docs/screenshot/prism-intro/assets/preview-code.png" alt="Prism code preview" width="456">
  <img src="docs/screenshot/prism-intro/assets/preview-diagram.png" alt="Prism Mermaid diagram preview" width="456">
</p>

### Export menu

<img src="docs/screenshot/prism-intro/assets/export.png" alt="Prism export menu with HTML, PDF, Word, PNG" width="920">

## Features

### Editing

- CodeMirror 6 editor with Markdown-friendly behavior
- Document search, replacement, current-hit highlighting, and navigation
- Edit, split, and preview modes
- Auto-save and dirty-state tracking
- Floating formatting toolbar for common Markdown actions
- Sidebar file tree, outline, and context menu

### Preview

- GitHub Flavored Markdown
- Syntax-highlighted code blocks
- Mermaid diagrams
- KaTeX inline and block math
- Tables, task lists, blockquotes, links, marks, and horizontal rules
- Centered long-form preview layout

### Themes

Prism themes are not just color filters. Each theme owns its own font, background, border, code, blockquote, table, search, and export-dialog treatment.

- **MiaoYan**: quiet Chinese writing, warm paper, refined spacing
- **Inkstone**: ink-and-paper editorial tone
- **Slate**: cool blue-gray technical writing
- **Mono**: black-and-white lab notebook feeling
- **Nocturne Dark**: calm dark theme for night writing

### Export

Prism currently supports:

- **HTML**: standalone themed document
- **PDF**: rendered from the preview result
- **Word `.docx`**: structured document export
- **PNG**: full-page visual export

The export flow uses Prism's own save and overwrite UI instead of native replacement prompts, so the product feels consistent across the writing and delivery flow.

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
| Diagrams | Mermaid |
| Export | docx, pdf-lib, html2canvas |
| Tests | Vitest + Testing Library |

## Development

### Prerequisites

- Node.js 18+
- Rust 1.77+
- Tauri 2 prerequisites for your platform

### Run locally

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

## Roadmap

- Code signing and smoother macOS first-launch experience
- Linux release build
- More export fidelity for complex Word documents
- Theme gallery and theme authoring docs
- Spell checking
- More keyboard-first writing workflows

## Contributing

Issues and pull requests are welcome. If you are reporting a visual bug, please include:

- OS and app version
- View mode: edit, split, or preview
- Current theme
- A screenshot or a minimal Markdown sample

## License

[MIT](LICENSE)

---

<div align="center">

Made with Tauri, React, CodeMirror, and a stubborn affection for good typography.

If Prism feels useful, a star helps more people find it.

</div>
