import { useCallback, useEffect, type MutableRefObject, type RefObject } from 'react';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { bracketMatching, foldKeymap, indentOnInput } from '@codemirror/language';
import { search } from '@codemirror/search';
import { EditorState, Prec } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
  EditorView,
  type ViewUpdate,
} from '@codemirror/view';
import type { I18nKey, I18nParams } from '../../i18n/resources';
import { markdownListKeymap } from '../extensions/markdownLists';
import type { WorkspaceLinkFile } from '../extensions/linkCompletion';
import { findMarkdownTableBlock } from '../extensions/tables';
import {
  compatibilityMarkdownPlugin,
} from '../extensions/markdownHighlight';
import { taskListCheckboxExtension } from '../extensions/taskListCheckbox';
import { createHiddenSearchPanel } from '../extensions/search';
import { editorSelectionPlugin, lineFlashField } from '../extensions/selection';
import { scrollPrimarySelectionToCenter } from '../extensions/typewriter';
import {
  editorContentThemeCompartment,
  editorDarkThemeCompartment,
  editorLineNumbersCompartment,
  editorLineWrappingCompartment,
  editorLinkCompletionCompartment,
  editorPhrasesCompartment,
  editorTypographyCompartment,
  getContentThemeExtension,
  getDarkThemeExtensions,
  getLineNumberExtensions,
  getLineWrappingExtensions,
  getLinkCompletionExtension,
  getTypographyExtension,
} from '../runtime/editorAppearanceRuntime';
import type { createEditorClipboardController } from '../runtime/editorClipboardController';
import {
  createEditorRuntime,
  getEditorPhrases,
} from '../runtime/createEditorRuntime';
import { runMarkdownTableNavigation } from '../runtime/editorTableRuntime';
import { emitAppEvent } from '../../../platform/events/appEvents';

type EditorTranslate = (key: I18nKey, params?: I18nParams) => string;

interface UseEditorRuntimeModelInput {
  clipboardController: ReturnType<typeof createEditorClipboardController>;
  content: string;
  contentTheme: string;
  currentDocumentPath?: string;
  editorFontFamily: string;
  editorFontSize: number;
  editorLineHeight: number;
  editorRef: RefObject<HTMLElement | null>;
  editorUsesThemeFont: boolean;
  isEditorDark: boolean;
  isUpdatingFromPropsRef: MutableRefObject<boolean>;
  locale: unknown;
  onChangeRef: MutableRefObject<(content: string) => void>;
  onCursorChangeRef: MutableRefObject<((cursor: { line: number; column: number }) => void) | undefined>;
  onEditorContextMenu: (menu: {
    hasSelection: boolean;
    isInTable: boolean;
    x: number;
    y: number;
  }) => void;
  onScrollRatioChangeRef: MutableRefObject<((ratio: number) => void) | undefined>;
  onScrollRef: MutableRefObject<(() => void) | undefined>;
  onSelectionTextChangeRef: MutableRefObject<((text: string) => void) | undefined>;
  onTopLineChangeRef: MutableRefObject<((line: number) => void) | undefined>;
  showLineNumbers: boolean;
  t: EditorTranslate;
  typewriterModeRef: MutableRefObject<boolean>;
  updateTableToolbar: (view: EditorView) => void;
  viewRef: MutableRefObject<EditorView | null>;
  wordWrap: boolean;
  workspaceLinkFiles: WorkspaceLinkFile[];
  workspaceRootPath?: string | null;
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

export function useEditorRuntimeModel({
  clipboardController,
  content,
  contentTheme,
  currentDocumentPath,
  editorFontFamily,
  editorFontSize,
  editorLineHeight,
  editorRef,
  editorUsesThemeFont,
  isEditorDark,
  isUpdatingFromPropsRef,
  locale,
  onChangeRef,
  onCursorChangeRef,
  onEditorContextMenu,
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
}: UseEditorRuntimeModelInput) {
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      isUpdatingFromPropsRef.current = true;
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: content },
      });
    }
  }, [content, isUpdatingFromPropsRef, viewRef]);

  useEffect(() => {
    if (!editorRef.current) return;

    const view = createEditorRuntime({
      doc: content,
      parent: editorRef.current,
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
            },
          },
          {
            key: 'Mod-h',
            run: () => {
              emitAppEvent('search.open', { action: 'replace' });
              return true;
            },
          },
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
          editorUsesThemeFont,
        )),
        compatibilityMarkdownPlugin,
        taskListCheckboxExtension,
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
          },
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
      onEditorContextMenu({
        x: event.clientX,
        y: event.clientY,
        hasSelection: nextSelection.from !== nextSelection.to,
        isInTable: pos !== null && Boolean(findMarkdownTableBlock(view.state.doc.toString(), pos)),
      });
    };

    view.dom.addEventListener('contextmenu', handleContextMenu);
    const handlePaste = (event: ClipboardEvent) => {
      void clipboardController.handlePaste(event, view);
    };
    view.dom.addEventListener('paste', handlePaste);
    const handleDragOver = (event: DragEvent) => {
      clipboardController.handleDragOver(event);
    };
    const handleDrop = (event: DragEvent) => {
      void clipboardController.handleDrop(event, view);
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
    // Keep the same mount-once lifecycle as the original EditorPane runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editorPhrasesCompartment.reconfigure(EditorState.phrases.of(getEditorPhrases(t))),
    });
  }, [locale, t, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editorDarkThemeCompartment.reconfigure(getDarkThemeExtensions(isEditorDark)),
    });
  }, [isEditorDark, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editorContentThemeCompartment.reconfigure(getContentThemeExtension(contentTheme)),
    });
  }, [contentTheme, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editorLineNumbersCompartment.reconfigure(getLineNumberExtensions(showLineNumbers)),
    });
  }, [showLineNumbers, viewRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editorLineWrappingCompartment.reconfigure(getLineWrappingExtensions(wordWrap)),
    });
  }, [viewRef, wordWrap]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editorTypographyCompartment.reconfigure(getTypographyExtension(
        editorFontSize,
        editorLineHeight,
        editorFontFamily,
        editorUsesThemeFont,
      )),
    });
  }, [editorFontFamily, editorFontSize, editorLineHeight, editorUsesThemeFont, viewRef]);

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
  }, [currentDocumentPath, viewRef, workspaceLinkFiles, workspaceRootPath]);

  const getEditorScroller = useCallback(() => {
    return viewRef.current?.scrollDOM ?? null;
  }, [viewRef]);

  return {
    getEditorScroller,
  };
}
