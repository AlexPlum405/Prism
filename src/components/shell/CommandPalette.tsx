import { useState, useEffect, useMemo, useRef } from 'react';
import type { FileNode } from '../../domains/workspace/types';
import { rankQuickOpenFiles, type QuickOpenRecentFile } from '../../domains/workspace/services/quickOpen';
import {
  rankWorkspaceIndexDocuments,
  searchWorkspaceIndex,
  type WorkspaceIndex,
  type WorkspaceIndexSearchResult,
} from '../../domains/workspace/services/workspaceIndexQuery';
import { queryWorkspaceIndexNativeModel } from '../../domains/workspace/services/workspaceIndexNative';
import { isNativeCommandUnavailableError } from '../../platform/tauri/result';
import { t, useI18n } from '../../domains/i18n';

export type CommandPaletteMode = 'files' | 'search';

interface CommandPaletteProps {
  visible: boolean;
  files?: FileNode[];
  workspaceRoot?: string | null;
  recentFiles?: QuickOpenRecentFile[];
  currentDocument?: { path: string; content: string } | null;
  workspaceIndex?: WorkspaceIndex | null;
  workspaceIndexing?: boolean;
  mode?: CommandPaletteMode;
  onClose: () => void;
  onExecute: (commandId: string) => void;
}

interface CommandPaletteItem {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
}

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7" cy="7" r="5" />
    <path d="M11 11l3 3" />
  </svg>
);

