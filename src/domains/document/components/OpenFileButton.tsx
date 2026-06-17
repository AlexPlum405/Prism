import { openDialog } from '../../../platform/tauri/dialogs';
import { useDocumentStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { MARKDOWN_FILE_FILTERS } from '../../workspace/services';
import { useI18n } from '../../i18n';
import { openSelectedDocument } from '../../../lib/openDocumentFlow';

export function OpenFileButton() {
  const { t } = useI18n();

  const handleOpen = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: MARKDOWN_FILE_FILTERS,
      });

      if (typeof selected !== 'string') return;
      await openSelectedDocument(selected, {
        documentStore: useDocumentStore.getState(),
        workspaceStore: useWorkspaceStore.getState(),
      }, { entryPoint: 'document-open-button' });
    } catch (err) {
      console.error('[OpenFileButton] Failed:', err);
    }
  };

  return (
    <button
      onClick={handleOpen}
      style={{
        padding: '8px 16px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '14px',
      }}
    >
      {t('document.openFile')}
    </button>
  );
}
