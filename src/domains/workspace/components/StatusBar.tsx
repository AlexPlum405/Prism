import styles from './StatusBar.module.css';
import type { DocumentProfileKind, WritingStats } from '../services';
import { formatLocalizedNumber, t, useI18n } from '../../i18n';
import type { ExportFeedbackState } from '../../../hooks/useExportTaskUi';

/* 状态区只放只读信息：字数、诊断、排版建议，以及导出的进度与结果。
   关系图谱 / 专注模式 / 导出这三个操作统一走菜单（导航 / 视图 / 导出），
   另有快捷键和命令面板兜底，标题栏右侧不再摆第二排工具栏。
   注意：导出进度与结果反馈不是入口，删掉按钮后仍必须保留，否则从菜单
   发起的导出卡住或失败时用户看不到原因。 */
interface StatusBarProps {
  writingStats: WritingStats;
  selectionStats?: WritingStats | null;
  cursor: { line: number; column: number };
  /** 仅用于判断是否为纯文本文稿（纯文本不显示排版诊断入口），不展示类型名。 */
  documentProfileKind?: DocumentProfileKind;
  linkIssueCount?: number;
  linkIssueTitle?: string;
  onLinkDiagnosticsClick?: () => void;
  backlinkCount?: number;
  onBacklinksClick?: () => void;
  onDocumentPropertiesClick?: () => void;
  typographyIssueCount?: number;
  typographyIssueTitle?: string;
  onTypographyDiagnosticsClick?: () => void;
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
  linkIssueCount = 0,
  linkIssueTitle,
  onLinkDiagnosticsClick,
  typographyIssueCount = 0,
  typographyIssueTitle,
  onTypographyDiagnosticsClick,
  exportFeedback = null,
  exportProgress = null,
  exportProgressInBackground = false,
  onShowExportFailure,
  onShowExportProgress,
  onCancelExport,
}: StatusBarProps) {
  useI18n();

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
      </div>
    </div>
  );
}
