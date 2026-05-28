import { buildWorkspaceIndexNative } from '../../../platform/tauri/workspaceIndex';
import type {
  WorkspaceIndex,
  WorkspaceIndexBacklink,
  WorkspaceIndexedDocument,
  WorkspaceIndexRecentFile,
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

function isNativeWorkspaceIndexDto(value: unknown): value is NativeWorkspaceIndexDto {
  return Boolean(
    value
    && typeof value === 'object'
    && Array.isArray((value as NativeWorkspaceIndexDto).documents)
    && typeof (value as NativeWorkspaceIndexDto).generatedAt === 'number',
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
