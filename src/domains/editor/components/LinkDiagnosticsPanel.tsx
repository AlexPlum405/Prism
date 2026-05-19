import { useEffect } from 'react';
import type { LinkDiagnostic } from '../extensions/linkDiagnostics';

interface LinkDiagnosticsPanelProps {
  diagnostics: LinkDiagnostic[];
  onClose: () => void;
  onSelect: (line: number) => void;
  visible: boolean;
}

const KIND_LABEL: Record<LinkDiagnostic['kind'], string> = {
  'empty-target': '空链接',
  'missing-file': '缺失文件',
  'missing-heading': '缺失标题',
};

const KIND_REASON: Record<LinkDiagnostic['kind'], string> = {
  'empty-target': '链接目标为空，点击后没有可打开的位置。',
  'missing-file': '工作区里没有找到这个相对路径对应的 Markdown 文件。',
  'missing-heading': '目标文件存在，但没有匹配的标题锚点。',
};

const KIND_ACTION: Record<LinkDiagnostic['kind'], string> = {
  'empty-target': '定位后补全目标',
  'missing-file': '定位后修正路径',
  'missing-heading': '定位后修正标题',
};

export function LinkDiagnosticsPanel({
  diagnostics,
  onClose,
  onSelect,
  visible,
}: LinkDiagnosticsPanelProps) {
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
    <div className="modal prism-link-diagnostics-modal prism-diagnostics-popover" role="dialog" aria-label="链接问题">
        <div className="modal-header">
          <div>
            <div className="modal-title">{diagnostics.length || 0} 个链接问题</div>
            <div className="prism-diagnostics-subtitle">类型、位置、原因和处理动作</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="modal-body prism-link-diagnostics-body">
          {diagnostics.length === 0 ? (
            <div className="prism-link-diagnostics-empty">当前文档没有链接问题</div>
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
                    <span className="prism-link-diagnostic-target">{KIND_REASON[diagnostic.kind]}</span>
                    <span className="prism-link-diagnostic-target">{diagnostic.target || '空目标'}</span>
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
