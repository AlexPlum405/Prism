import { describe, expect, it } from 'vitest';
import { getEditorContextMenuItems } from './contextMenu';

describe('editor context menu', () => {
  it('keeps link insertion available for selected text from the right-click menu', () => {
    const selectedItems = getEditorContextMenuItems(true, 'mac');
    const plainItems = getEditorContextMenuItems(false, 'mac');

    expect(selectedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'link', disabled: false }),
    ]));
    expect(plainItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'link', disabled: true }),
    ]));
  });

  it('exposes source block operations from the right-click menu', () => {
    const items = getEditorContextMenuItems(true, 'mac');
    const blockMenu = items.find((item) => item.label === '块级源码操作');

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
        expect.objectContaining({ action: 'selectionCalloutImportant' }),
        expect.objectContaining({ action: 'selectionTaskList' }),
        expect.objectContaining({ action: 'duplicateSection' }),
        expect.objectContaining({ action: 'foldCurrentHeading' }),
      ]),
    });
  });

  it('adds table actions only when the context is inside a markdown table', () => {
    const plainItems = getEditorContextMenuItems(false, 'mac');
    const tableItems = getEditorContextMenuItems(false, 'mac', true);

    expect(plainItems.find((item) => item.label === '表格')).toBeUndefined();
    expect(tableItems.find((item) => item.label === '表格')).toMatchObject({
      children: expect.arrayContaining([
        expect.objectContaining({ action: 'insertTableRowAbove' }),
        expect.objectContaining({ action: 'insertTableColumnRight' }),
        expect.objectContaining({ action: 'moveTableRowUp' }),
        expect.objectContaining({ action: 'sortTableAsc' }),
        expect.objectContaining({ action: 'copyTableCsv' }),
        expect.objectContaining({ action: 'copyTableTsv' }),
      ]),
    });
  });
});
