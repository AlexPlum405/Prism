import { listen } from '@tauri-apps/api/event';

interface NativeCommandPayload {
  action?: unknown;
}

export async function listenForNativeCommands(
  handler: (action: string) => void | Promise<void>,
): Promise<() => void> {
  try {
    return await listen<NativeCommandPayload>('prism-command', (event) => {
      if (typeof event.payload?.action !== 'string') return;
      void handler(event.payload.action);
    });
  } catch (error) {
    console.warn('[nativeMenu] Failed to listen for native menu commands', error);
    return () => undefined;
  }
}
