export type SourceBlockOperation =
  | 'moveParagraphUp'
  | 'moveParagraphDown'
  | 'duplicateParagraph'
  | 'deleteParagraph'
  | 'moveSectionUp'
  | 'moveSectionDown'
  | 'duplicateSection'
  | 'selectionQuote'
  | 'selectionCalloutNote'
  | 'selectionCalloutWarning'
  | 'selectionCalloutTip'
  | 'selectionUnorderedList'
  | 'selectionOrderedList'
  | 'selectionTaskList';

export interface SourceBlockOperationEdit {
  from: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
  to: number;
}

interface LineInfo {
  from: number;
  index: number;
  text: string;
  to: number;
}

interface TextRange {
  from: number;
  startLine: number;
  to: number;
}

const SOURCE_BLOCK_OPERATIONS = new Set<SourceBlockOperation>([
  'moveParagraphUp',
  'moveParagraphDown',
  'duplicateParagraph',
  'deleteParagraph',
  'moveSectionUp',
  'moveSectionDown',
  'duplicateSection',
  'selectionQuote',
  'selectionCalloutNote',
  'selectionCalloutWarning',
  'selectionCalloutTip',
  'selectionUnorderedList',
  'selectionOrderedList',
  'selectionTaskList',
]);

const headingPattern = /^(#{1,6})\s+\S/;

export function isSourceBlockOperation(value: string): value is SourceBlockOperation {
  return SOURCE_BLOCK_OPERATIONS.has(value as SourceBlockOperation);
}

function getLines(doc: string): LineInfo[] {
  const parts = doc.split('\n');
  const lines: LineInfo[] = [];
  let offset = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const text = parts[index];
    lines.push({
      from: offset,
      index,
      text,
      to: offset + text.length,
    });
    offset += text.length + 1;
  }

  return lines;
}

function getLineIndexAt(lines: LineInfo[], pos: number) {
  if (lines.length === 0) return 0;
  for (const line of lines) {
    const breakTo = line.index < lines.length - 1 ? line.to + 1 : line.to;
    if (pos <= line.to || pos < breakTo) return line.index;
  }
  return lines.length - 1;
}

function isBlank(line: LineInfo) {
  return line.text.trim().length === 0;
}

function lineEnd(lines: LineInfo[], index: number) {
  return lines[Math.max(0, Math.min(index, lines.length - 1))].to;
}

function trimTrailingBlankLines(lines: LineInfo[], startLine: number, boundaryLine: number) {
  let endLine = Math.max(startLine, boundaryLine - 1);
  while (endLine > startLine && isBlank(lines[endLine])) {
    endLine -= 1;
  }
  return endLine;
}

function getSelectionLineRange(doc: string, from: number, to: number): TextRange {
  const lines = getLines(doc);
  const safeFrom = Math.max(0, Math.min(from, doc.length));
  const endProbe = to > from && doc[to - 1] === '\n' ? to - 1 : to;
  const safeTo = Math.max(safeFrom, Math.min(endProbe, doc.length));
  const startLine = getLineIndexAt(lines, safeFrom);
  const endLine = getLineIndexAt(lines, safeTo);

  return {
    from: lines[startLine].from,
    startLine,
    to: lineEnd(lines, endLine),
  };
}

function getParagraphAt(doc: string, from: number, to: number): TextRange | null {
  const lines = getLines(doc);
  if (lines.length === 0) return null;

  const selection = getSelectionLineRange(doc, from, to);
  let startLine = selection.startLine;
  if (isBlank(lines[startLine])) return null;

  while (startLine > 0 && !isBlank(lines[startLine - 1])) {
    startLine -= 1;
  }

  let endLine = getLineIndexAt(lines, Math.max(selection.to, from));
  while (endLine < lines.length - 1 && !isBlank(lines[endLine + 1])) {
    endLine += 1;
  }

  return {
    from: lines[startLine].from,
    startLine,
    to: lineEnd(lines, endLine),
  };
}

function getPreviousParagraph(doc: string, current: TextRange): TextRange | null {
  const lines = getLines(doc);
  let index = current.startLine - 1;

  while (index >= 0 && isBlank(lines[index])) index -= 1;
  if (index < 0) return null;

  const endLine = index;
  while (index > 0 && !isBlank(lines[index - 1])) index -= 1;

  return {
    from: lines[index].from,
    startLine: index,
    to: lineEnd(lines, endLine),
  };
}

function getNextParagraph(doc: string, current: TextRange): TextRange | null {
  const lines = getLines(doc);
  let index = getLineIndexAt(lines, current.to) + 1;

  while (index < lines.length && isBlank(lines[index])) index += 1;
  if (index >= lines.length) return null;

  const startLine = index;
  while (index < lines.length - 1 && !isBlank(lines[index + 1])) index += 1;

  return {
    from: lines[startLine].from,
    startLine,
    to: lineEnd(lines, index),
  };
}

