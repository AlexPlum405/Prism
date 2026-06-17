import {
  buildWorkspaceIndexNative,
  cancelWorkspaceIndexJobNative,
  getWorkspaceIndexJobNative,
  queryWorkspaceBacklinksNative,
  queryWorkspaceIndexNative,
  queryWorkspaceLinkTargetsNative,
  queryWorkspaceRelationGraphNative,
  startWorkspaceIndexJobNative,
  type RelationGraphDepthDto,
  type RelationGraphScopeDto,
  type WorkspaceLinkTargetModeDto,
  type WorkspaceIndexQueryModeDto,
} from '../../../platform/tauri/workspaceIndex';
import type { PrismCommandError } from '../../../platform/tauri/result';
import type { RelationGraph } from './relationGraph';
import type {
  WorkspaceIndex,
  WorkspaceIndexBacklink,
  WorkspaceIndexedDocument,
  WorkspaceIndexRecentFile,
  WorkspaceIndexSearchResult,
} from './workspaceIndex';
import { normalizePathForCompare } from './path';
import { getDocumentProfileForPath } from './fileAssociation';

interface NativeWorkspaceIndexDto {
  backlinksByPath?: Record<string, WorkspaceIndexBacklink[]>;
  documents?: WorkspaceIndexedDocument[];
  generatedAt?: number;
  recentDocuments?: WorkspaceIndexedDocument[];
  rootPath?: string;
}

export interface BuildWorkspaceIndexNativeInput {
  currentDocumentOverride?: { path: string; content: string } | null;
  recentFiles: WorkspaceIndexRecentFile[];
  rootPath: string;
}

export interface QueryWorkspaceIndexNativeInput extends BuildWorkspaceIndexNativeInput {
  limit: number;
  mode: WorkspaceIndexQueryModeDto;
  query: string;
}

export interface QueryWorkspaceBacklinksNativeInput {
  jobId: string;
  path: string;
}

export interface QueryWorkspaceRelationGraphNativeInput {
  jobId: string;
  currentPath?: string | null;
  depth: RelationGraphDepthDto;
  limit: number;
  query?: string | null;
  scope: RelationGraphScopeDto;
}

export interface QueryWorkspaceLinkTargetsNativeInput {
  jobId: string;
  currentPath?: string | null;
  limit: number;
  mode: WorkspaceLinkTargetModeDto;
  query: string;
}

export interface WorkspaceLinkTarget {
  detail: string;
  kind: 'file' | 'keyword';
  label: string;
  target: string;
  title: string;
}

export interface WorkspaceIndexJob {
  id: string;
  rootPath: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stage: string;
  message: string;
  progress: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number | null;
  index?: WorkspaceIndex | null;
  error?: PrismCommandError | null;
  cancelRequested: boolean;
}

interface NativeWorkspaceIndexJobDto {
  id?: string;
  rootPath?: string;
  status?: string;
  stage?: string;
  message?: string;
  progress?: number;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number | null;
  index?: NativeWorkspaceIndexDto | null;
  error?: PrismCommandError | null;
  cancelRequested?: boolean;
}

function isNativeWorkspaceIndexDto(value: unknown): value is NativeWorkspaceIndexDto {
  return Boolean(
    value
    && typeof value === 'object'
    && Array.isArray((value as NativeWorkspaceIndexDto).documents)
    && typeof (value as NativeWorkspaceIndexDto).generatedAt === 'number',
  );
}

function isNativeWorkspaceIndexSearchResult(value: unknown): value is WorkspaceIndexSearchResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<WorkspaceIndexSearchResult>;
  return Boolean(
    result.document
    && typeof result.document === 'object'
    && typeof (result.document as WorkspaceIndexedDocument).path === 'string'
    && ['title', 'name', 'path', 'heading', 'content'].includes(result.match ?? '')
    && typeof result.score === 'number'
    && typeof result.snippet === 'string',
  );
}

function isNativeWorkspaceIndexBacklink(value: unknown): value is WorkspaceIndexBacklink {
  if (!value || typeof value !== 'object') return false;
  const backlink = value as Partial<WorkspaceIndexBacklink>;
  return Boolean(
    typeof backlink.path === 'string'
    && typeof backlink.title === 'string'
    && typeof backlink.line === 'number'
    && typeof backlink.column === 'number'
    && typeof backlink.excerpt === 'string',
  );
}

function isNativeRelationGraph(value: unknown): value is RelationGraph {
  if (!value || typeof value !== 'object') return false;
  const graph = value as Partial<RelationGraph>;
  return Boolean(
    Array.isArray(graph.nodes)
    && graph.nodes.every((node) => (
      node
      && typeof node === 'object'
      && typeof node.id === 'string'
      && typeof node.path === 'string'
      && typeof node.relativePath === 'string'
      && typeof node.title === 'string'
      && typeof node.active === 'boolean'
      && typeof node.depth === 'number'
      && typeof node.linkCount === 'number'
      && typeof node.backlinkCount === 'number'
    ))
    && Array.isArray(graph.edges)
    && graph.edges.every((edge) => (
      edge
      && typeof edge === 'object'
      && typeof edge.id === 'string'
      && typeof edge.source === 'string'
      && typeof edge.target === 'string'
    )),
  );
}

function isNativeWorkspaceLinkTarget(value: unknown): value is WorkspaceLinkTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Partial<WorkspaceLinkTarget>;
  return Boolean(
    typeof target.detail === 'string'
    && (target.kind === 'file' || target.kind === 'keyword')
    && typeof target.label === 'string'
    && typeof target.target === 'string'
    && typeof target.title === 'string',
  );
}

