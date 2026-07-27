import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileCommands } from './fileCommands';
import type { CommandContext } from '../types';
import { DEFAULT_SETTINGS } from '../../settings/types';

const openPrismWindowMock = vi.hoisted(() => vi.fn(async () => undefined));
const openSelectedDocumentMock = vi.hoisted(() => vi.fn(async () => undefined));
const executeFileActionMock = vi.hoisted(() => vi.fn(async () => undefined));
const openDialogMock = vi.hoisted(() => vi.fn());
const loadFolderTreeMock = vi.hoisted(() => vi.fn(async (): Promise<unknown[]> => []));
const grantWorkspaceDirectoryScopeMock = vi.hoisted(() => vi.fn(async () => undefined));
const writeDocumentFileSessionMock = vi.hoisted(() => vi.fn(async () => ({ mtimeMs: 1000, size: 0 })));
const recoverySnapshotStoreMock = vi.hoisted(() => ({
  clearForDocument: vi.fn(async () => undefined),
  create: vi.fn(async () => undefined),
}));

vi.mock('../../../lib/openWindow', () => ({
  openPrismWindow: openPrismWindowMock,
}));

vi.mock('../../../lib/fileActions', () => ({
  executeFileAction: executeFileActionMock,
}));

vi.mock('../../../lib/openDocumentFlow', () => ({
  openSelectedDocument: openSelectedDocumentMock,
}));

vi.mock('../../workspace/lib/loadFolderTree', () => ({
  loadFolderTree: loadFolderTreeMock,
}));

vi.mock('../../../lib/fileSystemScope', () => ({
  grantWorkspaceDirectoryScope: grantWorkspaceDirectoryScopeMock,
}));

vi.mock('../../document/services/fileSafety', () => ({
  createDocumentFileSession: vi.fn((document) => (document?.path ? {
    content: document.content,
    knownSnapshot: {
      mtimeMs: document.lastKnownMtime ?? null,
      size: document.lastKnownSize ?? null,
    },
    name: document.name,
    path: document.path,
  } : null)),
  fileConflictDetector: {
    ensureUnchanged: vi.fn(async () => ({ mtimeMs: 1000, size: 0 })),
  },
  isFileConflictError: vi.fn(() => false),
  recoverySnapshotStore: recoverySnapshotStoreMock,
  writeDocumentFileSession: writeDocumentFileSessionMock,
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
      setFileTree: vi.fn(),
      setWorkspace: vi.fn(),
    } as unknown as CommandContext['workspaceStore'],
    ...overrides,
  };
}

