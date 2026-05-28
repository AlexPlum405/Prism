import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { exists as fsExists } from '@tauri-apps/plugin-fs';
import { useAppDocumentInsightModel } from './useAppDocumentInsightModel';
import { useDocumentDiagnosticsModel } from './useDocumentDiagnosticsModel';
import { useDocumentNavigationModel } from './useDocumentNavigationModel';

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
}));

vi.mock('./useDocumentDiagnosticsModel', () => ({
  useDocumentDiagnosticsModel: vi.fn(),
}));

vi.mock('./useDocumentNavigationModel', () => ({
  useDocumentNavigationModel: vi.fn(),
}));

const diagnosticsReturn = {
  actionableDiagnostics: [{ message: 'missing link' }],
  closeDocumentDiagnostics: vi.fn(),
  displayedDiagnostics: [],
  documentDiagnostics: [],
  firstActionableDiagnostic: null,
  firstTypographyDiagnostic: null,
  handleLinkDiagnosticsClick: vi.fn(),
  handleSelectDocumentDiagnostic: vi.fn(),
  handleSelectTypographyDiagnostic: vi.fn(),
  handleTypographyDiagnosticsClick: vi.fn(),
  linkDiagnosticsVisible: false,
  setTypographyDiagnosticsVisible: vi.fn(),
  typographyDiagnostics: [],
  typographyDiagnosticsVisible: false,
} as unknown as ReturnType<typeof useDocumentDiagnosticsModel>;

const navigationReturn = {
  backlinks: [{ path: '/note.md', line: 3 }],
  backlinksVisible: false,
  documentLinks: [],
  documentLinksVisible: false,
  openBacklinks: vi.fn(),
  openDocumentLink: vi.fn(),
  openDocumentLinks: vi.fn(),
  openRelationGraph: vi.fn(),
  relationGraphVisible: false,
  selectBacklink: vi.fn(),
  selectDocumentLink: vi.fn(),
  setBacklinksVisible: vi.fn(),
  setDocumentLinksVisible: vi.fn(),
  setRelationGraphVisible: vi.fn(),
} as unknown as ReturnType<typeof useDocumentNavigationModel>;

function createInput() {
  return {
    currentDocument: null,
    editorRef: {
      current: {
        focus: vi.fn(),
        jumpToLine: vi.fn(),
        scrollToLine: vi.fn(),
        setScrollRatio: vi.fn(),
      },
    },
    fileTree: [],
    handleFileAction: vi.fn(),
    rootPath: '/workspace',
    showToast: vi.fn(),
    workspaceIndex: null,
  } as Parameters<typeof useAppDocumentInsightModel>[0];
}

describe('useAppDocumentInsightModel', () => {
  it('wires diagnostics and navigation through the same editor line jumper', () => {
    vi.mocked(useDocumentDiagnosticsModel).mockReturnValue(diagnosticsReturn);
    vi.mocked(useDocumentNavigationModel).mockReturnValue(navigationReturn);
    const input = createInput();

    const { result } = renderHook(() => useAppDocumentInsightModel(input));

    const diagnosticsInput = vi.mocked(useDocumentDiagnosticsModel).mock.calls[0][0];
    const navigationInput = vi.mocked(useDocumentNavigationModel).mock.calls[0][0];

    expect(diagnosticsInput).toMatchObject({
      currentDocument: input.currentDocument,
      existsPath: fsExists,
      fileTree: input.fileTree,
      rootPath: input.rootPath,
    });
    expect(navigationInput).toMatchObject({
      currentDocument: input.currentDocument,
      fileTree: input.fileTree,
      handleFileAction: input.handleFileAction,
      rootPath: input.rootPath,
      showToast: input.showToast,
      workspaceIndex: input.workspaceIndex,
    });

    diagnosticsInput.jumpToLine(12);
    navigationInput.jumpToLine(18);

    expect(input.editorRef.current?.jumpToLine).toHaveBeenNthCalledWith(1, 12);
    expect(input.editorRef.current?.jumpToLine).toHaveBeenNthCalledWith(2, 18);
    expect(result.current.actionableDiagnostics).toBe(diagnosticsReturn.actionableDiagnostics);
    expect(result.current.backlinks).toBe(navigationReturn.backlinks);
  });
});
