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
const appDataDir = path.join(os.homedir(), 'Library/Application Support/com.prism.editor.v1');
const configPath = path.join(appDataDir, 'config.json');
const perfTracePath = path.join(appDataDir, 'perf-trace.json');
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

/**
 * 轮询直到 predicate 返回真值。
 *
 * 返回两个时间：
 * - `elapsedMs`：predicate 返回真值的时刻（含该次探测自身的执行耗时）。
 * - `detectedAtEarliestMs`：最后一次探测**开始**的时刻，即条件成立时间的下界。
 *
 * 两者差值就是探测成本。`swift -` 窗口探测单次约 260ms（冷启动约 960ms），
 * 若只报 `elapsedMs`，这部分探测成本会被算进被测指标；区间上下界一并报出，
 * 读者才能判断读数中有多少是 harness 开销。
 */
async function waitFor(label, predicate, timeoutMs = 30000, intervalMs = 250) {
  const startedAt = performance.now();
  let lastError;
  let probeCount = 0;
  while (performance.now() - startedAt < timeoutMs) {
    const probeStartedAt = performance.now();
    probeCount += 1;
    try {
      const value = await predicate();
      if (value) {
        return {
          value,
          elapsedMs: performance.now() - startedAt,
          detectedAtEarliestMs: probeStartedAt - startedAt,
          probeCount,
          lastProbeMs: performance.now() - probeStartedAt,
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
  // 恢复后的 config 不含 perfInstrumentation，顺带清掉诊断产物。
  await fs.rm(perfTracePath, { force: true });
}

async function writeTemporaryConfig(defaultViewMode) {
  const config = await pathExists(configPath)
    ? await readJson(configPath)
    : { settingsVersion: 1 };
  config.defaultViewMode = defaultViewMode;
  config.restoreLastSession = true;
  config.lastSession = null;
  // 打开应用内分阶段埋点，输出到 appData/perf-trace.json。
  config.perfInstrumentation = true;
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  // 清掉上一轮 trace，避免读到过期数据。
  await fs.rm(perfTracePath, { force: true });
}

/**
 * 读取应用侧 trace。埋点是防抖落盘（400ms 静默后写），因此这里在
 * lastSession 就绪后再等一轮，拿到的是包含全部阶段的最终版本。
 */
async function readPerfTrace() {
  // 埋点在最后一个 mark 之后 400ms 静默才落盘，而 preview_painted 可能晚于
  // lastSession 就绪。固定等待会读到空文件或读不到，所以这里轮询直到
  // preview_painted（最后一个阶段）出现，或超时后返回已有部分。
  const deadline = performance.now() + 6000;
  let last = { status: 'missing', reason: 'perf-trace.json not written; instrumentation flag may not have been read' };
  while (performance.now() < deadline) {
    if (await pathExists(perfTracePath)) {
      try {
        const trace = await readJson(perfTracePath);
        if (Array.isArray(trace.marks) && trace.marks.length > 0) {
          last = { status: 'ok', marks: trace.marks };
          if (trace.marks.some((mark) => mark.name === 'preview_painted')) return last;
        } else {
          last = { status: 'empty' };
        }
      } catch (error) {
        // 可能读到写入中途的文件，重试。
        last = { status: 'unreadable', reason: error.message };
      }
    }
    await delay(250);
  }
  if (last.status === 'ok') {
    last.truncated = 'preview_painted never appeared within 6s; stages after the last recorded mark are missing';
  }
  return last;
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

/**
 * 测同形状但不含按键的脚本，得到本机 osascript + activate + delay 的固定成本。
 * `actionMs` 减去它才接近「按键送达前的 harness 开销」。
 */
function measureAppleScriptBaseline(script) {
  const samples = [];
  for (let i = 0; i < 3; i += 1) {
    try {
      samples.push(runAppleScript(script));
    } catch {
      return null;
    }
  }
  samples.sort((a, b) => a - b);
  return Math.round(samples[1] * 10) / 10;
}

/**
 * 执行一个交互动作。
 *
 * 重要口径说明：`actionMs` 是 `osascript` 进程的完整生命周期，包含脚本内
 * 硬编码的 `delay` 与 `activate`，**且在按键送达后即返回，不等待应用完成响应**。
 * 因此它不能当作「应用响应时间」；`baselineMs` 给出同形状脚本的固定成本，
 * `attributableMs` 是扣除后的余量（仍非纯应用耗时，只是上界更紧的估计）。
 */
async function measureAction(name, script, screenshotName, baselineScript) {
  const startedAt = performance.now();
  try {
    const actionMs = runAppleScript(script);
    await delay(250);
    const screenshot = await captureFullScreen(screenshotName);
    const baselineMs = baselineScript ? measureAppleScriptBaseline(baselineScript) : null;
    return {
      name,
      status: 'pass',
      elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
      actionMs: Math.round(actionMs * 10) / 10,
      baselineMs,
      attributableMs: baselineMs === null
        ? null
        : Math.round((actionMs - baselineMs) * 10) / 10,
      metricCaveat: 'actionMs measures the osascript process, including hardcoded delays; it returns once keys are delivered and does not wait for the app to finish responding.',
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
    // 超时时 trace 最有诊断价值：它能指出卡在哪个阶段。先读再截图退出。
    const perfTrace = await readPerfTrace();
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
      openCommandToVisibleEarliestMs: Math.round(visible.detectedAtEarliestMs * 10) / 10,
      openCommandToLastSessionMs: null,
      openCommandToScreenshotMs: Math.round((performance.now() - openedAt) * 10) / 10,
      screenshot: relativePath(screenshot.path),
      screenshotMs: Math.round(screenshot.elapsedMs * 10) / 10,
      actions: [],
      perfTrace,
      stageBreakdown: summarizeStages(perfTrace),
      domCommitMetric: {
        status: 'timeoutBeforeReady',
        substitute: 'window became visible, but lastSession did not update before timeout',
      },
    };
  }
  // 埋点为 400ms 静默后落盘，这里的 600ms 等待同时覆盖 trace 落盘。
  await delay(600);
  const perfTrace = await readPerfTrace();
  const screenshot = await captureFullScreen(`${fixture.label}-${defaultViewMode}-opened`);
  const actions = [
    await measureAction(
      'scrollPageDown',
      'tell application "Prism" to activate\ndelay 0.05\ntell application "System Events" to key code 121',
      `${fixture.label}-${defaultViewMode}-scroll`,
      'tell application "Prism" to activate\ndelay 0.05\nreturn 1',
    ),
    await measureAction(
      'searchFirstTerm',
      'tell application "Prism" to activate\ndelay 0.05\ntell application "System Events"\nkeystroke "f" using command down\ndelay 0.1\nkeystroke "section"\nend tell',
      `${fixture.label}-${defaultViewMode}-search`,
      'tell application "Prism" to activate\ndelay 0.05\ndelay 0.1\nreturn 1',
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
    // 窗口可见时间的区间下界：排除最后一次 swift 探测的执行成本。
    openCommandToVisibleEarliestMs: Math.round(visible.detectedAtEarliestMs * 10) / 10,
    visibleProbe: {
      count: visible.probeCount,
      lastProbeMs: Math.round(visible.lastProbeMs * 10) / 10,
      note: 'openCommandToVisibleMs includes this probe cost; the earliest value excludes it. True visibility lies between them.',
    },
    openCommandToLastSessionMs: Math.round(lastSession.elapsedMs * 10) / 10,
    openCommandToLastSessionEarliestMs: Math.round(lastSession.detectedAtEarliestMs * 10) / 10,
    openCommandToScreenshotMs: Math.round((performance.now() - openedAt) * 10) / 10,
    screenshot: relativePath(screenshot.path),
    screenshotMs: Math.round(screenshot.elapsedMs * 10) / 10,
    lastSession: lastSession.value,
    actions,
    // 应用侧分阶段埋点：这是 CONTEXT.md 要求的「证明 DOM commit 是否为瓶颈」的证据。
    perfTrace,
    stageBreakdown: summarizeStages(perfTrace),
    domCommitMetric: perfTrace.status === 'ok'
      ? {
        status: 'instrumented',
        source: 'in-app performance marks written to appData/perf-trace.json',
        note: 'preview_dom_committed is measured after React commits html into #write; preview_painted is two rAF later.',
      }
      : {
        status: 'observableSubstitute',
        substitute: 'openCommandToLastSessionMs + openCommandToScreenshotMs in packaged Tauri WebView',
        reason: `in-app trace unavailable (${perfTrace.status}); tauri-driver is not installed in this environment.`,
      },
  };
}

/**
 * 把 trace 折成可读的阶段耗时。只做减法，不推断缺失阶段。
 */
function summarizeStages(perfTrace) {
  if (perfTrace.status !== 'ok') return { status: perfTrace.status };
  // 同名 mark 可重复出现（如 last_session_debounce_scheduled 每次内容变更都重排），
  // Map 保留最后一次——对防抖来说最后一次重排才是真正生效的那次。
  const at = new Map(perfTrace.marks.map((mark) => [mark.name, mark]));
  const pick = (name) => (at.has(name) ? at.get(name).atMs : null);
  const gap = (from, to) => {
    const a = pick(from);
    const b = pick(to);
    return a === null || b === null ? null : Math.round((b - a) * 10) / 10;
  };

  const markdown = at.get('preview_markdown_render');
  // 首个 preview_post_process 对应 html='' 的空渲染，耗时接近 0，不能当作真实后处理成本。
  // 只认 htmlLength > 0 的那次；若不存在则明确报缺失，不用空值冒充。
  const realPostProcess = perfTrace.marks
    .filter((mark) => mark.name === 'preview_post_process' && Number(mark.meta?.htmlLength) > 0)
    .pop();
  const debounceMs = gap('last_session_debounce_scheduled', 'last_session_write_start');

  return {
    status: 'ok',
    marks: perfTrace.marks.map((mark) => mark.name),
    documentReadMs: gap('document_read_start', 'document_read_done'),
    readToMarkdownDoneMs: gap('document_read_done', 'preview_markdown_render'),
    markdownRenderMs: markdown?.durationMs ?? null,
    markdownRenderMode: markdown?.meta?.mode ?? null,
    htmlLength: markdown?.meta?.htmlLength ?? null,
    markdownToDomCommitMs: gap('preview_markdown_render', 'preview_dom_committed'),
    domCommitToPaintMs: gap('preview_dom_committed', 'preview_painted'),
    postProcessMs: realPostProcess?.durationMs ?? null,
    postProcessScheduleDelayMs: realPostProcess?.meta?.scheduleDelayMs ?? null,
    postProcessNote: realPostProcess
      ? null
      : 'no post-process mark with htmlLength > 0 was captured; the only run observed was the initial empty render',
    lastSessionDebounceMs: debounceMs,
    // 防抖常量是 500ms（useAppLifecycleModel.ts）。超出部分表示定时器被主线程阻塞饿死，
    // 是「主线程在此期间不可响应」的直接证据。
    lastSessionDebounceOverrunMs: debounceMs === null
      ? null
      : Math.round((debounceMs - 500) * 10) / 10,
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

  const stageRows = report.results
    .filter((result) => result.stageBreakdown?.status === 'ok')
    .map((result) => {
      const stage = result.stageBreakdown;
      return [
        result.label,
        stage.documentReadMs ?? '-',
        stage.markdownRenderMs ?? '-',
        stage.markdownToDomCommitMs ?? '-',
        stage.domCommitToPaintMs ?? '-',
        stage.postProcessMs ?? '-',
        stage.lastSessionDebounceMs ?? '-',
      ];
    });

  const stageSection = stageRows.length > 0
    ? [
      '',
      '## Stage breakdown (in-app instrumentation)',
      '',
      'Measured by performance marks inside the packaged WebView, not inferred. `domCommit→paint` is two `requestAnimationFrame` ticks after React commits the HTML, so it approximates first paint rather than measuring compositing directly.',
      '',
      '| Fixture | doc read ms | markdown render ms | markdown→domCommit ms | domCommit→paint ms | post-process ms | lastSession debounce ms |',
      '|---|---:|---:|---:|---:|---:|---:|',
      ...stageRows.map((row) => `| ${row.join(' | ')} |`),
    ]
    : [
      '',
      '## Stage breakdown (in-app instrumentation)',
      '',
      '> Not available in this run. `perf-trace.json` was missing, empty, or unreadable — see `perfTrace.status` in the JSON report.',
    ];

  return [
    '# Prism Real WebView Preview Benchmark',
    '',
    `> Generated: ${report.generatedAt}`,
    '',
    'This benchmark launches the packaged Tauri `.app` with 1MB and 3MB Markdown fixtures.',
    '',
    '**Metric caveats.** `Visible ms` includes the cost of the `swift` window probe that detected it (~260ms warm, ~960ms cold); the JSON also reports `openCommandToVisibleEarliestMs` as the lower bound. `Last session ms` includes a 500ms lifecycle debounce plus up to 500ms of poll lag, so roughly 750ms of it is fixed harness cost independent of document size. Per-action `actionMs` measures the `osascript` process including its hardcoded delays and returns once keystrokes are delivered — it is not an app response time.',
    '',
    '| Fixture | View mode | Bytes | Status | Visible ms | Last session ms | Screenshot ms | Actions / error |',
    '|---|---:|---:|---|---:|---:|---:|---|',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    ...stageSection,
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
