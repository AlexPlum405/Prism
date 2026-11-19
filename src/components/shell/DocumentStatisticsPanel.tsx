import { useEffect } from 'react';
import { useI18n } from '../../domains/i18n';
import type { WritingStats } from '../../domains/workspace/services';
import styles from './DocumentStatisticsPanel.module.css';

interface DocumentStatisticsPanelProps {
  visible: boolean;
  stats: WritingStats;
  onClose: () => void;
}

export function DocumentStatisticsPanel({ visible, stats, onClose }: DocumentStatisticsPanelProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const rows = [
    { id: 'words', label: t('statistics.words'), value: String(stats.wordCount) },
    { id: 'chinese', label: t('statistics.chineseChars'), value: String(stats.chineseChars) },
    { id: 'english', label: t('statistics.englishWords'), value: String(stats.englishWords) },
    { id: 'paragraphs', label: t('statistics.paragraphs'), value: String(stats.paragraphCount) },
    { id: 'sentences', label: t('statistics.sentences'), value: String(stats.sentenceCount) },
    {
      id: 'reading',
      label: t('statistics.readingTime'),
      value: t('statistics.readingMinutes', { minutes: stats.readingMinutes }),
    },
  ];

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div
        className={`modal ${styles.panel}`}
        role="dialog"
        aria-label={t('statistics.title')}
        data-testid="document-statistics-panel"
      >
        <div className="modal-header">
          <div className="modal-title">{t('statistics.title')}</div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body">
          <dl className={styles.grid}>
            {rows.map((row) => (
              <div key={row.id} className={styles.row}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  );
}
