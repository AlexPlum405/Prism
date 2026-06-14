import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentDiagnosticsModel } from './useDocumentDiagnosticsModel';
import { scanChineseTypography } from '../domains/editor/extensions/typographyDiagnostics';

vi.mock('../domains/editor/extensions/typographyDiagnostics', () => ({
  scanChineseTypography: vi.fn(() => [
    {
      column: 3,
      kind: 'cjk-latin-spacing',
      line: 2,
      message: '中英文之间缺少空格',
      suggestion: '添加空格',
    },
  ]),
}));

function createDocument(content = '# 标题\n\n这是Prism编辑器') {
  return {
    content,
    isDirty: false,
    lastKnownMtime: null,
    lastKnownSize: null,
    lastSavedAt: 0,
    name: 'note.md',
    path: '/workspace/note.md',
    saveError: null,
    saveIssue: null,
    saveStatus: 'saved',
    scrollState: { editorRatio: 0, previewRatio: 0 },
    viewMode: 'edit',
  } as Parameters<typeof useDocumentDiagnosticsModel>[0]['currentDocument'];
}

function renderDiagnosticsModel(content?: string) {
  return renderHook(() => useDocumentDiagnosticsModel({
    currentDocument: createDocument(content),
    existsPath: vi.fn(async () => true),
    fileTree: [],
    jumpToLine: vi.fn(),
    rootPath: '/workspace',
  }));
}

describe('useDocumentDiagnosticsModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not run typography diagnostics during initial document diagnostics render', () => {
    const { result } = renderDiagnosticsModel();

    expect(result.current.typographyDiagnostics).toEqual([]);
    expect(result.current.typographyDiagnosticsVisible).toBe(false);
    expect(scanChineseTypography).not.toHaveBeenCalled();
  });

  it('runs typography diagnostics only after the typography panel is requested', async () => {
    const { result } = renderDiagnosticsModel();

    act(() => {
      result.current.handleTypographyDiagnosticsClick();
    });

    await waitFor(() => {
      expect(result.current.typographyDiagnosticsVisible).toBe(true);
      expect(result.current.typographyDiagnostics).toHaveLength(1);
    });

    expect(scanChineseTypography).toHaveBeenCalledTimes(1);
  });
});
