import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { EditorPaneHandle } from './EditorPane';
import { HorizontalScrollbar } from './HorizontalScrollbar';
import { PreviewPane } from './PreviewPane';
import { buildSearchPattern, countMatches, SearchAction, SearchMode, SearchPanel, SearchParams } from './SearchPanel';
import { ContextMenu, type ContextMenuItem } from '../../../components/shell/ContextMenu';
import { useDocumentStore } from '../../document/store';
import type { DocumentScrollState } from '../../document/types';
import { useSettingsStore } from '../../settings/store';
import { useWorkspaceStore } from '../../workspace/store';
import type { WorkspaceIndex } from '../../workspace/services';
import { getCommandMenuItems, type CommandContext } from '../../commands';
import { t } from '../../i18n';
import { previewHtmlToRichClipboardInput, writeRichClipboard } from '../extensions/richCopy';
import { emitAppEvent, onAppEvent } from '../../../platform/events/appEvents';
import { hasPresentationSlides } from '../extensions/presentation';
import { PresentationOverlay } from './PresentationOverlay';
import { PREVIEW_SOURCE_FLASH_MS } from '../../../lib/feedbackTiming';
import {
  createPreviewScrollMapCache,
  findPreviewElementForSourceLine,
  findPreviewSourceLineElement,
  lineToPreviewScrollTopInMap,
  pageOffsetToLineInMap,
} from './previewScrollMap';
export type { CodeLineElement } from './previewScrollMap';
export {
  collectCodeLineElements,
  lineToPreviewScrollTop,
  pageOffsetToLine,
} from './previewScrollMap';

const EditorPane = lazy(() => import('./EditorPane')
  .then((module) => ({ default: module.EditorPane })));

interface SplitViewProps {
  content: string;
  documentPath?: string;
  scrollState?: DocumentScrollState;
  viewMode: 'edit' | 'split' | 'preview';
  onChange: (content: string) => void;
  onCursorChange?: (cursor: { line: number; column: number }) => void;
  onSelectionTextChange?: (text: string) => void;
  onNotice?: (message: string) => void;
  onOpenDocumentLink?: (
    target: string,
    options: { kind: 'markdown' | 'wiki'; sourcePath?: string },
  ) => void | Promise<void>;
  onScrollStateChange?: (scrollState: Partial<DocumentScrollState>) => void;
  workspaceIndex?: WorkspaceIndex | null;
  workspaceIndexJobId?: string | null;
}

const DEFAULT_SEARCH_PARAMS: SearchParams = {
  query: '',
  replaceWith: '',
  matchCase: false,
  regexp: false,
  wholeWord: false,
};
const PREVIEW_SEARCH_INPUT_DEBOUNCE_MS = 140;
const PREVIEW_SEARCH_BATCH_SIZE = 80;
const MAX_PENDING_SOURCE_JUMP_FRAMES = 60;

function normalizeSelectionSeed(text: string) {
  const seed = text.replace(/\u00a0/g, ' ');
  return seed.trim().length > 0 ? seed : '';
}

async function copyText(text: string) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function getSerializedSelectionHtml(preview: HTMLElement | null) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !preview || !selection.anchorNode) return '';
  if (!preview.contains(selection.anchorNode)) return '';

  const container = document.createElement('div');
  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.appendChild(selection.getRangeAt(index).cloneContents());
  }
  return container.innerHTML;
}

function dispatchCommand(action: string) {
  emitAppEvent('command.run', { action });
}

function createReadonlyCommandContext(): CommandContext {
  return {
    documentStore: useDocumentStore.getState(),
    settingsStore: useSettingsStore.getState(),
    workspaceStore: useWorkspaceStore.getState(),
  };
}

function readPreviewSourceLine(element: HTMLElement): number | null {
  const raw = element.getAttribute('data-source-line') ?? element.getAttribute('data-line');
  const line = raw ? Number(raw) : NaN;
  return Number.isFinite(line) ? line : null;
}

function findSourceLineElement(
  target: Element | null,
  preview?: HTMLElement | null,
): { element: HTMLElement; line: number } | null {
  if (preview) {
    return findPreviewSourceLineElement(target, preview);
  }

  const element = target?.closest<HTMLElement>('[data-source-line], [data-line]');
  if (!element) return null;
  const line = readPreviewSourceLine(element);
  return line === null ? null : { element, line };
}

function isInteractivePreviewTarget(target: Element | null): boolean {
  return Boolean(target?.closest('a, button, input, textarea, select, summary, [contenteditable="true"]'));
}

function findPreviewSourceAction(target: Element | null): number | null {
  const action = target?.closest<HTMLElement>('[data-preview-source-line]');
  if (!action) return null;
  const raw = action.getAttribute('data-preview-source-line');
  const line = raw ? Number(raw) : NaN;
  return Number.isFinite(line) ? line : null;
}

