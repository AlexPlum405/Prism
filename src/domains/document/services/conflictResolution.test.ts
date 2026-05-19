import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { useDocumentStore } from '../store';
import {
  getConflictCopyFilename,
  overwriteConflictedDocument,
  reloadConflictedDocument,
  saveConflictedDocumentAs,
} from './conflictResolution';
import { addRecentFile } from '../../workspace/services/recentFiles';
import {
  clearRecoverySnapshotsForDocument,
  createRecoverySnapshot,
} from './recovery';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('../../workspace/services/recentFiles', () => ({
  addRecentFile: vi.fn(),
}));

vi.mock('./recovery', () => ({
  createRecoverySnapshot: vi.fn(),
  clearRecoverySnapshotsForDocument: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useDocumentStore.setState({ currentDocument: null });
  (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 8, mtime: new Date(2000) });
  (createRecoverySnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (clearRecoverySnapshotsForDocument as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

function openConflictedDocument() {
  useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# Disk', { size: 6, mtimeMs: 1000 });
  useDocumentStore.getState().updateContent('# Mine');
  useDocumentStore.getState().markSaveConflict('文件已在磁盘上被外部修改，请先重新加载或另存为。', '/tmp/a.md');
}

describe('conflictResolution', () => {
  it('builds a local copy filename for save-as conflict resolution', () => {
    expect(getConflictCopyFilename('a.md')).toBe('a-local.md');
    expect(getConflictCopyFilename('draft.markdown')).toBe('draft-local.markdown');
    expect(getConflictCopyFilename('Untitled')).toBe('Untitled-local.md');
  });

  it('reloads the disk version and updates the stored snapshot', async () => {
    openConflictedDocument();
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# Disk v2');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 9, mtime: new Date(3000) });

    const result = await reloadConflictedDocument();

    expect(result).toEqual({ resolved: true, path: '/tmp/a.md' });
    expect(readTextFile).toHaveBeenCalledWith('/tmp/a.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: '/tmp/a.md',
      name: 'a.md',
      content: '# Disk v2',
      isDirty: false,
      saveStatus: 'saved',
      saveError: null,
      lastKnownMtime: 3000,
      lastKnownSize: 9,
    });
    expect(addRecentFile).toHaveBeenCalledWith('/tmp/a.md', 'a.md');
    expect(clearRecoverySnapshotsForDocument).toHaveBeenCalledWith('/tmp/a.md');
  });

  it('saves the local version to a new path and clears the conflict', async () => {
    openConflictedDocument();
    (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 7, mtime: new Date(4000) });
    const requestSavePath = vi.fn().mockResolvedValue('/tmp/a-local.md');

    const result = await saveConflictedDocumentAs(requestSavePath);

    expect(requestSavePath).toHaveBeenCalledWith({
      filename: 'a-local.md',
      documentPath: '/tmp/a.md',
    });
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/a-local.md', '# Mine');
    expect(result).toEqual({ resolved: true, path: '/tmp/a-local.md' });
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: '/tmp/a-local.md',
      name: 'a-local.md',
      content: '# Mine',
      isDirty: false,
      saveStatus: 'saved',
      saveError: null,
      lastKnownMtime: 4000,
      lastKnownSize: 7,
    });
    expect(addRecentFile).toHaveBeenCalledWith('/tmp/a-local.md', 'a-local.md');
    expect(clearRecoverySnapshotsForDocument).toHaveBeenCalledWith('/tmp/a.md');
    expect(clearRecoverySnapshotsForDocument).toHaveBeenCalledWith('/tmp/a-local.md');
  });

  it('keeps the conflict when save-as is cancelled', async () => {
    openConflictedDocument();
    const requestSavePath = vi.fn().mockResolvedValue(null);

    const result = await saveConflictedDocumentAs(requestSavePath);

    expect(result).toEqual({ resolved: false });
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: '/tmp/a.md',
      content: '# Mine',
      isDirty: true,
      saveStatus: 'conflict',
    });
  });

  it('overwrites the disk version and clears the conflict', async () => {
    openConflictedDocument();
    (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 7, mtime: new Date(5000) });

    const result = await overwriteConflictedDocument();

    expect(writeTextFile).toHaveBeenCalledWith('/tmp/a.md', '# Mine');
    expect(result).toEqual({ resolved: true, path: '/tmp/a.md' });
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: '/tmp/a.md',
      content: '# Mine',
      isDirty: false,
      saveStatus: 'saved',
      saveError: null,
      lastKnownMtime: 5000,
      lastKnownSize: 7,
    });
    expect(addRecentFile).toHaveBeenCalledWith('/tmp/a.md', 'a.md');
    expect(clearRecoverySnapshotsForDocument).toHaveBeenCalledWith('/tmp/a.md');
  });

  it('preserves the conflict state when overwrite fails', async () => {
    openConflictedDocument();
    (writeTextFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('permission denied'));

    await expect(overwriteConflictedDocument()).rejects.toThrow('permission denied');

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: '/tmp/a.md',
      content: '# Mine',
      isDirty: true,
      saveStatus: 'conflict',
      saveError: 'permission denied',
    });
  });
});
