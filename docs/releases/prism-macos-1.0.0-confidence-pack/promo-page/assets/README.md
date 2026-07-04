# Prism 1.0.0 Promo Assets

These assets are generated from real Prism screenshots and are used by `README.md`, `README.zh-CN.md`, `README.ja-JP.md`, and `promo-page/index.html`.

Refresh command:

```bash
node scripts/generate-prism-promo-assets.mjs
```

| Asset | Use |
|---|---|
| `prism-hero-writing.mp4` | Promo page hero video |
| `prism-hero-writing.gif` | README hero animation |
| `prism-themes.mp4` | Theme showcase |
| `prism-languages.mp4` | Chinese / English / Japanese UI showcase |
| `prism-knowledge-graph.mp4` | Links, backlinks, and graph showcase |
| `prism-diagrams-formulas.mp4` | Mermaid, PlantUML, Markmap, and KaTeX showcase |
| `prism-export.mp4` | Export and diagnostics showcase |
| `prism-local-file.mp4` | Local file flow source video |
| `prism-local-file.gif` | README local file animation |
| `posters/*.png` | Static posters for README links and video fallback |
| `promo-assets-manifest.json` | Machine-readable source and output mapping |

The generator writes temporary frames to `.frames` and removes them after encoding. Do not commit generated frame directories.
