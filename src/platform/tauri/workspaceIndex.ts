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

export interface QueryWorkspaceBacklinksInputDto {
  jobId: string;
  path: string;
}

export type RelationGraphScopeDto = 'current' | 'workspace';
export type RelationGraphDepthDto = 1 | 2;

export interface QueryWorkspaceRelationGraphInputDto {
  jobId: string;
  currentPath?: string | null;
  depth: RelationGraphDepthDto;
  limit: number;
  query?: string | null;
  scope: RelationGraphScopeDto;
}

export type WorkspaceLinkTargetModeDto = 'markdown' | 'wiki';

export interface QueryWorkspaceLinkTargetsInputDto {
  jobId: string;
  currentPath?: string | null;
  limit: number;
  mode: WorkspaceLinkTargetModeDto;
  query: string;
}

export function buildWorkspaceIndexNative(input: BuildWorkspaceIndexInputDto) {
  return invokeNativeCommand<unknown>('build_workspace_index', { input });
}

export function queryWorkspaceIndexNative(input: QueryWorkspaceIndexInputDto) {
  return invokeNativeCommand<unknown>('query_workspace_index', { input });
}

export function startWorkspaceIndexJobNative(input: BuildWorkspaceIndexInputDto) {
  return invokeNativeCommand<unknown>('start_workspace_index_job', { input });
}

export function getWorkspaceIndexJobNative(jobId: string) {
  return invokeNativeCommand<unknown>('get_workspace_index_job', { jobId });
}

export function cancelWorkspaceIndexJobNative(jobId: string) {
  return invokeNativeCommand<unknown>('cancel_workspace_index_job', { jobId });
}

export function queryWorkspaceBacklinksNative(input: QueryWorkspaceBacklinksInputDto) {
  return invokeNativeCommand<unknown>('query_workspace_backlinks', { input });
}

export function queryWorkspaceRelationGraphNative(input: QueryWorkspaceRelationGraphInputDto) {
  return invokeNativeCommand<unknown>('query_workspace_relation_graph', { input });
}

export function queryWorkspaceLinkTargetsNative(input: QueryWorkspaceLinkTargetsInputDto) {
  return invokeNativeCommand<unknown>('query_workspace_link_targets', { input });
}
