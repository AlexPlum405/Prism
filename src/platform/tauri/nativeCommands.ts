import { invoke } from '@tauri-apps/api/core';

export function invokeNativeCommand<Result = unknown>(
  command: string,
  args?: Record<string, unknown>,
): Promise<Result> {
  return invoke<Result>(command, args);
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
