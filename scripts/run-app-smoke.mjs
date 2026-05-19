#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const appPath = path.join(repoRoot, 'src-tauri/target/release/bundle/macos/Prism.app');
const smokeRoot = path.join(repoRoot, '.codex-smoke/app-smoke');
const workspaceDir = path.join(smokeRoot, 'workspace');
const evidenceDir = path.join(smokeRoot, 'evidence');
const sourceFile = path.join(workspaceDir, 'app-smoke.md');
const targetFile = path.join(workspaceDir, 'target.md');
const configPath = path.join(os.homedir(), 'Library/Application Support/com.prism.editor.v1/config.json');
const configBackupPath = path.join(smokeRoot, 'config.before.json');
const marker = `prismappsmoke${Date.now()}`;

const steps = [];

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
  await fs.writeFile(targetFile, '# Target\n\n用于验证 Cmd+P、编辑和保存。\n', 'utf8');
}

function getWindowBounds() {
  const output = osascript(`
tell application "System Events"
  tell process "Prism"
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

async function capture(name, bounds = getWindowBounds()) {
  const target = path.join(evidenceDir, `${name}.png`);
  await run('screencapture', [
    '-x',
    `-R${bounds.x},${bounds.y},${bounds.width},${bounds.height}`,
    target,
  ]);
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

function key(script) {
  osascript(`
tell application "System Events"
  tell process "Prism"
    set frontmost to true
    ${script}
  end tell
end tell
`);
}

function clickRelative(bounds, relX, relY) {
  const x = Math.round(bounds.x + relX);
  const y = Math.round(bounds.y + relY);
  key(`click at {${x}, ${y}}`);
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

  try {
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

    const errorBefore = await capture('02-error-before', bounds);
    let errorDiff = null;
    for (const xOffset of [95, 85, 75, 65]) {
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
    key('keystroke "p" using command down');
    await delay(700);
    const quickOpenAfter = await capture('05-quick-open-opened', bounds);
    const quickOpenDiff = await assertVisibleChange('Cmd+P quick open', quickOpenBefore, quickOpenAfter, 0.006);
    key('keystroke "target"');
    await delay(250);
    key('key code 36');
    const targetConfig = await waitForLastSession(targetFile);
    record('Cmd+P opens workspace target file', 'pass', {
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

    const settingsBefore = await capture('06-settings-before', bounds);
    key('keystroke "," using command down');
    await delay(900);
    const settingsAfter = await capture('07-settings-center', bounds);
    const settingsDiff = await assertVisibleChange('Settings center', settingsBefore, settingsAfter, 0.02);
    record('settings center opens with Cmd+,', 'pass', { diff: settingsDiff });
    key('key code 53');
    await delay(250);

    const exportBefore = await capture('08-export-before', bounds);
    clickRelative(bounds, bounds.width - 18, bounds.height - 18);
    await delay(500);
    clickRelative(bounds, bounds.width - 150, bounds.height - 95);
    await delay(900);
    const exportAfter = await capture('09-export-save-dialog', bounds);
    const exportDiff = await assertVisibleChange('Export save dialog', exportBefore, exportAfter, 0.02);
    record('export save dialog opens from status bar export menu', 'pass', { diff: exportDiff });
    clickRelative(bounds, Math.round(bounds.width / 2) + 120, bounds.height - 110);
    await delay(300);

    record('wrote app smoke evidence report', 'pass', {
      summary: path.relative(repoRoot, path.join(evidenceDir, 'report.json')),
    });
    const report = {
      generatedAt: new Date().toISOString(),
      appPath,
      workspaceDir,
      sourceFile,
      targetFile,
      marker,
      configRestoredAfterRun: true,
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
