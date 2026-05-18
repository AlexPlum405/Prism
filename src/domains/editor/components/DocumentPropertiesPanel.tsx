import { useEffect, useMemo, useState } from 'react';
import {
  parseDocumentFrontMatter,
  updateDocumentFrontMatter,
  type DocumentFrontMatterProperties,
} from '../extensions/frontMatterProperties';

interface DocumentPropertiesPanelProps {
  content: string;
  onApply: (content: string) => void;
  onClose: () => void;
  onNotice?: (message: string) => void;
  visible: boolean;
}

const EMPTY_PROPERTIES: DocumentFrontMatterProperties = {
  title: '',
  tags: '',
  description: '',
  author: '',
  date: '',
  status: '',
  exportRaw: '',
};

export function DocumentPropertiesPanel({
  content,
  onApply,
  onClose,
  onNotice,
  visible,
}: DocumentPropertiesPanelProps) {
  const parsed = useMemo(() => parseDocumentFrontMatter(content), [content]);
  const [properties, setProperties] = useState<DocumentFrontMatterProperties>(EMPTY_PROPERTIES);

  useEffect(() => {
    if (visible) setProperties(parsed.properties);
  }, [parsed.properties, visible]);

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

  const updateField = (field: keyof DocumentFrontMatterProperties, value: string) => {
    setProperties((current) => ({ ...current, [field]: value }));
  };

  const apply = () => {
    try {
      onApply(updateDocumentFrontMatter(content, properties));
      onClose();
      onNotice?.('文档属性已更新');
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : '文档属性更新失败');
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal prism-document-properties-modal" role="dialog" aria-label="文档属性">
        <div className="modal-header">
          <div className="modal-title">文档属性</div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="modal-body prism-document-properties-body">
          {parsed.error && (
            <div className="prism-document-properties-error">
              当前 Front Matter 不是有效 YAML，请先回到源码修正后再编辑属性。
            </div>
          )}
          <label className="prism-document-property-field">
            <span>标题</span>
            <input value={properties.title} onChange={(event) => updateField('title', event.currentTarget.value)} />
          </label>
          <label className="prism-document-property-field">
            <span>标签</span>
            <input
              value={properties.tags}
              placeholder="多个标签用逗号分隔"
              onChange={(event) => updateField('tags', event.currentTarget.value)}
            />
          </label>
          <label className="prism-document-property-field">
            <span>描述</span>
            <textarea
              rows={3}
              value={properties.description}
              onChange={(event) => updateField('description', event.currentTarget.value)}
            />
          </label>
          <div className="prism-document-property-grid">
            <label className="prism-document-property-field">
              <span>作者</span>
              <input value={properties.author} onChange={(event) => updateField('author', event.currentTarget.value)} />
            </label>
            <label className="prism-document-property-field">
              <span>日期</span>
              <input value={properties.date} onChange={(event) => updateField('date', event.currentTarget.value)} />
            </label>
            <label className="prism-document-property-field">
              <span>状态</span>
              <input value={properties.status} onChange={(event) => updateField('status', event.currentTarget.value)} />
            </label>
          </div>
          <label className="prism-document-property-field">
            <span>导出</span>
            <textarea
              rows={4}
              value={properties.exportRaw}
              placeholder={'template: theme\npaper: a4\nmargin: standard'}
              onChange={(event) => updateField('exportRaw', event.currentTarget.value)}
            />
          </label>
          <div className="prism-document-properties-hint">
            属性会写回当前 Markdown 顶部的 YAML Front Matter；Prism 不创建数据库或隐藏副本。
          </div>
        </div>
        <div className="modal-footer">
          <button className="pill-ghost" onClick={onClose}>取消</button>
          <button className="pill-filled" onClick={apply} disabled={Boolean(parsed.error)}>应用</button>
        </div>
      </div>
    </>
  );
}
