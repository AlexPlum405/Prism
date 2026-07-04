import { useEffect } from 'react';
import { getPendingStartupFiles, listenForStartupFiles } from '../platform/tauri/startupFiles';

const DEFAULT_PENDING_FILE_POLL_DELAYS = [0, 200, 800, 1600] as const;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export interface UseStartupFileOpenInput {
  enabled?: boolean;
  onOpenFilePath: (path: string) => void | Promise<void>;
  pendingFilePollDelays?: readonly number[];
  wait?: (ms: number) => Promise<unknown>;
}

export function useStartupFileOpen({
  enabled = true,
  onOpenFilePath,
  pendingFilePollDelays = DEFAULT_PENDING_FILE_POLL_DELAYS,
  wait = delay,
}: UseStartupFileOpenInput) {
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const openPaths = async (paths: string[]) => {
      let opened = false;
      for (const path of paths) {
        if (!path || !mounted) continue;
        await onOpenFilePath(path);
        opened = true;
      }
      return opened;
    };

    const openPendingFiles = async () => {
      try {
        return await openPaths(await getPendingStartupFiles());
      } catch {
        // Pending file integration is best effort.
        return false;
      }
    };

    const unlisten = listenForStartupFiles((paths) => {
      void openPaths(paths);
    });

    void (async () => {
      for (const waitMs of pendingFilePollDelays) {
        if (waitMs > 0) {
          await wait(waitMs);
        }
        if (!mounted) return;
        if (await openPendingFiles()) return;
      }
    })();

    return () => {
      mounted = false;
      void unlisten.then((fn) => fn());
    };
  }, [enabled, onOpenFilePath, pendingFilePollDelays, wait]);
}
