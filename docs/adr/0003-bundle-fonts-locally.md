# Inter + JetBrains Mono 字体本地打包

2026-05-10：将 Inter（Variable 400-700）与 JetBrains Mono（Regular + Medium）的 WOFF2 字体文件直接打包到 `src/assets/fonts/`，通过 `@font-face` 本地加载，不依赖 Google Fonts CDN。

## Considered Options
- **CDN 方案**（原型当前做法）：无需打包、无许可证审阅；但 Tauri 桌面应用离线场景 / 国内受限网络 / 严格 CSP 下会退化到系统字体，导致原型核心排印特征（`letter-spacing: -1.44px` 的显示级 H1）不可复现。
- **系统字体 fallback**：最省事；在当时的 OpenAI 原型方向下，Inter 的字形和字距调整是重要辨识度，用 Segoe UI 代替会失去设计方向的一半。

## Consequences
- Bundle 体积增加约 500KB（WOFF2 压缩后）。
- 字体授权：Inter 与 JetBrains Mono 均为 OFL（开源字体许可证），可随应用分发。需在 `NOTICE` 或"关于"页面致谢。
