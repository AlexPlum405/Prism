import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorPane, EditorPaneHandle } from './EditorPane';
import { HorizontalScrollbar } from './HorizontalScrollbar';
import { PreviewPane } from './PreviewPane';
import { buildSearchPattern, countMatches, SearchAction, SearchMode, SearchPanel, SearchParams } from './SearchPanel';
import { ContextMenu, type ContextMenuItem } from '../../../components/shell/ContextMenu';
import { useDocumentStore } from '../../document/store';
import type { DocumentScrollState } from '../../document/types';
import { useSettingsStore } from '../../settings/store';
import { useWorkspaceStore } from '../../workspace/store';
import type { WorkspaceIndex } from '../../workspace/services';
import { markdownToHtml } from '../../../lib/markdownToHtml';
import { getCommandMenuItems, type CommandContext } from '../../commands';
import { t } from '../../i18n';
import { previewHtmlToRichClipboardInput, writeRichClipboard } from '../extensions/richCopy';
import { emitAppEvent, onAppEvent } from '../../../platform/events/appEvents';

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
}

const DEFAULT_SEARCH_PARAMS: SearchParams = {
  query: '',
  replaceWith: '',
  matchCase: false,
  regexp: false,
  wholeWord: false,
};

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

// 借鉴 VSCode markdown preview scroll-sync 算法
// 参考：https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/preview-src/scroll-sync.ts

export interface CodeLineElement {
  element: HTMLElement;
  line: number;
  endLine?: number;
}

function readSourceLine(element: HTMLElement): number | null {
  const raw = element.getAttribute('data-source-line') ?? element.getAttribute('data-line');
  const line = raw ? Number(raw) : NaN;
  return Number.isFinite(line) ? line : null;
}

function findSourceLineElement(target: Element | null): { element: HTMLElement; line: number } | null {
  const element = target?.closest<HTMLElement>('[data-source-line], [data-line]');
  if (!element) return null;
  const line = readSourceLine(element);
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

function getScrollRatio(element: HTMLElement): number {
  const maxScroll = element.scrollHeight - element.clientHeight;
  return maxScroll > 0 ? element.scrollTop / maxScroll : 0;
}

function setScrollRatio(element: HTMLElement, ratio: number) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  element.scrollTop = Math.max(0, Math.min(1, ratio)) * Math.max(0, maxScroll);
}

export function collectCodeLineElements(preview: HTMLElement): CodeLineElement[] {
  const elements: CodeLineElement[] = [];
  const nodes = preview.querySelectorAll<HTMLElement>('[data-source-line], [data-line]');
  nodes.forEach((el) => {
    const line = readSourceLine(el);
    if (line === null) return;

    // 代码块特殊处理：计算 endLine
    if (el.tagName === 'PRE') {
      const codeEl = el.querySelector('code');
      if (codeEl) {
        const text = codeEl.textContent || '';
        const lineCount = (text.match(/\n/g) || []).length + 1;
        elements.push({ element: el, line, endLine: line + lineCount - 1 });
        return;
      }
    }
    // 列表容器跳过（子元素会被单独处理）
    if (el.tagName === 'UL' || el.tagName === 'OL') return;

    elements.push({ element: el, line });
  });
  elements.sort((a, b) => a.line - b.line);
  return elements;
}

function getElementTop(element: HTMLElement, preview: HTMLElement): number {
  return element.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop;
}

