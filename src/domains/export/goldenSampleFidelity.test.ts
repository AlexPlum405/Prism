import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { markdownToHtml } from '../../lib/markdownToHtml';

// 导出保真黄金样本回归：锁定 docs/examples/export-fidelity-sample.md 的渲染结构。
// 该样本集中覆盖导出难点（Mermaid、KaTeX、嵌套代码、宽表格、本地图片、Callout、Toggle、长文），
// 供人工核对四格式导出，同时这里断言可机器校验的部分：产物非空、关键结构存在、无源码标记泄漏。
const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = resolve(__dirname, '../../../docs/examples/export-fidelity-sample.md');

function readSample(): string {
  return readFileSync(SAMPLE_PATH, 'utf8');
}

describe('export fidelity golden sample', () => {
  const sample = readSample();
  const compatibilityModes = ['miaoyan', 'inkstone', 'slate', 'mono', 'nocturne', 'carbon'] as const;

  it('exists and contains every targeted difficulty block in source', () => {
    expect(sample.length).toBeGreaterThan(1500);
    expect(sample).toContain('```mermaid');
    expect(sample).toContain('$$');
    expect(sample).toContain('<details>');
    expect(sample).toContain('> [!NOTE]');
    expect(sample).toContain('![验收示意图]');
    expect(sample).toContain('==高亮标记==');
  });

  it('renders rich blocks without leaking source markers', () => {
    const html = markdownToHtml(sample, { frontMatterMode: 'metadata' });

    // 表格
    expect(html).toMatch(/<table[ >]/);
    expect(html).toMatch(/<th[ >]/);
    // 代码块（高亮）
    expect(html).toContain('class="hljs');
    // KaTeX 块级公式
    expect(html).toContain('katex');
    // Mermaid 占位（待前端渲染）
    expect(html).toContain('mermaid-placeholder');
    // Callout
    expect(html).toContain('prism-callout--warning');
    expect(html).toContain('prism-callout--important');
    // Toggle
    expect(html).toContain('<details>');
    expect(html).toContain('<summary>');
    // 高亮标记
    expect(html).toContain('<mark>');

    // 真实 Callout 已被识别并转换（不再是裸引用），高亮标记已转 mark
    expect(html).toContain('data-callout-kind="note"');
    expect(html).not.toContain('==高亮标记==');
    // 注意：代码块内的 [!NOTE] 字面量是“故意保留”的演示内容，不应据此判定泄漏；
    // 因此这里不做全文 [!NOTE] 检查，由下一个用例确认代码块字面量原样保留。
  });

  it('keeps code-block markdown literals unparsed', () => {
    const html = markdownToHtml(sample, { frontMatterMode: 'metadata' });
    // 代码块内的 Markdown 字面量应被保留为文本，而非渲染成真实结构
    expect(html).toContain('# 这是代码块里的标题');
    expect(html).toContain('[!NOTE] 这不是真的 Callout');
    expect(html).not.toContain('<h1 data-source-line="48"');
    // 正文真实标题应存在
    expect(html).toContain('导出保真验收样本');
  });

  it.each(compatibilityModes)('renders the sample in %s without throwing', (compatibilityMode) => {
    expect(() => markdownToHtml(sample, { compatibilityMode })).not.toThrow();
    const html = markdownToHtml(sample, { compatibilityMode });
    expect(html.length).toBeGreaterThan(2000);
  });
});
