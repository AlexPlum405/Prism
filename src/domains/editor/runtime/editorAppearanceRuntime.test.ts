import { describe, expect, it } from 'vitest';
import {
  getEditorTypographyStyle,
  getLineNumberExtensions,
  getLineWrappingExtensions,
  shouldUseDarkEditor,
} from './editorAppearanceRuntime';

describe('editorAppearanceRuntime', () => {
  it('maps content themes to the expected editor color mode', () => {
    expect(shouldUseDarkEditor('nocturne', 'light')).toBe(true);
    expect(shouldUseDarkEditor('miaoyan', 'dark')).toBe(false);
    expect(shouldUseDarkEditor('custom-theme', 'dark')).toBe(true);
  });

  it('maps editor typography settings to CSS variables consumed by compatibility themes', () => {
    expect(getEditorTypographyStyle(
      18,
      1.8,
      "'JetBrains Mono', monospace",
    )).toEqual({
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '18px',
      lineHeight: '32.4px',
      variables: {
        '--prism-editor-font-family': "'JetBrains Mono', monospace",
        '--prism-editor-font-size': '18px',
        '--prism-editor-line-height': '32.4px',
      },
    });
  });

  it('leaves theme font variables unset when editor font follows the current theme', () => {
    expect(getEditorTypographyStyle(
      18,
      1.8,
      "'JetBrains Mono', monospace",
      true,
    )).toEqual({
      fontFamily: undefined,
      fontSize: '18px',
      lineHeight: '32.4px',
      variables: {
        '--prism-editor-font-size': '18px',
        '--prism-editor-line-height': '32.4px',
      },
    });
  });

  it('only installs optional editor extensions when enabled', () => {
    expect(getLineNumberExtensions(false)).toHaveLength(0);
    expect(getLineNumberExtensions(true).length).toBeGreaterThan(0);
    expect(getLineWrappingExtensions(false)).toHaveLength(0);
    expect(getLineWrappingExtensions(true).length).toBeGreaterThan(0);
  });
});
