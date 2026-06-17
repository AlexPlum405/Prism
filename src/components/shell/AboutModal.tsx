import { useEffect } from 'react';
import { useI18n } from '../../domains/i18n';
import { PRISM_BRAND_PILLARS } from '../../lib/brand';

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
          <div className="about-brand-mark" aria-hidden="true">P</div>
          <div className="caption">PRISM · VERSION {version}</div>
          <div className="display">Prism</div>
          <p className="about-tagline">{t('about.tagline')}</p>
          <p className="about-copy">
            {t('about.copy')}
          </p>
          <div className="about-pillars" aria-label={t('brand.pillarsLabel')}>
            {PRISM_BRAND_PILLARS.map((pillar) => (
              <div key={pillar.id} className="about-pillar">
                <div>{t(pillar.titleKey)}</div>
                <span>{t(pillar.bodyKey)}</span>
              </div>
            ))}
          </div>
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
