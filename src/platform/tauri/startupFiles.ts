import { listen } from '@tauri-apps/api/event';
import { invokeNativeCommand } from './nativeCommands';

export function getPendingStartupFiles(): Promise<string[]> {
  return invokeNativeCommand<string[]>('get_pending_files');
}

export function listenForStartupFiles(
  handler: (paths: string[]) => void | Promise<void>,
): Promise<() => void> {
  return listen<string[]>('file-opened', (event) => {
    void handler(event.payload);
  });
}
