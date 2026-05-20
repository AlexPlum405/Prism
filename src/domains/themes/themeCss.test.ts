import { describe, expect, it } from 'vitest';
import { ThemeError } from './themeErrors';
import { validateThemeCss } from './themeCss';

describe('theme css validation', () => {
  it('accepts scoped local theme css', () => {
    expect(() => validateThemeCss(`
      html[data-content-theme='warm-paper'] {
        --theme-main-bg: #fbfaf6;
      }
      html[data-content-theme='warm-paper'] .cm-editor {
        background: var(--theme-main-bg);
      }
    `, 'warm-paper')).not.toThrow();
  });

  it('rejects unscoped selectors', () => {
    expect(() => validateThemeCss('.cm-editor { background: red; }', 'warm-paper'))
      .toThrow(ThemeError);
  });

  it('rejects remote css resources', () => {
    expect(() => validateThemeCss(
      "html[data-content-theme='warm-paper'] .cm-editor { background: url(https://example.com/bg.png); }",
      'warm-paper',
    )).toThrow(/远程|危险资源/);
  });

  it('rejects hidden core surfaces', () => {
    expect(() => validateThemeCss(
      "html[data-content-theme='warm-paper'] .cm-editor { display: none; }",
      'warm-paper',
    )).toThrow(/不能隐藏核心界面/);
  });
});