function findPreviewTaskCheckbox(target: Element | null): HTMLInputElement | null {
  const checkbox = target?.closest<HTMLInputElement>('input[type="checkbox"][data-task-checkbox-index]');
  return checkbox instanceof HTMLInputElement ? checkbox : null;
}

function parseFiniteNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const MARKDOWN_TASK_MARKER_PATTERN = /^(\s*(?:[-+*]|\d+[.)])\s+\[)[ xX](\])/;

function setMarkdownTaskLineChecked(line: string, checked: boolean) {
  if (!MARKDOWN_TASK_MARKER_PATTERN.test(line)) return null;
  return line.replace(MARKDOWN_TASK_MARKER_PATTERN, `$1${checked ? 'x' : ' '}$2`);
}

function updateTaskCheckboxBySourceLine(content: string, sourceLine: number | null, checked: boolean) {
  if (sourceLine === null || sourceLine < 1) return null;

  const lines = content.split(/\r?\n/);
  const targetIndex = sourceLine - 1;
  const currentLine = lines[targetIndex];
  if (currentLine === undefined) return null;

  const nextLine = setMarkdownTaskLineChecked(currentLine, checked);
  if (nextLine === null || nextLine === currentLine) return null;

  lines[targetIndex] = nextLine;
  return lines.join(content.includes('\r\n') ? '\r\n' : '\n');
}

function updateTaskCheckboxByIndex(content: string, checkboxIndex: number | null, checked: boolean) {
  if (checkboxIndex === null || checkboxIndex < 0) return null;

  const lines = content.split(/\r?\n/);
  let currentCheckboxIndex = -1;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const nextLine = setMarkdownTaskLineChecked(lines[lineIndex], checked);
    if (nextLine === null) continue;

    currentCheckboxIndex += 1;
    if (currentCheckboxIndex !== checkboxIndex) continue;
    if (nextLine === lines[lineIndex]) return null;

    lines[lineIndex] = nextLine;
    return lines.join(content.includes('\r\n') ? '\r\n' : '\n');
  }

  return null;
}

function updateTaskCheckboxMarkdown(
  content: string,
  options: { checked: boolean; checkboxIndex: number | null; sourceLine: number | null },
) {
  return updateTaskCheckboxBySourceLine(content, options.sourceLine, options.checked)
    ?? updateTaskCheckboxByIndex(content, options.checkboxIndex, options.checked);
}

function getScrollRatio(element: HTMLElement): number {
  const maxScroll = element.scrollHeight - element.clientHeight;
  return maxScroll > 0 ? element.scrollTop / maxScroll : 0;
}

function setScrollRatio(element: HTMLElement, ratio: number) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  element.scrollTop = Math.max(0, Math.min(1, ratio)) * Math.max(0, maxScroll);
}

export function shouldSyncPreviewScrollToEditor(viewMode: 'edit' | 'split' | 'preview') {
  return viewMode === 'split';
}

function clearPreviewSearchMarks(preview: HTMLElement) {
  const marks = Array.from(preview.querySelectorAll<HTMLElement>('.preview-search-match'));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  }
}

function isSearchablePreviewTextNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return false;
  if (!node.textContent) return false;
  return !parent.closest('.preview-search-match, script, style, noscript, textarea, input, select, button, svg');
}

interface PreviewSearchMarkState {
  currentElement: HTMLElement | null;
  matchIndex: number;
  normalizedCurrent: number;
}

interface PreviewSearchTask {
  cancel: () => void;
}

function collectPreviewSearchTextNodes(write: HTMLElement): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(write, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (
      isSearchablePreviewTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    ),
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  return textNodes;
}

function replaceTextNodeWithPreviewSearchMarks(
  node: Text,
  pattern: RegExp,
  state: PreviewSearchMarkState,
) {
  if (!node.parentNode) return;

  const text = node.data;
  const entries: Array<{ from: number; to: number; index: number }> = [];
  pattern.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }

    state.matchIndex += 1;
    entries.push({
      from: match.index,
      to: match.index + match[0].length,
      index: state.matchIndex,
    });
  }

  if (entries.length === 0) return;

  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const entry of entries) {
    if (entry.from > cursor) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, entry.from)));
    }

    const mark = document.createElement('span');
    mark.className = entry.index === state.normalizedCurrent
      ? 'preview-search-match preview-search-match--current'
      : 'preview-search-match';
    mark.textContent = text.slice(entry.from, entry.to);
    fragment.appendChild(mark);

    if (entry.index === state.normalizedCurrent) {
      state.currentElement = mark;
    }

    cursor = entry.to;
  }

  if (cursor < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
  }

  node.replaceWith(fragment);
}

