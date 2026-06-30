import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = '/Users/Alex/AI/project/Prism';
const runDir = path.join(repoRoot, 'docs/verification/runs/prism-full-functional-2026-06-27');
const screenshotRoot = path.join(runDir, 'screenshots');
const exportRoot = path.join(runDir, 'exports');
const workspaceRoot = '/tmp/prism-full-functional-test-workspace';
const guidePath = path.join(workspaceRoot, 'Examples/Prism Markdown 语法指南.md');
const invalidFrontMatterPath = path.join(workspaceRoot, 'notes/invalid-frontmatter.md');
const safeHtmlPath = path.join(workspaceRoot, 'notes/safe-html.md');
const slidesPath = path.join(workspaceRoot, 'notes/presentation-slides.md');
const typographyPath = path.join(workspaceRoot, 'notes/typography-issues.md');
const appDataDir = path.join(runDir, 'mock-app-data');
const defaultSettingsPath = path.join(appDataDir, 'config.json');
const scratchFilePattern = /^Untitled(?: \(\d+\))?\.md$/;

const textExtensions = new Set([
  'md', 'markdown', 'txt', 'text', 'sql', 'json', 'jsonc', 'yaml', 'yml', 'toml',
  'xml', 'csv', 'tsv', 'log', 'ini', 'conf', 'env',
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanupMutableFixtures() {
  if (fs.existsSync(guidePath)) {
    const content = fs.readFileSync(guidePath, 'utf8');
    const cleaned = content
      .replace(/\n\/markmap(?:\/markmap)*\n(?=## 标题格式)/g, '\n')
      .replace(/\n\/markmap(?:\/markmap)*$/g, '\n');
    if (cleaned !== content) fs.writeFileSync(guidePath, cleaned);
  }

  const examplesDir = path.join(workspaceRoot, 'Examples');
  if (!fs.existsSync(examplesDir)) return;
  for (const entry of fs.readdirSync(examplesDir)) {
    if (scratchFilePattern.test(entry)) {
      fs.rmSync(path.join(examplesDir, entry), { force: true });
    }
  }
}

function writeDefaultSettings() {
  fs.writeFileSync(defaultSettingsPath, JSON.stringify({
    settingsVersion: 1,
    locale: 'zh-CN',
    theme: 'light',
    contentTheme: 'miaoyan',
    fontSize: 15,
    editorFontFamily: 'Cascadia Code, Consolas, monospace',
    editorLineHeight: 1.72,
    previewFontFamily: 'inherit',
    previewFontSize: 15,
    defaultViewMode: 'edit',
    autoSaveEnabled: false,
    showLineNumbers: false,
    wordWrap: true,
    exportDefaults: { format: 'pdf', pngScale: 4, htmlIncludeTheme: true },
    recentFiles: [],
  }, null, 2));
}

function ensureBaseFixtures() {
  const sourceInitialDir = '/Users/Alex/Documents/Prism';
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
  ensureDir(workspaceRoot);
  if (fs.existsSync(sourceInitialDir)) {
    fs.cpSync(sourceInitialDir, workspaceRoot, { recursive: true });
  } else {
    ensureDir(path.dirname(guidePath));
    fs.writeFileSync(guidePath, `# Prism Markdown 语法指南\n\n以《洛神赋》之美，展现 Markdown 之妙。\n\n## 文本格式\n\n**加粗**、*斜体*、\`inline code\`。\n\n## 图表\n\n\`\`\`mermaid\ngraph TD\n  A[Prism] --> B[Preview]\n\`\`\`\n`);
  }

  ensureDir(path.join(workspaceRoot, 'notes'));
  fs.writeFileSync(path.join(workspaceRoot, 'data.json'), JSON.stringify({
    app: 'Prism',
    type: 'json fixture',
    values: [1, 2, 3],
  }, null, 2));
  fs.writeFileSync(path.join(workspaceRoot, 'query.sql'), 'select id, title from notes where title like "%Prism%";\n');
  fs.writeFileSync(path.join(workspaceRoot, 'plain.txt'), 'Plain text fixture for Prism full functional testing.\n');
  fs.writeFileSync(path.join(workspaceRoot, 'unsupported.ts'), 'export const unsupported = true;\n');
  fs.writeFileSync(path.join(workspaceRoot, 'notes/linked-note.md'), '# linked-note\n\nThis note is linked from the guide.\n');
  fs.writeFileSync(path.join(workspaceRoot, 'notes/backlink-source.md'), `# Backlink Source\n\nSee [[Prism Markdown 语法指南]] and ../Examples/Prism Markdown 语法指南.md.\n`);
  fs.writeFileSync(path.join(workspaceRoot, 'notes/broken-links.md'), `# Broken Links\n\n[Missing heading](#missing-heading)\n\n![Missing image](./assets/missing.png)\n\n\`\`\`mermaid\ngraph TD\n  A -->\n\`\`\`\n\n\`\`\`plantuml\n@startuml\nAlice -> Bob: broken fixture\n@enduml\n\`\`\`\n`);
  fs.writeFileSync(path.join(workspaceRoot, 'notes/long.md'), [
    '# Long Document',
    '',
    ...Array.from({ length: 120 }, (_, index) => `## Section ${index + 1}\n\n这是长文档第 ${index + 1} 段，用于验证滚动、预览性能、标题、大纲和搜索。English words and $a+b=c$ are included.\n`),
  ].join('\n'));
}

function ensureSupplementalFixtures() {
  ensureDir(path.dirname(invalidFrontMatterPath));
  fs.writeFileSync(invalidFrontMatterPath, `---\ntitle: Invalid Front Matter\ntags: [broken\n---\n\n# Invalid Front Matter\n\n这个文档用于验证非法 YAML 的属性面板和预览反馈。\n`);
  fs.writeFileSync(safeHtmlPath, `# Safe HTML Fixture\n\n<script>alert('blocked')</script>\n\n<div onclick=\"alert('blocked')\">普通 HTML 容器应该保留，但危险属性应被清理。</div>\n\n<details open>\n<summary>安全折叠块</summary>\n安全内容可见。\n</details>\n`);
  fs.writeFileSync(slidesPath, `# Prism 演示模式\n\n第一页用于验证演示预览。\n\n---\n\n# 第二页\n\n- 支持 Markdown\n- 支持列表\n- 支持主题\n\n---\n\n# 第三页\n\n演示模式截图证据。\n`);
  fs.writeFileSync(typographyPath, `# Typography Issues\n\n中文English之间没有空格, 并且使用了半角标点.\n\n\n\n#### 跳级标题\n\n这里用于触发排版建议。\n`);
}

function statDto(filePath) {
  const stat = fs.statSync(filePath);
  return {
    isFile: stat.isFile(),
    isDirectory: stat.isDirectory(),
    isSymlink: stat.isSymbolicLink(),
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    atime: stat.atime.toISOString(),
    birthtime: stat.birthtime.toISOString(),
    readonly: false,
  };
}

function snapshot(filePath) {
  const stat = fs.statSync(filePath);
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}

function extname(filePath) {
  const base = path.basename(filePath);
  if (base === '.env') return 'env';
  return path.extname(base).replace(/^\./, '').toLowerCase();
}

function isSupported(filePath) {
  return textExtensions.has(extname(filePath));
}

function extractPreview(content) {
  return content
    .replace(/^---[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[\s>*+-]+/gm, '')
    .replace(/[~*_`$]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 100);
}

function buildTree(root, includePreview = false, depth = 0) {
  if (depth > 8) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || (entry.isFile() && isSupported(entry.name)))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        const children = buildTree(fullPath, includePreview, depth + 1);
        if (!children.length) return null;
        return { path: fullPath, name: entry.name, kind: 'directory', children };
      }
      const stat = fs.statSync(fullPath);
      const content = includePreview ? fs.readFileSync(fullPath, 'utf8') : '';
      return {
        path: fullPath,
        name: entry.name,
        kind: 'file',
        preview: includePreview ? extractPreview(content) : '',
        size: stat.size,
        createdAt: stat.birthtimeMs,
        modifiedAt: stat.mtimeMs,
      };
    })
    .filter(Boolean);
}

function findFiles(root) {
  const results = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(fullPath));
    else if (isSupported(fullPath)) results.push(fullPath);
  }
  return results;
}

function buildIndex(root) {
  return findFiles(root).map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return { path: filePath, name: path.basename(filePath), content };
  });
}

function linkTargets(root, query = '', limit = 20) {
  const q = query.toLowerCase();
  return buildIndex(root)
    .filter((item) => item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q))
    .slice(0, limit)
    .map((item) => ({
      path: item.path,
      title: item.name.replace(/\.(md|markdown)$/i, ''),
      label: item.name,
      kind: 'file',
    }));
}

function queryIndex(root, query, mode, limit) {
  const q = query.toLowerCase();
  return buildIndex(root)
    .flatMap((item) => {
      const haystack = `${item.name}\n${item.content}`.toLowerCase();
      if (q && !haystack.includes(q)) return [];
      const firstLine = item.content.split('\n').find((line) => line.trim()) ?? '';
      return [{
        path: item.path,
        name: item.name,
        title: item.name,
        preview: firstLine.slice(0, 160),
        score: item.name.toLowerCase().includes(q) ? 10 : 1,
        mode,
      }];
    })
    .slice(0, limit);
}

function relationGraph(root, currentPath) {
  const docs = buildIndex(root).filter((item) => /\.(md|markdown)$/i.test(item.name));
  const nodes = docs.slice(0, 16).map((item) => ({
    id: item.path,
    path: item.path,
    label: item.name.replace(/\.(md|markdown)$/i, ''),
    title: item.name,
    current: item.path === currentPath,
  }));
  const edges = [];
  for (const item of docs) {
    for (const target of docs) {
      if (item.path === target.path) continue;
      const stem = target.name.replace(/\.(md|markdown)$/i, '');
      if (item.content.includes(`[[${stem}`) || item.content.includes(target.name)) {
        edges.push({ source: item.path, target: target.path, label: 'link' });
      }
    }
  }
  return { nodes, edges };
}

function backlinks(root, targetPath) {
  const stem = path.basename(targetPath).replace(/\.(md|markdown)$/i, '');
  return buildIndex(root)
    .filter((item) => item.path !== targetPath && (item.content.includes(stem) || item.content.includes(path.basename(targetPath))))
    .map((item) => ({
      path: item.path,
      name: item.name,
      title: item.name,
      preview: extractPreview(item.content),
      line: 1,
    }));
}

function installMockInitScript(page) {
  page.addInitScript(({ workspaceRoot, guidePath, appDataDir, exportRoot, defaultSettingsPath }) => {
    const callbacks = new Map();
    let callbackId = 1;
    window.__PRISM_TEST_MOCK__ = {
      workspaceRoot,
      guidePath,
      appDataDir,
      exportRoot,
      defaultSettingsPath,
      calls: [],
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener() {},
    };
    window.__TAURI_INTERNALS__ = {
      transformCallback(callback, once = false) {
        const id = callbackId++;
        callbacks.set(id, { callback, once });
        return id;
      },
      unregisterCallback(id) {
        callbacks.delete(id);
      },
      convertFileSrc(filePath) {
        if (String(filePath).startsWith('http')) return filePath;
        return `file://${filePath}`;
      },
      async invoke(cmd, args = {}) {
        window.__PRISM_TEST_MOCK__.calls.push({ cmd, args });
        if (cmd === 'plugin:event|listen') return callbackId++;
        if (cmd === 'plugin:event|unlisten' || cmd === 'plugin:event|emit' || cmd === 'plugin:event|emit_to') return null;
        if (cmd.startsWith('plugin:window|')) {
          if (cmd.endsWith('|is_visible') || cmd.endsWith('|is_focused') || cmd.endsWith('|is_resizable')) return true;
          if (cmd.endsWith('|inner_size') || cmd.endsWith('|outer_size')) return { width: 1440, height: 960 };
          if (cmd.endsWith('|scale_factor')) return 1;
          if (cmd.endsWith('|theme')) return 'light';
          return null;
        }
        if (cmd === 'reveal_current_window') return null;
        if (cmd === 'get_pending_files') {
          const explicitFile = new URL(window.location.href).searchParams.get('file');
          return [explicitFile || guidePath];
        }
        if (cmd === 'get_pending_workspace_path') return workspaceRoot;
        if (cmd === 'plugin:path|resolve_directory') {
          const directory = args.directory;
          if (directory === 6) return '/Users/Alex/Documents';
          if (directory === 7) return '/Users/Alex/Downloads';
          if (directory === 12) return '/tmp';
          if (directory === 14) return appDataDir;
          if (directory === 21) return '/Users/Alex';
          return '/tmp';
        }
        if (cmd === 'plugin:opener|open_url' || cmd === 'plugin:opener|open_path' || cmd === 'plugin:opener|reveal_item_in_dir') return null;
        if (cmd === 'plugin:dialog|open') return null;
        if (cmd === 'plugin:dialog|save') return `${exportRoot}/mock-export`;
        if (cmd === 'plugin:dialog|message') return null;
        if (cmd === 'plugin:updater|check') return null;
        throw new Error(`Unhandled mock command: ${cmd}`);
      },
    };
  }, { workspaceRoot, guidePath, appDataDir, exportRoot, defaultSettingsPath });
}

async function exposeNodeBridge(page) {
  await page.exposeFunction('__prismNodeInvoke', async (cmd, args = {}) => {
    if (cmd === 'read_settings_file') {
      if (!fs.existsSync(defaultSettingsPath)) return null;
      return fs.readFileSync(defaultSettingsPath, 'utf8');
    }
    if (cmd === 'write_settings_file') {
      ensureDir(path.dirname(defaultSettingsPath));
      fs.writeFileSync(defaultSettingsPath, args.content ?? args.value ?? '{}');
      return null;
    }
    if (cmd === 'read_legacy_settings_config') return null;
    if (cmd === 'plugin:fs|exists') return fs.existsSync(args.path);
    if (cmd === 'plugin:fs|stat' || cmd === 'plugin:fs|lstat') return statDto(args.path);
    if (cmd === 'plugin:fs|read_text_file') return fs.readFileSync(args.path, 'utf8');
    if (cmd === 'plugin:fs|read_file') return Array.from(fs.readFileSync(args.path));
    if (cmd === 'plugin:fs|read_dir') {
      return fs.readdirSync(args.path, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        isSymlink: entry.isSymbolicLink(),
      }));
    }
    if (cmd === 'plugin:fs|write_text_file') {
      ensureDir(path.dirname(args.path));
      const data = Array.isArray(args.data) ? Buffer.from(args.data).toString('utf8') : String(args.data ?? '');
      fs.writeFileSync(args.path, data);
      return null;
    }
    if (cmd === 'plugin:fs|write_file') {
      ensureDir(path.dirname(args.path));
      fs.writeFileSync(args.path, Buffer.from(args.data ?? []));
      return null;
    }
    if (cmd === 'plugin:fs|mkdir') {
      fs.mkdirSync(args.path, { recursive: Boolean(args.options?.recursive) });
      return null;
    }
    if (cmd === 'plugin:fs|rename') {
      fs.renameSync(args.oldPath, args.newPath);
      return null;
    }
    if (cmd === 'plugin:fs|remove') {
      fs.rmSync(args.path, { recursive: true, force: true });
      return null;
    }
    if (cmd === 'plugin:fs|copy_file') {
      fs.copyFileSync(args.fromPath, args.toPath);
      return null;
    }
    if (cmd === 'get_file_snapshot') return snapshot(args.path);
    if (cmd === 'read_document_file') {
      if (!isSupported(args.path)) {
        throw { code: 'unsupported_file_type', message: 'Only Markdown / Text documents are supported' };
      }
      return {
        path: args.path,
        name: path.basename(args.path),
        content: fs.readFileSync(args.path, 'utf8'),
        knownSnapshot: snapshot(args.path),
      };
    }
    if (cmd === 'write_document_file') {
      const input = args.input;
      ensureDir(path.dirname(input.path));
      fs.writeFileSync(input.path, input.content ?? '');
      return { path: input.path, snapshot: snapshot(input.path) };
    }
    if (cmd === 'load_workspace_tree') return buildTree(args.rootPath, Boolean(args.options?.includePreview));
    if (cmd === 'build_workspace_index') return { jobId: 'mock-index', message: 'ready', status: 'ready' };
    if (cmd === 'start_workspace_index_job') return { jobId: 'mock-index', message: 'ready', status: 'ready' };
    if (cmd === 'get_workspace_index_job') return { jobId: args.jobId, message: 'ready', status: 'ready' };
    if (cmd === 'query_workspace_index') {
      const input = args.input;
      return { results: queryIndex(input.rootPath, input.query ?? '', input.mode ?? 'quickOpen', input.limit ?? 20) };
    }
    if (cmd === 'query_workspace_backlinks') return { results: backlinks(workspaceRoot, args.input.path) };
    if (cmd === 'query_workspace_relation_graph') return relationGraph(workspaceRoot, args.input.currentPath);
    if (cmd === 'query_workspace_link_targets') {
      return { results: linkTargets(workspaceRoot, args.input.query ?? '', args.input.limit ?? 20) };
    }
    if (cmd === 'grant_markdown_file_scope' || cmd === 'grant_workspace_directory_scope') return null;
    if (cmd === 'open_path_with_system') return null;
    if (cmd === 'detect_pandoc') return { status: 'ready', path: '/usr/local/bin/pandoc', version: 'pandoc mock' };
    if (cmd === 'preflight_export') return { ok: true, issues: [] };
    if (cmd === 'create_export_job') return { id: 'mock-export-job', status: 'running' };
    if (cmd === 'update_export_job' || cmd === 'complete_export_job' || cmd === 'fail_export_job' || cmd === 'cancel_export_job') return null;
    if (cmd === 'get_export_job') return { id: args.id, status: 'completed' };
    if (cmd === 'list_export_jobs') return [];
    if (cmd === 'get_pdf_capture_capability') return { available: false };
    if (cmd === 'capture_current_webview_pdf') throw new Error('mock pdf capture unavailable');
    if (cmd === 'scan_installed_themes') return [];
    if (cmd === 'get_themes_directory') return path.join(appDataDir, 'themes');
    if (cmd === 'read_theme_package_source') return '';
    if (cmd === 'delete_user_theme' || cmd === 'open_themes_directory') return null;
    throw new Error(`Unhandled node mock command: ${cmd}`);
  });
  await page.addInitScript(() => {
    const originalInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async (cmd, args = {}, options) => {
      try {
        return await originalInvoke(cmd, args, options);
      } catch (error) {
        if (String(error?.message ?? error).startsWith('Unhandled mock command:')) {
          return window.__prismNodeInvoke(cmd, args);
        }
        throw error;
      }
    };
  });
}

async function clickText(page, text, options = {}) {
  const target = page.getByText(text, { exact: options.exact ?? false }).first();
  await target.waitFor({ state: 'visible', timeout: options.timeout ?? 5000 });
  await target.click({ force: true });
}

async function screenshot(page, relPath) {
  const fullPath = path.join(runDir, relPath);
  ensureDir(path.dirname(fullPath));
  await page.screenshot({ path: fullPath, fullPage: false });
}

async function screenshotSelector(page, selector, relPath) {
  const fullPath = path.join(runDir, relPath);
  ensureDir(path.dirname(fullPath));
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 5000 });
  await locator.screenshot({ path: fullPath });
}

async function scrollPreviewToText(page, text) {
  await page.evaluate((needle) => {
    const write = document.querySelector('#write');
    if (!write) return false;
    const targets = [...write.querySelectorAll('h1,h2,h3,h4,p,li,table,pre,blockquote,section,div')];
    const target = targets.find((element) => element.textContent?.includes(needle));
    target?.scrollIntoView({ block: 'center', inline: 'nearest' });
    return Boolean(target);
  }, text);
  await page.waitForTimeout(900);
}

async function scrollPreviewToSelector(page, selector, index = 0) {
  await page.evaluate(({ selector: targetSelector, index: targetIndex }) => {
    const targets = [...document.querySelectorAll(targetSelector)];
    targets[targetIndex]?.scrollIntoView({ block: 'center', inline: 'nearest' });
    return targets.length;
  }, { selector, index });
  await page.waitForTimeout(900);
}

async function setPreviewScrollRatio(page, ratio) {
  await page.evaluate((scrollRatio) => {
    const write = document.querySelector('#write');
    if (!write) return;
    const candidates = [...document.querySelectorAll('*'), document.scrollingElement]
      .filter(Boolean)
      .filter((element) => element.contains?.(write))
      .map((element) => ({
        element,
        scrollable: Math.max(0, element.scrollHeight - element.clientHeight),
      }))
      .filter((item) => item.scrollable > 24)
      .sort((a, b) => b.scrollable - a.scrollable);
    const preview = candidates[0]?.element;
    if (!preview) return;
    preview.scrollTop = Math.max(0, Math.min(1, scrollRatio)) * Math.max(0, preview.scrollHeight - preview.clientHeight);
  }, ratio);
  await page.waitForTimeout(900);
}

async function focusEditorAt(page, x = 360, y = 150) {
  await page.mouse.click(x, y).catch(() => {});
  await page.waitForTimeout(250);
}

async function waitForApp(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2800);
}

