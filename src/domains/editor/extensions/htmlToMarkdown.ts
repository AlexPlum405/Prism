import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

let turndownInstance: TurndownService | null = null;

/** 单元格内容压成单行，管道符转义，否则会破坏表格列结构 */
function cellText(cell: Element): string {
  return (cell.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

/**
 * 统一的表格转换。
 *
 * turndown-plugin-gfm 的表格规则要求首行必须是 thead 里的 th，而网页与多数
 * 富文本编辑器导出的表格只有 tbody，会整块退化成纯文本。这里不区分 thead，
 * 直接把第一行当表头，缺列补空，够用且不会丢内容。
 */
function renderTable(node: HTMLElement): string {
  const rows = Array.from(node.querySelectorAll('tr')).filter(
    (row) => row.closest('table') === node,
  );
  if (rows.length === 0) return '';

  const matrix = rows
    .map((row) => Array.from(row.querySelectorAll('th,td')).map(cellText))
    .filter((cells) => cells.length > 0);
  if (matrix.length === 0) return '';

  const width = matrix.reduce((max, cells) => Math.max(max, cells.length), 0);
  const pad = (cells: string[]) => {
    const next = cells.slice(0, width);
    while (next.length < width) next.push('');
    return next;
  };

  const [head, ...body] = matrix;
  const lines = [
    `| ${pad(head).join(' | ')} |`,
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...body.map((cells) => `| ${pad(cells).join(' | ')} |`),
  ];
  return `\n\n${lines.join('\n')}\n\n`;
}

function getTurndownService(): TurndownService {
  if (turndownInstance) return turndownInstance;

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // 删除线、任务列表来自 gfm；表格由下面的 table 规则接管（gfm 的规则要求 thead）
  turndown.use(gfm);

  // gfm 输出单波浪线 ~x~，虽然 remark-gfm 认，但主流写法是 ~~，统一成后者
  turndown.addRule('strikethrough', {
    filter: ['del', 's', 'strike'] as unknown as TurndownService.Filter,
    replacement: (content) => `~~${content}~~`,
  });

  turndown.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => renderTable(node as HTMLElement),
  });

  // 优化 ChatGPT 等来源的代码块
  turndown.addRule('preformattedCode', {
    filter: (node) => {
      return node.nodeName === 'PRE' && node.querySelector('code') !== null;
    },
    replacement: (_content, node) => {
      const codeNode = (node as HTMLElement).querySelector('code');
      if (!codeNode) return '';

      const language = (codeNode.className.match(/language-(\w+)/) || [])[1] || '';
      const code = codeNode.textContent || '';

      return '\n```' + language + '\n' + code + '\n```\n';
    },
  });

  turndownInstance = turndown;
  return turndown;
}

export function convertHtmlToMarkdown(html: string): string {
  const turndown = getTurndownService();
  return turndown.turndown(html).trim();
}

export function getClipboardHtml(event: ClipboardEvent): string | null {
  if (!event.clipboardData?.getData) return null;
  return event.clipboardData.getData('text/html') || null;
}

export function getClipboardText(event: ClipboardEvent): string {
  if (!event.clipboardData?.getData) return '';
  return event.clipboardData.getData('text/plain') || '';
}
