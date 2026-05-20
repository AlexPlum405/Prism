import { describe, expect, it } from 'vitest';
import {
  createMarkdownTable,
  findMarkdownTableBlock,
  getHtmlTableToMarkdownEdit,
  getMarkdownTableCommandEdit,
  getMarkdownTableNavigationEdit,
  getMarkdownTablePasteEdit,
  getMarkdownTableSerialization,
  getMarkdownTableToHtmlEdit,
  scanMarkdownTableDiagnostics,
  splitTableCells,
  type MarkdownTableCommand,
  type MarkdownTableCommandEdit,
  type MarkdownTableInsertOptions,
} from './tables';

function splitCursor(doc: string, marker = '<cursor>') {
  const cursor = doc.indexOf(marker);
  const source = cursor >= 0 ? doc.replace(marker, '') : doc;
  const position = cursor >= 0 ? cursor : source.length;
  return { position, source };
}

function applyEdit(source: string, edit: MarkdownTableCommandEdit | null) {
  if (!edit) return null;
  return `${source.slice(0, edit.from)}${edit.insert}${source.slice(edit.to)}`;
}

function applyTableCommand(
  doc: string,
  command: MarkdownTableCommand,
  options?: MarkdownTableInsertOptions,
) {
  const { position, source } = splitCursor(doc);
  return applyEdit(source, getMarkdownTableCommandEdit(source, position, position, command, options));
}

