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
      category: 'file',
      keywords: ['front matter', 'yaml', 'metadata', 'properties', 'meta'],
      enabled: hasDocument,
      run: (context) => context.openDocumentProperties?.(),
    },
    {
      id: 'showDocumentLinks',
      category: 'view',
      keywords: ['links', 'outlinks', 'document links', '当前链接'],
      enabled: hasDocument,
      run: (context) => context.openDocumentLinks?.(),
    },
    {
      id: 'showBacklinks',
      category: 'view',
      keywords: ['backlinks', 'references', '反链'],
      enabled: hasSavedDocumentPath,
      run: (context) => context.openBacklinks?.(),
    },
  ] satisfies CommandDefinition[];
}
