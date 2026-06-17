import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readCssWithImports(filename: string, seen = new Set<string>()): string {
  const filePath = resolve(__dirname, filename);
  if (seen.has(filePath)) return '';
  seen.add(filePath);

  const css = readFileSync(filePath, 'utf8');
  return css.replace(/^@import\s+['"]\.\/([^'"]+)['"];\s*$/gm, (_match, importPath: string) => (
    readCssWithImports(importPath, seen)
  ));
}

describe('global Windows visual compensation', () => {
  const css = readCssWithImports('global.css');

  it('does not leak CSS Modules global selectors into the global stylesheet bundle', () => {
    expect(css).not.toContain(':global(');
    expect(css).toContain('body.dark .prism-diagnostics-popover');
    expect(css).toContain("html[data-content-theme='nocturne'] .prism-relation-graph-modal");
  });

  it('keeps Windows floating-layer compensation after content-theme overrides', () => {
    const miaoyanFloatingLayerOverride = css.lastIndexOf("html[data-content-theme='miaoyan'] .cmdk");
    const windowsFloatingLayerCompensation = css.lastIndexOf("html[data-platform='windows'] .cmdk");

    expect(miaoyanFloatingLayerOverride).toBeGreaterThan(-1);
    expect(windowsFloatingLayerCompensation).toBeGreaterThan(miaoyanFloatingLayerOverride);
  });

  it('limits Windows floating-layer compensation to text rendering', () => {
    const windowsSectionStart = css.lastIndexOf('/* Windows WebView2 uses a different CJK text pipeline');
    const windowsSection = css.slice(windowsSectionStart);

    expect(windowsSection).toContain('font-family');
    expect(windowsSection).toContain('text-rendering');
    expect(windowsSection).not.toMatch(
      /\b(?:top|right|bottom|left|width|max-width|min-width|height|max-height|background|border-radius|box-shadow|transform|animation|backdrop-filter)\s*:/,
    );
  });

  it('styles modal footer buttons with app pills instead of system controls', () => {
    expect(css).toContain('.modal-footer .pill-ghost');
    expect(css).toContain('.modal-footer .pill-filled');
    expect(css).toContain('appearance: none');
  });

  it('keeps modal clarity compensation scoped to Windows after theme overrides', () => {
    const miaoyanOverlayOverride = css.lastIndexOf("html[data-content-theme='miaoyan'] .modal-overlay");
    const windowsModalClarity = css.lastIndexOf("html[data-platform='windows'] .modal {");
    const windowsMiaoyanOverlay = css.lastIndexOf("html[data-platform='windows'][data-content-theme='miaoyan'] .modal-overlay");

    expect(miaoyanOverlayOverride).toBeGreaterThan(-1);
    expect(windowsModalClarity).toBeGreaterThan(miaoyanOverlayOverride);
    expect(windowsMiaoyanOverlay).toBeGreaterThan(miaoyanOverlayOverride);
    expect(css.slice(windowsModalClarity, windowsMiaoyanOverlay)).toContain('transform: none');
    expect(css.slice(windowsMiaoyanOverlay)).toContain('backdrop-filter: blur(3px)');
  });
});

describe('file tree visual rules', () => {
  const css = readCssWithImports('global.css');

  it('keeps file tree items free of per-row hairline separators', () => {
    expect(css).not.toContain('.file-tree-item::after');
    expect(css).toContain("html[data-content-theme='miaoyan'] .file-tree-item[data-active='true']");
    expect(css).toContain('box-shadow: inset 2px 0 0 var(--miaoyan-accent)');
  });
});

describe('modal visual rules', () => {
  const css = readCssWithImports('global.css');

  it('keeps Miaoyan modal corners aligned with the window radius token', () => {
    const baseModalRuleStart = css.indexOf('.modal {');
    const baseModalRuleEnd = css.indexOf('}', baseModalRuleStart);
    const baseModalRule = css.slice(baseModalRuleStart, baseModalRuleEnd);
    const modalRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .modal {");
    const modalRuleEnd = css.indexOf('}', modalRuleStart);
    const modalRule = css.slice(modalRuleStart, modalRuleEnd);
    const commandPaletteRuleStart = css.indexOf('.cmdk {');
    const commandPaletteRuleEnd = css.indexOf('}', commandPaletteRuleStart);
    const commandPaletteRule = css.slice(commandPaletteRuleStart, commandPaletteRuleEnd);
    const shortcutPanelRuleStart = css.indexOf('.sp {');
    const shortcutPanelRuleEnd = css.indexOf('}', shortcutPanelRuleStart);
    const shortcutPanelRule = css.slice(shortcutPanelRuleStart, shortcutPanelRuleEnd);

    expect(baseModalRuleStart).toBeGreaterThan(-1);
    expect(baseModalRule).toContain('border-radius: var(--radius-window)');
    expect(modalRuleStart).toBeGreaterThan(-1);
    expect(modalRule).toContain('border-radius: var(--radius-window)');
    expect(modalRule).not.toContain('border-radius: 8px');
    expect(commandPaletteRuleStart).toBeGreaterThan(-1);
    expect(commandPaletteRule).toContain('border-radius: var(--r-card)');
    expect(commandPaletteRule).not.toContain('border-radius: var(--radius-window)');
    expect(shortcutPanelRuleStart).toBeGreaterThan(-1);
    expect(shortcutPanelRule).toContain('border-radius: var(--r-card)');
    expect(shortcutPanelRule).not.toContain('border-radius: var(--radius-window)');
  });
});

describe('motion and microfeedback rules', () => {
  const css = readCssWithImports('global.css');

  it('defines shared motion tokens for hover, popover, toast, status, and attention feedback', () => {
    expect(css).toContain('--duration-hover: 120ms');
    expect(css).toContain('--duration-popover: 200ms');
    expect(css).toContain('--duration-toast: 220ms');
    expect(css).toContain('--duration-feedback: 220ms');
    expect(css).toContain('--duration-attention: 1800ms');
    expect(css).toContain('--duration-spinner: 820ms');
    expect(css).toContain('--duration-progress: 1200ms');
  });

  it('routes primary feedback surfaces through shared motion tokens', () => {
    expect(css).toContain('animation: prism-toast-in var(--duration-toast) var(--ease-out)');
    expect(css).toContain('animation: prism-line-flash var(--duration-attention) var(--ease-out)');
    expect(css).toContain('animation: prism-export-spin var(--duration-spinner) linear infinite');
    expect(css).toContain('background-color var(--duration-hover) var(--ease-out)');
    expect(css).toContain('transition: transform var(--duration-popover) var(--ease-spring)');
  });

  it('respects reduced motion for floating layers, toast progress, source flash, and export spinners', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.prism-toast[\s\S]*transition-duration: 1ms/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.preview-line-flash[\s\S]*animation: none/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.prism-export-spinner[\s\S]*animation: none/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cmdk[\s\S]*animation: none/);
  });
});
