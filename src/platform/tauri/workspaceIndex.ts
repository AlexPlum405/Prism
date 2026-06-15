import { invokeNativeCommand } from './nativeCommands';

export interface CurrentDocumentOverrideDto {
  path: string;
  content: string;
}

export interface RecentFileDto {
  path: string;
  name?: string;
  lastOpened: number;
}

export interface BuildWorkspaceIndexInputDto {
  rootPath: string;
  currentDocumentOverride?: CurrentDocumentOverrideDto | null;
  recentFiles: RecentFileDto[];
}

export type WorkspaceIndexQueryModeDto = 'quickOpen' | 'fullText';

export interface QueryWorkspaceIndexInputDto {
  rootPath: string;
  query: string;
  limit: number;
  mode: WorkspaceIndexQueryModeDto;
  currentDocumentOverride?: CurrentDocumentOverrideDto | null;
  recentFiles: RecentFileDto[];
}

export function buildWorkspaceIndexNative(input: BuildWorkspaceIndexInputDto) {
  return invokeNativeCommand<unknown>('build_workspace_index', { input });
}

export function queryWorkspaceIndexNative(input: QueryWorkspaceIndexInputDto) {
  return invokeNativeCommand<unknown>('query_workspace_index', { input });
}
