import { t } from '../../i18n';

export type TableAlignment = 'left' | 'center' | 'right';

export type MarkdownTableCommand =
  | 'insert'
  | 'format'
  | 'addRow'
  | 'addColumn'
  | 'deleteRow'
  | 'deleteColumn'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'insertRowAbove'
  | 'insertRowBelow'
  | 'insertColumnLeft'
  | 'insertColumnRight'
  | 'moveRowUp'
  | 'moveRowDown'
  | 'moveColumnLeft'
  | 'moveColumnRight'
  | 'sortAsc'
  | 'sortDesc';

export interface MarkdownTableInsertOptions {
  alignment?: TableAlignment;
  columns?: number;
  dataRows?: number;
  includeHeader?: boolean;
}

interface SourceLine {
  from: number;
  number: number;
  text: string;
  to: number;
}

interface ParsedCell {
  from: number;
  segmentFrom: number;
  segmentTo: number;
  to: number;
  value: string;
}

interface ParsedTableLine {
  cells: ParsedCell[];
  line: SourceLine;
}

export interface MarkdownTableBlock {
  alignments: TableAlignment[];
  bodyRows: string[][];
  columnCount: number;
  cursorColumnIndex: number;
  cursorRowIndex: number;
  from: number;
  header: string[];
  headerLine: number;
  rawBodyColumnCounts: number[];
  rawHeaderColumnCount: number;
  rawSeparatorColumnCount: number;
  separatorLine: number;
  to: number;
}

export interface MarkdownTableCommandEdit {
  from: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
  to: number;
}

export type TableDiagnosticKind =
  | 'missing-separator'
  | 'invalid-alignment'
  | 'inconsistent-columns'
  | 'empty-header'
  | 'too-wide'
  | 'unescaped-pipe';

export interface TableDiagnostic {
  action: string;
  column: number;
  kind: TableDiagnosticKind;
  line: number;
  message: string;
  reason: string;
  severity: 'error' | 'warning';
}

export interface MarkdownTableSerialization {
  csv: string;
  html: string;
  markdown: string;
  tsv: string;
}

export type MarkdownTableNavigation =
  | 'nextCell'
  | 'previousCell'
  | 'nextRow'
  | 'lineBreak'
  | 'escape';

const DEFAULT_INSERT_OPTIONS: Required<MarkdownTableInsertOptions> = {
  alignment: 'left',
  columns: 3,
  dataRows: 2,
  includeHeader: true,
};
const MAX_INSERT_COLUMNS = 30;
const MAX_INSERT_ROWS = 200;
const WIDE_TABLE_COLUMN_LIMIT = 8;
const WIDE_TABLE_WIDTH_LIMIT = 120;

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
}

function normalizeInsertOptions(options: MarkdownTableInsertOptions = {}): Required<MarkdownTableInsertOptions> {
  return {
    alignment: options.alignment ?? DEFAULT_INSERT_OPTIONS.alignment,
    columns: clampInteger(options.columns, 1, MAX_INSERT_COLUMNS, DEFAULT_INSERT_OPTIONS.columns),
    dataRows: clampInteger(options.dataRows, 0, MAX_INSERT_ROWS, DEFAULT_INSERT_OPTIONS.dataRows),
    includeHeader: options.includeHeader ?? DEFAULT_INSERT_OPTIONS.includeHeader,
  };
}

function getSourceLines(doc: string): SourceLine[] {
  const parts = doc.split('\n');
  let offset = 0;
  return parts.map((text, index) => {
    const from = offset;
    const to = from + text.length;
    offset = to + 1;
    return {
      from,
      number: index,
      text,
      to,
    };
  });
}

function getLineAt(lines: SourceLine[], position: number): SourceLine {
  return lines.find((line) => position >= line.from && position <= line.to) ?? lines[lines.length - 1];
}

function isEscaped(text: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function getUnescapedPipeIndexes(line: string) {
  const indexes: number[] = [];
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '|' && !isEscaped(line, index)) indexes.push(index);
  }
  return indexes;
}

function hasTablePipe(line: string): boolean {
  return getUnescapedPipeIndexes(line).length > 0;
}

function trimRange(line: string, from: number, to: number) {
  let start = from;
  let end = to;
  while (start < end && /\s/.test(line[start])) start += 1;
  while (end > start && /\s/.test(line[end - 1])) end -= 1;
  return { start, end };
}

