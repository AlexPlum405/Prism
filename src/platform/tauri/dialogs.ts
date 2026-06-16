type DialogModule = typeof import('@tauri-apps/plugin-dialog');

export async function askDialog(...args: Parameters<DialogModule['ask']>): Promise<Awaited<ReturnType<DialogModule['ask']>>> {
  const { ask } = await import('@tauri-apps/plugin-dialog');
  return ask(...args);
}

export async function confirmDialog(
  ...args: Parameters<DialogModule['confirm']>
): Promise<Awaited<ReturnType<DialogModule['confirm']>>> {
  const { confirm } = await import('@tauri-apps/plugin-dialog');
  return confirm(...args);
}

export async function messageDialog(
  ...args: Parameters<DialogModule['message']>
): Promise<Awaited<ReturnType<DialogModule['message']>>> {
  const { message } = await import('@tauri-apps/plugin-dialog');
  return message(...args);
}

export async function openDialog(
  ...args: Parameters<DialogModule['open']>
): Promise<Awaited<ReturnType<DialogModule['open']>>> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  return open(...args);
}
