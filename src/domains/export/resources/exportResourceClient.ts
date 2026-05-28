import {
  preflightExportNative,
  readExportResourceNative,
  resolveExportResourceNative,
  type ExportResourceBytesDto,
  type ExportResourceDiagnosticDto,
  type ExportResourceRefDto,
  type PreflightExportInputDto,
  type ResolveExportResourceInputDto,
} from '../../../platform/tauri/exportResources';
import { exists } from '../../../platform/tauri/fileSystem';
import { isNativeCommandUnavailableError } from '../../../platform/tauri/result';

export type ResolveExportResourceInput = ResolveExportResourceInputDto;

export interface ExportResourceBytes {
  bytes: Uint8Array;
  mimeType: string;
  path: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isResourceRef(value: unknown): value is ExportResourceRefDto {
  return Boolean(
    isObject(value)
    && typeof value.rawSrc === 'string'
    && (typeof value.resolvedPath === 'string' || value.resolvedPath === null || value.resolvedPath === undefined)
    && typeof value.kind === 'string'
    && (typeof value.mimeType === 'string' || value.mimeType === null || value.mimeType === undefined)
    && typeof value.exists === 'boolean',
  );
}

function isByteArray(value: unknown): value is number[] | Uint8Array {
  if (value instanceof Uint8Array) return true;
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255);
}

function isResourceBytes(value: unknown): value is ExportResourceBytesDto {
  return Boolean(
    isObject(value)
    && isByteArray(value.bytes)
    && typeof value.mimeType === 'string'
    && typeof value.path === 'string',
  );
}

function isResourceDiagnostic(value: unknown): value is ExportResourceDiagnosticDto {
  return Boolean(
    isObject(value)
    && typeof value.column === 'number'
    && typeof value.kind === 'string'
    && typeof value.line === 'number'
    && (typeof value.resolvedPath === 'string' || value.resolvedPath === null || value.resolvedPath === undefined)
    && typeof value.target === 'string',
  );
}

function normalizeBytes(value: ExportResourceBytesDto): ExportResourceBytes {
  return {
    bytes: value.bytes instanceof Uint8Array ? value.bytes : new Uint8Array(value.bytes),
    mimeType: value.mimeType,
    path: value.path,
  };
}

function shouldFallback(error: unknown): boolean {
  return isNativeCommandUnavailableError(error);
}

export async function resolveExportResource(input: ResolveExportResourceInput): Promise<ExportResourceRefDto | null> {
  try {
    const resource = await resolveExportResourceNative(input);
    return isResourceRef(resource) ? resource : null;
  } catch (error) {
    if (shouldFallback(error)) return null;
    throw error;
  }
}

export async function readExportResource(input: ResolveExportResourceInput): Promise<ExportResourceBytes | null> {
  try {
    const resource = await readExportResourceNative(input);
    return isResourceBytes(resource) ? normalizeBytes(resource) : null;
  } catch (error) {
    if (shouldFallback(error)) return null;
    throw error;
  }
}

export async function exportResourceExists(path: string): Promise<boolean> {
  try {
    const resource = await resolveExportResource({
      rawSrc: path,
      documentPath: null,
    });
    if (resource) return resource.exists;
  } catch {
    // Fall back to the existing fs plugin path below.
  }

  try {
    return await exists(path);
  } catch {
    return true;
  }
}

export async function preflightExportResources(
  input: PreflightExportInputDto,
): Promise<ExportResourceDiagnosticDto[] | null> {
  try {
    const diagnostics = await preflightExportNative(input);
    return Array.isArray(diagnostics) && diagnostics.every(isResourceDiagnostic)
      ? diagnostics
      : null;
  } catch (error) {
    if (shouldFallback(error)) return null;
    throw error;
  }
}
