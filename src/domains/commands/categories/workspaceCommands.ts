import { open } from '@tauri-apps/plugin-dialog';
import { openPrismWindow } from '../../../lib/openWindow';
import { grantWorkspaceDirectoryScope } from '../../../lib/fileSystemScope';
import { loadFolderTree } from '../../workspace/lib/loadFolderTree';
import type { CommandContext, CommandDefinition } from '../types';

function hasSavedDocumentPath(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument?.path);
}

async function handleOpenFolder(context: CommandContext): Promise<void> {
  const selected = await open({ directory: true, multiple: false, recursive: true });
  if (!selected || Array.isArray(selected)) return;
  await grantWorkspaceDirectoryScope(selected);

  if (context.documentStore.currentDocument) {
    await openPrismWindow({ folderPath: selected });
    return;
  }

  context.workspaceStore.setRootPath(selected);
  try {
    const tree = await loadFolderTree(selected);
    context.workspaceStore.setFileTree(tree);
  } catch (err) {
    console.error('[Command] Failed to load folder tree:', err);
  }
}

export function createWorkspaceCommands(): CommandDefinition[] {
  return [
    {
      id: 'openFolder',
      label: '打开文件夹',
      category: '文件',
      keywords: ['folder'],
      shortcuts: [{ code: 'KeyO', mod: true, shift: true }],
      run: handleOpenFolder,
    },
    {
      id: 'quickOpen',
      label: '快速打开文件',
      category: '文件',
      keywords: ['quick', 'open', 'file', 'workspace'],
      shortcuts: [{ code: 'KeyP', mod: true }],
      enabled: (context) => Boolean(context.workspaceStore.rootPath && context.workspaceStore.fileTree.length > 0),
      run: (context) => context.openQuickOpen?.(),
    },
    {
      id: 'showRelationGraph',
      label: '查看关系图谱',
      category: '视图',
      keywords: ['graph', 'relation', '关系', '图谱'],
      shortcuts: [{ code: 'KeyG', mod: true, alt: true }],
      enabled: hasSavedDocumentPath,
      run: (context) => context.openRelationGraph?.(),
    },
  ] satisfies CommandDefinition[];
}
