import {
  forwardRef,
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
import { createEditorClipboardController } from '../runtime/editorClipboardController';
import {
  getEditorTypographyStyle,
  getLineNumberExtensions,
  getLineWrappingExtensions,
  shouldUseDarkEditor,
} from '../runtime/editorAppearanceRuntime';
import { HorizontalScrollbar } from './HorizontalScrollbar';
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

    const { handleEditorContextMenuAction } = useEditorCommandEventModel({
      viewRef,
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
