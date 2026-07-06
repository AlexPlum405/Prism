import { useEffect, useRef } from 'react';
import { getPendingStartupFiles, listenForStartupFiles } from '../platform/tauri/startupFiles';

const DEFAULT_PENDING_FILE_POLL_DELAYS = [0, 200, 800, 1600] as const;
const RECENT_STARTUP_FILE_TTL_MS = 2_500;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export interface UseStartupFileOpenInput {
  enabled?: boolean;
  onOpenFilePath: (path: string) => void | Promise<void>;
  pendingFilePollDelays?: readonly number[];
  wait?: (ms: number) => Promise<unknown>;
}

export function selectNewStartupFilePaths(
  paths: string[],
  recentPaths: Map<string, number>,
  now = Date.now(),
  ttlMs = RECENT_STARTUP_FILE_TTL_MS,
): string[] {
  for (const [path, timestamp] of recentPaths) {
    if (now - timestamp > ttlMs) {
      recentPaths.delete(path);
    }
  }

  const selected: string[] = [];
  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (!path) continue;
    const lastSeenAt = recentPaths.get(path);
    if (lastSeenAt !== undefined && now - lastSeenAt <= ttlMs) continue;
    recentPaths.set(path, now);
    selected.push(path);
  }
  return selected;
}

export function useStartupFileOpen({
  enabled = true,
  onOpenFilePath,
  pendingFilePollDelays = DEFAULT_PENDING_FILE_POLL_DELAYS,
  wait = delay,
}: UseStartupFileOpenInput) {
  const recentPathsRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const openPaths = async (paths: string[]) => {
      let opened = false;
      for (const path of selectNewStartupFilePaths(paths, recentPathsRef.current)) {
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
      void (async () => {
        await openPaths(paths);
        try {
          await getPendingStartupFiles();
        } catch {
          // Clearing the native pending queue is best effort.
        }
      })();
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
