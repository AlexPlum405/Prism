import {
  grantImportFileScopeNative,
  grantMarkdownFileScopeNative,
  grantWorkspaceDirectoryScopeNative,
} from '../platform/tauri/nativeCommands';

export async function grantMarkdownFileScope(path: string): Promise<void> {
  await grantMarkdownFileScopeNative(path);
}

export async function grantImportFileScope(path: string): Promise<void> {
  await grantImportFileScopeNative(path);
}

export async function grantWorkspaceDirectoryScope(path: string): Promise<void> {
  await grantWorkspaceDirectoryScopeNative(path);
}
