import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const fixturePath = path.join(repoRoot, 'docs/verification/fixtures/prism-typography-fixture.md');
const outputDir = path.join(repoRoot, 'docs/verification/prism-theme-snapshots-2026-06-17');
const reportPath = path.join(outputDir, 'README.md');
const viewport = { width: 1440, height: 1180 };

const themes = [
  {
    id: 'miaoyan',
    label: 'MiaoYan',
    compatClass: 'preview-compat--miaoyan',
    writeClass: 'markdown-body heti',
    dark: false,
  },
  {
    id: 'inkstone',
    label: 'Inkstone Light',
    compatClass: 'preview-compat--inkstone',
    writeClass: 'markdown-body heti inkstone-write',
    dark: false,
  },
  {
    id: 'slate',
    label: 'Slate Manual',
    compatClass: 'preview-compat--slate',
    writeClass: 'markdown-body heti slate-write',
    dark: false,
  },
  {
    id: 'mono',
    label: 'Mono Lab',
    compatClass: 'preview-compat--mono',
    writeClass: 'markdown-body heti mono-write',
    dark: false,
  },
  {
    id: 'nocturne',
    label: 'Nocturne',
    compatClass: 'preview-compat--nocturne',
    writeClass: 'markdown-body heti nocturne-write',
    dark: true,
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
    if (paragraph.length > 0) html.push(`<p>${paragraph.join(' ')}</p>`);
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

async function readSnapshotCss() {
  const [globalCss, statusBarCss] = await Promise.all([
    readCssWithImports('global.css'),
    readFile(path.join(repoRoot, 'src/domains/workspace/components/StatusBar.module.css'), 'utf8'),
  ]);
  return `${globalCss}\n${statusBarCss}\n${snapshotCss}`;
}

function buildEditorSource(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 18)
    .map((line) => {
      let className = 'cm-line';
      if (/^#{1,6}\s+/.test(line)) className += ' cm-md-heading';
      if (/^[-*]\s+/.test(line)) className += ' cm-md-list-marker';
      if (line.startsWith('>')) className += ' cm-md-quote';
      if (line.startsWith('```') || line.startsWith('|')) className += ' cm-md-fenced-code';
      return `<div class="${className}">${escapeHtml(line)}</div>`;
    })
    .join('\n');
}

function buildHtml(css, bodyHtml, editorSource, theme) {
  return `<!doctype html>
<html lang="zh-CN" data-content-theme="${theme.id}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prism Theme Snapshot - ${theme.label}</title>
  <style>${css}</style>
</head>
<body class="${theme.dark ? 'dark' : ''}">
  <main class="theme-snapshot">
    <section class="theme-snapshot__header">
      <div>
        <p class="theme-snapshot__eyebrow">Prism built-in theme snapshot</p>
        <h1>${theme.label}</h1>
      </div>
      <div class="theme-snapshot__chips">
        <span>${theme.id}</span>
        <span>1440px</span>
        <span>preview + editor + floating UI</span>
      </div>
    </section>

    <section class="theme-snapshot__grid">
      <div class="theme-snapshot__pane theme-snapshot__pane--editor">
        <div class="theme-snapshot__pane-title">Editor surface</div>
        <div class="cm-editor cm-focused">
          <div class="cm-scroller">
            <div class="cm-content">${editorSource}</div>
          </div>
        </div>
        <div class="statusbar">
          <div class="sidebarZone visible">
            <button class="folder"><span>Prism Notes</span></button>
          </div>
          <div class="main">
            <div class="left">
              <button class="btn active">专注</button>
              <span class="sep"></span>
              <button class="btn">导出</button>
            </div>
            <div class="center">1,248 字 · 78 行 · UTF-8</div>
            <div class="right">
              <span class="exportStatus exportStatusFailed"><span class="exportStatusText">导出失败</span></span>
              <button class="btn iconBtn">图</button>
            </div>
          </div>
        </div>
        <div class="prism-diagnostics-popover is-active theme-snapshot__diagnostics">
          <div class="sp-header">
            <div>
              <h2>导出诊断</h2>
              <p class="prism-diagnostics-subtitle">2 个资源需要处理</p>
            </div>
          </div>
          <div class="prism-link-diagnostics-body">
            <div class="prism-diagnostics-group">
              <div class="prism-diagnostics-group-title">图片</div>
              <button class="prism-link-diagnostic-item">
                <span class="prism-link-diagnostic-kind">IMG</span>
                <span>
                  <strong class="prism-link-diagnostic-target">assets/missing.png</strong>
                  <span class="prism-link-diagnostic-message">导出前无法定位本地图片</span>
                </span>
                <span class="prism-link-diagnostic-location">L42</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="theme-snapshot__pane theme-snapshot__pane--preview">
        <div class="theme-snapshot__pane-title">Preview surface</div>
        <article class="preview-compat ${theme.compatClass}">
          <div id="write" class="${theme.writeClass}">${bodyHtml}</div>
        </article>
      </div>
    </section>

    <section class="cmdk theme-snapshot__cmdk" role="dialog" aria-label="Quick Open">
      <div class="cmdk-titlebar">
        <div class="cmdk-title-main">
          <span class="cmdk-title">快速打开</span>
          <span class="cmdk-scope">文件</span>
        </div>
        <span class="cmdk-hint">文件、标题、路径 · 索引就绪</span>
      </div>
      <div class="cmdk-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
        <input class="cmdk-input" value="theme" aria-label="Search" readonly>
      </div>
      <div class="cmdk-list">
        <div class="cmdk-section">
          <div class="cmdk-section-title">工作区文件</div>
          <div class="cmdk-item selected">
            <div class="cmdk-item-main">
              <span class="cmdk-label">Prism theme regression.md</span>
              <span class="cmdk-cat">docs/verification</span>
            </div>
            <span class="cmdk-shortcut">↵</span>
          </div>
        </div>
      </div>
    </section>
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

async function collectMetrics(page, theme) {
  return page.evaluate(({ theme }) => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        color: style.color,
        background: style.backgroundColor,
      };
    };

    return {
      theme,
      body: read('body'),
      preview: read('.preview-compat'),
      write: read('#write'),
      editor: read('.cm-editor'),
      commandPalette: read('.cmdk'),
      statusbar: read('.statusbar'),
      diagnostics: read('.prism-diagnostics-popover'),
      hasPageHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      hasTallViewportOverflow: document.documentElement.scrollHeight > window.innerHeight + 2,
    };
  }, { theme: theme.id });
}

function formatMetricsTable(metrics) {
  return [
    '| Theme | Preview width | Editor height | Command palette width | Status bar height | Diagnostics visible | Body contrast | Diagnostics contrast | Page overflow |',
    '|---|---:|---:|---:|---:|---|---:|---:|---|',
    ...metrics.map((entry) => {
      const bodyContrast = entry.bodyContrast ?? 'n/a';
      const diagnosticsContrast = entry.diagnosticsContrast ?? 'n/a';
      const diagnosticsVisible = entry.diagnostics?.height > 80 ? 'yes' : 'no';
      const pageOverflow = entry.hasPageHorizontalOverflow ? 'horizontal' : 'no';
      return `| ${entry.theme} | ${entry.write?.width ?? 'n/a'} | ${entry.editor?.height ?? 'n/a'} | ${entry.commandPalette?.width ?? 'n/a'} | ${entry.statusbar?.height ?? 'n/a'} | ${diagnosticsVisible} | ${bodyContrast} | ${diagnosticsContrast} | ${pageOverflow} |`;
    }),
  ].join('\n');
}

const snapshotCss = `
html,
body {
  min-height: 100%;
  margin: 0;
  background: var(--bg-app, var(--c-canvas));
}

.theme-snapshot {
  min-height: 100vh;
  padding: 28px;
  background: var(--bg-app, var(--c-canvas));
  color: var(--c-void);
  font-family: var(--font-sans);
  box-sizing: border-box;
}

.theme-snapshot__header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}

.theme-snapshot__header h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}

.theme-snapshot__eyebrow {
  margin: 0 0 4px;
  color: var(--c-ash);
  font-size: 11px;
  letter-spacing: 0;
}

.theme-snapshot__chips {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.theme-snapshot__chips span,
.theme-snapshot__pane-title {
  border: 1px solid var(--c-fog);
  border-radius: var(--r-link);
  padding: 4px 8px;
  color: var(--c-graphite);
  background: color-mix(in srgb, var(--c-canvas) 86%, var(--c-chalk));
  font-size: 11px;
}

.theme-snapshot__grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 18px;
  align-items: start;
}

.theme-snapshot__pane {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--c-fog);
  border-radius: var(--r-card);
  background: var(--c-canvas);
  box-shadow: var(--shadow-card);
}