describe('markdown table editing', () => {
  it('creates source markdown tables with configurable dimensions and alignment', () => {
    const table = createMarkdownTable({ alignment: 'center', columns: 4, dataRows: 3 });

    expect(table.markdown).toContain('| Column 1 | Column 2 | Column 3 | Column 4 |');
    expect(table.markdown).toContain('| :------: | :------: | :------: | :------: |');
    expect(table.markdown.split('\n')).toHaveLength(5);
  });

  it('inserts a configurable table and places the cursor in the first editable cell', () => {
    expect(applyTableCommand('Intro\n<cursor>Outro', 'insert', {
      alignment: 'right',
      columns: 2,
      dataRows: 1,
      includeHeader: true,
    })).toBe([
      'Intro',
      '| Column 1 | Column 2 |',
      '| -------: | -------: |',
      '|          |          |',
      'Outro',
    ].join('\n'));
  });

  it('parses escaped pipes and locates the active table cell', () => {
    expect(splitTableCells('| A \\| B | C |').map((cell) => cell.value)).toEqual(['A \\| B', 'C']);

    const { position, source } = splitCursor([
      '| Name | Notes |',
      '| --- | --- |',
      '| Prism | has A \\| B<cursor> |',
    ].join('\n'));
    const block = findMarkdownTableBlock(source, position);

    expect(block).toMatchObject({
      columnCount: 2,
      cursorColumnIndex: 1,
      cursorRowIndex: 0,
      header: ['Name', 'Notes'],
    });
  });

  it('formats the current table without changing surrounding text', () => {
    expect(applyTableCommand([
      'Before',
      '| Name|Score |',
      '|---|---:|',
      '| Prism<cursor>|10|',
      '| Longer name | 8 |',
      'After',
    ].join('\n'), 'format')).toBe([
      'Before',
      '| Name        | Score |',
      '| ----------- | ----: |',
      '| Prism       |    10 |',
      '| Longer name |     8 |',
      'After',
    ].join('\n'));
  });

  it('repairs malformed table separators through the format command', () => {
    expect(applyTableCommand([
      '| Name | Score |',
      '| 10<cursor> | 20 |',
    ].join('\n'), 'format')).toBe([
      '| Name | Score |',
      '| ---- | ----- |',
      '| 10   | 20    |',
    ].join('\n'));

    expect(applyTableCommand([
      '| Name | Score |',
      '| --<cursor> | --- |',
      '| 10 | 20 |',
    ].join('\n'), 'format')).toBe([
      '| Name | Score |',
      '| ---- | ----- |',
      '| 10   | 20    |',
    ].join('\n'));
  });

  it('adds, deletes, and moves rows around the active body row', () => {
    const table = [
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '| 3<cursor> | 4 |',
    ].join('\n');

    expect(applyTableCommand(table, 'insertRowAbove')).toContain('|     |     |\n| 3   | 4   |');
    expect(applyTableCommand(table, 'insertRowBelow')).toContain('| 3   | 4   |\n|     |     |');
    expect(applyTableCommand(table, 'deleteRow')).not.toContain('| 3   | 4   |');
    expect(applyTableCommand(table, 'moveRowUp')).toBe([
      '| A   | B   |',
      '| --- | --- |',
      '| 3   | 4   |',
      '| 1   | 2   |',
    ].join('\n'));
  });

  it('adds, deletes, and moves columns around the active cell', () => {
    const table = [
      '| A | B<cursor> | C |',
      '| --- | --- | --- |',
      '| 1 | 2 | 3 |',
    ].join('\n');

    expect(applyTableCommand(table, 'insertColumnLeft')).toContain('| A   |     | B   | C   |');
    expect(applyTableCommand(table, 'insertColumnRight')).toContain('| A   | B   |     | C   |');
    expect(applyTableCommand(table, 'deleteColumn')).toBe([
      '| A   | C   |',
      '| --- | --- |',
      '| 1   | 3   |',
    ].join('\n'));
    expect(applyTableCommand(table, 'moveColumnLeft')).toBe([
      '| B   | A   | C   |',
      '| --- | --- | --- |',
      '| 2   | 1   | 3   |',
    ].join('\n'));
  });

  it('updates alignment markers and sorts the active column', () => {
    const table = [
      '| Name | Score<cursor> |',
      '| --- | --- |',
      '| Beta | 2 |',
      '| Alpha | 10 |',
    ].join('\n');

    expect(applyTableCommand(table, 'alignCenter')).toContain('| ----- | :---: |');
    expect(applyTableCommand(table, 'alignRight')).toContain('| ----- | ----: |');
    expect(applyTableCommand(table, 'sortAsc')).toContain('| Beta  | 2     |\n| Alpha | 10    |');
    expect(applyTableCommand(table, 'sortDesc')).toContain('| Alpha | 10    |\n| Beta  | 2     |');
  });

  it('supports table-only keyboard navigation edits', () => {
    const { position, source } = splitCursor([
      '| A | B |',
      '| --- | --- |',
      '| 1<cursor> | 2 |',
    ].join('\n'));

    const nextCell = getMarkdownTableNavigationEdit(source, position, 'nextCell');
    const nextRow = getMarkdownTableNavigationEdit(source, position, 'nextRow');
    const lineBreak = getMarkdownTableNavigationEdit(source, position, 'lineBreak');
    const escape = getMarkdownTableNavigationEdit(source, position, 'escape');

    expect(nextCell?.selectionFrom).toBeGreaterThan(position);
    expect(applyEdit(source, nextRow)).toContain('| 1   | 2   |\n|     |     |');
    expect(applyEdit(source, lineBreak)).toContain('| 1<br> | 2 |');
    expect(applyEdit(source, escape)).toBe(`${source}\n`);
    expect(escape?.selectionFrom).toBe(source.length + 1);
  });

  it('moves backward with Shift+Tab and appends a row from the last data cell', () => {
    const previous = splitCursor([
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2<cursor> |',
    ].join('\n'));
    const previousEdit = getMarkdownTableNavigationEdit(previous.source, previous.position, 'previousCell');
    expect(previousEdit?.selectionFrom).toBeLessThan(previous.position);

    const last = splitCursor([
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2<cursor> |',
    ].join('\n'));
    expect(applyEdit(
      last.source,
      getMarkdownTableNavigationEdit(last.source, last.position, 'nextCell'),
    )).toContain('| 1   | 2   |\n|     |     |');
  });

  it('pastes CSV or TSV as a new table or fills the active table', () => {
    const blank = splitCursor('Intro\n<cursor>');
    const inserted = applyEdit(
      blank.source,
      getMarkdownTablePasteEdit(blank.source, blank.position, blank.position, 'Name\tScore\nPrism\t10'),
    );
    expect(inserted).toContain('| Name  | Score |');
    expect(inserted).toContain('| Prism | 10    |');

    const existing = splitCursor([
      '| Name | Score |',
      '| --- | --- |',
      '| A<cursor> | 1 |',
    ].join('\n'));
    const filled = applyEdit(
      existing.source,
      getMarkdownTablePasteEdit(existing.source, existing.position, existing.position, 'B,2\nC,3'),
    );
    expect(filled).toContain('| B    | 2     |');
    expect(filled).toContain('| C    | 3     |');
  });

  it('serializes the active table to markdown, html, csv, and tsv', () => {
    const { position, source } = splitCursor([
      '| Name | Score<cursor> |',
      '| --- | ---: |',
      '| Prism | 10 |',
    ].join('\n'));
    const serialization = getMarkdownTableSerialization(source, position);

    expect(serialization?.markdown).toContain('| Name | Score |');
    expect(serialization?.html).toContain('<table>');
    expect(serialization?.html).toContain('text-align:right');
    expect(serialization?.csv).toBe('Name,Score\nPrism,10');
    expect(serialization?.tsv).toBe('Name\tScore\nPrism\t10');
  });

  it('quotes CSV values and normalizes escaped markdown table content', () => {
    const { position, source } = splitCursor([
      '| Name | Notes<cursor> |',
      '| :--- | --- |',
      '| Prism | A\\|B<br>next, line |',
    ].join('\n'));
    const serialization = getMarkdownTableSerialization(source, position);

    expect(serialization?.csv).toBe('Name,Notes\nPrism,"A|B\nnext, line"');
    expect(serialization?.tsv).toBe('Name\tNotes\nPrism\t"A|B\nnext, line"');
  });

  it('converts between markdown and structurally simple HTML tables', () => {
    const markdown = splitCursor([
      '| Name | Score<cursor> |',
      '| --- | --- |',
      '| Prism | 10 |',
    ].join('\n'));
    const htmlDoc = applyEdit(markdown.source, getMarkdownTableToHtmlEdit(markdown.source, markdown.position));
    expect(htmlDoc).toContain('<thead><tr><th>Name</th><th>Score</th></tr></thead>');

    const html = '<table><tr><th>Name</th><th>Score</th></tr><tr><td>Prism</td><td>10</td></tr></table>';
    const htmlCursor = html.indexOf('Score');
    const markdownEdit = getHtmlTableToMarkdownEdit(html, htmlCursor);
    expect(applyEdit(html, markdownEdit)).toContain('| Name  | Score |');
  });

  it('diagnoses malformed and export-risky markdown tables', () => {
    const diagnostics = scanMarkdownTableDiagnostics([
      '| A | B |',
      '| 1 | 2 |',
      '',
      '| Name | |',
      '| --- | --- |',
      '| value | B |',
      '',
      '| Bad | Align |',
      '| -- | --- |',
      '',
      '| Name | Value |',
      '| --- | --- |',
      '| value | A | B |',
      '',
      '| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |',
    ].join('\n'));
    const kinds = diagnostics.map((diagnostic) => diagnostic.kind);

    expect(kinds).toEqual(expect.arrayContaining([
      'missing-separator',
      'invalid-alignment',
      'inconsistent-columns',
      'empty-header',
      'too-wide',
      'unescaped-pipe',
    ]));
  });

  it('does not treat prose with pipes as a markdown table', () => {
    expect(applyTableCommand('A | B<cursor>', 'format')).toBeNull();
  });
});
