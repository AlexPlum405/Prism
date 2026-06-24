/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { __editorPaneTesting } from './EditorPane';

describe('EditorPane Miaoyan code highlighting', () => {
  it('splits inline links into MiaoYan syntax, text, and destination colors', () => {
    const markdown = '[Prism](https://example.com)';
    const ranges = __editorPaneTesting.collectMiaoyanInlineMarkdownDecorationRanges(markdown)
      .map((range) => ({
        kind: range.kind,
        text: markdown.slice(range.from, range.to),
      }));

    expect(ranges).toEqual([
      { kind: 'linkSyntax', text: '[' },
      { kind: 'linkText', text: 'Prism' },
      { kind: 'linkSyntax', text: ']' },
      { kind: 'linkSyntax', text: '(' },
      { kind: 'linkUrl', text: 'https://example.com' },
      { kind: 'linkSyntax', text: ')' },
    ]);
  });

  it('keeps image alt text neutral while coloring the destination like MiaoYan', () => {
    const markdown = '![Alt](images/a.png)';
    const ranges = __editorPaneTesting.collectMiaoyanInlineMarkdownDecorationRanges(markdown)
      .map((range) => ({
        kind: range.kind,
        text: markdown.slice(range.from, range.to),
      }));

    expect(ranges).toEqual([
      { kind: 'imageMark', text: '![' },
      { kind: 'imageSyntax', text: ']' },
      { kind: 'imageSyntax', text: '(' },
      { kind: 'imageUrl', text: 'images/a.png' },
      { kind: 'imageSyntax', text: ')' },
    ]);
  });

  it('handles MiaoYan-style reference links without coloring brackets as links', () => {
    const markdown = '[Prism][note]';
    const ranges = __editorPaneTesting.collectMiaoyanInlineMarkdownDecorationRanges(markdown)
      .map((range) => ({
        kind: range.kind,
        text: markdown.slice(range.from, range.to),
      }));

    expect(ranges).toEqual([
      { kind: 'linkSyntax', text: '[' },
      { kind: 'linkText', text: 'Prism' },
      { kind: 'linkSyntax', text: ']' },
      { kind: 'linkSyntax', text: '[' },
      { kind: 'linkUrl', text: 'note' },
      { kind: 'linkSyntax', text: ']' },
    ]);
  });

  it('colors MiaoYan math source tokens without changing the markdown text', () => {
    const markdown = '$Beauty = \\lim_{time \\to \\infty} \\frac{inner\\_beauty}{outer\\_beauty}$';
    const ranges = __editorPaneTesting.collectMiaoyanMathDecorationRanges(markdown)
      .map((range) => markdown.slice(range.from, range.to));

    expect(ranges).toEqual([
      '\\lim',
      '_{time \\to \\infty}',
      '\\frac',
    ]);
  });

  it('keeps diagram fences on the regular MiaoYan code highlighting path', () => {
    expect(__editorPaneTesting.getMiaoyanCodeLanguage('```mermaid\ngraph TD\n```')).toBeUndefined();
    expect(__editorPaneTesting.getMiaoyanCodeLanguage('```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```')).toBeUndefined();
    expect(__editorPaneTesting.getMiaoyanCodeLanguage('```markmap\n# Root\n- Child\n```')).toBeUndefined();
  });

  it('matches MiaoYan fenced language rules', () => {
    expect(__editorPaneTesting.getMiaoyanCodeLanguage('```swift\nlet title = "miaoyan"\n```')).toBe('swift');
    expect(__editorPaneTesting.getMiaoyanCodeLanguage('```go\nfmt.Println("miaoyan")\n```')).toBeUndefined();
    expect(__editorPaneTesting.getMiaoyanCodeLanguage('let title = "miaoyan"')).toBeUndefined();
  });

  it('creates atom-one-light token classes for fenced code under the MiaoYan limit', async () => {
    await __editorPaneTesting.loadMiaoyanCodeHighlighterForTesting();
    const ranges = __editorPaneTesting.getMiaoyanCodeHighlightRanges(
      '```swift\nlet title = "miaoyan"\nprint(title)\n```',
    );
    const classes = ranges.map((range) => range.className);

    expect(classes).toContain('hljs-keyword');
    expect(classes).toContain('hljs-string');
    expect(classes).toContain('hljs-built_in');
  });

  it('highlights JavaScript inside fences instead of treating the fence as a template string', async () => {
    await __editorPaneTesting.loadMiaoyanCodeHighlighterForTesting();
    const code = '```js\nconst answer = 42;\nfunction hello(name) {\n  return name;\n}\n```';
    const ranges = __editorPaneTesting.getMiaoyanCodeHighlightRanges(code);

    expect(ranges.some((range) => (
      range.className.includes('hljs-keyword') &&
      code.slice(range.from, range.to) === 'const'
    ))).toBe(true);
    expect(ranges.every((range) => code.slice(range.from, range.to) !== '```')).toBe(true);
  });

  it('falls back to basic code styling above the MiaoYan block size limit', () => {
    const oversizedCode = 'x'.repeat(__editorPaneTesting.MIAOYAN_CODE_BLOCK_HIGHLIGHT_LIMIT + 1);

    expect(__editorPaneTesting.getMiaoyanCodeHighlightRanges(oversizedCode)).toEqual([]);
  });

  it('uses the same code highlighting pipeline for every compatibility theme', () => {
    expect(__editorPaneTesting.shouldHighlightCompatibilityCodeTheme('miaoyan')).toBe(true);
    expect(__editorPaneTesting.shouldHighlightCompatibilityCodeTheme('inkstone')).toBe(true);
    expect(__editorPaneTesting.shouldHighlightCompatibilityCodeTheme('slate')).toBe(true);
    expect(__editorPaneTesting.shouldHighlightCompatibilityCodeTheme('mono')).toBe(true);
    expect(__editorPaneTesting.shouldHighlightCompatibilityCodeTheme('nocturne')).toBe(true);
  });
});

