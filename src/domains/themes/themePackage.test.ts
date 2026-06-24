import { describe, expect, it } from 'vitest';
import { ThemeError } from './themeErrors';
import {
  buildUserThemeContract,
  normalizeThemeRelativePath,
  parseThemeManifest,
  validateThemePackageInput,
} from './themePackage';

describe('theme package validation', () => {
  it('builds a complete user contract from a minimal manifest', () => {
    const manifest = parseThemeManifest(JSON.stringify({
      schemaVersion: 1,
      id: 'warm-paper',
      name: '暖纸',
      isDark: false,
      contract: {
        preview: {
          writeClass: 'markdown-body heti warm-paper-write',
        },
        export: {
          docx: {
            font: 'Songti SC',
            text: '#25211C',
          },
        },
      },
    }));

    const contract = buildUserThemeContract(manifest);

    expect(contract.id).toBe('warm-paper');
    expect(contract.label).toBe('暖纸');
    expect(contract.preview.writeClass).toBe('markdown-body heti warm-paper-write');
    expect(contract.preview.maxWidth).toBe('none');
    expect(contract.export.docx.font).toBe('Songti SC');
    expect(contract.export.docx.text).toBe('25211C');
    expect(contract.editor.fontFamily).toBeTruthy();
  });

  it('normalizes user preview width as full-width or bounded reading measure', () => {
    const fullWidth = buildUserThemeContract(parseThemeManifest(JSON.stringify({
      schemaVersion: 1,
      id: 'wide-paper',
      name: 'Wide Paper',
      contract: {
        preview: { maxWidth: 'none' },
      },
    })));
    const bounded = buildUserThemeContract(parseThemeManifest(JSON.stringify({
      schemaVersion: 1,
      id: 'bounded-paper',
      name: 'Bounded Paper',
      contract: {
        preview: { maxWidth: 1440 },
      },
    })));

    expect(fullWidth.preview.maxWidth).toBe('none');
    expect(bounded.preview.maxWidth).toBe(1280);
  });

  it('rejects built-in theme ids for user packages', () => {
    expect(() => parseThemeManifest(JSON.stringify({
      schemaVersion: 1,
      id: 'miaoyan',
      name: 'Override',
    }))).toThrow(ThemeError);
  });

  it('normalizes safe relative asset paths', () => {
    expect(normalizeThemeRelativePath('./fonts/WarmPaper.woff2')).toBe('fonts/WarmPaper.woff2');
    expect(normalizeThemeRelativePath('../fonts/WarmPaper.woff2')).toBe('');
    expect(normalizeThemeRelativePath('/tmp/WarmPaper.woff2')).toBe('');
  });

  it('validates package css with the manifest theme id', () => {
    const manifest = parseThemeManifest(JSON.stringify({
      schemaVersion: 1,
      id: 'warm-paper',
      name: '暖纸',
    }));

    expect(() => validateThemePackageInput({
      manifest,
      directory: '/tmp/warm-paper',
      css: "html[data-content-theme='warm-paper'] { --theme-main-bg: #fff; }",
    })).not.toThrow();
  });
});
