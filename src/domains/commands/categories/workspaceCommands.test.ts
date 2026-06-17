import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceCommands } from './workspaceCommands';
import type { CommandContext } from '../types';
import { buildWorkspaceIndex, TEXT_DOCUMENT_PROFILE } from '../../workspace/services';

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

function getWorkspaceCommand(id: 'openFolder' | 'showRelationGraph') {
  const command = createWorkspaceCommands().find((entry) => entry.id === id);
  if (!command) throw new Error(`Missing command: ${id}`);
  return command;
}

function buildRelationIndex(documents: Array<{ content: string; path: string }>) {
  return buildWorkspaceIndex({
    fileTree: [
      { path: '/workspace/current.md', name: 'current.md', kind: 'file', modifiedAt: 1, size: 100 },
      { path: '/workspace/target.md', name: 'target.md', kind: 'file', modifiedAt: 2, size: 100 },
      { path: '/workspace/query.sql', name: 'query.sql', kind: 'file', modifiedAt: 3, size: 100 },
    ],
    workspaceRoot: '/workspace',
    documents,
  });
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

  it('enables relation graph only when the current markdown document has relations', async () => {
    const openRelationGraph = vi.fn();
    const command = getWorkspaceCommand('showRelationGraph');
    const context = createContext({
      documentStore: {
        currentDocument: { path: '/workspace/current.md' },
      } as CommandContext['documentStore'],
      workspaceIndex: buildRelationIndex([
        { path: '/workspace/current.md', content: '# Current\n\n[Target](target.md)' },
        { path: '/workspace/target.md', content: '# Target' },
      ]),
      openRelationGraph,
    });

    expect(command.enabled?.(context)).toBe(true);
    await command.run(context);

    expect(openRelationGraph).toHaveBeenCalledTimes(1);
  });

  it('disables relation graph for text documents and markdown documents without relations', () => {
    const command = getWorkspaceCommand('showRelationGraph');
    const noRelationContext = createContext({
      documentStore: {
        currentDocument: { path: '/workspace/current.md' },
      } as CommandContext['documentStore'],
      workspaceIndex: buildRelationIndex([
        { path: '/workspace/current.md', content: '# Current\n\n[Web](https://example.com)' },
        { path: '/workspace/target.md', content: '# Target' },
      ]),
    });
    const textContext = createContext({
      documentStore: {
        currentDocument: {
          path: '/workspace/query.sql',
          profile: TEXT_DOCUMENT_PROFILE,
        },
      } as CommandContext['documentStore'],
      workspaceIndex: buildRelationIndex([
        { path: '/workspace/query.sql', content: 'select "[[target]]";' },
        { path: '/workspace/target.md', content: '# Target' },
      ]),
    });

    expect(command.enabled?.(noRelationContext)).toBe(false);
    expect(command.enabled?.(textContext)).toBe(false);
  });
});
