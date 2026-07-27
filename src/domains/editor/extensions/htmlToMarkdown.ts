import TurndownService from 'turndown';

let turndownInstance: TurndownService | null = null;

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

  // 优化表格处理
  turndown.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
  turndown.addRule('table', {
    filter: 'table',
    replacement: (content) => {
      // 简单的表格保留，让用户手工调整或后续增强
      return '\n' + content + '\n';
    },
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
