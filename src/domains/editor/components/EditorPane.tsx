import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditorView, ViewUpdate, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { Compartment, EditorState, Prec } from '@codemirror/state';

import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { history, historyKeymap, defaultKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldGutter, foldKeymap, foldable, foldEffect } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { search } from '@codemirror/search';
import { useDocumentStore } from '../../document/store';
import { useSettingsStore } from '../../settings/store';
import type { ContentTheme } from '../../settings/types';
import { useWorkspaceStore } from '../../workspace/store';
import { flattenFiles, getWorkspaceIndexLinkFiles, type WorkspaceIndex } from '../../workspace/services';
import type { SearchAction, SearchParams } from './SearchPanel';
import { ContextMenu } from '../../../components/shell/ContextMenu';
import { isCommandId } from '../../commands';
import { getEditorContextMenuItems } from '../extensions/contextMenu';
import { getEditorFormatResult, type EditorFormat } from '../extensions/formatting';
import {
  getSourceBlockOperationEdit,
  isSourceBlockOperation,
  type SourceBlockOperation,
} from '../extensions/blockOperations';
import {
  applyBlockFormatCommand,
  applyHeadingLevel,
} from '../runtime/editorBlockCommands';
import {
  applyMarkdownTableEdit,
  EDITOR_TABLE_COMMANDS,
  runMarkdownTableNavigation,
} from '../runtime/editorTableRuntime';
import {
  execEditorSearch,
  restoreEditorSearch,
} from '../runtime/editorSearchRuntime';
import {
  jumpToEditorLine,
  scrollEditorToLine,
  setEditorScrollRatio,
} from '../runtime/editorScrollRuntime';
import {
  handleEditorClipboardImagePaste,
  handleEditorImageDrop,
} from '../runtime/editorClipboardRuntime';
import { createMarkdownLinkCompletionSource } from '../extensions/linkCompletion';
import { createSlashMenuCompletionSource } from '../extensions/slashMenu';
import { HorizontalScrollbar } from './HorizontalScrollbar';
import { markdownListKeymap } from '../extensions/markdownLists';
import {
  findMarkdownTableBlock,
  getHtmlTableToMarkdownEdit,
  getMarkdownTableCommandEdit,
  getMarkdownTablePasteEdit,
  getMarkdownTableSelection,
  getMarkdownTableSerialization,
  getMarkdownTableToHtmlEdit,
  type MarkdownTableCommand,
  type MarkdownTableInsertOptions,
} from '../extensions/tables';
import { markdownSelectionToRichClipboardInput, writeRichClipboard } from '../extensions/richCopy';
import {
  getMarkdownTemplateInsertEdit,
  isMarkdownTemplateId,
} from '../extensions/templates';
import {
  MIAOYAN_CODE_BLOCK_HIGHLIGHT_LIMIT,
  compatibilityMarkdownPlugin,
  contentThemeFacet,
  getMiaoyanCodeHighlightRanges,
  getMiaoyanCodeLanguage,
  shouldHighlightCompatibilityCodeTheme,
} from '../extensions/markdownHighlight';
import { createHiddenSearchPanel } from '../extensions/search';
import { editorSelectionPlugin, lineFlashField } from '../extensions/selection';
import { scrollPrimarySelectionToCenter } from '../extensions/typewriter';
import { useI18n } from '../../i18n';
import { TableFloatingToolbar } from './TableFloatingToolbar';
import { TableInsertPopover } from './TableInsertPopover';
import { emitAppEvent, onAppEvent } from '../../../platform/events/appEvents';

const editorLineNumbersCompartment = new Compartment();
const editorLineWrappingCompartment = new Compartment();
const editorDarkThemeCompartment = new Compartment();
const editorContentThemeCompartment = new Compartment();
const editorTypographyCompartment = new Compartment();
const editorLinkCompletionCompartment = new Compartment();
const editorPhrasesCompartment = new Compartment();
const editorDarkThemeExtension = [
  oneDark,
  EditorView.theme(
    {
      '.cm-content': { color: '#E2E8F0' },
      '.cm-gutters': { borderRight: '1px solid var(--stroke-surface)' },
    },
    { dark: true },
  ),
];

