#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const appPath = path.join(repoRoot, 'src-tauri/target/release/bundle/macos/Prism.app');
const benchRoot = path.join(repoRoot, '.codex-smoke/preview-webview-benchmark');
const fixtureDir = path.join(benchRoot, 'fixtures');
const evidenceDir = path.join(benchRoot, 'evidence');
const reportJsonPath = path.join(repoRoot, 'docs/verification/prism-preview-webview-benchmark-2026-07-26.json');
const reportMarkdownPath = path.join(repoRoot, 'docs/verification/prism-preview-webview-benchmark-2026-07-26.md');
const reportOnly = process.argv.includes('--report-only');
const configPath = path.join(os.homedir(), 'Library/Application Support/com.prism.editor.v1/config.json');
const configBackupPath = path.join(benchRoot, 'config.before.json');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
      ...options,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error([
          `${command} ${args.join(' ')}`,
          stdout.trim(),
          stderr.trim(),
        ].filter(Boolean).join('\n')));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout.trim();
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath);
}

async function waitFor(label, predicate, timeoutMs = 30000, intervalMs = 250) {
  const startedAt = performance.now();
  let lastError;
  while (performance.now() - startedAt < timeoutMs) {
    try {
      const value = await predicate();
      if (value) {
        return {
          value,
          elapsedMs: performance.now() - startedAt,
        };
      }
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

function buildBenchmarkSection(index) {
  const language = index % 4 === 0 ? 'ts' : index % 4 === 1 ? 'js' : index % 4 === 2 ? 'json' : '';
  const codeFence = language ? `\`\`\`${language}` : '```';
  return [
    `## Section ${index} / 章节 ${index}`,
    '',
    `This paragraph is part of the real WebView benchmark. It contains **bold text**, ==highlight==, [[Internal Link ${index}]], and [external link](https://example.com/docs/${index}).`,
    `这是一段真实 Tauri WebView 性能基准正文，第 ${index} 段用于覆盖中文长文、链接、标记和完整预览滚动。`,
    '',
    '> [!NOTE]',
    `> Callout ${index} covers enhanced blockquote rendering in the preview surface.`,
    '',
    '| Item | Status | Notes |',
    '| --- | --- | --- |',
    `| Render | Running | Row ${index} ${'content '.repeat(10)} |`,
    `| Verify | Pass | ${'内容 '.repeat(12)} |`,
    '',
    codeFence,
    `const section${index} = ${JSON.stringify({
      index,
      title: `Section ${index}`,
      enabled: index % 2 === 0,
      tags: ['preview', 'webview', 'benchmark'],
    }, null, 2)};`,
    '```',
    '',
    index % 5 === 0
      ? ['```mermaid', `graph TD; A${index}[Start] --> B${index}[Preview]; B${index} --> C${index}[Done]`, '```'].join('\n')
      : '',
    '',
    index % 6 === 0 ? `![Local image](assets/preview-${index}.png)` : '',
    '',
    index % 7 === 0 ? `Block math: $$E_${index}=mc^2$$` : `Inline math $a_${index}^2 + b_${index}^2 = c_${index}^2$.`,
    '',
    // Raw HTML and task lists are the constructs the common-markdown fast path
    // delegates per block. Real documents mix them in, so the fixture must too.
    index % 4 === 0
      ? [
        '<details>',
        `<summary>Folded section ${index} / 折叠章节 ${index}</summary>`,
        '',
        `Folded body ${index} with **bold** and \`code\`.`,
        '',
        '</details>',
      ].join('\n')
      : '',
    '',
    index % 3 === 0
      ? [
        `- [x] Task ${index} done / 已完成`,
        `- [ ] Task ${index} pending / 待办`,
      ].join('\n')
      : '',
    '',
    index % 9 === 0 ? `Press <kbd>Cmd</kbd> + <kbd>K</kbd> for section ${index}.` : '',
    '',
  ].join('\n');
}

function buildBenchmarkMarkdown(targetBytes) {
  const chunks = [[
    '---',
    'title: Prism Real WebView Preview Benchmark',
    'tags: preview, benchmark, webview',
    'status: verification',
    '---',
    '',
    '# Prism Real WebView Preview Benchmark',
    '',
  ].join('\n')];
  let index = 1;
  while (Buffer.byteLength(chunks.join('\n'), 'utf8') < targetBytes) {
    chunks.push(buildBenchmarkSection(index));
    index += 1;
  }
  return chunks.join('\n');
}

async function prepareFixtures() {
  await fs.rm(benchRoot, { recursive: true, force: true });
  await fs.mkdir(fixtureDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  const fixtures = [
    { label: '1mb', targetBytes: 1024 * 1024 },
    { label: '3mb', targetBytes: 3 * 1024 * 1024 },
  ];
  for (const fixture of fixtures) {
    const filePath = path.join(fixtureDir, `preview-webview-${fixture.label}.md`);
    const content = buildBenchmarkMarkdown(fixture.targetBytes);
    await fs.writeFile(filePath, content, 'utf8');
    fixture.path = filePath;
    fixture.bytes = Buffer.byteLength(content, 'utf8');
  }
  return fixtures;
}

async function backupConfig() {
  await fs.mkdir(benchRoot, { recursive: true });
  if (await pathExists(configPath)) {
    await fs.copyFile(configPath, configBackupPath);
    return true;
  }
  await fs.rm(configBackupPath, { force: true });
  return false;
}

async function restoreConfig(hadConfig) {
  await quitPrism();
  if (hadConfig) {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.copyFile(configBackupPath, configPath);
  } else {
    await fs.rm(configPath, { force: true });
  }
}

async function writeTemporaryConfig(defaultViewMode) {
  const config = await pathExists(configPath)
    ? await readJson(configPath)
    : { settingsVersion: 1 };
  config.defaultViewMode = defaultViewMode;
  config.restoreLastSession = true;
  config.lastSession = null;
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

async function quitPrism() {
  try {
    runSync('osascript', ['-e', 'tell application "Prism" to quit'], { timeout: 1500 });
  } catch {
    // App may not be running.
  }
  await delay(500);
  await run('pkill', ['-f', `${appPath}/Contents/MacOS/app`]).catch(() => undefined);
}

function getWindowBounds() {
  const script = String.raw`
import CoreGraphics
import Foundation

let ownerNames = Set(["Prism", "app"])
var result: [[String: Any]] = []
if let windows = CGWindowListCopyWindowInfo(.optionAll, CGWindowID(0)) as? [[String: Any]] {
  for window in windows {
    guard let owner = window[kCGWindowOwnerName as String] as? String, ownerNames.contains(owner) else { continue }
    let layer = window[kCGWindowLayer as String] as? Int ?? 0
    guard layer == 0 else { continue }
    guard let bounds = window[kCGWindowBounds as String] as? [String: Any] else { continue }
    let width = bounds["Width"] as? Double ?? 0
    let height = bounds["Height"] as? Double ?? 0
    if width < 400 || height < 300 { continue }
    result.append(["owner": owner, "width": width, "height": height])
  }
}
let data = try JSONSerialization.data(withJSONObject: result, options: [])
print(String(data: data, encoding: .utf8)!)
`;
  const output = runSync('swift', ['-'], { input: script, timeout: 5000 });
  const windows = JSON.parse(output.split('\n').pop() || '[]');
  return windows[0] || null;
}

async function waitForLastSession(filePath) {
  return waitFor(`lastSession ${filePath}`, async () => {
    if (!(await pathExists(configPath))) return false;
    const config = await readJson(configPath);
    return config.lastSession?.filePath === filePath ? config.lastSession : false;
  }, 90000, 500);
}

async function captureFullScreen(name) {
  const target = path.join(evidenceDir, `${name}.png`);
  const startedAt = performance.now();
  await run('screencapture', ['-x', target], { timeout: 15000 });
  return {
    path: target,
    elapsedMs: performance.now() - startedAt,
  };
}

function runAppleScript(script, timeoutMs = 15000) {
  const startedAt = performance.now();
  runSync('osascript', ['-e', script], { timeout: timeoutMs });
  return performance.now() - startedAt;
}

async function measureAction(name, script, screenshotName) {
  const startedAt = performance.now();
  try {
    const actionMs = runAppleScript(script);
    await delay(250);
    const screenshot = await captureFullScreen(screenshotName);
    return {
      name,
      status: 'pass',
      elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
      actionMs: Math.round(actionMs * 10) / 10,
      screenshot: relativePath(screenshot.path),
      screenshotMs: Math.round(screenshot.elapsedMs * 10) / 10,
    };
  } catch (error) {
    return {
      name,
      status: 'error',
      elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
      error: error.message,
    };
  }
}

async function measureFixture(fixture, defaultViewMode) {
  await quitPrism();
  await writeTemporaryConfig(defaultViewMode);
  const openedAt = performance.now();
  await run('open', ['-n', '-a', appPath, fixture.path]);
  const visible = await waitFor('Prism window visible', () => getWindowBounds(), 30000, 300);
  let lastSession;
  try {
    lastSession = await waitForLastSession(fixture.path);
  } catch (error) {
    const screenshot = await captureFullScreen(`${fixture.label}-${defaultViewMode}-timeout`);
    await quitPrism();
    return {
      label: fixture.label,
      bytes: fixture.bytes,
      fixture: relativePath(fixture.path),
      defaultViewMode,
      status: 'timeout',
      error: error.message,
      openCommandToVisibleMs: Math.round(visible.elapsedMs * 10) / 10,
      openCommandToLastSessionMs: null,
      openCommandToScreenshotMs: Math.round((performance.now() - openedAt) * 10) / 10,
      screenshot: relativePath(screenshot.path),
      screenshotMs: Math.round(screenshot.elapsedMs * 10) / 10,
      actions: [],
      domCommitMetric: {
        status: 'timeoutBeforeReady',
        substitute: 'window became visible, but lastSession did not update before timeout',
      },
    };
  }
  await delay(600);
  const screenshot = await captureFullScreen(`${fixture.label}-${defaultViewMode}-opened`);
  const actions = [
    await measureAction(
      'scrollPageDown',
      'tell application "Prism" to activate\ndelay 0.05\ntell application "System Events" to key code 121',
      `${fixture.label}-${defaultViewMode}-scroll`,
    ),
    await measureAction(
      'searchFirstTerm',
      'tell application "Prism" to activate\ndelay 0.05\ntell application "System Events"\nkeystroke "f" using command down\ndelay 0.1\nkeystroke "section"\nend tell',
      `${fixture.label}-${defaultViewMode}-search`,
    ),
    await measureAction(
      'contextMenuAttempt',
      'tell application "Prism" to activate\ndelay 0.05\ntell application "System Events"\nkey down control\nclick at {720, 420}\nkey up control\nend tell',
      `${fixture.label}-${defaultViewMode}-context-menu`,
    ),
  ];
  actions.push({
    name: 'sourceLocateFromPreview',
    status: 'notAutomated',
    reason: 'Current harness records context menu availability, but does not select the localized source-locate menu item through Accessibility.',
  });

  await quitPrism();
  return {
    label: fixture.label,
    bytes: fixture.bytes,
    fixture: relativePath(fixture.path),
    defaultViewMode,
    openCommandToVisibleMs: Math.round(visible.elapsedMs * 10) / 10,
    openCommandToLastSessionMs: Math.round(lastSession.elapsedMs * 10) / 10,
    openCommandToScreenshotMs: Math.round((performance.now() - openedAt) * 10) / 10,
    screenshot: relativePath(screenshot.path),
    screenshotMs: Math.round(screenshot.elapsedMs * 10) / 10,
    lastSession: lastSession.value,
    actions,
    domCommitMetric: {
      status: 'observableSubstitute',
      substitute: 'openCommandToLastSessionMs + openCommandToScreenshotMs in packaged Tauri WebView',
      reason: 'tauri-driver is not installed in this environment, and WKWebView DOM internals are not directly observable from the app-smoke process.',
    },
  };
}

function environmentInfo() {
  const swVers = process.platform === 'darwin'
    ? runSync('sw_vers', [], { timeout: 3000 })
    : '';
  return {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    macOS: swVers,
    appPath,
    buildMode: 'Tauri release .app',
    automation: {
      tauriDriver: 'not found',
      screenshot: 'screencapture full-screen fallback',
      systemEvents: 'osascript best effort',
    },
  };
}

function markdownReport(report) {
  const rows = report.results.map((result) => [
    result.label,
    result.defaultViewMode,
    result.bytes,
    result.status || 'pass',
    result.openCommandToVisibleMs ?? '-',
    result.openCommandToLastSessionMs ?? '-',
    result.openCommandToScreenshotMs ?? '-',
    Array.isArray(result.actions)
      ? result.actions.map((action) => `${action.name}:${action.status}`).join(', ')
      : (result.error || '-'),
  ]);
  return [
    '# Prism Real WebView Preview Benchmark',
    '',
    `> Generated: ${report.generatedAt}`,
    '',
    'This benchmark launches the packaged Tauri `.app` with 1MB and 3MB Markdown fixtures. DOM commit is recorded as an observable substitute because `tauri-driver` is not available in this environment.',
    '',
    '| Fixture | View mode | Bytes | Status | Visible ms | Last session ms | Screenshot ms | Actions / error |',
    '|---|---:|---:|---|---:|---:|---:|---|',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
    `JSON report: \`${relativePath(reportJsonPath)}\``,
  ].join('\n');
}

async function main() {
  if (reportOnly) {
    const report = await readJson(reportJsonPath);
    await fs.writeFile(reportMarkdownPath, `${markdownReport(report)}\n`, 'utf8');
    console.info(`[preview-webview-benchmark] wrote ${relativePath(reportMarkdownPath)}`);
    return;
  }

  if (process.platform !== 'darwin') {
    throw new Error('Real WebView benchmark currently requires macOS Prism.app.');
  }
  if (!(await pathExists(appPath))) {
    throw new Error(`Prism.app not found: ${appPath}`);
  }

  const fixtures = await prepareFixtures();
  const hadConfig = await backupConfig();
  try {
    const results = [];
    for (const fixture of fixtures) {
      try {
        results.push(await measureFixture(fixture, 'preview'));
      } catch (error) {
        results.push({
          label: fixture.label,
          bytes: fixture.bytes,
          fixture: relativePath(fixture.path),
          defaultViewMode: 'preview',
          status: 'error',
          error: error.message,
        });
        await quitPrism();
      }
    }
    const report = {
      generatedAt: new Date().toISOString(),
      environment: environmentInfo(),
      results,
    };
    await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.writeFile(reportMarkdownPath, `${markdownReport(report)}\n`, 'utf8');
    console.info(`[preview-webview-benchmark] wrote ${relativePath(reportJsonPath)}`);
    console.info(`[preview-webview-benchmark] wrote ${relativePath(reportMarkdownPath)}`);
  } finally {
    await restoreConfig(hadConfig);
  }
}

main().catch((error) => {
  console.error(`[preview-webview-benchmark] fail ${error.stack || error.message}`);
  process.exitCode = 1;
});
