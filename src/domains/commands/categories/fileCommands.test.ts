import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileCommands } from './fileCommands';
import type { CommandContext } from '../types';
import { DEFAULT_SETTINGS } from '../../settings/types';

const openPrismWindowMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../../lib/openWindow', () => ({
  openPrismWindow: openPrismWindowMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  open: vi.fn(),
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

function getFileCommand(id: 'new' | 'newWindow') {
  const command = createFileCommands().find((entry) => entry.id === id);
  if (!command) throw new Error(`Missing command: ${id}`);
  return command;
}

describe('file commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens an explicit blank document window when creating a new document from an occupied window', async () => {
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
    expect(openPrismWindowMock).toHaveBeenCalledWith({ newDocument: true });
  });

  it('creates new windows in explicit blank-document mode', async () => {
    await getFileCommand('newWindow').run(createContext());

    expect(openPrismWindowMock).toHaveBeenCalledWith({ newDocument: true });
  });
});
