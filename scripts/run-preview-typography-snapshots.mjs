import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const fixturePath = path.join(repoRoot, 'docs/verification/fixtures/prism-typography-fixture.md');
const outputDir = path.join(repoRoot, 'docs/verification/prism-preview-typography-snapshots-2026-06-17');
const reportPath = path.join(outputDir, 'README.md');
const widths = [1200, 1440, 1920];
const themes = [
  {
    id: 'miaoyan',
    compatClass: 'preview-compat--miaoyan',
    writeClass: 'markdown-body heti',
    label: 'MiaoYan default',
  },
  {
    id: 'nocturne',
    compatClass: 'preview-compat--nocturne',
    writeClass: 'markdown-body heti nocturne-write',
    label: 'Nocturne dark',
  },
];

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\$([^$\n]+)\$/g, '<span class="katex">$1</span>');
}

function renderFixtureHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let index = 0;

  const flushParagraph = (parts) => {
    if (parts.length > 0) html.push(`<p>${parts.join(' ')}</p>`);
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      html.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
      index += 1;
      continue;
    }

    if (line.startsWith('```mermaid')) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<div class="mermaid-placeholder"><pre><code class="language-mermaid">${escapeHtml(code.join('\n'))}</code></pre></div>`);
      continue;
    }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'text';
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (line.trim() === '$$') {
      const math = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '$$') {
        math.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<span class="katex-display"><span class="katex">${escapeHtml(math.join(' '))}</span></span>`);
      continue;
    }

    if (/^\|.+\|$/.test(line) && index + 1 < lines.length && /^\|[\s:|.-]+\|$/.test(lines[index + 1])) {
      const header = line.split('|').slice(1, -1).map((cell) => cell.trim());
      index += 2;
      const rows = [];
      while (index < lines.length && /^\|.+\|$/.test(lines[index])) {
        rows.push(lines[index].split('|').slice(1, -1).map((cell) => cell.trim()));
        index += 1;
      }
      html.push([
        '<table>',
        '<thead><tr>',
        ...header.map((cell) => `<th>${escapeHtml(cell)}</th>`),
        '</tr></thead>',
        '<tbody>',
        ...rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`),
        '</tbody></table>',
      ].join(''));
      continue;
    }

    if (line.startsWith('> [!')) {
      const title = /^\> \[!(\w+)\]/.exec(line)?.[1] ?? 'NOTE';
      const body = [];
      index += 1;
      while (index < lines.length && lines[index].startsWith('>')) {
        body.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote class="prism-callout prism-callout--${title.toLowerCase()}" data-callout-title="${escapeHtml(title)}"><p>${renderInline(body.join(' '))}</p></blockquote>`);
      continue;
    }

    if (line.startsWith('>')) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        const value = lines[index].replace(/^>\s?/, '');
        if (value.trim()) quote.push(`<p>${renderInline(value)}</p>`);
        index += 1;
      }
      html.push(`<blockquote>${quote.join('')}</blockquote>`);
      continue;
    }

    if (line.startsWith('<details>')) {
      const details = [];
      while (index < lines.length && !lines[index].startsWith('</details>')) {
        details.push(lines[index]);
        index += 1;
      }
      details.push(lines[index] ?? '</details>');
      index += 1;
      html.push(details.join('\n'));
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (index < lines.length && (/^[-*]\s+/.test(lines[index]) || /^\d+\.\s+/.test(lines[index]) || /^\s{2,}[-*]\s+/.test(lines[index]))) {
        const item = lines[index].replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
        items.push(`<li>${renderInline(item)}</li>`);
        index += 1;
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(#{1,6})\s+/.test(lines[index])
      && !lines[index].startsWith('```')
      && !lines[index].startsWith('>')
      && !lines[index].startsWith('<details>')
      && !/^\|.+\|$/.test(lines[index])
      && lines[index].trim() !== '$$'
      && !/^[-*]\s+/.test(lines[index])
      && !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(renderInline(lines[index]));
      index += 1;
    }
    flushParagraph(paragraph);
  }

  return html.join('\n');
}

