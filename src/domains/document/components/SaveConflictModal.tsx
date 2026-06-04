import { t, useI18n } from '../../i18n';
import type { DocumentSaveIssue } from '../types';

export type SaveConflictAction = 'reload' | 'saveAs' | 'overwrite' | 'discard';

interface SaveConflictModalProps {
  visible: boolean;
  documentName: string;
  error: string | null;
  issueKind?: DocumentSaveIssue | null;
  busyAction: SaveConflictAction | null;
  onReload: () => void;
  onSaveAs: () => void;
  onOverwrite: () => void;
  onDiscard: () => void;
}

function getBusyLabel(action: SaveConflictAction | null, fallback: string) {
  if (!action) return fallback;
  if (action === 'reload') return t('conflict.reloading');
  if (action === 'saveAs') return t('conflict.savingAs');
  if (action === 'discard') return t('conflict.missingDiscarding');
  return t('conflict.overwriting');
}

function getModalCopy(issueKind?: DocumentSaveIssue | null) {
  if (issueKind === 'missing') {
    return {
      title: t('conflict.missingTitle'),
      kicker: t('conflict.missingKicker'),
      body: t('conflict.missingBody'),
      saveAs: t('conflict.missingSaveAs'),
      discard: t('conflict.missingDiscard'),
      overwrite: t('conflict.missingRecreate'),
      overwriting: t('conflict.missingRecreating'),
      showReload: false,
      showDiscard: true,
      isOverwriteDanger: false,
    };
  }

  return {
    title: t('conflict.title'),
    kicker: t('conflict.kicker'),
    body: t('conflict.body'),
    saveAs: t('conflict.saveAs'),
    discard: '',
    overwrite: t('conflict.overwrite'),
    overwriting: t('conflict.overwriting'),
    showReload: true,
    showDiscard: false,
    isOverwriteDanger: true,
  };
}

export function SaveConflictModal({
  visible,
  documentName,
  error,
  issueKind,
  busyAction,
  onReload,
  onSaveAs,
  onOverwrite,
  onDiscard,
}: SaveConflictModalProps) {
  useI18n();
  if (!visible) return null;

  const isBusy = busyAction !== null;
  const copy = getModalCopy(issueKind);

  return (
    <>
      <div className="modal-overlay" />
      <div className="modal prism-conflict-modal" role="dialog" aria-label={copy.title} aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">{copy.title}</div>
        </div>
        <div className="modal-body prism-conflict-body">
          <div className="prism-conflict-kicker">{copy.kicker}</div>
          <div className="prism-conflict-title">{documentName}</div>
          <p>
            {copy.body}
          </p>
          {error && <div className="prism-conflict-error">{error}</div>}
        </div>
        <div className="prism-conflict-actions">
          {copy.showDiscard ? (
            <>
              <button type="button" className="danger" onClick={onDiscard} disabled={isBusy}>
                {busyAction === 'discard' ? getBusyLabel(busyAction, copy.discard) : copy.discard}
              </button>
              <button type="button" onClick={onOverwrite} disabled={isBusy}>
                {busyAction === 'overwrite' ? copy.overwriting : copy.overwrite}
              </button>
              <button type="button" className="primary" onClick={onSaveAs} disabled={isBusy}>
                {busyAction === 'saveAs' ? getBusyLabel(busyAction, copy.saveAs) : copy.saveAs}
              </button>
            </>
          ) : (
            <>
              {copy.showReload && (
                <button type="button" onClick={onReload} disabled={isBusy}>
                  {busyAction === 'reload' ? getBusyLabel(busyAction, t('conflict.reload')) : t('conflict.reload')}
                </button>
              )}
              <button type="button" className="primary" onClick={onSaveAs} disabled={isBusy}>
                {busyAction === 'saveAs' ? getBusyLabel(busyAction, copy.saveAs) : copy.saveAs}
              </button>
              <button
                type="button"
                className={copy.isOverwriteDanger ? 'danger' : undefined}
                onClick={onOverwrite}
                disabled={isBusy}
              >
                {busyAction === 'overwrite' ? copy.overwriting : copy.overwrite}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
