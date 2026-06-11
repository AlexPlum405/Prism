import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeTreeMock = vi.hoisted(() => ({
  loadWorkspaceTreeNative: vi.fn(),
}));

vi.mock('../../../platform/tauri/workspaceTree', () => nativeTreeMock);

vi.mock('../../../platform/tauri/fileSystem', () => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  stat: vi.fn(),
}));

describe('loadFolderTree', () => {
  beforeEach(() => {
    nativeTreeMock.loadWorkspaceTreeNative.mockReset();
    nativeTreeMock.loadWorkspaceTreeNative.mockResolvedValue([]);
  });

  it('does not request file previews by default', async () => {
    const { loadFolderTree } = await import('./loadFolderTree');

    await loadFolderTree('/workspace');

    expect(nativeTreeMock.loadWorkspaceTreeNative).toHaveBeenCalledWith('/workspace', {
      maxDepth: 8,
      includePreview: false,
    });
  });

  it('can still request previews explicitly', async () => {
    const { loadFolderTree } = await import('./loadFolderTree');

    await loadFolderTree('/workspace', { includePreview: true });

    expect(nativeTreeMock.loadWorkspaceTreeNative).toHaveBeenCalledWith('/workspace', {
      maxDepth: 8,
      includePreview: true,
    });
  });
});
