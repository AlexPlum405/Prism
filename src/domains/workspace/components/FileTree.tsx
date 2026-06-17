import { useEffect, useMemo, useRef, useState } from 'react';
import { FileNode } from '../types';
import { useWorkspaceStore } from '../store';
import { ContextMenu, ContextMenuItem } from '../../../components/shell/ContextMenu';
import {
  collectAncestorDirectoryPaths,
  flattenFiles,
  isDirectoryNode,
  pruneExpandedDirectoryPaths,
  sortFileNodes,
} from '../services';
import { createFileTreeContextMenuItems } from './fileTreeContextMenu';
import { useI18n } from '../../i18n';
import { emitAppEvent, onAppEvent } from '../../../platform/events/appEvents';

interface FileTreeProps {
  nodes: FileNode[];
  activePath?: string | null;
  onFileClick: (path: string) => void;
}

interface RenameFieldProps {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function stripExtension(name: string): { stem: string; ext: string } {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, idx), ext: name.slice(idx) };
}

function dispatchFileAction(action: string, detail?: { path?: string; name?: string }): void {
  emitAppEvent('file.action', { action, ...detail });
}

function RenameField({ value, onCommit, onCancel }: RenameFieldProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // 自动选中文件名（不含扩展名）
      const { stem } = stripExtension(value);
      inputRef.current.setSelectionRange(0, stem.length);
    }
  }, [value]);

  const finish = (commit: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (commit) {
      onCommit(draft);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }}
      className="file-tree-rename-input"
    />
  );
}

