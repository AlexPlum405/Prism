import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { MARKDOWN_TEMPLATES, resolveMarkdownTemplateContent, type MarkdownTemplateId } from './templates';
import { t, type I18nKey } from '../../i18n';
import { emitAppEvent } from '../../../platform/events/appEvents';

const TABLE_COMMAND_SENTINEL = '__PRISM_OPEN_TABLE_INSERT_POPOVER__';

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

function getCoreSlashMenuItems(): SlashMenuItem[] {
  return [
    {
    id: 'heading',
    label: t('slash.heading.label'),
    detail: t('slash.heading.detail'),
    keywords: ['heading', 'title', 'biaoti'],
    insert: '## 标题\n',
  },
  {
    id: 'table',
    label: t('slash.table.label'),
    detail: t('slash.table.detail'),
    keywords: ['table', 'biaoge'],
    insert: TABLE_COMMAND_SENTINEL,
  },
  {
    id: 'mermaid',
    label: t('slash.mermaid.label'),
    detail: t('slash.mermaid.detail'),
    keywords: ['mermaid', 'diagram', 'flowchart'],
    insert: '```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```\n',
  },
  {
    id: 'katex',
    label: t('slash.katex.label'),
    detail: t('slash.katex.detail'),
    keywords: ['katex', 'math', 'formula'],
    insert: '$$\nE = mc^2\n$$\n',
  },
  {
    id: 'callout-note',
    label: t('slash.callout.note.label'),
    detail: t('slash.callout.note.detail'),
    keywords: ['callout', 'note', 'notice'],
    insert: '> [!NOTE]\n> 内容\n',
  },
  {
    id: 'callout-warning',
    label: t('slash.callout.warning.label'),
    detail: t('slash.callout.warning.detail'),
    keywords: ['callout', 'warning', 'warn'],
    insert: '> [!WARNING]\n> 需要注意的内容\n',
  },
  {
    id: 'callout-tip',
    label: t('slash.callout.tip.label'),
    detail: t('slash.callout.tip.detail'),
    keywords: ['callout', 'tip'],
    insert: '> [!TIP]\n> 建议或技巧\n',
  },
  {
    id: 'callout-important',
    label: t('slash.callout.important.label'),
    detail: t('slash.callout.important.detail'),
    keywords: ['callout', 'important'],
    insert: '> [!IMPORTANT]\n> 重要内容\n',
  },
  {
    id: 'toggle',
    label: t('slash.toggle.label'),
    detail: t('slash.toggle.detail'),
    keywords: ['toggle', 'details', 'summary'],
    insert: '<details>\n<summary>标题</summary>\n\n内容\n\n</details>\n',
  },
  {
    id: 'code-block',
    label: t('slash.codeBlock.label'),
    detail: t('slash.codeBlock.detail'),
    keywords: ['code', 'block'],
    insert: '```text\n\n```\n',
  },
  {
    id: 'divider',
    label: t('slash.divider.label'),
    detail: t('slash.divider.detail'),
    keywords: ['divider', 'hr', 'horizontal rule'],
    insert: '---\n',
  },
  {
    id: 'image',
    label: t('slash.image.label'),
    detail: t('slash.image.detail'),
    keywords: ['image', 'picture', 'asset'],
    insert: '![描述](path/to/image.png)',
  },
  {
    id: 'link',
    label: t('slash.link.label'),
    detail: t('slash.link.detail'),
    keywords: ['link', 'url'],
    insert: '[链接文本](https://example.com)',
  },
  {
    id: 'export-settings',
    label: t('slash.exportSettings.label'),
    detail: t('slash.exportSettings.detail'),
    keywords: ['export', 'front matter', 'yaml'],
    insert: '---\ntitle: \nexport:\n  template: theme\n  paper: a4\n  margin: standard\n  toc: false\n---\n',
    },
  ];
}

const templateLabelKeys: Record<MarkdownTemplateId, I18nKey> = {
  readme: 'template.readme',
  prd: 'template.prd',
  meeting: 'template.meeting',
  weekly: 'template.weekly',
  technicalPlan: 'template.technicalPlan',
  article: 'template.article',
  paperDraft: 'template.paperDraft',
  readingNote: 'template.readingNote',
  researchSummary: 'template.researchSummary',
  whitePaper: 'template.whitePaper',
};

function getTemplateSlashMenuItems(): SlashMenuItem[] {
  return Object.values(MARKDOWN_TEMPLATES).map((template) => ({
    id: `template-${template.id}`,
    label: t('slash.template.label', { label: t(templateLabelKeys[template.id]) }),
    detail: t('slash.template.detail', { label: t(templateLabelKeys[template.id]) }),
    keywords: ['template', template.id, template.label, t(templateLabelKeys[template.id])],
    insert: `${resolveMarkdownTemplateContent(template.content).trimEnd()}\n`,
  }));
}

export function getSlashMenuItems(): SlashMenuItem[] {
  return [
    ...getCoreSlashMenuItems(),
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
          if (insert === TABLE_COMMAND_SENTINEL) {
            view.dispatch({
              changes: { from: replaceFrom, to, insert: '' },
              selection: { anchor: replaceFrom },
              scrollIntoView: true,
            });
            emitAppEvent('editor.command', { command: 'insertTable' });
            return;
          }
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
