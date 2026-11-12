import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import {
  LARGE_DOCUMENT_WARNING_BYTES,
  isSupportedOpenDocumentPath,
  openSelectedDocument,
  resolveOpenDocumentPolicy,
  shouldWarnBeforeOpeningLargeDocument,
} from './openDocumentFlow';

const openPrismWindowMock = vi.hoisted(() => vi.fn(async () => undefined));
const grantMarkdownFileScopeMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('./openWindow', () => ({
  openPrismWindow: openPrismWindowMock,
}));

vi.mock('./fileSystemScope', () => ({
  grantMarkdownFileScope: grantMarkdownFileScopeMock,
}));

describe('openDocumentFlow policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentStore.setState({ currentDocument: null });
    useWorkspaceStore.setState({ fileTree: [], rootPath: null });
  });

  it('keeps the current document in the current window without dirty guard', () => {
    expect(resolveOpenDocumentPolicy({
      currentDocumentPath: '/repo/current.md',
      entryPoint: 'file-command',
      hasCurrentDocument: true,
      targetPath: '/repo/current.md',
    })).toEqual({
      dirtyGuard: false,
      reason: 'current-document',
      syncWorkspace: true,
      target: 'current-window',
    });
  });

  it('opens menu selections in a new window when a document is already active', () => {
    expect(resolveOpenDocumentPolicy({
      currentDocumentPath: '/repo/current.md',
      entryPoint: 'file-command',
      hasCurrentDocument: true,
      targetPath: '/repo/next.md',
    })).toEqual({
      dirtyGuard: false,
      reason: 'entry-prefers-new-window',
      syncWorkspace: false,
      target: 'new-window',
    });
  });

  it('keeps workspace navigation in the current window behind dirty-document guard', () => {
    expect(resolveOpenDocumentPolicy({
      currentDocumentPath: '/repo/current.md',
      entryPoint: 'workspace-navigation',
      hasCurrentDocument: true,
      targetPath: '/repo/next.md',
    })).toEqual({
      dirtyGuard: true,
      reason: 'entry-prefers-current-window',
      syncWorkspace: true,
      target: 'current-window',
    });
  });

  it('opens Finder and OS-level file requests in a new window when another document is active', () => {
    expect(resolveOpenDocumentPolicy({
      currentDocumentPath: '/repo/current.md',
      entryPoint: 'system',
      hasCurrentDocument: true,
      targetPath: '/repo/from-finder.md',
    })).toEqual({
      dirtyGuard: false,
      reason: 'entry-prefers-new-window',
      syncWorkspace: false,
      target: 'new-window',
    });
  });

  it('centralizes the supported Markdown and Text Document type boundary', () => {
    expect(isSupportedOpenDocumentPath('/repo/readme.md')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/readme.markdown')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/notes.txt')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/query.sql')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/settings.JSON')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/.env')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/app.ts')).toBe(false);
  });

  it('warns only above the large document threshold', () => {
    expect(shouldWarnBeforeOpeningLargeDocument(LARGE_DOCUMENT_WARNING_BYTES)).toBe(false);
    expect(shouldWarnBeforeOpeningLargeDocument(LARGE_DOCUMENT_WARNING_BYTES + 1)).toBe(true);
  });

  it('opens system document requests in a new window when another document is active', async () => {
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Current');

    await expect(openSelectedDocument(
      '/repo/from-finder.md',
      {
        documentStore: useDocumentStore.getState(),
        workspaceStore: useWorkspaceStore.getState(),
      },
      {
        confirmLargeDocument: false,
        entryPoint: 'system',
      },
    )).resolves.toEqual({
      reason: 'system',
      status: 'opened-new-window',
    });

    expect(grantMarkdownFileScopeMock).toHaveBeenCalledWith('/repo/from-finder.md');
    expect(openPrismWindowMock).toHaveBeenCalledWith({ filePath: '/repo/from-finder.md' });
    expect(useDocumentStore.getState().currentDocument?.path).toBe('/repo/current.md');
  });
});
