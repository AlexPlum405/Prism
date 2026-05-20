import type { RecoverySnapshot } from '../services/recovery';
import { t, useI18n } from '../../i18n';

type RecoveryAction = 'restore' | 'discard';

interface RecoveryModalProps {
  visible: boolean;
  snapshot: RecoverySnapshot | null;
  busyAction: RecoveryAction | null;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatRecoveryTime(createdAt: number) {
  return new Date(createdAt).toLocaleString();
}

export function RecoveryModal({
  visible,
  snapshot,
  busyAction,
  onRestore,
  onDiscard,
}: RecoveryModalProps) {
  useI18n();
  if (!visible || !snapshot) return null;

  const isBusy = busyAction !== null;

  return (
    <>
      <div className="modal-overlay" />
      <div className="modal prism-recovery-modal" role="dialog" aria-label={t('recovery.title')} aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">{t('recovery.title')}</div>
        </div>
        <div className="modal-body prism-recovery-body">
          <div className="prism-recovery-kicker">{t('recovery.kicker')}</div>
          <div className="prism-recovery-title">{snapshot.documentName}</div>
          <div className="prism-recovery-path" title={snapshot.documentPath}>
            {snapshot.documentPath}
          </div>
          <p>
            {t('recovery.body', { time: formatRecoveryTime(snapshot.createdAt) })}
          </p>
        </div>
        <div className="prism-recovery-actions">
          <button type="button" onClick={onDiscard} disabled={isBusy}>
            {busyAction === 'discard' ? t('recovery.discarding') : t('recovery.discard')}
          </button>
          <button type="button" className="primary" onClick={onRestore} disabled={isBusy}>
            {busyAction === 'restore' ? t('recovery.restoring') : t('recovery.restore')}
          </button>
        </div>
      </div>
    </>
  );
}