function getHeadingLevel(text: string) {
  const match = text.match(headingPattern);
  return match ? match[1].length : null;
}

function getSectionPeers(doc: string, from: number) {
  const lines = getLines(doc);
  const cursorLine = getLineIndexAt(lines, from);
  let headingLine = cursorLine;

  while (headingLine >= 0 && getHeadingLevel(lines[headingLine].text) === null) {
    headingLine -= 1;
  }
  if (headingLine < 0) return null;

  const level = getHeadingLevel(lines[headingLine].text);
  if (!level) return null;

  let parentStartLine = 0;
  for (let index = headingLine - 1; index >= 0; index -= 1) {
    const candidateLevel = getHeadingLevel(lines[index].text);
    if (candidateLevel !== null && candidateLevel < level) {
      parentStartLine = index + 1;
      break;
    }
  }

  let parentEndLine = lines.length;
  for (let index = headingLine + 1; index < lines.length; index += 1) {
    const candidateLevel = getHeadingLevel(lines[index].text);
    if (candidateLevel !== null && candidateLevel < level) {
      parentEndLine = index;
      break;
    }
  }

  const peerHeadingLines: number[] = [];
  for (let index = parentStartLine; index < parentEndLine; index += 1) {
    if (getHeadingLevel(lines[index].text) === level) {
      peerHeadingLines.push(index);
    }
  }

  const peers = peerHeadingLines.map((startLine, index): TextRange => {
    const boundaryLine = peerHeadingLines[index + 1] ?? parentEndLine;
    const endLine = trimTrailingBlankLines(lines, startLine, boundaryLine);
    return {
      from: lines[startLine].from,
      startLine,
      to: lineEnd(lines, endLine),
    };
  });

  const currentIndex = peerHeadingLines.indexOf(headingLine);
  return currentIndex >= 0 ? { currentIndex, peers } : null;
}

function getMoveEdit(doc: string, current: TextRange, target: TextRange, direction: 'up' | 'down') {
  const currentText = doc.slice(current.from, current.to);
  const targetText = doc.slice(target.from, target.to);

  if (direction === 'up') {
    const separator = doc.slice(target.to, current.from);
    const insert = `${currentText}${separator}${targetText}`;
    return {
      from: target.from,
      to: current.to,
      insert,
      selectionFrom: target.from,
      selectionTo: target.from + currentText.length,
    };
  }

  const separator = doc.slice(current.to, target.from);
  const insert = `${targetText}${separator}${currentText}`;
  const selectionFrom = current.from + targetText.length + separator.length;
  return {
    from: current.from,
    to: target.to,
    insert,
    selectionFrom,
    selectionTo: selectionFrom + currentText.length,
  };
}

function getMoveParagraphEdit(
  doc: string,
  from: number,
  to: number,
  direction: 'up' | 'down',
): SourceBlockOperationEdit | null {
  const current = getParagraphAt(doc, from, to);
  if (!current) return null;

  const target = direction === 'up'
    ? getPreviousParagraph(doc, current)
    : getNextParagraph(doc, current);

  return target ? getMoveEdit(doc, current, target, direction) : null;
}

function getDuplicateParagraphEdit(doc: string, from: number, to: number): SourceBlockOperationEdit | null {
  const paragraph = getParagraphAt(doc, from, to);
  if (!paragraph) return null;

  const paragraphText = doc.slice(paragraph.from, paragraph.to);
  const separator = '\n\n';
  const insert = `${separator}${paragraphText}`;
  const selectionFrom = paragraph.to + separator.length;

  return {
    from: paragraph.to,
    to: paragraph.to,
    insert,
    selectionFrom,
    selectionTo: selectionFrom + paragraphText.length,
  };
}

function getDeleteParagraphEdit(doc: string, from: number, to: number): SourceBlockOperationEdit | null {
  const lines = getLines(doc);
  const paragraph = getParagraphAt(doc, from, to);
  if (!paragraph) return null;

  const startLine = paragraph.startLine;
  const endLine = getLineIndexAt(lines, paragraph.to);
  let deleteFrom = paragraph.from;
  let deleteTo = paragraph.to;

  let nextLine = endLine + 1;
  while (nextLine < lines.length && isBlank(lines[nextLine])) {
    nextLine += 1;
  }

  if (nextLine < lines.length) {
    deleteTo = lines[nextLine].from;
  } else {
    deleteTo = doc.length;
    let previousLine = startLine - 1;
    while (previousLine >= 0 && isBlank(lines[previousLine])) {
      previousLine -= 1;
    }
    deleteFrom = previousLine >= 0 ? lines[previousLine].to : 0;
  }

  return {
    from: deleteFrom,
    to: deleteTo,
    insert: '',
    selectionFrom: deleteFrom,
    selectionTo: deleteFrom,
  };
}

