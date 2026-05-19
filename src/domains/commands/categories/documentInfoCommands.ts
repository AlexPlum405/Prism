import type { CommandContext, CommandDefinition } from '../types';

function hasDocument(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument);
}

function hasSavedDocumentPath(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument?.path);
}

export function createDocumentInfoCommands(): CommandDefinition[] {
  return [
    {
      id: 'openDocumentProperties',
      label: '打开文档属性',
      category: '文件',
      keywords: ['front matter', 'yaml', 'metadata', 'properties', 'meta'],
      enabled: hasDocument,
      run: (context) => context.openDocumentProperties?.(),
    },
    {
      id: 'showDocumentLinks',
      label: '查看当前文档链接',
      category: '视图',
      keywords: ['links', 'outlinks', 'document links', '当前链接'],
      enabled: hasDocument,
      run: (context) => context.openDocumentLinks?.(),
    },
    {
      id: 'showBacklinks',
      label: '查看反向链接',
      category: '视图',
      keywords: ['backlinks', 'references', '反链'],
      enabled: hasSavedDocumentPath,
      run: (context) => context.openBacklinks?.(),
    },
  ] satisfies CommandDefinition[];
}
