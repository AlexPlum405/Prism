import { useEffect } from 'react';
import type { BacklinkReference } from '../services';

interface BacklinksPanelProps {
  backlinks: BacklinkReference[];
  onClose: () => void;
  onSelect: (reference: BacklinkReference) => void;
  visible: boolean;
}

export function BacklinksPanel({
  backlinks,
  onClose,
  onSelect,
  visible,
}: BacklinksPanelProps) {
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
      <div className="modal prism-backlinks-modal" role="dialog" aria-label="反向链接">
        <div className="modal-header">
          <div className="modal-title">反向链接</div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="modal-body prism-backlinks-body">
          {backlinks.length === 0 ? (
            <div className="prism-backlinks-empty">当前文档没有反向链接</div>
          ) : (
            <div className="prism-backlinks-list">
              {backlinks.map((reference, index) => (
                <button
                  key={`${reference.path}-${reference.line}-${reference.column}-${index}`}
                  type="button"
                  className="prism-backlink-item"
                  onClick={() => onSelect(reference)}
                >
                  <span className="prism-backlink-title">{reference.title}</span>
                  <span className="prism-backlink-excerpt">{reference.excerpt}</span>
                  <span className="prism-backlink-location">
                    {reference.line}:{reference.column}
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
