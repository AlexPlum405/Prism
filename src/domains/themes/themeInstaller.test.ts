import { describe, expect, it } from 'vitest';
import { __themeInstallerTesting } from './themeInstaller';

const bytes = new Uint8Array([1]);

describe('theme installer archive handling', () => {
  it('accepts archives with a single root directory', () => {
    const entries = __themeInstallerTesting.normalizeZipEntries({
      'WarmPaper/theme.json': bytes,
      'WarmPaper/theme.css': bytes,
    });

    expect(entries.map(([path]) => path)).toEqual(['theme.json', 'theme.css']);
  });

  it('rejects archive path traversal', () => {
    expect(() => __themeInstallerTesting.normalizeZipEntries({
      'WarmPaper/theme.json': bytes,
      '../evil.txt': bytes,
    })).toThrow(/路径不合法|一层根目录/);
  });

  it('requires theme.json after root normalization', () => {
    expect(() => __themeInstallerTesting.normalizeZipEntries({
      'WarmPaper/theme.css': bytes,
    })).toThrow(/缺少 theme.json/);
  });
});
