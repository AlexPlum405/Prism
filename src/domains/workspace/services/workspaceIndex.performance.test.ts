import { describe, expect, it } from 'vitest';
import type { FileNode } from '../types';
import { buildWorkspaceIndex, searchWorkspaceIndex } from './workspaceIndex';

const RUN_WORKSPACE_INDEX_BENCHMARK = process.env.PRISM_WORKSPACE_INDEX_BENCH === '1';

function buildWorkspaceIndexFixture(linkCount = 1500) {
  const targetFiles: FileNode[] = Array.from({ length: linkCount }, (_, index) => ({
    kind: 'file',
    modifiedAt: index + 1,
    name: `target-${index}.md`,
    path: `/workspace/docs/target-${index}.md`,
    size: 32,
  }));
  const fileTree: FileNode[] = [
    {
      children: [
        {
          kind: 'file',
          modifiedAt: 10_000,
          name: 'source.md',
          path: '/workspace/docs/source.md',
          size: 200_000,
        },
        ...targetFiles,
      ],
      kind: 'directory',
      name: 'docs',
      path: '/workspace/docs',
    },
  ];
  const sourceContent = [
    '# Source',
    '',
    ...Array.from({ length: linkCount }, (_, index) => (
      `第 ${index} 行链接到 [target-${index}](target-${index}.md)，用于构建 backlink 摘录。`
    )),
  ].join('\n');
  const documents = [
    {
      content: sourceContent,
      path: '/workspace/docs/source.md',
    },
    ...targetFiles.map((file, index) => ({
      content: `# Target ${index}`,
      path: file.path,
    })),
  ];

  return { documents, fileTree, linkCount };
}

function buildWorkspaceSearchFixture(documentCount = 600) {
  const fileTree: FileNode[] = [
    {
      children: Array.from({ length: documentCount }, (_, index) => ({
        kind: 'file',
        modifiedAt: index + 1,
        name: `note-${index}.md`,
        path: `/workspace/notes/note-${index}.md`,
        size: 4096,
      })),
      kind: 'directory',
      name: 'notes',
      path: '/workspace/notes',
    },
  ];
  const documents = Array.from({ length: documentCount }, (_, index) => ({
    content: [
      `# Note ${index}`,
      '',
      `这是一篇用于搜索性能基准的长文档 ${index}。`,
      ...Array.from({ length: 20 }, (__, paragraph) => (
        `段落 ${paragraph} 包含 Prism workspace search benchmark 内容，以及少量中文和 English words。`
      )),
      index % 10 === 0 ? 'needle target content' : 'ordinary content',
    ].join('\n'),
    path: `/workspace/notes/note-${index}.md`,
  }));

  return { documents, fileTree, queryCount: 5 };
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

describe.skipIf(!RUN_WORKSPACE_INDEX_BENCHMARK)('workspace index performance benchmark', () => {
  it('records index build time for a document with many backlinks', () => {
    const fixture = buildWorkspaceIndexFixture();
    const samples: number[] = [];

    buildWorkspaceIndex({
      documents: fixture.documents,
      fileTree: fixture.fileTree,
      workspaceRoot: '/workspace',
    });

    for (let index = 0; index < 3; index += 1) {
      const result = measure(() => buildWorkspaceIndex({
        documents: fixture.documents,
        fileTree: fixture.fileTree,
        workspaceRoot: '/workspace',
      }));
      samples.push(result.elapsedMs);
      expect(result.value.backlinksByPath.size).toBe(fixture.linkCount);
    }

    const summary = {
      buildMs: roundMs(median(samples)),
      documentCount: fixture.documents.length,
      linkCount: fixture.linkCount,
    };
    console.table(samples.map((buildMs) => ({ buildMs: roundMs(buildMs) })));
    console.info('[Prism workspace index benchmark]', JSON.stringify(summary, null, 2));

    expect(summary.buildMs).toBeGreaterThan(0);
  }, 120_000);

  it('records repeated full-text search time on a large workspace index', () => {
    const fixture = buildWorkspaceSearchFixture();
    const index = buildWorkspaceIndex({
      documents: fixture.documents,
      fileTree: fixture.fileTree,
      workspaceRoot: '/workspace',
    });
    const queries = ['needle', 'benchmark', 'workspace', 'English', 'missing-query'];
    const samples: number[] = [];

    searchWorkspaceIndex(index, 'warmup');

    for (let sampleIndex = 0; sampleIndex < 3; sampleIndex += 1) {
      const result = measure(() => {
        return queries.flatMap((query) => searchWorkspaceIndex(index, query, 20));
      });
      samples.push(result.elapsedMs);
      expect(result.value.length).toBeGreaterThan(0);
    }

    const summary = {
      documentCount: index.documents.length,
      queryCount: fixture.queryCount,
      repeatedSearchMs: roundMs(median(samples)),
    };
    console.table(samples.map((repeatedSearchMs) => ({ repeatedSearchMs: roundMs(repeatedSearchMs) })));
    console.info('[Prism workspace search benchmark]', JSON.stringify(summary, null, 2));

    expect(summary.repeatedSearchMs).toBeGreaterThan(0);
  }, 120_000);
});
