import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismNativeError } from '../../../platform/tauri/result';

const nativeTreeMock = vi.hoisted(() => ({
  loadWorkspaceTreeNative: vi.fn(),
}));

const fileSystemMock = vi.hoisted(() => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('../../../platform/tauri/workspaceTree', () => nativeTreeMock);

vi.mock('../../../platform/tauri/fileSystem', () => fileSystemMock);

describe('loadFolderTree', () => {
  beforeEach(() => {
    nativeTreeMock.loadWorkspaceTreeNative.mockReset();
    nativeTreeMock.loadWorkspaceTreeNative.mockResolvedValue([]);
    fileSystemMock.readDir.mockReset();
    fileSystemMock.readTextFile.mockReset();
    fileSystemMock.stat.mockReset();
  });

  it('does not request file previews by default', async () => {
    const { loadFolderTree } = await import('./loadFolderTree');

    await loadFolderTree('/workspace');

    expect(nativeTreeMock.loadWorkspaceTreeNative).toHaveBeenCalledWith('/workspace', {
      maxDepth: 1,
      includePreview: false,
    });
  });

  it('requests recursive tree depth only when explicitly asked', async () => {
    const { loadFolderTree } = await import('./loadFolderTree');

    await loadFolderTree('/workspace', { scope: 'recursive' });

    expect(nativeTreeMock.loadWorkspaceTreeNative).toHaveBeenCalledWith('/workspace', {
      maxDepth: 8,
      includePreview: false,
    });
  });

  it('can still request previews explicitly', async () => {
    const { loadFolderTree } = await import('./loadFolderTree');

    await loadFolderTree('/workspace', { includePreview: true });

    expect(nativeTreeMock.loadWorkspaceTreeNative).toHaveBeenCalledWith('/workspace', {
      maxDepth: 1,
      includePreview: true,
    });
  });

  it('skips generated directories when falling back to filesystem traversal', async () => {
    nativeTreeMock.loadWorkspaceTreeNative.mockRejectedValue(
      new PrismNativeError({
        code: 'unknown_error',
        message: 'window.__TAURI__.invoke is not a function',
      }),
    );
    fileSystemMock.readDir.mockImplementation(async (path: string) => {
      if (path === '/workspace') {
        return [
          { name: 'node_modules', isDirectory: true, isFile: false },
          { name: 'target', isDirectory: true, isFile: false },
          { name: 'docs', isDirectory: true, isFile: false },
          { name: 'root.md', isDirectory: false, isFile: true },
        ];
      }
      if (path === '/workspace/docs') {
        return [{ name: 'a.md', isDirectory: false, isFile: true }];
      }
      throw new Error(`unexpected readDir: ${path}`);
    });
    fileSystemMock.stat.mockResolvedValue({
      size: 10,
      birthtime: new Date(0),
      mtime: new Date(0),
    });

    const { loadFolderTree } = await import('./loadFolderTree');

    const tree = await loadFolderTree('/workspace', { scope: 'recursive' });

    expect(tree.map((node) => node.name)).toEqual(['docs', 'root.md']);
    expect(tree[0]?.children?.map((node) => node.name)).toEqual(['a.md']);
    expect(fileSystemMock.readDir).not.toHaveBeenCalledWith('/workspace/node_modules');
    expect(fileSystemMock.readDir).not.toHaveBeenCalledWith('/workspace/target');
  });

  it('does not traverse subfolders in current-level fallback mode', async () => {
    nativeTreeMock.loadWorkspaceTreeNative.mockRejectedValue(
      new PrismNativeError({
        code: 'unknown_error',
        message: 'window.__TAURI__.invoke is not a function',
      }),
    );
    fileSystemMock.readDir.mockResolvedValueOnce([
      { name: 'docs', isDirectory: true, isFile: false },
      { name: 'root.md', isDirectory: false, isFile: true },
    ]);
    fileSystemMock.stat.mockResolvedValue({
      size: 10,
      birthtime: new Date(0),
      mtime: new Date(0),
    });

    const { loadFolderTree } = await import('./loadFolderTree');

    const tree = await loadFolderTree('/workspace');

    expect(tree.map((node) => node.name)).toEqual(['root.md']);
    expect(fileSystemMock.readDir).toHaveBeenCalledTimes(1);
    expect(fileSystemMock.readDir).not.toHaveBeenCalledWith('/workspace/docs');
  });
});
