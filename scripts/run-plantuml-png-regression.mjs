#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { build } from 'vite';
import wasm from 'vite-plugin-wasm';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const smokeRoot = path.join(repoRoot, '.codex-smoke/plantuml-png-regression');
const harnessRoot = path.join(smokeRoot, 'harness');
const bundleRoot = path.join(smokeRoot, 'bundle');
const outputDir = path.join(smokeRoot, 'out');
const screenshotPath = path.join(outputDir, 'plantuml-export.png');
const debugHtmlPath = path.join(outputDir, 'plantuml-debug.html');
const reportPath = path.join(outputDir, 'report.json');

const plantUmlCases = [
  {
    id: 'miaoyan-character',
    title: '《聊斋志异》人物关系图',
    minWidth: 500,
    requiredTokens: ['王子服', '婴宁', '婴宁母亲', '鬼仆', '母女情深', '忠心侍奉'],
    source: `@startuml
class 王子服 {
  -姓名: String
  -身份: 书生
  -性格: 痴情
  +游学()
  +求婚()
}

class 婴宁 {
  -真身: 狐仙
  -特点: 善笑
  -美貌: 绝世
  +化身人形()
  +展现真容()
}

class 婴宁母亲 {
  -身份: 老狐仙
  -性格: 慈祥
  +保护女儿()
  +成全恋情()
}

class 鬼仆 {
  -职责: 护卫
  +服侍主人()
}

王子服 --> 婴宁 : 爱慕
婴宁 --> 王子服 : 钟情
婴宁母亲 --> 婴宁 : 母女情深
鬼仆 --> 婴宁母亲 : 忠心侍奉
@enduml`,
  },
  {
    id: 'prism-relationship',
    title: 'Prism Relationship',
    minWidth: 350,
    requiredTokens: ['Prism', 'Writer', 'Workspace', 'edit markdown', 'preview and export', 'save'],
    source: `@startuml
skinparam backgroundColor transparent
skinparam defaultFontName "PingFang SC"
skinparam shadowing false
actor Writer
rectangle Prism
database Workspace
Writer --> Prism : edit markdown
Prism --> Workspace : save
Prism --> Writer : preview and export
@enduml`,
  },
];

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}