function applyPreviewSearch(
  preview: HTMLElement | null,
  params: SearchParams,
  currentMatch: number,
  options: { scrollToCurrent?: boolean } = {},
) {
  if (!preview) return { count: 0, current: 0 };

  clearPreviewSearchMarks(preview);

  const write = preview.querySelector<HTMLElement>('#write');
  if (!write || !params.query) return { count: 0, current: 0 };

  const pattern = buildSearchPattern(params.query, params.matchCase, params.regexp, params.wholeWord);
  if (!pattern || pattern === 'invalid') return { count: 0, current: 0 };

  const state: PreviewSearchMarkState = {
    currentElement: null,
    matchIndex: 0,
    normalizedCurrent: Math.max(currentMatch || 1, 1),
  };
  for (const node of collectPreviewSearchTextNodes(write)) {
    replaceTextNodeWithPreviewSearchMarks(node, pattern, state);
  }

  if (options.scrollToCurrent) {
    state.currentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  return {
    count: state.matchIndex,
    current: state.matchIndex === 0 ? 0 : Math.min(state.normalizedCurrent, state.matchIndex),
  };
}

function startProgressivePreviewSearch(
  preview: HTMLElement | null,
  params: SearchParams,
  currentMatch: number,
  options: { batchSize?: number; scrollToCurrent?: boolean } = {},
): PreviewSearchTask {
  if (!preview) return { cancel: () => {} };

  clearPreviewSearchMarks(preview);

  const write = preview.querySelector<HTMLElement>('#write');
  if (!write || !params.query) return { cancel: () => {} };

  const pattern = buildSearchPattern(params.query, params.matchCase, params.regexp, params.wholeWord);
  if (!pattern || pattern === 'invalid') return { cancel: () => {} };

  const textNodes = collectPreviewSearchTextNodes(write);
  const state: PreviewSearchMarkState = {
    currentElement: null,
    matchIndex: 0,
    normalizedCurrent: Math.max(currentMatch || 1, 1),
  };
  const batchSize = Math.max(1, options.batchSize ?? PREVIEW_SEARCH_BATCH_SIZE);
  let cursor = 0;
  let cancelled = false;
  let frame: number | null = null;

  const runBatch = () => {
    if (cancelled) return;

    const end = Math.min(cursor + batchSize, textNodes.length);
    for (; cursor < end; cursor += 1) {
      replaceTextNodeWithPreviewSearchMarks(textNodes[cursor], pattern, state);
    }

    if (cursor < textNodes.length) {
      frame = requestAnimationFrame(runBatch);
      return;
    }

    if (options.scrollToCurrent) {
      state.currentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  };

  frame = requestAnimationFrame(runBatch);

  return {
    cancel: () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
    },
  };
}

export const SplitView = forwardRef<EditorPaneHandle, SplitViewProps>(
  function SplitView({
    content,
    documentPath,
    scrollState,
    viewMode,
    onChange,
    onCursorChange,
    onSelectionTextChange,
    onNotice,
    onOpenDocumentLink,
    onScrollStateChange,
    workspaceIndex,
    workspaceIndexJobId,
  }, ref) {
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorPaneHandle>(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchMode, setSearchMode] = useState<SearchMode>('find');
    const [searchParams, setSearchParams] = useState<SearchParams>(DEFAULT_SEARCH_PARAMS);
    const [searchMatchCount, setSearchMatchCount] = useState(0);
    const [searchCurrentMatch, setSearchCurrentMatch] = useState(0);
    const [searchActivationKey, setSearchActivationKey] = useState(0);
    const [previewContextMenu, setPreviewContextMenu] = useState<{
      x: number;
      y: number;
      hasSelection: boolean;
      line: number | null;
    } | null>(null);
    const [presentationVisible, setPresentationVisible] = useState(false);
    const searchParamsRef = useRef(searchParams);
    const searchCurrentMatchRef = useRef(searchCurrentMatch);
    const contentRef = useRef(content);
    const viewModeRef = useRef(viewMode);
    const scrollStateRef = useRef(scrollState);
    const previewScrollMapCacheRef = useRef(createPreviewScrollMapCache());
    const previewSearchTaskRef = useRef<PreviewSearchTask | null>(null);
    const previewSearchDebounceTimerRef = useRef<number | null>(null);
    const pendingSourceJumpLineRef = useRef<number | null>(null);
    const pendingSourceJumpFrameRef = useRef<number | null>(null);
    const pendingSourceJumpAttemptsRef = useRef(0);
    const [editorActivated, setEditorActivated] = useState(viewMode !== 'preview');
    // 同步方向锁：防止反馈循环
    const syncingRef = useRef<'editor' | 'preview' | null>(null);
    const syncingTimerRef = useRef<number | null>(null);
    viewModeRef.current = viewMode;

    const cancelPreviewSearchWork = useCallback(() => {
      if (previewSearchDebounceTimerRef.current !== null) {
        window.clearTimeout(previewSearchDebounceTimerRef.current);
        previewSearchDebounceTimerRef.current = null;
      }
      previewSearchTaskRef.current?.cancel();
      previewSearchTaskRef.current = null;
    }, []);

    const runPreviewSearch = useCallback((
      params: SearchParams,
      current: number,
      options: { progressive?: boolean; scrollToCurrent?: boolean } = {},
    ) => {
      cancelPreviewSearchWork();
      const preview = previewContainerRef.current;
      if (!preview) return;

      if (options.progressive && !options.scrollToCurrent) {
        previewSearchTaskRef.current = startProgressivePreviewSearch(preview, params, current);
        return;
      }

      applyPreviewSearch(preview, params, current, {
        scrollToCurrent: options.scrollToCurrent,
      });
    }, [cancelPreviewSearchWork]);

    const schedulePreviewSearch = useCallback((
      params: SearchParams,
      current: number,
      options: { debounce?: boolean; progressive?: boolean; scrollToCurrent?: boolean } = {},
    ) => {
      const preview = previewContainerRef.current;
      cancelPreviewSearchWork();

      if (!preview) return;

      if (!params.query) {
        clearPreviewSearchMarks(preview);
        return;
      }

      if (options.debounce) {
        clearPreviewSearchMarks(preview);
        previewSearchDebounceTimerRef.current = window.setTimeout(() => {
          previewSearchDebounceTimerRef.current = null;
          runPreviewSearch(params, current, {
            progressive: options.progressive,
            scrollToCurrent: options.scrollToCurrent,
          });
        }, PREVIEW_SEARCH_INPUT_DEBOUNCE_MS);
        return;
      }

      runPreviewSearch(params, current, {
        progressive: options.progressive,
        scrollToCurrent: options.scrollToCurrent,
      });
    }, [cancelPreviewSearchWork, runPreviewSearch]);

    useEffect(() => {
      return () => {
        cancelPreviewSearchWork();
      };
    }, [cancelPreviewSearchWork]);

    const cancelPendingSourceJumpFrame = useCallback(() => {
      if (pendingSourceJumpFrameRef.current !== null) {
        cancelAnimationFrame(pendingSourceJumpFrameRef.current);
        pendingSourceJumpFrameRef.current = null;
      }
    }, []);

    const flushPendingSourceJump = useCallback(() => {
      cancelPendingSourceJumpFrame();

      const flush = () => {
        const line = pendingSourceJumpLineRef.current;
        if (line === null) {
          pendingSourceJumpFrameRef.current = null;
          pendingSourceJumpAttemptsRef.current = 0;
          return;
        }

        if (viewModeRef.current === 'preview' || !editorRef.current) {
          pendingSourceJumpAttemptsRef.current += 1;
          if (pendingSourceJumpAttemptsRef.current >= MAX_PENDING_SOURCE_JUMP_FRAMES) {
            pendingSourceJumpLineRef.current = null;
            pendingSourceJumpFrameRef.current = null;
            pendingSourceJumpAttemptsRef.current = 0;
            onNotice?.(t('editor.preview.sourceLocateFailed'));
            return;
          }
          pendingSourceJumpFrameRef.current = requestAnimationFrame(flush);
          return;
        }

        pendingSourceJumpLineRef.current = null;
        pendingSourceJumpFrameRef.current = null;
        pendingSourceJumpAttemptsRef.current = 0;
        editorRef.current.jumpToLine(line);
      };

      pendingSourceJumpFrameRef.current = requestAnimationFrame(flush);
    }, [cancelPendingSourceJumpFrame, onNotice]);

    const queueSourceJump = useCallback((line: number) => {
      pendingSourceJumpLineRef.current = line;
      pendingSourceJumpAttemptsRef.current = 0;
      setEditorActivated(true);
      flushPendingSourceJump();
    }, [flushPendingSourceJump]);

    useEffect(() => {
      if (viewMode !== 'preview') {
        flushPendingSourceJump();
      }
    }, [flushPendingSourceJump, viewMode]);

    useEffect(() => {
      return () => {
        cancelPendingSourceJumpFrame();
      };
    }, [cancelPendingSourceJumpFrame]);

    useEffect(() => {
      searchParamsRef.current = searchParams;
    }, [searchParams]);

    useEffect(() => {
      searchCurrentMatchRef.current = searchCurrentMatch;
    }, [searchCurrentMatch]);

    useEffect(() => {
      contentRef.current = content;
    }, [content]);

    useEffect(() => {
      viewModeRef.current = viewMode;
      if (viewMode !== 'preview') {
        setEditorActivated(true);
      }
    }, [viewMode]);

    useEffect(() => {
      const preview = previewContainerRef.current;
      const cache = previewScrollMapCacheRef.current;
      cache.invalidate();
      if (!preview || viewMode === 'edit') return;

      const invalidate = () => cache.invalidate();
      const observer = new MutationObserver(invalidate);
      observer.observe(preview, {
        attributes: true,
        attributeFilter: ['class', 'data-line', 'data-source-line', 'src', 'style'],
        childList: true,
        subtree: true,
      });

      const resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(invalidate)
        : null;
      resizeObserver?.observe(preview);
      const write = preview.querySelector<HTMLElement>('#write');
      if (write) resizeObserver?.observe(write);
      preview.addEventListener('load', invalidate, true);

      return () => {
        observer.disconnect();
        resizeObserver?.disconnect();
        preview.removeEventListener('load', invalidate, true);
      };
    }, [viewMode, content]);

    useEffect(() => {
      scrollStateRef.current = scrollState;
    }, [scrollState]);

    useEffect(() => {
      const frame = requestAnimationFrame(() => {
        const remembered = scrollStateRef.current;
        if (!remembered) return;

        if (viewModeRef.current !== 'preview') {
          editorRef.current?.setScrollRatio(remembered.editorRatio);
        }

        if (viewModeRef.current !== 'edit') {
          const preview = previewContainerRef.current;
          if (preview) setScrollRatio(preview, remembered.previewRatio);
        }
      });

      return () => cancelAnimationFrame(frame);
    }, [viewMode]);

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      jumpToLine: (line) => {
        editorRef.current?.jumpToLine(line);
        const preview = previewContainerRef.current;
        if (preview) {
          const target = findPreviewElementForSourceLine(preview, line);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('preview-line-flash');
            setTimeout(() => {
              target.classList.remove('preview-line-flash');
            }, PREVIEW_SOURCE_FLASH_MS);
          }
        }
      },
      setScrollRatio: (ratio) => editorRef.current?.setScrollRatio(ratio),
      scrollToLine: (line) => editorRef.current?.scrollToLine(line),
      execSearch: (action, params) => editorRef.current?.execSearch?.(action, params),
      restoreSearch: (params, currentMatch) => editorRef.current?.restoreSearch?.(params, currentMatch),
      getSelectedText: () => editorRef.current?.getSelectedText?.() ?? '',
    }));

    useEffect(() => {
      if (viewMode === 'preview') return;
      const frame = requestAnimationFrame(() => {
        editorRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }, [viewMode]);

    const getPreviewRawSelectedText = useCallback(() => {
      const selection = window.getSelection();
      const preview = previewContainerRef.current?.querySelector<HTMLElement>('#write');
      if (!selection || selection.isCollapsed || !preview || !selection.anchorNode) return '';
      if (!preview.contains(selection.anchorNode)) return '';
      return selection.toString();
    }, []);

    const getPreviewSelectedText = useCallback(() => {
      return normalizeSelectionSeed(getPreviewRawSelectedText());
    }, [getPreviewRawSelectedText]);

    const getPreviewContextMenuItems = useCallback((hasSelection: boolean, line: number | null): ContextMenuItem[] => {
      const exportItems = getCommandMenuItems(
        ['exportWithPrevious', 'exportOverwritePrevious', 'exportPdf', 'exportDocx', 'exportHtml', 'exportPng'],
        createReadonlyCommandContext(),
      ) as ContextMenuItem[];
      const presentationItems = getCommandMenuItems(
        ['presentationMode'],
        createReadonlyCommandContext(),
      ) as ContextMenuItem[];

      return [
        { label: t('command.copy'), action: 'copy', shortcut: '⌘C', disabled: !hasSelection },
        { label: t('command.selectAll'), action: 'selectAll', shortcut: '⌘A' },
        { type: 'separator' },
        {
          label: t('menu.copyAs'),
          children: [
            { label: t('menu.plainText'), action: 'copyPlain' },
            { label: 'Markdown', action: 'copyMd' },
            { label: 'HTML', action: 'copyHtml' },
          ],
        },
        { label: t('editor.context.locateSource'), action: 'locateSource', disabled: line === null },
        { type: 'separator' },
        ...presentationItems,
        { type: 'separator' },
        {
          label: t('common.export'),
          children: exportItems,
        },
      ];
    }, []);

    const jumpToSourceLine = useCallback((line: number) => {
      if (viewModeRef.current === 'preview') {
        queueSourceJump(line);
        useDocumentStore.getState().setViewMode('split');
        return;
      }
      if (!editorRef.current) {
        queueSourceJump(line);
        return;
      }
      editorRef.current?.jumpToLine(line);
    }, [queueSourceJump]);

    const handlePreviewContextMenu = useCallback((event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const target = event.target instanceof Element ? event.target : null;
      const sourceLine = findSourceLineElement(target, previewContainerRef.current);

      setPreviewContextMenu({
        x: event.clientX,
        y: event.clientY,
        hasSelection: Boolean(normalizeSelectionSeed(getPreviewRawSelectedText())),
        line: sourceLine?.line ?? null,
      });
    }, [getPreviewRawSelectedText]);

    const handlePreviewClick = useCallback((event: React.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const taskCheckbox = findPreviewTaskCheckbox(target);
      if (taskCheckbox) {
        event.stopPropagation();
        const sourceLine = findSourceLineElement(taskCheckbox, previewContainerRef.current)?.line
          ?? parseFiniteNumber(taskCheckbox.getAttribute('data-source-line') ?? taskCheckbox.getAttribute('data-line'));
        const checkboxIndex = parseFiniteNumber(taskCheckbox.getAttribute('data-task-checkbox-index'));
        const checked = taskCheckbox.checked;
        const nextContent = updateTaskCheckboxMarkdown(contentRef.current, {
          checked,
          checkboxIndex,
          sourceLine,
        });

        if (nextContent !== null) {
          const listItem = taskCheckbox.closest('li');
          listItem?.classList.toggle('strike', checked);
          onChange(nextContent);
        }
        return;
      }

      const explicitSourceLine = findPreviewSourceAction(target);
      if (explicitSourceLine !== null) {
        event.preventDefault();
        jumpToSourceLine(explicitSourceLine);
        return;
      }

      if (isInteractivePreviewTarget(target)) return;

      const preview = previewContainerRef.current?.querySelector<HTMLElement>('#write');
      const selection = window.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        preview &&
        selection.anchorNode &&
        preview.contains(selection.anchorNode)
      ) {
        return;
      }

      const sourceLine = findSourceLineElement(target, previewContainerRef.current);
      if (!sourceLine) return;
      if (!event.metaKey && !event.ctrlKey && !event.altKey) return;
      event.preventDefault();
      jumpToSourceLine(sourceLine.line);
    }, [jumpToSourceLine, onChange]);

    const handlePreviewContextMenuAction = useCallback(async (action: string) => {
      const preview = previewContainerRef.current?.querySelector<HTMLElement>('#write') ?? null;
      const selectedText = getPreviewRawSelectedText();

      switch (action) {
        case 'copy':
          await copyText(selectedText);
          break;
        case 'selectAll':
          if (preview) {
            const range = document.createRange();
            range.selectNodeContents(preview);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
          break;
        case 'copyPlain':
          await copyText(selectedText || preview?.innerText || '');
          break;
        case 'copyMd':
          await copyText(contentRef.current);
          break;
        case 'copyHtml': {
          const serializedPreviewHtml = getSerializedSelectionHtml(preview) || preview?.innerHTML || '';
          const html = serializedPreviewHtml || (await import('../../../lib/markdownToHtml'))
            .markdownToHtml(contentRef.current);
          await writeRichClipboard(previewHtmlToRichClipboardInput(
            html,
            selectedText || preview?.innerText || contentRef.current,
          ));
          break;
        }
        case 'locateSource': {
          const line = previewContextMenu?.line;
          if (line === null || line === undefined) break;
          jumpToSourceLine(line);
          break;
        }
        case 'exportPdf':
        case 'exportDocx':
        case 'exportHtml':
        case 'exportPng':
        case 'exportWithPrevious':
        case 'exportOverwritePrevious':
        case 'presentationMode':
          dispatchCommand(action);
          break;
      }
    }, [getPreviewRawSelectedText, jumpToSourceLine, previewContextMenu?.line]);

    const getSearchSeed = useCallback(() => {
      if (viewModeRef.current !== 'preview') {
        const editorSeed = normalizeSelectionSeed(editorRef.current?.getSelectedText?.() ?? '');
        if (editorSeed) return editorSeed;
      }

      return getPreviewSelectedText();
    }, [getPreviewSelectedText]);

    const activateSearch = useCallback((mode: SearchMode) => {
      if (mode === 'replace' && viewModeRef.current === 'preview') {
        useDocumentStore.getState().setViewMode('split');
      }

      const seed = getSearchSeed();
      setSearchMode(mode);
      setSearchVisible(true);
      setSearchActivationKey((key) => key + 1);

      if (!seed) return;

      const params = {
        ...searchParamsRef.current,
        query: seed,
      };
      const localMatchState = countMatches(
        contentRef.current,
        params.query,
        params.matchCase,
        params.regexp,
        params.wholeWord,
      );
      const count = localMatchState.invalid ? 0 : localMatchState.count;
      const nextCurrent = count > 0 ? 1 : 0;

      setSearchParams(params);
      setSearchMatchCount(count);
      setSearchCurrentMatch(nextCurrent);
      searchParamsRef.current = params;
      searchCurrentMatchRef.current = nextCurrent;

      if (viewModeRef.current !== 'preview') {
        editorRef.current?.execSearch?.('input', params);
      }

      if (viewModeRef.current !== 'edit') {
        schedulePreviewSearch(params, nextCurrent, { progressive: true });
      }
    }, [getSearchSeed, schedulePreviewSearch]);

    const closeSearch = useCallback(() => {
      setSearchVisible(false);
      setSearchParams(DEFAULT_SEARCH_PARAMS);
      setSearchMatchCount(0);
      setSearchCurrentMatch(0);
      searchParamsRef.current = DEFAULT_SEARCH_PARAMS;
      searchCurrentMatchRef.current = 0;
      cancelPreviewSearchWork();
      const preview = previewContainerRef.current;
      if (preview) clearPreviewSearchMarks(preview);
      if (viewModeRef.current !== 'preview') {
        editorRef.current?.execSearch?.('input', DEFAULT_SEARCH_PARAMS);
      }
    }, [cancelPreviewSearchWork]);

    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'c' && !e.shiftKey && !e.altKey && viewModeRef.current === 'preview') {
          const selectedText = getPreviewRawSelectedText();
          if (selectedText) {
            e.preventDefault();
            e.stopPropagation();
            void copyText(selectedText);
            return;
          }
        }
        if ((e.ctrlKey || e.metaKey) && key === 'f' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          activateSearch('find');
        }
        if ((e.ctrlKey || e.metaKey) && key === 'h') {
          e.preventDefault();
          e.stopPropagation();
          activateSearch('replace');
        }
      };
      window.addEventListener('keydown', handleGlobalKeyDown, true);
      const unsubscribeSearch = onAppEvent('search.open', ({ action, rootPath }) => {
        if (rootPath || action === 'workspace') {
          closeSearch();
          return;
        }
        activateSearch(action === 'replace' ? 'replace' : 'find');
      });
      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown, true);
        unsubscribeSearch();
      };
    }, [activateSearch, closeSearch, getPreviewRawSelectedText]);

    useEffect(() => {
      return onAppEvent('presentation.open', () => {
        if (!hasPresentationSlides(contentRef.current)) {
          onNotice?.(t('presentation.requiresSlides'));
          return;
        }
        setPresentationVisible(true);
      });
    }, [onNotice]);

    const handleSearch = (action: SearchAction, params: SearchParams) => {
      const localMatchState = countMatches(content, params.query, params.matchCase, params.regexp, params.wholeWord);
      const count = localMatchState.invalid ? 0 : localMatchState.count;
      const previousCurrent = searchCurrentMatchRef.current;
      let nextCurrent = previousCurrent;

      if (!params.query || count === 0) {
        nextCurrent = 0;
      } else if (action === 'input') {
        nextCurrent = 1;
      } else if (action === 'next') {
        nextCurrent = previousCurrent >= count ? 1 : previousCurrent + 1;
      } else if (action === 'prev') {
        nextCurrent = previousCurrent <= 1 ? count : previousCurrent - 1;
      } else if (action === 'replace') {
        nextCurrent = previousCurrent >= count ? 1 : Math.max(previousCurrent, 1);
      } else if (action === 'replaceAll') {
        nextCurrent = 0;
      } else if (previousCurrent <= 0 || previousCurrent > count) {
        nextCurrent = 1;
      }

      setSearchParams(params);
      setSearchMatchCount(count);
      setSearchCurrentMatch(nextCurrent);
      searchParamsRef.current = params;
      searchCurrentMatchRef.current = nextCurrent;

      if (viewMode !== 'preview') {
        editorRef.current?.execSearch?.(action, params);
      }

      if (viewMode !== 'edit') {
        schedulePreviewSearch(params, nextCurrent, {
          debounce: action === 'input' && Boolean(params.query),
          progressive: action === 'input',
          scrollToCurrent: action === 'next' || action === 'prev',
        });
      }
    };

    useEffect(() => {
      const params = searchParamsRef.current;
      if (!params.query) {
        setSearchMatchCount(0);
        setSearchCurrentMatch(0);
        searchCurrentMatchRef.current = 0;
        return;
      }

      const localMatchState = countMatches(content, params.query, params.matchCase, params.regexp, params.wholeWord);
      const count = localMatchState.invalid ? 0 : localMatchState.count;
      const nextCurrent = count === 0
        ? 0
        : Math.min(Math.max(searchCurrentMatchRef.current || 1, 1), count);

      setSearchMatchCount(count);
      setSearchCurrentMatch(nextCurrent);
      searchCurrentMatchRef.current = nextCurrent;
    }, [content]);

    useEffect(() => {
      if (!searchVisible || !searchParams.query) return;

      const frame = requestAnimationFrame(() => {
        const params = searchParamsRef.current;
        const current = searchCurrentMatchRef.current;

        if (viewMode !== 'preview') {
          editorRef.current?.restoreSearch?.(params, current);
        }

        if (viewMode !== 'edit') {
          schedulePreviewSearch(params, current, { progressive: true });
        }
      });

      return () => cancelAnimationFrame(frame);
    }, [viewMode, content, searchVisible, schedulePreviewSearch]);

    // 设置同步锁，100ms 后自动释放
    const markSyncing = (direction: 'editor' | 'preview') => {
      syncingRef.current = direction;
      if (syncingTimerRef.current !== null) {
        clearTimeout(syncingTimerRef.current);
      }
      syncingTimerRef.current = window.setTimeout(() => {
        syncingRef.current = null;
        syncingTimerRef.current = null;
      }, 100);
    };

    // 编辑器 → 预览
    const syncPreviewByEditor = (topLine: number) => {
      if (syncingRef.current === 'preview') return; // 预览正在驱动编辑器，忽略
      const preview = previewContainerRef.current;
      if (!preview) return;
      const scrollMap = previewScrollMapCacheRef.current.get(preview);
      const targetScroll = lineToPreviewScrollTopInMap(topLine, scrollMap);
      if (targetScroll === null) return;
      if (Math.abs(preview.scrollTop - targetScroll) < 1) return;
      markSyncing('editor');
      preview.scrollTop = Math.max(0, targetScroll);
    };

    const handleEditorScrollRatioChange = (ratio: number) => {
      onScrollStateChange?.({ editorRatio: Math.max(0, Math.min(1, ratio)) });
    };

    // 预览 → 编辑器
    const handlePreviewScroll = () => {
      const preview = previewContainerRef.current;
      if (!preview) return;
      onScrollStateChange?.({ previewRatio: getScrollRatio(preview) });
      if (!shouldSyncPreviewScrollToEditor(viewModeRef.current)) return;
      if (syncingRef.current === 'editor') return; // 编辑器正在驱动预览，忽略
      const scrollMap = previewScrollMapCacheRef.current.get(preview);
      const line = pageOffsetToLineInMap(preview.scrollTop, scrollMap);
      if (line === null) return;
      markSyncing('preview');
      editorRef.current?.scrollToLine?.(Math.round(line));
    };

    const isPreviewOnly = viewMode === 'preview';
    const showPreview = viewMode !== 'edit';
    const isSplit = viewMode === 'split';
    const shouldRenderEditor = viewMode !== 'preview' || editorActivated;
    const getPreviewScroller = useCallback(() => previewContainerRef.current, []);

    return (
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, backgroundColor: 'transparent', position: 'relative' }}>
        {shouldRenderEditor && (
          <div
            aria-hidden={isPreviewOnly}
            style={{
              flex: isSplit ? 1 : '1 1 auto',
              minWidth: 0,
              display: isPreviewOnly ? 'none' : 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRight: isSplit ? '1px solid var(--border-color)' : '0',
              background: 'var(--bg-editor)',
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Suspense fallback={null}>
                <EditorPane
                  ref={editorRef}
                  content={content}
                  onChange={onChange}
                  onCursorChange={onCursorChange}
                  onSelectionTextChange={onSelectionTextChange}
                  onNotice={onNotice}
                  onScrollRatioChange={handleEditorScrollRatioChange}
                  onTopLineChange={isSplit ? syncPreviewByEditor : undefined}
                  workspaceIndex={workspaceIndex}
                  workspaceIndexJobId={workspaceIndexJobId}
                />
              </Suspense>
            </div>
          </div>
        )}

        {showPreview && (
          <div
            className="prism-scrollbar-host"
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              background: 'var(--bg-preview)',
            }}
          >
            <div
              ref={previewContainerRef}
              onScroll={handlePreviewScroll}
              onClick={handlePreviewClick}
              onContextMenu={handlePreviewContextMenu}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <PreviewPane
                content={content}
                documentPath={documentPath}
                renderStrategy={isPreviewOnly ? 'immediate' : 'deferred'}
                onNotice={onNotice}
                onOpenDocumentLink={onOpenDocumentLink}
              />
            </div>
            <HorizontalScrollbar getScroller={getPreviewScroller} />
          </div>
        )}

        <SearchPanel
          visible={searchVisible}
          viewMode={viewMode}
          content={content}
          mode={searchMode}
          initialQuery={searchParams.query}
          initialReplaceWith={searchParams.replaceWith}
          matchCount={searchMatchCount}
          currentMatch={searchCurrentMatch}
          activationKey={searchActivationKey}
          onClose={closeSearch}
          onSearch={handleSearch}
          onModeChange={setSearchMode}
        />

        {previewContextMenu && (
          <ContextMenu
            x={previewContextMenu.x}
            y={previewContextMenu.y}
            items={getPreviewContextMenuItems(previewContextMenu.hasSelection, previewContextMenu.line)}
            onAction={handlePreviewContextMenuAction}
            onClose={() => setPreviewContextMenu(null)}
          />
        )}

        {presentationVisible && (
          <PresentationOverlay
            content={content}
            documentPath={documentPath}
            onClose={() => setPresentationVisible(false)}
            onNotice={onNotice}
            onOpenDocumentLink={onOpenDocumentLink}
          />
        )}
      </div>
    );
  },
);
