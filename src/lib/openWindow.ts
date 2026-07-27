import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getRuntimePlatform } from '../domains/workspace/services';

let windowCounter = 0;

export async function openPrismWindow(params: {
  filePath?: string;
  folderPath?: string;
} = {}): Promise<void> {
  const label = `prism-${Date.now()}-${windowCounter++}`;
  const searchParams = new URLSearchParams();

  if (params.filePath) {
    searchParams.set('file', params.filePath);
  }
  if (params.folderPath) {
    searchParams.set('folder', params.folderPath);
  }
  if (!params.filePath && !params.folderPath) {
    searchParams.set('newWindow', '1');
  }

  const query = searchParams.toString();
  const url = query ? `/?${query}` : '/';

  const isMacOS = getRuntimePlatform() === 'mac';

  const webview = new WebviewWindow(label, {
    url,
    title: 'Prism',
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    maximizable: true,
    minimizable: true,
    closable: true,
    decorations: isMacOS,
    transparent: !isMacOS,
    titleBarStyle: isMacOS ? 'overlay' : undefined,
    hiddenTitle: isMacOS,
    visible: false,
  });

  await webview.once('tauri://error', (e) => {
    console.error('[openPrismWindow] Window creation failed:', e);
  });
}
