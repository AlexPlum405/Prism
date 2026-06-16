import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../../../lib/markdownToHtml';
import {
  collectPreviewDomPostProcessTargets,
  getPreviewDomTargetHints,
} from './previewDomTargets';
import {
  buildPreviewScrollMap,
  collectCodeLineElements,
  lineToPreviewScrollTopInMap,
  pageOffsetToLineInMap,
} from './previewScrollMap';

interface PreviewBenchmarkSample {
  markdownToHtmlMs: number;
  domWriteMs: number;
  domTargetScanMs: number;
  domDiagnosticsScanMs: number;
  scrollSyncScanMs: number;
  scrollMapBuildMs: number;
  scrollMapLookupMs: number;
  htmlLength: number;
  totalElementCount: number;
  totalAttributeCount: number;
  sourceLineAttributeCount: number;
  dataLineAttributeCount: number;
  maxAttributesPerElement: number;
  tableElementCount: number;
  tableSectionElementCount: number;
  tableRowElementCount: number;
  tableCellElementCount: number;
  simpleTableElementCount: number;
  simpleTableCellElementCount: number;
  paragraphElementCount: number;
  headingElementCount: number;
  listElementCount: number;
  listItemElementCount: number;
  preElementCount: number;
  codeElementCount: number;
  mediaElementCount: number;
  katexPlaceholderElementCount: number;
  mermaidPlaceholderElementCount: number;
  mediaTargetCount: number;
  katexErrorCount: number;
  mermaidPlaceholderCount: number;
  sourceLineElementCount: number;
  codeLineElementCount: number;
}

interface PreviewDomDiagnostics {
  totalElementCount: number;
  totalAttributeCount: number;
  sourceLineAttributeCount: number;
  dataLineAttributeCount: number;
  maxAttributesPerElement: number;
  tableElementCount: number;
  tableSectionElementCount: number;
  tableRowElementCount: number;
  tableCellElementCount: number;
  simpleTableElementCount: number;
  simpleTableCellElementCount: number;
  paragraphElementCount: number;
  headingElementCount: number;
  listElementCount: number;
  listItemElementCount: number;
  preElementCount: number;
  codeElementCount: number;
  mediaElementCount: number;
  katexPlaceholderElementCount: number;
  mermaidPlaceholderElementCount: number;
}

const RUN_PREVIEW_BENCHMARK = process.env.PRISM_PREVIEW_BENCH === '1';
const DEBUG_PREVIEW_BENCHMARK = process.env.PRISM_PREVIEW_BENCH_DEBUG === '1';
const PREVIEW_BENCHMARK_FILE = process.env.PRISM_PREVIEW_BENCH_FILE;
const ONE_MEGABYTE = 1024 * 1024;
const LARGE_PREVIEW_RENDER_OPTIONS = {
  autoDetectUnlabeledCode: false,
  frontMatterMode: 'metadata' as const,
  highlightCode: false,
  lightweightTables: true,
  renderMath: false,
};

function buildPreviewBenchmarkSection(index: number) {
  const language = index % 4 === 0 ? 'ts' : index % 4 === 1 ? 'js' : index % 4 === 2 ? 'json' : '';
  const codeFence = language ? `\`\`\`${language}` : '```';
  return [
    `## 章节 ${index}`,
    '',
    `这是一段用于完整预览性能基准的中文长文内容，第 ${index} 段包含 **加粗**、==高亮==、[[内部链接 ${index}]] 与 [外部链接](https://example.com/docs/${index})。`,
    '',
    '> [!NOTE]',
    `> 这里是第 ${index} 个 callout，用来覆盖块引用增强路径。`,
    '',
    '| 项目 | 状态 | 备注 |',
    '| --- | --- | --- |',
    `| 渲染 | 进行中 | 表格行 ${index} |`,
    `| 校验 | 通过 | ${'内容 '.repeat(12)} |`,
    '',
    codeFence,
    `const section${index} = ${JSON.stringify({
      index,
      title: `章节 ${index}`,
      enabled: index % 2 === 0,
      tags: ['preview', 'benchmark', 'markdown'],
    }, null, 2)};`,
    '```',
    '',
    index % 5 === 0
      ? ['```mermaid', `graph TD; A${index}[开始] --> B${index}[完整预览]; B${index} --> C${index}[完成]`, '```'].join('\n')
      : '',
    '',
    index % 6 === 0 ? `![本地图片](assets/preview-${index}.png)` : '',
    '',
    index % 7 === 0 ? `块级公式：$$E_${index}=mc^2$$` : `行内公式 $a_${index}^2 + b_${index}^2 = c_${index}^2$。`,
    '',
  ].join('\n');
}

