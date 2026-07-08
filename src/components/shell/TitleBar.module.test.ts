import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('TitleBar drag region styling', () => {
  const css = readFileSync(resolve(__dirname, 'TitleBar.module.css'), 'utf8');

  it('does not use WebKit app-region drag for the whole titlebar', () => {
    expect(css).not.toMatch(/-webkit-app-region\s*:\s*drag/);
    expect(css).not.toMatch(/\bapp-region\s*:\s*drag/);
  });

  it('lets Windows menu flyouts escape the titlebar menu containers', () => {
    const leftCluster = css.match(/\.windowsLeftCluster\s*\{[^}]*\}/)?.[0] ?? '';
    const inlineMenu = css.match(/\.windowsInlineMenu\s*\{[^}]*\}/)?.[0] ?? '';

    expect(leftCluster).toContain('overflow: visible');
    expect(inlineMenu).toContain('overflow: visible');
    expect(leftCluster).not.toContain('overflow: hidden');
    expect(inlineMenu).not.toContain('overflow: hidden');
  });

  it('uses darker Windows menu text than the secondary title text', () => {
    const windowsMenuRule = css.match(/:global\(html\[data-platform='windows'\]\) \.windowsMenuItem\s*\{[^}]*\}/)?.[0] ?? '';
    const themedMenuRule = css.match(/:global\(html\[data-platform='windows'\]:is\(\[data-content-theme='inkstone'\][^)]*\)\) \.windowsMenuItem\s*\{[^}]*\}/)?.[0] ?? '';

    expect(windowsMenuRule).toContain('var(--c-void) 88%');
    expect(themedMenuRule).toContain('var(--theme-text) 86%');
    expect(themedMenuRule).not.toContain('color: var(--theme-secondary-text)');
  });
});
