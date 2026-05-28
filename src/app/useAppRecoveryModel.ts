import { useRecoveryQueue } from '../domains/document/hooks/useRecoveryQueue';

interface RecoveryPromptVisibilityInput {
  hasSnapshot: boolean;
  hasSaveDialog: boolean;
  hasSaveConflict: boolean;
}

interface UseAppRecoveryModelInput {
  hasSaveConflict: boolean;
  saveDialogVisible: boolean;
  showToast: (message: string) => void;
}

export function shouldShowRecoveryPrompt({
  hasSnapshot,
  hasSaveDialog,
  hasSaveConflict,
}: RecoveryPromptVisibilityInput) {
  return hasSnapshot && !hasSaveDialog && !hasSaveConflict;
}

export function useAppRecoveryModel({
  hasSaveConflict,
  saveDialogVisible,
  showToast,
}: UseAppRecoveryModelInput) {
  const {
    activeRecoverySnapshot,
    recoveryAction,
    handleRestoreRecovery,
    handleDiscardRecovery,
  } = useRecoveryQueue({ showToast });

  const recoveryPromptVisible = shouldShowRecoveryPrompt({
    hasSnapshot: Boolean(activeRecoverySnapshot),
    hasSaveDialog: saveDialogVisible,
    hasSaveConflict,
  });

  return {
    activeRecoverySnapshot,
    handleDiscardRecovery,
    handleRestoreRecovery,
    recoveryAction,
    recoveryPromptVisible,
  };
}
