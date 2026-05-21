import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  isUnsafeExportUrl,
  sanitizeExportHtmlFragment,
} from './htmlFragmentRenderer';

describe('htmlFragmentRenderer', () => {
  it('escapes text for HTML metadata and fallback blocks', () => {
    expect(escapeHtml('<Prism & "Export">')).toBe('&lt;Prism &amp; &quot;Export&quot;&gt;');
  });

  it('detects unsafe protocols while preserving local document links', () => {
    const protocols = new Set(['http:', 'https:', 'mailto:']);

    expect(isUnsafeExportUrl('javascript:alert(1)', protocols)).toBe(true);
    expect(isUnsafeExportUrl('data:text/html;base64,abc', protocols)).toBe(true);
    expect(isUnsafeExportUrl('https://example.com', protocols)).toBe(false);
    expect(isUnsafeExportUrl('#section', protocols)).toBe(false);
    expect(isUnsafeExportUrl('./local.md', protocols)).toBe(false);
    expect(isUnsafeExportUrl('/absolute/local.png', protocols)).toBe(false);
  });

  it('sanitizes active content but keeps supported inline HTML', () => {
    const html = sanitizeExportHtmlFragment(`
      <script>alert(1)</script>
      <mark onclick="alert(1)">高亮</mark>
      <a href="javascript:alert(1)">bad</a>
      <a href="https://example.com">good</a>
      <img src="data:image/svg+xml;base64,abc" onerror="alert(1)">
      <kbd style="color: red">Ctrl</kbd>
    `);

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('src="data:image');
    expect(html).toContain('<mark>高亮</mark>');
    expect(html).toContain('<a>bad</a>');
    expect(html).toContain('<a href="https://example.com">good</a>');
    expect(html).toContain('<kbd style="color: red">Ctrl</kbd>');
  });
});
