import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanHeadingAnchorDiagnostics } from '../domains/editor/extensions/headingDiagnostics';
import { scanMarkdownLinks } from '../domains/editor/extensions/linkDiagnostics';
import { scanMarkdownTableDiagnostics } from '../domains/editor/extensions/tables';
import { scanChineseTypography } from '../domains/editor/extensions/typographyDiagnostics';

interface DocumentDiagnosticsBenchmarkSample {
  headingMs: number;
  linkMs: number;
  tableMs: number;
  typographyMs: number;
}

const RUN_DOCUMENT_DIAGNOSTICS_BENCHMARK = process.env.PRISM_DIAGNOSTICS_BENCH === '1';
const DOCUMENT_DIAGNOSTICS_BENCHMARK_FILE = process.env.PRISM_DIAGNOSTICS_BENCH_FILE;

function buildDiagnosticsBenchmarkMarkdown() {
  const parts = ['# Prism 诊断性能基准\n\n'];

  for (let index = 1; index <= 1600; index += 1) {
    parts.push(`## 第 ${index} 节\n\n`);
    parts.push(
      `这是Prism编辑器第${index}段,用于验证诊断扫描在长文中保持可控。` +
      `English${index}和中文之间故意缺少空格。\n\n`,
    );
    if (index % 20 === 0) {
      parts.push(`[本节链接](docs/section-${index}.md#第-${index}-节)\n\n`);
    }
    if (index % 40 === 0) {
      parts.push('| 项目 | 状态 |\n| --- | --- |\n| 预览 | 通过 |\n\n');
    }
  }

  return parts.join('');
}

function readBenchmarkContent() {
  return DOCUMENT_DIAGNOSTICS_BENCHMARK_FILE
    ? readFileSync(DOCUMENT_DIAGNOSTICS_BENCHMARK_FILE, 'utf8')
    : buildDiagnosticsBenchmarkMarkdown();
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

function runDocumentDiagnosticsBenchmark(iterations = 3) {
  const content = readBenchmarkContent();
  const samples: DocumentDiagnosticsBenchmarkSample[] = [];

  scanHeadingAnchorDiagnostics(content);
  scanMarkdownLinks(content);
  scanMarkdownTableDiagnostics(content);
  scanChineseTypography(content);

  for (let index = 0; index < iterations; index += 1) {
    const heading = measure(() => scanHeadingAnchorDiagnostics(content));
    const links = measure(() => scanMarkdownLinks(content));
    const tables = measure(() => scanMarkdownTableDiagnostics(content));
    const typography = measure(() => scanChineseTypography(content));

    samples.push({
      headingMs: heading.elapsedMs,
      linkMs: links.elapsedMs,
      tableMs: tables.elapsedMs,
      typographyMs: typography.elapsedMs,
    });
  }

  return {
    contentLength: content.length,
    lineCount: content.split('\n').length,
    samples: samples.map((sample) => ({
      headingMs: roundMs(sample.headingMs),
      linkMs: roundMs(sample.linkMs),
      tableMs: roundMs(sample.tableMs),
      typographyMs: roundMs(sample.typographyMs),
    })),
    summary: {
      headingMs: roundMs(median(samples.map((sample) => sample.headingMs))),
      linkMs: roundMs(median(samples.map((sample) => sample.linkMs))),
      tableMs: roundMs(median(samples.map((sample) => sample.tableMs))),
      typographyMs: roundMs(median(samples.map((sample) => sample.typographyMs))),
    },
  };
}

describe.skipIf(!RUN_DOCUMENT_DIAGNOSTICS_BENCHMARK)('Document diagnostics performance benchmark', () => {
  it('records synchronous diagnostics scan timings for a large document', () => {
    const result = runDocumentDiagnosticsBenchmark();

    console.table(result.samples);
    console.info('[Prism document diagnostics benchmark]', JSON.stringify({
      contentLength: result.contentLength,
      lineCount: result.lineCount,
      summary: result.summary,
    }, null, 2));

    expect(result.contentLength).toBeGreaterThan(100_000);
  }, 120_000);
});
