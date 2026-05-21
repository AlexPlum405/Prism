import { useEffect } from 'react';
import { getPendingStartupFiles, listenForStartupFiles } from '../platform/tauri/startupFiles';

const DEFAULT_PENDING_FILE_POLL_DELAYS = [200, 800] as const;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export interface UseStartupFileOpenInput {
  onOpenFilePath: (path: string) => void | Promise<void>;
  pendingFilePollDelays?: readonly number[];
  wait?: (ms: number) => Promise<unknown>;
}

export function useStartupFileOpen({
  onOpenFilePath,
  pendingFilePollDelays = DEFAULT_PENDING_FILE_POLL_DELAYS,
  wait = delay,
}: UseStartupFileOpenInput) {
  useEffect(() => {
    let mounted = true;

    const openFirstPath = async (paths: string[]) => {
      const path = paths[0];
      if (!path || !mounted) return false;
      await onOpenFilePath(path);
      return true;
    };

    const openPendingFiles = async () => {
      try {
        return await openFirstPath(await getPendingStartupFiles());
      } catch {
        // Pending file integration is best effort.
        return false;
      }
    };

    const unlisten = listenForStartupFiles((paths) => {
      void openFirstPath(paths);
    });

    void (async () => {
      for (const waitMs of pendingFilePollDelays) {
        await wait(waitMs);
        if (!mounted) return;
        if (await openPendingFiles()) return;
      }
    })();

    return () => {
      mounted = false;
      void unlisten.then((fn) => fn());
    };
  }, [onOpenFilePath, pendingFilePollDelays, wait]);
}
