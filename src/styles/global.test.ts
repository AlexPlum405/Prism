import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('global Windows visual compensation', () => {
  const css = readFileSync(resolve(__dirname, 'global.css'), 'utf8');

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
