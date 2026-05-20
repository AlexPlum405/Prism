import { useState } from 'react';
import { t } from '../../i18n';
import type { MarkdownTableCommand } from '../extensions/tables';

interface TableFloatingToolbarProps {
  onCommand: (command: MarkdownTableCommand) => void;
  onCopy: (format: 'markdown' | 'html' | 'csv' | 'tsv') => void;
  onSelectTable: () => void;
  onConvert: (target: 'html' | 'markdown') => void;
  visible: boolean;
  x: number;
  y: number;
}

export function TableFloatingToolbar({
  onCommand,
  onConvert,
  onCopy,
  onSelectTable,
  visible,
  x,
  y,
}: TableFloatingToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  if (!visible) return null;

  return (
    <div
      className="prism-table-toolbar"
      onMouseDown={(event) => event.preventDefault()}
      role="toolbar"
      style={{ left: x, top: y }}
    >
      <button type="button" onClick={() => onCommand('insertRowBelow')}>
        {t('editor.table.toolbar.insertRow')}
      </button>
      <button type="button" onClick={() => onCommand('insertColumnRight')}>
        {t('editor.table.toolbar.insertColumn')}
      </button>
      <button type="button" onClick={() => onCommand('deleteRow')}>
        {t('editor.table.toolbar.deleteRow')}
      </button>
      <button type="button" onClick={() => onCommand('deleteColumn')}>
        {t('editor.table.toolbar.deleteColumn')}
      </button>
      <span className="prism-table-toolbar__separator" />
      <button type="button" onClick={() => onCommand('alignLeft')}>
        {t('editor.table.toolbar.alignLeft')}
      </button>
      <button type="button" onClick={() => onCommand('alignCenter')}>
        {t('editor.table.toolbar.alignCenter')}
      </button>
      <button type="button" onClick={() => onCommand('alignRight')}>
        {t('editor.table.toolbar.alignRight')}
      </button>
      <span className="prism-table-toolbar__separator" />
      <button type="button" onClick={() => onCommand('format')}>
        {t('editor.table.toolbar.format')}
      </button>
      <button type="button" onClick={() => onCopy('markdown')}>
        {t('editor.table.toolbar.copy')}
      </button>
      <div className="prism-table-toolbar__more">
        <button type="button" onClick={() => setMoreOpen((open) => !open)}>
          {t('editor.table.toolbar.more')}
        </button>
        {moreOpen && (
          <div className="prism-table-toolbar__menu" role="menu">
            <button type="button" onClick={() => onCommand('insertRowAbove')}>{t('command.insertTableRowAbove')}</button>
            <button type="button" onClick={() => onCommand('insertColumnLeft')}>{t('command.insertTableColumnLeft')}</button>
            <button type="button" onClick={() => onCommand('moveRowUp')}>{t('command.moveTableRowUp')}</button>
            <button type="button" onClick={() => onCommand('moveRowDown')}>{t('command.moveTableRowDown')}</button>
            <button type="button" onClick={() => onCommand('moveColumnLeft')}>{t('command.moveTableColumnLeft')}</button>
            <button type="button" onClick={() => onCommand('moveColumnRight')}>{t('command.moveTableColumnRight')}</button>
            <button type="button" onClick={() => onCommand('sortAsc')}>{t('command.sortTableAsc')}</button>
            <button type="button" onClick={() => onCommand('sortDesc')}>{t('command.sortTableDesc')}</button>
            <button type="button" onClick={onSelectTable}>{t('command.selectTable')}</button>
            <button type="button" onClick={() => onCopy('html')}>{t('command.copyTableHtml')}</button>
            <button type="button" onClick={() => onCopy('csv')}>{t('command.copyTableCsv')}</button>
            <button type="button" onClick={() => onCopy('tsv')}>{t('command.copyTableTsv')}</button>
            <button type="button" onClick={() => onConvert('html')}>{t('command.convertTableToHtml')}</button>
            <button type="button" onClick={() => onConvert('markdown')}>{t('command.convertHtmlTableToMarkdown')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
