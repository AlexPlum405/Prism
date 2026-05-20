import { useCallback, useEffect, useState } from 'react';
import {
  deleteRecoverySnapshot,
  listRecoverySnapshots,
  restoreRecoverySnapshot,
  type RecoverySnapshot,
} from '../services/recovery';
import { t } from '../../i18n';

export type RecoveryAction = 'restore' | 'discard';

interface UseRecoveryQueueOptions {
  showToast: (message: string) => void;
}

interface UseRecoveryQueueResult {
  activeRecoverySnapshot: RecoverySnapshot | null;
  recoveryAction: RecoveryAction | null;
  handleRestoreRecovery: () => Promise<void>;
  handleDiscardRecovery: () => Promise<void>;
}

function formatRecoveryError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error instanceof Event) return error.type || t('common.unknownEventError');
  return String(error);
}

export function useRecoveryQueue({ showToast }: UseRecoveryQueueOptions): UseRecoveryQueueResult {
  const [recoverySnapshots, setRecoverySnapshots] = useState<RecoverySnapshot[]>([]);
  const [recoveryAction, setRecoveryAction] = useState<RecoveryAction | null>(null);

  useEffect(() => {
    let cancelled = false;

    listRecoverySnapshots()
      .then((snapshots) => {
        if (!cancelled) setRecoverySnapshots(snapshots);
      })
      .catch(() => {
        if (!cancelled) setRecoverySnapshots([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const removeRecoverySnapshotFromList = useCallback((snapshot: RecoverySnapshot) => {
    setRecoverySnapshots((snapshots) => snapshots.filter((item) => item.id !== snapshot.id));
  }, []);

  const handleRestoreRecovery = useCallback(async () => {
    const snapshot = recoverySnapshots[0];
    if (!snapshot || recoveryAction) return;

    setRecoveryAction('restore');
    try {
      await restoreRecoverySnapshot(snapshot);
      removeRecoverySnapshotFromList(snapshot);
      showToast(t('recovery.restoreDone'));
    } catch (error) {
      showToast(t('recovery.restoreFailed', { message: formatRecoveryError(error) }));
    } finally {
      setRecoveryAction(null);
    }
  }, [recoveryAction, recoverySnapshots, removeRecoverySnapshotFromList, showToast]);

  const handleDiscardRecovery = useCallback(async () => {
    const snapshot = recoverySnapshots[0];
    if (!snapshot || recoveryAction) return;

    setRecoveryAction('discard');
    try {
      await deleteRecoverySnapshot(snapshot);
      removeRecoverySnapshotFromList(snapshot);
      showToast(t('recovery.discardDone'));
    } catch (error) {
      showToast(t('recovery.discardFailed', { message: formatRecoveryError(error) }));
    } finally {
      setRecoveryAction(null);
    }
  }, [recoveryAction, recoverySnapshots, removeRecoverySnapshotFromList, showToast]);

  return {
    activeRecoverySnapshot: recoverySnapshots[0] ?? null,
    recoveryAction,
    handleRestoreRecovery,
    handleDiscardRecovery,
  };
}
