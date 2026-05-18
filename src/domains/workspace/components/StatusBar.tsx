import { useMemo } from 'react';
import styles from './StatusBar.module.css';
import { useWorkspaceStore } from '../../workspace/store';
import { useDocumentStore } from '../../document/store';
import type { DocumentSaveStatus } from '../../document/types';
import type { WritingStats } from '../services';

const IconFocus = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M10 2.85a7.15 7.15 0 1 1 0 14.3 7.15 7.15 0 0 1 0-14.3Zm0 1.36a5.79 5.79 0 1 0 0 11.58 5.79 5.79 0 0 0 0-11.58Zm0 2.82a2.97 2.97 0 1 1 0 5.94 2.97 2.97 0 0 1 0-5.94Zm0 1.32a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Z" />
  </svg>
);

const IconExport = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M10 2.7c.2 0 .37.07.5.2l3.15 3.15a.7.7 0 0 1-.99.99l-1.96-1.96v7.07a.7.7 0 1 1-1.4 0V5.08L7.34 7.04a.7.7 0 0 1-.99-.99L9.5 2.9c.13-.13.3-.2.5-.2ZM4.1 11.1c.39 0 .7.31.7.7v2.25c0 .58.47 1.05 1.05 1.05h8.3c.58 0 1.05-.47 1.05-1.05V11.8a.7.7 0 1 1 1.4 0v2.25a2.45 2.45 0 0 1-2.45 2.45h-8.3a2.45 2.45 0 0 1-2.45-2.45V11.8c0-.39.31-.7.7-.7Z" />
  </svg>
);

const IconCollapse = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M6.08 3.72c.4 0 .72.32.72.72v11.12a.72.72 0 0 1-1.44 0V4.44c0-.4.32-.72.72-.72Zm8.34 2.02c.28.28.28.74 0 1.02L11.18 10l3.24 3.24a.72.72 0 0 1-1.02 1.02L9.65 10.5a.72.72 0 0 1 0-1.02l3.75-3.74c.28-.28.74-.28 1.02 0Z" />
  </svg>
);

const IconExpand = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M13.92 3.72c-.4 0-.72.32-.72.72v11.12a.72.72 0 1 0 1.44 0V4.44c0-.4-.32-.72-.72-.72ZM5.58 5.74a.72.72 0 0 0 0 1.02L8.82 10l-3.24 3.24a.72.72 0 0 0 1.02 1.02l3.75-3.76a.72.72 0 0 0 0-1.02L6.6 5.74a.72.72 0 0 0-1.02 0Z" />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M9.32 3.35a.68.68 0 0 1 1.36 0v5.97h5.97a.68.68 0 1 1 0 1.36h-5.97v5.97a.68.68 0 1 1-1.36 0v-5.97H3.35a.68.68 0 1 1 0-1.36h5.97V3.35Z" />
  </svg>
);

const IconTree = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M5.2 3.35h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05H5.2A1.05 1.05 0 0 1 4.15 7.5V4.4c0-.58.47-1.05 1.05-1.05Zm6.5 0h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05h-3.1a1.05 1.05 0 0 1-1.05-1.05V4.4c0-.58.47-1.05 1.05-1.05Zm-6.5 8.1h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05H5.2a1.05 1.05 0 0 1-1.05-1.05v-3.1c0-.58.47-1.05 1.05-1.05Zm6.5 0h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05h-3.1a1.05 1.05 0 0 1-1.05-1.05v-3.1c0-.58.47-1.05 1.05-1.05Z" />
  </svg>
);

const IconList = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M4.2 4.65c0-.39.31-.7.7-.7h10.2a.7.7 0 0 1 0 1.4H4.9a.7.7 0 0 1-.7-.7Zm0 3.55c0-.39.31-.7.7-.7h10.2a.7.7 0 0 1 0 1.4H4.9a.7.7 0 0 1-.7-.7Zm0 3.55c0-.39.31-.7.7-.7h10.2a.7.7 0 1 1 0 1.4H4.9a.7.7 0 0 1-.7-.7Zm0 3.55c0-.39.31-.7.7-.7h7.2a.7.7 0 1 1 0 1.4H4.9a.7.7 0 0 1-.7-.7Z" />
  </svg>
);