export function splitTableCells(line: string, lineOffset = 0): ParsedCell[] {
  const pipes = getUnescapedPipeIndexes(line);
  const trimmed = trimRange(line, 0, line.length);
  if (pipes.length === 0) {
    const range = trimRange(line, trimmed.start, trimmed.end);
    return [{
      from: lineOffset + range.start,
      segmentFrom: lineOffset + trimmed.start,
      segmentTo: lineOffset + trimmed.end,
      to: lineOffset + range.end,
      value: line.slice(range.start, range.end),
    }];
  }

  const startsWithPipe = line[trimmed.start] === '|';
  const endsWithPipe = line[trimmed.end - 1] === '|';
  const segments: Array<{ from: number; to: number }> = [];
  let segmentFrom = startsWithPipe ? trimmed.start + 1 : trimmed.start;

  for (const pipe of pipes) {
    if (pipe < segmentFrom) continue;
    if (pipe >= trimmed.end) break;
    segments.push({ from: segmentFrom, to: pipe });
    segmentFrom = pipe + 1;
  }

  if (!endsWithPipe || segmentFrom < trimmed.end) {
    segments.push({ from: segmentFrom, to: trimmed.end });
  }

  return segments.map((segment) => {
    const range = trimRange(line, segment.from, segment.to);
    return {
      from: lineOffset + range.start,
      segmentFrom: lineOffset + segment.from,
      segmentTo: lineOffset + segment.to,
      to: lineOffset + range.end,
      value: line.slice(range.start, range.end),
    };
  });
}

function isSeparatorCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function looksLikeSeparatorCell(cell: string): boolean {
  return /^:?-+:?$/.test(cell.trim());
}

function isSeparatorLine(line: string): boolean {
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every((cell) => isSeparatorCell(cell.value));
}

function isInvalidSeparatorLine(line: string): boolean {
  const cells = splitTableCells(line);
  return cells.length > 0
    && cells.every((cell) => looksLikeSeparatorCell(cell.value))
    && !cells.every((cell) => isSeparatorCell(cell.value));
}

function parseAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

function normalizeRow(row: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
}

function getCursorColumnIndex(line: ParsedTableLine, cursor: number, columnCount: number): number {
  const cellIndex = line.cells.findIndex((cell) => (
    cursor >= cell.segmentFrom && cursor <= cell.segmentTo
  ));
  if (cellIndex >= 0) return Math.max(0, Math.min(columnCount - 1, cellIndex));
  return Math.max(0, Math.min(columnCount - 1, line.cells.length - 1));
}

export function findMarkdownTableBlock(doc: string, cursor: number): MarkdownTableBlock | null {
  if (!doc) return null;
  const lines = getSourceLines(doc);
  const currentLine = getLineAt(lines, cursor);
  if (!currentLine || !hasTablePipe(currentLine.text)) return null;

  let first = currentLine.number;
  let last = currentLine.number;
  while (first > 0 && hasTablePipe(lines[first - 1].text)) first -= 1;
  while (last < lines.length - 1 && hasTablePipe(lines[last + 1].text)) last += 1;

  const tableLines = lines.slice(first, last + 1);
  const separatorIndex = tableLines.findIndex((line) => isSeparatorLine(line.text));
  if (separatorIndex <= 0) return null;

  const headerLine = tableLines[separatorIndex - 1];
  const separatorLine = tableLines[separatorIndex];
  if (currentLine.number < headerLine.number) return null;

  const bodySourceLines = tableLines.slice(separatorIndex + 1);
  const parsedHeader = splitTableCells(headerLine.text, headerLine.from);
  const parsedSeparator = splitTableCells(separatorLine.text, separatorLine.from);
  const parsedBodyRows = bodySourceLines.map((line) => splitTableCells(line.text, line.from));
  const rawBodyColumnCounts = parsedBodyRows.map((row) => row.length);
  const columnCount = Math.max(
    parsedHeader.length,
    parsedSeparator.length,
    ...rawBodyColumnCounts,
    1,
  );
  const alignments = Array.from({ length: columnCount }, (_, index) => (
    parsedSeparator[index] ? parseAlignment(parsedSeparator[index].value) : 'left'
  ));
  const currentParsedLine = {
    cells: splitTableCells(currentLine.text, currentLine.from),
    line: currentLine,
  };

  return {
    alignments,
    bodyRows: parsedBodyRows.map((row) => normalizeRow(row.map((cell) => cell.value), columnCount)),
    columnCount,
    cursorColumnIndex: getCursorColumnIndex(currentParsedLine, cursor, columnCount),
    cursorRowIndex: currentLine.number === headerLine.number
      ? -1
      : currentLine.number === separatorLine.number
        ? -2
        : Math.max(0, currentLine.number - separatorLine.number - 1),
    from: headerLine.from,
    header: normalizeRow(parsedHeader.map((cell) => cell.value), columnCount),
    headerLine: headerLine.number + 1,
    rawBodyColumnCounts,
    rawHeaderColumnCount: parsedHeader.length,
    rawSeparatorColumnCount: parsedSeparator.length,
    separatorLine: separatorLine.number + 1,
    to: tableLines[tableLines.length - 1].to,
  };
}

