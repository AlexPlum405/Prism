import { invokeNativeCommand } from './nativeCommands';
import type { FileNode } from '../../domains/workspace/types';

export interface LoadWorkspaceTreeOptions {
  maxDepth?: number;
  includePreview?: boolean;
}

export function loadWorkspaceTreeNative(rootPath: string, options?: LoadWorkspaceTreeOptions) {
  return invokeNativeCommand<FileNode[]>('load_workspace_tree', { rootPath, options });
}
