import { describe, expect, it } from 'vitest';
import { getEditorContextMenuItems } from './contextMenu';

describe('editor context menu', () => {
  it('exposes source block operations from the right-click menu', () => {
    const items = getEditorContextMenuItems(true, 'mac');
    const blockMenu = items.find((item) => item.label === '块级操作');

    expect(blockMenu).toMatchObject({
      children: expect.arrayContaining([
        expect.objectContaining({ action: 'moveParagraphUp' }),
        expect.objectContaining({ action: 'moveParagraphDown' }),
        expect.objectContaining({ action: 'duplicateParagraph' }),
        expect.objectContaining({ action: 'deleteParagraph', danger: true }),
        expect.objectContaining({ action: 'selectionQuote' }),
        expect.objectContaining({ action: 'selectionCalloutNote' }),
        expect.objectContaining({ action: 'selectionCalloutWarning' }),
        expect.objectContaining({ action: 'selectionCalloutTip' }),
        expect.objectContaining({ action: 'selectionTaskList' }),
        expect.objectContaining({ action: 'duplicateSection' }),
        expect.objectContaining({ action: 'foldCurrentHeading' }),
      ]),
    });
  });
});
