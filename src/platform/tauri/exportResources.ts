import { invokeNativeCommand } from './nativeCommands';

export interface ResolveExportResourceInputDto {
  documentPath?: string | null;
  rawSrc: string;
}

export interface ExportResourceRefDto {
  rawSrc: string;
  resolvedPath?: string | null;
  kind: string;
  mimeType?: string | null;
  exists: boolean;
}

export interface ExportResourceBytesDto {
  bytes: number[] | Uint8Array;
  mimeType: string;
  path: string;
}

export interface PreflightExportInputDto {
  content: string;
  documentPath?: string | null;
}

export interface ExportResourceDiagnosticDto {
  column: number;
  kind: string;
  line: number;
  resolvedPath?: string | null;
  target: string;
}

export function resolveExportResourceNative(input: ResolveExportResourceInputDto) {
  return invokeNativeCommand<unknown>('resolve_export_resource', { input });
}

export function readExportResourceNative(input: ResolveExportResourceInputDto) {
  return invokeNativeCommand<unknown>('read_export_resource', { input });
}

export function preflightExportNative(input: PreflightExportInputDto) {
  return invokeNativeCommand<unknown>('preflight_export', { input });
}
