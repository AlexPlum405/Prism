import { describe, expect, it } from 'vitest';
import type { ContextMenuItem } from '../../../components/shell/ContextMenu';
import { isSupportedFileActionCommand } from '../../../lib/fileActionCommands';
import type { FileNode } from '../types';
import { createFileTreeContextMenuItems } from './fileTreeContextMenu';

function collectActions(items: ContextMenuItem[]): string[] {
  const actions: string[] = [];
  for (const item of items) {
    if (item.action) actions.push(item.action);
    if (item.children?.length) actions.push(...collectActions(item.children));
  }
  return actions;
}

const fileNode: FileNode = {
  path: '/notes/draft.md',
  name: 'draft.md',
  kind: 'file',
};

const directoryNode: FileNode = {
  path: '/notes/projects',
  name: 'projects',
  kind: 'directory',
};

describe('file tree context menu actions', () => {
  it('uses only supported file actions for workspace background menus', () => {
    const actions = collectActions(createFileTreeContextMenuItems({
      fileTreeMode: 'tree',
      fileSortMode: 'name',
      includeOpenNewWindow: true,
      showInFileManagerLabel: '在 Finder 中显示',
    }));

    expect(actions).toEqual(expect.arrayContaining([
      'openNewWindow',
      'newFile',
      'newFolder',
      'viewTree',
      'viewList',
      'sortByName',
      'sortByModified',
      'sortByCreated',
      'sortBySize',
      'refreshFolder',
      'copyRootPath',
      'openRootLocation',
    ]));
    expect(actions.filter((action) => !isSupportedFileActionCommand(action))).toEqual([]);
  });

  it('uses only supported file actions for file and folder item menus', () => {
    const actions = [
      ...collectActions(createFileTreeContextMenuItems({
        node: fileNode,
        fileTreeMode: 'tree',
        fileSortMode: 'name',
        showInFileManagerLabel: '在 Finder 中显示',
      })),
      ...collectActions(createFileTreeContextMenuItems({
        node: directoryNode,
        fileTreeMode: 'tree',
        fileSortMode: 'name',
        showInFileManagerLabel: '在 Finder 中显示',
      })),
    ];

    expect(actions).toEqual(expect.arrayContaining([
      'openFile:/notes/draft.md',
      'openNewWindow:/notes/draft.md',
      'rename:/notes/draft.md',
      'duplicate:/notes/draft.md',
      'delete:/notes/draft.md',
      'copyPath:/notes/draft.md',
      'openLocation:/notes/draft.md',
      'properties:/notes/draft.md',
      'openNewWindow:/notes/projects',
      'newFile:/notes/projects',
      'newFolder:/notes/projects',
      'rename:/notes/projects',
      'delete:/notes/projects',
      'copyPath:/notes/projects',
      'openLocation:/notes/projects',
      'properties:/notes/projects',
    ]));
    expect(actions.filter((action) => !isSupportedFileActionCommand(action))).toEqual([]);
  });
});
