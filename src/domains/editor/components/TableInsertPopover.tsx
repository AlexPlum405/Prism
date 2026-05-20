import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import type { MarkdownTableInsertOptions, TableAlignment } from '../extensions/tables';

interface TableInsertPopoverProps {
  onClose: () => void;
  onInsert: (options: MarkdownTableInsertOptions) => void;
  visible: boolean;
}

const GRID_COLUMNS = 10;
const GRID_ROWS = 10;

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function TableInsertPopover({
  onClose,
  onInsert,
  visible,
}: TableInsertPopoverProps) {
  const [columns, setColumns] = useState(3);
  const [dataRows, setDataRows] = useState(2);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [alignment, setAlignment] = useState<TableAlignment>('left');
  const [previewColumns, setPreviewColumns] = useState(3);
  const [previewRows, setPreviewRows] = useState(2);

  useEffect(() => {
    if (!visible) return;
    setColumns(3);
    setDataRows(2);
    setIncludeHeader(true);
    setAlignment('left');
    setPreviewColumns(3);
    setPreviewRows(2);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, visible]);

  if (!visible) return null;

  const submit = (nextColumns = columns, nextDataRows = dataRows) => {
    onInsert({
      alignment,
      columns: clampInteger(nextColumns, 1, 30),
      dataRows: clampInteger(nextDataRows, 0, 200),
      includeHeader,
    });
  };

  return (
    <div className="prism-table-popover" role="dialog" aria-label={t('editor.table.insert.title')}>
      <div className="prism-table-popover__header">
        <div>
          <div className="prism-table-popover__title">{t('editor.table.insert.title')}</div>
          <div className="prism-table-popover__subtitle">{t('editor.table.insert.subtitle')}</div>
        </div>
        <button type="button" className="prism-table-popover__close" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>
      </div>

      <div className="prism-table-grid" onMouseLeave={() => {
        setPreviewColumns(columns);
        setPreviewRows(dataRows);
      }}>
        {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
          <div className="prism-table-grid__row" key={`row-${rowIndex}`}>
            {Array.from({ length: GRID_COLUMNS }, (_, columnIndex) => {
              const active = columnIndex < previewColumns && rowIndex < previewRows;
              return (
                <button
                  aria-label={`${columnIndex + 1} x ${rowIndex + 1}`}
                  aria-pressed={active}
                  className={`prism-table-grid__cell ${active ? 'is-active' : ''}`}
                  key={`${rowIndex}-${columnIndex}`}
                  onClick={() => {
                    setColumns(columnIndex + 1);
                    setDataRows(rowIndex + 1);
                    submit(columnIndex + 1, rowIndex + 1);
                  }}
                  onMouseEnter={() => {
                    setPreviewColumns(columnIndex + 1);
                    setPreviewRows(rowIndex + 1);
                  }}
                  type="button"
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="prism-table-popover__hint">
        {t('editor.table.insert.gridHint', { columns: previewColumns, rows: previewRows })}
      </div>

      <div className="prism-table-popover__form">
        <label>
          <span>{t('editor.table.insert.columns')}</span>
          <input
            min={1}
            max={30}
            type="number"
            value={columns}
            onChange={(event) => {
              const next = clampInteger(Number(event.currentTarget.value), 1, 30);
              setColumns(next);
              setPreviewColumns(next);
            }}
          />
        </label>
        <label>
          <span>{t('editor.table.insert.dataRows')}</span>
          <input
            min={0}
            max={200}
            type="number"
            value={dataRows}
            onChange={(event) => {
              const next = clampInteger(Number(event.currentTarget.value), 0, 200);
              setDataRows(next);
              setPreviewRows(Math.max(1, next));
            }}
          />
        </label>
      </div>

      <label className="prism-table-popover__check">
        <input
          checked={includeHeader}
          onChange={(event) => setIncludeHeader(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>{t('editor.table.insert.includeHeader')}</span>
      </label>

      <div className="prism-table-popover__alignment" aria-label={t('editor.table.insert.alignment')}>
        {([
          ['left', t('editor.table.insert.left')],
          ['center', t('editor.table.insert.center')],
          ['right', t('editor.table.insert.right')],
        ] as const).map(([value, label]) => (
          <button
            className={alignment === value ? 'is-active' : ''}
            key={value}
            onClick={() => setAlignment(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <button className="prism-table-popover__submit" onClick={() => submit()} type="button">
        {t('editor.table.insert.action')}
      </button>
    </div>
  );
}
