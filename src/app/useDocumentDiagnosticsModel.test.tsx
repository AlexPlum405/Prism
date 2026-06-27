import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentDiagnosticsModel } from './useDocumentDiagnosticsModel';
import { scanChineseTypography } from '../domains/editor/extensions/typographyDiagnostics';
import { MARKDOWN_DOCUMENT_PROFILE, TEXT_DOCUMENT_PROFILE } from '../domains/workspace/services';
import type { FileNode } from '../domains/workspace/types';
import type { OpenDocument } from '../domains/document/types';

const EMPTY_FILE_TREE: FileNode[] = [];

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

vi.mock('../domains/export/preflight', () => ({
  scanMarkdownRenderDiagnostics: vi.fn(async () => []),
}));

function createDocument(content = '# 标题\n\n这是Prism编辑器'): OpenDocument {
  return {
    content,
    isDirty: false,
    lastKnownMtime: null,
    lastKnownSize: null,
    lastSavedAt: 0,
    name: 'note.md',
    path: '/workspace/note.md',
    profile: MARKDOWN_DOCUMENT_PROFILE,
    saveError: null,
    saveIssue: null,
    saveStatus: 'saved',
    scrollState: { editorRatio: 0, previewRatio: 0 },
    viewMode: 'edit',
  };
}

function renderDiagnosticsModel(content?: string) {
  const currentDocument = createDocument(content);
  const existsPath = vi.fn(async () => true);
  return renderHook(() => useDocumentDiagnosticsModel({
    currentDocument,
    existsPath,
    fileTree: EMPTY_FILE_TREE,
    jumpToLine: vi.fn(),
    rootPath: '/workspace',
  }));
}

describe('useDocumentDiagnosticsModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not run typography diagnostics during initial document diagnostics render', async () => {
    const { result } = renderDiagnosticsModel();

    await act(async () => {
      await Promise.resolve();
    });

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

  it('does not run Markdown diagnostics for text documents', async () => {
    const currentDocument = {
      ...createDocument('select * from notes where body like "[[Current]]";'),
      name: 'query.sql',
      path: '/workspace/query.sql',
      profile: TEXT_DOCUMENT_PROFILE,
    };
    const existsPath = vi.fn(async () => true);
    const { result } = renderHook(() => useDocumentDiagnosticsModel({
      currentDocument,
      existsPath,
      fileTree: EMPTY_FILE_TREE,
      jumpToLine: vi.fn(),
      rootPath: '/workspace',
    }));

    act(() => {
      result.current.handleLinkDiagnosticsClick();
      result.current.handleTypographyDiagnosticsClick();
    });

    await waitFor(() => {
      expect(result.current.documentDiagnostics).toEqual([]);
      expect(result.current.typographyDiagnosticsVisible).toBe(false);
    });
    expect(scanChineseTypography).not.toHaveBeenCalled();
  });

  it('opens the document diagnostics panel for table-only errors from the status bar action', async () => {
    const { result } = renderDiagnosticsModel([
      '| A | B |',
      '| 1 | 2 |',
    ].join('\n'));

    await waitFor(() => {
      expect(result.current.actionableDiagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'table',
          message: '表格缺少分隔行',
        }),
      ]));
    });

    act(() => {
      result.current.handleLinkDiagnosticsClick();
    });

    expect(result.current.linkDiagnosticsVisible).toBe(true);
    expect(result.current.displayedDiagnostics).toEqual(result.current.actionableDiagnostics);
  });
});