async function readCssWithImports(filename, seen = new Set()) {
  const filePath = path.join(repoRoot, 'src/styles', filename);
  if (seen.has(filePath)) return '';
  seen.add(filePath);
  let css = await readFile(filePath, 'utf8');
  css = await Promise.all(css.split('\n').map(async (line) => {
    const match = /^@import\s+['"]\.\/([^'"]+)['"];\s*$/.exec(line);
    return match ? readCssWithImports(match[1], seen) : line;
  })).then((parts) => parts.join('\n'));
  return css.replace(/url\('\.\.\/assets\//g, () => `url('${pathToFileURL(path.join(repoRoot, 'src/assets')).href}/`);
}

function buildHtml(css, bodyHtml, theme) {
  return `<!doctype html>
<html lang="zh-CN" data-content-theme="${theme.id}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prism Typography Snapshot</title>
  <style>${css}</style>
  <style>
    html, body { min-height: 100%; background: var(--preview-bg); }
    body { overflow: auto; }
    .snapshot-frame { min-height: 100vh; padding: 48px 0 72px; background: var(--preview-bg); }
    .katex-display { display: block; margin: 1.35em 0; text-align: center; }
    .katex { font-family: var(--font-mono); }
    .mermaid-placeholder { border: 1px dashed var(--c-fog); border-radius: 8px; padding: 18px; }
  </style>
</head>
<body>
  <main class="snapshot-frame">
    <article class="preview-compat ${theme.compatClass}">
      <div id="write" class="${theme.writeClass}">
        ${bodyHtml}
      </div>
    </article>
  </main>
</body>
</html>`;
}

function parseRgb(value) {
  const rgb = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(value);
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

function luminance([r, g, b]) {
  const channel = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
}

function contrastRatio(foreground, background) {
  const fg = parseRgb(foreground);
  const bg = parseRgb(background);
  if (!fg || !bg) return null;
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

async function collectMetrics(page, width, theme) {
  return page.evaluate(({ width, theme }) => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        width: Math.round(rect.width * 10) / 10,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        color: style.color,
        background: style.backgroundColor,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
      };
    };
    const write = document.querySelector('#write');
    const paragraph = document.querySelector('p');
    const writeRect = write?.getBoundingClientRect();
    const paragraphStyle = paragraph ? getComputedStyle(paragraph) : null;
    const fontSize = paragraphStyle ? Number.parseFloat(paragraphStyle.fontSize) : 16;
    const lineHeight = paragraphStyle ? Number.parseFloat(paragraphStyle.lineHeight) : 28;
    return {
      theme,
      viewportWidth: width,
      pageScrollWidth: document.documentElement.scrollWidth,
      hasPageHorizontalOverflow: document.documentElement.scrollWidth > width + 2,
      writeWidth: writeRect ? Math.round(writeRect.width * 10) / 10 : null,
      estimatedCjkCharsPerLine: writeRect ? Math.round((writeRect.width / Math.max(fontSize, 1)) * 10) / 10 : null,
      paragraphLineHeightRatio: Math.round((lineHeight / Math.max(fontSize, 1)) * 100) / 100,
      p: read('p'),
      h1: read('h1'),
      h2: read('h2'),
      blockquote: read('blockquote:not(.prism-callout)'),
      callout: read('blockquote.prism-callout'),
      table: read('table'),
      pre: read('pre'),
      inlineCode: read('p code, li code'),
    };
  }, { width, theme });
}

function formatMetricsTable(metrics) {
  return [
    '| Theme | Width | Write width | Est. CJK chars/line | Paragraph line-height | Page overflow |',
    '|---|---:|---:|---:|---:|---|',
    ...metrics.map((entry) => (
      `| ${entry.theme} | ${entry.viewportWidth} | ${entry.writeWidth} | ${entry.estimatedCjkCharsPerLine} | ${entry.paragraphLineHeightRatio} | ${entry.hasPageHorizontalOverflow ? 'yes' : 'no'} |`
    )),
  ].join('\n');
}

async function main() {
  if (!existsSync(fixturePath)) {
    throw new Error(`Missing fixture: ${fixturePath}`);
  }
  await mkdir(outputDir, { recursive: true });

  const [css, markdown] = await Promise.all([
    readCssWithImports('global.css'),
    readFile(fixturePath, 'utf8'),
  ]);
  const bodyHtml = renderFixtureHtml(markdown);
  const allMetrics = [];
  const screenshots = [];
  const browser = await chromium.launch();

  try {
    for (const theme of themes) {
      const html = buildHtml(css, bodyHtml, theme);

      for (const width of widths) {
        const page = await browser.newPage({ viewport: { width, height: 1400 }, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts?.ready);
        const metrics = await collectMetrics(page, width, theme.id);
        allMetrics.push(metrics);
        const screenshotName = `${theme.id}-${width}.png`;
        const screenshotPath = path.join(outputDir, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        screenshots.push({ theme: theme.id, width, path: screenshotPath });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const dark = allMetrics.find((entry) => entry.theme === 'nocturne' && entry.viewportWidth === 1440);
  const darkContrast = dark?.p ? contrastRatio(dark.p.color, 'rgb(23, 26, 24)') : null;
  const report = `# Prism Preview Typography Snapshots 2026-06-17

Generated by \`node scripts/run-preview-typography-snapshots.mjs\`.

Fixture: \`docs/verification/fixtures/prism-typography-fixture.md\`

## Screenshots

${screenshots.map((shot) => `- ${shot.theme} ${shot.width}px: \`${path.relative(repoRoot, shot.path)}\``).join('\n')}

## Computed Metrics

${formatMetricsTable(allMetrics)}

## Contrast Check

- Nocturne paragraph vs preview background at 1440px: ${darkContrast ?? 'n/a'}:1

## Notes

- Fixture covers headings, Chinese prose, nested lists, tables, blockquote, Callout, Toggle, code block, inline code, KaTeX placeholder, Mermaid placeholder, and dark mode.
- \`hasPageHorizontalOverflow\` must remain \`no\`; wide tables/code should scroll inside their own blocks instead of expanding the preview page.
`;

  await writeFile(reportPath, report, 'utf8');
  console.log(JSON.stringify({
    report: path.relative(repoRoot, reportPath),
    screenshots: screenshots.map((shot) => path.relative(repoRoot, shot.path)),
    metrics: allMetrics,
    darkContrast,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
