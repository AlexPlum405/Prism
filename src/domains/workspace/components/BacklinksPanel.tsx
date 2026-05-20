import { useEffect } from 'react';
import type { BacklinkReference } from '../services';
import { useI18n } from '../../i18n';

interface BacklinksPanelProps {
  backlinks: BacklinkReference[];
  onClose: () => void;
  onSelect: (reference: BacklinkReference) => void;
  visible: boolean;
}

interface BacklinkGroup {
  path: string;
  references: BacklinkReference[];
  title: string;
}

function groupBacklinks(backlinks: BacklinkReference[]): BacklinkGroup[] {
  const groups = new Map<string, BacklinkGroup>();

  backlinks.forEach((reference) => {
    const group = groups.get(reference.path);
    if (group) {
      group.references.push(reference);
      return;
    }

    groups.set(reference.path, {
      path: reference.path,
      references: [reference],
      title: reference.title,
    });
  });

  return Array.from(groups.values());
}

export function BacklinksPanel({
  backlinks,
  onClose,
  onSelect,
  visible,
}: BacklinksPanelProps) {
  const { t } = useI18n();
  const groups = groupBacklinks(backlinks);

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
      <div className="modal prism-backlinks-modal" role="dialog" aria-label={t('workspace.backlinks.title')}>
        <div className="modal-header">
          <div className="modal-title">{t('workspace.backlinks.title')}</div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body prism-backlinks-body">
          {backlinks.length === 0 ? (
            <div className="prism-backlinks-empty">{t('workspace.backlinks.empty')}</div>
          ) : (
            <div className="prism-backlinks-list">
              {groups.map((group) => (
                <section key={group.path} className="prism-backlink-group">
                  <div className="prism-backlink-group-header">
                    <span className="prism-backlink-group-title">{group.title}</span>
                    <span className="prism-backlink-group-count">{group.references.length}</span>
                  </div>
                  <div className="prism-backlink-group-list">
                    {group.references.map((reference, index) => (
                      <button
                        key={`${reference.path}-${reference.line}-${reference.column}-${index}`}
                        type="button"
                        className="prism-backlink-reference"
                        onClick={() => onSelect(reference)}
                        title={`${reference.title} ${reference.line}:${reference.column}`}
                      >
                        <span className="prism-backlink-reference-excerpt">{reference.excerpt}</span>
                        <span className="prism-backlink-location">
                          {reference.line}:{reference.column}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
