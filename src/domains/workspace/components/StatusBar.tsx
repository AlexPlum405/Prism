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

interface StatusBarProps {
  writingStats: WritingStats;
  selectionStats?: WritingStats | null;
  cursor: { line: number; column: number };
  /** 仅用于判断是否为纯文本文稿（纯文本不显示排版诊断入口），不展示类型名。 */
  documentProfileKind?: DocumentProfileKind;
  onExportMenu?: (e: React.MouseEvent) => void;
  onToggleFocusMode?: () => void;
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
  onShowExportFailure?: () => void;
  onShowExportProgress?: () => void;
  onCancelExport?: () => void;
}


function formatStatusNumber(value: number) {
  return formatLocalizedNumber(value);
}

export function StatusBar({
  writingStats,
  selectionStats,
  cursor,
  documentProfileKind,
  onExportMenu,
  onToggleFocusMode,
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
  onShowExportFailure,
  onShowExportProgress,
  onCancelExport,
}: StatusBarProps) {
  useI18n();

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

  return (
    <div className={`${styles.statusbar} app-statusbar`}>
      {/* 字数条绝对定位在 x=770，既不是居中也不靠左：它要落在编辑岛下方 */}
      <div className={styles.center} title={statsTitle}>
        <span className={styles.statText}>{statusText}</span>
      </div>

      <div className={styles.right}>
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
          {exportProgress && onCancelExport && (
            <button
              className={`${styles.btn} ${styles.iconBtn}`}
              title={t('status.cancelExport')}
              aria-label={t('status.cancelExport')}
              onClick={onCancelExport}
            >
              <span aria-hidden="true">×</span>
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
  );
}
