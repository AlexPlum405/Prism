import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getRuntimePlatform } from '../domains/workspace/services';

let windowCounter = 0;

export async function openPrismWindow(params: {
  emptyWindow?: boolean;
  filePath?: string;
  folderPath?: string;
  newDocument?: boolean;
}): Promise<void> {
  const label = `prism-${Date.now()}-${windowCounter++}`;
  const searchParams = new URLSearchParams();

  if (params.emptyWindow) {
    searchParams.set('empty', '1');
  }
  if (params.newDocument) {
    searchParams.set('new', '1');
  }
  if (params.filePath) {
    searchParams.set('file', params.filePath);
  }
  if (params.folderPath) {
    searchParams.set('folder', params.folderPath);
  }

  const url = `/?${searchParams.toString()}`;

  const isMacOS = getRuntimePlatform() === 'mac';

  const webview = new WebviewWindow(label, {
    url,
    title: 'Prism',
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    decorations: isMacOS,
    transparent: !isMacOS,
    titleBarStyle: isMacOS ? 'overlay' : undefined,
    hiddenTitle: isMacOS,
  });

  await webview.once('tauri://error', (e) => {
    console.error('[openPrismWindow] Window creation failed:', e);
  });
}
