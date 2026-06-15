import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { EditorView } from '@codemirror/view';

import { useDocumentStore } from '../../document/store';
import { useSettingsStore } from '../../settings/store';
import { useWorkspaceStore } from '../../workspace/store';
import { flattenFiles, getWorkspaceIndexLinkFiles, type WorkspaceIndex } from '../../workspace/services';
import { queryWorkspaceLinkTargetsNativeModel } from '../../workspace/services/workspaceIndexNative';
import type { QueryWorkspaceLinkTargets } from '../extensions/linkCompletion';
import type { SearchAction, SearchParams } from './SearchPanel';
import { ContextMenu } from '../../../components/shell/ContextMenu';
import { getEditorContextMenuItems } from '../extensions/contextMenu';
import { getEditorFormatResult } from '../extensions/formatting';
import {
  execEditorSearch,
  restoreEditorSearch,
} from '../runtime/editorSearchRuntime';
import {
  jumpToEditorLine,
  scrollEditorToLine,
  setEditorScrollRatio,
} from '../runtime/editorScrollRuntime';
import { insertTextAtSelection } from '../runtime/editorClipboardRuntime';
import { createEditorClipboardController } from '../runtime/editorClipboardController';
import {
  getEditorTypographyStyle,
  getLineNumberExtensions,
  getLineWrappingExtensions,
  shouldUseDarkEditor,
} from '../runtime/editorAppearanceRuntime';
import { HorizontalScrollbar } from './HorizontalScrollbar';
import { CalloutPickerPopover } from './CalloutPickerPopover';
import type { CalloutKind } from '../extensions/callouts';
import {
  getCalloutSnippet,
  getSelectionCalloutOperation,
  isEditorCalloutKind,
} from '../extensions/calloutSnippets';
import {
  MIAOYAN_CODE_BLOCK_HIGHLIGHT_LIMIT,
  getMiaoyanCodeHighlightRanges,
  getMiaoyanCodeLanguage,
  shouldHighlightCompatibilityCodeTheme,
} from '../extensions/markdownHighlight';
import { useI18n } from '../../i18n';
import { TableFloatingToolbar } from './TableFloatingToolbar';
import { TableInsertPopover } from './TableInsertPopover';
import { useEditorActionModel } from './useEditorActionModel';
import { useEditorCommandEventModel } from './useEditorCommandEventModel';
import { useEditorRuntimeModel } from './useEditorRuntimeModel';
import { useEditorTableModel } from './useEditorTableModel';
import { openDialog } from '../../../platform/tauri/dialogs';
import { saveImageAssetFromPath } from '../extensions/imagePaste';

export interface EditorPaneHandle {
  focus: () => void;
  jumpToLine: (line: number) => void;
  setScrollRatio: (ratio: number) => void;
  scrollToLine: (line: number) => void;
  execSearch?: (action: SearchAction, params: SearchParams) => void;
  restoreSearch?: (params: SearchParams, currentMatch: number) => void;
  getSelectedText?: () => string;
}

interface EditorPaneProps {
  content: string;
  onChange: (content: string) => void;
  onCursorChange?: (cursor: { line: number; column: number }) => void;
  onSelectionTextChange?: (text: string) => void;
  onNotice?: (message: string) => void;
  onScrollRatioChange?: (ratio: number) => void;
  onTopLineChange?: (line: number) => void;
  onScroll?: () => void;
  workspaceIndex?: WorkspaceIndex | null;
  workspaceIndexJobId?: string | null;
}

function getSelectedText(view: EditorView) {
  const selection = view.state.selection.main;
  if (selection.from === selection.to) return '';
  return view.state.doc.sliceString(selection.from, selection.to);
}

function formatEditorError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function clampSnippetSelectionOffset(value: unknown, length: number, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(length, Math.trunc(value)));
}

function insertSnippetIntoView(
  view: EditorView,
  insert: string,
  selectionStart?: unknown,
  selectionEnd?: unknown,
) {
  const selection = view.state.selection.main;
  const startOffset = clampSnippetSelectionOffset(selectionStart, insert.length, insert.length);
  const endOffset = clampSnippetSelectionOffset(selectionEnd, insert.length, startOffset);
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert },
    selection: {
      anchor: selection.from + startOffset,
      head: selection.from + endOffset,
    },
    scrollIntoView: true,
  });
  view.focus();
}

