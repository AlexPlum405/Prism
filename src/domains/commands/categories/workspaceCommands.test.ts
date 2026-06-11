import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceCommands } from './workspaceCommands';
import type { CommandContext } from '../types';

const loadFolderTreeMock = vi.hoisted(() => vi.fn());
const grantWorkspaceDirectoryScopeMock = vi.hoisted(() => vi.fn(async () => undefined));
const openPrismWindowMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../workspace/lib/loadFolderTree', () => ({
  loadFolderTree: loadFolderTreeMock,
}));

vi.mock('../../../lib/fileSystemScope', () => ({
  grantWorkspaceDirectoryScope: grantWorkspaceDirectoryScopeMock,
}));

vi.mock('../../../lib/openWindow', () => ({
  openPrismWindow: openPrismWindowMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => '/workspace'),
}));

function createContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    documentStore: {
      currentDocument: null,
    },
    workspaceStore: {
      rootPath: null,
      fileTree: [],
      setRootPath: vi.fn(),
      setFileTree: vi.fn(),
      setWorkspace: vi.fn(),
    },
    ...overrides,
  } as unknown as CommandContext;
}

function getWorkspaceCommand(id: 'openFolder') {
  const command = createWorkspaceCommands().find((entry) => entry.id === id);
  if (!command) throw new Error(`Missing command: ${id}`);
  return command;
}

describe('workspace commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFolderTreeMock.mockResolvedValue([{ path: '/workspace/a.md', name: 'a.md', kind: 'file' }]);
  });

  it('sets folder root and tree atomically after loading the selected folder', async () => {
    const context = createContext();

    await getWorkspaceCommand('openFolder').run(context);

    expect(grantWorkspaceDirectoryScopeMock).toHaveBeenCalledWith('/workspace');
    expect(loadFolderTreeMock).toHaveBeenCalledWith('/workspace');
    expect(context.workspaceStore.setRootPath).not.toHaveBeenCalled();
    expect(context.workspaceStore.setFileTree).not.toHaveBeenCalled();
    expect(context.workspaceStore.setWorkspace).toHaveBeenCalledWith('/workspace', [
      { path: '/workspace/a.md', name: 'a.md', kind: 'file' },
    ]);
  });

  it('opens an occupied window folder selection in a new Prism window', async () => {
    const context = createContext({
      documentStore: {
        currentDocument: { path: '/current.md' },
      } as CommandContext['documentStore'],
    });

    await getWorkspaceCommand('openFolder').run(context);

    expect(openPrismWindowMock).toHaveBeenCalledWith({ folderPath: '/workspace' });
    expect(loadFolderTreeMock).not.toHaveBeenCalled();
  });
});