const DARK_CONTENT_THEMES = new Set(['nocturne']);
const LIGHT_CONTENT_THEMES = new Set(['miaoyan', 'inkstone', 'slate', 'mono']);

function shouldUseDarkEditor(contentTheme: string, theme: string) {
  return DARK_CONTENT_THEMES.has(contentTheme)
    ? true
    : LIGHT_CONTENT_THEMES.has(contentTheme)
      ? false
      : theme === 'dark';
}

function getLineNumberExtensions(showLineNumbers: boolean) {
  return showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [];
}

function getLineWrappingExtensions(wordWrap: boolean) {
  return wordWrap ? [EditorView.lineWrapping] : [];
}

function getDarkThemeExtensions(isEditorDark: boolean) {
  return isEditorDark ? editorDarkThemeExtension : [];
}

function getContentThemeExtension(contentTheme: ContentTheme) {
  return contentThemeFacet.of(contentTheme);
}

function getEditorTypographyStyle(
  fontSize: number,
  lineHeight: number,
  fontFamily: string,
  useThemeFont = false,
) {
  const lineHeightPx = Math.round(fontSize * lineHeight * 100) / 100;
  const variables: Record<string, string> = {
    '--prism-editor-font-size': `${fontSize}px`,
    '--prism-editor-line-height': `${lineHeightPx}px`,
  };
  if (!useThemeFont) {
    variables['--prism-editor-font-family'] = fontFamily;
  }

  return {
    fontFamily: useThemeFont ? undefined : fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeightPx}px`,
    variables,
  };
}

function getTypographyExtension(fontSize: number, lineHeight: number, fontFamily: string, useThemeFont: boolean) {
  const typography = getEditorTypographyStyle(fontSize, lineHeight, fontFamily, useThemeFont);
  const rootStyle: Record<string, string> = {
    ...typography.variables,
    fontSize: typography.fontSize,
  };
  const scrollerStyle: Record<string, string> = {
    lineHeight: typography.lineHeight,
  };
  if (typography.fontFamily) {
    rootStyle.fontFamily = typography.fontFamily;
    scrollerStyle.fontFamily = typography.fontFamily;
  }

  return EditorView.theme({
    '&': rootStyle,
    '.cm-scroller': scrollerStyle,
    '.cm-line': {
      lineHeight: typography.lineHeight,
    },
  });
}

function getLinkCompletionExtension(input: {
  currentDocumentPath?: string;
  workspaceFiles: Array<{ name: string; path: string }>;
  workspaceRootPath?: string | null;
}) {
  return autocompletion({
    activateOnTyping: true,
    override: [
      createSlashMenuCompletionSource(),
      createMarkdownLinkCompletionSource(() => input),
    ],
  });
}

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

function getCursorPosition(view: EditorView) {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return {
    line: line.number,
    column: pos - line.from + 1,
  };
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

function getEditorPhrases(t: ReturnType<typeof useI18n>['t']) {
  return {
    Find: t('editor.cm.find'),
    Replace: t('editor.cm.replaceWith'),
    next: t('editor.search.next'),
    previous: t('editor.search.previous'),
    all: t('editor.search.replaceAll'),
    'match case': t('editor.cm.matchCase'),
    regexp: t('editor.cm.regexp'),
    'by word': t('editor.cm.wholeWord'),
    replace: t('editor.search.replace'),
    'replace all': t('editor.search.replaceAll'),
  };
}

function getCurrentHeadingFoldRange(view: EditorView) {
  let line = view.state.doc.lineAt(view.state.selection.main.head);

  while (line.number >= 1) {
    if (/^#{1,6}\s+\S/.test(line.text)) {
      return foldable(view.state, line.from, line.to);
    }
    if (line.number === 1) break;
    line = view.state.doc.line(line.number - 1);
  }

  return null;
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
    const [tableInsertVisible, setTableInsertVisible] = useState(false);
    const [tableToolbar, setTableToolbar] = useState<{
      visible: boolean;
      x: number;
      y: number;
    }>({ visible: false, x: 16, y: 16 });

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

    const handleFormat = useCallback(
      (format: EditorFormat) => {
        const view = viewRef.current;
        if (!view) return;

        const selection = view.state.selection.main;
        const result = getEditorFormatResult(
          view.state.doc.toString(),
          selection.from,
          selection.to,
          format,
        );

        view.dispatch({
          changes: {
            from: result.from,
            to: result.to,
            insert: result.insert,
          },
          selection: { anchor: result.selectionFrom, head: result.selectionTo },
        });

        view.focus();
      },
      [],
    );

    const handleEditorContextMenuAction = useCallback(async (action: string) => {
      const view = viewRef.current;
      if (!view) return;

      if (isCommandId(action)) {
        emitAppEvent('command.run', { action });
      }

      view.focus();
    }, []);

    const updateTableToolbar = useCallback((view: EditorView) => {
      const selection = view.state.selection.main;
      if (selection.from !== selection.to) {
        setTableToolbar((current) => current.visible ? { ...current, visible: false } : current);
        return;
      }

      const block = findMarkdownTableBlock(view.state.doc.toString(), selection.head);
      if (!block) {
        setTableToolbar((current) => current.visible ? { ...current, visible: false } : current);
        return;
      }

      const hostRect = editorRef.current?.getBoundingClientRect();
      const coords = view.coordsAtPos(selection.head) ?? view.coordsAtPos(block.from);
      if (!hostRect || !coords) {
        setTableToolbar({ visible: true, x: 16, y: 16 });
        return;
      }

      const toolbarWidth = 560;
      const x = Math.max(12, Math.min(coords.left - hostRect.left - 12, hostRect.width - toolbarWidth - 12));
      const y = Math.max(12, coords.top - hostRect.top - 44);
      setTableToolbar({ visible: true, x, y });
    }, []);

    const handleTableCommand = useCallback((command: MarkdownTableCommand, options?: MarkdownTableInsertOptions) => {
      const view = viewRef.current;
      if (!view) return false;

      const selection = view.state.selection.main;
      const result = getMarkdownTableCommandEdit(
        view.state.doc.toString(),
        selection.from,
        selection.to,
        command,
        options,
      );
      if (!result) return false;

      applyMarkdownTableEdit(view, result);
      updateTableToolbar(view);
      return true;
    }, [updateTableToolbar]);

    const handleTableInsert = useCallback((options: MarkdownTableInsertOptions) => {
      setTableInsertVisible(false);
      handleTableCommand('insert', options);
    }, [handleTableCommand]);

    const handleSelectTable = useCallback(() => {
      const view = viewRef.current;
      if (!view) return false;
      const selection = getMarkdownTableSelection(view.state.doc.toString(), view.state.selection.main.head);
      if (!selection) return false;
      view.dispatch({
        selection: { anchor: selection.from, head: selection.to },
        scrollIntoView: true,
      });
      view.focus();
      setTableToolbar((current) => ({ ...current, visible: false }));
      return true;
    }, []);

    const handleTableCopy = useCallback(async (format: 'markdown' | 'html' | 'csv' | 'tsv') => {
      const view = viewRef.current;
      if (!view) return false;
      const serialization = getMarkdownTableSerialization(view.state.doc.toString(), view.state.selection.main.head);
      if (!serialization) return false;

      if (format === 'html') {
        await writeRichClipboard({
          html: serialization.html,
          text: serialization.markdown,
        });
        return true;
      }

      await navigator.clipboard.writeText(serialization[format]);
      return true;
    }, []);

    const handleTableConvert = useCallback((target: 'html' | 'markdown') => {
      const view = viewRef.current;
      if (!view) return false;
      const cursor = view.state.selection.main.head;
      const result = target === 'html'
        ? getMarkdownTableToHtmlEdit(view.state.doc.toString(), cursor)
        : getHtmlTableToMarkdownEdit(view.state.doc.toString(), cursor);
      if (!result) return false;
      applyMarkdownTableEdit(view, result);
      updateTableToolbar(view);
      return true;
    }, [updateTableToolbar]);

    const handleTablePasteText = useCallback((view: EditorView, text: string) => {
      const selection = view.state.selection.main;
      const result = getMarkdownTablePasteEdit(
        view.state.doc.toString(),
        selection.from,
        selection.to,
        text,
      );
      if (!result) return false;
      applyMarkdownTableEdit(view, result);
      updateTableToolbar(view);
      return true;
    }, [updateTableToolbar]);

    const handleTemplateInsert = useCallback((templateId: unknown) => {
      const view = viewRef.current;
      if (!view || !isMarkdownTemplateId(templateId)) return false;

      const selection = view.state.selection.main;
      const result = getMarkdownTemplateInsertEdit(
        view.state.doc.toString(),
        selection.from,
        selection.to,
        templateId,
      );

      view.dispatch({
        changes: {
          from: result.from,
          to: result.to,
          insert: result.insert,
        },
        selection: { anchor: result.selectionFrom, head: result.selectionTo },
        scrollIntoView: true,
      });
      view.focus();
      return true;
    }, []);

    const handleSourceBlockOperation = useCallback((operation: SourceBlockOperation) => {
      const view = viewRef.current;
      if (!view) return false;

      const selection = view.state.selection.main;
      const result = getSourceBlockOperationEdit(
        view.state.doc.toString(),
        selection.from,
        selection.to,
        operation,
      );
      if (!result) return false;

      view.dispatch({
        changes: {
          from: result.from,
          to: result.to,
          insert: result.insert,
        },
        selection: { anchor: result.selectionFrom, head: result.selectionTo },
        scrollIntoView: true,
      });
      view.focus();
      return true;
    }, []);

    const handleFoldCurrentHeading = useCallback(() => {
      const view = viewRef.current;
      if (!view) return false;

      const range = getCurrentHeadingFoldRange(view);
      if (!range) return false;

      view.dispatch({ effects: foldEffect.of(range), scrollIntoView: true });
      view.focus();
      return true;
    }, []);

    const imageClipboardMessages = useMemo(() => ({
      clipboardUnreadable: t('editor.image.clipboardUnreadable'),
      saveBeforePaste: t('editor.image.saveBeforePaste'),
      nativePathUnavailable: t('editor.image.nativePathUnavailable'),
      saveBeforeDrop: t('editor.image.saveBeforeDrop'),
      pasteFailed: (message: string) => t('editor.image.pasteFailed', { message }),
      dropFailed: (message: string) => t('editor.image.dropFailed', { message }),
    }), [t]);

    const handleClipboardImagePaste = useCallback(
      (event: ClipboardEvent, view: EditorView) => handleEditorClipboardImagePaste(event, view, {
        getCurrentDocument: () => useDocumentStore.getState().currentDocument,
        messages: imageClipboardMessages,
        notice: (message) => onNoticeRef.current?.(message),
        formatError: formatEditorError,
      }),
      [imageClipboardMessages],
    );

    const handleImageDrop = useCallback(
      (event: DragEvent, view: EditorView) => handleEditorImageDrop(event, view, {
        getCurrentDocument: () => useDocumentStore.getState().currentDocument,
        messages: imageClipboardMessages,
        notice: (message) => onNoticeRef.current?.(message),
        formatError: formatEditorError,
      }),
      [imageClipboardMessages],
    );

    // 监听菜单格式化事件
    useEffect(() => {
      const onFormat = (detail: { format?: string } | null | undefined) => {
        if (detail?.format) handleFormat(detail.format as EditorFormat);
      };
      const onHeading = (detail: { level?: string } | null | undefined) => {
        const view = viewRef.current;
        if (!view) return;
        const levelValue = typeof detail?.level === 'string' ? detail.level : '';
        applyHeadingLevel(view, levelValue);
      };
      const onBlock = (detail: { format?: string } | null | undefined) => {
        const view = viewRef.current;
        if (!view) return;
        const fmt = typeof detail?.format === 'string' ? detail.format : '';
        applyBlockFormatCommand(view, fmt, handleSourceBlockOperation);
      };

      const onEditorCommand = (detail: ({ command?: string } & Record<string, unknown>) | null | undefined) => {
        const view = viewRef.current;
        if (!view) return;
        const command = typeof detail?.command === 'string' ? detail.command : '';
        if (!command) return;

        if (isSourceBlockOperation(command)) {
          handleSourceBlockOperation(command);
          return;
        }

        const tableCommand = EDITOR_TABLE_COMMANDS[command];
        if (tableCommand) {
          handleTableCommand(tableCommand);
          return;
        }

        switch (command) {
          case 'undo':
            undo(view);
            break;
          case 'redo':
            redo(view);
            break;
          case 'cut':
            document.execCommand('cut');
            break;
          case 'copy':
          case 'copyMd':
          case 'copyPlain': {
            const sel = view.state.selection.main;
            const text = view.state.doc.sliceString(sel.from, sel.to);
            if (text) navigator.clipboard.writeText(text);
            break;
          }
          case 'copyHtml': {
            const sel2 = view.state.selection.main;
            const text2 = view.state.doc.sliceString(sel2.from, sel2.to);
            if (text2) void writeRichClipboard(markdownSelectionToRichClipboardInput(text2));
            break;
          }
          case 'selectAll':
            view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
            break;
          case 'paste':
          case 'pastePlain':
            navigator.clipboard.readText().then(text => {
              if (handleTablePasteText(view, text)) return;
              view.dispatch({
                changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: text },
              });
            });
            break;
          case 'clearFormat': {
            const sel3 = view.state.selection.main;
            const raw = view.state.doc.sliceString(sel3.from, sel3.to);
            const cleaned = raw.replace(/[*_~`<>[\]()#]/g, '');
            view.dispatch({ changes: { from: sel3.from, to: sel3.to, insert: cleaned } });
            break;
          }
          case 'insertTable':
            if (detail?.options && typeof detail.options === 'object') {
              handleTableCommand('insert', detail.options as MarkdownTableInsertOptions);
            } else {
              setTableInsertVisible(true);
            }
            break;
          case 'selectTable':
            handleSelectTable();
            break;
          case 'copyTableMarkdown':
            void handleTableCopy('markdown');
            break;
          case 'copyTableHtml':
            void handleTableCopy('html');
            break;
          case 'copyTableCsv':
            void handleTableCopy('csv');
            break;
          case 'copyTableTsv':
            void handleTableCopy('tsv');
            break;
          case 'convertTableToHtml':
            handleTableConvert('html');
            break;
          case 'convertHtmlTableToMarkdown':
            handleTableConvert('markdown');
            break;
          case 'insertTemplate':
            handleTemplateInsert(detail?.templateId);
            break;
          case 'foldCurrentHeading':
            handleFoldCurrentHeading();
            break;
          case 'comment': {
            const sel4 = view.state.selection.main;
            const raw2 = view.state.doc.sliceString(sel4.from, sel4.to);
            view.dispatch({ changes: { from: sel4.from, to: sel4.to, insert: `<!-- ${raw2} -->` } });
            break;
          }
        }
      };

      const unsubscribeFormat = onAppEvent('editor.format', onFormat);
      const unsubscribeHeading = onAppEvent('editor.heading', onHeading);
      const unsubscribeBlock = onAppEvent('editor.blockFormat', onBlock);
      const unsubscribeEditorCommand = onAppEvent('editor.command', onEditorCommand);

      return () => {
        unsubscribeFormat();
        unsubscribeHeading();
        unsubscribeBlock();
        unsubscribeEditorCommand();
      };
    }, [
      handleFoldCurrentHeading,
      handleFormat,
      handleSelectTable,
      handleSourceBlockOperation,
      handleTableCommand,
      handleTableConvert,
      handleTableCopy,
      handleTablePasteText,
      handleTemplateInsert,
    ]);

    // 处理来自 Props 的内容同步（非重挂载情况）
    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const currentContent = view.state.doc.toString();
      if (currentContent !== content) {
        isUpdatingFromPropsRef.current = true;
        view.dispatch({
          changes: { from: 0, to: currentContent.length, insert: content }
        });
      }
    }, [content]);

    useEffect(() => {
      if (!editorRef.current) return;

      const startState = EditorState.create({
        doc: content,
        extensions: [
          Prec.highest(keymap.of([
            {
              key: 'Tab',
              run: (view) => runMarkdownTableNavigation(view, 'nextCell'),
            },
            {
              key: 'Shift-Tab',
              run: (view) => runMarkdownTableNavigation(view, 'previousCell'),
            },
            {
              key: 'Enter',
              run: (view) => runMarkdownTableNavigation(view, 'nextRow'),
            },
            {
              key: 'Shift-Enter',
              run: (view) => runMarkdownTableNavigation(view, 'lineBreak'),
            },
            {
              key: 'Mod-Enter',
              run: (view) => runMarkdownTableNavigation(view, 'lineBreak'),
            },
            {
              key: 'Escape',
              run: (view) => runMarkdownTableNavigation(view, 'escape'),
            },
            {
              key: 'Mod-f',
              run: () => {
                emitAppEvent('search.open', { action: 'open' });
                return true;
              }
            },
            {
              key: 'Mod-h',
              run: () => {
                emitAppEvent('search.open', { action: 'replace' });
                return true;
              }
            }
          ])),
          lineFlashField,
          editorLineNumbersCompartment.of(getLineNumberExtensions(showLineNumbers)),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          search({
            createPanel: createHiddenSearchPanel,
            scrollToMatch: (range) => EditorView.scrollIntoView(range, { y: 'center' }),
          }),
          Prec.high(keymap.of(markdownListKeymap)),
          editorLineWrappingCompartment.of(getLineWrappingExtensions(wordWrap)),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          editorContentThemeCompartment.of(getContentThemeExtension(contentTheme)),
          editorTypographyCompartment.of(getTypographyExtension(
            editorFontSize,
            editorLineHeight,
            editorFontFamily,
            editorFontSource.kind === 'theme',
          )),
          compatibilityMarkdownPlugin,
          editorSelectionPlugin,
          bracketMatching(),
          closeBrackets(),
          editorLinkCompletionCompartment.of(getLinkCompletionExtension({
            currentDocumentPath,
            workspaceFiles: workspaceLinkFiles,
            workspaceRootPath,
          })),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            indentWithTab,
          ]),
          markdown(),
          editorDarkThemeCompartment.of(getDarkThemeExtensions(isEditorDark)),
          EditorView.theme({
            '&': { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
            '.cm-scroller': { overflowY: 'auto', overflowX: 'hidden' },
            '.cm-content': { padding: '32px 48px', color: 'var(--text-primary)', maxWidth: '860px', margin: '0 auto' },
            '.cm-line-flash': { animation: 'cm-flash 2s cubic-bezier(0.16, 1, 0.3, 1)' },
            '.cm-gutters': {
              backgroundColor: 'transparent',
              borderRight: '1px solid var(--theme-divider, var(--border-color))',
              color: 'var(--text-secondary)',
            },
            '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' },
            '.cm-activeLine': { backgroundColor: 'var(--c-chalk, var(--bg-hover))' },
            '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
            '&.cm-focused': { outline: 'none' },
            '.cm-selectionBackground': {
              backgroundColor: 'var(--editor-selection-bg, var(--accent-tint-strong)) !important',
              boxShadow: '0 0 0 1px var(--editor-selection-ring, transparent)',
              borderRadius: '2px',
            },
            '&.cm-focused .cm-selectionBackground': {
              backgroundColor: 'var(--editor-selection-bg, var(--accent-tint-strong)) !important',
            }
          }),
          editorPhrasesCompartment.of(EditorState.phrases.of(getEditorPhrases(t))),
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
              if (isUpdatingFromPropsRef.current) {
                isUpdatingFromPropsRef.current = false;
              } else {
                onChangeRef.current(update.state.doc.toString());
              }
            }
            if (update.docChanged || update.selectionSet) {
              onCursorChangeRef.current?.(getCursorPosition(update.view));
              onSelectionTextChangeRef.current?.(getSelectedText(update.view));
              updateTableToolbar(update.view);
              if (typewriterModeRef.current && update.selectionSet) {
                scrollPrimarySelectionToCenter(update.view);
              }
            }
          }),
        ],
      });

      const view = new EditorView({
        state: startState,
        parent: editorRef.current,
      });

      viewRef.current = view;

      const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        const selection = view.state.selection.main;
        const rightClickedInsideSelection =
          pos !== null &&
          selection.from !== selection.to &&
          pos >= selection.from &&
          pos <= selection.to;

        if (pos !== null && !rightClickedInsideSelection) {
          view.dispatch({ selection: { anchor: pos } });
        }

        const nextSelection = view.state.selection.main;
        setEditorContextMenu({
          x: event.clientX,
          y: event.clientY,
          hasSelection: nextSelection.from !== nextSelection.to,
          isInTable: pos !== null && Boolean(findMarkdownTableBlock(view.state.doc.toString(), pos)),
        });
      };

      view.dom.addEventListener('contextmenu', handleContextMenu);
      const handlePaste = (event: ClipboardEvent) => {
        const hasImage = Array.from(event.clipboardData?.items ?? []).some((item) => item.type.startsWith('image/'));
        if (!hasImage) {
          const text = event.clipboardData?.getData('text/plain') ?? '';
          if (text && handleTablePasteText(view, text)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
        void handleClipboardImagePaste(event, view);
      };
      view.dom.addEventListener('paste', handlePaste);
      const handleDragOver = (event: DragEvent) => {
        const hasImage = Array.from(event.dataTransfer?.items ?? []).some((item) => item.type.startsWith('image/'));
        if (!hasImage) return;
        event.preventDefault();
      };
      const handleDrop = (event: DragEvent) => {
        void handleImageDrop(event, view);
      };
      view.dom.addEventListener('dragover', handleDragOver);
      view.dom.addEventListener('drop', handleDrop);
      const handleScroll = () => {
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        onScrollRatioChangeRef.current?.(maxScroll > 0 ? scroller.scrollTop / maxScroll : 0);
        onScrollRef.current?.();
        updateTableToolbar(view);

        if (onTopLineChangeRef.current) {
          const rect = scroller.getBoundingClientRect();
          const pos = view.posAtCoords({ x: rect.left + 10, y: rect.top + 4 }, false);
          let topLine = 1;
          if (pos !== null) {
            topLine = view.state.doc.lineAt(pos).number;
          } else {
            const block = view.elementAtHeight(scroller.scrollTop + view.documentTop);
            topLine = view.state.doc.lineAt(block.from).number;
          }
          onTopLineChangeRef.current(topLine);
        }
      };
      view.scrollDOM.addEventListener('scroll', handleScroll);

      return () => {
        view.dom.removeEventListener('contextmenu', handleContextMenu);
        view.dom.removeEventListener('paste', handlePaste);
        view.dom.removeEventListener('dragover', handleDragOver);
        view.dom.removeEventListener('drop', handleDrop);
        view.scrollDOM.removeEventListener('scroll', handleScroll);
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: editorPhrasesCompartment.reconfigure(EditorState.phrases.of(getEditorPhrases(t))),
      });
    }, [locale, t]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: editorDarkThemeCompartment.reconfigure(getDarkThemeExtensions(isEditorDark)),
      });
    }, [isEditorDark]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: editorContentThemeCompartment.reconfigure(getContentThemeExtension(contentTheme)),
      });
    }, [contentTheme]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: editorLineNumbersCompartment.reconfigure(getLineNumberExtensions(showLineNumbers)),
      });
    }, [showLineNumbers]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: editorLineWrappingCompartment.reconfigure(getLineWrappingExtensions(wordWrap)),
      });
    }, [wordWrap]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: editorTypographyCompartment.reconfigure(getTypographyExtension(
          editorFontSize,
          editorLineHeight,
          editorFontFamily,
          editorFontSource.kind === 'theme',
        )),
      });
    }, [editorFontFamily, editorFontSize, editorFontSource.kind, editorLineHeight]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: editorLinkCompletionCompartment.reconfigure(getLinkCompletionExtension({
          currentDocumentPath,
          workspaceFiles: workspaceLinkFiles,
          workspaceRootPath,
        })),
      });
    }, [currentDocumentPath, workspaceLinkFiles, workspaceRootPath]);

    const getEditorScroller = useCallback(() => {
      return viewRef.current?.scrollDOM ?? null;
    }, []);

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