function getMoveSectionEdit(
  doc: string,
  from: number,
  direction: 'up' | 'down',
): SourceBlockOperationEdit | null {
  const sectionState = getSectionPeers(doc, from);
  if (!sectionState) return null;

  const { currentIndex, peers } = sectionState;
  const target = direction === 'up' ? peers[currentIndex - 1] : peers[currentIndex + 1];
  if (!target) return null;

  return getMoveEdit(doc, peers[currentIndex], target, direction);
}

function getDuplicateSectionEdit(doc: string, from: number): SourceBlockOperationEdit | null {
  const sectionState = getSectionPeers(doc, from);
  if (!sectionState) return null;

  const section = sectionState.peers[sectionState.currentIndex];
  const sectionText = doc.slice(section.from, section.to);
  const separator = '\n\n';
  const insert = `${separator}${sectionText}`;
  const selectionFrom = section.to + separator.length;

  return {
    from: section.to,
    to: section.to,
    insert,
    selectionFrom,
    selectionTo: selectionFrom + sectionText.length,
  };
}

function stripBlockPrefix(line: string) {
  const indent = line.match(/^\s*/)?.[0] ?? '';
  let body = line.slice(indent.length);

  body = body.replace(/^>\s?/, '');
  body = body.replace(/^\[!(NOTE|WARNING|TIP|IMPORTANT)\]\s*/i, '');
  body = body.replace(/^[-*+]\s+\[[ xX]\]\s+/, '');
  body = body.replace(/^[-*+]\s+/, '');
  body = body.replace(/^\d+[.)]\s+/, '');

  return { body, indent };
}

function transformSelectionLines(lines: string[], operation: SourceBlockOperation) {
  if (
    operation === 'selectionCalloutNote' ||
    operation === 'selectionCalloutWarning' ||
    operation === 'selectionCalloutTip'
  ) {
    const calloutType = operation === 'selectionCalloutWarning'
      ? 'WARNING'
      : operation === 'selectionCalloutTip'
        ? 'TIP'
        : 'NOTE';
    const bodyLines = lines.map((line) => {
      const { body } = stripBlockPrefix(line);
      return body.length > 0 ? `> ${body}` : '> ';
    });
    return [`> [!${calloutType}]`, ...bodyLines].join('\n');
  }

  let orderedIndex = 1;
  return lines
    .map((line) => {
      const { body, indent } = stripBlockPrefix(line);
      if (operation === 'selectionQuote') return body.length > 0 ? `${indent}> ${body}` : `${indent}> `;
      if (operation === 'selectionTaskList') return body.length > 0 ? `${indent}- [ ] ${body}` : `${indent}- [ ] `;
      if (operation === 'selectionUnorderedList') return body.length > 0 ? `${indent}- ${body}` : `${indent}- `;
      if (operation === 'selectionOrderedList') {
        const marker = `${orderedIndex}.`;
        if (body.length > 0) {
          orderedIndex += 1;
          return `${indent}${marker} ${body}`;
        }
        return `${indent}${marker} `;
      }
      return line;
    })
    .join('\n');
}

function getSelectionTransformEdit(
  doc: string,
  from: number,
  to: number,
  operation: SourceBlockOperation,
): SourceBlockOperationEdit {
  const range = getSelectionLineRange(doc, from, to);
  const selectedText = doc.slice(range.from, range.to);
  const insert = transformSelectionLines(selectedText.split('\n'), operation);

  return {
    from: range.from,
    to: range.to,
    insert,
    selectionFrom: range.from,
    selectionTo: range.from + insert.length,
  };
}

export function getSourceBlockOperationEdit(
  doc: string,
  from: number,
  to: number,
  operation: SourceBlockOperation,
): SourceBlockOperationEdit | null {
  switch (operation) {
    case 'moveParagraphUp':
      return getMoveParagraphEdit(doc, from, to, 'up');
    case 'moveParagraphDown':
      return getMoveParagraphEdit(doc, from, to, 'down');
    case 'duplicateParagraph':
      return getDuplicateParagraphEdit(doc, from, to);
    case 'deleteParagraph':
      return getDeleteParagraphEdit(doc, from, to);
    case 'moveSectionUp':
      return getMoveSectionEdit(doc, from, 'up');
    case 'moveSectionDown':
      return getMoveSectionEdit(doc, from, 'down');
    case 'duplicateSection':
      return getDuplicateSectionEdit(doc, from);
    case 'selectionQuote':
    case 'selectionCalloutNote':
    case 'selectionCalloutWarning':
    case 'selectionCalloutTip':
    case 'selectionUnorderedList':
    case 'selectionOrderedList':
    case 'selectionTaskList':
      return getSelectionTransformEdit(doc, from, to, operation);
  }
}