function padCell(value: string, width: number, alignment: TableAlignment): string {
  if (alignment === 'right') return value.padStart(width, ' ');
  if (alignment === 'center') {
    const total = Math.max(0, width - value.length);
    const left = Math.floor(total / 2);
    const right = total - left;
    return `${' '.repeat(left)}${value}${' '.repeat(right)}`;
  }
  return value.padEnd(width, ' ');
}

function formatSeparatorCell(width: number, alignment: TableAlignment): string {
  if (alignment === 'center') return `:${'-'.repeat(Math.max(3, width - 2))}:`;
  if (alignment === 'right') return `${'-'.repeat(Math.max(3, width - 1))}:`;
  return '-'.repeat(Math.max(3, width));
}

export function escapeMarkdownTableCell(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '<br>')
    .replace(/(^|[^\\])\|/g, '$1\\|')
    .trim();
}

export function formatMarkdownTable(
  header: string[],
  alignments: TableAlignment[],
  bodyRows: string[][],
): string {
  const columnCount = Math.max(header.length, alignments.length, ...bodyRows.map((row) => row.length), 1);
  const normalizedHeader = normalizeRow(header, columnCount);
  const normalizedAlignments = Array.from({ length: columnCount }, (_, index) => alignments[index] ?? 'left');
  const normalizedRows = bodyRows.map((row) => normalizeRow(row, columnCount));
  const widths = Array.from({ length: columnCount }, (_, column) => Math.max(
    3,
    normalizedHeader[column].length,
    ...normalizedRows.map((row) => row[column].length),
  ));

  const formatRow = (row: string[]) => `| ${row.map((cell, index) => (
    padCell(cell, widths[index], normalizedAlignments[index])
  )).join(' | ')} |`;

  const separator = `| ${widths.map((width, index) => (
    padCell(formatSeparatorCell(width, normalizedAlignments[index]), width, 'left')
  )).join(' | ')} |`;

  return [
    formatRow(normalizedHeader),
    separator,
    ...normalizedRows.map(formatRow),
  ].join('\n');
}

function getCellPositionFromFormattedBlock(block: MarkdownTableBlock, rowIndex: number, columnIndex: number): number {
  const source = formatMarkdownTable(block.header, block.alignments, block.bodyRows);
  const lines = getSourceLines(source);
  const sourceLine = rowIndex < 0 ? lines[0] : lines[rowIndex + 2] ?? lines[lines.length - 1];
  const cells = splitTableCells(sourceLine.text, sourceLine.from);
  const cell = cells[Math.max(0, Math.min(columnIndex, cells.length - 1))];
  return cell?.from ?? sourceLine.from;
}

export function createMarkdownTable(input: MarkdownTableInsertOptions = {}) {
  const options = normalizeInsertOptions(input);
  const header = Array.from({ length: options.columns }, (_, index) => (
    options.includeHeader ? `Column ${index + 1}` : ''
  ));
  const alignments = Array.from({ length: options.columns }, () => options.alignment);
  const bodyRows = Array.from({ length: options.dataRows }, () => (
    Array.from({ length: options.columns }, () => '')
  ));
  const markdown = formatMarkdownTable(header, alignments, bodyRows);
  const block = findMarkdownTableBlock(markdown, 0);
  const selectionOffset = block
    ? getCellPositionFromFormattedBlock(block, options.includeHeader || bodyRows.length === 0 ? -1 : 0, 0)
    : 0;
  return { markdown, selectionOffset };
}

function getInsertTableEdit(
  doc: string,
  from: number,
  to: number,
  options?: MarkdownTableInsertOptions,
): MarkdownTableCommandEdit {
  const leadingNewline = from > 0 && doc[from - 1] !== '\n' ? '\n' : '';
  const trailingNewline = to < doc.length && doc[to] !== '\n' ? '\n' : '';
  const table = createMarkdownTable(options);
  const insert = `${leadingNewline}${table.markdown}${trailingNewline}`;
  const selection = from + leadingNewline.length + table.selectionOffset;

  return {
    from,
    to,
    insert,
    selectionFrom: selection,
    selectionTo: selection,
  };
}

function makeTableEdit(
  block: MarkdownTableBlock,
  next: Pick<MarkdownTableBlock, 'alignments' | 'bodyRows' | 'header'>,
  selectionRow = block.cursorRowIndex,
  selectionColumn = block.cursorColumnIndex,
): MarkdownTableCommandEdit {
  const insert = formatMarkdownTable(next.header, next.alignments, next.bodyRows);
  const nextBlock = findMarkdownTableBlock(insert, 0);
  const selectionOffset = nextBlock
    ? getCellPositionFromFormattedBlock(nextBlock, selectionRow, selectionColumn)
    : 0;
  return {
    from: block.from,
    to: block.to,
    insert,
    selectionFrom: block.from + selectionOffset,
    selectionTo: block.from + selectionOffset,
  };
}