export function CommandPalette({
  visible,
  files = [],
  workspaceRoot = null,
  recentFiles = [],
  currentDocument = null,
  workspaceIndex = null,
  workspaceIndexing = false,
  mode = 'files',
  onClose,
  onExecute,
}: CommandPaletteProps) {
  const { locale } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [nativeItems, setNativeItems] = useState<{ items: CommandPaletteItem[]; key: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nativeQueryDisabledRef = useRef(false);
  const nativeQueryRequestRef = useRef(0);
  const recentFilesKey = useMemo(
    () => recentFiles.map((file) => `${file.path}:${file.lastOpened}`).join('\n'),
    [recentFiles],
  );
  const currentDocumentOverride = currentDocument?.path
    ? { path: currentDocument.path, content: currentDocument.content }
    : null;
  const nativeQueryKey = [
    mode,
    query,
    workspaceRoot ?? '',
    recentFilesKey,
    currentDocumentOverride?.path ?? '',
    currentDocumentOverride?.content.length ?? 0,
  ].join('\n');

  const quickOpenItems = useMemo(() => {
    if (workspaceIndex) {
      return quickOpenResultsToItems(rankWorkspaceIndexDocuments(workspaceIndex, query, 30));
    }
    return rankQuickOpenFiles(files, query, 30, workspaceRoot, recentFiles).map((result) => ({
      id: `openWorkspaceFile:${encodeURIComponent(result.node.path)}`,
      label: result.node.name,
      category: result.folderLabel || t('palette.workspaceFile'),
      shortcut: undefined,
    }));
  }, [files, locale, query, recentFiles, workspaceIndex, workspaceRoot]);
  const workspaceSearchItems = useMemo(() => (
    workspaceIndex
      ? searchResultsToItems(searchWorkspaceIndex(workspaceIndex, query, 40))
      : []
  ), [locale, query, workspaceIndex]);
  const fallbackVisibleItems = useMemo(() => {
    if (mode === 'files') return quickOpenItems;
    return workspaceSearchItems;
  }, [mode, quickOpenItems, workspaceSearchItems]);
  const visibleItems = useMemo(() => {
    if (nativeItems?.key === nativeQueryKey) return nativeItems.items;
    return fallbackVisibleItems;
  }, [fallbackVisibleItems, nativeItems, nativeQueryKey]);
  const placeholder = mode === 'files'
    ? t('palette.searchFilesPlaceholder')
    : t('palette.searchWorkspacePlaceholder');
  const title = mode === 'files' ? t('palette.quickOpen') : t('palette.fullTextSearch');
  const hint = mode === 'files'
    ? t('palette.filesHint')
    : t('palette.searchHint');
  const emptyText = mode === 'files'
    ? workspaceIndexing ? t('palette.indexing') : t('palette.noFiles')
    : workspaceIndexing ? t('palette.indexing') : t('palette.noContent');

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, mode]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (!visible || !workspaceRoot || nativeQueryDisabledRef.current) {
      setNativeItems(null);
      return undefined;
    }

    let cancelled = false;
    const requestId = nativeQueryRequestRef.current + 1;
    nativeQueryRequestRef.current = requestId;

    const run = async () => {
      try {
        const results = await queryWorkspaceIndexNativeModel({
          rootPath: workspaceRoot,
          query,
          limit: mode === 'files' ? 30 : 40,
          mode: mode === 'files' ? 'quickOpen' : 'fullText',
          currentDocumentOverride,
          recentFiles,
        });
        if (cancelled || nativeQueryRequestRef.current !== requestId) return;
        setNativeItems(results
          ? {
              key: nativeQueryKey,
              items: mode === 'files' ? quickOpenResultsToItems(results) : searchResultsToItems(results),
            }
          : null);
      } catch (error) {
        if (cancelled || nativeQueryRequestRef.current !== requestId) return;
        if (isNativeCommandUnavailableError(error)) {
          nativeQueryDisabledRef.current = true;
        } else {
          console.warn('[CommandPalette] Native workspace query unavailable, falling back to TypeScript:', error);
        }
        setNativeItems(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    currentDocumentOverride?.content,
    currentDocumentOverride?.path,
    mode,
    nativeQueryKey,
    query,
    recentFiles,
    visible,
    workspaceRoot,
  ]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => visibleItems.length === 0 ? 0 : Math.min(prev + 1, visibleItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visibleItems[selectedIndex]) {
          onExecute(visibleItems[selectedIndex].id);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, selectedIndex, visibleItems, onClose, onExecute]);

  if (!visible) return null;

  const renderItem = (cmd: CommandPaletteItem, index: number) => (
    <div
      key={cmd.id}
      className={`cmdk-item ${index === selectedIndex ? 'selected' : ''}`}
      onClick={() => { onExecute(cmd.id); onClose(); }}
      onMouseEnter={() => setSelectedIndex(index)}
    >
      <div className="cmdk-item-main">
        <span className="cmdk-label">{cmd.label}</span>
        <span className="cmdk-cat">{cmd.category}</span>
      </div>
      {cmd.shortcut && (
        <span className="cmdk-shortcut">
          {cmd.shortcut.split('+').map((k, j) => (
            <span key={j} className="kbd">{k}</span>
          ))}
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className="cmdk-overlay" onClick={onClose} />
      <div className="cmdk" role="dialog" aria-label={mode === 'files' ? t('palette.quickOpen') : t('palette.aria.fullTextSearch')}>
        <div className="cmdk-titlebar">
          <span className="cmdk-title">{title}</span>
          <span className="cmdk-hint">{hint}</span>
        </div>
        <div className="cmdk-search">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="cmdk-input"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmdk-list">
          {visibleItems.length === 0 ? (
            <div className="cmdk-empty">{emptyText}</div>
          ) : (
            visibleItems.map(renderItem)
          )}
        </div>
      </div>
    </>
  );
}

function searchMatchLabel(match: WorkspaceIndexSearchResult['match']) {
  switch (match) {
    case 'title':
      return t('palette.match.title');
    case 'name':
      return t('palette.match.name');
    case 'path':
      return t('palette.match.path');
    case 'heading':
      return t('palette.match.heading');
    case 'content':
      return t('palette.match.content');
    default:
      return undefined;
  }
}

function quickOpenResultsToItems(results: WorkspaceIndexSearchResult[]): CommandPaletteItem[] {
  return results.map((result) => ({
    id: `openWorkspaceFile:${encodeURIComponent(result.document.path)}`,
    label: result.document.title || result.document.name,
    category: result.snippet || result.document.relativePath,
    shortcut: result.match === 'heading' ? t('palette.match.title') : undefined,
  }));
}

function searchResultsToItems(results: WorkspaceIndexSearchResult[]): CommandPaletteItem[] {
  return results.map((result) => ({
    id: `openWorkspaceFile:${encodeURIComponent(result.document.path)}`,
    label: result.document.title || result.document.name,
    category: searchCategoryLabel(result),
    shortcut: searchMatchLabel(result.match),
  }));
}

function searchCategoryLabel(result: WorkspaceIndexSearchResult) {
  const path = result.document.relativePath;
  if (result.match === 'content' && result.snippet) return `${path} · ${result.snippet}`;
  if (result.match === 'heading' && result.snippet) return `${path} · ${result.snippet}`;
  return path;
}
