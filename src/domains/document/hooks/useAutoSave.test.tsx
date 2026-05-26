import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { useDocumentStore } from '../store';
import { useAutoSave } from './useAutoSave';
import {
  clearRecoverySnapshotsForDocument,
  createRecoverySnapshot,
} from '../services/recovery';

vi.mock('@tauri-apps/plugin-fs', () => ({
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('../services/recovery', () => ({
  createRecoverySnapshot: vi.fn(),
  clearRecoverySnapshotsForDocument: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useDocumentStore.setState({ currentDocument: null });
  (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 3, mtime: new Date(1000) });
  (createRecoverySnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (clearRecoverySnapshotsForDocument as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoSave', () => {
  it('writes dirty documents and marks them saved on success', async () => {
    (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');

    renderHook(() => useAutoSave(100, true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# B',
      reason: 'autosave',
    });
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/a.md', '# B');
    expect(clearRecoverySnapshotsForDocument).toHaveBeenCalledWith('/tmp/a.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: false,
      saveStatus: 'saved',
      saveError: null,
    });
  });

  it('keeps documents dirty and exposes the error when saving fails', async () => {
    (writeTextFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('disk full'));
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');

    renderHook(() => useAutoSave(100, true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# B',
      reason: 'autosave',
    });
    expect(clearRecoverySnapshotsForDocument).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      saveStatus: 'failed',
      saveError: 'disk full',
    });
  });

  it('keeps writing recovery snapshots when auto-save is disabled', async () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');

    renderHook(() => useAutoSave(100, false));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# B',
      reason: 'autosave',
    });
    expect(stat).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(clearRecoverySnapshotsForDocument).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      saveStatus: 'dirty',
    });
  });

  it('marks a conflict and does not overwrite when the file changed on disk', async () => {
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 9, mtime: new Date(2000) });
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');

    renderHook(() => useAutoSave(100, true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# B',
      reason: 'autosave',
    });
    expect(clearRecoverySnapshotsForDocument).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      saveStatus: 'conflict',
      saveError: '文件已在磁盘上被外部修改，请先重新加载或另存为。',
    });
  });

  it('marks missing files without recreating them during auto-save', async () => {
    (stat as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('failed to open file: No such file or directory (os error 2)'),
    );
    useDocumentStore.getState().openDocument('/tmp/missing.md', 'missing.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');

    renderHook(() => useAutoSave(100, true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/missing.md',
      documentName: 'missing.md',
      content: '# B',
      reason: 'autosave',
    });
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      saveStatus: 'conflict',
      saveIssue: 'missing',
      saveError: '原文件不存在：/tmp/missing.md',
    });
  });

  it('pauses auto-save while a conflict is waiting for user action', async () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');
    useDocumentStore.getState().markSaveConflict('文件已在磁盘上被外部修改，请先重新加载或另存为。', '/tmp/a.md');

    renderHook(() => useAutoSave(100, true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(stat).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      saveStatus: 'conflict',
    });
  });
});
