import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { FileNode } from '../../domains/workspace/types';
import {
  rankQuickOpenFiles,
  rankWorkspaceIndexDocuments,
  searchWorkspaceIndex,
  type QuickOpenRecentFile,
  type WorkspaceIndex,
  type WorkspaceIndexSearchResult,
} from '../../domains/workspace/services';

export interface Command {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  keywords?: string[];
}

export type CommandPaletteMode = 'commands' | 'files' | 'search';

interface CommandPaletteProps {
  visible: boolean;
  commands: Command[];
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

const COMMAND_RECENT_STORAGE_KEY = 'prism-command-palette-recent-v1';
const MAX_RECENT_COMMANDS = 5;

const CATEGORY_ORDER = ['文件', '编辑', '插入', '格式', '视图', '主题', '窗口', '帮助'];

const RECOMMENDED_COMMAND_IDS = [
  'quickOpen',
  'workspaceSearch',
  'save',
  'exportWithPrevious',
  'exportPdf',
  'insertTable',
  'formatTable',
  'openDocumentProperties',
  'showBacklinks',
  'splitMode',
  'previewMode',
  'focusMode',
] as const;

interface CommandSection {
  title: string;
  items: Command[];
}

function readRecentCommandIds(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage?.getItem(COMMAND_RECENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeRecentCommandIds(ids: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(COMMAND_RECENT_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Recent commands are a convenience only.
  }
}

function pickCommands(
  commandById: Map<string, Command>,
  ids: readonly string[],
  used: Set<string>,
  limit: number,
): Command[] {
  const items: Command[] = [];
  for (const id of ids) {
    if (items.length >= limit) break;
    if (used.has(id)) continue;
    const command = commandById.get(id);
    if (!command) continue;
    items.push(command);
    used.add(command.id);
  }
  return items;
}

function formatCategoryTitle(category: string, count: number): string {
  return count > 0 ? `${category} · ${count}` : category;
}

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function buildDefaultCommandSections(commands: Command[], recentCommandIds: string[]): CommandSection[] {
  const commandById = new Map(commands.map((command) => [command.id, command]));
  const used = new Set<string>();
  const sections: CommandSection[] = [];

  const recent = pickCommands(commandById, recentCommandIds, used, 3);
  if (recent.length > 0) {
    sections.push({ title: '最近使用', items: recent });
  }

  const recommended = pickCommands(commandById, RECOMMENDED_COMMAND_IDS, used, 8);
  if (recommended.length > 0) {
    sections.push({ title: '推荐动作', items: recommended });
  }

  const remainingByCategory = new Map<string, Command[]>();
  for (const command of commands) {
    if (used.has(command.id)) continue;
    const categoryCommands = remainingByCategory.get(command.category) ?? [];
    categoryCommands.push(command);
    remainingByCategory.set(command.category, categoryCommands);
  }

  const sortedCategories = [...remainingByCategory.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b));
  for (const [category, items] of sortedCategories) {
    sections.push({ title: formatCategoryTitle(category, items.length), items });
  }

  return sections;
}

function rankCommand(command: Command, normalizedQuery: string): number {
  const label = command.label.toLowerCase();
  const category = command.category.toLowerCase();
  const keywords = command.keywords?.join(' ').toLowerCase() ?? '';

  if (label === normalizedQuery) return 0;
  if (label.startsWith(normalizedQuery)) return 1;
  if (keywords.split(/\s+/).some((keyword) => keyword.startsWith(normalizedQuery))) return 2;
  if (category.includes(normalizedQuery)) return 3;
  if (label.includes(normalizedQuery)) return 4;
  if (keywords.includes(normalizedQuery)) return 5;
  return 6;
}

function sortSearchCommands(commands: Command[], normalizedQuery: string): Command[] {
  return [...commands].sort((a, b) => {
    const rankDelta = rankCommand(a, normalizedQuery) - rankCommand(b, normalizedQuery);
    if (rankDelta !== 0) return rankDelta;

    const categoryDelta = categoryRank(a.category) - categoryRank(b.category);
    if (categoryDelta !== 0) return categoryDelta;

    return a.label.localeCompare(b.label, 'zh-Hans-CN');
  });
}

function groupCommandsByCategory(commands: Command[]): CommandSection[] {
  const sections = new Map<string, Command[]>();
  for (const command of commands) {
    const items = sections.get(command.category) ?? [];
    items.push(command);
    sections.set(command.category, items);
  }

  return [...sections.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b))
    .map(([title, items]) => ({ title: formatCategoryTitle(title, items.length), items }));
}

export function CommandPalette({
  visible,
  commands,
  files = [],
  workspaceRoot = null,
  recentFiles = [],
  workspaceIndex = null,
  workspaceIndexing = false,
  mode = 'commands',
  onClose,
  onExecute,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>(() => readRecentCommandIds());
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCommands = useMemo(() => commands.filter((cmd) => {
    const searchText = `${cmd.label} ${cmd.category} ${cmd.keywords?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(normalizedQuery);
  }), [commands, normalizedQuery]);
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
  const commandSections = useMemo(() => {
    if (mode !== 'commands') return [];
    if (!normalizedQuery) return buildDefaultCommandSections(commands, recentCommandIds);
    return groupCommandsByCategory(sortSearchCommands(filteredCommands, normalizedQuery));
  }, [commands, filteredCommands, mode, normalizedQuery, recentCommandIds]);
  const commandItems = useMemo(
    () => commandSections.flatMap((section) => section.items),
    [commandSections],
  );
  const visibleItems = useMemo(() => {
    if (mode === 'files') return quickOpenItems;
    if (mode === 'search') return workspaceSearchItems;
    return commandItems;
  }, [commandItems, mode, quickOpenItems, workspaceSearchItems]);
  const placeholder = mode === 'files'
    ? '搜索工作区文件…'
    : mode === 'search'
      ? '全文搜索工作区…'
      : '搜索动作…';
  const emptyText = mode === 'files'
    ? workspaceIndexing ? '正在建立索引…' : '未找到匹配的文件'
    : mode === 'search'
      ? workspaceIndexing ? '正在建立索引…' : '未找到匹配的内容'
      : '未找到匹配的命令';

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedIndex(0);
      setRecentCommandIds(readRecentCommandIds());
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, mode]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const executeItem = useCallback((item: Command) => {
    if (mode === 'commands') {
      const next = [item.id, ...recentCommandIds.filter((id) => id !== item.id)].slice(0, MAX_RECENT_COMMANDS);
      setRecentCommandIds(next);
      writeRecentCommandIds(next);
    }
    onExecute(item.id);
    onClose();
  }, [mode, onClose, onExecute, recentCommandIds]);

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
          executeItem(visibleItems[selectedIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeItem, visible, selectedIndex, visibleItems]);

  if (!visible) return null;

  const renderItem = (cmd: Command, index: number) => (
    <div
      key={cmd.id}
      className={`cmdk-item ${index === selectedIndex ? 'selected' : ''}`}
      onClick={() => executeItem(cmd)}
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

  const renderCommandSections = () => {
    let commandIndex = 0;
    return commandSections.map((section) => (
      <section className="cmdk-section" key={section.title}>
        <div className="cmdk-section-title">{section.title}</div>
        {section.items.map((cmd) => {
          const index = commandIndex;
          commandIndex += 1;
          return renderItem(cmd, index);
        })}
      </section>
    ));
  };

  return (
    <>
      <div className="cmdk-overlay" onClick={onClose} />
      <div className="cmdk" role="dialog" aria-label={mode === 'files' ? '快速打开' : mode === 'search' ? '全文搜索工作区' : '命令面板'}>
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
          ) : mode === 'commands' ? (
            renderCommandSections()
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
