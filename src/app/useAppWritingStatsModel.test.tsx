import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OpenDocument } from '../domains/document/types';
import { useAppWritingStatsModel } from './useAppWritingStatsModel';

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: '/repo/current.md',
    name: 'current.md',
    content: '# 标题\n\nHello Prism',
    isDirty: false,
    lastSavedAt: 0,
    lastKnownMtime: null,
    lastKnownSize: null,
    saveStatus: 'saved',
    saveError: null,
    viewMode: 'split',
    scrollState: { editorRatio: 0, previewRatio: 0 },
    ...overrides,
  };
}

describe('useAppWritingStatsModel', () => {
  it('computes writing stats from the current document content', () => {
    const { result } = renderHook(() => useAppWritingStatsModel({
      currentDocument: createDocument(),
    }));

    expect(result.current.writingStats.wordCount).toBe(4);
    expect(result.current.writingStats.chineseChars).toBe(2);
    expect(result.current.writingStats.englishWords).toBe(2);
  });

  it('computes selection stats only when selection text is not blank', () => {
    const { result } = renderHook(() => useAppWritingStatsModel({
      currentDocument: createDocument(),
    }));

    expect(result.current.selectionWritingStats).toBeNull();

    act(() => {
      result.current.setSelectionText('选区 text');
    });

    expect(result.current.selectionWritingStats).toMatchObject({
      chineseChars: 2,
      englishWords: 1,
      wordCount: 3,
    });
  });

  it('clears selection stats when switching documents', () => {
    const firstDocument = createDocument({ path: '/repo/first.md' });
    const secondDocument = createDocument({ path: '/repo/second.md' });
    const { rerender, result } = renderHook(
      ({ document }) => useAppWritingStatsModel({ currentDocument: document }),
      { initialProps: { document: firstDocument } },
    );

    act(() => {
      result.current.setSelectionText('selected text');
    });
    expect(result.current.selectionWritingStats?.wordCount).toBe(2);

    rerender({ document: secondDocument });

    expect(result.current.selectionWritingStats).toBeNull();
  });
});
