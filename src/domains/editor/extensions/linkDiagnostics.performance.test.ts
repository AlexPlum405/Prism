import { describe, expect, it } from 'vitest';
import {
  createMarkdownLinkWorkspaceFileSet,
  scanMarkdownLinks,
} from './linkDiagnostics';

const RUN_LINK_DIAGNOSTICS_BENCHMARK = process.env.PRISM_LINK_DIAGNOSTICS_BENCH === '1';

function buildLinkedMarkdown(linkCount = 1200) {
  return Array.from({ length: linkCount }, (_, index) => (
    `[文档 ${index}](docs/doc-${index}.md) [标题 ${index}](#标题-${index})`
  )).join('\n');
}

function buildWorkspaceFiles(fileCount = 4000) {
  return Array.from({ length: fileCount }, (_, index) => `/workspace/docs/doc-${index}.md`);
}

function buildRepeatedEditMarkdownSamples(sampleCount = 30) {
  return Array.from({ length: sampleCount }, (_, index) => [
    `# 编辑样本 ${index}`,
    '',
    `[当前文档](docs/doc-${index}.md) [相邻文档](docs/doc-${index + 1}.md)`,
    `[缺失文档](docs/missing-${index}.md)`,
  ].join('\n'));
}

function measure<T>(fn: () => T): { elapsedMs: number; value: T } {
  const startedAt = performance.now();
  const value = fn();
  return {
    elapsedMs: performance.now() - startedAt,
    value,
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function roundMs(value: number) {
  return Math.round(value * 10) / 10;
}

describe.skipIf(!RUN_LINK_DIAGNOSTICS_BENCHMARK)('scanMarkdownLinks performance benchmark', () => {
  it('records scan time for many document links against a large workspace', () => {
    const content = buildLinkedMarkdown();
    const workspaceFiles = buildWorkspaceFiles();
    const samples: number[] = [];

    scanMarkdownLinks(content, {
      currentPath: '/workspace/current.md',
      workspaceFiles,
      workspaceRoot: '/workspace',
    });

    for (let index = 0; index < 3; index += 1) {
      const result = measure(() => scanMarkdownLinks(content, {
        currentPath: '/workspace/current.md',
        workspaceFiles,
        workspaceRoot: '/workspace',
      }));
      samples.push(result.elapsedMs);
      expect(result.value.length).toBeGreaterThan(0);
    }

    const roundedSamples = samples.map(roundMs);
    const summary = {
      linkCount: 1200,
      workspaceFileCount: workspaceFiles.length,
      scanMs: roundMs(median(samples)),
    };
    console.table(roundedSamples.map((scanMs) => ({ scanMs })));
    console.info('[Prism link diagnostics benchmark]', JSON.stringify(summary, null, 2));

    expect(summary.scanMs).toBeGreaterThan(0);
  }, 120_000);

  it('records repeated scan time when workspace files stay stable across edits', () => {
    const contents = buildRepeatedEditMarkdownSamples();
    const workspaceFiles = buildWorkspaceFiles(8000);
    const normalizedWorkspaceFiles = createMarkdownLinkWorkspaceFileSet(workspaceFiles);

    scanMarkdownLinks(contents[0], {
      currentPath: '/workspace/current.md',
      normalizedWorkspaceFiles,
      workspaceRoot: '/workspace',
    });

    const rebuildWorkspaceSet = measure(() => {
      return contents.flatMap((content) => scanMarkdownLinks(content, {
        currentPath: '/workspace/current.md',
        workspaceFiles,
        workspaceRoot: '/workspace',
      }));
    });
    const reuseWorkspaceSet = measure(() => {
      return contents.flatMap((content) => scanMarkdownLinks(content, {
        currentPath: '/workspace/current.md',
        normalizedWorkspaceFiles,
        workspaceRoot: '/workspace',
      }));
    });

    const summary = {
      editCount: contents.length,
      rebuildWorkspaceSetMs: roundMs(rebuildWorkspaceSet.elapsedMs),
      reuseWorkspaceSetMs: roundMs(reuseWorkspaceSet.elapsedMs),
      workspaceFileCount: workspaceFiles.length,
    };
    console.info('[Prism repeated link diagnostics benchmark]', JSON.stringify(summary, null, 2));

    expect(rebuildWorkspaceSet.value.length).toBe(reuseWorkspaceSet.value.length);
    expect(summary.reuseWorkspaceSetMs).toBeLessThan(summary.rebuildWorkspaceSetMs);
  }, 120_000);
});
