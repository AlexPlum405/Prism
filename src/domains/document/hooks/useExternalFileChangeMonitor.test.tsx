import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readTextFile, stat } from '@tauri-apps/plugin-fs';
import { useDocumentStore } from '../store';
import { useExternalFileChangeMonitor } from './useExternalFileChangeMonitor';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useDocumentStore.setState({ currentDocument: null });
  (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 3, mtime: new Date(1000) });
  (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# Disk');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useExternalFileChangeMonitor', () => {
  it('marks dirty documents as conflicted when the app regains focus after disk changes', async () => {
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 9, mtime: new Date(2000) });
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');

    renderHook(() => useExternalFileChangeMonitor(1000, true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(stat).toHaveBeenCalledWith('/tmp/a.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      saveStatus: 'conflict',
      saveError: '文件已在磁盘上被外部修改，请先重新加载或另存为。',
    });
  });

  it('checks dirty documents on the low-frequency timer', async () => {
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 9, mtime: new Date(2000) });
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');

    renderHook(() => useExternalFileChangeMonitor(100, true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(stat).toHaveBeenCalledWith('/tmp/a.md');
    expect(useDocumentStore.getState().currentDocument?.saveStatus).toBe('conflict');
  });

  it('checks clean documents but leaves unchanged content alone', async () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });

    renderHook(() => useExternalFileChangeMonitor(100, true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(stat).toHaveBeenCalledWith('/tmp/a.md');
    expect(readTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# A',
      isDirty: false,
      saveStatus: 'saved',
    });
  });

  it('reloads a clean document when the disk version changes', async () => {
    (stat as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ size: 9, mtime: new Date(2000) })
      .mockResolvedValueOnce({ size: 9, mtime: new Date(2000) });
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# Disk B');
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });

    renderHook(() => useExternalFileChangeMonitor(100, true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stat).toHaveBeenCalledWith('/tmp/a.md');
    expect(readTextFile).toHaveBeenCalledWith('/tmp/a.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Disk B',
      isDirty: false,
      lastKnownMtime: 2000,
      lastKnownSize: 9,
      saveStatus: 'saved',
    });
  });

  it('does not overwrite a document that becomes dirty before clean reload finishes', async () => {
    let resolveRead!: (content: string) => void;
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 9, mtime: new Date(2000) });
    (readTextFile as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve;
    }));
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });

    renderHook(() => useExternalFileChangeMonitor(100, true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    useDocumentStore.getState().updateContent('# Local edit');

    await act(async () => {
      resolveRead('# Disk B');
      await Promise.resolve();
    });

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Local edit',
      isDirty: true,
      saveStatus: 'dirty',
    });
  });

  it('does not apply a clean reload after the active document changes', async () => {
    let resolveRead!: (content: string) => void;
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 9, mtime: new Date(2000) });
    (readTextFile as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve;
    }));
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });

    renderHook(() => useExternalFileChangeMonitor(100, true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    useDocumentStore.getState().openDocument('/tmp/b.md', 'b.md', '# B', { size: 4, mtimeMs: 1000 });

    await act(async () => {
      resolveRead('# Disk A2');
      await Promise.resolve();
    });

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# B',
      path: '/tmp/b.md',
      saveStatus: 'saved',
    });
  });

  it('does not re-check documents that are already conflicted', async () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });
    useDocumentStore.getState().updateContent('# B');
    useDocumentStore.getState().markSaveConflict('文件已在磁盘上被外部修改，请先重新加载或另存为。', '/tmp/a.md');

    renderHook(() => useExternalFileChangeMonitor(100, true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(stat).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument?.saveStatus).toBe('conflict');
  });
});
