import type { AppEventKey, AppEventMap } from './eventTypes';

export const APP_EVENT_NAMES = {
  'editor.command': 'prism-editor-command',
  'editor.format': 'prism-format',
  'editor.heading': 'prism-heading',
  'editor.blockFormat': 'prism-block-format',
  'command.run': 'prism-command',
  'search.open': 'prism-search',
  'file.action': 'prism-file-action',
  'file.renameRequest': 'prism-file-rename-request',
  'toast.show': 'prism-toast',
  'export.progress': 'prism-export-progress',
  'export.failed': 'prism-export-failure',
  'export.result': 'prism-export-result',
  'diagnostics.open': 'prism-document-diagnostics-open',
  'presentation.open': 'prism-presentation-open',
  'settings.open': 'prism-open-settings',
} as const satisfies Record<AppEventKey, string>;

export function emitAppEvent<Key extends AppEventKey>(
  key: Key,
  detail: AppEventMap[Key],
): void {
  window.dispatchEvent(new CustomEvent(APP_EVENT_NAMES[key], { detail }));
}

export function onAppEvent<Key extends AppEventKey>(
  key: Key,
  handler: (detail: AppEventMap[Key], event: CustomEvent<AppEventMap[Key]>) => void,
): () => void {
  const eventName = APP_EVENT_NAMES[key];
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AppEventMap[Key]>;
    handler(customEvent.detail, customEvent);
  };

  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
