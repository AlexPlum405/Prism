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
import { SearchQuery, setSearchQuery, findNext, findPrevious, replaceNext, replaceAll, search, selectMatches } from '@codemirror/search';
import { useDocumentStore } from '../../document/store';
import { useSettingsStore } from '../../settings/store';
import type { ContentTheme } from '../../settings/types';
import { useWorkspaceStore } from '../../workspace/store';
import { flattenFiles, getWorkspaceIndexLinkFiles, type WorkspaceIndex } from '../../workspace/services';
import type { SearchAction, SearchParams } from './SearchPanel';
import { ContextMenu } from '../../../components/shell/ContextMenu';
import { markdownToHtml } from '../../../lib/markdownToHtml';
import { isCommandId } from '../../commands';
import { getEditorContextMenuItems } from '../extensions/contextMenu';
import { getEditorFormatResult, type EditorFormat } from '../extensions/formatting';
import {
  getSourceBlockOperationEdit,
  isSourceBlockOperation,
  type SourceBlockOperation,
} from '../extensions/blockOperations';
import { createMarkdownLinkCompletionSource } from '../extensions/linkCompletion';
import { createSlashMenuCompletionSource } from '../extensions/slashMenu';
import { HorizontalScrollbar } from './HorizontalScrollbar';
import {
  getMarkdownImageForPath,
  getNativeImageFilePath,
  isSupportedImageFile,
  saveClipboardImage,
} from '../extensions/imagePaste';
import { markdownListKeymap } from '../extensions/markdownLists';
import { getMarkdownTableCommandEdit, type MarkdownTableCommand } from '../extensions/tables';
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
import { createHiddenSearchPanel, ensureSearchHighlighterEnabled } from '../extensions/search';
import { addLineFlash, editorSelectionPlugin, lineFlashField, removeLineFlash } from '../extensions/selection';
import { scrollPrimarySelectionToCenter } from '../extensions/typewriter';

