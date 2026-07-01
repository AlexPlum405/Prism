import type { ContextMenuItem } from '../../../components/shell/ContextMenu';
import type { FileNode, FileSortMode, FileTreeMode } from '../types';
import {
  dirname,
  getShowInFileManagerLabel,
  isDirectoryNode,
} from '../services';
import { t } from '../../i18n';

interface FileTreeContextMenuInput {
  node?: FileNode;
  fileTreeMode: FileTreeMode;
  fileSortMode: FileSortMode;
  showInFileManagerLabel?: string;
  includeOpenNewWindow?: boolean;
}

export function createFileTreeContextMenuItems({
  node,
  fileTreeMode,
  fileSortMode,
  showInFileManagerLabel = getShowInFileManagerLabel(),
  includeOpenNewWindow = false,
}: FileTreeContextMenuInput): ContextMenuItem[] {
  const nodeIsDirectory = node ? isDirectoryNode(node) : false;
  const targetDir = node ? (nodeIsDirectory ? node.path : dirname(node.path)) : undefined;

  if (!node) {
    return [
      ...(includeOpenNewWindow ? [{ label: t('workspace.fileTree.openInNewWindow'), action: 'openNewWindow' }] : []),
      ...(includeOpenNewWindow ? [{ type: 'separator' as const }] : []),
      { label: t('workspace.fileTree.newFile'), action: 'newFile' },
      { label: t('workspace.fileTree.newFolder'), action: 'newFolder' },
      { type: 'separator' },
      { label: t('workspace.fileTree.viewTree'), action: 'viewTree', checked: fileTreeMode === 'tree' },
      { label: t('workspace.fileTree.viewList'), action: 'viewList', checked: fileTreeMode === 'list' },
      {
        label: t('workspace.fileTree.sortBy'),
        children: [
          { label: t('workspace.fileTree.sort.name'), action: 'sortByName', checked: fileSortMode === 'name' },
          { label: t('workspace.fileTree.sort.modified'), action: 'sortByModified', checked: fileSortMode === 'modified' },
          { label: t('workspace.fileTree.sort.created'), action: 'sortByCreated', checked: fileSortMode === 'created' },
          { label: t('workspace.fileTree.sort.size'), action: 'sortBySize', checked: fileSortMode === 'size' },
        ],
      },
      { type: 'separator' },
      { label: t('workspace.fileTree.refresh'), action: 'refreshFolder' },
      { type: 'separator' },
      { label: t('workspace.fileTree.copyWorkspacePath'), action: 'copyRootPath' },
      { label: showInFileManagerLabel, action: 'openRootLocation' },
    ];
  }

  if (!nodeIsDirectory) {
    return [
      { label: t('common.open'), action: `openFile:${node.path}` },
      { label: t('workspace.fileTree.openInNewWindow'), action: `openNewWindow:${node.path}` },
      { type: 'separator' },
      { label: t('workspace.fileTree.rename'), action: `rename:${node.path}`, shortcut: 'F2' },
      { label: t('workspace.fileTree.duplicate'), action: `duplicate:${node.path}` },
      { label: t('workspace.fileTree.delete'), action: `delete:${node.path}`, danger: true },
      { type: 'separator' },
      { label: t('workspace.fileTree.copyFilePath'), action: `copyPath:${node.path}` },
      { label: showInFileManagerLabel, action: `openLocation:${node.path}` },
      { label: t('file.properties'), action: `properties:${node.path}` },
    ];
  }

  return [
    { label: t('workspace.fileTree.openInNewWindow'), action: `openNewWindow:${node.path}` },
    { type: 'separator' },
    { label: t('workspace.fileTree.newFile'), action: targetDir ? `newFile:${targetDir}` : 'newFile' },
    { label: t('workspace.fileTree.newFolder'), action: targetDir ? `newFolder:${targetDir}` : 'newFolder' },
    { type: 'separator' },
    { label: t('workspace.fileTree.rename'), action: `rename:${node.path}`, shortcut: 'F2' },
    { label: t('workspace.fileTree.delete'), action: `delete:${node.path}`, danger: true },
    { type: 'separator' },
    { label: t('workspace.fileTree.copyFolderPath'), action: `copyPath:${node.path}` },
    { label: showInFileManagerLabel, action: `openLocation:${node.path}` },
    { label: t('file.properties'), action: `properties:${node.path}` },
  ];
}
