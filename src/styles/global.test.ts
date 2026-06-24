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

function readRule(css: string, selector: string): string {
  const ruleStart = css.indexOf(selector);
  const ruleEnd = css.indexOf('}', ruleStart);

  expect(ruleStart).toBeGreaterThan(-1);
  expect(ruleEnd).toBeGreaterThan(ruleStart);
  return css.slice(ruleStart, ruleEnd);
}

const nonMiaoyanThemes = ['inkstone', 'slate', 'mono', 'nocturne', 'carbon'] as const;

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

describe('Miaoyan content surface rules', () => {
  const css = readCssWithImports('global.css');

  it('keeps preview content full-width with the MiaoYan source padding', () => {
    const writeRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan #write {");
    const writeRuleEnd = css.indexOf('}', writeRuleStart);
    const writeRule = css.slice(writeRuleStart, writeRuleEnd);

    expect(css).toContain('--preview-max-width: 100%');
    expect(writeRuleStart).toBeGreaterThan(-1);
    expect(writeRule).toContain('margin: 0');
    expect(writeRule).toContain('max-width: var(--preview-max-width, 100%)');
    expect(writeRule).toContain('padding: 0 28px 80px');
  });

  it('keeps editor content full-width with MiaoYan 24px horizontal inset', () => {
    const editorRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .cm-editor {");
    const editorRuleEnd = css.indexOf('}', editorRuleStart);
    const editorRule = css.slice(editorRuleStart, editorRuleEnd);
    const contentRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .cm-editor .cm-content {");
    const contentRuleEnd = css.indexOf('}', contentRuleStart);
    const contentRule = css.slice(contentRuleStart, contentRuleEnd);

    expect(editorRuleStart).toBeGreaterThan(-1);
    expect(editorRule).toContain('--miaoyan-editor-gutter: 24px');
    expect(contentRuleStart).toBeGreaterThan(-1);
    expect(contentRule).toContain('max-width: none');
    expect(contentRule).toContain('margin: 0');
    expect(contentRule).toContain('padding: 10px var(--miaoyan-editor-gutter) 96px');
  });

  it('keeps MiaoYan preview links blue while editor link text and destinations use separate colors', () => {
    const linkTextRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .cm-md-link-text {");
    const linkTextRuleEnd = css.indexOf('}', linkTextRuleStart);
    const linkTextRule = css.slice(linkTextRuleStart, linkTextRuleEnd);
    const linkUrlRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .cm-md-link-url {");
    const linkUrlRuleEnd = css.indexOf('}', linkUrlRuleStart);
    const linkUrlRule = css.slice(linkUrlRuleStart, linkUrlRuleEnd);
    const imageMarkRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .cm-md-image-mark {");
    const imageMarkRuleEnd = css.indexOf('}', imageMarkRuleStart);
    const imageMarkRule = css.slice(imageMarkRuleStart, imageMarkRuleEnd);
    const syntaxRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .cm-md-link-syntax,");
    const syntaxRuleEnd = css.indexOf('}', syntaxRuleStart);
    const syntaxRule = css.slice(syntaxRuleStart, syntaxRuleEnd);

    expect(css).toContain('--miaoyan-link: #0C6ADA');
    expect(linkTextRuleStart).toBeGreaterThan(-1);
    expect(linkTextRule).toContain('color: #05A699');
    expect(linkUrlRuleStart).toBeGreaterThan(-1);
    expect(linkUrlRule).toContain('color: #0C6ADA');
    expect(css).toContain("html[data-content-theme='miaoyan'] .cm-md-image-url");
    expect(imageMarkRuleStart).toBeGreaterThan(-1);
    expect(imageMarkRule).toContain('color: #05A699');
    expect(syntaxRuleStart).toBeGreaterThan(-1);
    expect(syntaxRule).toContain('color: var(--miaoyan-editor-text)');
    expect(syntaxRule).toContain('.cm-editor .cm-url');
  });

  it('keeps MiaoYan editor fenced-code tokens aligned with atom-one-light rendering', () => {
    const miaoyanCodeSectionStart = css.indexOf('/* MiaoYan edit view uses Highlightr atom-one-light colors inside fenced code. */');
    const miaoyanCodeSectionEnd = css.indexOf('/* Inkstone Light editor compatibility mode */', miaoyanCodeSectionStart);
    const miaoyanCodeSection = css.slice(miaoyanCodeSectionStart, miaoyanCodeSectionEnd);

    expect(miaoyanCodeSectionStart).toBeGreaterThan(-1);
    expect(miaoyanCodeSectionEnd).toBeGreaterThan(miaoyanCodeSectionStart);
    expect(miaoyanCodeSection).toContain("html[data-content-theme='miaoyan'] .cm-editor .cm-code-token");
    expect(miaoyanCodeSection).toContain("html[data-content-theme='miaoyan'] .cm-editor .hljs-variable");
    expect(miaoyanCodeSection).toContain("font-family: 'Menlo', 'JetBrains Mono', monospace !important");
    expect(miaoyanCodeSection).toContain('color: #A626A4 !important');
    expect(miaoyanCodeSection).toContain('color: #50A14F !important');
    expect(miaoyanCodeSection).toContain('color: #986801 !important');
    expect(miaoyanCodeSection).toContain('color: #E45649 !important');
    expect(css).toContain("html[data-content-theme='miaoyan'] .cm-md-math-token");
    expect(css).not.toContain('.cm-md-diagram-syntax');
    expect(css).not.toContain('.cm-md-diagram-label');
  });

  it('keeps MiaoYan preview emphasis italic and tables full line width', () => {
    const emRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan em {");
    const emRuleEnd = css.indexOf('}', emRuleStart);
    const emRule = css.slice(emRuleStart, emRuleEnd);
    const tableRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan table {");
    const tableRuleEnd = css.indexOf('}', tableRuleStart);
    const tableRule = css.slice(tableRuleStart, tableRuleEnd);

    expect(emRuleStart).toBeGreaterThan(-1);
    expect(emRule).toContain('font-style: italic');
    expect(tableRuleStart).toBeGreaterThan(-1);
    expect(tableRule).toContain('width: 100%');
  });

  it('keeps MiaoYan KaTeX transparent and centered instead of card-like', () => {
    const katexRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan .katex {");
    const katexRuleEnd = css.indexOf('}', katexRuleStart);
    const katexRule = css.slice(katexRuleStart, katexRuleEnd);
    const displayRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan .katex-display {");
    const displayRuleEnd = css.indexOf('}', displayRuleStart);
    const displayRule = css.slice(displayRuleStart, displayRuleEnd);
    const katexSectionStart = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan .katex {");
    const katexSectionEnd = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan code.language-mermaid", katexSectionStart);
    const katexSection = css.slice(katexSectionStart, katexSectionEnd);

    expect(katexRuleStart).toBeGreaterThan(-1);
    expect(katexSectionEnd).toBeGreaterThan(katexSectionStart);
    expect(katexRule).toContain('font: normal 1.21em KaTeX_Main');
    expect(katexRule).toContain('background: transparent !important');
    expect(katexRule).toContain('border: 0 !important');
    expect(katexRule).toContain('box-shadow: none !important');
    expect(displayRuleStart).toBeGreaterThan(-1);
    expect(displayRule).toContain('margin: 1em 0 !important');
    expect(displayRule).toContain('text-align: center !important');
    expect(css).toContain(".katex-placeholder[data-katex-display='true']");
    expect(css).toContain(".preview-compat--miaoyan .katex .katex-mathml");
    expect(katexSection).not.toContain('width: min-content !important');
    expect(katexSection).not.toContain(".preview-compat--miaoyan .katex svg {");
    expect(katexSection).not.toContain('stroke-width: 1 !important');
  });

  it('keeps MiaoYan diagrams on the source gray canvas with bundled Markmap colors', () => {
    const placeholderRuleStart = css.indexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan .mermaid-placeholder,");
    const placeholderRuleEnd = css.indexOf('}', placeholderRuleStart);
    const placeholderRule = css.slice(placeholderRuleStart, placeholderRuleEnd);
    const plantUmlImageRuleStart = css.lastIndexOf("html[data-content-theme='miaoyan'] .preview-compat--miaoyan .plantuml-image {");
    const plantUmlImageRuleEnd = css.indexOf('}', plantUmlImageRuleStart);
    const plantUmlImageRule = css.slice(plantUmlImageRuleStart, plantUmlImageRuleEnd);

    expect(placeholderRuleStart).toBeGreaterThan(-1);
    expect(placeholderRule).toContain('.plantuml-placeholder');
    expect(placeholderRule).toContain('.markmap-placeholder');
    expect(placeholderRule).toContain('background: var(--miaoyan-diagram-bg)');
    expect(placeholderRule).toContain('border: none');
    expect(placeholderRule).toContain('border-radius: 6px');
    expect(placeholderRule).toContain('padding: 12px');
    expect(plantUmlImageRuleStart).toBeGreaterThan(-1);
    expect(plantUmlImageRule).toContain('display: block');
    expect(plantUmlImageRule).toContain('margin-inline: auto');
    expect(plantUmlImageRule).toContain('max-width: 100%');
    expect(plantUmlImageRule).toContain('width: auto');
    expect(plantUmlImageRule).toContain('height: auto');
    expect(css).toContain('--miaoyan-diagram-bg: #f7f7f7');
    expect(css).toContain('--miaoyan-mermaid-line: #1C5D33');
    expect(css).toContain('.plantuml-image');
    expect(css).toContain('.markmap-placeholder .markmap-svg');
    expect(css).toContain('height: 450px !important');
    expect(css).toContain('min-height: 450px');
    expect(css).toContain('.markmap-placeholder .markmap-node text');
    expect(css).toContain('.markmap-placeholder .markmap-node line');
    expect(css).not.toContain('stroke: var(--miaoyan-markmap-line)');
    expect(css).toContain('.mermaid-placeholder .edgeLabel foreignObject div');
    expect(css).toContain('background-color: #e8e8e8 !important');
    expect(css).toContain('fill: transparent !important');
    expect(css).toContain('line-height: 1.2 !important');
    expect(css).toContain('shape-rendering: geometricPrecision');
    expect(css).not.toContain('.mermaid-placeholder .flowchart-link');
    expect(css).not.toContain('.mermaid-placeholder marker path');
    expect(css).not.toContain('.mermaid-placeholder .node .label-container');
    expect(css).not.toContain('.mermaid-placeholder .edgeLabel .labelBkg');
  });
});

describe('Non-MiaoYan content theme quality rules', () => {
  const css = readCssWithImports('global.css');

  it('keeps every non-MiaoYan theme on a visibly distinct accent family', () => {
    expect(css).toContain('--inkstone-accent: #b75a2a');
    expect(css).toContain('--inkstone-title: #7a3e1d');
    expect(css).toContain('--inkstone-link: #2458a6');
    expect(css).toContain("--inkstone-font: 'Songti SC', 'STSong'");

    expect(css).toContain('--slate-accent: #d97706');
    expect(css).toContain('--slate-title: #315f9d');
    expect(css).toContain('--slate-link: #0b7a99');

    expect(css).toContain('--mono-accent: #be123c');
    expect(css).toContain('--mono-title: #5b21b6');
    expect(css).toContain('--mono-link: #047857');

    expect(css).toContain('--nocturne-accent: #c084fc');
    expect(css).toContain('--nocturne-title: #f0c674');
    expect(css).toContain('--nocturne-link: #7dd3fc');

    expect(css).toContain('--carbon-accent: #bd93f9');
    expect(css).toContain('--carbon-title: #ffb86c');
    expect(css).toContain('--carbon-link: #8be9fd');
    expect(css).toContain('--carbon-main-bg: #000000');
    expect(css).toContain('--preview-bg: #000000');

    expect(css).not.toContain('rgba(70, 111, 87');
    expect(css).not.toContain('rgba(88, 122, 133');
    expect(css).not.toContain('rgba(59, 111, 72');
    expect(css).not.toContain('rgba(134, 168, 120');
  });

  it('keeps reading tables full-line and backed by each theme palette', () => {
    for (const theme of nonMiaoyanThemes) {
      const tableRule = readRule(css, `html[data-content-theme='${theme}'] .preview-compat--${theme} table {`);

      expect(tableRule).toContain('table-layout: fixed');
      expect(tableRule).toContain('max-width: 100%');
      expect(tableRule).toContain('width: 100%');
      expect(css).toContain(`--${theme}-diagram-bg:`);
      expect(css).toContain(`--theme-diagram-bg: var(--${theme}-diagram-bg)`);
      expect(css).toContain(`--theme-mermaid-line: var(--${theme}-mermaid-line)`);
      expect(css).toContain(`--theme-markmap-node: var(--${theme}-markmap-node)`);
    }
  });

  it('keeps formulas transparent and centered across non-MiaoYan themes', () => {
    expect(css).toContain("html:is([data-content-theme='inkstone'], [data-content-theme='slate'], [data-content-theme='mono'], [data-content-theme='nocturne'], [data-content-theme='carbon'])");
    expect(css).toContain('font: normal 1.16em KaTeX_Main');
    expect(css).toContain('color: var(--theme-text) !important');
    expect(css).toContain('background: transparent !important');
    expect(css).toContain('border: 0 !important');
    expect(css).toContain('box-shadow: none !important');
    expect(css).toContain(".katex-placeholder[data-katex-display='true']");
    expect(css).toContain('text-align: center !important');
    expect(css).toContain('.katex .katex-mathml');
  });

  it('keeps Mermaid, PlantUML, and Markmap using a complete themed canvas', () => {
    expect(css).toContain(':is(.mermaid-placeholder, .markmap-placeholder, .plantuml-placeholder)');
    expect(css).toContain('background: var(--theme-diagram-bg)');
    expect(css).toContain('border: none');
    expect(css).toContain('border-radius: 6px');
    expect(css).toContain('padding: 12px');
    expect(css).toContain('max-width: min(100%, 920px)');
    expect(css).toContain('shape-rendering: geometricPrecision');
    expect(css).toContain('.plantuml-image');
    expect(css).toContain('height: 450px !important');
    expect(css).toContain('stroke: var(--theme-mermaid-line) !important');
    expect(css).toContain('fill: var(--theme-mermaid-node-bg) !important');
    expect(css).toContain('background-color: var(--theme-mermaid-edge-label-bg) !important');
    expect(css).toContain('fill: var(--theme-markmap-node) !important');
    expect(css).toContain('stroke: var(--theme-markmap-line) !important');
  });

  it('keeps editor link, image, and math token layers explicit in every non-MiaoYan theme', () => {
    for (const theme of nonMiaoyanThemes) {
      const syntaxRule = readRule(css, `html[data-content-theme='${theme}'] .cm-md-link-syntax,`);

      expect(css).toContain(`html[data-content-theme='${theme}'] .cm-md-link-text`);
      expect(css).toContain(`html[data-content-theme='${theme}'] .cm-md-link-url`);
      expect(css).toContain(`html[data-content-theme='${theme}'] .cm-md-image-url`);
      expect(css).toContain(`html[data-content-theme='${theme}'] .cm-md-image-mark`);
      expect(css).toContain(`html[data-content-theme='${theme}'] .cm-md-math-token`);
      expect(syntaxRule).toContain(`html[data-content-theme='${theme}'] .cm-md-image-syntax`);
      expect(syntaxRule).toContain(`html[data-content-theme='${theme}'] .cm-editor .cm-url`);
      expect(syntaxRule).toContain(`color: var(--${theme}-editor-text)`);
      expect(syntaxRule).toContain('text-decoration: none');
    }
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
