import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'docs/verification/prism-shell-density-snapshots-2026-06-17');
const reportPath = path.join(outputDir, 'README.md');
const widths = [1200, 1440, 1920];
const platforms = ['macos', 'windows', 'linux'];
const themes = [
  { id: 'miaoyan', label: 'MiaoYan', dark: false },
  { id: 'nocturne', label: 'Nocturne', dark: true },
];

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

function prefixSelectors(css, scopeClass) {
  const normalized = css.replace(/:global\(([^)]+)\)/g, '$1');
  return normalized.replace(/(^|})\s*([^@{}][^{}]*)\{/g, (match, close, selector) => {
    const scoped = selector
      .split(',')
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        if (/^(html|body)(?:[\[.:#][^ ]*)?\s+/.test(trimmed)) {
          return trimmed.replace(/^((?:html|body)(?:[\[.:#][^ ]*)?)\s+/, `$1 ${scopeClass} `);
        }
        return `${scopeClass} ${trimmed}`;
      })
      .join(',\n');
    return `${close}\n${scoped} {`;
  });
}

async function readSnapshotCss() {
  const [
    globalCss,
    titleBarCss,
    menuBarCss,
    windowShellCss,
    statusBarCss,
    viewModeCss,
  ] = await Promise.all([
    readCssWithImports('global.css'),
    readFile(path.join(repoRoot, 'src/components/shell/TitleBar.module.css'), 'utf8'),
    readFile(path.join(repoRoot, 'src/components/shell/MenuBar.module.css'), 'utf8'),
    readFile(path.join(repoRoot, 'src/components/shell/WindowShell.module.css'), 'utf8'),
    readFile(path.join(repoRoot, 'src/domains/workspace/components/StatusBar.module.css'), 'utf8'),
    readFile(path.join(repoRoot, 'src/domains/document/components/ViewModeSwitch.module.css'), 'utf8'),
  ]);
  return [
    globalCss,
    prefixSelectors(windowShellCss, '.ws-scope'),
    prefixSelectors(titleBarCss, '.tb-scope'),
    prefixSelectors(menuBarCss, '.mb-scope'),
    prefixSelectors(statusBarCss, '.sb-scope'),
    prefixSelectors(viewModeCss, '.vms-scope'),
    snapshotCss,
  ].join('\n');
}

function iconSvg(label = '') {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 7h6M7 10h6M7 13h4"/></svg><span class="sr-only">${label}</span>`;
}

function windowButtons() {
  return `
    <div class="controls">
      <button class="btn" aria-label="Minimize"><svg viewBox="0 0 12 12"><path d="M2.5 6h7"/></svg></button>
      <button class="btn" aria-label="Maximize"><svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7"/></svg></button>
      <button class="btn close" aria-label="Close"><svg viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg></button>
    </div>`;
}

function viewModeSwitch(flushStart = false) {
  return `
    <div class="vms-scope">
      <div class="container ${flushStart ? 'flushStart' : ''}" data-surface="view-mode-switch">
        <button class="btn">${iconSvg('Edit')}</button>
        <button class="btn active">${iconSvg('Split')}</button>
        <button class="btn">${iconSvg('Preview')}</button>
      </div>
    </div>`;
}

function titleBar(platform) {
  const macos = platform === 'macos';
  if (macos) {
    return `
      <div class="tb-scope">
        <div class="titlebar macos app-titlebar" data-surface="titlebar">
          <div class="brand">
            <div class="logo">P</div>
            <div class="titleGroup">
              <div class="title">
                <span class="docName">Prism shell density</span>
                <span class="saveBadge dirty"><span class="saveBadgeDot"></span><span class="saveBadgeLabel">未保存</span></span>
                <span class="sep">-</span>
                <span class="app">Prism</span>
              </div>
            </div>
          </div>
          ${viewModeSwitch(false)}
        </div>
      </div>`;
  }

  return `
    <div class="tb-scope">
      <div class="titlebar windows app-titlebar" data-surface="titlebar">
        <div class="windowsTitleCluster" data-titlebar-section="windows-title-cluster">
          ${viewModeSwitch(true)}
          <div class="titleGroup windowsTitleGroup">
            <div class="title windowsTitle">
              <span class="docName">Prism shell density</span>
              <span class="saveBadge dirty"><span class="saveBadgeDot"></span><span class="saveBadgeLabel">未保存</span></span>
            </div>
          </div>
        </div>
        <div class="windowsDragSpacer"></div>
        ${windowButtons()}
      </div>
    </div>`;
}

function menuBar() {
  const items = ['文件', '编辑', '视图', '插入', '格式', '导航', '导出', '帮助'];
  return `
    <div class="mb-scope">
      <nav class="menubar" data-surface="menubar">
        ${items.map((item, index) => `<div class="menuItemWrapper"><button class="menuItem ${index === 2 ? 'active' : ''}">${item}</button></div>`).join('')}
        <div class="spacer"></div>
        <div class="actions">
          <button class="pillGhost">工作区</button>
          <button class="pillFilled">导出</button>
        </div>
      </nav>
    </div>`;
}

function sidebar() {
  return `
    <aside class="app-sidebar sidebar shell-sidebar" data-surface="sidebar">
      <div class="sidebar-tabs">
        <button class="sidebar-tab-button" data-active="true">文件</button>
        <button class="sidebar-tab-button">大纲</button>
        <button class="sidebar-tab-button">链接</button>
      </div>
      <div class="file-tree-directory">
        <span class="file-tree-caret">▾</span>
        <span class="file-tree-directory-name">Prism Notes</span>
      </div>
      <div class="file-tree-item is-active" data-active="true">
        <span class="file-name">shell-density.md</span>
        <span class="file-tree-preview">跨平台壳层与控件密度审查</span>
      </div>
      <div class="file-tree-item">
        <span class="file-name">theme-regression.md</span>
        <span class="file-tree-preview">主题截图回归</span>
      </div>
    </aside>`;
}

function editorPreview() {
  return `
    <section class="shell-document" data-surface="document">
      <div class="shell-toolbar">
        <span>当前文档</span>
        ${viewModeSwitch(false)}
      </div>
      <div class="shell-split">
        <div class="cm-editor cm-focused">
          <div class="cm-scroller">
            <div class="cm-content">
              <div class="cm-line cm-md-heading"># Prism shell density</div>
              <div class="cm-line">跨平台写作器的壳层需要在 macOS / Windows / Linux 上保持相同的信息密度。</div>
              <div class="cm-line cm-md-list-marker">- 标题栏只承担窗口 chrome 和文件保存反馈。</div>
              <div class="cm-line cm-md-list-marker">- 菜单、侧栏、状态栏和视图切换保持同一套尺寸规则。</div>
              <div class="cm-line cm-md-quote">&gt; 平台差异只保留在系统 chrome 与系统菜单行为。</div>
            </div>
          </div>
        </div>
        <article class="preview-compat preview-compat--miaoyan shell-preview">
          <div id="write" class="markdown-body heti">
            <h1>Prism shell density</h1>
            <p>跨平台写作器的壳层需要在 macOS / Windows / Linux 上保持相同的信息密度。标题栏、菜单、侧栏、状态栏和视图切换不应因为主题而改变基本结构。</p>
            <h2>检查点</h2>
            <ul>
              <li>标题栏高度稳定，保存状态不挤压文档名。</li>
              <li>菜单和状态栏密度一致。</li>
              <li>侧栏宽度在不同平台属性下不漂移。</li>
            </ul>
          </div>
        </article>
      </div>
    </section>`;
}

function statusBar() {
  return `
    <div class="sb-scope">
      <div class="statusbar" data-surface="statusbar">
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
            <span class="exportStatus exportStatusSuccess"><span class="exportStatusText">导出完成</span></span>
          </div>
        </div>
      </div>
    </div>`;
}

function buildHtml(css, platform, theme, width) {
  const platformAttr = platform === 'macos' ? 'mac' : platform;
  return `<!doctype html>
<html lang="zh-CN" data-content-theme="${theme.id}" data-platform="${platformAttr}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prism Shell Density - ${platform} - ${theme.label} - ${width}</title>
  <style>${css}</style>
</head>
<body class="${theme.dark ? 'dark' : ''}">
  <div class="ws-scope">
    <main class="windowShell shell-snapshot" data-platform-label="${platform}" data-theme-label="${theme.id}">
      <div class="shell-meta">
        <span>${platform}</span>
        <span>${theme.id}</span>
        <span>${width}px</span>
      </div>
      ${titleBar(platform)}
      ${menuBar()}
      <div class="shell-content">
        ${sidebar()}
        ${editorPreview()}
      </div>
      ${statusBar()}
    </main>
  </div>
</body>
</html>`;
}

async function collectMetrics(page, platform, theme, width) {
  return page.evaluate(({ platform, theme, width }) => {
    const rectFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        top: Math.round(rect.top * 10) / 10,
        left: Math.round(rect.left * 10) / 10,
      };
    };

    return {
      platform,
      theme,
      viewportWidth: width,
      titlebar: rectFor('[data-surface="titlebar"]'),
      menubar: rectFor('[data-surface="menubar"]'),
      sidebar: rectFor('[data-surface="sidebar"]'),
      document: rectFor('[data-surface="document"]'),
      statusbar: rectFor('[data-surface="statusbar"]'),
      viewSwitch: rectFor('[data-surface="view-mode-switch"]'),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      verticalOverflow: document.documentElement.scrollHeight > window.innerHeight + 2,
    };
  }, { platform, theme: theme.id, width });
}

function formatMetricsTable(metrics) {
  return [
    '| Platform | Theme | Width | Titlebar | Menubar | Sidebar | Statusbar | View switch top | Overflow |',
    '|---|---|---:|---:|---:|---:|---:|---:|---|',
    ...metrics.map((entry) => (
      `| ${entry.platform} | ${entry.theme} | ${entry.viewportWidth} | ${entry.titlebar?.height ?? 'n/a'} | ${entry.menubar?.height ?? 'n/a'} | ${entry.sidebar?.width ?? 'n/a'} | ${entry.statusbar?.height ?? 'n/a'} | ${entry.viewSwitch?.top ?? 'n/a'} | ${entry.horizontalOverflow ? 'horizontal' : 'no'} |`
    )),
  ].join('\n');
}

const snapshotCss = `
html,
body {
  margin: 0;
  min-height: 100%;
  background: var(--bg-app, var(--c-canvas));
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
  overflow: hidden;
}

.ws-scope {
  min-height: 100vh;
  background: var(--bg-app, var(--c-canvas));
}

.shell-snapshot {
  width: 100vw;
  min-height: 860px;
  color: var(--c-void);
}

.shell-meta {
  position: fixed;
  top: 8px;
  right: 10px;
  z-index: 10;
  display: flex;
  gap: 6px;
}

.shell-meta span {
  padding: 4px 7px;
  border: 1px solid var(--c-fog);
  border-radius: 6px;
  background: color-mix(in srgb, var(--c-canvas) 88%, var(--c-chalk));
  color: var(--c-graphite);
  font-size: 11px;
}

.tb-scope,
.mb-scope,
.sb-scope,
.vms-scope {
  display: contents;
}

.shell-content {
  display: grid;
  grid-template-columns: var(--sidebar-w, 280px) minmax(0, 1fr);
  min-height: 728px;
  border-top: 0;
}

.shell-sidebar {
  min-height: 728px;
  border-right: 1px solid var(--c-fog);
  background: var(--bg-sidebar, var(--c-canvas));
  box-sizing: border-box;
  padding: 12px 10px;
}

.shell-sidebar .sidebar-tabs {
  margin-bottom: 14px;
}

.shell-sidebar .file-tree-item,
.shell-sidebar .file-tree-directory {
  min-height: 30px;
}

.shell-document {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-editor, var(--c-canvas));
}

.shell-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 18px;
  border-bottom: 1px solid var(--c-fog);
  color: var(--c-graphite);
  font-size: 12px;
}

.shell-toolbar .vms-scope .container {
  transform: none;
  margin-left: 0;
}

.shell-split {
  display: grid;
  grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.06fr);
  gap: 0;
  flex: 1;
  min-height: 0;
}

.shell-split .cm-editor {
  height: 686px;
  border-right: 1px solid var(--c-fog);
}

.shell-split .cm-scroller {
  padding: 26px 0;
}

.shell-split .cm-content {
  padding: 0 34px;
}

.shell-preview {
  height: 686px;
  overflow: hidden;
  padding: 30px 0 0;
}

.shell-preview #write {
  max-width: min(760px, calc(100% - 64px));
  padding-bottom: 80px;
}
`;

async function main() {
  await mkdir(outputDir, { recursive: true });
  const css = await readSnapshotCss();
  const browser = await chromium.launch();
  const metrics = [];
  const screenshots = [];

  try {
    for (const platform of platforms) {
      for (const theme of themes) {
        for (const width of widths) {
          const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
          await page.setContent(buildHtml(css, platform, theme, width), { waitUntil: 'load' });
          await page.evaluate(() => document.fonts?.ready);
          const metric = await collectMetrics(page, platform, theme, width);
          metrics.push(metric);
          const screenshotName = `${platform}-${theme.id}-${width}.png`;
          const screenshotPath = path.join(outputDir, screenshotName);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          screenshots.push({ platform, theme: theme.id, width, path: screenshotPath });
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  const report = `# Prism Shell Density Snapshots 2026-06-17

Generated by \`node scripts/run-shell-density-snapshots.mjs\`.

## Coverage

- Simulated platforms: ${platforms.map((platform) => `\`${platform}\``).join(', ')}.
- Themes: ${themes.map((theme) => `\`${theme.id}\``).join(', ')}.
- Widths: ${widths.map((width) => `\`${width}px\``).join(', ')}.
- Surfaces: titlebar, menubar, sidebar, view mode switch, editor/preview split, status bar.

## Screenshots

${screenshots.map((shot) => `- ${shot.platform} / ${shot.theme} / ${shot.width}px: \`${path.relative(repoRoot, shot.path)}\``).join('\n')}

## Computed Metrics

${formatMetricsTable(metrics)}

## Review Notes

- This is a simulated platform matrix rendered in Playwright through \`data-platform\`, not a Windows/Linux true-machine capture.
- \`Overflow\` must stay \`no\`; titlebar, menubar, sidebar, view switch, and statusbar should not push the page horizontally at 1200px.
- The expected platform difference is window chrome: macOS omits custom window controls, Windows/Linux use the non-mac title cluster and window controls.
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
