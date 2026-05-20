import { useEffect } from 'react';
import type { TypographyDiagnostic } from '../extensions/typographyDiagnostics';

interface TypographyDiagnosticsPanelProps {
  diagnostics: TypographyDiagnostic[];
  onClose: () => void;
  onSelect: (line: number) => void;
  visible: boolean;
}

const KIND_LABEL: Record<TypographyDiagnostic['kind'], string> = {
  'cjk-latin-spacing': '间距',
  'halfwidth-punctuation': '标点',
  'heading-hierarchy': '标题',
  'repeated-empty-lines': '空行',
};

const KIND_ACTION: Record<TypographyDiagnostic['kind'], string> = {
  'cjk-latin-spacing': '定位后调整空格',
  'halfwidth-punctuation': '定位后替换标点',
  'heading-hierarchy': '定位后调整层级',
  'repeated-empty-lines': '定位后压缩空行',
};

export function TypographyDiagnosticsPanel({
  diagnostics,
  onClose,
  onSelect,
  visible,
}: TypographyDiagnosticsPanelProps) {
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
    <div className={`modal prism-link-diagnostics-modal prism-diagnostics-popover ${visible ? 'is-active' : ''}`} role="dialog" aria-label="排版提示">
        <div className="modal-header">
          <div>
            <div className="modal-title">{diagnostics.length || 0} 个排版提示</div>
            <div className="prism-diagnostics-subtitle">类型、位置、原因和处理动作</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="modal-body prism-link-diagnostics-body">
          {diagnostics.length === 0 ? (
            <div className="prism-link-diagnostics-empty">当前文档没有排版提示</div>
          ) : (
            <div className="prism-link-diagnostics-list">
              {diagnostics.map((diagnostic, index) => (
                <button
                  key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.kind}-${index}`}
                  type="button"
                  className="prism-link-diagnostic-item"
                  onClick={() => onSelect(diagnostic.line)}
                >
                  <span className="prism-link-diagnostic-kind">{KIND_LABEL[diagnostic.kind]}</span>
                  <span className="prism-link-diagnostic-main">
                    <span className="prism-link-diagnostic-message">{diagnostic.message}</span>
                    <span className="prism-link-diagnostic-target">{diagnostic.suggestion}</span>
                  </span>
                  <span className="prism-link-diagnostic-side">
                    <span className="prism-link-diagnostic-location">
                      {diagnostic.line}:{diagnostic.column}
                    </span>
                    <span className="prism-link-diagnostic-action">{KIND_ACTION[diagnostic.kind]}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
