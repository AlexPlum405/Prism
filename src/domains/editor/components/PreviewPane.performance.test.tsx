import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../../../lib/markdownToHtml';

interface PreviewBenchmarkSample {
  markdownToHtmlMs: number;
  domWriteMs: number;
  domTargetScanMs: number;
  htmlLength: number;
  mediaTargetCount: number;
  katexErrorCount: number;
  mermaidPlaceholderCount: number;
}

const RUN_PREVIEW_BENCHMARK = process.env.PRISM_PREVIEW_BENCH === '1';
const ONE_MEGABYTE = 1024 * 1024;

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

function summarize(samples: PreviewBenchmarkSample[]) {
  return {
    markdownToHtmlMs: roundMs(median(samples.map((sample) => sample.markdownToHtmlMs))),
    domWriteMs: roundMs(median(samples.map((sample) => sample.domWriteMs))),
    domTargetScanMs: roundMs(median(samples.map((sample) => sample.domTargetScanMs))),
    htmlLength: samples.at(-1)?.htmlLength ?? 0,
    mediaTargetCount: samples.at(-1)?.mediaTargetCount ?? 0,
    katexErrorCount: samples.at(-1)?.katexErrorCount ?? 0,
    mermaidPlaceholderCount: samples.at(-1)?.mermaidPlaceholderCount ?? 0,
  };
}

function runFullPreviewBenchmark(iterations = 3) {
  const content = buildPreviewBenchmarkMarkdown();
  const samples: PreviewBenchmarkSample[] = [];

  // Warm up unified/highlight/katex module paths before recording medians.
  markdownToHtml(content, {
    autoDetectUnlabeledCode: false,
    frontMatterMode: 'metadata',
  });

  for (let index = 0; index < iterations; index += 1) {
    const markdown = measure(() => markdownToHtml(content, {
      autoDetectUnlabeledCode: false,
      frontMatterMode: 'metadata',
    }));
    const write = document.createElement('div');
    write.id = 'write';

    const domWrite = measure(() => {
      write.innerHTML = markdown.value;
    });

    const domTargetScan = measure(() => ({
      mediaTargetCount: write.querySelectorAll('img[src], source[src]').length,
      katexErrorCount: write.querySelectorAll('.katex-error').length,
      mermaidPlaceholderCount: write.querySelectorAll('.mermaid-placeholder').length,
    }));

    samples.push({
      markdownToHtmlMs: markdown.elapsedMs,
      domWriteMs: domWrite.elapsedMs,
      domTargetScanMs: domTargetScan.elapsedMs,
      htmlLength: markdown.value.length,
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

    expect(result.contentLength).toBeGreaterThanOrEqual(ONE_MEGABYTE);
    expect(result.summary.htmlLength).toBeGreaterThan(ONE_MEGABYTE);
    expect(result.summary.mediaTargetCount).toBeGreaterThan(0);
    expect(result.summary.mermaidPlaceholderCount).toBeGreaterThan(0);
  }, 120_000);
});

