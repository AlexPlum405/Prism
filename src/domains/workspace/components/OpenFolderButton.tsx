import { open } from '@tauri-apps/plugin-dialog';
import { useDocumentStore } from '../../document/store';
import { useWorkspaceStore } from '../store';
import { loadFolderTree } from '../lib/loadFolderTree';
import { openPrismWindow } from '../../../lib/openWindow';
import { grantWorkspaceDirectoryScope } from '../../../lib/fileSystemScope';
import { useI18n } from '../../i18n';

export function OpenFolderButton() {
  const { t } = useI18n();
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const { setRootPath, setFileTree } = useWorkspaceStore();

  const handleOpen = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        recursive: true,
      });

      if (typeof selected !== 'string') return;
      await grantWorkspaceDirectoryScope(selected);

      if (!currentDocument) {
        setRootPath(selected);
        const tree = await loadFolderTree(selected);
        setFileTree(tree);
      } else {
        await openPrismWindow({ folderPath: selected });
      }
    } catch (err) {
      console.error('[OpenFolderButton] Failed:', err);
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
