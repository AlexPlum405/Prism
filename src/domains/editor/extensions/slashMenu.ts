import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { MARKDOWN_TEMPLATES, type MarkdownTemplateId } from './templates';

export type SlashMenuItemId =
  | 'heading'
  | 'table'
  | 'mermaid'
  | 'katex'
  | 'callout-note'
  | 'callout-warning'
  | 'callout-tip'
  | 'callout-important'
  | 'toggle'
  | 'code-block'
  | 'divider'
  | 'image'
  | 'link'
  | 'export-settings'
  | `template-${MarkdownTemplateId}`;

export interface SlashMenuItem {
  detail: string;
  id: SlashMenuItemId;
  insert: string;
  keywords: string[];
  label: string;
}

const CORE_SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    id: 'heading',
    label: '标题',
    detail: '插入二级标题',
    keywords: ['heading', 'title', 'biaoti'],
    insert: '## 标题\n',
  },
  {
    id: 'table',
    label: '表格',
    detail: '插入 3 列 Markdown 表格',
    keywords: ['table', 'biaoge'],
    insert: '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n',
  },
  {
    id: 'mermaid',
    label: 'Mermaid 图表',
    detail: '插入 Mermaid 代码块',
    keywords: ['mermaid', 'diagram', 'flowchart'],
    insert: '```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```\n',
  },
  {
    id: 'katex',
    label: 'KaTeX 公式',
    detail: '插入块级数学公式',
    keywords: ['katex', 'math', 'formula'],
    insert: '$$\nE = mc^2\n$$\n',
  },
  {
    id: 'callout-note',
    label: 'Callout: Note',
    detail: '插入 NOTE 提示块',
    keywords: ['callout', 'note', 'notice'],
    insert: '> [!NOTE]\n> 内容\n',
  },
  {
    id: 'callout-warning',
    label: 'Callout: Warning',
    detail: '插入 WARNING 提示块',
    keywords: ['callout', 'warning', 'warn'],
    insert: '> [!WARNING]\n> 需要注意的内容\n',
  },
  {
    id: 'callout-tip',
    label: 'Callout: Tip',
    detail: '插入 TIP 提示块',
    keywords: ['callout', 'tip'],
    insert: '> [!TIP]\n> 建议或技巧\n',
  },
  {
    id: 'callout-important',
    label: 'Callout: Important',
    detail: '插入 IMPORTANT 重点提示块',
    keywords: ['callout', 'important'],
    insert: '> [!IMPORTANT]\n> 重要内容\n',
  },
  {
    id: 'toggle',
    label: 'Toggle 折叠块',
    detail: '插入 details/summary 折叠内容',
    keywords: ['toggle', 'details', 'summary'],
    insert: '<details>\n<summary>标题</summary>\n\n内容\n\n</details>\n',
  },
  {
    id: 'code-block',
    label: '代码块',
    detail: '插入 fenced code block',
    keywords: ['code', 'block'],
    insert: '```text\n\n```\n',
  },
  {
    id: 'divider',
    label: '分割线',
    detail: '插入 Markdown 分割线',
    keywords: ['divider', 'hr', 'horizontal rule'],
    insert: '---\n',
  },
  {
    id: 'image',
    label: '图片',
    detail: '插入 Markdown 图片',
    keywords: ['image', 'picture', 'asset'],
    insert: '![描述](path/to/image.png)',
  },
  {
    id: 'link',
    label: '链接',
    detail: '插入 Markdown 链接',
    keywords: ['link', 'url'],
    insert: '[链接文本](https://example.com)',
  },
  {
    id: 'export-settings',
    label: '导出设置块',
    detail: '插入 YAML front matter 导出设置',
    keywords: ['export', 'front matter', 'yaml'],
    insert: '---\ntitle: \nexport:\n  template: theme\n  paper: a4\n  margin: standard\n  toc: false\n---\n',
  },
];

function getTemplateSlashMenuItems(): SlashMenuItem[] {
  return Object.values(MARKDOWN_TEMPLATES).map((template) => ({
    id: `template-${template.id}`,
    label: `模板：${template.label}`,
    detail: `插入 ${template.label} Markdown 模板`,
    keywords: ['template', template.id, template.label],
    insert: `${template.content.trimEnd()}\n`,
  }));
}

export function getSlashMenuItems(): SlashMenuItem[] {
  return [
    ...CORE_SLASH_MENU_ITEMS,
    ...getTemplateSlashMenuItems(),
  ];
}

export function getSlashMenuTrigger(linePrefix: string): { fromOffset: number; query: string } | null {
  const match = linePrefix.match(/(^|\s)\/([^\s/]*)$/);
  if (!match) return null;

  return {
    fromOffset: linePrefix.length - match[2].length - 1,
    query: match[2],
  };
}

export function getSlashMenuCompletionOptions(): Completion[] {
  return getSlashMenuItems().map((item) => ({
    apply: item.insert,
    boost: item.id.startsWith('template-') ? 0 : 1,
    detail: item.detail,
    info: item.keywords.join(' / '),
    label: item.label,
    type: item.id.startsWith('template-') ? 'text' : 'keyword',
  }));
}

export function createSlashMenuCompletionSource() {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos);
    const linePrefix = line.text.slice(0, context.pos - line.from);
    const trigger = getSlashMenuTrigger(linePrefix);
    if (!trigger) return null;
    const slashFrom = line.from + trigger.fromOffset;

    return {
      from: slashFrom + 1,
      options: getSlashMenuCompletionOptions().map((option) => ({
        ...option,
        apply: (view, completion, from, to) => {
          const insert = typeof option.apply === 'string' ? option.apply : completion.label;
          const replaceFrom = Math.max(slashFrom, from - 1);
          view.dispatch({
            changes: { from: replaceFrom, to, insert },
            selection: { anchor: replaceFrom + insert.length },
            scrollIntoView: true,
          });
        },
      })),
      validFor: /^[^\s/]*$/,
    };
  };
}
