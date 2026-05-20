import { useEffect } from 'react';
import type { DocumentLinkReference } from '../services';
import { useI18n } from '../../i18n';

interface DocumentLinksPanelProps {
  links: DocumentLinkReference[];
  onClose: () => void;
  onSelect: (link: DocumentLinkReference) => void;
  visible: boolean;
}

const KIND_LABEL: Record<DocumentLinkReference['kind'], string> = {
  markdown: 'Markdown',
  wiki: 'Wiki',
};

export function DocumentLinksPanel({
  links,
  onClose,
  onSelect,
  visible,
}: DocumentLinksPanelProps) {
  const { t } = useI18n();
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, visible]);

  if (!visible) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal prism-document-links-modal" role="dialog" aria-label={t('workspace.documentLinks.title')}>
        <div className="modal-header">
          <div className="modal-title">{t('workspace.documentLinks.title')}</div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body prism-document-links-body">
          {links.length === 0 ? (
            <div className="prism-document-links-empty">{t('workspace.documentLinks.empty')}</div>
          ) : (
            <div className="prism-document-links-list">
              {links.map((link, index) => (
                <button
                  key={`${link.line}-${link.column}-${link.kind}-${index}`}
                  type="button"
                  className="prism-document-link-item"
                  onClick={() => onSelect(link)}
                  title={`${link.label} ${link.line}:${link.column}`}
                >
                  <span className="prism-document-link-kind">{KIND_LABEL[link.kind]}</span>
                  <span className="prism-document-link-main">
                    <span className="prism-document-link-label">{link.label}</span>
                    <span className="prism-document-link-target">{link.target}</span>
                  </span>
                  <span className="prism-document-link-location">
                    {link.line}:{link.column}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
