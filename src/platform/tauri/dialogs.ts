import * as dialog from '@tauri-apps/plugin-dialog';

export function askDialog(...args: Parameters<typeof dialog.ask>): ReturnType<typeof dialog.ask> {
  return dialog.ask(...args);
}

export function confirmDialog(...args: Parameters<typeof dialog.confirm>): ReturnType<typeof dialog.confirm> {
  return dialog.confirm(...args);
}

export function messageDialog(...args: Parameters<typeof dialog.message>): ReturnType<typeof dialog.message> {
  return dialog.message(...args);
}

export function openDialog(...args: Parameters<typeof dialog.open>): ReturnType<typeof dialog.open> {
  return dialog.open(...args);
}