async function writeHarness() {
  await fs.rm(smokeRoot, { recursive: true, force: true });
  await fs.mkdir(harnessRoot, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const srcRootUrl = pathToFileURL(path.join(repoRoot, 'src')).href;
  const entry = `
import html2canvas from 'html2canvas';
import { createPlantUmlSvgElement } from '${srcRootUrl}/domains/editor/components/plantUml.ts';
import { __exportPipelineTesting } from '${srcRootUrl}/domains/export/exportPipeline.ts';
import '${srcRootUrl}/styles/preview.css';
import '${srcRootUrl}/styles/miaoyan.css';
import '${srcRootUrl}/styles/content-themes.css';

const cases = ${JSON.stringify(plantUmlCases)};

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPixelBounds(imageData) {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      if (a < 16) continue;
      const isBackground = r > 242 && g > 242 && b > 242;
      if (isBackground) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, width: Math.max(0, maxX - minX + 1), height: Math.max(0, maxY - minY + 1) };
}

async function main() {
  document.documentElement.dataset.contentTheme = 'miaoyan';
  document.body.className = 'plantuml-regression-body';
  document.body.innerHTML = [
    '<div class="prism-export-document prism-export-template--theme preview-compat preview-compat--miaoyan">',
    '<div id="write" class="write-miaoyan">',
    ...cases.map((testCase) => [
      '<h3>',
      escapeHtml(testCase.title),
      '</h3>',
      '<div class="plantuml-placeholder" data-case-id="',
      escapeHtml(testCase.id),
      '"></div>',
    ].join('')),
    '</div>',
    '</div>',
  ].join('');
  const caseReports = [];

  for (const testCase of cases) {
    const placeholder = document.querySelector(\`.plantuml-placeholder[data-case-id="\${testCase.id}"]\`);
    const svg = await createPlantUmlSvgElement(testCase.source, 'miaoyan');
    __exportPipelineTesting.normalizePlantUmlSvg(svg);
    placeholder.replaceChildren(svg);
    placeholder.style.boxSizing = 'border-box';
    placeholder.style.display = 'block';
    placeholder.style.width = '100%';
    placeholder.style.maxWidth = '100%';
    placeholder.style.overflow = 'visible';
    caseReports.push({
      id: testCase.id,
      title: testCase.title,
      minWidth: testCase.minWidth,
      requiredTokens: testCase.requiredTokens,
      svg: {
        width: svg.getAttribute('width'),
        height: svg.getAttribute('height'),
        viewBox: svg.getAttribute('viewBox'),
        styleWidth: svg.style.width,
        text: svg.textContent,
      },
    });
  }

  await document.fonts?.ready?.catch?.(() => undefined);
  await nextFrame();

  const target = document.querySelector('.prism-export-document');
  await __exportPipelineTesting.rasterizePlantUmlSvgsForCapture(target);
  for (const caseReport of caseReports) {
    const placeholder = document.querySelector(\`.plantuml-placeholder[data-case-id="\${caseReport.id}"]\`);
    const image = placeholder.querySelector('.plantuml-image');
    const imageRect = image.getBoundingClientRect();
    const placeholderRect = placeholder.getBoundingClientRect();
    caseReport.svg.rect = {
      left: imageRect.left,
      top: imageRect.top,
      width: imageRect.width,
      height: imageRect.height,
      right: imageRect.right,
    };
    caseReport.svg.captureTag = image.tagName.toLowerCase();
    caseReport.placeholder = {
      left: placeholderRect.left,
      width: placeholderRect.width,
      right: placeholderRect.right,
      overflow: getComputedStyle(placeholder).overflow,
    };
  }

  const targetRect = target.getBoundingClientRect();
  const canvas = await html2canvas(target, {
    backgroundColor: '#ffffff',
    scale: 1,
    useCORS: true,
    logging: false,
    width: Math.ceil(targetRect.width),
    height: Math.ceil(target.scrollHeight),
    windowWidth: Math.ceil(targetRect.width),
    windowHeight: Math.ceil(target.scrollHeight),
    scrollX: 0,
    scrollY: 0,
  });
  const ctx = canvas.getContext('2d');
  const bounds = getPixelBounds(ctx.getImageData(0, 0, canvas.width, canvas.height));
  const dataUrl = canvas.toDataURL('image/png');
  const report = {
    cases: caseReports,
    target: {
      width: targetRect.width,
      height: targetRect.height,
      scrollHeight: target.scrollHeight,
    },
    canvas: {
      width: canvas.width,
      height: canvas.height,
      contentBounds: bounds,
    },
    dataUrl,
  };
  window.__PRISM_PLANTUML_REGRESSION__ = report;
}

main().catch((error) => {
  window.__PRISM_PLANTUML_REGRESSION_ERROR__ = error instanceof Error ? error.stack || error.message : String(error);
});
`;

  await fs.writeFile(path.join(harnessRoot, 'entry.js'), entry, 'utf8');
  await fs.writeFile(
    path.join(harnessRoot, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><title>PlantUML PNG regression</title></head><body><script type="module" src="./entry.js"></script></body></html>',
    'utf8',
  );
}

async function buildHarness() {
  await build({
    root: harnessRoot,
    base: './',
    plugins: [wasm()],
    logLevel: 'warn',
    build: {
      outDir: bundleRoot,
      emptyOutDir: true,
      target: 'es2022',
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  });
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  if (filePath.endsWith('.woff')) return 'font/woff';
  if (filePath.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

async function withStaticServer(root, callback) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const rawPath = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
      const targetPath = path.resolve(root, `.${rawPath}`);
      if (!targetPath.startsWith(root)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const bytes = await fs.readFile(targetPath);
      response.writeHead(200, { 'Content-Type': getContentType(targetPath) });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to start local regression server');
    return await callback(`http://127.0.0.1:${address.port}/`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runBrowser() {
  const browser = await chromium.launch();
  try {
    return await withStaticServer(bundleRoot, async (url) => {
      const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 });
      page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__PRISM_PLANTUML_REGRESSION__ || window.__PRISM_PLANTUML_REGRESSION_ERROR__, null, { timeout: 30_000 });
      const error = await page.evaluate(() => window.__PRISM_PLANTUML_REGRESSION_ERROR__ || null);
      if (error) throw new Error(error);
      const report = await page.evaluate(() => window.__PRISM_PLANTUML_REGRESSION__);
      await fs.writeFile(debugHtmlPath, await page.content(), 'utf8');
      const png = Buffer.from(report.dataUrl.split(',')[1], 'base64');
      await fs.writeFile(screenshotPath, png);
      delete report.dataUrl;
      await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      return report;
    });
  } finally {
    await browser.close();
  }
}

async function assertImageComplete(report) {
  const metadata = await sharp(screenshotPath).metadata();
  const bounds = report.canvas.contentBounds;
  const rightMargin = metadata.width - bounds.maxX - 1;
  const failures = [
    metadata.format === 'png' ? null : `PNG 格式错误: ${metadata.format}`,
    metadata.width >= 900 ? null : `PNG 宽度过窄: ${metadata.width}`,
    rightMargin >= 16 ? null : `PNG 非背景像素贴近右边界: ${rightMargin}`,
    bounds.width >= 480 ? null : `图表非背景像素宽度过窄: ${bounds.width}`,
  ].filter(Boolean);

  for (const testCase of report.cases) {
    const missingTokens = testCase.requiredTokens.filter((token) => !testCase.svg.text.includes(token));
    const svgRightMargin = testCase.placeholder.right - testCase.svg.rect.right;
    if (testCase.svg.rect.width < testCase.minWidth) {
      failures.push(`${testCase.id} PlantUML SVG 渲染宽度过窄: ${testCase.svg.rect.width}`);
    }
    if (svgRightMargin < 16) {
      failures.push(`${testCase.id} SVG 贴近或越过容器右边界: ${svgRightMargin}`);
    }
    if (missingTokens.length > 0) {
      failures.push(`${testCase.id} SVG 文本缺失: ${missingTokens.join(', ')}`);
    }
  }

  if (failures.length > 0) {
    throw new Error([
      'PlantUML PNG regression failed:',
      ...failures.map((failure) => `- ${failure}`),
      `- screenshot: ${screenshotPath}`,
      `- report: ${reportPath}`,
    ].join('\n'));
  }

  console.log(JSON.stringify({
    status: 'Pass',
    screenshot: toPosixPath(path.relative(repoRoot, screenshotPath)),
    report: toPosixPath(path.relative(repoRoot, reportPath)),
    png: {
      width: metadata.width,
      height: metadata.height,
      rightMargin,
    },
    cases: report.cases.map((testCase) => ({
      id: testCase.id,
      svg: {
        width: testCase.svg.rect.width,
        height: testCase.svg.rect.height,
        viewBox: testCase.svg.viewBox,
        containerRightMargin: testCase.placeholder.right - testCase.svg.rect.right,
      },
    })),
  }, null, 2));
}

await writeHarness();
await buildHarness();
const report = await runBrowser();
await assertImageComplete(report);
