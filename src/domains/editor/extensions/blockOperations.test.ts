import { describe, expect, it } from 'vitest';
import { getSourceBlockOperationEdit, isSourceBlockOperation, type SourceBlockOperation } from './blockOperations';

function applyOperation(doc: string, selectedText: string, operation: SourceBlockOperation) {
  const from = doc.indexOf(selectedText);
  expect(from).toBeGreaterThanOrEqual(0);
  const result = getSourceBlockOperationEdit(doc, from, from + selectedText.length, operation);
  expect(result).not.toBeNull();
  return `${doc.slice(0, result!.from)}${result!.insert}${doc.slice(result!.to)}`;
}

describe('source block operations', () => {
  it('recognizes supported command ids', () => {
    expect(isSourceBlockOperation('moveParagraphUp')).toBe(true);
    expect(isSourceBlockOperation('duplicateParagraph')).toBe(true);
    expect(isSourceBlockOperation('deleteParagraph')).toBe(true);
    expect(isSourceBlockOperation('selectionCalloutWarning')).toBe(true);
    expect(isSourceBlockOperation('selectionCalloutImportant')).toBe(true);
    expect(isSourceBlockOperation('unknown')).toBe(false);
  });

  it('moves paragraphs without collapsing blank separators', () => {
    const doc = 'Alpha paragraph\n\nBeta paragraph\n\nGamma paragraph';

    expect(applyOperation(doc, 'Beta paragraph', 'moveParagraphUp')).toBe(
      'Beta paragraph\n\nAlpha paragraph\n\nGamma paragraph',
    );
    expect(applyOperation(doc, 'Beta paragraph', 'moveParagraphDown')).toBe(
      'Alpha paragraph\n\nGamma paragraph\n\nBeta paragraph',
    );
  });

  it('duplicates and deletes the current paragraph without leaving extra blank lines', () => {
    const doc = 'Alpha paragraph\n\nBeta paragraph\n\nGamma paragraph';

    expect(applyOperation(doc, 'Beta paragraph', 'duplicateParagraph')).toBe(
      'Alpha paragraph\n\nBeta paragraph\n\nBeta paragraph\n\nGamma paragraph',
    );
    expect(applyOperation(doc, 'Beta paragraph', 'deleteParagraph')).toBe(
      'Alpha paragraph\n\nGamma paragraph',
    );
    expect(applyOperation('Alpha paragraph\n\nBeta paragraph', 'Beta paragraph', 'deleteParagraph')).toBe(
      'Alpha paragraph',
    );
    expect(applyOperation('Alpha paragraph\n\nBeta paragraph', 'Alpha paragraph', 'deleteParagraph')).toBe(
      'Beta paragraph',
    );
  });

  it('moves heading sections with nested headings as one source block', () => {
    const doc = '# Plan\n\n## Alpha\nBody A\n\n### Detail\nNested\n\n## Beta\nBody B';

    expect(applyOperation(doc, 'Body A', 'moveSectionDown')).toBe(
      '# Plan\n\n## Beta\nBody B\n\n## Alpha\nBody A\n\n### Detail\nNested',
    );
    expect(applyOperation(doc, 'Body B', 'moveSectionUp')).toBe(
      '# Plan\n\n## Beta\nBody B\n\n## Alpha\nBody A\n\n### Detail\nNested',
    );
  });

  it('duplicates the current heading section after the original section', () => {
    const doc = '# Plan\n\n## Alpha\nBody A\n\n## Beta\nBody B';

    expect(applyOperation(doc, 'Body A', 'duplicateSection')).toBe(
      '# Plan\n\n## Alpha\nBody A\n\n## Alpha\nBody A\n\n## Beta\nBody B',
    );
  });

  it('turns selected source lines into quote, callout, and list blocks', () => {
    const doc = 'First line\nSecond line';

    expect(applyOperation(doc, doc, 'selectionQuote')).toBe('> First line\n> Second line');
    expect(applyOperation(doc, doc, 'selectionCalloutWarning')).toBe(
      '> [!WARNING]\n> First line\n> Second line',
    );
    expect(applyOperation(doc, doc, 'selectionCalloutImportant')).toBe(
      '> [!IMPORTANT]\n> First line\n> Second line',
    );
    expect(applyOperation(doc, doc, 'selectionOrderedList')).toBe('1. First line\n2. Second line');
    expect(applyOperation(doc, doc, 'selectionTaskList')).toBe('- [ ] First line\n- [ ] Second line');
  });

  it('normalizes existing list markers before applying another block format', () => {
    const doc = '- Existing item\n> [!IMPORTANT]\n> Quoted item';

    expect(applyOperation(doc, doc, 'selectionTaskList')).toBe(
      '- [ ] Existing item\n- [ ] \n- [ ] Quoted item',
    );
  });
});
