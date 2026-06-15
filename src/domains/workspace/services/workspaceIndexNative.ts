import {
  buildWorkspaceIndexNative,
  queryWorkspaceIndexNative,
  type WorkspaceIndexQueryModeDto,
} from '../../../platform/tauri/workspaceIndex';
import type {
  WorkspaceIndex,
  WorkspaceIndexBacklink,
  WorkspaceIndexedDocument,
  WorkspaceIndexRecentFile,
  WorkspaceIndexSearchResult,
} from './workspaceIndex';
import { normalizePathForCompare } from './path';

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

export function workspaceIndexFromNativeDto(dto: NativeWorkspaceIndexDto): WorkspaceIndex {
  const documents = dto.documents ?? [];
  return {
    backlinksByPath: new Map(Object.entries(dto.backlinksByPath ?? {})),
    documentByPath: new Map(documents.map((document) => [normalizePathForCompare(document.path), document])),
    documents,
    generatedAt: dto.generatedAt ?? Date.now(),
    recentDocuments: dto.recentDocuments ?? [],
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
