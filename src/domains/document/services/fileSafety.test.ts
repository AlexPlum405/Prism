import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import {
  FileConflictError,
  createDocumentFileSession,
  createKnownFileSnapshot,
  createWorkspaceFileSession,
  fileConflictDetector,
  isFileConflictError,
  readDocumentFileSession,
  recoverySnapshotStore,
  writeDocumentFileSession,
} from './fileSafety';
import {
  clearRecoverySnapshotsForDocument,
  createRecoverySnapshot,
} from './recovery';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('./recovery', () => ({
  createRecoverySnapshot: vi.fn(),
  clearRecoverySnapshotsForDocument: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 3, mtime: new Date(1000) });
  (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# Disk');
  (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  (createRecoverySnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (clearRecoverySnapshotsForDocument as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe('fileSafety', () => {
  it('creates a persisted document session from store document state', () => {
    const session = createDocumentFileSession({
      path: '/tmp/a.md',
      name: 'a.md',
      content: '# A',
      isDirty: true,
      lastSavedAt: 0,
      lastKnownMtime: 1000,
      lastKnownSize: 3,
      saveStatus: 'dirty',
      saveError: null,
      viewMode: 'edit',
      scrollState: { editorRatio: 0, previewRatio: 0 },
    });

    expect(session).toEqual({
      path: '/tmp/a.md',
      name: 'a.md',
      content: '# A',
      knownSnapshot: { mtimeMs: 1000, size: 3 },
    });
    expect(createDocumentFileSession(null)).toBeNull();
  });

  it('creates workspace file sessions only for opened folders', () => {
    expect(createWorkspaceFileSession('', '/tmp/a.md')).toBeNull();
    expect(createWorkspaceFileSession('/tmp', '/tmp/a.md')).toEqual({
      rootPath: '/tmp',
      activeDocumentPath: '/tmp/a.md',
    });
  });

  it('detects unchanged and changed files from snapshots', async () => {
    await expect(
      fileConflictDetector.ensureUnchanged('/tmp/a.md', createKnownFileSnapshot(1000, 3)),
    ).resolves.toEqual({ mtimeMs: 1000, size: 3 });

    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 9, mtime: new Date(2000) });

    await expect(
      fileConflictDetector.ensureUnchanged('/tmp/a.md', createKnownFileSnapshot(1000, 3)),
    ).rejects.toBeInstanceOf(FileConflictError);

    try {
      await fileConflictDetector.ensureUnchanged('/tmp/a.md', createKnownFileSnapshot(1000, 3));
    } catch (error) {
      expect(isFileConflictError(error)).toBe(true);
    }
  });

  it('reads and writes document file sessions with fresh snapshots', async () => {
    const session = await readDocumentFileSession('/tmp/a.md');

    expect(readTextFile).toHaveBeenCalledWith('/tmp/a.md');
    expect(session).toEqual({
      path: '/tmp/a.md',
      name: 'a.md',
      content: '# Disk',
      knownSnapshot: { mtimeMs: 1000, size: 3 },
    });

    const snapshot = await writeDocumentFileSession({ path: '/tmp/a.md', content: '# Mine' });

    expect(writeTextFile).toHaveBeenCalledWith('/tmp/a.md', '# Mine');
    expect(snapshot).toEqual({ mtimeMs: 1000, size: 3 });
  });

  it('exposes recovery snapshot storage behind the file safety boundary', async () => {
    await recoverySnapshotStore.create({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# Mine',
      reason: 'manual-save',
    });
    await recoverySnapshotStore.clearForDocument('/tmp/a.md');

    expect(createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# Mine',
      reason: 'manual-save',
    });
    expect(clearRecoverySnapshotsForDocument).toHaveBeenCalledWith('/tmp/a.md');
  });
});
