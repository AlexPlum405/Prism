import styles from './StatusBar.module.css';
import { useWorkspaceStore } from '../../workspace/store';
import type { DocumentProfileKind, WritingStats } from '../services';
import { formatLocalizedNumber, t, useI18n } from '../../i18n';
import type { ExportFeedbackState } from '../../../hooks/useExportTaskUi';

import {
  EXPORT_PATH,
  FOCUS_EXIT_PATH,
  FOCUS_PATH,
  GRAPH_LINKS_PATH,
  GRAPH_NODES_PATH,
} from '../../../components/icons/islandIconPaths';

/* 状态区图标与侧栏开关 / 侧栏页脚 / 视图切换同源：20×20 纯 fill、无 stroke、
   1.20–1.30 圆头笔画。过去这三个是 stroke 点线 + 四层实心环 + 粗实心箭头，
   在标题栏里各画各的，所以和左侧外壳图标明显不是一套。 */
const IconGraph = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d={GRAPH_LINKS_PATH} />
    <path fillRule="evenodd" clipRule="evenodd" d={GRAPH_NODES_PATH} />
  </svg>
);

const IconFocus = ({ active = false }: { active?: boolean }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    {/* 角标彼此有重叠，只能用 nonzero；关闭态的环+文字线必须 evenodd */}
    {active ? (
      <path d={FOCUS_EXIT_PATH} />
    ) : (
      <path fillRule="evenodd" clipRule="evenodd" d={FOCUS_PATH} />
    )}
  </svg>
);

const IconExport = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d={EXPORT_PATH} />
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
              aria-label={t('status.relationGraph')}
            >
              <IconGraph />
            </button>
          )}
          <button
            className={`${styles.btn} ${styles.iconBtn} ${focusMode ? styles.active : ''}`}
            onClick={onToggleFocusMode}
            title={t('status.focusMode')}
            aria-label={t('status.focusMode')}
            aria-pressed={focusMode}
          >
            <IconFocus active={focusMode} />
          </button>

          <button
            className={`${styles.btn} ${styles.iconBtn}`}
            onClick={onExportMenu}
            onContextMenu={onExportMenu}
            title={t('status.export')}
            aria-label={t('status.export')}
          >
            <IconExport />
          </button>
      </div>
    </div>
  );
}
