import { useEffect } from 'react';
import type { LinkDiagnostic } from '../extensions/linkDiagnostics';
import { useI18n, type I18nKey } from '../../i18n';

interface LinkDiagnosticsPanelProps {
  diagnostics: LinkDiagnostic[];
  onClose: () => void;
  onSelect: (line: number) => void;
  visible: boolean;
}

const KIND_LABEL_KEY: Record<LinkDiagnostic['kind'], I18nKey> = {
  'empty-target': 'editor.linkDiagnostics.kind.emptyTarget',
  'missing-file': 'editor.linkDiagnostics.kind.missingFile',
  'missing-heading': 'editor.linkDiagnostics.kind.missingHeading',
};

const KIND_REASON_KEY: Record<LinkDiagnostic['kind'], I18nKey> = {
  'empty-target': 'editor.linkDiagnostics.reason.emptyTarget',
  'missing-file': 'editor.linkDiagnostics.reason.missingFile',
  'missing-heading': 'editor.linkDiagnostics.reason.missingHeading',
};

const KIND_ACTION_KEY: Record<LinkDiagnostic['kind'], I18nKey> = {
  'empty-target': 'editor.linkDiagnostics.action.emptyTarget',
  'missing-file': 'editor.linkDiagnostics.action.missingFile',
  'missing-heading': 'editor.linkDiagnostics.action.missingHeading',
};

export function LinkDiagnosticsPanel({
  diagnostics,
  onClose,
  onSelect,
  visible,
}: LinkDiagnosticsPanelProps) {
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

  return (
    <div className={`modal prism-link-diagnostics-modal prism-diagnostics-popover ${visible ? 'is-active' : ''}`} role="dialog" aria-label={t('editor.linkDiagnostics.aria')}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{t('editor.linkDiagnostics.title', { count: diagnostics.length || 0 })}</div>
            <div className="prism-diagnostics-subtitle">{t('editor.linkDiagnostics.subtitle')}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body prism-link-diagnostics-body">
          {diagnostics.length === 0 ? (
            <div className="prism-link-diagnostics-empty">{t('editor.linkDiagnostics.empty')}</div>
          ) : (
            <div className="prism-link-diagnostics-list">
              {diagnostics.map((diagnostic, index) => (
                <button
                  key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.kind}-${index}`}
                  type="button"
                  className="prism-link-diagnostic-item"
                  onClick={() => onSelect(diagnostic.line)}
                >
                  <span className="prism-link-diagnostic-kind">{t(KIND_LABEL_KEY[diagnostic.kind])}</span>
                  <span className="prism-link-diagnostic-main">
                    <span className="prism-link-diagnostic-message">{diagnostic.message}</span>
                    <span className="prism-link-diagnostic-target">{t(KIND_REASON_KEY[diagnostic.kind])}</span>
                    <span className="prism-link-diagnostic-target">{diagnostic.target || t('editor.linkDiagnostics.emptyTarget')}</span>
                  </span>
                  <span className="prism-link-diagnostic-side">
                    <span className="prism-link-diagnostic-location">
                      {diagnostic.line}:{diagnostic.column}
                    </span>
                    <span className="prism-link-diagnostic-action">{t(KIND_ACTION_KEY[diagnostic.kind])}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