function getFileCommand(id: 'new' | 'newWindow' | 'open' | 'save' | 'saveAs' | 'fileProperties') {
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
        setFileTree: vi.fn(),
        setWorkspace: vi.fn(),
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

  it('creates an unsaved document when the current window has no workspace', async () => {
    const createNewDocument = vi.fn();
    const showToast = vi.fn();
    const context = createContext({
      documentStore: {
        ...createContext().documentStore,
        createNewDocument,
      },
      showToast,
    });

    await getFileCommand('new').run(context);

    expect(createNewDocument).toHaveBeenCalledWith();
    expect(executeFileActionMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('sets the saved document directory as the workspace after saving an unsaved document', async () => {
    const tree = [{ kind: 'file', name: 'Draft.md', path: '/notes/Draft.md' }];
    const snapshot = { mtimeMs: 2000, size: 7 };
    const openDocument = vi.fn();
    const markSaved = vi.fn();
    const setWorkspace = vi.fn();
    const requestSavePath = vi.fn(async () => '/notes/Draft.md');
    loadFolderTreeMock.mockResolvedValueOnce(tree);
    writeDocumentFileSessionMock.mockResolvedValueOnce(snapshot);
    const context = createContext({
      documentStore: {
        ...createContext().documentStore,
        currentDocument: {
          path: '',
          name: 'Draft.md',
          content: '# Draft',
          isDirty: true,
          lastSavedAt: 1,
          lastKnownMtime: null,
          lastKnownSize: null,
          saveStatus: 'dirty',
          saveError: null,
          viewMode: 'split',
          scrollState: { editorRatio: 0, previewRatio: 0 },
        },
        openDocument,
        markSaved,
      },
      requestSavePath,
      workspaceStore: {
        fileTree: [],
        rootPath: null,
        setFileTree: vi.fn(),
        setWorkspace,
      } as unknown as CommandContext['workspaceStore'],
    });

    await getFileCommand('save').run(context);

    expect(requestSavePath).toHaveBeenCalledWith({
      documentPath: '',
      filename: 'Draft.md',
    });
    expect(writeDocumentFileSessionMock).toHaveBeenCalledWith({
      content: '# Draft',
      expectedSnapshot: null,
      path: '/notes/Draft.md',
    });
    expect(openDocument).toHaveBeenCalledWith('/notes/Draft.md', 'Draft.md', '# Draft', snapshot);
    expect(markSaved).toHaveBeenCalledWith('/notes/Draft.md', snapshot);
    expect(grantWorkspaceDirectoryScopeMock).toHaveBeenCalledWith('/notes');
    expect(loadFolderTreeMock).toHaveBeenCalledWith('/notes');
    expect(setWorkspace).toHaveBeenCalledWith('/notes', tree);
  });

  it('saves a dirty unsaved document before creating the next file in that directory', async () => {
    const requestSavePath = vi.fn(async () => '/notes/Draft.md');
    const createNewDocument = vi.fn();
    const context = createContext({
      documentStore: {
        ...createContext().documentStore,
        currentDocument: {
          path: '',
          name: 'Draft.md',
          content: '# Draft',
          isDirty: true,
          lastSavedAt: 1,
          lastKnownMtime: null,
          lastKnownSize: null,
          saveStatus: 'dirty',
          saveError: null,
          viewMode: 'split',
          scrollState: { editorRatio: 0, previewRatio: 0 },
        },
        createNewDocument,
      },
      requestSavePath,
      workspaceStore: {
        fileTree: [],
        rootPath: null,
        setFileTree: vi.fn(),
        setWorkspace: vi.fn(),
      } as unknown as CommandContext['workspaceStore'],
    });

    await getFileCommand('new').run(context);

    expect(writeDocumentFileSessionMock).toHaveBeenCalledWith({
      content: '# Draft',
      expectedSnapshot: null,
      path: '/notes/Draft.md',
    });
    expect(executeFileActionMock).toHaveBeenCalledWith(
      { action: 'newFile', path: '/notes' },
      expect.objectContaining({
        documentStore: context.documentStore,
        workspaceStore: context.workspaceStore,
      }),
    );
    expect(createNewDocument).not.toHaveBeenCalled();
  });

  it('creates blank windows without restoring a default document', async () => {
    await getFileCommand('newWindow').run(createContext());

    expect(openPrismWindowMock).toHaveBeenCalledTimes(1);
    expect(openPrismWindowMock).toHaveBeenCalledWith();
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

  it('shows file properties for the current saved document', async () => {
    const context = createContext({
      documentStore: {
        ...createContext().documentStore,
        currentDocument: {
          path: '/repo/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastSavedAt: 1,
          lastKnownMtime: null,
          lastKnownSize: null,
          saveStatus: 'saved',
          saveError: null,
          viewMode: 'split',
          scrollState: { editorRatio: 0, previewRatio: 0 },
        },
      },
    });

    await getFileCommand('fileProperties').run(context);

    expect(executeFileActionMock).toHaveBeenCalledWith(
      { action: 'properties', path: '/repo/report.md' },
      expect.objectContaining({
        documentStore: context.documentStore,
        workspaceStore: context.workspaceStore,
      }),
    );
  });
});
