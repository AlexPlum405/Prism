import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown } from './htmlToMarkdown';

describe('htmlToMarkdown', () => {
  it('converts headings', () => {
    expect(convertHtmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
    expect(convertHtmlToMarkdown('<h2>Subtitle</h2>')).toBe('## Subtitle');
    expect(convertHtmlToMarkdown('<h3>Section</h3>')).toBe('### Section');
  });

  it('converts bold and italic', () => {
    expect(convertHtmlToMarkdown('<strong>bold</strong>')).toBe('**bold**');
    expect(convertHtmlToMarkdown('<b>bold</b>')).toBe('**bold**');
    expect(convertHtmlToMarkdown('<em>italic</em>')).toBe('*italic*');
    expect(convertHtmlToMarkdown('<i>italic</i>')).toBe('*italic*');
  });

  it('converts links', () => {
    expect(convertHtmlToMarkdown('<a href="https://example.com">link</a>'))
      .toBe('[link](https://example.com)');
  });

  it('converts lists', () => {
    const html = '<ul><li>item 1</li><li>item 2</li></ul>';
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('item 1');
    expect(result).toContain('item 2');
    expect(result).toMatch(/^-\s+item 1/m);
  });

  it('converts ordered lists', () => {
    const html = '<ol><li>first</li><li>second</li></ol>';
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('first');
    expect(result).toContain('second');
    expect(result).toMatch(/^1\.\s+first/m);
  });

  it('converts code blocks with language', () => {
    const html = '<pre><code class="language-javascript">const x = 1;</code></pre>';
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('```javascript');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('```');
  });

  it('converts code blocks without language', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('```');
    expect(result).toContain('const x = 1;');
  });

  it('converts inline code', () => {
    expect(convertHtmlToMarkdown('<code>inline</code>')).toBe('`inline`');
  });

  it('converts tables to GFM instead of keeping raw HTML', () => {
    const html = '<table><tr><th>Header</th><th>Second</th></tr><tr><td>Cell</td><td>Other</td></tr></table>';
    expect(convertHtmlToMarkdown(html)).toBe([
      '| Header | Second |',
      '| --- | --- |',
      '| Cell | Other |',
    ].join('\n'));
  });

  it('treats the first row as header when the table has no thead', () => {
    const html = '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></tbody></table>';
    expect(convertHtmlToMarkdown(html)).toBe([
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n'));
  });

  it('pads ragged rows so the table stays rectangular', () => {
    const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td></tr></table>';
    expect(convertHtmlToMarkdown(html)).toBe([
      '| A | B |',
      '| --- | --- |',
      '| 1 |  |',
    ].join('\n'));
  });

  it('escapes pipes inside cells', () => {
    const html = '<table><tr><th>a|b</th></tr><tr><td>c</td></tr></table>';
    expect(convertHtmlToMarkdown(html)).toContain('| a\\|b |');
  });

  it('does not fold a nested table into the outer one', () => {
    const html = [
      '<table><tr><th>Outer</th></tr><tr><td>',
      '<table><tr><th>Inner</th></tr><tr><td>x</td></tr></table>',
      '</td></tr></table>',
    ].join('');
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('| Outer |');
    expect(result).toContain('| Inner |');
  });

  it('converts strikethrough and task list items', () => {
    expect(convertHtmlToMarkdown('<p><del>gone</del></p>')).toBe('~~gone~~');
    const html = '<ul><li><input type="checkbox" checked>done</li><li><input type="checkbox">todo</li></ul>';
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('[x] done');
    expect(result).toContain('[ ] todo');
  });

  it('handles complex nested content from ChatGPT', () => {
    const html = `
      <div>
        <h2>Introduction</h2>
        <p>This is a <strong>paragraph</strong> with <em>formatting</em>.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <pre><code class="language-python">def hello():
    print("world")</code></pre>
      </div>
    `;
    const result = convertHtmlToMarkdown(html);
    expect(result).toContain('## Introduction');
    expect(result).toContain('**paragraph**');
    expect(result).toContain('*formatting*');
    expect(result).toContain('Item 1');
    expect(result).toContain('```python');
  });

  it('strips empty HTML', () => {
    expect(convertHtmlToMarkdown('<div></div>')).toBe('');
    expect(convertHtmlToMarkdown('<p></p>')).toBe('');
  });

  it('handles plain text in HTML', () => {
    expect(convertHtmlToMarkdown('<p>Plain text</p>')).toBe('Plain text');
  });
});
