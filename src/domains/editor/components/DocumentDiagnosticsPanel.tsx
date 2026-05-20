import { useEffect } from 'react';
import type { PrismDiagnostic, PrismDiagnosticKind } from '../../diagnostics/types';
import { t, useI18n, type I18nKey } from '../../i18n';

interface DocumentDiagnosticsPanelProps {
  diagnostics: PrismDiagnostic[];
  onClose: () => void;
  onSelect: (line: number) => void;
  visible: boolean;
}

const KIND_LABEL_KEY: Record<PrismDiagnosticKind, I18nKey> = {
  export: 'diagnostics.kind.export',
  image: 'diagnostics.kind.image',
  link: 'diagnostics.kind.link',
  render: 'diagnostics.kind.render',
  table: 'diagnostics.kind.table',
  typography: 'diagnostics.kind.typography',
};

export function DocumentDiagnosticsPanel({
  diagnostics,
  onClose,
  onSelect,
  visible,
}: DocumentDiagnosticsPanelProps) {
  useI18n();

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

  return (
    <div className={`modal prism-link-diagnostics-modal prism-diagnostics-popover ${visible ? 'is-active' : ''}`} role="dialog" aria-label={t('diagnostics.panel.aria')}>
      <div className="modal-header">
        <div>
          <div className="modal-title">{t('diagnostics.panel.title', { count: diagnostics.length || 0 })}</div>
          <div className="prism-diagnostics-subtitle">{t('diagnostics.panel.subtitle')}</div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
      </div>
      <div className="modal-body prism-link-diagnostics-body">
        {diagnostics.length === 0 ? (
          <div className="prism-link-diagnostics-empty">{t('diagnostics.panel.empty')}</div>
        ) : (
          <div className="prism-link-diagnostics-list">
            {diagnostics.map((diagnostic, index) => {
              const hasLine = typeof diagnostic.line === 'number';
              return (
                <button
                  key={`${diagnostic.source}-${diagnostic.line ?? 'none'}-${diagnostic.column ?? 'none'}-${diagnostic.kind}-${index}`}
                  type="button"
                  className="prism-link-diagnostic-item"
                  disabled={!hasLine}
                  onClick={() => {
                    if (hasLine) onSelect(diagnostic.line as number);
                  }}
                >
                  <span className="prism-link-diagnostic-kind">{t(KIND_LABEL_KEY[diagnostic.kind])}</span>
                  <span className="prism-link-diagnostic-main">
                    <span className="prism-link-diagnostic-message">{diagnostic.message}</span>
                    {diagnostic.reason && (
                      <span className="prism-link-diagnostic-target">{diagnostic.reason}</span>
                    )}
                  </span>
                  <span className="prism-link-diagnostic-side">
                    <span className="prism-link-diagnostic-location">
                      {hasLine ? `${diagnostic.line}:${diagnostic.column ?? 1}` : t('common.unspecified')}
                    </span>
                    {diagnostic.action && (
                      <span className="prism-link-diagnostic-action">{diagnostic.action}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