describe('EditorPane settings integration helpers', () => {
  it('maps editor typography settings to CSS variables consumed by compatibility themes', () => {
    expect(__editorPaneTesting.getEditorTypographyStyle(
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
    expect(__editorPaneTesting.getEditorTypographyStyle(
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

  it('only installs line-number gutters when line numbers are enabled', () => {
    expect(__editorPaneTesting.getLineNumberExtensions(false)).toHaveLength(0);
    expect(__editorPaneTesting.getLineNumberExtensions(true).length).toBeGreaterThan(0);
  });

  it('only installs line wrapping when automatic wrapping is enabled', () => {
    expect(__editorPaneTesting.getLineWrappingExtensions(false)).toHaveLength(0);
    expect(__editorPaneTesting.getLineWrappingExtensions(true).length).toBeGreaterThan(0);
  });
});

describe('EditorPane context menu formatting', () => {
  const applyEditorFormatAt = (
    doc: string,
    from: number,
    to: number,
    format: Parameters<typeof __editorPaneTesting.getEditorFormatResult>[3],
  ) => {
    const result = __editorPaneTesting.getEditorFormatResult(doc, from, to, format);
    return {
      doc: `${doc.slice(0, result.from)}${result.insert}${doc.slice(result.to)}`,
      selection: [
        result.selectionFrom,
        result.selectionTo,
      ],
    };
  };

  const applyEditorFormat = (
    doc: string,
    selectedText: string,
    format: Parameters<typeof __editorPaneTesting.getEditorFormatResult>[3],
  ) => {
    const from = doc.indexOf(selectedText);
    expect(from).toBeGreaterThanOrEqual(0);
    return applyEditorFormatAt(doc, from, from + selectedText.length, format);
  };

  it('wraps inline context-menu actions with the Markdown syntax Prism renders', () => {
    expect(applyEditorFormat('hello Prism', 'Prism', 'bold').doc).toBe('hello **Prism**');
    expect(applyEditorFormat('hello Prism', 'Prism', 'italic').doc).toBe('hello *Prism*');
    expect(applyEditorFormat('hello Prism', 'Prism', 'underline').doc).toBe('hello <u>Prism</u>');
    expect(applyEditorFormat('hello Prism', 'Prism', 'strikethrough').doc).toBe('hello ~~Prism~~');
  });

  it('inserts an editable formatting range when there is no selected text', () => {
    const doc = 'hello ';
    const result = __editorPaneTesting.getEditorFormatResult(doc, doc.length, doc.length, 'bold');
    const nextDoc = `${doc.slice(0, result.from)}${result.insert}${doc.slice(result.to)}`;

    expect(nextDoc).toBe('hello ****');
    expect(result.selectionFrom).toBe('hello **'.length);
    expect(result.selectionTo).toBe(result.selectionFrom);
  });

  it('toggles existing inline wrappers off when selecting the inner text', () => {
    expect(applyEditorFormat('hello **Prism**', 'Prism', 'bold').doc).toBe('hello Prism');
    expect(applyEditorFormat('hello *Prism*', 'Prism', 'italic').doc).toBe('hello Prism');
    expect(applyEditorFormat('hello <u>Prism</u>', 'Prism', 'underline').doc).toBe('hello Prism');
    expect(applyEditorFormat('hello ~~Prism~~', 'Prism', 'strikethrough').doc).toBe('hello Prism');
  });

  it('toggles existing inline wrappers off when selecting the full formatted text', () => {
    expect(applyEditorFormat('hello **Prism**', '**Prism**', 'bold').doc).toBe('hello Prism');
    expect(applyEditorFormat('hello *Prism*', '*Prism*', 'italic').doc).toBe('hello Prism');
    expect(applyEditorFormat('hello <u>Prism</u>', '<u>Prism</u>', 'underline').doc).toBe('hello Prism');
    expect(applyEditorFormat('hello ~~Prism~~', '~~Prism~~', 'strikethrough').doc).toBe('hello Prism');
  });

  it('preserves surrounding whitespace outside the inserted formatting markers', () => {
    const doc = 'hello  Prism  today';
    const from = 'hello '.length;
    const to = from + ' Prism '.length;

    expect(applyEditorFormatAt(doc, from, to, 'bold').doc).toBe('hello  **Prism**  today');
  });

  it('does not confuse italic markers with bold markers', () => {
    expect(applyEditorFormat('hello **Prism**', 'Prism', 'italic').doc).toBe('hello ***Prism***');
    expect(applyEditorFormat('hello ***Prism***', 'Prism', 'italic').doc).toBe('hello **Prism**');
    expect(applyEditorFormat('hello *Prism*', 'Prism', 'bold').doc).toBe('hello ***Prism***');
    expect(applyEditorFormat('hello ***Prism***', 'Prism', 'bold').doc).toBe('hello *Prism*');
  });
});
