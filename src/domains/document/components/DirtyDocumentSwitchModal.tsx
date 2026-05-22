import { t, useI18n } from '../../i18n';
import type { DirtyDocumentSwitchAction } from '../../../lib/fileActions';

interface DirtyDocumentSwitchModalProps {
  currentName: string;
  targetName: string;
  visible: boolean;
  onAction: (action: DirtyDocumentSwitchAction) => void;
}

export function DirtyDocumentSwitchModal({
  currentName,
  targetName,
  visible,
  onAction,
}: DirtyDocumentSwitchModalProps) {
  useI18n();
  if (!visible) return null;

  return (
    <>
      <div className="modal-overlay" onClick={() => onAction('cancel')} />
      <div className="modal prism-conflict-modal" role="dialog" aria-label={t('dirtySwitch.title')} aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">{t('dirtySwitch.title')}</div>
        </div>
        <div className="modal-body prism-conflict-body">
          <div className="prism-conflict-kicker">{t('dirtySwitch.kicker')}</div>
          <div className="prism-conflict-title">{currentName}</div>
          <p>
            {t('dirtySwitch.body', { current: currentName, target: targetName })}
          </p>
        </div>
        <div className="prism-conflict-actions">
          <button type="button" onClick={() => onAction('cancel')}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={() => onAction('saveAs')}>
            {t('dirtySwitch.saveAs')}
          </button>
          <button type="button" className="danger" onClick={() => onAction('discard')}>
            {t('dirtySwitch.discard')}
          </button>
          <button type="button" className="primary" onClick={() => onAction('save')}>
            {t('dirtySwitch.save')}
          </button>
        </div>
      </div>
    </>
  );
}
