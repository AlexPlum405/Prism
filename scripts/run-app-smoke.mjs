#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const appPath = process.env.PRISM_APP_PATH || path.join(repoRoot, 'src-tauri/target/release/bundle/macos/Prism.app');
const smokeScope = process.env.PRISM_APP_SMOKE_SCOPE || 'full';
const appProcessName = resolveInfoPlistValue('CFBundleExecutable') || 'Prism';
const appDisplayName = resolveInfoPlistValue('CFBundleDisplayName')
  || resolveInfoPlistValue('CFBundleName')
  || 'Prism';
const smokeRoot = path.join(repoRoot, '.codex-smoke/app-smoke');
const workspaceDir = path.join(smokeRoot, 'workspace');
const evidenceDir = path.join(smokeRoot, 'evidence');
const sourceFile = path.join(workspaceDir, 'app-smoke.md');
const targetFile = path.join(workspaceDir, 'target.md');
const startupMarkdownFile = path.join(workspaceDir, '中文 路径.markdown');
const jsonFile = path.join(workspaceDir, 'data.json');
const sqlFile = path.join(workspaceDir, 'query.sql');
const textFile = path.join(workspaceDir, 'plain.txt');
const complexExportRoot = path.join(repoRoot, '.codex-smoke/complex-export');
const complexExportOutDir = path.join(complexExportRoot, 'out');
const complexExportPaths = {
  html: path.join(complexExportOutDir, 'complex-export.html'),
  pdf: path.join(complexExportOutDir, 'complex-export.pdf'),
  png: path.join(complexExportOutDir, 'complex-export.png'),
  docx: path.join(complexExportOutDir, 'complex-export.docx'),
};
const configPath = path.join(os.homedir(), 'Library/Application Support/com.prism.editor.v1/config.json');
const configBackupPath = path.join(smokeRoot, 'config.before.json');
const marker = `prismappsmoke${Date.now()}`;
const complexExportSmokeTestName = 'writes complex export smoke artifacts for all supported formats';
const complexExportSmokeCommand = `npm test -- --run src/domains/export/exportPipeline.test.ts -t "${complexExportSmokeTestName}"`;

const steps = [];

