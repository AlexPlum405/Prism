import { useEffect } from 'react';
import type { TypographyDiagnostic } from '../extensions/typographyDiagnostics';
import { useI18n, type I18nKey } from '../../i18n';

interface TypographyDiagnosticsPanelProps {
  diagnostics: TypographyDiagnostic[];
  onClose: () => void;
  onSelect: (line: number) => void;
  visible: boolean;
}

const KIND_LABEL_KEY: Record<TypographyDiagnostic['kind'], I18nKey> = {
  'cjk-latin-spacing': 'editor.typography.kind.spacing',
  'halfwidth-punctuation': 'editor.typography.kind.punctuation',
  'heading-hierarchy': 'editor.typography.kind.heading',
  'repeated-empty-lines': 'editor.typography.kind.emptyLines',
};

const KIND_ACTION_KEY: Record<TypographyDiagnostic['kind'], I18nKey> = {
  'cjk-latin-spacing': 'editor.typography.action.spacing',
  'halfwidth-punctuation': 'editor.typography.action.punctuation',
  'heading-hierarchy': 'editor.typography.action.heading',
  'repeated-empty-lines': 'editor.typography.action.emptyLines',
};

export function TypographyDiagnosticsPanel({
  diagnostics,
  onClose,
  onSelect,
  visible,
}: TypographyDiagnosticsPanelProps) {
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
    <div className={`modal prism-link-diagnostics-modal prism-diagnostics-popover ${visible ? 'is-active' : ''}`} role="dialog" aria-label={t('editor.typography.aria')}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{t('editor.typography.title', { count: diagnostics.length || 0 })}</div>
            <div className="prism-diagnostics-subtitle">{t('editor.typography.subtitle')}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body prism-link-diagnostics-body">
          {diagnostics.length === 0 ? (
            <div className="prism-link-diagnostics-empty">{t('editor.typography.empty')}</div>
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
                    <span className="prism-link-diagnostic-target">{diagnostic.suggestion}</span>
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
