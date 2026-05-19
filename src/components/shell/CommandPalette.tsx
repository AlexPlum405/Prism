import { useState, useEffect, useMemo, useRef } from 'react';
import type { FileNode } from '../../domains/workspace/types';
import {
  rankQuickOpenFiles,
  rankWorkspaceIndexDocuments,
  searchWorkspaceIndex,
  type QuickOpenRecentFile,
  type WorkspaceIndex,
  type WorkspaceIndexSearchResult,
} from '../../domains/workspace/services';

export type CommandPaletteMode = 'files' | 'search';

interface CommandPaletteProps {
  visible: boolean;
  files?: FileNode[];
  workspaceRoot?: string | null;
  recentFiles?: QuickOpenRecentFile[];
  workspaceIndex?: WorkspaceIndex | null;
  workspaceIndexing?: boolean;
  mode?: CommandPaletteMode;
  onClose: () => void;
  onExecute: (commandId: string) => void;
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
  workspaceIndex = null,
  workspaceIndexing = false,
  mode = 'files',
  onClose,
  onExecute,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickOpenItems = useMemo(() => {
    if (workspaceIndex) {
      return rankWorkspaceIndexDocuments(workspaceIndex, query, 30).map((result) => ({
        id: `openWorkspaceFile:${encodeURIComponent(result.document.path)}`,
        label: result.document.title || result.document.name,
        category: result.snippet || result.document.relativePath,
        shortcut: result.match === 'heading' ? '标题' : undefined,
      }));
    }
    return rankQuickOpenFiles(files, query, 30, workspaceRoot, recentFiles).map((result) => ({
      id: `openWorkspaceFile:${encodeURIComponent(result.node.path)}`,
      label: result.node.name,
      category: result.folderLabel || '工作区文件',
      shortcut: undefined,
    }));
  }, [files, query, recentFiles, workspaceIndex, workspaceRoot]);
  const workspaceSearchItems = useMemo(() => (
    workspaceIndex
      ? searchWorkspaceIndex(workspaceIndex, query, 40).map((result) => ({
          id: `openWorkspaceFile:${encodeURIComponent(result.document.path)}`,
          label: result.document.title || result.document.name,
          category: searchCategoryLabel(result),
          shortcut: searchMatchLabel(result.match),
        }))
      : []
  ), [query, workspaceIndex]);
  const visibleItems = useMemo(() => {
    if (mode === 'files') return quickOpenItems;
    return workspaceSearchItems;
  }, [mode, quickOpenItems, workspaceSearchItems]);
  const placeholder = mode === 'files'
    ? '搜索工作区文件…'
    : '全文搜索工作区…';
  const title = mode === 'files' ? '快速打开' : '全文搜索';
  const hint = mode === 'files'
    ? '文件、标题、路径'
    : '当前工作区 Markdown';
  const emptyText = mode === 'files'
    ? workspaceIndexing ? '正在建立索引…' : '未找到匹配的文件'
    : workspaceIndexing ? '正在建立索引…' : '未找到匹配的内容';

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, mode]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

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

  const renderItem = (cmd: { id: string; label: string; category: string; shortcut?: string }, index: number) => (
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
      <div className="cmdk" role="dialog" aria-label={mode === 'files' ? '快速打开' : '全文搜索工作区'}>
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
      return '标题';
    case 'name':
      return '文件';
    case 'path':
      return '路径';
    case 'heading':
      return '小标题';
    case 'content':
      return '正文';
    default:
      return undefined;
  }
}

function searchCategoryLabel(result: WorkspaceIndexSearchResult) {
  const path = result.document.relativePath;
  if (result.match === 'content' && result.snippet) return `${path} · ${result.snippet}`;
  if (result.match === 'heading' && result.snippet) return `${path} · ${result.snippet}`;
  return path;
}
