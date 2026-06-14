import { describe, expect, it } from 'vitest';
import { scanMarkdownLinks } from './linkDiagnostics';

const RUN_LINK_DIAGNOSTICS_BENCHMARK = process.env.PRISM_LINK_DIAGNOSTICS_BENCH === '1';

function buildLinkedMarkdown(linkCount = 1200) {
  return Array.from({ length: linkCount }, (_, index) => (
    `[文档 ${index}](docs/doc-${index}.md) [标题 ${index}](#标题-${index})`
  )).join('\n');
}

function buildWorkspaceFiles(fileCount = 4000) {
  return Array.from({ length: fileCount }, (_, index) => `/workspace/docs/doc-${index}.md`);
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
});