// 源码行号 → 预览 scrollTop
export function lineToPreviewScrollTop(line: number, elements: CodeLineElement[], preview: HTMLElement): number | null {
  if (elements.length === 0) return null;
  if (line <= elements[0].line) return 0;

  // 找到包含这一行的元素
  let previous: CodeLineElement | null = null;
  let next: CodeLineElement | null = null;
  for (const entry of elements) {
    if (entry.line === line) {
      previous = entry;
      break;
    } else if (entry.line > line) {
      next = entry;
      break;
    }
    previous = entry;
  }
  if (!previous) return null;

  const previousTop = getElementTop(previous.element, preview);
  const previousHeight = previous.element.offsetHeight;

  // 代码块内部：按行号比例映射
  if (previous.endLine && previous.endLine > previous.line && line < previous.endLine) {
    const progress = (line - previous.line) / (previous.endLine - previous.line);
    return previousTop + previousHeight * progress;
  }

  // 代码块之后但在下一个元素之前
  if (previous.endLine && next && next.line !== previous.line) {
    const progress = (line - previous.endLine) / (next.line - previous.endLine);
    const nextTop = getElementTop(next.element, preview);
    return (previousTop + previousHeight) + progress * (nextTop - (previousTop + previousHeight));
  }

  // 普通：两个元素之间按比例
  if (next && next.line !== previous.line) {
    const progress = (line - previous.line) / (next.line - previous.line);
    const nextTop = getElementTop(next.element, preview);
    return (previousTop + previousHeight) + progress * (nextTop - (previousTop + previousHeight));
  }

  return previousTop;
}

