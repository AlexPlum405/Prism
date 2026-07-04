import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const releaseRoot = path.join(repoRoot, "docs/releases/prism-macos-1.0.0-confidence-pack");
const outputRoot = path.join(releaseRoot, "promo-page/assets");
const posterRoot = path.join(outputRoot, "posters");
const tmpRoot = path.join(outputRoot, ".frames");

const W = 1280;
const H = 720;
const FPS = 15;

const source = (...parts) => path.join(repoRoot, ...parts);
const rel = (...parts) => path.join(...parts);

const screenshots = {
  hero: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-032-guide-split-toc-window.png")),
  preview: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-034-split-table-code-rendering-window.png")),
  releaseDiagrams: source(rel("docs/releases/prism-macos-1.0.0-confidence-pack/screenshots/03-diagrams-formulas-preview.png")),
  finder: source(rel("docs/releases/prism-macos-1.0.0-confidence-pack/screenshots/finder-icons/03-finder-large-icon-view.png")),
  firstRun: source(rel("docs/releases/prism-macos-1.0.0-confidence-pack/screenshots/10-first-run-documents.png")),
  langZh: source(rel("docs/releases/prism-macos-1.0.0-confidence-pack/screenshots/i18n/zh-01-main-window.png")),
  langEn: source(rel("docs/releases/prism-macos-1.0.0-confidence-pack/screenshots/i18n/en-01-main-window.png")),
  langJa: source(rel("docs/releases/prism-macos-1.0.0-confidence-pack/screenshots/i18n/ja-01-main-window.png")),
  themeMiaoyan: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-099-theme-miaoyan-restored-bottom-window.png")),
  themeInkstone: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-094-theme-inkstone-light-split-window.png")),
  themeSlate: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-095-theme-slate-manual-split-window.png")),
  themeMono: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-096-theme-mono-lab-split-window.png")),
  themeNocturne: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-097-theme-nocturne-dark-split-window.png")),
  graph: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-214-relation-graph-current-document-baseline-window.png")),
  links: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-071-knowledge-current-links-window.png")),
  mermaid: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-123-complex-diagrams-preview-mermaid-window.png")),
  plantuml: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-124-complex-diagrams-preview-plantuml-window.png")),
  markmap: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-125-complex-diagrams-preview-markmap-window.png")),
  math: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-127-complex-diagrams-preview-math-window.png")),
  exportMenu: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-108-export-menu-real-markdown-window.png")),
  exportDialog: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-112-export-pdf-dialog-preflight-pass-window.png")),
  exportDone: source(rel("docs/verification/runs/prism-full-functional-2026-06-27/screenshots/15-computer-use-real-app/PRISM-CU-118-export-complete-returned-to-editor-window.png")),
};