.theme-snapshot__pane-title {
  display: inline-flex;
  margin: 12px 12px 0;
}

.theme-snapshot__pane--editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 14px;
}

.theme-snapshot__pane--editor .cm-editor {
  height: 442px;
  margin: 12px 12px 0;
  border: 1px solid var(--c-fog);
  border-radius: 8px;
  overflow: hidden;
}

.theme-snapshot__pane--editor .cm-scroller {
  padding: 18px 0;
}

.theme-snapshot__pane--editor .cm-content {
  min-height: auto;
  padding: 0 24px;
}

.theme-snapshot__pane--preview {
  max-height: 842px;
  overflow: hidden;
}

.theme-snapshot__pane--preview .preview-compat {
  min-height: 780px;
  padding-top: 20px;
}

.theme-snapshot__pane--preview #write {
  padding-bottom: 120px;
}

.theme-snapshot .statusbar {
  margin: 0 12px;
  border: 1px solid var(--c-fog);
  border-radius: 8px;
  overflow: hidden;
}

.theme-snapshot__diagnostics {
  position: static;
  width: auto;
  max-width: none;
  max-height: none;
  margin: 0 12px;
  opacity: 1;
  visibility: visible;
  transform: none;
  pointer-events: auto;
  animation: none;
}

.theme-snapshot__diagnostics .sp-header {
  padding: 12px 14px;
}