function getEditorInlinePopoverPosition(view: EditorView, host: HTMLElement | null) {
  const hostRect = host?.getBoundingClientRect();
  const coords = view.coordsAtPos(view.state.selection.main.head);

  if (!hostRect || !coords || hostRect.width <= 0) {
    return { x: 16, y: 48 };
  }

  const width = 276;
  const margin = 12;
  const x = Math.max(margin, Math.min(coords.left - hostRect.left, hostRect.width - width - margin));
  const y = Math.max(margin, coords.bottom - hostRect.top + 8);
  return { x, y };
}

const TOGGLE_BLOCK_SNIPPET = '<details>\n<summary>标题</summary>\n\n内容\n\n</details>\n';
const TOGGLE_BLOCK_TITLE_START = TOGGLE_BLOCK_SNIPPET.indexOf('标题');
const TOGGLE_BLOCK_TITLE_END = TOGGLE_BLOCK_TITLE_START + '标题'.length;

export const __editorPaneTesting = {
  getMiaoyanCodeLanguage,
  getMiaoyanCodeHighlightRanges,
  getEditorFormatResult,
  getEditorTypographyStyle,
  getLineNumberExtensions,
  getLineWrappingExtensions,
  shouldHighlightCompatibilityCodeTheme,
  MIAOYAN_CODE_BLOCK_HIGHLIGHT_LIMIT,
};

