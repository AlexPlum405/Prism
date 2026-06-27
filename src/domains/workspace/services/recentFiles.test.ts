import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecentFileEntry } from '../../settings/types';
import { addRecentFile, clearRecentFiles, getRecentFiles } from './recentFiles';

const settings = vi.hoisted(() => ({
  recentFiles: [] as RecentFileEntry[],
  addRecentFile: vi.fn(),
  clearRecentFiles: vi.fn(),
}));

vi.mock('../../settings/store', () => ({
  useSettingsStore: {
    getState: () => settings,
  },
}));

const RECENT_FILES_KEY = 'prism_recent_files';
let storage: Map<string, string>;

function installLocalStorageMock() {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  });
}

function storedRecentFiles() {
  return JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? '[]') as RecentFileEntry[];
}

describe('recent file service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorageMock();
    settings.recentFiles = [];
    vi.useRealTimers();
  });

  it('prefers normalized recent files from settings over legacy localStorage', () => {
    settings.recentFiles = [{
      path: '/notes/from-settings.md',
      name: 'from-settings.md',
      lastOpened: 20,
    }];
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify([{
      path: '/notes/from-storage.md',
      name: 'from-storage.md',
      lastOpened: 10,
    }]));

    expect(getRecentFiles()).toEqual(settings.recentFiles);
  });

  it('falls back to legacy localStorage when settings has not loaded recent files', () => {
    const legacyRecentFiles = [{
      path: '/notes/legacy.md',
      name: 'legacy.md',
      lastOpened: 10,
    }];
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(legacyRecentFiles));

    expect(getRecentFiles()).toEqual(legacyRecentFiles);
  });

  it('adds the opened file first, removes path duplicates, and keeps only ten stored entries', () => {
    vi.setSystemTime(new Date('2026-06-27T08:00:00.000Z'));
    settings.recentFiles = Array.from({ length: 11 }, (_, index) => ({
      path: index === 3 ? '/notes/current.md' : `/notes/file-${index}.md`,
      name: index === 3 ? 'current.md' : `file-${index}.md`,
      lastOpened: 100 - index,
    }));

    addRecentFile('/notes/current.md', 'current.md');

    expect(settings.addRecentFile).toHaveBeenCalledWith('/notes/current.md', 'current.md');
    expect(storedRecentFiles()).toEqual([
      {
        path: '/notes/current.md',
        name: 'current.md',
        lastOpened: Date.parse('2026-06-27T08:00:00.000Z'),
      },
      ...settings.recentFiles
        .filter((file) => file.path !== '/notes/current.md')
        .slice(0, 9),
    ]);
  });

  it('clears settings and removes the legacy localStorage cache', () => {
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify([{
      path: '/notes/legacy.md',
      name: 'legacy.md',
      lastOpened: 10,
    }]));

    clearRecentFiles();

    expect(settings.clearRecentFiles).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(RECENT_FILES_KEY)).toBeNull();
  });
});