function updateTable(
  block: MarkdownTableBlock,
  updater: (input: MarkdownTableBlock) => (Pick<MarkdownTableBlock, 'alignments' | 'bodyRows' | 'header'> & {
    selectionColumn?: number;
    selectionRow?: number;
  }) | null,
): MarkdownTableCommandEdit | null {
  const next = updater(block);
  if (!next) return null;
  return makeTableEdit(block, next, next.selectionRow ?? block.cursorRowIndex, next.selectionColumn ?? block.cursorColumnIndex);
}

function insertRow(block: MarkdownTableBlock, position: 'above' | 'below') {
  return updateTable(block, ({ alignments, bodyRows, columnCount, cursorRowIndex, header }) => {
    const nextRows = [...bodyRows];
    const current = cursorRowIndex < 0 ? 0 : Math.min(cursorRowIndex, nextRows.length);
    const insertAt = position === 'above' ? current : Math.min(current + 1, nextRows.length);
    nextRows.splice(insertAt, 0, Array.from({ length: columnCount }, () => ''));
    return {
      alignments,
      bodyRows: nextRows,
      header,
      selectionRow: insertAt,
      selectionColumn: block.cursorColumnIndex,
    };
  });
}

function insertColumn(block: MarkdownTableBlock, position: 'left' | 'right') {
  return updateTable(block, ({ alignments, bodyRows, cursorColumnIndex, header }) => {
    const insertAt = position === 'left' ? cursorColumnIndex : cursorColumnIndex + 1;
    const insertCell = (row: string[]) => {
      const next = [...row];
      next.splice(insertAt, 0, '');
      return next;
    };
    const nextAlignments = [...alignments];
    nextAlignments.splice(insertAt, 0, 'left');
    return {
      alignments: nextAlignments,
      bodyRows: bodyRows.map(insertCell),
      header: insertCell(header),
      selectionColumn: insertAt,
    };
  });
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function compareTableValues(a: string, b: string) {
  const emptyA = a.trim() === '';
  const emptyB = b.trim() === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;

  const numA = Number(a.replace(/,/g, ''));
  const numB = Number(b.replace(/,/g, ''));
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;

  const dateA = Date.parse(a);
  const dateB = Date.parse(b);
  if (Number.isFinite(dateA) && Number.isFinite(dateB)) return dateA - dateB;

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function sortRows(block: MarkdownTableBlock, direction: 'asc' | 'desc') {
  return updateTable(block, ({ alignments, bodyRows, cursorColumnIndex, header }) => {
    const sorted = bodyRows
      .map((row, index) => ({ index, row }))
      .sort((a, b) => {
        const compared = compareTableValues(a.row[cursorColumnIndex] ?? '', b.row[cursorColumnIndex] ?? '');
        const stable = compared === 0 ? a.index - b.index : compared;
        return direction === 'asc' ? stable : -stable;
      })
      .map(({ row }) => row);
    return { alignments, bodyRows: sorted, header };
  });
}

function getMalformedTableFormatEdit(doc: string, cursor: number): MarkdownTableCommandEdit | null {
  const lines = getSourceLines(doc);
  const current = getLineAt(lines, cursor);
  const candidates = [
    current.number - 1,
    current.number,
  ].filter((lineNumber) => lineNumber >= 0 && lineNumber < lines.length);

  for (const candidate of candidates) {
    const headerLine = lines[candidate];
    const nextLine = lines[candidate + 1];
    if (!headerLine || !nextLine || !hasTablePipe(headerLine.text) || !hasTablePipe(nextLine.text)) continue;

    const hasSeparator = isSeparatorLine(nextLine.text) || isInvalidSeparatorLine(nextLine.text);
    const bodyStart = hasSeparator ? candidate + 2 : candidate + 1;
    let last = Math.max(candidate + 1, bodyStart - 1);
    while (last + 1 < lines.length && hasTablePipe(lines[last + 1].text)) {
      last += 1;
    }

    const header = splitTableCells(headerLine.text).map((cell) => cell.value);
    const separatorCells = hasSeparator ? splitTableCells(nextLine.text) : [];
    const bodyRows = lines.slice(bodyStart, last + 1).map((line) => (
      splitTableCells(line.text).map((cell) => cell.value)
    ));
    const columnCount = Math.max(
      header.length,
      separatorCells.length,
      ...bodyRows.map((row) => row.length),
      1,
    );
    const alignments = Array.from({ length: columnCount }, (_, index) => (
      separatorCells[index] ? parseAlignment(separatorCells[index].value) : 'left'
    ));
    const insert = formatMarkdownTable(
      normalizeRow(header, columnCount),
      alignments,
      bodyRows.map((row) => normalizeRow(row, columnCount)),
    );
    const nextBlock = findMarkdownTableBlock(insert, 0);
    const selectionOffset = nextBlock
      ? getCellPositionFromFormattedBlock(nextBlock, 0, 0)
      : 0;

    return {
      from: headerLine.from,
      to: lines[last].to,
      insert,
      selectionFrom: headerLine.from + selectionOffset,
      selectionTo: headerLine.from + selectionOffset,
    };
  }

  return null;
}

export function getMarkdownTableCommandEdit(
  doc: string,
  selectionFrom: number,
  selectionTo: number,
  command: MarkdownTableCommand,
  options?: MarkdownTableInsertOptions,
): MarkdownTableCommandEdit | null {
  if (command === 'insert') return getInsertTableEdit(doc, selectionFrom, selectionTo, options);

  const block = findMarkdownTableBlock(doc, selectionFrom);
  if (!block) {
    return command === 'format'
      ? getMalformedTableFormatEdit(doc, selectionFrom)
      : null;
  }

  if (command === 'format') {
    return updateTable(block, ({ alignments, bodyRows, header }) => ({ alignments, bodyRows, header }));
  }

  if (command === 'addRow' || command === 'insertRowBelow') return insertRow(block, 'below');
  if (command === 'insertRowAbove') return insertRow(block, 'above');

  if (command === 'deleteRow') {
    return updateTable(block, ({ alignments, bodyRows, cursorRowIndex, header }) => {
      if (cursorRowIndex < 0 || bodyRows.length === 0) return null;
      const nextRows = bodyRows.filter((_, index) => index !== cursorRowIndex);
      return {
        alignments,
        bodyRows: nextRows,
        header,
        selectionRow: Math.max(0, Math.min(cursorRowIndex, nextRows.length - 1)),
      };
    });
  }

  if (command === 'addColumn' || command === 'insertColumnRight') return insertColumn(block, 'right');
  if (command === 'insertColumnLeft') return insertColumn(block, 'left');

  if (command === 'alignLeft' || command === 'alignCenter' || command === 'alignRight') {
    const nextAlignment: TableAlignment = command === 'alignCenter'
      ? 'center'
      : command === 'alignRight'
        ? 'right'
        : 'left';
    return updateTable(block, ({ alignments, bodyRows, cursorColumnIndex, header }) => {
      const nextAlignments = [...alignments];
      nextAlignments[cursorColumnIndex] = nextAlignment;
      return { alignments: nextAlignments, bodyRows, header };
    });
  }

  if (command === 'deleteColumn') {
    return updateTable(block, ({ alignments, bodyRows, columnCount, cursorColumnIndex, header }) => {
      if (columnCount <= 1) return null;
      const deleteAt = cursorColumnIndex;
      const deleteCell = (row: string[]) => row.filter((_, index) => index !== deleteAt);
      return {
        alignments: alignments.filter((_, index) => index !== deleteAt),
        bodyRows: bodyRows.map(deleteCell),
        header: deleteCell(header),
        selectionColumn: Math.max(0, deleteAt - 1),
      };
    });
  }

  if (command === 'moveRowUp' || command === 'moveRowDown') {
    return updateTable(block, ({ alignments, bodyRows, cursorRowIndex, header }) => {
      if (cursorRowIndex < 0) return null;
      const to = command === 'moveRowUp' ? cursorRowIndex - 1 : cursorRowIndex + 1;
      if (to < 0 || to >= bodyRows.length) return null;
      return {
        alignments,
        bodyRows: moveItem(bodyRows, cursorRowIndex, to),
        header,
        selectionRow: to,
      };
    });
  }

  if (command === 'moveColumnLeft' || command === 'moveColumnRight') {
    return updateTable(block, ({ alignments, bodyRows, cursorColumnIndex, header }) => {
      const to = command === 'moveColumnLeft' ? cursorColumnIndex - 1 : cursorColumnIndex + 1;
      if (to < 0 || to >= alignments.length) return null;
      const moveCell = (row: string[]) => moveItem(row, cursorColumnIndex, to);
      return {
        alignments: moveItem(alignments, cursorColumnIndex, to),
        bodyRows: bodyRows.map(moveCell),
        header: moveCell(header),
        selectionColumn: to,
      };
    });
  }

  if (command === 'sortAsc') return sortRows(block, 'asc');
  if (command === 'sortDesc') return sortRows(block, 'desc');

  return null;
}

export function getMarkdownTableSelection(doc: string, cursor: number) {
  const block = findMarkdownTableBlock(doc, cursor);
  return block ? { from: block.from, to: block.to } : null;
}

function getTableRowCount(block: MarkdownTableBlock) {
  return 1 + block.bodyRows.length;
}

function getLogicalRowIndex(block: MarkdownTableBlock) {
  return block.cursorRowIndex < 0 ? 0 : block.cursorRowIndex + 1;
}

function makeTableSelectionEdit(block: MarkdownTableBlock, logicalRow: number, column: number) {
  return makeTableEdit(
    block,
    {
      alignments: block.alignments,
      bodyRows: block.bodyRows,
      header: block.header,
    },
    logicalRow === 0 ? -1 : logicalRow - 1,
    column,
  );
}

export function getMarkdownTableNavigationEdit(
  doc: string,
  cursor: number,
  navigation: MarkdownTableNavigation,
): MarkdownTableCommandEdit | null {
  const block = findMarkdownTableBlock(doc, cursor);
  if (!block) return null;

  if (navigation === 'escape') {
    const hasFollowingLine = doc[block.to] === '\n';
    const insert = hasFollowingLine ? '' : '\n';
    const selection = block.to + (hasFollowingLine ? 1 : 1);
    return {
      from: block.to,
      to: block.to,
      insert,
      selectionFrom: selection,
      selectionTo: selection,
    };
  }

  if (navigation === 'lineBreak') {
    return {
      from: cursor,
      to: cursor,
      insert: '<br>',
      selectionFrom: cursor + 4,
      selectionTo: cursor + 4,
    };
  }

  const logicalRow = getLogicalRowIndex(block);
  const column = block.cursorColumnIndex;
  const rowCount = getTableRowCount(block);

  if (navigation === 'previousCell') {
    const previousColumn = column - 1;
    const previousRow = previousColumn >= 0 ? logicalRow : logicalRow - 1;
    if (previousRow < 0) return null;
    const targetColumn = previousColumn >= 0 ? previousColumn : block.columnCount - 1;
    return makeTableSelectionEdit(block, previousRow, targetColumn);
  }

  if (navigation === 'nextRow') {
    const nextLogicalRow = logicalRow + 1;
    if (nextLogicalRow < rowCount) {
      return makeTableSelectionEdit(block, nextLogicalRow, column);
    }
    return insertRow(block, 'below');
  }

  const nextColumn = column + 1;
  const nextLogicalRow = nextColumn < block.columnCount ? logicalRow : logicalRow + 1;
  if (nextLogicalRow < rowCount) {
    const targetColumn = nextColumn < block.columnCount ? nextColumn : 0;
    return makeTableSelectionEdit(block, nextLogicalRow, targetColumn);
  }

  const added = insertRow(block, 'below');
  if (!added) return null;
  const nextBlock = findMarkdownTableBlock(added.insert, 0);
  const selectionOffset = nextBlock
    ? getCellPositionFromFormattedBlock(nextBlock, block.bodyRows.length, 0)
    : 0;
  return {
    ...added,
    selectionFrom: block.from + selectionOffset,
    selectionTo: block.from + selectionOffset,
  };
}

function looksLikeDelimitedTable(text: string) {
  const normalized = text.trim();
  if (!normalized) return false;
  if (normalized.includes('\t')) return true;
  const rows = parseDelimitedText(normalized);
  return rows.length > 1 && rows.some((row) => row.length > 1);
}

function parseDelimitedText(text: string): string[][] {
  const delimiter = text.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (char === '\r' && next === '\n') index += 1;
      continue;
    }
    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows
    .map((cells) => cells.map((value) => escapeMarkdownTableCell(value)))
    .filter((cells) => cells.some((value) => value.trim().length > 0));
}

function tableFromDelimitedRows(rows: string[][]) {
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  const header = normalizeRow(rows[0] ?? [], columnCount);
  const bodyRows = rows.length > 1
    ? rows.slice(1).map((row) => normalizeRow(row, columnCount))
    : [Array.from({ length: columnCount }, () => '')];
  return formatMarkdownTable(header, Array.from({ length: columnCount }, () => 'left'), bodyRows);
}

function fillTableWithRows(block: MarkdownTableBlock, rows: string[][]): MarkdownTableCommandEdit | null {
  const startLogicalRow = getLogicalRowIndex(block);
  const startColumn = block.cursorColumnIndex;
  const nextColumnCount = Math.max(block.columnCount, startColumn + Math.max(...rows.map((row) => row.length), 0));
  let header = normalizeRow(block.header, nextColumnCount);
  const alignments = Array.from({ length: nextColumnCount }, (_, index) => block.alignments[index] ?? 'left');
  const bodyRows = block.bodyRows.map((row) => normalizeRow(row, nextColumnCount));

  rows.forEach((row, rowOffset) => {
    const logicalRow = startLogicalRow + rowOffset;
    if (logicalRow === 0) {
      row.forEach((cell, index) => {
        header[startColumn + index] = cell;
      });
      return;
    }

    const bodyIndex = logicalRow - 1;
    while (bodyRows.length <= bodyIndex) {
      bodyRows.push(Array.from({ length: nextColumnCount }, () => ''));
    }
    row.forEach((cell, index) => {
      bodyRows[bodyIndex][startColumn + index] = cell;
    });
  });

  return makeTableEdit(block, {
    alignments: alignments.map((alignment) => alignment || 'left'),
    bodyRows,
    header,
  }, startLogicalRow === 0 ? -1 : startLogicalRow - 1, startColumn);
}

export function getMarkdownTablePasteEdit(
  doc: string,
  selectionFrom: number,
  selectionTo: number,
  text: string,
): MarkdownTableCommandEdit | null {
  if (!looksLikeDelimitedTable(text)) return null;
  const rows = parseDelimitedText(text);
  if (rows.length === 0) return null;

  const block = findMarkdownTableBlock(doc, selectionFrom);
  if (block) return fillTableWithRows(block, rows);

  const markdown = tableFromDelimitedRows(rows);
  const leadingNewline = selectionFrom > 0 && doc[selectionFrom - 1] !== '\n' ? '\n' : '';
  const trailingNewline = selectionTo < doc.length && doc[selectionTo] !== '\n' ? '\n' : '';
  const insert = `${leadingNewline}${markdown}${trailingNewline}`;
  const insertedBlock = findMarkdownTableBlock(markdown, 0);
  const selectionOffset = insertedBlock ? getCellPositionFromFormattedBlock(insertedBlock, 0, 0) : 0;
  const selection = selectionFrom + leadingNewline.length + selectionOffset;
  return {
    from: selectionFrom,
    to: selectionTo,
    insert,
    selectionFrom: selection,
    selectionTo: selection,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function alignmentStyle(alignment: TableAlignment) {
  return alignment === 'left' ? '' : ` style="text-align:${alignment}"`;
}

export function markdownTableToHtml(block: MarkdownTableBlock): string {
  const header = block.header.map((cell, index) => `<th${alignmentStyle(block.alignments[index])}>${escapeHtml(cell)}</th>`).join('');
  const rows = block.bodyRows.map((row) => (
    `<tr>${row.map((cell, index) => `<td${alignmentStyle(block.alignments[index])}>${escapeHtml(cell)}</td>`).join('')}</tr>`
  )).join('\n');
  return `<table>\n<thead><tr>${header}</tr></thead>\n<tbody>\n${rows}\n</tbody>\n</table>`;
}

function serializeDelimited(rows: string[][], delimiter: ',' | '\t') {
  return rows.map((row) => row.map((cell) => {
    const value = cell.replace(/<br\s*\/?>/gi, '\n').replace(/\\\|/g, '|');
    const mustQuote = delimiter === ','
      ? /[",\n\r]/.test(value)
      : /["\t\n\r]/.test(value);
    return mustQuote ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(delimiter)).join('\n');
}

export function getMarkdownTableSerialization(doc: string, cursor: number): MarkdownTableSerialization | null {
  const block = findMarkdownTableBlock(doc, cursor);
  if (!block) return null;
  const markdown = doc.slice(block.from, block.to);
  const rows = [block.header, ...block.bodyRows];
  return {
    csv: serializeDelimited(rows, ','),
    html: markdownTableToHtml(block),
    markdown,
    tsv: serializeDelimited(rows, '\t'),
  };
}

export function getMarkdownTableToHtmlEdit(doc: string, cursor: number): MarkdownTableCommandEdit | null {
  const block = findMarkdownTableBlock(doc, cursor);
  if (!block) return null;
  const html = markdownTableToHtml(block);
  return {
    from: block.from,
    to: block.to,
    insert: html,
    selectionFrom: block.from,
    selectionTo: block.from + html.length,
  };
}

function findHtmlTableRange(doc: string, cursor: number) {
  const before = doc.slice(0, cursor);
  const start = before.toLowerCase().lastIndexOf('<table');
  if (start < 0) return null;
  const after = doc.slice(start);
  const endMatch = after.match(/<\/table>/i);
  if (!endMatch?.index && endMatch?.index !== 0) return null;
  const end = start + endMatch.index + endMatch[0].length;
  return cursor <= end ? { from: start, to: end, html: doc.slice(start, end) } : null;
}

function htmlTableToRows(html: string): string[][] {
  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(document.querySelectorAll('tr')).map((row) => (
      Array.from(row.querySelectorAll('th,td')).map((cell) => escapeMarkdownTableCell(cell.textContent ?? ''))
    )).filter((row) => row.length > 0);
  }
  return Array.from(html.matchAll(/<tr[\s\S]*?<\/tr>/gi)).map((rowMatch) => (
    Array.from(rowMatch[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((cellMatch) => (
      escapeMarkdownTableCell((cellMatch[1] ?? '').replace(/<[^>]+>/g, ''))
    ))
  )).filter((row) => row.length > 0);
}

export function getHtmlTableToMarkdownEdit(doc: string, cursor: number): MarkdownTableCommandEdit | null {
  const range = findHtmlTableRange(doc, cursor);
  if (!range) return null;
  const rows = htmlTableToRows(range.html);
  if (rows.length === 0) return null;
  const markdown = tableFromDelimitedRows(rows);
  return {
    from: range.from,
    to: range.to,
    insert: markdown,
    selectionFrom: range.from,
    selectionTo: range.from + markdown.length,
  };
}

function createTableDiagnostic(input: Omit<TableDiagnostic, 'action' | 'message' | 'reason' | 'severity'> & {
  action: string;
  message: string;
  reason: string;
  severity?: 'error' | 'warning';
}): TableDiagnostic {
  return {
    ...input,
    severity: input.severity ?? 'error',
  };
}

export function scanMarkdownTableDiagnostics(content: string): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [];
  const lines = getSourceLines(content);
  const visited = new Set<number>();

  lines.forEach((line, index) => {
    if (!hasTablePipe(line.text)) return;

    if (isInvalidSeparatorLine(line.text)) {
      diagnostics.push(createTableDiagnostic({
        action: t('diagnostics.table.invalidAlignment.action'),
        column: 1,
        kind: 'invalid-alignment',
        line: line.number + 1,
        message: t('diagnostics.table.invalidAlignment.message'),
        reason: t('diagnostics.table.invalidAlignment.reason'),
      }));
    }

    if (visited.has(index)) return;
    const block = findMarkdownTableBlock(content, line.from);
    if (!block) {
      const next = lines[index + 1];
      if (next && hasTablePipe(next.text) && line.text.trim().startsWith('|')) {
        diagnostics.push(createTableDiagnostic({
          action: t('diagnostics.table.missingSeparator.action'),
          column: 1,
          kind: 'missing-separator',
          line: line.number + 1,
          message: t('diagnostics.table.missingSeparator.message'),
          reason: t('diagnostics.table.missingSeparator.reason'),
        }));
      }
      return;
    }

    for (let row = block.headerLine - 1; row <= block.headerLine + block.bodyRows.length; row += 1) {
      visited.add(row);
    }

    const rawCounts = [block.rawHeaderColumnCount, block.rawSeparatorColumnCount, ...block.rawBodyColumnCounts];
    if (rawCounts.some((count) => count !== block.columnCount)) {
      diagnostics.push(createTableDiagnostic({
        action: t('diagnostics.table.inconsistentColumns.action'),
        column: 1,
        kind: 'inconsistent-columns',
        line: block.headerLine,
        message: t('diagnostics.table.inconsistentColumns.message'),
        reason: t('diagnostics.table.inconsistentColumns.reason'),
      }));
    }

    if (block.header.some((cell) => cell.trim() === '')) {
      diagnostics.push(createTableDiagnostic({
        action: t('diagnostics.table.emptyHeader.action'),
        column: 1,
        kind: 'empty-header',
        line: block.headerLine,
        message: t('diagnostics.table.emptyHeader.message'),
        reason: t('diagnostics.table.emptyHeader.reason'),
        severity: 'warning',
      }));
    }

    if (block.columnCount > WIDE_TABLE_COLUMN_LIMIT || content.slice(block.from, block.to).split('\n').some((text) => text.length > WIDE_TABLE_WIDTH_LIMIT)) {
      diagnostics.push(createTableDiagnostic({
        action: t('diagnostics.table.tooWide.action'),
        column: 1,
        kind: 'too-wide',
        line: block.headerLine,
        message: t('diagnostics.table.tooWide.message'),
        reason: t('diagnostics.table.tooWide.reason'),
        severity: 'warning',
      }));
    }

    if (rawCounts.some((count) => count > block.rawHeaderColumnCount)) {
      diagnostics.push(createTableDiagnostic({
        action: t('diagnostics.table.unescapedPipe.action'),
        column: 1,
        kind: 'unescaped-pipe',
        line: block.headerLine,
        message: t('diagnostics.table.unescapedPipe.message'),
        reason: t('diagnostics.table.unescapedPipe.reason'),
      }));
    }
  });

  return diagnostics;
}