const saveStatusLabels: Record<DocumentSaveStatus, string> = {
  saved: '已保存',
  dirty: '未保存',
  saving: '保存中...',
  failed: '保存失败',
  conflict: '文件冲突',
};

interface StatusBarProps {
  writingStats: WritingStats;
  selectionStats?: WritingStats | null;
  cursor: { line: number; column: number };
  sidebarVisible: boolean;
  isSidebarHovered: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onExportMenu?: (e: React.MouseEvent) => void;
  onToggleFocusMode?: () => void;
  onToggleSidebar?: () => void;
  onFolderContextMenu?: (e: React.MouseEvent) => void;
  onNewFile?: () => void;
  onToggleFileTreeMode?: () => void;
  linkIssueCount?: number;
  linkIssueTitle?: string;
  onLinkDiagnosticsClick?: () => void;
  backlinkCount?: number;
  onBacklinksClick?: () => void;
  typographyIssueCount?: number;
  typographyIssueTitle?: string;
  onTypographyDiagnosticsClick?: () => void;
  exportProgress?: string | null;
  exportProgressInBackground?: boolean;
  onShowExportProgress?: () => void;
}

export function StatusBar({
  writingStats,
  selectionStats,
  cursor,
  sidebarVisible,
  isSidebarHovered,
  onMouseEnter,
  onMouseLeave,
  onExportMenu,
  onToggleFocusMode,
  onToggleSidebar,
  onFolderContextMenu,
  onNewFile,
  onToggleFileTreeMode,
  linkIssueCount = 0,
  linkIssueTitle,
  onLinkDiagnosticsClick,
  backlinkCount = 0,
  onBacklinksClick,
  typographyIssueCount = 0,
  typographyIssueTitle,
  onTypographyDiagnosticsClick,
  exportProgress = null,
  exportProgressInBackground = false,
  onShowExportProgress,
}: StatusBarProps) {
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const fileTreeMode = useWorkspaceStore((s) => s.fileTreeMode);
  const focusMode = useWorkspaceStore((s) => s.focusMode);
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const saveStatus = currentDocument?.saveStatus ?? 'saved';
  const activeStats = selectionStats && selectionStats.characters > 0 ? selectionStats : writingStats;
  const isSelectionStats = activeStats === selectionStats;
  const statsTitle = `${isSelectionStats ? '选区：' : ''}中文字数 ${activeStats.chineseChars}，英文词数 ${activeStats.englishWords}，字符数 ${activeStats.characters}，预计阅读 ${activeStats.readingMinutes} 分钟`;

  const rootName = useMemo(() => {
    if (!rootPath) return 'Documents';
    return rootPath.split(/[\\/]/).pop() || rootPath;
  }, [rootPath]);

  return (
    <div className={styles.statusbar}>
      {sidebarVisible && (
        <div
          className={`${styles.sidebarZone} ${isSidebarHovered ? styles.visible + ' is-visible' : ''}`}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <button className={`${styles.btn} ${styles.iconBtn}`} title="新建文件" onClick={onNewFile}>
            <IconPlus />
          </button>
          <button
            className={styles.folder}
            onContextMenu={onFolderContextMenu}
            onClick={onFolderContextMenu}
            title="工作区操作"
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{rootName}</span>
          </button>
          <button
            className={`${styles.btn} ${styles.iconBtn} ${styles.treeBtn} ${fileTreeMode === 'list' ? styles.active + ' is-active' : ''}`}
            title={fileTreeMode === 'tree' ? '切换到文档列表' : '切换到文档树'}
            onClick={onToggleFileTreeMode}
          >
            {fileTreeMode === 'tree' ? <IconTree /> : <IconList />}
          </button>
        </div>
      )}

      <div className={styles.main}>
        <div className={styles.left}>
          <button
            className={`${styles.btn} ${styles.iconBtn}`}
            onClick={onToggleSidebar}
            title={sidebarVisible ? '收起侧边栏' : '展开侧边栏'}
          >
            {sidebarVisible ? <IconCollapse /> : <IconExpand />}
          </button>
        </div>

        <div className={styles.center} title={statsTitle}>
          <span
            className={`${styles.saveStatus} ${styles[saveStatus]}`}
            title={currentDocument?.saveError ?? undefined}
          >
            {saveStatusLabels[saveStatus]}
          </span>
          {isSelectionStats && (
            <span className={styles.statBadge}>选区</span>
          )}
          <span className={styles.statChunk}>
            <span className={styles.sep} />
            <span className={styles.statLbl}>中</span>
            <span className={styles.statVal}>{activeStats.chineseChars}</span>
          </span>
          <span className={styles.statChunk}>
            <span className={styles.sep} />
            <span className={styles.statLbl}>EN</span>
            <span className={styles.statVal}>{activeStats.englishWords}</span>
          </span>
          <span className={`${styles.statChunk} ${styles.optionalStat}`}>
            <span className={styles.sep} />
            <span className={styles.statLbl}>字符</span>
            <span className={styles.statVal}>{activeStats.characters}</span>
          </span>
          <span className={`${styles.statChunk} ${styles.optionalStat}`}>
            <span className={styles.sep} />
            <span className={styles.statVal}>{activeStats.readingMinutes}</span>
            <span className={styles.statLbl}>分钟</span>
          </span>
          <span className={styles.statChunk}>
            <span className={styles.sep} />
            <span className={styles.statLbl}>LN</span>
            <span className={styles.statVal}>{cursor.line}</span>
          </span>
          <span className={styles.statChunk}>
            <span className={styles.sep} />
            <span className={styles.statLbl}>COL</span>
            <span className={styles.statVal}>{cursor.column}</span>
          </span>
          {linkIssueCount > 0 && (
            <>
              <span className={styles.sep} />
              <button
                className={styles.diagnostic}
                title={linkIssueTitle ?? '链接诊断'}
                onClick={onLinkDiagnosticsClick}
              >
                LINK {linkIssueCount}
              </button>
            </>
          )}
          {backlinkCount > 0 && (
            <>
              <span className={styles.sep} />
              <button
                className={styles.diagnostic}
                title="查看引用当前文档的 Markdown 文件"
                onClick={onBacklinksClick}
              >
                BACKLINK {backlinkCount}
              </button>
            </>
          )}
          {typographyIssueCount > 0 && (
            <>
              <span className={styles.sep} />
              <button
                className={styles.diagnostic}
                title={typographyIssueTitle ?? '排版提示'}
                onClick={onTypographyDiagnosticsClick}
              >
                TYPO {typographyIssueCount}
              </button>
            </>
          )}
        </div>

        <div className={styles.right}>
          {exportProgress && exportProgressInBackground && (
            <button
              className={styles.exportStatus}
              title={`导出中：${exportProgress}`}
              onClick={onShowExportProgress}
            >
              <span className={styles.exportStatusSpinner} aria-hidden="true" />
              <span className={styles.exportStatusText}>导出中</span>
            </button>
          )}
          <button
            className={`${styles.btn} ${styles.iconBtn} ${focusMode ? styles.active : ''}`}
            onClick={onToggleFocusMode}
            title="专注模式 (F8)"
          >
            <IconFocus />
          </button>
          <button
            className={`${styles.btn} ${styles.iconBtn}`}
            onClick={onExportMenu}
            onContextMenu={onExportMenu}
            title="导出"
          >
            <IconExport />
          </button>
        </div>
      </div>
    </div>
  );
}