// 预览 scrollTop → 源码行号（二分查找）
export function pageOffsetToLine(scrollTop: number, elements: CodeLineElement[], preview: HTMLElement): number | null {
  if (elements.length === 0) return null;

  // 过滤掉不参与布局的元素。这里不调用 getComputedStyle，避免长文预览滚动时
  // 每次 scroll 都触发布局样式读取；display:none 的 block 会表现为 0 高度。
  const visible = elements.filter((e) => {
    return e.element.offsetHeight > 0;
  });
  if (visible.length === 0) return null;

  // 二分查找：找到 top <= scrollTop 的最后一个元素
  let previousIndex = 0;
  let lo = 0;
  let hi = visible.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const top = getElementTop(visible[mid].element, preview);
    if (top <= scrollTop) {
      previousIndex = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const previous = visible[previousIndex];
  const next = visible[previousIndex + 1];

  const previousTop = getElementTop(previous.element, preview);
  const previousHeight = previous.element.offsetHeight;
  const offsetFromPrevious = scrollTop - previousTop;

  // 代码块内部：按高度比例映射回行号
  if (previous.endLine && previous.endLine > previous.line) {
    if (offsetFromPrevious >= 0 && offsetFromPrevious <= previousHeight) {
      const progress = offsetFromPrevious / previousHeight;
      return previous.line + progress * (previous.endLine - previous.line);
    }
  }

  if (next) {
    const nextTop = getElementTop(next.element, preview);
    const progress = offsetFromPrevious / (nextTop - previousTop);
    const startLine = previous.endLine ?? previous.line;
    return startLine + progress * (next.line - startLine);
  }

  return previous.line;
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

function applyPreviewSearch(
  preview: HTMLElement | null,
  params: SearchParams,
  currentMatch: number,
) {
  if (!preview) return { count: 0, current: 0 };

  clearPreviewSearchMarks(preview);

  const write = preview.querySelector<HTMLElement>('#write');
  if (!write || !params.query) return { count: 0, current: 0 };

  const pattern = buildSearchPattern(params.query, params.matchCase, params.regexp, params.wholeWord);
  if (!pattern || pattern === 'invalid') return { count: 0, current: 0 };

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

  const occurrences: Array<{ node: Text; from: number; to: number }> = [];
  for (const node of textNodes) {
    const text = node.data;
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }

      occurrences.push({
        node,
        from: match.index,
        to: match.index + match[0].length,
      });
    }
  }

  const count = occurrences.length;
  if (count === 0) return { count: 0, current: 0 };

  const normalizedCurrent = Math.min(Math.max(currentMatch || 1, 1), count);
  const occurrencesByNode = new Map<Text, Array<{ from: number; to: number; index: number }>>();

  occurrences.forEach((occurrence, index) => {
    const entries = occurrencesByNode.get(occurrence.node) ?? [];
    entries.push({ ...occurrence, index: index + 1 });
    occurrencesByNode.set(occurrence.node, entries);
  });

  let currentElement: HTMLElement | null = null;
  for (const [node, entries] of occurrencesByNode) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const entry of entries) {
      if (entry.from > cursor) {
        fragment.appendChild(document.createTextNode(node.data.slice(cursor, entry.from)));
      }

      const mark = document.createElement('span');
      mark.className = entry.index === normalizedCurrent
        ? 'preview-search-match preview-search-match--current'
        : 'preview-search-match';
      mark.textContent = node.data.slice(entry.from, entry.to);
      fragment.appendChild(mark);

      if (entry.index === normalizedCurrent) {
        currentElement = mark;
      }

      cursor = entry.to;
    }

    if (cursor < node.data.length) {
      fragment.appendChild(document.createTextNode(node.data.slice(cursor)));
    }

    node.replaceWith(fragment);
  }

  currentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });

  return { count, current: normalizedCurrent };
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
    const searchParamsRef = useRef(searchParams);
    const searchCurrentMatchRef = useRef(searchCurrentMatch);
    const contentRef = useRef(content);
    const viewModeRef = useRef(viewMode);
    const scrollStateRef = useRef(scrollState);
    // 同步方向锁：防止反馈循环
    const syncingRef = useRef<'editor' | 'preview' | null>(null);
    const syncingTimerRef = useRef<number | null>(null);

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
    }, [viewMode]);

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
          const target = preview.querySelector(`[data-source-line="${line}"], [data-line="${line}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('preview-line-flash');
            setTimeout(() => {
              target.classList.remove('preview-line-flash');
            }, 2000);
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
        {
          label: t('common.export'),
          children: exportItems,
        },
      ];
    }, []);

    const jumpToSourceLine = useCallback((line: number) => {
      if (viewModeRef.current === 'preview') {
        useDocumentStore.getState().setViewMode('split');
        requestAnimationFrame(() => editorRef.current?.jumpToLine(line));
        return;
      }
      editorRef.current?.jumpToLine(line);
    }, []);

    const handlePreviewContextMenu = useCallback((event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const target = event.target instanceof Element ? event.target : null;
      const sourceLine = findSourceLineElement(target);

      setPreviewContextMenu({
        x: event.clientX,
        y: event.clientY,
        hasSelection: Boolean(normalizeSelectionSeed(getPreviewRawSelectedText())),
        line: sourceLine?.line ?? null,
      });
    }, [getPreviewRawSelectedText]);

    const handlePreviewClick = useCallback((event: React.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

      const target = event.target instanceof Element ? event.target : null;
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

      const sourceLine = findSourceLineElement(target);
      if (!sourceLine) return;
      jumpToSourceLine(sourceLine.line);
    }, [jumpToSourceLine]);

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
        case 'copyHtml':
          await writeRichClipboard(previewHtmlToRichClipboardInput(
            getSerializedSelectionHtml(preview)
            || preview?.innerHTML
            || markdownToHtml(contentRef.current),
            selectedText || preview?.innerText || contentRef.current,
          ));
          break;
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
        applyPreviewSearch(previewContainerRef.current, params, nextCurrent);
      }
    }, [getSearchSeed]);

    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'f') {
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
      const unsubscribeSearch = onAppEvent('search.open', ({ action }) => {
        activateSearch(action === 'replace' ? 'replace' : 'find');
      });
      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown, true);
        unsubscribeSearch();
      };
    }, [activateSearch]);

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
        applyPreviewSearch(previewContainerRef.current, params, nextCurrent);
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
          applyPreviewSearch(previewContainerRef.current, params, current);
        }
      });

      return () => cancelAnimationFrame(frame);
    }, [viewMode, content, searchVisible, searchParams.query]);

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
      const elements = collectCodeLineElements(preview);
      const targetScroll = lineToPreviewScrollTop(topLine, elements, preview);
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
      if (syncingRef.current === 'editor') return; // 编辑器正在驱动预览，忽略
      const elements = collectCodeLineElements(preview);
      const line = pageOffsetToLine(preview.scrollTop, elements, preview);
      if (line === null) return;
      markSyncing('preview');
      editorRef.current?.scrollToLine?.(Math.round(line));
    };

    const isPreviewOnly = viewMode === 'preview';
    const showPreview = viewMode !== 'edit';
    const isSplit = viewMode === 'split';
    const getPreviewScroller = useCallback(() => previewContainerRef.current, []);

    return (
      <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, backgroundColor: 'transparent', position: 'relative' }}>
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
            />
          </div>
        </div>

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
          onClose={() => setSearchVisible(false)}
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
      </div>
    );
  },
);
