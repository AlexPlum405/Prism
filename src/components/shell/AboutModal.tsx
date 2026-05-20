import { useEffect } from 'react';
import { useI18n } from '../../domains/i18n';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
  onCheckUpdate?: () => void;
  version?: string;
}

export function AboutModal({
  visible,
  onClose,
  onCheckUpdate,
  version = __APP_VERSION__,
}: AboutModalProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal about-modal" role="dialog" aria-label={t('about.title')}>
        <div className="modal-header">
          <div className="modal-title">{t('about.title')}</div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body">
          <div className="caption">PRISM · VERSION {version}</div>
          <div className="display">Prism</div>
          <p className="about-copy">
            {t('about.copy')}
          </p>
          <dl className="about-meta">
            <div>
              <dt>{t('about.version')}</dt>
              <dd>v{version}</dd>
            </div>
            <div>
              <dt>{t('about.license')}</dt>
              <dd>MIT</dd>
            </div>
            <div>
              <dt>{t('about.update')}</dt>
              <dd>GitHub Releases</dd>
            </div>
          </dl>
          <div className="about-actions">
            <button type="button" className="primary" onClick={onCheckUpdate}>
              {t('about.checkUpdate')}
            </button>
            <button type="button" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
          <p className="about-footnote">{t('about.footnote')}</p>
        </div>
      </div>
    </>
  );
}
