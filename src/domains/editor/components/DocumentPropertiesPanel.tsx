import { useEffect, useMemo, useState } from 'react';
import {
  parseDocumentFrontMatter,
  updateDocumentFrontMatter,
  type DocumentFrontMatterProperties,
} from '../extensions/frontMatterProperties';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();
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
      onNotice?.(t('editor.properties.updated'));
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : t('editor.properties.updateFailed'));
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal prism-document-properties-modal" role="dialog" aria-label={t('editor.properties.title')}>
        <div className="modal-header">
          <div className="modal-title">{t('editor.properties.title')}</div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body prism-document-properties-body">
          {parsed.error && (
            <div className="prism-document-properties-error">
              {t('editor.properties.invalidYaml')}
            </div>
          )}
          <label className="prism-document-property-field">
            <span>{t('editor.properties.field.title')}</span>
            <input value={properties.title} onChange={(event) => updateField('title', event.currentTarget.value)} />
          </label>
          <label className="prism-document-property-field">
            <span>{t('editor.properties.field.tags')}</span>
            <input
              value={properties.tags}
              placeholder={t('editor.properties.tagsPlaceholder')}
              onChange={(event) => updateField('tags', event.currentTarget.value)}
            />
          </label>
          <label className="prism-document-property-field">
            <span>{t('editor.properties.field.description')}</span>
            <textarea
              rows={3}
              value={properties.description}
              onChange={(event) => updateField('description', event.currentTarget.value)}
            />
          </label>
          <div className="prism-document-property-grid">
            <label className="prism-document-property-field">
              <span>{t('editor.properties.field.author')}</span>
              <input value={properties.author} onChange={(event) => updateField('author', event.currentTarget.value)} />
            </label>
            <label className="prism-document-property-field">
              <span>{t('editor.properties.field.date')}</span>
              <input value={properties.date} onChange={(event) => updateField('date', event.currentTarget.value)} />
            </label>
            <label className="prism-document-property-field">
              <span>{t('editor.properties.field.status')}</span>
              <input value={properties.status} onChange={(event) => updateField('status', event.currentTarget.value)} />
            </label>
          </div>
          <label className="prism-document-property-field">
            <span>{t('editor.properties.field.export')}</span>
            <textarea
              rows={4}
              value={properties.exportRaw}
              placeholder={'template: theme\npaper: a4\nmargin: standard'}
              onChange={(event) => updateField('exportRaw', event.currentTarget.value)}
            />
          </label>
          <div className="prism-document-properties-hint">
            {t('editor.properties.hint')}
          </div>
        </div>
        <div className="modal-footer">
          <button className="pill-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="pill-filled" onClick={apply} disabled={Boolean(parsed.error)}>{t('common.apply')}</button>
        </div>
      </div>
    </>
  );
}