.theme-snapshot__diagnostics .sp-header h2 {
  font-size: 14px;
}

.theme-snapshot__diagnostics .prism-link-diagnostics-body {
  padding: 8px;
}

.theme-snapshot__cmdk {
  position: static;
  transform: none;
  width: min(560px, 100%);
  max-width: none;
  margin: 18px auto 0;
  animation: none;
}

.katex-display {
  display: block;
  margin: 1.35em 0;
  text-align: center;
}

.katex {
  font-family: var(--font-mono);
}

.mermaid-placeholder {
  border: 1px dashed var(--c-fog);
  border-radius: 8px;
  padding: 18px;
}
`;

async function main() {
  if (!existsSync(fixturePath)) {
    throw new Error(`Missing fixture: ${fixturePath}`);
  }
  await mkdir(outputDir, { recursive: true });

  const [css, markdown] = await Promise.all([
    readSnapshotCss(),
    readFile(fixturePath, 'utf8'),
  ]);
  const bodyHtml = renderFixtureHtml(markdown);
  const editorSource = buildEditorSource(markdown);
  const browser = await chromium.launch();
  const metrics = [];
  const screenshots = [];

  try {
    for (const theme of themes) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const html = buildHtml(css, bodyHtml, editorSource, theme);
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts?.ready);
      const metric = await collectMetrics(page, theme);
      if (metric.body?.color && metric.body?.background) {
        metric.bodyContrast = contrastRatio(metric.body.color, metric.body.background);
      }
      if (metric.diagnostics?.color && metric.diagnostics?.background) {
        metric.diagnosticsContrast = contrastRatio(metric.diagnostics.color, metric.diagnostics.background);
      }
      metrics.push(metric);

      const screenshotName = `${theme.id}-theme-surface-1440.png`;
      const screenshotPath = path.join(outputDir, screenshotName);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      screenshots.push({ theme: theme.id, path: screenshotPath });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const report = `# Prism Theme Snapshots 2026-06-17

Generated by \`node scripts/run-theme-visual-snapshots.mjs\`.

Fixture: \`docs/verification/fixtures/prism-typography-fixture.md\`

Viewport: \`${viewport.width}x${viewport.height}\`

## Coverage

- Built-in themes: ${themes.map((theme) => `\`${theme.id}\``).join(', ')}
- Surfaces: preview, editor, command palette, status bar, export diagnostics popover.
- User theme CSS safety is still covered by \`src/domains/themes/themeCss.test.ts\`.

## Screenshots

${screenshots.map((shot) => `- ${shot.theme}: \`${path.relative(repoRoot, shot.path)}\``).join('\n')}

## Computed Metrics

${formatMetricsTable(metrics)}

## Review Notes

- \`Page overflow\` must stay \`no\`; a horizontal overflow means theme CSS is resizing fixed surfaces or wide content incorrectly.
- \`Diagnostics visible\` must stay \`yes\`; otherwise theme overrides may hide the export diagnostics surface.
- These screenshots are Playwright-rendered composite fixtures, not full Tauri WebView windows. Real macOS/Windows/Linux shell density remains covered by P2-06.
`;

  await writeFile(reportPath, report, 'utf8');
  console.log(JSON.stringify({
    report: path.relative(repoRoot, reportPath),
    screenshots: screenshots.map((shot) => path.relative(repoRoot, shot.path)),
    metrics,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