export function FileTree({ nodes, activePath, onFileClick }: FileTreeProps) {
  const { t } = useI18n();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const fileTreeMode = useWorkspaceStore((s) => s.fileTreeMode);
  const fileSortMode = useWorkspaceStore((s) => s.fileSortMode);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setExpandedPaths((prev) => pruneExpandedDirectoryPaths(nodes, prev));
  }, [nodes]);

  useEffect(() => {
    return onAppEvent('file.renameRequest', ({ path }) => {
      if (!path) return;
      setExpandedPaths((prev) => {
        const next = pruneExpandedDirectoryPaths(nodes, prev);
        collectAncestorDirectoryPaths(nodes, path).forEach((ancestorPath) => next.add(ancestorPath));
        return next;
      });
      setRenamingPath(path);
      setContextMenu(null);
    });
  }, [nodes]);

  // F2 快捷键重命名
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2' && activePath) {
        event.preventDefault();
        setRenamingPath(activePath);
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePath]);

  const sortedNodes = useMemo(() => sortFileNodes(nodes, fileSortMode), [nodes, fileSortMode]);
  const flatFiles = useMemo(() => flattenFiles(sortedNodes, rootPath), [sortedNodes, rootPath]);

  const commitRename = (path: string, name: string) => {
    setRenamingPath(null);
    dispatchFileAction('commitRename', { path, name });
  };

  const makeContextItems = (node?: FileNode): ContextMenuItem[] => {
    return createFileTreeContextMenuItems({ node, fileTreeMode, fileSortMode });
  };

  const handleContextMenu = (event: React.MouseEvent, node?: FileNode) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, items: makeContextItems(node) });
  };

  const handleAction = (action: string) => {
    dispatchFileAction(action);
  };

  const renderFileName = (node: FileNode, isActive: boolean) => {
    if (renamingPath === node.path) {
      return (
        <RenameField
          value={node.name}
          onCommit={(name) => commitRename(node.path, name)}
          onCancel={() => setRenamingPath(null)}
        />
      );
    }

    const { stem, ext } = stripExtension(node.name);
    return (
      <div
        style={{
          fontSize: '13px',
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'var(--text-primary)' : 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {stem}
        <span style={{ opacity: 0.4, fontWeight: 400 }}>{ext}</span>
      </div>
    );
  };

  const renderFileNode = (node: FileNode, depth: number, index: number, folderLabel?: string) => {
    const isActive = activePath === node.path;

    return (
      <div
        key={node.path}
        onClick={() => onFileClick(node.path)}
        onContextMenu={(event) => handleContextMenu(event, node)}
        title={node.path}
        data-active={isActive ? 'true' : undefined}
        style={{
          padding: '8px 14px',
          margin: '2px 8px',
          marginLeft: fileTreeMode === 'tree' ? `${8 + depth * 14}px` : '8px',
          cursor: 'pointer',
          borderRadius: 'var(--radius-md)',
          background: isActive ? 'var(--bg-hover)' : 'transparent',
          boxShadow: 'none',
          transform: 'scale(1)',
          position: 'relative',
          transition: 'background var(--duration-feedback) var(--ease-out), border-left-color var(--duration-feedback) var(--ease-out), padding-left var(--duration-feedback) var(--ease-out)',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          zIndex: isActive ? 10 : 1,
          animation: 'fileItemEntry var(--duration-slow) var(--ease-spring) backwards',
          animationDelay: `calc(${Math.min(index, 24)} * var(--duration-fast) / 6)`,
          minHeight: '32px',
        }}
        className={`file-tree-item ${isActive ? 'is-active' : ''}`}
      >
        {renderFileName(node, isActive)}

        {folderLabel && (
          <div className="file-tree-folder-label">{folderLabel}</div>
        )}

        {node.preview && (
          <div
            className="file-tree-preview"
            style={{
              fontSize: '11px',
              color: isActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              lineHeight: '1.45',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {node.preview}
          </div>
        )}
      </div>
    );
  };

  const renderDirectoryNode = (node: FileNode, depth: number) => {
    const expanded = expandedPaths.has(node.path);

    return (
      <div key={node.path}>
        <div
          onClick={() => {
            setExpandedPaths((prev) => {
              const next = new Set(prev);
              if (next.has(node.path)) {
                next.delete(node.path);
              } else {
                next.add(node.path);
              }
              return next;
            });
          }}
          onContextMenu={(event) => handleContextMenu(event, node)}
          title={node.path}
          className="file-tree-directory"
          style={{ paddingLeft: `${12 + depth * 14}px` }}
        >
          <span className={`file-tree-caret ${expanded ? 'is-expanded' : ''}`}>›</span>
          {renamingPath === node.path ? (
            <RenameField
              value={node.name}
              onCommit={(name) => commitRename(node.path, name)}
              onCancel={() => setRenamingPath(null)}
            />
          ) : (
            <span className="file-tree-directory-name">{node.name}</span>
          )}
        </div>
        {expanded && (
          <div>
            {(node.children ?? []).map((child, index) => (
              isDirectoryNode(child)
                ? renderDirectoryNode(child, depth + 1)
                : renderFileNode(child, depth + 1, index)
            ))}
          </div>
        )}
      </div>
    );
  };

  const isEmpty = fileTreeMode === 'list' ? flatFiles.length === 0 : nodes.length === 0;

  return (
    <div
      style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}
      onContextMenu={(event) => handleContextMenu(event)}
    >
      {isEmpty ? (
        <div className="file-tree-empty">
          <div className="file-tree-empty-kicker">PRISM</div>
          <div style={{ marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {rootPath ? t('workspace.fileTree.emptyWithWorkspace.title') : t('workspace.fileTree.emptyNoWorkspace.title')}
          </div>
          <div style={{ fontSize: '12px' }}>
            {rootPath ? t('workspace.fileTree.emptyWithWorkspace.hint') : t('workspace.fileTree.emptyNoWorkspace.hint')}
          </div>
          <div className="file-tree-empty-brand">{t('brand.tagline')}</div>
        </div>
      ) : fileTreeMode === 'list' ? (
        flatFiles.map(({ node, folderLabel }, index) => renderFileNode(node, 0, index, folderLabel))
      ) : (
        sortedNodes.map((node, index) => (
          isDirectoryNode(node)
            ? renderDirectoryNode(node, 0)
            : renderFileNode(node, 0, index)
        ))
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onAction={handleAction}
          onClose={() => setContextMenu(null)}
        />
      )}

      <style>{`
        @keyframes fileItemEntry {
          from { opacity: 0; transform: translateX(-12px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        .file-tree-item:hover {
          background: var(--bg-hover);
        }
        .file-tree-item:active {
          transform: scale(0.98);
          background: var(--bg-active);
        }
        .file-tree-directory {
          height: 30px;
          margin: 1px 8px;
          padding-right: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition:
            background var(--duration-hover) var(--ease-out),
            color var(--duration-hover) var(--ease-out);
        }
        .file-tree-directory:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .file-tree-caret {
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-tertiary);
          transform: rotate(0deg);
          transition: transform var(--duration-hover) var(--ease-out);
          font-size: 14px;
          line-height: 1;
        }
        .file-tree-caret.is-expanded {
          transform: rotate(90deg);
        }
        .file-tree-directory-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12.5px;
          font-weight: 500;
        }
        .file-tree-rename-input {
          width: 100%;
          min-width: 0;
          height: 22px;
          padding: 0 6px;
          border: 1px solid var(--accent);
          border-radius: var(--radius-sm);
          background: var(--bg-surface-solid);
          color: var(--text-primary);
          font: inherit;
          outline: none;
          box-shadow: 0 0 0 2px var(--accent-tint);
        }
        .file-tree-folder-label {
          font-size: 10.5px;
          color: var(--text-tertiary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-tree-empty {
          padding: 48px 16px;
          font-size: 13px;
          color: var(--text-tertiary);
          line-height: 1.7;
          text-align: center;
        }
        .file-tree-empty-kicker {
          margin-bottom: 8px;
          color: var(--text-tertiary);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0;
        }
        .file-tree-empty-brand {
          max-width: 180px;
          margin: 14px auto 0;
          color: var(--text-tertiary);
          font-size: 11.5px;
          line-height: 1.55;
        }
        @media (prefers-reduced-motion: reduce) {
          .file-tree-item {
            animation: none !important;
            transition-duration: 1ms !important;
          }
          .file-tree-directory,
          .file-tree-caret {
            transition-duration: 1ms !important;
          }
        }
      `}</style>
    </div>
  );
}
