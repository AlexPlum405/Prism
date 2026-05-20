import { t, useI18n } from '../../i18n';

export type SaveConflictAction = 'reload' | 'saveAs' | 'overwrite';

interface SaveConflictModalProps {
  visible: boolean;
  documentName: string;
  error: string | null;
  busyAction: SaveConflictAction | null;
  onReload: () => void;
  onSaveAs: () => void;
  onOverwrite: () => void;
}

function getBusyLabel(action: SaveConflictAction | null, fallback: string) {
  if (!action) return fallback;
  if (action === 'reload') return t('conflict.reloading');
  if (action === 'saveAs') return t('conflict.savingAs');
  return t('conflict.overwriting');
}

export function SaveConflictModal({
  visible,
  documentName,
  error,
  busyAction,
  onReload,
  onSaveAs,
  onOverwrite,
}: SaveConflictModalProps) {
  useI18n();
  if (!visible) return null;

  const isBusy = busyAction !== null;

  return (
    <>
      <div className="modal-overlay" />
      <div className="modal prism-conflict-modal" role="dialog" aria-label={t('conflict.title')} aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">{t('conflict.title')}</div>
        </div>
        <div className="modal-body prism-conflict-body">
          <div className="prism-conflict-kicker">{t('conflict.kicker')}</div>
          <div className="prism-conflict-title">{documentName}</div>
          <p>
            {t('conflict.body')}
          </p>
          {error && <div className="prism-conflict-error">{error}</div>}
        </div>
        <div className="prism-conflict-actions">
          <button type="button" onClick={onReload} disabled={isBusy}>
            {busyAction === 'reload' ? getBusyLabel(busyAction, t('conflict.reload')) : t('conflict.reload')}
          </button>
          <button type="button" className="primary" onClick={onSaveAs} disabled={isBusy}>
            {busyAction === 'saveAs' ? getBusyLabel(busyAction, t('conflict.saveAs')) : t('conflict.saveAs')}
          </button>
          <button type="button" className="danger" onClick={onOverwrite} disabled={isBusy}>
            {busyAction === 'overwrite' ? getBusyLabel(busyAction, t('conflict.overwrite')) : t('conflict.overwrite')}
          </button>
        </div>
      </div>
    </>
  );
}
