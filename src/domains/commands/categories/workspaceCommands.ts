import { openPrismWindow } from '../../../lib/openWindow';
import { grantWorkspaceDirectoryScope } from '../../../lib/fileSystemScope';
import { loadFolderTree } from '../../workspace/lib/loadFolderTree';
import type { CommandContext, CommandDefinition } from '../types';
import { openDialog } from '../../../platform/tauri/dialogs';
/**
 * 只要打开了可索引的 Markdown 文档就允许进图谱：空态本身就是入口，
 * 把入口藏起来只会让用户永远不知道这个功能存在。
 */
function canOpenRelationGraph(context: CommandContext): boolean {
  const currentDocument = context.documentStore.currentDocument;
  if (!currentDocument?.path || currentDocument.profile?.supportsRelationGraph === false) return false;
  return Boolean(context.workspaceIndex);
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
      shortcuts: [{ code: 'KeyO', mod: true, alt: true }],
      enabled: (context) => Boolean(context.workspaceStore.rootPath && context.workspaceStore.fileTree.length > 0),
      run: (context) => context.openQuickOpen?.(),
    },
    {
      id: 'showRelationGraph',
      category: 'view',
      keywords: ['graph', 'relation', '关系', '图谱'],
      shortcuts: [{ code: 'KeyG', mod: true, alt: true }],
      enabled: canOpenRelationGraph,
      run: (context) => context.openRelationGraph?.(),
    },
    {
      id: 'showDocumentDiagnostics',
      category: 'view',
      keywords: ['diagnostics', 'problems', '诊断', '问题', 'error'],
      enabled: (context) => Boolean(
        context.documentStore.currentDocument
        && context.documentStore.currentDocument.profile?.kind !== 'text',
      ),
      run: (context) => context.openDocumentDiagnostics?.(),
    },
    {
      id: 'showDocumentStatistics',
      category: 'view',
      keywords: ['statistics', 'count', 'words', '统计', '字数', '写作'],
      enabled: (context) => Boolean(context.documentStore.currentDocument),
      run: (context) => context.openDocumentStatistics?.(),
    },
  ] satisfies CommandDefinition[];
}