function resolveInfoPlistValue(key) {
  const result = spawnSync('/usr/libexec/PlistBuddy', [
    '-c',
    `Print :${key}`,
    path.join(appPath, 'Contents/Info.plist'),
  ], {
    encoding: 'utf8',
    timeout: 2000,
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function appleScriptString(value) {
  return JSON.stringify(value);
}

function record(name, status, details = {}) {
  steps.push({ name, status, ...details });
  const suffix = details.summary ? `: ${details.summary}` : '';
  console.log(`[app-smoke] ${status} ${name}${suffix}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 24,
      ...options,
    }, (error, stdout, stderr) => {
      if (error) {
        const message = [
          `${command} ${args.join(' ')}`,
          stdout.trim(),
          stderr.trim(),
        ].filter(Boolean).join('\n');
        reject(new Error(message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function osascript(script, timeoutMs = 8000) {
  const result = spawnSync('osascript', [], {
    input: script,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    timeout: timeoutMs,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'osascript failed').trim());
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

async function requireNonEmptyFile(filePath) {
  const fileStat = await fs.stat(filePath);
  if (fileStat.size <= 0) {
    throw new Error(`Expected non-empty export artifact: ${filePath}`);
  }
  return fileStat.size;
}

function requireTextIncludes(label, text, expected) {
  for (const token of expected) {
    if (!text.includes(token)) {
      throw new Error(`${label} missing expected token: ${token}`);
    }
  }
}

function requireTextExcludes(label, text, forbidden) {
  for (const token of forbidden) {
    if (text.includes(token)) {
      throw new Error(`${label} contains forbidden token: ${token}`);
    }
  }
}

async function validateComplexExportArtifacts() {
  const htmlSize = await requireNonEmptyFile(complexExportPaths.html);
  const html = await fs.readFile(complexExportPaths.html, 'utf8');
  requireTextIncludes('HTML export artifact', html, [
    '<title>导出 Smoke 验收文档</title>',
    'prism-export-toc',
    '<table',
    'Golden Mermaid',
    'class="katex',
    'assets/prism-export-figure.png',
    '[@doe2024]',
  ]);

  const pdfSize = await requireNonEmptyFile(complexExportPaths.pdf);
  const pdfBytes = await fs.readFile(complexExportPaths.pdf);
  const pdf = await PDFDocument.load(new Uint8Array(pdfBytes));
  if (pdf.getPageCount() < 1) {
    throw new Error('PDF export artifact has no pages.');
  }
  const firstPage = pdf.getPage(0);
  const pdfWidth = firstPage.getWidth();
  const pdfHeight = firstPage.getHeight();
  if (Math.abs(pdfWidth - 595.28) > 2 || Math.abs(pdfHeight - 841.89) > 2) {
    throw new Error(`PDF export artifact is not A4: ${pdfWidth}x${pdfHeight}`);
  }

  const pngSize = await requireNonEmptyFile(complexExportPaths.png);
  const pngBytes = await fs.readFile(complexExportPaths.png);
  const pngSignature = Array.from(pngBytes.slice(0, 8));
  const expectedPngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((value, index) => value === expectedPngSignature[index])) {
    throw new Error(`PNG export artifact has invalid signature: ${pngSignature.join(',')}`);
  }
  const pngMetadata = await sharp(pngBytes).metadata();
  if (!pngMetadata.width || !pngMetadata.height) {
    throw new Error('PNG export artifact has invalid dimensions.');
  }

  const docxSize = await requireNonEmptyFile(complexExportPaths.docx);
  const docxBytes = await fs.readFile(complexExportPaths.docx);
  const docxEntries = unzipSync(new Uint8Array(docxBytes));
  const documentXmlBytes = docxEntries['word/document.xml'];
  if (!documentXmlBytes) {
    throw new Error('DOCX export artifact missing word/document.xml.');
  }
  const documentXml = strFromU8(documentXmlBytes);
  requireTextIncludes('DOCX export artifact', documentXml, [
    '导出 Smoke 验收文档',
    'Prism Export Smoke',
    '项目',
  ]);
  requireTextExcludes('DOCX export artifact', documentXml, [
    'graph TD',
  ]);
  const mediaFiles = Object.keys(docxEntries).filter((filePath) => filePath.startsWith('word/media/'));
  if (!mediaFiles.some((filePath) => /\.(png|jpe?g|svg)$/.test(filePath))) {
    throw new Error('DOCX export artifact missing image media.');
  }

  return {
    command: complexExportSmokeCommand,
    outputDir: relativePath(complexExportOutDir),
    html: {
      path: relativePath(complexExportPaths.html),
      size: htmlSize,
      checks: ['title', 'toc', 'table', 'mermaid', 'katex', 'image', 'citation-placeholder'],
    },
    pdf: {
      path: relativePath(complexExportPaths.pdf),
      size: pdfSize,
      pageCount: pdf.getPageCount(),
      firstPage: {
        width: Number(pdfWidth.toFixed(2)),
        height: Number(pdfHeight.toFixed(2)),
      },
    },
    png: {
      path: relativePath(complexExportPaths.png),
      size: pngSize,
      width: pngMetadata.width,
      height: pngMetadata.height,
      format: pngMetadata.format,
    },
    docx: {
      path: relativePath(complexExportPaths.docx),
      size: docxSize,
      mediaFileCount: mediaFiles.length,
      checks: ['document.xml', 'chinese-title', 'code-text', 'table-text', 'no-mermaid-source-leak', 'image-media'],
    },
  };
}

async function generateAndValidateComplexExportArtifacts() {
  await fs.rm(complexExportRoot, { recursive: true, force: true });
  await run('npm', [
    'test',
    '--',
    '--run',
    'src/domains/export/exportPipeline.test.ts',
    '-t',
    complexExportSmokeTestName,
  ], {
    timeout: 120000,
  });
  return validateComplexExportArtifacts();
}

async function waitFor(label, predicate, timeoutMs = 12000, intervalMs = 350) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

async function quitPrism() {
  try {
    osascript('tell application "Prism" to quit', 1200);
  } catch {
    // The app may not be running yet.
  }
  await delay(700);
  const stillRunning = await run('pgrep', ['-f', `${appPath}/Contents/MacOS/app`]).catch(() => null);
  if (stillRunning) {
    await run('pkill', ['-f', `${appPath}/Contents/MacOS/app`]).catch(() => undefined);
  }
  await waitFor('Prism process exit', async () => {
    const result = await run('pgrep', ['-f', `${appPath}/Contents/MacOS/app`]).catch(() => null);
    return result === null;
  }, 6000, 300).catch(() => undefined);
}

async function backupConfig() {
  await fs.mkdir(smokeRoot, { recursive: true });
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

async function prepareFixtures() {
  await fs.rm(smokeRoot, { recursive: true, force: true });
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(sourceFile, [
    '# App Smoke',
    '',
    '这份文档用于真实 Prism.app smoke。',
    '',
    '[missing](./missing.md)',
    '',
  ].join('\n'), 'utf8');
  await fs.writeFile(targetFile, '# Target\n\n用于验证 Cmd+Shift+P、编辑和保存。\n', 'utf8');
  await fs.writeFile(startupMarkdownFile, '# 中文 路径\n\n用于验证 .markdown、中文和空格路径启动。\n', 'utf8');
  await fs.writeFile(jsonFile, JSON.stringify({ prism: true, smoke: 'json launch' }, null, 2), 'utf8');
  await fs.writeFile(sqlFile, 'select id, title from notes where archived = false;\n', 'utf8');
  await fs.writeFile(textFile, 'Plain text launch smoke.\n用于验证 TXT 不进入白屏。\n', 'utf8');
}

function getWindowBoundsFromAccessibility() {
  const output = osascript(`
tell application "System Events"
  tell process ${appleScriptString(appProcessName)}
    set frontmost to true
    set p to position of window 1
    set s to size of window 1
    set x to item 1 of p as integer
    set y to item 2 of p as integer
    set w to item 1 of s as integer
    set h to item 2 of s as integer
    return (x as text) & "," & (y as text) & "," & (w as text) & "," & (h as text)
  end tell
end tell
`);
  const [x, y, width, height] = output.split(',').map((item) => Number.parseInt(item, 10));
  if ([x, y, width, height].some((item) => !Number.isFinite(item))) {
    throw new Error(`Invalid Prism window bounds: ${output}`);
  }
  return { x, y, width, height };
}

function getCoreGraphicsWindows() {
  const ownerNames = Array.from(new Set([
    appDisplayName,
    appProcessName,
    'Prism',
    'app',
  ].filter(Boolean)));
  const script = String.raw`
import CoreGraphics
import Foundation

let ownerNames = Set(CommandLine.arguments.dropFirst())

func doubleValue(_ value: Any?) -> Double {
  if let value = value as? Double { return value }
  if let value = value as? Int { return Double(value) }
  if let value = value as? CGFloat { return Double(value) }
  return 0
}

func boolValue(_ value: Any?) -> Bool {
  if let value = value as? Bool { return value }
  if let value = value as? Int { return value != 0 }
  return false
}

var result: [[String: Any]] = []

if let windows = CGWindowListCopyWindowInfo(.optionAll, CGWindowID(0)) as? [[String: Any]] {
  for window in windows {
    guard let owner = window[kCGWindowOwnerName as String] as? String, ownerNames.contains(owner) else { continue }
    let layer = window[kCGWindowLayer as String] as? Int ?? 0
    guard layer == 0 else { continue }
    guard let bounds = window[kCGWindowBounds as String] as? [String: Any] else { continue }
    let width = doubleValue(bounds["Width"])
    let height = doubleValue(bounds["Height"])
    let id = window[kCGWindowNumber as String] as? Int ?? 0
    let x = doubleValue(bounds["X"])
    let y = doubleValue(bounds["Y"])
    let name = window[kCGWindowName as String] as? String ?? ""
    result.append([
      "windowId": id,
      "owner": owner,
      "name": name,
      "onscreen": boolValue(window[kCGWindowIsOnscreen as String]),
      "x": x,
      "y": y,
      "width": width,
      "height": height
    ])
  }
}

let data = try JSONSerialization.data(withJSONObject: result, options: [])
print(String(data: data, encoding: .utf8)!)
`;

  const result = spawnSync('swift', ['-', ...ownerNames], {
    input: script,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 4000,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'CoreGraphics window lookup failed').trim());
  }

  const output = result.stdout.trim().split('\n').pop();
  return JSON.parse(output);
}

function getWindowBoundsFromCoreGraphics() {
  const windows = getCoreGraphicsWindows();
  const candidates = windows
    .filter((window) => window.onscreen && window.width >= 400 && window.height >= 300)
    .sort((left, right) => (right.width * right.height) - (left.width * left.height));
  const bounds = candidates[0];
  if (!bounds) {
    throw new Error('CoreGraphics found no visible Prism window.');
  }
  if ([bounds.x, bounds.y, bounds.width, bounds.height, bounds.windowId].some((item) => !Number.isFinite(item))) {
    throw new Error(`Invalid CoreGraphics window bounds: ${JSON.stringify(bounds)}`);
  }
  return bounds;
}

function getWindowBounds() {
  let accessibilityError;
  try {
    return getWindowBoundsFromAccessibility();
  } catch (error) {
    accessibilityError = error;
  }

  try {
    return getWindowBoundsFromCoreGraphics();
  } catch (coreGraphicsError) {
    throw new Error([
      'Prism window lookup failed.',
      `Accessibility: ${accessibilityError.message}`,
      `CoreGraphics: ${coreGraphicsError.message}`,
    ].join('\n'));
  }
}

async function capture(name, bounds = getWindowBounds()) {
  const target = path.join(evidenceDir, `${name}.png`);
  if (bounds.windowId) {
    try {
      await run('screencapture', ['-x', '-l', String(bounds.windowId), target]);
      return target;
    } catch (error) {
      console.warn(`[app-smoke] window screenshot failed, falling back to bounds: ${error.message}`);
    }
  }
  try {
    await run('screencapture', [
      '-x',
      `-R${bounds.x},${bounds.y},${bounds.width},${bounds.height}`,
      target,
    ]);
    return target;
  } catch (error) {
    console.warn(`[app-smoke] bounds screenshot failed, falling back to full screen: ${error.message}`);
  }
  await run('screencapture', ['-x', target]);
  return target;
}

async function diffImages(beforePath, afterPath) {
  const before = await sharp(beforePath).raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(afterPath).raw().toBuffer({ resolveWithObject: true });
  if (before.info.width !== after.info.width || before.info.height !== after.info.height) {
    throw new Error(`Screenshot size changed: ${before.info.width}x${before.info.height} -> ${after.info.width}x${after.info.height}`);
  }
  let changed = 0;
  let channelDelta = 0;
  for (let index = 0; index < before.data.length; index += before.info.channels) {
    const delta = Math.abs(before.data[index] - after.data[index])
      + Math.abs(before.data[index + 1] - after.data[index + 1])
      + Math.abs(before.data[index + 2] - after.data[index + 2]);
    if (delta > 30) changed += 1;
    channelDelta += delta / 3;
  }
  const totalPixels = before.info.width * before.info.height;
  return {
    changedPixels: changed,
    totalPixels,
    changedRatio: changed / totalPixels,
    averageDelta: channelDelta / totalPixels,
  };
}

async function assertVisibleChange(label, beforePath, afterPath, minChangedRatio) {
  const diff = await diffImages(beforePath, afterPath);
  if (diff.changedRatio < minChangedRatio) {
    throw new Error(`${label} did not visibly change: ${JSON.stringify(diff)}`);
  }
  return diff;
}

function key(script, timeoutMs = 12000) {
  osascript(`
tell application ${appleScriptString(appDisplayName)} to activate
delay 0.05
tell application "System Events"
  tell process ${appleScriptString(appProcessName)}
    set frontmost to true
    ${script}
  end tell
end tell
`, timeoutMs);
}

function clickRelative(bounds, relX, relY) {
  const x = Math.round(bounds.x + relX);
  const y = Math.round(bounds.y + relY);
  const code = `
import CoreGraphics
import Darwin
let point = CGPoint(x: ${x}, y: ${y})
let source = CGEventSource(stateID: .hidSystemState)
let down = CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)
let up = CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)
down?.post(tap: .cghidEventTap)
usleep(80_000)
up?.post(tap: .cghidEventTap)
`;
  const result = spawnSync('/usr/bin/swift', ['-e', code], {
    encoding: 'utf8',
    timeout: 8000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'swift CGEvent click failed').trim());
  }
}

function systemEventsClickRelative(bounds, relX, relY, timeoutMs = 12000) {
  const x = Math.round(bounds.x + relX);
  const y = Math.round(bounds.y + relY);
  key(`click at {${x}, ${y}}`, timeoutMs);
}

async function waitForLastSession(filePath) {
  return waitFor(`lastSession ${filePath}`, async () => {
    if (!(await pathExists(configPath))) return false;
    const config = await readJson(configPath);
    return config.lastSession?.filePath === filePath ? config : false;
  }, 16000, 400);
}

async function runSmoke() {
  if (process.platform !== 'darwin') {
    throw new Error('Prism.app smoke requires macOS.');
  }
  if (!(await pathExists(appPath))) {
    throw new Error(`Prism.app not found: ${appPath}`);
  }

  await prepareFixtures();
  const hadConfig = await backupConfig();
  let exportArtifacts = null;

  try {
    await quitPrism();
    await run('open', ['-n', '-a', appPath, startupMarkdownFile]);
    await waitFor('Prism window for markdown path launch', async () => {
      try {
        return getWindowBounds();
      } catch {
        return false;
      }
    }, 16000, 500);
    const markdownLaunchConfig = await waitForLastSession(startupMarkdownFile);
    const markdownLaunchBounds = getWindowBounds();
    await delay(500);
    await capture('00-launch-markdown-chinese-space', markdownLaunchBounds);
    record('launch opens .markdown fixture with Chinese space path', 'pass', {
      summary: path.relative(repoRoot, startupMarkdownFile),
      lastSession: markdownLaunchConfig.lastSession,
    });

    const textLaunchCases = [
      ['JSON fixture', jsonFile, '00b-launch-json'],
      ['SQL fixture', sqlFile, '00c-launch-sql'],
      ['TXT fixture', textFile, '00d-launch-txt'],
    ];
    for (const [label, filePath, screenshotName] of textLaunchCases) {
      await quitPrism();
      await run('open', ['-n', '-a', appPath, filePath]);
      await waitFor(`Prism window for ${label}`, async () => {
        try {
          return getWindowBounds();
        } catch {
          return false;
        }
      }, 16000, 500);
      const textLaunchConfig = await waitForLastSession(filePath);
      const textLaunchBounds = getWindowBounds();
      await delay(500);
      await capture(screenshotName, textLaunchBounds);
      record(`launch opens ${label} without blank screen`, 'pass', {
        summary: path.relative(repoRoot, filePath),
        lastSession: textLaunchConfig.lastSession,
      });
    }

    await quitPrism();
    await run('open', ['-n', '-a', appPath, sourceFile]);
    await waitFor('Prism window', async () => {
      try {
        return getWindowBounds();
      } catch {
        return false;
      }
    }, 16000, 500);

    const launchConfig = await waitForLastSession(sourceFile);
    const bounds = getWindowBounds();
    await delay(800);
    await capture('01-launch-source', bounds);
    record('launch opens markdown fixture', 'pass', {
      summary: path.relative(repoRoot, sourceFile),
      lastSession: launchConfig.lastSession,
    });

    if (smokeScope === 'startup') {
      record('startup launch matrix completed', 'pass', {
        summary: '.markdown Chinese/space path and .md explicit launch both opened',
      });
      const report = {
        generatedAt: new Date().toISOString(),
        scope: smokeScope,
        appPath,
        workspaceDir,
        sourceFile,
        targetFile,
        startupMarkdownFile,
        jsonFile,
        sqlFile,
        textFile,
        marker,
        configRestoredAfterRun: true,
        exportArtifacts,
        steps,
      };
      await fs.writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
      return;
    }

    const errorBefore = await capture('02-error-before', bounds);
    let errorDiff = null;
    for (const xOffset of [260, 245, 230, 215, 200, 185, 170, 155, 140, 125, 110, 95, 80, 65]) {
      clickRelative(bounds, bounds.width - xOffset, bounds.height - 18);
      await delay(700);
      const candidate = await capture(`03-error-panel-${xOffset}`, bounds);
      const diff = await diffImages(errorBefore, candidate);
      if (diff.changedRatio >= 0.006) {
        errorDiff = diff;
        await fs.copyFile(candidate, path.join(evidenceDir, '03-error-panel.png'));
        break;
      }
    }
    if (!errorDiff) {
      throw new Error('ERROR diagnostic panel did not visibly open.');
    }
    record('ERROR diagnostic opens from status bar', 'pass', { diff: errorDiff });
    key('key code 53');
    await delay(250);

    const quickOpenBefore = await capture('04-quick-open-before', bounds);
    clickRelative(bounds, 315, 83);
    await delay(150);
    key('key code 35 using {command down, shift down}');
    await delay(1000);
    const quickOpenAfter = await capture('05-quick-open-opened', bounds);
    const quickOpenDiff = await assertVisibleChange('Cmd+Shift+P quick open', quickOpenBefore, quickOpenAfter, 0.025);
    key(`key code 125
    delay 0.05
    key code 125
    delay 0.05
    key code 125
    delay 0.05
    key code 125
    delay 0.05
    key code 125
    delay 0.05
    key code 36`, 30000);
    await delay(900);
    await capture('05a-quick-open-target-opened', bounds);
    const targetConfig = await waitForLastSession(targetFile);
    record('Cmd+Shift+P opens workspace target file', 'pass', {
      diff: quickOpenDiff,
      lastSession: targetConfig.lastSession,
    });

    await capture('06-target-opened', bounds);
    clickRelative(bounds, 315, 83);
    await delay(250);
    key(`key code 124 using command down
    delay 0.1
    keystroke return
    delay 0.1
    keystroke "${marker}"
    delay 0.2
    keystroke "s" using command down`);
    await waitFor('saved marker', async () => {
      const content = await fs.readFile(targetFile, 'utf8');
      return content.includes(marker);
    }, 8000, 300);
    record('basic edit and Cmd+S save writes fixture file', 'pass', { marker });

    const exportBefore = await capture('07-export-before', bounds);
    clickRelative(bounds, bounds.width - 18, bounds.height - 18);
    await delay(500);
    const exportMenu = await capture('08-export-menu', bounds);
    const exportMenuDiff = await assertVisibleChange('Export menu', exportBefore, exportMenu, 0.001);
    record('export menu opens from status bar', 'pass', { diff: exportMenuDiff });
    key('key code 53');
    await delay(300);

    const settingsBefore = await capture('09-settings-before', bounds);
    key('keystroke "," using command down');
    await delay(900);
    const settingsAfter = await capture('10-settings-center', bounds);
    const settingsDiff = await assertVisibleChange('Settings center', settingsBefore, settingsAfter, 0.02);
    record('settings center opens with Cmd+,', 'pass', { diff: settingsDiff });
    key('key code 53');
    await delay(250);

    exportArtifacts = await generateAndValidateComplexExportArtifacts();
    record('complex export artifacts generated and validated', 'pass', {
      summary: 'HTML/PDF/PNG/DOCX',
      artifacts: exportArtifacts,
    });

    record('wrote app smoke evidence report', 'pass', {
      summary: path.relative(repoRoot, path.join(evidenceDir, 'report.json')),
    });
    const report = {
      generatedAt: new Date().toISOString(),
      scope: smokeScope,
      appPath,
      workspaceDir,
      sourceFile,
      targetFile,
      startupMarkdownFile,
      jsonFile,
      sqlFile,
      textFile,
      marker,
      configRestoredAfterRun: true,
      exportArtifacts,
      steps,
    };
    await fs.writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  } finally {
    await restoreConfig(hadConfig);
  }
}

runSmoke().catch(async (error) => {
  await fs.mkdir(evidenceDir, { recursive: true }).catch(() => undefined);
  await fs.writeFile(path.join(evidenceDir, 'failure.log'), `${error.stack || error.message}\n`, 'utf8').catch(() => undefined);
  console.error(`[app-smoke] fail ${error.stack || error.message}`);
  process.exitCode = 1;
});