export const EditorPane = forwardRef<EditorPaneHandle, EditorPaneProps>(
  function EditorPane(
    {
      content,
      onChange,
      onCursorChange,
      onSelectionTextChange,
      onNotice,
      onScrollRatioChange,
      onTopLineChange,
      onScroll,
      workspaceIndex,
      workspaceIndexJobId,
    },
    ref,
  ) {
    const { locale, t } = useI18n();
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onCursorChangeRef = useRef(onCursorChange);
    const onSelectionTextChangeRef = useRef(onSelectionTextChange);
    const onNoticeRef = useRef(onNotice);
    const onScrollRatioChangeRef = useRef(onScrollRatioChange);
    const onTopLineChangeRef = useRef(onTopLineChange);
    const onScrollRef = useRef(onScroll);
    const contentTheme = useSettingsStore((s) => s.contentTheme);
    const currentDocumentPath = useDocumentStore((s) => s.currentDocument?.path || undefined);
    const workspaceRootPath = useWorkspaceStore((s) => s.rootPath);
    const workspaceFileTree = useWorkspaceStore((s) => s.fileTree);
    const isEditorDark = useSettingsStore((s) => shouldUseDarkEditor(s.contentTheme, s.theme));
    const showLineNumbers = useSettingsStore((s) => s.showLineNumbers);
    const wordWrap = useSettingsStore((s) => s.wordWrap);
    const editorFontSize = useSettingsStore((s) => s.fontSize);
    const editorFontFamily = useSettingsStore((s) => s.editorFontFamily);
    const editorFontSource = useSettingsStore((s) => s.editorFontSource);
    const editorLineHeight = useSettingsStore((s) => s.editorLineHeight);
    const shortcutStyle = useSettingsStore((s) => s.shortcutStyle);
    const typewriterMode = useWorkspaceStore((s) => s.typewriterMode);
    const typewriterModeRef = useRef(typewriterMode);
    const workspaceLinkFiles = useMemo(
      () => workspaceIndex
        ? getWorkspaceIndexLinkFiles(workspaceIndex)
        : flattenFiles(workspaceFileTree, workspaceRootPath).map(({ node }) => ({
            name: node.name,
            path: node.path,
          })),
      [workspaceFileTree, workspaceIndex, workspaceRootPath],
    );
    const queryWorkspaceLinkTargets = useMemo<QueryWorkspaceLinkTargets | undefined>(() => {
      if (!workspaceIndexJobId) return undefined;
      return (input) => queryWorkspaceLinkTargetsNativeModel({
        jobId: workspaceIndexJobId,
        currentPath: input.currentDocumentPath ?? null,
        limit: input.limit,
        mode: input.mode,
        query: input.query,
      });
    }, [workspaceIndexJobId]);
    
    // 关键标记：用于拦截因同步内容触发的 onChange
    const isUpdatingFromPropsRef = useRef(false);

    const [editorContextMenu, setEditorContextMenu] = useState<{
      x: number;
      y: number;
      hasSelection: boolean;
      isInTable: boolean;
    } | null>(null);
    const {
      handleSelectTable,
      handleTableCommand,
      handleTableConvert,
      handleTableCopy,
      handleTableInsert,
      handleTablePasteText,
      setTableInsertVisible,
      tableInsertVisible,
      tableToolbar,
      updateTableToolbar,
    } = useEditorTableModel({ editorRef, viewRef });
    const [calloutPicker, setCalloutPicker] = useState<{
      mode: 'insert' | 'selection';
      x: number;
      y: number;
    } | null>(null);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onCursorChangeRef.current = onCursorChange;
    }, [onCursorChange]);

    useEffect(() => {
      onSelectionTextChangeRef.current = onSelectionTextChange;
    }, [onSelectionTextChange]);

    useEffect(() => {
      onNoticeRef.current = onNotice;
    }, [onNotice]);

    useEffect(() => {
      onScrollRatioChangeRef.current = onScrollRatioChange;
    }, [onScrollRatioChange]);

    useEffect(() => {
      onTopLineChangeRef.current = onTopLineChange;
    }, [onTopLineChange]);

    useEffect(() => {
      onScrollRef.current = onScroll;
    }, [onScroll]);

    useEffect(() => {
      typewriterModeRef.current = typewriterMode;
    }, [typewriterMode]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        const view = viewRef.current;
        if (!view) return;
        view.requestMeasure();
        view.focus();
      },
      jumpToLine: (lineNumber: number) => {
        const view = viewRef.current;
        if (!view) return;
        jumpToEditorLine(view, lineNumber);
      },
      setScrollRatio: (ratio: number) => {
        const view = viewRef.current;
        if (!view) return;
        setEditorScrollRatio(view, ratio);
      },
      scrollToLine: (lineNumber: number) => {
        const view = viewRef.current;
        if (!view) return;
        scrollEditorToLine(view, lineNumber);
      },
      execSearch: (action, params) => {
        const view = viewRef.current;
        if (!view) return;
        execEditorSearch(view, action, params);
      },
      restoreSearch: (params, currentMatch) => {
        const view = viewRef.current;
        if (!view) return;
        restoreEditorSearch(view, params, currentMatch);
      },
      getSelectedText: () => {
        const view = viewRef.current;
        return view ? getSelectedText(view) : '';
      },
    }));

    const {
      handleFoldCurrentHeading,
      handleFormat,
      handleSourceBlockOperation,
      handleTemplateInsert,
    } = useEditorActionModel({ viewRef });

    const showCalloutPicker = useCallback((mode: 'insert' | 'selection') => {
      const view = viewRef.current;
      if (!view) return;
      setCalloutPicker({
        mode,
        ...getEditorInlinePopoverPosition(view, editorRef.current),
      });
    }, []);

    const handleInsertCallout = useCallback((kind: CalloutKind) => {
      const view = viewRef.current;
      if (!view) return false;
      const snippet = getCalloutSnippet(kind);
      insertSnippetIntoView(view, snippet.insert, snippet.selectionStart, snippet.selectionEnd);
      setCalloutPicker(null);
      return true;
    }, []);

    const handleSelectionCallout = useCallback((kind: CalloutKind) => {
      const handled = handleSourceBlockOperation(getSelectionCalloutOperation(kind));
      setCalloutPicker(null);
      return handled;
    }, [handleSourceBlockOperation]);

    const handleCalloutPickerSelect = useCallback((kind: CalloutKind) => {
      if (calloutPicker?.mode === 'selection') {
        handleSelectionCallout(kind);
      } else {
        handleInsertCallout(kind);
      }
    }, [calloutPicker?.mode, handleInsertCallout, handleSelectionCallout]);

    const handleInsertImage = useCallback(async () => {
      const view = viewRef.current;
      if (!view) return false;

      const currentDocument = useDocumentStore.getState().currentDocument;
      if (!currentDocument?.path) {
        onNoticeRef.current?.(t('editor.image.saveBeforeInsert'));
        return true;
      }

      try {
        const selected = await openDialog({
          directory: false,
          multiple: false,
          filters: [{
            name: t('editor.image.dialogFilter'),
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
          }],
        });
        const sourcePath = Array.isArray(selected) ? selected[0] : selected;
        if (typeof sourcePath !== 'string' || !sourcePath) return true;

        const markdownImage = await saveImageAssetFromPath({
          documentName: currentDocument.name,
          documentPath: currentDocument.path,
          sourcePath,
        });
        insertTextAtSelection(view, markdownImage);
      } catch (error) {
        onNoticeRef.current?.(t('editor.image.insertFailed', { message: formatEditorError(error) }));
      }
      return true;
    }, [t]);

    const imageClipboardMessages = useMemo(() => ({
      clipboardUnreadable: t('editor.image.clipboardUnreadable'),
      saveBeforePaste: t('editor.image.saveBeforePaste'),
      nativePathUnavailable: t('editor.image.nativePathUnavailable'),
      saveBeforeDrop: t('editor.image.saveBeforeDrop'),
      pasteFailed: (message: string) => t('editor.image.pasteFailed', { message }),
      dropFailed: (message: string) => t('editor.image.dropFailed', { message }),
    }), [t]);

    const clipboardController = useMemo(() => createEditorClipboardController({
      handleTablePasteText,
      imageDeps: {
        getCurrentDocument: () => useDocumentStore.getState().currentDocument,
        messages: imageClipboardMessages,
        notice: (message) => onNoticeRef.current?.(message),
        formatError: formatEditorError,
      },
    }), [handleTablePasteText, imageClipboardMessages]);

    const handleCustomEditorCommand = useCallback((
      command: string,
      detail: Record<string, unknown>,
      view: EditorView,
    ) => {
      switch (command) {
        case 'insertImage':
          void handleInsertImage();
          return true;
        case 'insertCallout':
          if (isEditorCalloutKind(detail.kind)) {
            handleInsertCallout(detail.kind);
          } else {
            showCalloutPicker('insert');
          }
          return true;
        case 'selectionCallout':
          if (isEditorCalloutKind(detail.kind)) {
            handleSelectionCallout(detail.kind);
          } else {
            showCalloutPicker('selection');
          }
          return true;
        case 'insertToggle':
          insertSnippetIntoView(
            view,
            TOGGLE_BLOCK_SNIPPET,
            TOGGLE_BLOCK_TITLE_START,
            TOGGLE_BLOCK_TITLE_END,
          );
          return true;
        case 'insertSnippet': {
          const insert = typeof detail.insert === 'string' ? detail.insert : '';
          if (!insert) return false;
          insertSnippetIntoView(view, insert, detail.selectionStart, detail.selectionEnd);
          return true;
        }
        default:
          return false;
      }
    }, [
      handleInsertCallout,
      handleInsertImage,
      handleSelectionCallout,
      showCalloutPicker,
    ]);

    const { handleEditorContextMenuAction } = useEditorCommandEventModel({
      viewRef,
      handleCustomEditorCommand,
      handleFoldCurrentHeading,
      handleFormat,
      handleSelectTable,
      handleSourceBlockOperation,
      handleTableCommand,
      handleTableConvert,
      handleTableCopy,
      handleTablePasteText,
      handleTemplateInsert,
      setTableInsertVisible,
    });

    const { getEditorScroller } = useEditorRuntimeModel({
      clipboardController,
      content,
      contentTheme,
      currentDocumentPath,
      editorFontFamily,
      editorFontSize,
      editorLineHeight,
      editorRef,
      editorUsesThemeFont: editorFontSource.kind === 'theme',
      isEditorDark,
      isUpdatingFromPropsRef,
      locale,
      onChangeRef,
      onCursorChangeRef,
      onEditorContextMenu: setEditorContextMenu,
      onScrollRatioChangeRef,
      onScrollRef,
      onSelectionTextChangeRef,
      onTopLineChangeRef,
      queryWorkspaceLinkTargets,
      showLineNumbers,
      t,
      typewriterModeRef,
      updateTableToolbar,
      viewRef,
      wordWrap,
      workspaceLinkFiles,
      workspaceRootPath,
    });

    return (
      <div
        className="prism-scrollbar-host"
        style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
      >
        <div
          ref={editorRef}
          style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        />
        <TableInsertPopover
          visible={tableInsertVisible}
          onClose={() => setTableInsertVisible(false)}
          onInsert={handleTableInsert}
        />
        <CalloutPickerPopover
          visible={Boolean(calloutPicker)}
          mode={calloutPicker?.mode ?? 'insert'}
          x={calloutPicker?.x ?? 16}
          y={calloutPicker?.y ?? 48}
          onClose={() => setCalloutPicker(null)}
          onSelect={handleCalloutPickerSelect}
        />
        <TableFloatingToolbar
          visible={tableToolbar.visible}
          x={tableToolbar.x}
          y={tableToolbar.y}
          onCommand={handleTableCommand}
          onCopy={handleTableCopy}
          onSelectTable={handleSelectTable}
          onConvert={handleTableConvert}
        />
        <HorizontalScrollbar getScroller={getEditorScroller} />
        {editorContextMenu && (
          <ContextMenu
            x={editorContextMenu.x}
            y={editorContextMenu.y}
            items={getEditorContextMenuItems(
              editorContextMenu.hasSelection,
              shortcutStyle,
              editorContextMenu.isInTable,
            )}
            onAction={handleEditorContextMenuAction}
            onClose={() => setEditorContextMenu(null)}
          />
        )}
      </div>
    );
  },
);