const videos = [
  {
    name: "prism-hero-writing",
    gif: true,
    slides: [
      { image: screenshots.hero, title: "把 Markdown 写成漂亮的文稿", sub: "编辑、预览和成稿感放在同一个窗口里" },
      { image: screenshots.preview, title: "写的时候，就能看到版面", sub: "长文、表格、代码和引用都有清楚层次" },
      { image: screenshots.releaseDiagrams, title: "复杂内容也能进入文稿", sub: "公式、图表、思维导图和正文一起排版" },
    ],
  },
  {
    name: "prism-themes",
    slides: [
      { image: screenshots.themeMiaoyan, title: "不同主题，不同文稿气质", sub: "MiaoYan" },
      { image: screenshots.themeInkstone, title: "同一篇文稿，换一种纸面", sub: "Inkstone Light" },
      { image: screenshots.themeSlate, title: "技术文档也需要版面", sub: "Slate Manual" },
      { image: screenshots.themeMono, title: "黑白关系，适合草稿和笔记", sub: "Mono Lab" },
      { image: screenshots.themeNocturne, title: "深色主题，也要有完整排版", sub: "Nocturne Dark" },
    ],
  },
  {
    name: "prism-languages",
    slides: [
      { image: screenshots.langZh, title: "中文、English、日本語", sub: "三种语言都能直接进入写作" },
      { image: screenshots.langEn, title: "A product experience, not a half translation", sub: "English interface" },
      { image: screenshots.langJa, title: "ことばを変えても、体験はそのまま", sub: "日本語 interface" },
    ],
  },
  {
    name: "prism-knowledge-graph",
    slides: [
      { image: screenshots.graph, title: "不只写一篇，也整理一组文档", sub: "知识图谱把本地 Markdown 的关系摆出来" },
      { image: screenshots.links, title: "链接和反链，不必藏在源码里", sub: "写作空间也能呈现文档之间的上下文" },
    ],
  },
  {
    name: "prism-diagrams-formulas",
    slides: [
      { image: screenshots.mermaid, title: "复杂内容，也要排得体面", sub: "Mermaid" },
      { image: screenshots.plantuml, title: "人物关系和结构图，也在预览里成形", sub: "PlantUML" },
      { image: screenshots.markmap, title: "思维导图，不该只停留在代码块里", sub: "Markmap" },
      { image: screenshots.math, title: "公式进入文稿，也要清楚好读", sub: "KaTeX" },
    ],
  },
  {
    name: "prism-export",
    slides: [
      { image: screenshots.exportMenu, title: "写完之后，版面也别散掉", sub: "HTML、PDF、PNG、DOCX 从同一篇文稿出发" },
      { image: screenshots.exportDialog, title: "导出前先看清风险", sub: "Prism 会把缺图、坏链和渲染风险摆出来" },
      { image: screenshots.exportDone, title: "导出完成，回到写作", sub: "交付不是跳出产品体验的最后一公里" },
    ],
  },
  {
    name: "prism-local-file",
    gif: true,
    slides: [
      { image: screenshots.finder, title: "从一个本地 .md 文件开始", sub: "Finder 里的 Markdown 也有自己的 Prism 图标" },
      { image: screenshots.firstRun, title: "打开之后，就是你的写作空间", sub: "本地文档、示例和指南都在熟悉的文件夹里" },
    ],
  },
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function makeFrame(slide, frameIndex, totalFrames) {
  const screenshotW = 1064;
  const screenshotH = 564;
  const image = await sharp(slide.image)
    .resize(screenshotW, screenshotH, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  const card = await sharp({
    create: {
      width: screenshotW + 28,
      height: screenshotH + 28,
      channels: 4,
      background: "#fffefa",
    },
  })
    .composite([
      { input: image, left: 14, top: 14 },
    ])
    .png()
    .toBuffer();

  const p = totalFrames <= 1 ? 0 : frameIndex / (totalFrames - 1);
  const lift = Math.round(-10 * Math.sin(p * Math.PI));
  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7f3ea"/>
          <stop offset="0.58" stop-color="#fbfaf7"/>
          <stop offset="1" stop-color="#e8e1d3"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#5f5142" flood-opacity="0.20"/>
        </filter>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <text x="96" y="90" fill="#7a3dad" font-size="38" font-weight="800"
        font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif">${escapeXml(slide.title)}</text>
      <text x="98" y="128" fill="#5f594f" font-size="19"
        font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif">${escapeXml(slide.sub)}</text>
      <text x="1086" y="655" fill="#8f8678" font-size="13" letter-spacing="1.4"
        font-family="-apple-system, BlinkMacSystemFont, sans-serif">PRISM 1.0.0</text>
    </svg>
  `);

  return sharp(svg)
    .composite([
      {
        input: card,
        left: Math.round((W - screenshotW - 28) / 2),
        top: 148 + lift,
      },
    ])
    .png()
    .toBuffer();
}

function execFileP(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: repoRoot }, (error, stdout, stderr) => {
      if (error) {
        error.message += `\n${stderr}`;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function encodeMp4(frameDir, outputFile) {
  await execFileP("ffmpeg", [
    "-y",
    "-framerate", String(FPS),
    "-i", path.join(frameDir, "frame-%04d.png"),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-crf", "22",
    outputFile,
  ]);
}

async function encodeGif(mp4File, gifFile) {
  const palette = path.join(tmpRoot, `${path.basename(gifFile)}.palette.png`);
  await execFileP("ffmpeg", [
    "-y",
    "-i", mp4File,
    "-vf", "fps=12,scale=900:-1:flags=lanczos,palettegen=stats_mode=diff",
    palette,
  ]);
  await execFileP("ffmpeg", [
    "-y",
    "-i", mp4File,
    "-i", palette,
    "-filter_complex", "fps=12,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    gifFile,
  ]);
}

async function renderVideo(video) {
  const frameDir = path.join(tmpRoot, video.name);
  await fs.rm(frameDir, { recursive: true, force: true });
  await fs.mkdir(frameDir, { recursive: true });

  const slideFrames = Math.round(2.2 * FPS);
  let frame = 0;
  for (const slide of video.slides) {
    for (let i = 0; i < slideFrames; i += 1) {
      const buffer = await makeFrame(slide, i, slideFrames);
      await fs.writeFile(path.join(frameDir, `frame-${String(frame).padStart(4, "0")}.png`), buffer);
      frame += 1;
    }
  }

  const mp4 = path.join(outputRoot, `${video.name}.mp4`);
  await encodeMp4(frameDir, mp4);

  const poster = path.join(posterRoot, `${video.name}.png`);
  await fs.copyFile(path.join(frameDir, "frame-0000.png"), poster);

  if (video.gif) {
    await encodeGif(mp4, path.join(outputRoot, `${video.name}.gif`));
  }
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.mkdir(posterRoot, { recursive: true });
  await fs.mkdir(tmpRoot, { recursive: true });

  const missing = [];
  for (const [name, file] of Object.entries(screenshots)) {
    if (!(await exists(file))) missing.push(`${name}: ${file}`);
  }
  if (missing.length > 0) {
    throw new Error(`Missing source screenshots:\n${missing.join("\n")}`);
  }

  for (const video of videos) {
    console.log(`[promo] rendering ${video.name}`);
    await renderVideo(video);
  }

  await fs.rm(tmpRoot, { recursive: true, force: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    outputRoot: path.relative(repoRoot, outputRoot),
    videos: videos.map((video) => ({
      name: video.name,
      mp4: path.relative(repoRoot, path.join(outputRoot, `${video.name}.mp4`)),
      gif: video.gif ? path.relative(repoRoot, path.join(outputRoot, `${video.name}.gif`)) : null,
      poster: path.relative(repoRoot, path.join(posterRoot, `${video.name}.png`)),
      sourceSlides: video.slides.map((slide) => path.relative(repoRoot, slide.image)),
    })),
  };
  await fs.writeFile(path.join(outputRoot, "promo-assets-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[promo] wrote ${path.relative(repoRoot, path.join(outputRoot, "promo-assets-manifest.json"))}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
