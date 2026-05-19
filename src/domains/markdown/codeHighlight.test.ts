import { describe, expect, it } from 'vitest';
import {
  highlightPrismCode,
  highlightPrismCodeAuto,
  isPrismCodeHighlightLanguage,
} from './codeHighlight';

describe('Prism markdown code highlighting', () => {
  it('registers common writing and development languages with aliases', () => {
    expect(isPrismCodeHighlightLanguage('typescript')).toBe(true);
    expect(isPrismCodeHighlightLanguage('ts')).toBe(true);
    expect(isPrismCodeHighlightLanguage('javascript')).toBe(true);
    expect(isPrismCodeHighlightLanguage('js')).toBe(true);
    expect(isPrismCodeHighlightLanguage('swift')).toBe(true);
    expect(isPrismCodeHighlightLanguage('html')).toBe(true);
    expect(isPrismCodeHighlightLanguage('yml')).toBe(true);
  });

  it('keeps intentionally unsupported languages out of the editor highlight path', () => {
    expect(isPrismCodeHighlightLanguage('go')).toBe(false);
    expect(isPrismCodeHighlightLanguage('fortran')).toBe(false);
  });

  it('highlights explicit and auto-detected code with hljs token classes', () => {
    expect(highlightPrismCode('const answer: number = 42;', 'ts').value).toContain('hljs-keyword');
    expect(highlightPrismCodeAuto('const answer = "42";').value).toContain('hljs-string');
  });
});
