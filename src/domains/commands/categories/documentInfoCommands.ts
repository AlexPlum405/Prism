import type { CommandContext, CommandDefinition } from '../types';

function hasDocument(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument);
}

function hasMarkdownDocument(context: CommandContext): boolean {
  return Boolean(
    context.documentStore.currentDocument
    && context.documentStore.currentDocument.profile?.supportsMarkdownLinks !== false,
  );
}

function hasSavedMarkdownDocument(context: CommandContext): boolean {
  return Boolean(
    context.documentStore.currentDocument?.path
    && context.documentStore.currentDocument.profile?.supportsMarkdownLinks !== false,
  );
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
      enabled: hasMarkdownDocument,
      run: (context) => context.openDocumentLinks?.(),
    },
    {
      id: 'showBacklinks',
      category: 'view',
      keywords: ['backlinks', 'references', '反链'],
      enabled: hasSavedMarkdownDocument,
      run: (context) => context.openBacklinks?.(),
    },
  ] satisfies CommandDefinition[];
}