function isNativeWorkspaceIndexJobStatus(value: unknown): value is WorkspaceIndexJob['status'] {
  return value === 'running' || value === 'completed' || value === 'failed' || value === 'cancelled';
}

function workspaceIndexJobFromNativeDto(dto: NativeWorkspaceIndexJobDto): WorkspaceIndexJob | null {
  if (
    typeof dto.id !== 'string'
    || typeof dto.rootPath !== 'string'
    || !isNativeWorkspaceIndexJobStatus(dto.status)
    || typeof dto.stage !== 'string'
    || typeof dto.message !== 'string'
    || typeof dto.progress !== 'number'
    || typeof dto.createdAt !== 'number'
    || typeof dto.updatedAt !== 'number'
    || typeof dto.cancelRequested !== 'boolean'
  ) {
    return null;
  }

  return {
    id: dto.id,
    rootPath: dto.rootPath,
    status: dto.status,
    stage: dto.stage,
    message: dto.message,
    progress: dto.progress,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    completedAt: dto.completedAt ?? null,
    index: dto.index && isNativeWorkspaceIndexDto(dto.index)
      ? workspaceIndexFromNativeDto(dto.index)
      : null,
    error: dto.error ?? null,
    cancelRequested: dto.cancelRequested,
  };
}

export function workspaceIndexFromNativeDto(dto: NativeWorkspaceIndexDto): WorkspaceIndex {
  const documents = (dto.documents ?? []).map((document) => ({
    ...document,
    profile: document.profile ?? getDocumentProfileForPath(document.path)?.kind ?? 'markdown',
  }));
  const recentDocuments = (dto.recentDocuments ?? []).map((document) => ({
    ...document,
    profile: document.profile ?? getDocumentProfileForPath(document.path)?.kind ?? 'markdown',
  }));
  return {
    backlinksByPath: new Map(Object.entries(dto.backlinksByPath ?? {})),
    documentByPath: new Map(documents.map((document) => [normalizePathForCompare(document.path), document])),
    documents,
    generatedAt: dto.generatedAt ?? Date.now(),
    recentDocuments,
    rootPath: dto.rootPath ?? null,
  };
}

export async function buildWorkspaceIndexNativeModel(
  input: BuildWorkspaceIndexNativeInput,
): Promise<WorkspaceIndex | null> {
  const dto = await buildWorkspaceIndexNative({
    rootPath: input.rootPath,
    currentDocumentOverride: input.currentDocumentOverride ?? null,
    recentFiles: input.recentFiles,
  });

  return isNativeWorkspaceIndexDto(dto) ? workspaceIndexFromNativeDto(dto) : null;
}

export async function queryWorkspaceIndexNativeModel(
  input: QueryWorkspaceIndexNativeInput,
): Promise<WorkspaceIndexSearchResult[] | null> {
  const dto = await queryWorkspaceIndexNative({
    rootPath: input.rootPath,
    query: input.query,
    limit: input.limit,
    mode: input.mode,
    currentDocumentOverride: input.currentDocumentOverride ?? null,
    recentFiles: input.recentFiles,
  });

  return Array.isArray(dto) && dto.every(isNativeWorkspaceIndexSearchResult) ? dto : null;
}

export async function startWorkspaceIndexJobNativeModel(
  input: BuildWorkspaceIndexNativeInput,
): Promise<WorkspaceIndexJob | null> {
  const dto = await startWorkspaceIndexJobNative({
    rootPath: input.rootPath,
    currentDocumentOverride: input.currentDocumentOverride ?? null,
    recentFiles: input.recentFiles,
  });

  return dto && typeof dto === 'object'
    ? workspaceIndexJobFromNativeDto(dto as NativeWorkspaceIndexJobDto)
    : null;
}

export async function getWorkspaceIndexJobNativeModel(jobId: string): Promise<WorkspaceIndexJob | null> {
  const dto = await getWorkspaceIndexJobNative(jobId);

  return dto && typeof dto === 'object'
    ? workspaceIndexJobFromNativeDto(dto as NativeWorkspaceIndexJobDto)
    : null;
}

export async function cancelWorkspaceIndexJobNativeModel(jobId: string): Promise<WorkspaceIndexJob | null> {
  const dto = await cancelWorkspaceIndexJobNative(jobId);

  return dto && typeof dto === 'object'
    ? workspaceIndexJobFromNativeDto(dto as NativeWorkspaceIndexJobDto)
    : null;
}

export async function queryWorkspaceBacklinksNativeModel(
  input: QueryWorkspaceBacklinksNativeInput,
): Promise<WorkspaceIndexBacklink[] | null> {
  const dto = await queryWorkspaceBacklinksNative(input);

  return Array.isArray(dto) && dto.every(isNativeWorkspaceIndexBacklink) ? dto : null;
}

export async function queryWorkspaceRelationGraphNativeModel(
  input: QueryWorkspaceRelationGraphNativeInput,
): Promise<RelationGraph | null> {
  const dto = await queryWorkspaceRelationGraphNative(input);

  return isNativeRelationGraph(dto) ? dto : null;
}

export async function queryWorkspaceLinkTargetsNativeModel(
  input: QueryWorkspaceLinkTargetsNativeInput,
): Promise<WorkspaceLinkTarget[] | null> {
  const dto = await queryWorkspaceLinkTargetsNative(input);

  return Array.isArray(dto) && dto.every(isNativeWorkspaceLinkTarget) ? dto : null;
}
