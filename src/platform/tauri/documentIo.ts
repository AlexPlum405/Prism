import { invokeNativeCommand } from './nativeCommands';

export interface FileSnapshotDto {
  mtimeMs: number | null;
  size: number | null;
}

export interface DocumentFileSessionDto {
  path: string;
  name: string;
  content: string;
  knownSnapshot: FileSnapshotDto | null;
}

export interface WriteDocumentFileInput {
  path: string;
  content: string;
  expectedSnapshot?: FileSnapshotDto | null;
  createNew?: boolean;
}

export interface DocumentWriteResultDto {
  path: string;
  snapshot: FileSnapshotDto;
}

export function getFileSnapshotNative(path: string) {
  return invokeNativeCommand<FileSnapshotDto>('get_file_snapshot', { path });
}

export function readDocumentFileNative(path: string) {
  return invokeNativeCommand<DocumentFileSessionDto>('read_document_file', { path });
}

export function writeDocumentFileNative(input: WriteDocumentFileInput) {
  return invokeNativeCommand<DocumentWriteResultDto>('write_document_file', { input });
}
