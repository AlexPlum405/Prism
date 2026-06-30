import { useMemo } from 'react';
import styles from './StatusBar.module.css';
import { useWorkspaceStore } from '../../workspace/store';
import type { DocumentProfileKind, WritingStats } from '../services';
import { formatLocalizedNumber, t, useI18n } from '../../i18n';
import type { ExportFeedbackState } from '../../../hooks/useExportTaskUi';

const IconFocus = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M10 2.85a7.15 7.15 0 1 1 0 14.3 7.15 7.15 0 0 1 0-14.3Zm0 1.36a5.79 5.79 0 1 0 0 11.58 5.79 5.79 0 0 0 0-11.58Zm0 2.82a2.97 2.97 0 1 1 0 5.94 2.97 2.97 0 0 1 0-5.94Zm0 1.32a1.65 1.65 0 1 0 0 3.3 1.65 1.65 0 0 0 0-3.3Z" />
  </svg>
);

const IconGraph = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {/* 精致扁平拓扑：中心聚焦节点与放射状直连节点 */}
    <path d="M10 10L6.5 6.5" />
    <path d="M10 10h5" />
    <path d="M10 10l1 5" />
    <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="11" cy="15" r="1.5" fill="currentColor" stroke="none" />
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
  onDocumentPropertiesClick?: () => void;
  typographyIssueCount?: number;
  typographyIssueTitle?: string;
  onTypographyDiagnosticsClick?: () => void;
  onRelationGraphClick?: () => void;
  hasDocumentRelations?: boolean;
  exportFeedback?: ExportFeedbackState | null;
  exportProgress?: string | null;
  exportProgressInBackground?: boolean;
  documentProfileKind?: DocumentProfileKind;
  onShowExportFailure?: () => void;
  onShowExportProgress?: () => void;
}


function formatStatusNumber(value: number) {
  return formatLocalizedNumber(value);
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
  typographyIssueCount = 0,
  typographyIssueTitle,
  onTypographyDiagnosticsClick,
  onRelationGraphClick,
  hasDocumentRelations = false,
  exportFeedback = null,
  exportProgress = null,
  exportProgressInBackground = false,
  documentProfileKind,
  onShowExportFailure,
  onShowExportProgress,
}: StatusBarProps) {
  useI18n();

  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const fileTreeMode = useWorkspaceStore((s) => s.fileTreeMode);
  const focusMode = useWorkspaceStore((s) => s.focusMode);
  const activeStats = selectionStats && selectionStats.characters > 0 ? selectionStats : writingStats;
  const isSelectionStats = activeStats === selectionStats;
  const statsTitle = t('status.statsTitle', {
    prefix: isSelectionStats ? t('status.selectionPrefix') : '',
    words: formatStatusNumber(activeStats.wordCount),
    line: cursor.line,
    column: cursor.column,
  });
  const statusText = t('status.statusText', {
    prefix: isSelectionStats ? t('status.selectionTextPrefix') : '',
    words: formatStatusNumber(activeStats.wordCount),
    line: cursor.line,
    column: cursor.column,
  });
  const documentTypeLabel = documentProfileKind
    ? t(documentProfileKind === 'text' ? 'status.documentType.text' : 'status.documentType.markdown')
    : null;

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
          <button className={`${styles.btn} ${styles.iconBtn}`} title={t('status.newFile')} onClick={onNewFile}>
            <IconPlus />
          </button>
          <button
            className={styles.folder}
            onContextMenu={onFolderContextMenu}
            onClick={onFolderContextMenu}
            title={t('status.workspaceActions')}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{rootName}</span>
          </button>
          <button
            className={`${styles.btn} ${styles.iconBtn} ${styles.treeBtn} ${fileTreeMode === 'list' ? styles.active + ' is-active' : ''}`}
            title={fileTreeMode === 'tree' ? t('status.switchToList') : t('status.switchToTree')}
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
            title={sidebarVisible ? t('status.collapseSidebar') : t('status.expandSidebar')}
          >
            {sidebarVisible ? <IconCollapse /> : <IconExpand />}
          </button>
        </div>

        <div className={styles.center} title={statsTitle}>
          <span className={styles.statText}>{statusText}</span>
        </div>

        <div className={styles.right}>
          {documentTypeLabel && (
            <span
              className={`${styles.documentType} ${documentProfileKind === 'text' ? styles.documentTypeText : ''}`}
              title={t('status.documentTypeTitle', { type: documentTypeLabel })}
            >
              {documentTypeLabel}
            </span>
          )}
          {linkIssueCount > 0 && (
            <button
              className={styles.diagnostic}
              title={linkIssueTitle ?? t('status.documentDiagnostics')}
              onClick={onLinkDiagnosticsClick}
            >
              ERROR {linkIssueCount}
            </button>
          )}
          {documentProfileKind !== 'text' && onTypographyDiagnosticsClick && (
            <button
              className={`${styles.diagnostic} ${styles.typographyDiagnostic}`}
              title={typographyIssueTitle ?? (
                typographyIssueCount > 0
                  ? t('status.typographyDiagnosticsCount', { count: formatStatusNumber(typographyIssueCount) })
                  : t('status.typographyDiagnostics')
              )}
              onClick={onTypographyDiagnosticsClick}
            >
              {typographyIssueCount > 0 ? `TYPO ${formatStatusNumber(typographyIssueCount)}` : t('status.typographyDiagnosticsShort')}
            </button>
          )}
          {exportProgress && exportProgressInBackground && (
            <button
              className={styles.exportStatus}
              title={t('status.backgroundExport', { progress: exportProgress })}
              onClick={onShowExportProgress}
            >
              <span className={styles.exportStatusSpinner} aria-hidden="true" />
              <span className={styles.exportStatusText}>{t('status.exporting')}</span>
            </button>
          )}
          {!exportProgress && exportFeedback?.status === 'success' && (
            <span
              className={`${styles.exportStatus} ${styles.exportStatusSuccess}`}
              role="status"
              title={exportFeedback.message
                ? t('status.exportedTitle', { message: exportFeedback.message })
                : exportFeedback.title}
            >
              <span className={styles.exportStatusText}>{t('status.exported')}</span>
            </span>
          )}
          {!exportProgress && exportFeedback?.status === 'cancelled' && (
            <span
              className={`${styles.exportStatus} ${styles.exportStatusCancelled}`}
              role="status"
              title={exportFeedback.title}
            >
              <span className={styles.exportStatusText}>{t('status.exportCancelled')}</span>
            </span>
          )}
          {!exportProgress && exportFeedback?.status === 'failed' && (
            <button
              className={`${styles.exportStatus} ${styles.exportStatusFailed}`}
              title={t('status.exportFailedTitle', { title: exportFeedback.title })}
              onClick={onShowExportFailure}
            >
              <span className={styles.exportStatusText}>{t('status.exportFailed')}</span>
            </button>
          )}
          {hasDocumentRelations && onRelationGraphClick && (
            <button
              className={`${styles.btn} ${styles.iconBtn}`}
              onClick={onRelationGraphClick}
              title={t('status.relationGraph')}
            >
              <IconGraph />
            </button>
          )}
          <button
            className={`${styles.btn} ${styles.iconBtn} ${focusMode ? styles.active : ''}`}
            onClick={onToggleFocusMode}
            title={t('status.focusMode')}
          >
            <IconFocus />
          </button>

          <button
            className={`${styles.btn} ${styles.iconBtn}`}
            onClick={onExportMenu}
            onContextMenu={onExportMenu}
            title={t('status.export')}
          >
            <IconExport />
          </button>
        </div>
      </div>
    </div>
  );
}
