import { DirtyDocumentSwitchModal } from '../../domains/document/components/DirtyDocumentSwitchModal';
import { RecoveryModal } from '../../domains/document/components/RecoveryModal';
import {
  SaveConflictModal,
  type SaveConflictAction,
} from '../../domains/document/components/SaveConflictModal';
import type { RecoverySnapshot } from '../../domains/document/services/recovery';
import type { DocumentSaveIssue } from '../../domains/document/types';
import type { DirtyDocumentSwitchAction } from '../../lib/fileActions';
import { t } from '../../domains/i18n';

interface DirtySwitchPromptState {
  currentName: string;
  resolve: (action: DirtyDocumentSwitchAction) => void;
  targetName: string;
}

interface DocumentSafetyControllerProps {
  activeRecoverySnapshot: RecoverySnapshot | null;
  conflictAction: SaveConflictAction | null;
  currentDocumentName?: string;
  dirtySwitchPrompt: DirtySwitchPromptState | null;
  hasSaveConflict: boolean;
  recoveryAction: 'restore' | 'discard' | null;
  recoveryPromptVisible: boolean;
  saveDialogVisible: boolean;
  saveError: string | null;
  saveIssue: DocumentSaveIssue | null;
  onDiscardRecovery: () => void;
  onRestoreRecovery: () => void;
  onResolveDirtySwitch: (action: DirtyDocumentSwitchAction) => void;
  onRunConflictAction: (action: SaveConflictAction) => void | Promise<void>;
}

export function DocumentSafetyController({
  activeRecoverySnapshot,
  conflictAction,
  currentDocumentName,
  dirtySwitchPrompt,
  hasSaveConflict,
  recoveryAction,
  recoveryPromptVisible,
  saveDialogVisible,
  saveError,
  saveIssue,
  onDiscardRecovery,
  onRestoreRecovery,
  onResolveDirtySwitch,
  onRunConflictAction,
}: DocumentSafetyControllerProps) {
  return (
    <>
      <DirtyDocumentSwitchModal
        visible={Boolean(dirtySwitchPrompt)}
        currentName={dirtySwitchPrompt?.currentName ?? ''}
        targetName={dirtySwitchPrompt?.targetName ?? ''}
        onAction={onResolveDirtySwitch}
      />

      <RecoveryModal
        visible={recoveryPromptVisible}
        snapshot={activeRecoverySnapshot}
        busyAction={recoveryAction}
        onRestore={onRestoreRecovery}
        onDiscard={onDiscardRecovery}
      />

      <SaveConflictModal
        visible={Boolean(hasSaveConflict && !saveDialogVisible)}
        documentName={currentDocumentName ?? t('common.untitled')}
        error={saveError}
        issueKind={saveIssue}
        busyAction={conflictAction}
        onReload={() => onRunConflictAction('reload')}
        onSaveAs={() => onRunConflictAction('saveAs')}
        onOverwrite={() => onRunConflictAction('overwrite')}
      />
    </>
  );
}
