import { invoke } from '@tauri-apps/api/core';
import { normalizeNativeError } from './result';

export async function invokeNativeCommand<Result = unknown>(
  command: string,
  args?: Record<string, unknown>,
): Promise<Result> {
  try {
    return await invoke<Result>(command, args);
  } catch (error) {
    throw normalizeNativeError(error);
  }
}

export function grantMarkdownFileScopeNative(path: string): Promise<void> {
  return invokeNativeCommand('grant_markdown_file_scope', { path });
}

export function grantWorkspaceDirectoryScopeNative(path: string): Promise<void> {
  return invokeNativeCommand('grant_workspace_directory_scope', { path });
}

export function openPathWithSystemNative(path: string): Promise<void> {
  return invokeNativeCommand('open_path_with_system', { path });
}

/**
 * 重建 macOS 原生菜单以套用当前语言的标签。
 * Windows / Linux 走自绘菜单栏，Rust 侧是空实现，直接调用即可。
 */
export function updateAppMenuLabelsNative(labels: Record<string, string>): Promise<void> {
  return invokeNativeCommand('update_app_menu_labels', { labels });
}
