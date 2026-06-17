import { describe, expect, it } from 'vitest';
import {
  LARGE_DOCUMENT_WARNING_BYTES,
  isSupportedOpenDocumentPath,
  resolveOpenDocumentPolicy,
  shouldWarnBeforeOpeningLargeDocument,
} from './openDocumentFlow';

describe('openDocumentFlow policy', () => {
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

  it('centralizes the current supported document type boundary before DocumentProfile expands it', () => {
    expect(isSupportedOpenDocumentPath('/repo/readme.md')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/readme.markdown')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/notes.txt')).toBe(true);
    expect(isSupportedOpenDocumentPath('/repo/app.ts')).toBe(false);
  });

  it('warns only above the large document threshold', () => {
    expect(shouldWarnBeforeOpeningLargeDocument(LARGE_DOCUMENT_WARNING_BYTES)).toBe(false);
    expect(shouldWarnBeforeOpeningLargeDocument(LARGE_DOCUMENT_WARNING_BYTES + 1)).toBe(true);
  });
});