async function openApp(page, filePath = guidePath) {
  const url = `http://localhost:5173/?file=${encodeURIComponent(filePath)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);
}

async function switchView(page, mode) {
  const x = mode === 'edit' ? 1349 : mode === 'split' ? 1381 : 1413;
  await page.mouse.click(x, 31);
  await page.waitForTimeout(1000);
}

async function clickMenu(page, label) {
  const target = page.getByText(label, { exact: true }).first();
  await target.waitFor({ state: 'visible', timeout: 3500 });
  await target.click({ force: true });
  await page.waitForTimeout(600);
}

async function runCommand(page, action) {
  await page.evaluate((commandAction) => {
    window.dispatchEvent(new CustomEvent('prism-command', { detail: { action: commandAction } }));
  }, action);
  await page.waitForTimeout(900);
}

async function emitAppEvent(page, eventName, detail) {
  await page.evaluate(({ name, payload }) => {
    window.dispatchEvent(new CustomEvent(name, { detail: payload }));
  }, { name: eventName, payload: detail });
  await page.waitForTimeout(700);
}

async function openSettingsSection(page, section) {
  await page.evaluate((sectionId) => {
    window.dispatchEvent(new CustomEvent('prism-open-settings', { detail: { section: sectionId } }));
  }, section);
  await page.waitForTimeout(900);
}

async function closeTopLayer(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('.modal-close').last().click({ force: true, timeout: 1200 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function tryMenuScreenshot(page, label, relPath) {
  try {
    await clickMenu(page, label);
    await screenshot(page, relPath);
    await page.keyboard.press('Escape').catch(() => {});
    return true;
  } catch (error) {
    fs.appendFileSync(path.join(runDir, 'logs/menu-skip.log'), `${label}: ${error.message}\n`);
    return false;
  }
}

async function tryClickTextScreenshot(page, label, relPath) {
  try {
    const target = page.getByText(label, { exact: false }).first();
    await target.waitFor({ state: 'visible', timeout: 3500 });
    await target.click({ force: true });
    await page.waitForTimeout(800);
    await screenshot(page, relPath);
    return true;
  } catch (error) {
    fs.appendFileSync(path.join(runDir, 'logs/click-skip.log'), `${label}: ${error.message}\n`);
    return false;
  }
}

async function tryCommandScreenshot(page, action, relPath) {
  try {
    await runCommand(page, action);
    await screenshot(page, relPath);
    return true;
  } catch (error) {
    fs.appendFileSync(path.join(runDir, 'logs/command-skip.log'), `${action}: ${error.message}\n`);
    return false;
  }
}

async function tryClickSelectorScreenshot(page, selector, relPath) {
  try {
    const target = page.locator(selector).first();
    await target.waitFor({ state: 'visible', timeout: 3500 });
    await target.click({ force: true });
    await page.waitForTimeout(1000);
    await screenshot(page, relPath);
    return true;
  } catch (error) {
    fs.appendFileSync(path.join(runDir, 'logs/click-skip.log'), `${selector}: ${error.message}\n`);
    return false;
  }
}

async function captureTheme(page, themeId, relPath) {
  await runCommand(page, `setTheme:${encodeURIComponent(themeId)}`);
  await switchView(page, 'preview');
  await page.waitForTimeout(900);
  await screenshot(page, relPath);
}

async function logInteractiveElements(page, name) {
  const elements = await page.evaluate(() => [...document.querySelectorAll('button,[role="button"],input,textarea,[aria-label]')]
    .slice(0, 240)
    .map((el) => ({
      tag: el.tagName,
      text: el.textContent?.trim().slice(0, 80) ?? '',
      aria: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      role: el.getAttribute('role'),
      cls: el.className?.toString().slice(0, 120),
    })));
  fs.writeFileSync(path.join(runDir, `logs/elements-${name}.json`), JSON.stringify(elements, null, 2));
}

async function run() {
  ensureDir(screenshotRoot);
  ensureDir(exportRoot);
  ensureDir(appDataDir);
  ensureBaseFixtures();
  cleanupMutableFixtures();
  ensureSupplementalFixtures();
  writeDefaultSettings();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  installMockInitScript(page);
  await exposeNodeBridge(page);
  page.on('console', (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    fs.appendFileSync(path.join(runDir, 'logs/playwright-console.log'), `${line}\n`);
  });
  page.on('pageerror', (error) => {
    fs.appendFileSync(path.join(runDir, 'logs/playwright-console.log'), `[pageerror] ${error.message}\n`);
  });
  await openApp(page, guidePath);
  await logInteractiveElements(page, 'startup');
  await screenshot(page, 'screenshots/01-startup/PRISM-FF-002-case-2.png');
  await screenshot(page, 'screenshots/03-title-status/PRISM-FF-017-titlebar-file-name.png');

  const body = await page.locator('body').innerText();
  fs.writeFileSync(path.join(runDir, 'logs/playwright-body-start.txt'), body);

  await screenshot(page, 'screenshots/02-files-workspace/PRISM-FF-007-markdown-markdown.png');
  await tryCommandScreenshot(page, 'quickOpen', 'screenshots/08-command-search/PRISM-FF-059-quick-open.png');
  await page.keyboard.type('linked').catch(() => {});
  await page.waitForTimeout(600);
  await screenshot(page, 'screenshots/08-command-search/PRISM-FF-059-quick-open-filtered.png');
  await closeTopLayer(page);
  await tryCommandScreenshot(page, 'workspaceSearch', 'screenshots/08-command-search/PRISM-FF-060-workspace-search.png');
  await page.keyboard.type('洛神').catch(() => {});
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/08-command-search/PRISM-FF-060-workspace-search-results.png');
  await closeTopLayer(page);
  await switchView(page, 'split');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-019-case-19.png');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-023-split-scroll-sync-baseline.png');
  await switchView(page, 'preview');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-038-markdown-markdown.png');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-039-front-matter-front-matter.png');
  await tryCommandScreenshot(page, 'openDocumentProperties', 'screenshots/07-knowledge/PRISM-FF-053-properties-panel.png');
  await closeTopLayer(page);
  await tryCommandScreenshot(page, 'showDocumentLinks', 'screenshots/07-knowledge/PRISM-FF-054-current-links-panel.png');
  await closeTopLayer(page);
  await tryCommandScreenshot(page, 'showBacklinks', 'screenshots/07-knowledge/PRISM-FF-055-backlinks-panel.png');
  await closeTopLayer(page);
  const graphOpenedByButton = await tryClickSelectorScreenshot(
    page,
    'button[title*="图谱"],button[title*="Relation"],button[aria-label*="图谱"],button[aria-label*="Relation"]',
    'screenshots/07-knowledge/PRISM-FF-057-relation-graph-panel.png',
  );
  if (!graphOpenedByButton) {
    await tryCommandScreenshot(page, 'showRelationGraph', 'screenshots/07-knowledge/PRISM-FF-057-relation-graph-panel.png');
  }
  await closeTopLayer(page);
  await screenshot(page, 'screenshots/07-knowledge/PRISM-FF-056-graph-button-visible.png');
  await tryClickTextScreenshot(page, 'Outline', 'screenshots/07-knowledge/PRISM-FF-058-case-58.png');
  await tryClickTextScreenshot(page, 'Files', 'screenshots/02-files-workspace/PRISM-FF-061-case-61.png');
  await tryClickTextScreenshot(page, 'ERROR 1', 'screenshots/06-diagnostics/PRISM-FF-049-case-49.png');
  await screenshot(page, 'screenshots/06-diagnostics/PRISM-FF-051-heading-table-render-heading-table-render.png');
  await page.keyboard.press('Escape').catch(() => {});
  await scrollPreviewToText(page, '任务列表');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-035-case-35.png');
  await scrollPreviewToText(page, '表格');
  await screenshot(page, 'screenshots/06-table/PRISM-FF-041-table-preview-width.png');
  await scrollPreviewToText(page, '数学公式');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-041-katex-katex.png');
  await scrollPreviewToSelector(page, '.mermaid-placeholder', 0);
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-042-mermaid-mermaid.png');
  await scrollPreviewToSelector(page, '.plantuml-placeholder', 0);
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-043-plantuml-plantuml.png');
  await scrollPreviewToSelector(page, '.markmap-placeholder', 0);
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-044-markmap-markmap.png');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-024-case-24.png');
  await scrollPreviewToText(page, '图片');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-045-local-media-preview.png');

  await openApp(page, path.join(workspaceRoot, 'data.json'));
  await screenshot(page, 'screenshots/02-files-workspace/PRISM-FF-008-text-document-text-document.png');
  await screenshot(page, 'screenshots/07-knowledge/PRISM-FF-056-graph-button-hidden-text.png');
  await openApp(page, path.join(workspaceRoot, 'query.sql'));
  await screenshot(page, 'screenshots/02-files-workspace/PRISM-FF-008-text-document-sql.png');
  await openApp(page, path.join(workspaceRoot, 'plain.txt'));
  await screenshot(page, 'screenshots/02-files-workspace/PRISM-FF-008-text-document-txt.png');
  await openApp(page, path.join(workspaceRoot, 'unsupported.ts'));
  await screenshot(page, 'screenshots/02-files-workspace/PRISM-FF-009-case-9.png');

  await openApp(page, guidePath);
  await switchView(page, 'edit');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-065-writing-stats-statusbar.png');
  await page.mouse.dblclick(370, 106).catch(() => {});
  await page.waitForTimeout(500);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-108-inline-markdown-decoration.png');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-027-case-27.png');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-030-case-30.png');

  await page.keyboard.press('Meta+F');
  await page.waitForTimeout(500);
  await page.keyboard.type('Prism');
  await page.waitForTimeout(800);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-020-case-20.png');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Meta+H').catch(() => {});
  await page.waitForTimeout(800);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-021-case-21.png');
  await page.keyboard.press('Escape');

  await switchView(page, 'preview');
  await page.keyboard.press('Meta+F').catch(() => {});
  await page.waitForTimeout(600);
  await page.keyboard.type('洛神').catch(() => {});
  await page.waitForTimeout(800);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-022-preview-search-hit.png');
  await page.keyboard.press('Escape').catch(() => {});

  await runCommand(page, 'new');
  await page.waitForTimeout(1000);
  await screenshot(page, 'screenshots/02-files-workspace/PRISM-FF-011-new-document-current-workspace.png');
  await focusEditorAt(page);
  await page.keyboard.type('Scratch save test for Prism full functional run.').catch(() => {});
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/03-title-status/PRISM-FF-018-titlebar-dirty-state.png');
  await runCommand(page, 'save');
  await page.waitForTimeout(900);
  await screenshot(page, 'screenshots/02-files-workspace/PRISM-FF-013-save-current-document.png');
  await runCommand(page, 'templateReadme');
  await page.waitForTimeout(900);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-032-template-readme-insert.png');
  await focusEditorAt(page);
  await page.keyboard.type('[[Prism').catch(() => {});
  await page.waitForTimeout(900);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-034-wiki-link-completion.png');
  await runCommand(page, 'insertTable');
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/06-table/PRISM-FF-035-insert-table-popover.png');
  await closeTopLayer(page);
  await page.keyboard.type('/');
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-031-slash-menu-default.png');
  await page.keyboard.type('markmap');
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-031-slash-menu-filtered-markmap.png');
  await page.keyboard.press('Escape').catch(() => {});
  cleanupMutableFixtures();
  await openApp(page, guidePath);

  await openApp(page, invalidFrontMatterPath);
  await switchView(page, 'preview');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-040-invalid-frontmatter-preview.png');
  await tryCommandScreenshot(page, 'openDocumentProperties', 'screenshots/07-knowledge/PRISM-FF-040-invalid-frontmatter-properties.png');
  await closeTopLayer(page);

  await openApp(page, safeHtmlPath);
  await switchView(page, 'preview');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-046-safe-html-preview.png');

  await openApp(page, path.join(workspaceRoot, 'notes/long.md'));
  await switchView(page, 'preview');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-047-long-document-top.png');
  await setPreviewScrollRatio(page, 0.5);
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-047-long-document-middle.png');
  await setPreviewScrollRatio(page, 1);
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-047-long-document-bottom.png');

  await openApp(page, slidesPath);
  await tryCommandScreenshot(page, 'presentationMode', 'screenshots/05-preview-rendering/PRISM-FF-048-presentation-mode.png');
  await closeTopLayer(page);

  await openApp(page, path.join(workspaceRoot, 'notes/broken-links.md'));
  await switchView(page, 'preview');
  await tryClickTextScreenshot(page, 'ERROR', 'screenshots/06-diagnostics/PRISM-FF-050-image-diagnostics.png');
  await screenshot(page, 'screenshots/06-diagnostics/PRISM-FF-070-export-preflight-errors.png');
  await closeTopLayer(page);

  await openApp(page, typographyPath);
  await switchView(page, 'edit');
  await tryClickSelectorScreenshot(
    page,
    'button[title*="排版"],button[title*="Typography"],button[aria-label*="排版"],button[aria-label*="Typography"]',
    'screenshots/06-diagnostics/PRISM-FF-052-typography-diagnostics.png',
  );
  await closeTopLayer(page);

  await openApp(page, guidePath);
  await runCommand(page, 'toggleSidebar');
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/03-title-status/PRISM-FF-064-sidebar-hidden.png');
  await runCommand(page, 'toggleSidebar');
  await page.waitForTimeout(700);
  await runCommand(page, 'statusBar');
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/03-title-status/PRISM-FF-064-statusbar-hidden.png');
  await runCommand(page, 'statusBar');
  await page.waitForTimeout(700);
  await runCommand(page, 'focusMode');
  await page.waitForTimeout(900);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-066-focus-mode.png');
  await runCommand(page, 'focusMode');
  await runCommand(page, 'typewriterMode');
  await page.waitForTimeout(900);
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-067-typewriter-mode.png');
  await runCommand(page, 'typewriterMode');

  await tryMenuScreenshot(page, 'File', 'screenshots/11-menu-help/PRISM-FF-085-case-85.png');
  await tryMenuScreenshot(page, 'Edit', 'screenshots/11-menu-help/PRISM-FF-085-edit-menu.png');
  await tryMenuScreenshot(page, 'Insert', 'screenshots/11-menu-help/PRISM-FF-085-insert-menu.png');
  await tryMenuScreenshot(page, 'Format', 'screenshots/11-menu-help/PRISM-FF-085-format-menu.png');
  await tryMenuScreenshot(page, 'View', 'screenshots/11-menu-help/PRISM-FF-085-view-menu.png');
  await tryMenuScreenshot(page, 'Export', 'screenshots/09-export/PRISM-FF-069-case-69.png');
  await tryMenuScreenshot(page, 'Navigate', 'screenshots/11-menu-help/PRISM-FF-085-navigation-menu.png');
  await tryMenuScreenshot(page, 'Window', 'screenshots/11-menu-help/PRISM-FF-085-window-menu.png');
  await tryMenuScreenshot(page, 'Help', 'screenshots/11-menu-help/PRISM-FF-085-help-menu.png');

  await tryCommandScreenshot(page, 'showShortcuts', 'screenshots/11-menu-help/PRISM-FF-087-shortcuts-panel.png');
  await closeTopLayer(page);
  await tryCommandScreenshot(page, 'about', 'screenshots/11-menu-help/PRISM-FF-088-about-panel.png');
  await tryCommandScreenshot(page, 'checkUpdate', 'screenshots/11-menu-help/PRISM-FF-088-check-update-state.png');
  await closeTopLayer(page);

  await openSettingsSection(page, 'general');
  await screenshot(page, 'screenshots/10-settings-themes/PRISM-FF-080-general-settings.png');
  await openSettingsSection(page, 'writing');
  await screenshot(page, 'screenshots/10-settings-themes/PRISM-FF-081-writing-settings.png');
  await tryClickTextScreenshot(page, '显示行号', 'screenshots/03-shell-status/PRISM-FF-068-line-numbers-enabled.png');
  await closeTopLayer(page);
  await switchView(page, 'edit');
  await screenshot(page, 'screenshots/03-shell-status/PRISM-FF-068-case-68.png');
  await openSettingsSection(page, 'appearance');
  await screenshot(page, 'screenshots/10-settings-themes/PRISM-FF-082-appearance-settings.png');
  await tryClickTextScreenshot(page, '打开主题目录', 'screenshots/10-settings-themes/PRISM-FF-104-open-theme-directory.png');
  await closeTopLayer(page);
  await openSettingsSection(page, 'appearance');
  await screenshot(page, 'screenshots/10-settings-themes/PRISM-FF-083-font-settings.png');
  await openSettingsSection(page, 'export');
  await screenshot(page, 'screenshots/09-export/PRISM-FF-077-export-settings.png');
  await openSettingsSection(page, 'citations');
  await screenshot(page, 'screenshots/09-export/PRISM-FF-079-pandoc-citations-settings.png');
  await openSettingsSection(page, 'files');
  await screenshot(page, 'screenshots/10-settings-themes/PRISM-FF-084-files-settings.png');
  await logInteractiveElements(page, 'settings');
  await closeTopLayer(page);

  await openApp(page, guidePath);
  await captureTheme(page, 'miaoyan', 'screenshots/12-themes/PRISM-FF-101-theme-miaoyan-preview.png');
  await captureTheme(page, 'inkstone', 'screenshots/12-themes/PRISM-FF-101-theme-inkstone-preview.png');
  await captureTheme(page, 'slate', 'screenshots/12-themes/PRISM-FF-101-theme-slate-preview.png');
  await captureTheme(page, 'mono', 'screenshots/12-themes/PRISM-FF-101-theme-mono-preview.png');
  await captureTheme(page, 'nocturne', 'screenshots/12-themes/PRISM-FF-102-theme-nocturne-preview.png');
  await captureTheme(page, 'carbon', 'screenshots/12-themes/PRISM-FF-102-theme-carbon-preview.png');

  await runCommand(page, `setTheme:${encodeURIComponent('miaoyan')}`);
  await switchView(page, 'edit');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-106-codemirror-codemirror.png');
  await focusEditorAt(page);
  await page.keyboard.press('Meta+A').catch(() => {});
  await page.keyboard.type('> [!note] 自动化提示块\n> Prism callout screenshot evidence.\n\n- [ ] 任务一\n  - [x] 子任务\n\n`inline code` and $a+b=c$\n').catch(() => {});
  await page.waitForTimeout(700);
  await runCommand(page, 'insertCallout');
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-109-callout-callout.png');
  await page.keyboard.press('Escape').catch(() => {});
  await screenshot(page, 'screenshots/04-editor/PRISM-FF-111-markdown-markdown.png');
  await switchView(page, 'preview');
  await screenshot(page, 'screenshots/05-preview-rendering/PRISM-FF-160-system-font-cjk-emoji.png');

  await openApp(page, path.join(workspaceRoot, 'notes/broken-links.md'));
  await switchView(page, 'preview');
  await screenshot(page, 'screenshots/06-diagnostics/PRISM-FF-113-action-action.png');
  await tryClickTextScreenshot(page, '查看源码', 'screenshots/06-diagnostics/PRISM-FF-113-action-clicked.png');
  await closeTopLayer(page);

  await openApp(page, guidePath);
  await switchView(page, 'preview');
  await tryClickTextScreenshot(page, 'linked-note', 'screenshots/04-editor/PRISM-FF-114-wiki-wiki.png');
  await openApp(page, guidePath);
  await switchView(page, 'preview');
  await tryClickTextScreenshot(page, 'Markdown Guide', 'screenshots/05-preview-rendering/PRISM-FF-115-markdown-markdown.png');
  await openApp(page, guidePath);
  await switchView(page, 'split');
  await tryClickSelectorScreenshot(page, '#write [data-line]', 'screenshots/05-preview-rendering/PRISM-FF-116-flash-flash.png');

  await tryCommandScreenshot(page, 'quickOpen', 'screenshots/08-command-search/PRISM-FF-086-case-86.png');
  await closeTopLayer(page);
  await openSettingsSection(page, 'general');
  await tryClickTextScreenshot(page, '简体中文', 'screenshots/00-p1-other/PRISM-FF-136-i18n-i18n.png');
  await closeTopLayer(page);
  await emitAppEvent(page, 'prism-toast', {
    tone: 'success',
    title: 'Toast 自动化验证',
    message: '成功、错误和操作按钮样式需保持可读。',
    actions: [{ label: '操作' }],
  });
  await screenshot(page, 'screenshots/00-p1-other/PRISM-FF-137-toast-toast.png');
  await emitAppEvent(page, 'prism-export-failure', {
    title: '导出失败自动化验证',
    message: '模拟导出失败诊断弹窗。',
    diagnostic: 'Prism 导出失败诊断\\n格式: PNG\\n错误: 自动化模拟失败',
  });
  await screenshot(page, 'screenshots/06-diagnostics/PRISM-FF-130-case-130.png');
  await closeTopLayer(page);
  await tryCommandScreenshot(page, 'devTools', 'screenshots/08-command-search/PRISM-FF-139-devtools-devtools.png');
  await tryCommandScreenshot(page, 'mdReference', 'screenshots/11-menu-help/PRISM-FF-143-help-link-markdown-reference.png');
  await tryCommandScreenshot(page, 'checkUpdate', 'screenshots/11-menu-help/PRISM-FF-144-case-144.png');
  await closeTopLayer(page);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await emitAppEvent(page, 'prism-toast', {
    tone: 'warning',
    title: 'Reduced motion',
    message: 'prefers-reduced-motion: reduce 截图。',
  });
  await screenshot(page, 'screenshots/10-settings-themes/PRISM-FF-167-case-167.png');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await closeTopLayer(page);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/13-platform-layout/PRISM-FF-158-narrow-window-1024x768.png');
  await page.setViewportSize({ width: 1440, height: 560 });
  await page.waitForTimeout(700);
  await screenshot(page, 'screenshots/13-platform-layout/PRISM-FF-158-low-height-window.png');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.waitForTimeout(300);

  await screenshotSelector(page, 'body', 'screenshots/01-startup/PRISM-FF-168-browser-smoke-body.png');

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
