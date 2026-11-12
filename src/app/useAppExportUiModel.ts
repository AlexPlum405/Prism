import { exists as fsExists } from '../platform/tauri/fileSystem';
import { useAppToast } from '../hooks/useAppToast';
import { useExportTaskUi } from '../hooks/useExportTaskUi';
import { useSaveExportDialogModel } from './useSaveExportDialogModel';

type SaveExportDialogInput = Omit<
  Parameters<typeof useSaveExportDialogModel>[0],
  'existsPath' | 'showToast'
>;

export function useAppExportUiModel({
  exportDefaults,
  rootPath,
}: SaveExportDialogInput) {
  const { toast, leaving, showToast, dismissToast } = useAppToast();
  const exportTaskUi = useExportTaskUi(showToast);
  const saveExportDialog = useSaveExportDialogModel({
    existsPath: fsExists,
    exportDefaults,
    rootPath,
    showToast,
  });

  return {
    toast,
    toastLeaving: leaving,
    showToast,
    dismissToast,
    ...exportTaskUi,
    ...saveExportDialog,
  };
}