const editorLineNumbersCompartment = new Compartment();
const editorLineWrappingCompartment = new Compartment();
const editorDarkThemeCompartment = new Compartment();
const editorContentThemeCompartment = new Compartment();
const editorTypographyCompartment = new Compartment();
const editorLinkCompletionCompartment = new Compartment();
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

        const targetLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
        const line = view.state.doc.line(targetLine);

        view.dispatch({
          selection: { anchor: line.from },
          effects: [
            EditorView.scrollIntoView(line.from, { y: 'center' }),
            addLineFlash.of(line.from)
          ],
        });

        // 2秒后清除闪烁样式
        setTimeout(() => {
          if (viewRef.current) {
            viewRef.current.dispatch({
              effects: removeLineFlash.of(line.from)
            });
          }
        }, 2000);

        view.focus();
      },
      setScrollRatio: (ratio: number) => {
        const view = viewRef.current;
        if (!view) return;
        const scroller = view.scrollDOM;
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        const targetScroll = Math.max(0, ratio) * maxScroll;
        scroller.scrollTop = targetScroll;
      },
      scrollToLine: (lineNumber: number) => {
        const view = viewRef.current;
        if (!view) return;
        const targetLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
        const line = view.state.doc.line(targetLine);
        // 使用 CodeMirror 自身的 scrollIntoView，正确处理视口虚拟化
        view.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: 'start' }),
        });
      },
      execSearch: (action, params) => {
        const view = viewRef.current;
        if (!view) return;

        ensureSearchHighlighterEnabled(view);

        view.dispatch({
          effects: setSearchQuery.of(new SearchQuery({
            search: params.query,
            caseSensitive: params.matchCase,
            regexp: params.regexp,
            wholeWord: params.wholeWord,
            replace: params.replaceWith
          }))
        });

        switch (action) {
          case 'input':
            if (params.query) {
              view.dispatch({ selection: { anchor: 0 } });
              findNext(view);
            }
            break;
          case 'next': findNext(view); break;
          case 'prev': findPrevious(view); break;
          case 'all': selectMatches(view); break;
          case 'replace': {
            const beforeDoc = view.state.doc.toString();
            const handled = replaceNext(view);
            if (handled && params.query && view.state.doc.toString() !== beforeDoc) {
              findNext(view);
            }
            break;
          }
          case 'replaceAll': replaceAll(view); break;
        }
      },
      restoreSearch: (params, currentMatch) => {
        const view = viewRef.current;
        if (!view) return;

        ensureSearchHighlighterEnabled(view);

        view.dispatch({
          selection: { anchor: 0 },
          effects: setSearchQuery.of(new SearchQuery({
            search: params.query,
            caseSensitive: params.matchCase,
            regexp: params.regexp,
            wholeWord: params.wholeWord,
            replace: params.replaceWith
          }))
        });

        if (!params.query || currentMatch <= 0) return;

        for (let index = 0; index < currentMatch; index += 1) {
          findNext(view);
        }
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
        window.dispatchEvent(new CustomEvent('prism-command', { detail: { action } }));
      }

      view.focus();
    }, []);

    const handleTableCommand = useCallback((command: MarkdownTableCommand) => {
      const view = viewRef.current;
      if (!view) return false;

      const selection = view.state.selection.main;
      const result = getMarkdownTableCommandEdit(
        view.state.doc.toString(),
        selection.from,
        selection.to,
        command,
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

    const handleClipboardImagePaste = useCallback(async (event: ClipboardEvent, view: EditorView) => {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;

      event.preventDefault();
      event.stopPropagation();

      const imageFile = imageItem.getAsFile();
      const document = useDocumentStore.getState().currentDocument;
      if (!imageFile) {
        onNoticeRef.current?.('剪贴板图片不可读取');
        return;
      }
      if (!document?.path) {
        onNoticeRef.current?.('请先保存 Markdown 文档，再粘贴图片');
        return;
      }

      try {
        const markdownImage = await saveClipboardImage({
          documentName: document.name,
          documentPath: document.path,
          file: imageFile,
        });
        const selection = view.state.selection.main;
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: markdownImage },
          selection: { anchor: selection.from + markdownImage.length },
          scrollIntoView: true,
        });
      } catch (error) {
        onNoticeRef.current?.(`图片粘贴失败: ${formatEditorError(error)}`);
      }
    }, []);

    const insertAtSelection = useCallback((view: EditorView, text: string) => {
      const selection = view.state.selection.main;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: text },
        selection: { anchor: selection.from + text.length },
        scrollIntoView: true,
      });
      view.focus();
    }, []);

    const handleImageDrop = useCallback(async (event: DragEvent, view: EditorView) => {
      const imageFiles = Array.from(event.dataTransfer?.files ?? []).filter(isSupportedImageFile);
      if (imageFiles.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.altKey) {
        const markdownLinks = imageFiles
          .map((file) => {
            const nativePath = getNativeImageFilePath(file);
            return nativePath ? getMarkdownImageForPath(nativePath, file.name) : null;
          })
          .filter((link): link is string => Boolean(link));

        if (markdownLinks.length === 0) {
          onNoticeRef.current?.('当前运行环境无法读取拖拽文件原始路径');
          return;
        }

        insertAtSelection(view, markdownLinks.join('\n'));
        return;
      }

      const document = useDocumentStore.getState().currentDocument;
      if (!document?.path) {
        onNoticeRef.current?.('请先保存 Markdown 文档，再拖入图片');
        return;
      }

      try {
        const markdownImages: string[] = [];
        for (const file of imageFiles) {
          markdownImages.push(await saveClipboardImage({
            documentName: document.name,
            documentPath: document.path,
            file,
          }));
        }
        insertAtSelection(view, markdownImages.join('\n'));
      } catch (error) {
        onNoticeRef.current?.(`图片拖拽失败: ${formatEditorError(error)}`);
      }
    }, [insertAtSelection]);

    // 监听菜单格式化事件
    useEffect(() => {
      const onFormat = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.format) handleFormat(detail.format);
      };
      const onHeading = (e: Event) => {
        const view = viewRef.current;
        if (!view) return;
        const detail = (e as CustomEvent).detail;
        const levelValue = typeof detail?.level === 'string' ? detail.level : '';
        if (!/^h[1-6]$/.test(levelValue)) return;
        const level = Number(levelValue.slice(1));
        const prefix = '#'.repeat(level) + ' ';
        const cursor = view.state.selection.main.head;
        const line = view.state.doc.lineAt(cursor);
        const lineText = view.state.doc.sliceString(line.from, line.to);
        const stripped = lineText.replace(/^#{1,6}\s*/, '');
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: prefix + stripped },
        });
        view.focus();
      };
      const onBlock = (e: Event) => {
        const view = viewRef.current;
        if (!view) return;
        const detail = (e as CustomEvent).detail;
        const fmt = typeof detail?.format === 'string' ? detail.format : '';
        if (!fmt) return;
        const cursor = view.state.selection.main.head;
        const line = view.state.doc.lineAt(cursor);
        const lineText = view.state.doc.sliceString(line.from, line.to);

        if (fmt === 'paragraph') {
          const stripped = lineText.replace(/^#{1,6}\s*/, '');
          view.dispatch({ changes: { from: line.from, to: line.to, insert: stripped } });
          view.focus();
          return;
        }

        if (fmt === 'increaseHeading') {
          const match = lineText.match(/^(#{1,6})\s/);
          if (match && match[1].length < 6) {
            view.dispatch({ changes: { from: line.from, to: line.to, insert: '#' + lineText } });
          } else if (!match) {
            view.dispatch({ changes: { from: line.from, insert: '# ' } });
          }
          view.focus();
          return;
        }

        if (fmt === 'decreaseHeading') {
          const match = lineText.match(/^(#{1,6})\s/);
          if (match && match[1].length > 1) {
            view.dispatch({ changes: { from: line.from, to: line.to, insert: lineText.slice(1) } });
          } else if (match && match[1].length === 1) {
            view.dispatch({ changes: { from: line.from, to: line.to, insert: lineText.replace(/^#\s*/, '') } });
          }
          view.focus();
          return;
        }

        const selectionBlockOperationMap: Partial<Record<string, SourceBlockOperation>> = {
          quote: 'selectionQuote',
          orderedList: 'selectionOrderedList',
          unorderedList: 'selectionUnorderedList',
          taskList: 'selectionTaskList',
        };
        const selectionOperation = selectionBlockOperationMap[fmt];
        if (selectionOperation) {
          handleSourceBlockOperation(selectionOperation);
          return;
        }

        if (fmt === 'insertAbove') {
          view.dispatch({ changes: { from: line.from, insert: '\n' } });
          view.dispatch({ selection: { anchor: line.from } });
          view.focus();
          return;
        }
        if (fmt === 'insertBelow') {
          view.dispatch({ changes: { from: line.to, insert: '\n' } });
          view.dispatch({ selection: { anchor: line.to + 1 } });
          view.focus();
          return;
        }

        const prefixMap: Record<string, string> = {
          quote: '> ',
          codeBlock: '```\n',
          orderedList: '1. ',
          unorderedList: '- ',
          taskList: '- [ ] ',
          hr: '\n---\n',
          mathBlock: '$$\n',
          toc: '[TOC]\n',
          yaml: '---\n',
          linkReference: '[text][ref]\n\n[ref]: url',
          footnote: '[^1]\n\n[^1]: ',
          comment: '<!-- ',
        };

        const suffixMap: Record<string, string> = {
          codeBlock: '\n```',
          mathBlock: '\n$$',
          yaml: '\n---',
          comment: ' -->',
        };

        const prefix = prefixMap[fmt] || '';
        const suffix = suffixMap[fmt] || '';
        view.dispatch({
          changes: { from: line.from, insert: prefix },
        });
        if (suffix) {
          const newLine = view.state.doc.lineAt(cursor + prefix.length);
          view.dispatch({
            changes: { from: newLine.to, insert: suffix },
          });
        }
        view.focus();
      };

      const onEditorCommand = (e: Event) => {
        const view = viewRef.current;
        if (!view) return;
        const detail = (e as CustomEvent).detail;
        const command = typeof detail?.command === 'string' ? detail.command : '';
        if (!command) return;

        if (isSourceBlockOperation(command)) {
          handleSourceBlockOperation(command);
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
            if (text2) navigator.clipboard.writeText(markdownToHtml(text2));
            break;
          }
          case 'selectAll':
            view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
            break;
          case 'paste':
          case 'pastePlain':
            navigator.clipboard.readText().then(text => {
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
            handleTableCommand('insert');
            break;
          case 'formatTable':
            handleTableCommand('format');
            break;
          case 'addTableRow':
            handleTableCommand('addRow');
            break;
          case 'addTableColumn':
            handleTableCommand('addColumn');
            break;
          case 'deleteTableRow':
            handleTableCommand('deleteRow');
            break;
          case 'deleteTableColumn':
            handleTableCommand('deleteColumn');
            break;
          case 'insertTemplate':
            handleTemplateInsert(detail.templateId);
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

      window.addEventListener('prism-format', onFormat);
      window.addEventListener('prism-heading', onHeading);
      window.addEventListener('prism-block-format', onBlock);
      window.addEventListener('prism-editor-command', onEditorCommand);

      return () => {
        window.removeEventListener('prism-format', onFormat);
        window.removeEventListener('prism-heading', onHeading);
        window.removeEventListener('prism-block-format', onBlock);
        window.removeEventListener('prism-editor-command', onEditorCommand);
      };
    }, [handleFoldCurrentHeading, handleFormat, handleSourceBlockOperation, handleTableCommand, handleTemplateInsert]);

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
              key: 'Mod-f',
              run: () => {
                window.dispatchEvent(new CustomEvent('prism-search', { detail: { action: 'open' } }));
                return true;
              }
            },
            {
              key: 'Mod-h',
              run: () => {
                window.dispatchEvent(new CustomEvent('prism-search', { detail: { action: 'replace' } }));
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
          EditorState.phrases.of({
            "Find": "查找内容", "Replace": "替换为", "next": "下一个", "previous": "上一个", "all": "全部",
            "match case": "大小写", "regexp": "正则", "by word": "全词", "replace": "替换", "replace all": "全部替换"
          }),
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
        });
      };

      view.dom.addEventListener('contextmenu', handleContextMenu);
      const handlePaste = (event: ClipboardEvent) => {
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
        <HorizontalScrollbar getScroller={getEditorScroller} />
        {editorContextMenu && (
          <ContextMenu
            x={editorContextMenu.x}
            y={editorContextMenu.y}
            items={getEditorContextMenuItems(editorContextMenu.hasSelection, shortcutStyle)}
            onAction={handleEditorContextMenuAction}
            onClose={() => setEditorContextMenu(null)}
          />
        )}
      </div>
    );
  },
);
