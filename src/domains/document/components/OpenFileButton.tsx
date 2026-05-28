import { openDialog } from '../../../platform/tauri/dialogs';
import { readTextFile } from '../../../platform/tauri/fileSystem';
import { useDocumentStore } from '../store';
import { useWorkspaceStore } from '../../workspace/store';
import { loadFolderTree } from '../../workspace/lib/loadFolderTree';
import { MARKDOWN_FILE_FILTERS, basename, dirname } from '../../workspace/services';
import { openPrismWindow } from '../../../lib/openWindow';
import { getFileSnapshotOrNull } from '../fileSnapshot';
import { grantMarkdownFileScope } from '../../../lib/fileSystemScope';
import { useI18n } from '../../i18n';

export function OpenFileButton() {
  const { t } = useI18n();
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const openDocument = useDocumentStore((s) => s.openDocument);
  const { setRootPath, setFileTree } = useWorkspaceStore();

  const handleOpen = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: MARKDOWN_FILE_FILTERS,
      });

      if (typeof selected !== 'string') return;
      await grantMarkdownFileScope(selected);

      if (!currentDocument) {
        const snapshot = await getFileSnapshotOrNull(selected);
        const content = await readTextFile(selected);
        openDocument(selected, basename(selected), content, snapshot);

        const parentDir = dirname(selected);
        setRootPath(parentDir);
        const tree = await loadFolderTree(parentDir);
        setFileTree(tree);
      } else {
        await openPrismWindow({ filePath: selected });
      }
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
