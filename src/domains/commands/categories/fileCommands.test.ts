import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileCommands } from './fileCommands';
import type { CommandContext } from '../types';
import { DEFAULT_SETTINGS } from '../../settings/types';

const openPrismWindowMock = vi.hoisted(() => vi.fn(async () => undefined));
const openSelectedDocumentMock = vi.hoisted(() => vi.fn(async () => undefined));
const executeFileActionMock = vi.hoisted(() => vi.fn(async () => undefined));
const openDialogMock = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/openWindow', () => ({
  openPrismWindow: openPrismWindowMock,
}));

vi.mock('../../../lib/fileActions', () => ({
  executeFileAction: executeFileActionMock,
}));

vi.mock('../../../lib/openDocumentFlow', () => ({
  openSelectedDocument: openSelectedDocumentMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  open: openDialogMock,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  stat: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(),
  revealItemInDir: vi.fn(),
}));

function createContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    documentStore: {
      currentDocument: null,
      createNewDocument: vi.fn(),
      openDocument: vi.fn(),
      closeDocument: vi.fn(),
      updateContent: vi.fn(),
      updateDocumentPath: vi.fn(),
      updateScrollState: vi.fn(),
      setViewMode: vi.fn(),
      updateFileSnapshot: vi.fn(),
      markSaving: vi.fn(),
      markSaved: vi.fn(),
      markSaveFailed: vi.fn(),
      markSaveConflict: vi.fn(),
    },
    settingsStore: {
      ...DEFAULT_SETTINGS,
      themeRegistryVersion: 0,
      themeRegistry: [],
    } as unknown as CommandContext['settingsStore'],
    workspaceStore: {
      fileTree: [],
      rootPath: null,
    } as unknown as CommandContext['workspaceStore'],
    ...overrides,
  };
}

function getFileCommand(id: 'new' | 'newWindow' | 'open') {
  const command = createFileCommands().find((entry) => entry.id === id);
  if (!command) throw new Error(`Missing command: ${id}`);
  return command;
}

describe('file commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new file beside the current document instead of opening a new window', async () => {
    const createNewDocument = vi.fn();
    const context = createContext({
      documentStore: {
        ...createContext().documentStore,
        currentDocument: {
          path: '/tmp/current.md',
          name: 'current.md',
          content: '# Current',
          isDirty: false,
          lastSavedAt: 1,
          lastKnownMtime: null,
          lastKnownSize: null,
          saveStatus: 'saved',
          saveError: null,
          viewMode: 'split',
          scrollState: { editorRatio: 0, previewRatio: 0 },
        },
        createNewDocument,
      },
    });

    await getFileCommand('new').run(context);

    expect(createNewDocument).not.toHaveBeenCalled();
    expect(openPrismWindowMock).not.toHaveBeenCalled();
    expect(executeFileActionMock).toHaveBeenCalledWith(
      { action: 'newFile', path: '/tmp' },
      expect.objectContaining({
        documentStore: context.documentStore,
        workspaceStore: context.workspaceStore,
      }),
    );
  });

  it('creates a new file at the workspace root when no document is open', async () => {
    const context = createContext({
      workspaceStore: {
        fileTree: [],
        rootPath: '/repo',
      } as unknown as CommandContext['workspaceStore'],
    });

    await getFileCommand('new').run(context);

    expect(executeFileActionMock).toHaveBeenCalledWith(
      { action: 'newFile', path: '/repo' },
      expect.objectContaining({
        documentStore: context.documentStore,
        workspaceStore: context.workspaceStore,
      }),
    );
  });

  it('creates default workspace windows without forcing an empty shell', async () => {
    await getFileCommand('newWindow').run(createContext());

    expect(openPrismWindowMock).toHaveBeenCalledWith({});
  });

  it('opens dialog selections through the shared document flow', async () => {
    const context = createContext();
    openDialogMock.mockResolvedValue('/repo/readme.md');

    await getFileCommand('open').run(context);

    expect(openSelectedDocumentMock).toHaveBeenCalledWith(
      '/repo/readme.md',
      context,
      { entryPoint: 'file-command' },
    );
  });

  it('does nothing when the open dialog is cancelled', async () => {
    openDialogMock.mockResolvedValue(null);

    await getFileCommand('open').run(createContext());

    expect(openSelectedDocumentMock).not.toHaveBeenCalled();
  });
});
