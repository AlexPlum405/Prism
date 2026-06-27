import type { EditorView } from '@codemirror/view';

export type SlashSnippetCommand =
  | 'time'
  | 'table'
  | 'img'
  | 'video'
  | 'markmap'
  | 'mermaid'
  | 'plantuml'
  | 'fold'
  | 'task';

export interface SlashSnippet {
  insert: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface SlashSnippetEdit {
  from: number;
  insert: string;
  selectionAnchor: number;
  selectionHead: number;
  to: number;
}

export const SLASH_SNIPPET_COMMAND_ORDER: SlashSnippetCommand[] = [
  'time',
  'table',
  'img',
  'video',
  'markmap',
  'mermaid',
  'plantuml',
  'fold',
  'task',
];

const SLASH_SNIPPET_COMMANDS = new Set<SlashSnippetCommand>(SLASH_SNIPPET_COMMAND_ORDER);

const SLASH_SNIPPET_LABELS: Record<SlashSnippetCommand, string> = {
  time: '当前时间',
  table: '表格',
  img: '图片',
  video: '视频',
  markmap: '思维导图',
  mermaid: 'Mermaid 图表',
  plantuml: 'PlantUML 图表',
  fold: '折叠块',
  task: '任务清单',
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatSlashSnippetTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

export function getSlashSnippetLabel(command: SlashSnippetCommand) {
  return SLASH_SNIPPET_LABELS[command];
}

export function getSlashSnippet(command: SlashSnippetCommand, now = new Date()): SlashSnippet {
  switch (command) {
    case 'time':
      return { insert: formatSlashSnippetTimestamp(now) };
    case 'table':
      return {
        insert: [
          '| 项目 | 状态 | 备注 |',
          '| --- | --- | --- |',
          '| 事项 | 待确认 | 说明 |',
          '',
        ].join('\n'),
      };
    case 'img':
      return {
        insert: '![图片描述](图片路径)',
        selectionStart: 2,
        selectionEnd: 6,
      };
    case 'video':
      return {
        insert: '<video src="video.mp4" controls></video>',
        selectionStart: '<video src="'.length,
        selectionEnd: '<video src="video.mp4'.length,
      };
    case 'markmap':
      return {
        insert: [
          '```markmap',
          '# 主题',
          '- 分支一',
          '- 分支二',
          '```',
          '',
        ].join('\n'),
      };
    case 'mermaid':
      return {
        insert: [
          '```mermaid',
          'graph TD',
          '  A[开始] --> B[推进]',
          '  B --> C[完成]',
          '```',
          '',
        ].join('\n'),
      };
    case 'plantuml':
      return {
        insert: [
          '```plantuml',
          '@startuml',
          'Alice -> Bob: Hello',
          '@enduml',
          '```',
          '',
        ].join('\n'),
      };
    case 'fold': {
      const insert = '<details>\n<summary>标题</summary>\n\n内容\n\n</details>\n';
      const start = insert.indexOf('标题');
      return {
        insert,
        selectionStart: start,
        selectionEnd: start + '标题'.length,
      };
    }
    case 'task':
      return {
        insert: [
          '- [ ] 待办事项',
          '- [ ] 下一步',
          '',
        ].join('\n'),
        selectionStart: '- [ ] '.length,
        selectionEnd: '- [ ] 待办事项'.length,
      };
  }
}

function clampOffset(value: number | undefined, length: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return length;
  return Math.max(0, Math.min(length, Math.trunc(value)));
}

function normalizeSlashSnippetCommand(value: string): SlashSnippetCommand | null {
  const normalized = value.trim().toLowerCase();
  return SLASH_SNIPPET_COMMANDS.has(normalized as SlashSnippetCommand)
    ? normalized as SlashSnippetCommand
    : null;
}

export function isSlashSnippetCommand(value: string): value is SlashSnippetCommand {
  return normalizeSlashSnippetCommand(value) !== null;
}

export function getSlashSnippetEdit(
  doc: string,
  cursor: number,
  now = new Date(),
): SlashSnippetEdit | null {
  if (cursor < 0 || cursor > doc.length) return null;

  const lineStart = doc.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  const linePrefix = doc.slice(lineStart, cursor);
  const match = /(^|\s)\/([A-Za-z]+)$/.exec(linePrefix);
  if (!match) return null;

  const command = normalizeSlashSnippetCommand(match[2] ?? '');
  if (!command) return null;

  const slashOffset = match.index + (match[1]?.length ?? 0);
  const from = lineStart + slashOffset;
  const snippet = getSlashSnippet(command, now);
  const startOffset = clampOffset(snippet.selectionStart, snippet.insert.length);
  const endOffset = clampOffset(snippet.selectionEnd, snippet.insert.length);

  return {
    from,
    to: cursor,
    insert: snippet.insert,
    selectionAnchor: from + startOffset,
    selectionHead: from + endOffset,
  };
}

export function expandSlashSnippetWithTab(view: EditorView, now = new Date()) {
  const selection = view.state.selection.main;
  if (selection.from !== selection.to) return false;

  const edit = getSlashSnippetEdit(view.state.doc.toString(), selection.head, now);
  if (!edit) return false;

  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selectionAnchor, head: edit.selectionHead },
    scrollIntoView: true,
  });
  return true;
}
