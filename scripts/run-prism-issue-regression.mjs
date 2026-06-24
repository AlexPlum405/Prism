#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASELINE = 'docs/reviews/prism-full-feature-test-2026-06-22';
const DEFAULT_OUTPUT_NAME = 'fix-verification-2026-06-23';
const EXPECTED_BUNDLE_ID = 'com.prism.editor.v1';

function parseArgs(argv) {
  const args = {
    app: '/Applications/Prism.app',
    baseline: DEFAULT_BASELINE,
    output: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--app') {
      args.app = argv[index + 1];
      index += 1;
    } else if (arg === '--baseline') {
      args.baseline = argv[index + 1];
      index += 1;
    } else if (arg === '--output') {
      args.output = argv[index + 1];
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.app || !args.baseline) {
    throw new Error('--app and --baseline are required');
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/run-prism-issue-regression.mjs --app /Applications/Prism.app --baseline docs/reviews/prism-full-feature-test-2026-06-22

Options:
  --app       Path to Prism.app. Defaults to /Applications/Prism.app
  --baseline  Existing full-feature test evidence directory.
  --output    Optional output directory. Defaults to <baseline>/fix-verification-2026-06-23
`);
}

async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function inspectBundle(appPath) {
  const infoPlist = path.join(appPath, 'Contents/Info.plist');
  if (!existsSync(appPath)) {
    return { exists: false, infoPlist, bundleIdentifier: null, bundleName: null, raw: '' };
  }
  if (!existsSync(infoPlist)) {
    return { exists: true, infoPlist, bundleIdentifier: null, bundleName: null, raw: '' };
  }

  const raw = run('plutil', ['-p', infoPlist]);
  const bundleIdentifier = raw.match(/"CFBundleIdentifier"\s*=>\s*"([^"]+)"/)?.[1] ?? null;
  const bundleName = raw.match(/"CFBundleName"\s*=>\s*"([^"]+)"/)?.[1] ?? null;
  return { exists: true, infoPlist, bundleIdentifier, bundleName, raw };
}

function collectIssueRefs(issuesText) {
  return [...issuesText.matchAll(/^##\s+(ISSUE-\d+)/gm)].map((match) => match[1]);
}

function caseById(manifest, id) {
  return manifest.cases.find((item) => item.id === id) ?? null;
}

function sourceCheck(label, filePath, patterns) {
  const absolutePath = path.resolve(filePath);
  if (!existsSync(absolutePath)) {
    return {
      label,
      file: filePath,
      status: 'Fail',
      missing: patterns.map((pattern) => String(pattern)),
    };
  }
  const text = execFileSync('sed', ['-n', '1,2600p', absolutePath], { encoding: 'utf8' });
  const missing = patterns
    .filter((pattern) => !new RegExp(pattern).test(text))
    .map((pattern) => String(pattern));

  return {
    label,
    file: filePath,
    status: missing.length === 0 ? 'Pass' : 'Fail',
    missing,
  };
}

function summarizeStatus(items) {
  return items.reduce((summary, item) => {
    const key = item.status.split(':')[0];
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

function markdownTable(rows) {
  if (rows.length === 0) return '';
  const [header, ...body] = rows;
  const separator = header.map(() => '---');
  return [header, separator, ...body].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baselineDir = path.resolve(args.baseline);
  const outputDir = path.resolve(args.output ?? path.join(baselineDir, DEFAULT_OUTPUT_NAME));
  const screenshotsDir = path.join(outputDir, 'screenshots');
  const templatesDir = path.join(outputDir, 'platform-backfill');

  const baselineFiles = {
    manifest: path.join(baselineDir, 'manifest.json'),
    issues: path.join(baselineDir, 'issues.md'),
    report: path.join(baselineDir, 'test-report.md'),
  };

  for (const [name, filePath] of Object.entries(baselineFiles)) {
    if (!existsSync(filePath)) {
      throw new Error(`Missing baseline ${name}: ${filePath}`);
    }
  }

  const [manifest, issuesText, reportText] = await Promise.all([
    readJson(baselineFiles.manifest),
    readText(baselineFiles.issues),
    readText(baselineFiles.report),
  ]);

  const bundle = inspectBundle(path.resolve(args.app));
  const sourceChecks = [
    sourceCheck('ContextMenu Escape closes overlays', 'src/components/shell/ContextMenu.tsx', [
      'keydown',
      'Escape',
      'removeEventListener\\(\\s*[\'"]keydown[\'"]',
    ]),
    sourceCheck('Selection context menu keeps link action', 'src/domains/editor/extensions/contextMenu.ts', [
      "commandItem\\('link'",
      'disabled:\\s*!hasSelection',
    ]),
    sourceCheck('Selection background right-click keeps current selection', 'src/domains/editor/components/useEditorRuntimeModel.ts', [
      'cm-selectionBackground',
      'rightClickedInsideSelection',
    ]),
    sourceCheck('Table menu exposes TSV copy', 'src/domains/editor/extensions/contextMenu.ts', [
      "commandItem\\('copyTableTsv'",
    ]),
    sourceCheck('Preview replace switches to split before opening replace panel', 'src/domains/editor/components/SplitView.tsx', [
      "mode\\s*===\\s*'replace'",
      "setViewMode\\('split'\\)",
    ]),
    sourceCheck('Export success result emits actionable toast', 'src/hooks/useExportTaskUi.ts', [
      "detail\\.status\\s*===\\s*'success'",
      'openPathWithSystemNative',
      'revealPathInFileManager',
      "tone:\\s*'success'",
    ]),
    sourceCheck('Update available state uses an actionable final toast', 'src/domains/commands/registry.ts', [
      'context\\.showToast',
      'github\\.com/AlexPlum405/Prism/releases/latest',
      "title:\\s*t\\('command\\.checkUpdate'\\)",
    ]),
  ];

  const baselineCaseIds = [
    'TC-P0-005',
    'TC-P0-006',
    'TC-P0-010',
    'TC-P0-034',
    'TC-P0-038',
    'TC-P0-062',
    'TC-P0-078',
    'TC-P0-088',
    'TC-P1-060',
  ];
  const scopeCorrectedCaseIds = new Set(['TC-P0-005', 'TC-P0-006']);
  const baselineCases = baselineCaseIds.map((id) => {
    const testCase = caseById(manifest, id);
    return {
      id,
      found: Boolean(testCase),
      status: testCase?.status ?? (scopeCorrectedCaseIds.has(id) ? 'ScopeCorrected' : 'Missing'),
      issueRef: testCase?.issueRef ?? '',
      screenshot: testCase?.screenshot ?? '',
    };
  });

  const issueRefs = collectIssueRefs(issuesText);
  const regressionItems = [
    {
      id: 'REG-ISSUE-001',
      issueRef: 'ISSUE-001',
      baselineCase: 'TC-P0-010',
      title: '选区右键菜单进入可复制/可链接状态',
      automatedEvidence: [
        'src/domains/editor/extensions/contextMenu.test.ts',
        'src/domains/editor/components/EditorPane.integration.test.tsx',
      ],
      status: 'ReadyForTestRun',
      appScreenshotRequired: true,
      screenshotTarget: 'screenshots/01-selection-context-menu-fixed.png',
      acceptance: '选中标题、段落或代码文字后右键，复制与链接均启用，并能作用于原选区。',
    },
    {
      id: 'REG-ISSUE-002',
      issueRef: 'ISSUE-002',
      baselineCase: 'TC-P0-062',
      title: '表格右键菜单包含 TSV 复制',
      automatedEvidence: ['src/domains/editor/extensions/contextMenu.test.ts'],
      status: 'ReadyForTestRun',
      appScreenshotRequired: true,
      screenshotTarget: 'screenshots/02-table-copy-tsv-fixed.png',
      acceptance: '表格右键菜单同时包含 Markdown、HTML、CSV、TSV 复制入口。',
    },
    {
      id: 'REG-ISSUE-003',
      issueRef: 'ISSUE-003',
      baselineCase: 'TC-P0-019/TC-P0-020',
      title: '自绘上下文菜单支持 Escape 关闭',
      automatedEvidence: ['src/components/shell/ContextMenu.test.tsx'],
      status: 'ReadyForTestRun',
      appScreenshotRequired: false,
      screenshotTarget: '',
      acceptance: '文件树、编辑区、表格菜单打开后按一次 Escape 关闭。',
    },
    {
      id: 'REG-ISSUE-005',
      issueRef: 'ISSUE-005',
      baselineCase: 'TC-P0-088',
      title: '检查更新有最终态反馈',
      automatedEvidence: ['src/domains/commands/registry.test.ts'],
      status: 'ReadyForTestRun',
      appScreenshotRequired: true,
      screenshotTarget: 'screenshots/03-check-update-final-state.png',
      acceptance: '检查更新后能看到最新、不可用、发现更新或失败中的一种最终态。',
    },
    {
      id: 'REG-ISSUE-008',
      issueRef: 'ISSUE-008',
      baselineCase: 'TC-P0-034',
      title: '预览模式触发替换自动进入 split 并打开替换面板',
      automatedEvidence: ['src/domains/editor/components/SplitView.test.tsx'],
      status: 'ReadyForTestRun',
      appScreenshotRequired: true,
      screenshotTarget: 'screenshots/04-preview-replace-split-fixed.png',
      acceptance: '预览模式触发替换不会静默降级为查找，界面切到分栏并展示替换输入。',
    },
    {
      id: 'REG-ISSUE-012',
      issueRef: 'ISSUE-012',
      baselineCase: 'TC-P0-078',
      title: '导出成功 toast 稳定显示后续动作',
      automatedEvidence: ['src/hooks/useExportTaskUi.test.tsx'],
      status: 'ReadyForTestRun',
      appScreenshotRequired: true,
      screenshotTarget: 'screenshots/05-export-success-toast-fixed.png',
      acceptance: '导出成功 toast 包含打开与显示位置动作；打开失败和显示位置失败均有错误反馈。',
    },
  ];

  const policyCorrections = [
    {
      id: 'POLICY-ISSUE-004',
      issueRef: 'ISSUE-004',
      status: 'ScopeCorrected',
      correction: '不恢复旧通用命令面板；验收对象改为 Quick Open 与 Workspace Search。',
      verification: '测试计划和后续 manifest 使用 quick-open / workspace-search 命名，不再要求通用命令列表默认态。',
    },
    {
      id: 'POLICY-ISSUE-009',
      issueRef: 'ISSUE-009',
      status: 'ScopeCorrected',
      correction: '导出清晰度保持离散下拉控件，不改成 slider。',
      verification: 'TC-P1-060 后续验收改为当前档位可见、选项可切换并保存。',
    },
    {
      id: 'POLICY-ISSUE-011',
      issueRef: 'ISSUE-011',
      status: 'ScopeCorrected',
      correction: '不新增视图菜单行号入口；行号验收改为“设置 > 写作 > 显示行号”。',
      verification: '后续截图应覆盖设置写作分区的显示行号开关，而不是视图菜单。',
    },
    {
      id: 'POLICY-P2-PLATFORM',
      issueRef: 'ISSUE-007',
      status: 'Blocked: no device',
      correction: 'Windows/Linux 只提供真机回填模板，当前 macOS 环境不伪造验证。',
      verification: '需要 Windows/Linux 真机或真实图形环境补截图、版本、文件关联结果。',
    },
  ];

  const generatedAt = new Date().toISOString();
  const delta = {
    generatedAt,
    app: {
      path: path.resolve(args.app),
      exists: bundle.exists,
      bundleIdentifier: bundle.bundleIdentifier,
      bundleName: bundle.bundleName,
      expectedBundleIdentifier: EXPECTED_BUNDLE_ID,
      status: bundle.exists && bundle.bundleIdentifier === EXPECTED_BUNDLE_ID ? 'Pass' : 'Fail',
    },
    baseline: {
      path: baselineDir,
      manifestCases: manifest.cases.length,
      policy: manifest.policy ?? null,
      issueRefs,
      containsExpectedReportSections: {
        quickOpen: /快速打开/.test(reportText),
        workspaceSearch: /全文搜索/.test(reportText),
        windowsLinuxNoDevice: /Windows\/Linux|no device/.test(`${reportText}\n${issuesText}`),
      },
      cases: baselineCases,
    },
    sourceChecks,
    regressionItems,
    policyCorrections,
    summary: {
      sourceChecks: summarizeStatus(sourceChecks),
      regressionItems: summarizeStatus(regressionItems),
      policyCorrections: summarizeStatus(policyCorrections),
      screenshotsGenerated: 0,
      screenshotPolicy: '本脚本不伪造 UI 截图。修复后截图需在已替换 /Applications/Prism.app 后按 regressionItems.screenshotTarget 重新捕获。',
    },
  };

  const failedChecks = [
    delta.app.status === 'Pass' ? null : `Unexpected app identity: ${delta.app.bundleIdentifier ?? 'unknown'}`,
    ...sourceChecks.filter((item) => item.status !== 'Pass').map((item) => `${item.label}: missing ${item.missing.join(', ')}`),
    ...baselineCases
      .filter((item) => !item.found && item.status !== 'ScopeCorrected')
      .map((item) => `Missing baseline case ${item.id}`),
  ].filter(Boolean);

  await mkdir(outputDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(templatesDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'manifest-delta.json'),
    `${JSON.stringify(delta, null, 2)}\n`,
    'utf8',
  );

  const fixReport = [
    '# Prism 问题修复回归报告（2026-06-23）',
    '',
    '## 总体结论',
    '',
    failedChecks.length === 0
      ? '自动检查通过：baseline 证据目录完整，目标 App bundle 身份正确，当前源码包含本轮计划要求的修复点。'
      : `自动检查未完全通过：${failedChecks.join('；')}。`,
    '',
    '本报告只记录代码修复后的自动化证据和后续截图口径，不覆盖 `manifest.json`、`test-report.md`、`issues.md` 或旧截图。真实 UI 修复后截图需要在新构建替换 `/Applications/Prism.app` 后执行回填。',
    '',
    '## App 与 Baseline',
    '',
    markdownTable([
      ['项目', '结果'],
      ['App 路径', delta.app.path],
      ['Bundle ID', delta.app.bundleIdentifier ?? 'unknown'],
      ['Bundle Name', delta.app.bundleName ?? 'unknown'],
      ['Baseline cases', String(delta.baseline.manifestCases)],
      ['Baseline issues', issueRefs.join(', ')],
    ]),
    '',
    '## 源码修复点自动检查',
    '',
    markdownTable([
      ['检查项', '文件', '状态'],
      ...sourceChecks.map((item) => [item.label, item.file, item.status]),
    ]),
    '',
    '## 修复项回归清单',
    '',
    markdownTable([
      ['ID', 'Issue', '基线用例', '状态', '修复后截图目标', '验收标准'],
      ...regressionItems.map((item) => [
        item.id,
        item.issueRef,
        item.baselineCase,
        item.status,
        item.screenshotTarget || '无需截图',
        item.acceptance,
      ]),
    ]),
    '',
    '## 测试口径修正',
    '',
    '- 通用命令面板不恢复，验收改为 Quick Open / Workspace Search。',
    '- 导出清晰度保持下拉控件，不改 slider；验收为档位可见、可切换、可保存。',
    '- 行号入口不加到视图菜单；验收改为 `设置 > 写作 > 显示行号`。',
    '- Windows/Linux 必须真机验证；当前只生成回填模板，标记为 `Blocked: no device`。',
    '',
    '## 建议验证命令',
    '',
    '```bash',
    'npm test -- --run src/components/shell/ContextMenu.test.tsx src/domains/editor/extensions/contextMenu.test.ts src/domains/editor/components/SearchPanel.test.tsx src/domains/editor/components/SplitView.test.tsx',
    'npm test -- --run src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/commands/registry.test.ts',
    'node scripts/run-prism-issue-regression.mjs --app /Applications/Prism.app --baseline docs/reviews/prism-full-feature-test-2026-06-22',
    'npm run build',
    'git diff --check',
    '```',
    '',
    '## 未验证风险',
    '',
    '- 本脚本不启动或操作桌面 UI，不能替代修复后真机截图。',
    '- 如果 `/Applications/Prism.app` 尚未被当前源码构建产物替换，截图仍会反映旧版本 App。',
    '- Windows/Linux 文件关联、标题栏和字体 fallback 仍需真机补充。',
    '',
  ].join('\n');

  await writeFile(path.join(outputDir, 'fix-report.md'), fixReport, 'utf8');

  const platformTemplate = [
    '# Windows / Linux 真机回填模板',
    '',
    '本模板只用于真实设备或真实图形环境回填；不要用推测结果替代。',
    '',
    '## Windows',
    '',
    '- 设备/系统版本：',
    '- Prism 版本与构建号：',
    '- 安装包来源：',
    '- 文件关联验证：`.md` / `.txt` / `.json` / `.sql`',
    '- 标题栏截图：',
    '- 文件关联双击截图：',
    '- 结果：Pass / Fail',
    '- 备注：',
    '',
    '## Linux',
    '',
    '- 发行版/桌面环境：',
    '- Prism 版本与构建号：',
    '- 安装包来源：',
    '- 文件关联验证：`.md` / `.txt` / `.json` / `.sql`',
    '- 标题栏截图：',
    '- 文件关联双击截图：',
    '- 结果：Pass / Fail',
    '- 备注：',
    '',
    '## 跨平台字体 Fallback',
    '',
    '- 中文正文：',
    '- 英文正文：',
    '- 代码块：',
    '- 表格：',
    '- 暗色模式：',
    '- 结果：Pass / Fail',
    '',
  ].join('\n');

  await writeFile(path.join(outputDir, 'platform-backfill-template.md'), platformTemplate, 'utf8');
  await writeFile(path.join(templatesDir, 'windows-linux.md'), platformTemplate, 'utf8');
  await writeFile(
    path.join(screenshotsDir, 'README.md'),
    [
      '# 修复后截图目录',
      '',
      '这里保留给修复后真机截图。脚本不会生成占位 PNG，也不会复用旧截图。',
      '',
      '建议截图文件：',
      ...regressionItems
        .filter((item) => item.screenshotTarget)
        .map((item) => `- ${item.screenshotTarget}: ${item.title}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Wrote ${path.relative(process.cwd(), outputDir)}`);
  console.log(`Source checks: ${JSON.stringify(delta.summary.sourceChecks)}`);

  if (failedChecks.length > 0) {
    console.error(failedChecks.join('\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