function buildPreviewBenchmarkMarkdown(targetBytes = ONE_MEGABYTE) {
  const header = [
    '---',
    'title: Prism 完整预览性能基准',
    'tags: preview, benchmark, markdown',
    'status: verification',
    '---',
    '',
    '# Prism 完整预览性能基准',
    '',
  ].join('\n');
  const sections: string[] = [header];
  let index = 1;
  while (sections.join('\n').length < targetBytes) {
    sections.push(buildPreviewBenchmarkSection(index));
    index += 1;
  }
  return sections.join('\n');
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

function logBenchmarkDebug(index: number, stage: string, elapsedMs: number) {
  if (!DEBUG_PREVIEW_BENCHMARK) return;
  console.info('[Prism preview benchmark debug]', {
    index,
    stage,
    elapsedMs: roundMs(elapsedMs),
  });
}

function logBenchmarkDebugMessage(stage: string, data: Record<string, unknown> = {}) {
  if (!DEBUG_PREVIEW_BENCHMARK) return;
  console.info('[Prism preview benchmark debug]', { stage, ...data });
}

function summarize(samples: PreviewBenchmarkSample[]) {
  return {
    markdownToHtmlMs: roundMs(median(samples.map((sample) => sample.markdownToHtmlMs))),
    domWriteMs: roundMs(median(samples.map((sample) => sample.domWriteMs))),
    domTargetScanMs: roundMs(median(samples.map((sample) => sample.domTargetScanMs))),
    domDiagnosticsScanMs: roundMs(median(samples.map((sample) => sample.domDiagnosticsScanMs))),
    scrollSyncScanMs: roundMs(median(samples.map((sample) => sample.scrollSyncScanMs))),
    scrollMapBuildMs: roundMs(median(samples.map((sample) => sample.scrollMapBuildMs))),
    scrollMapLookupMs: roundMs(median(samples.map((sample) => sample.scrollMapLookupMs))),
    htmlLength: samples.at(-1)?.htmlLength ?? 0,
    totalElementCount: samples.at(-1)?.totalElementCount ?? 0,
    totalAttributeCount: samples.at(-1)?.totalAttributeCount ?? 0,
    sourceLineAttributeCount: samples.at(-1)?.sourceLineAttributeCount ?? 0,
    dataLineAttributeCount: samples.at(-1)?.dataLineAttributeCount ?? 0,
    maxAttributesPerElement: samples.at(-1)?.maxAttributesPerElement ?? 0,
    tableElementCount: samples.at(-1)?.tableElementCount ?? 0,
    tableSectionElementCount: samples.at(-1)?.tableSectionElementCount ?? 0,
    tableRowElementCount: samples.at(-1)?.tableRowElementCount ?? 0,
    tableCellElementCount: samples.at(-1)?.tableCellElementCount ?? 0,
    simpleTableElementCount: samples.at(-1)?.simpleTableElementCount ?? 0,
    simpleTableCellElementCount: samples.at(-1)?.simpleTableCellElementCount ?? 0,
    paragraphElementCount: samples.at(-1)?.paragraphElementCount ?? 0,
    headingElementCount: samples.at(-1)?.headingElementCount ?? 0,
    listElementCount: samples.at(-1)?.listElementCount ?? 0,
    listItemElementCount: samples.at(-1)?.listItemElementCount ?? 0,
    preElementCount: samples.at(-1)?.preElementCount ?? 0,
    codeElementCount: samples.at(-1)?.codeElementCount ?? 0,
    mediaElementCount: samples.at(-1)?.mediaElementCount ?? 0,
    katexPlaceholderElementCount: samples.at(-1)?.katexPlaceholderElementCount ?? 0,
    mermaidPlaceholderElementCount: samples.at(-1)?.mermaidPlaceholderElementCount ?? 0,
    mediaTargetCount: samples.at(-1)?.mediaTargetCount ?? 0,
    katexErrorCount: samples.at(-1)?.katexErrorCount ?? 0,
    mermaidPlaceholderCount: samples.at(-1)?.mermaidPlaceholderCount ?? 0,
    sourceLineElementCount: samples.at(-1)?.sourceLineElementCount ?? 0,
    codeLineElementCount: samples.at(-1)?.codeLineElementCount ?? 0,
  };
}

function collectPreviewDomDiagnostics(write: HTMLElement): PreviewDomDiagnostics {
  const diagnostics: PreviewDomDiagnostics = {
    totalElementCount: 0,
    totalAttributeCount: 0,
    sourceLineAttributeCount: 0,
    dataLineAttributeCount: 0,
    maxAttributesPerElement: 0,
    tableElementCount: 0,
    tableSectionElementCount: 0,
    tableRowElementCount: 0,
    tableCellElementCount: 0,
    simpleTableElementCount: 0,
    simpleTableCellElementCount: 0,
    paragraphElementCount: 0,
    headingElementCount: 0,
    listElementCount: 0,
    listItemElementCount: 0,
    preElementCount: 0,
    codeElementCount: 0,
    mediaElementCount: 0,
    katexPlaceholderElementCount: 0,
    mermaidPlaceholderElementCount: 0,
  };
  const walker = write.ownerDocument.createTreeWalker(write, NodeFilter.SHOW_ELEMENT);

  let element = walker.currentNode as HTMLElement | null;
  while (element) {
    diagnostics.totalElementCount += 1;
    diagnostics.totalAttributeCount += element.attributes.length;
    diagnostics.maxAttributesPerElement = Math.max(
      diagnostics.maxAttributesPerElement,
      element.attributes.length,
    );
    if (element.hasAttribute('data-source-line')) diagnostics.sourceLineAttributeCount += 1;
    if (element.hasAttribute('data-line')) diagnostics.dataLineAttributeCount += 1;
    if (element.classList.contains('prism-simple-table')) {
      diagnostics.simpleTableElementCount += 1;
      diagnostics.simpleTableCellElementCount += element.childElementCount;
    }

    switch (element.tagName) {
      case 'TABLE':
        diagnostics.tableElementCount += 1;
        break;
      case 'THEAD':
      case 'TBODY':
      case 'TFOOT':
        diagnostics.tableSectionElementCount += 1;
        break;
      case 'TR':
        diagnostics.tableRowElementCount += 1;
        break;
      case 'TH':
      case 'TD':
        diagnostics.tableCellElementCount += 1;
        break;
      case 'P':
        diagnostics.paragraphElementCount += 1;
        break;
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6':
        diagnostics.headingElementCount += 1;
        break;
      case 'UL':
      case 'OL':
        diagnostics.listElementCount += 1;
        break;
      case 'LI':
        diagnostics.listItemElementCount += 1;
        break;
      case 'PRE':
        diagnostics.preElementCount += 1;
        break;
      case 'CODE':
        diagnostics.codeElementCount += 1;
        break;
      case 'IMG':
      case 'SOURCE':
        diagnostics.mediaElementCount += 1;
        break;
    }

    if (element.classList.contains('katex-placeholder')) {
      diagnostics.katexPlaceholderElementCount += 1;
    }
    if (element.classList.contains('mermaid-placeholder')) {
      diagnostics.mermaidPlaceholderElementCount += 1;
    }

    element = walker.nextNode() as HTMLElement | null;
  }

  return diagnostics;
}

function readBenchmarkContent() {
  return PREVIEW_BENCHMARK_FILE
    ? readFileSync(PREVIEW_BENCHMARK_FILE, 'utf8')
    : buildPreviewBenchmarkMarkdown();
}

function runFullPreviewBenchmark(iterations = 3) {
  logBenchmarkDebugMessage('readContent:start');
  const content = readBenchmarkContent();
  logBenchmarkDebugMessage('readContent:end', { contentLength: content.length });
  const samples: PreviewBenchmarkSample[] = [];

  // Warm up unified/highlight/katex module paths before recording medians.
  logBenchmarkDebugMessage('warmup:start');
  markdownToHtml(content, LARGE_PREVIEW_RENDER_OPTIONS);
  logBenchmarkDebugMessage('warmup:end');

  for (let index = 0; index < iterations; index += 1) {
    const markdown = measure(() => markdownToHtml(content, LARGE_PREVIEW_RENDER_OPTIONS));
    logBenchmarkDebug(index, 'markdownToHtml', markdown.elapsedMs);
    const write = document.createElement('div');
    write.id = 'write';

    const domWrite = measure(() => {
      write.innerHTML = markdown.value;
    });
    logBenchmarkDebug(index, 'domWrite', domWrite.elapsedMs);

    const domTargetScan = measure(() => {
      const targets = collectPreviewDomPostProcessTargets(
        write,
        getPreviewDomTargetHints(markdown.value, '/Users/Alex/Notes/preview-benchmark.md'),
      );
      return {
        mediaTargetCount: targets.mediaElements.length,
        katexErrorCount: targets.katexErrorElements.length,
        mermaidPlaceholderCount: targets.mermaidPlaceholders.length,
      };
    });
    logBenchmarkDebug(index, 'domTargetScan', domTargetScan.elapsedMs);
    const domDiagnosticsScan = measure(() => collectPreviewDomDiagnostics(write));
    logBenchmarkDebug(index, 'domDiagnosticsScan', domDiagnosticsScan.elapsedMs);

    const scrollSyncScan = measure(() => {
      const codeLineElements = collectCodeLineElements(write);
      return {
        codeLineElements,
        sourceLineElementCount: codeLineElements.length,
      };
    });
    logBenchmarkDebug(index, 'scrollSyncScan', scrollSyncScan.elapsedMs);
    const scrollMapBuild = measure(() => buildPreviewScrollMap(write, scrollSyncScan.value.codeLineElements));
    logBenchmarkDebug(index, 'scrollMapBuild', scrollMapBuild.elapsedMs);
    const lookupLines = Array.from({ length: 1000 }, (_, lookupIndex) => 1 + lookupIndex * 7);
    const scrollMapLookup = measure(() => {
      let mappedLineTotal = 0;
      for (const line of lookupLines) {
        const scrollTop = lineToPreviewScrollTopInMap(line, scrollMapBuild.value);
        if (scrollTop === null) continue;
        mappedLineTotal += pageOffsetToLineInMap(scrollTop, scrollMapBuild.value) ?? 0;
      }
      return mappedLineTotal;
    });
    logBenchmarkDebug(index, 'scrollMapLookup', scrollMapLookup.elapsedMs);

    samples.push({
      markdownToHtmlMs: markdown.elapsedMs,
      domWriteMs: domWrite.elapsedMs,
      domTargetScanMs: domTargetScan.elapsedMs,
      scrollSyncScanMs: scrollSyncScan.elapsedMs,
      scrollMapBuildMs: scrollMapBuild.elapsedMs,
      scrollMapLookupMs: scrollMapLookup.elapsedMs,
      htmlLength: markdown.value.length,
      domDiagnosticsScanMs: domDiagnosticsScan.elapsedMs,
      ...domDiagnosticsScan.value,
      sourceLineElementCount: scrollSyncScan.value.sourceLineElementCount,
      codeLineElementCount: scrollSyncScan.value.codeLineElements.length,
      ...domTargetScan.value,
    });
  }

  return {
    contentLength: content.length,
    iterations,
    summary: summarize(samples),
    samples: samples.map((sample) => ({
      ...sample,
      markdownToHtmlMs: roundMs(sample.markdownToHtmlMs),
      domWriteMs: roundMs(sample.domWriteMs),
      domTargetScanMs: roundMs(sample.domTargetScanMs),
      domDiagnosticsScanMs: roundMs(sample.domDiagnosticsScanMs),
      scrollSyncScanMs: roundMs(sample.scrollSyncScanMs),
      scrollMapBuildMs: roundMs(sample.scrollMapBuildMs),
      scrollMapLookupMs: roundMs(sample.scrollMapLookupMs),
    })),
  };
}

describe.skipIf(!RUN_PREVIEW_BENCHMARK)('PreviewPane 1MB full preview benchmark', () => {
  it('records markdown, DOM write, and DOM target scan timings for a mixed 1MB document', () => {
    const result = runFullPreviewBenchmark();

    console.table(result.samples);
    console.info('[Prism preview benchmark]', JSON.stringify({
      contentLength: result.contentLength,
      iterations: result.iterations,
      summary: result.summary,
    }, null, 2));

    if (PREVIEW_BENCHMARK_FILE) {
      expect(result.contentLength).toBeGreaterThan(100_000);
      expect(result.summary.htmlLength).toBeGreaterThan(100_000);
      return;
    }

    expect(result.contentLength).toBeGreaterThanOrEqual(ONE_MEGABYTE);
    expect(result.summary.htmlLength).toBeGreaterThan(ONE_MEGABYTE);
    expect(result.summary.mediaTargetCount).toBeGreaterThan(0);
    expect(result.summary.mermaidPlaceholderCount).toBeGreaterThan(0);
  }, 120_000);
});
