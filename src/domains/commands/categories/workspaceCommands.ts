import { openPrismWindow } from '../../../lib/openWindow';
import { grantWorkspaceDirectoryScope } from '../../../lib/fileSystemScope';
import { loadFolderTree } from '../../workspace/lib/loadFolderTree';
import type { CommandContext, CommandDefinition } from '../types';
import { openDialog } from '../../../platform/tauri/dialogs';
import { hasWorkspaceIndexDocumentRelations } from '../../workspace/services';

function hasCurrentDocumentRelations(context: CommandContext): boolean {
  const currentDocument = context.documentStore.currentDocument;
  if (!currentDocument?.path || currentDocument.profile?.supportsRelationGraph === false) return false;
  if (!context.workspaceIndex) return false;
  return hasWorkspaceIndexDocumentRelations(context.workspaceIndex, currentDocument.path);
}

async function handleOpenFolder(context: CommandContext): Promise<void> {
  const selected = await openDialog({ directory: true, multiple: false, recursive: true });
  if (!selected || Array.isArray(selected)) return;
  await grantWorkspaceDirectoryScope(selected);

  if (context.documentStore.currentDocument) {
    await openPrismWindow({ folderPath: selected });
    return;
  }

  try {
    const tree = await loadFolderTree(selected);
    context.workspaceStore.setWorkspace(selected, tree);
  } catch (err) {
    console.error('[Command] Failed to load folder tree:', err);
  }
}

export function createWorkspaceCommands(): CommandDefinition[] {
  return [
    {
      id: 'openFolder',
      category: 'file',
      keywords: ['folder'],
      shortcuts: [{ code: 'KeyO', mod: true, shift: true }],
      run: handleOpenFolder,
    },
    {
      id: 'quickOpen',
      category: 'file',
      keywords: ['quick', 'open', 'file', 'workspace'],
      shortcuts: [{ code: 'KeyP', mod: true, shift: true }],
      enabled: (context) => Boolean(context.workspaceStore.rootPath && context.workspaceStore.fileTree.length > 0),
      run: (context) => context.openQuickOpen?.(),
    },
    {
      id: 'showRelationGraph',
      category: 'view',
      keywords: ['graph', 'relation', '关系', '图谱'],
      shortcuts: [{ code: 'KeyG', mod: true, alt: true }],
      enabled: hasCurrentDocumentRelations,
      run: (context) => context.openRelationGraph?.(),
    },
  ] satisfies CommandDefinition[];
}
