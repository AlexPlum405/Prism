import { openDialog } from '../../../platform/tauri/dialogs';
import { useDocumentStore } from '../../document/store';
import { useWorkspaceStore } from '../store';
import { loadFolderTree } from '../lib/loadFolderTree';
import { openPrismWindow } from '../../../lib/openWindow';
import { grantWorkspaceDirectoryScope } from '../../../lib/fileSystemScope';
import { emitAppEvent } from '../../../platform/events/appEvents';
import { useI18n } from '../../i18n';

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function OpenFolderButton() {
  const { t } = useI18n();
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  const handleOpen = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        recursive: true,
      });

      if (typeof selected !== 'string') return;
      await grantWorkspaceDirectoryScope(selected);

      if (!currentDocument) {
        const tree = await loadFolderTree(selected);
        setWorkspace(selected, tree);
      } else {
        await openPrismWindow({ folderPath: selected });
      }
    } catch (err) {
      console.error('[OpenFolderButton] Failed:', err);
      emitAppEvent('toast.show', {
        tone: 'error',
        title: t('command.operationFailed', { message: formatError(err) }),
      });
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
      {t('workspace.openFolder')}
    </button>
  );
}
