import { invokeNativeCommand } from './nativeCommands';
import type { PrismCommandError } from './result';

export type ExportJobStatus = 'running' | 'completed' | 'failed' | 'cancelled' | string;

export interface ExportJobDto {
  id: string;
  format: string;
  documentPath?: string | null;
  outputPath?: string | null;
  status: ExportJobStatus;
  stage: string;
  message: string;
  createdAt: number;
  updatedAt: number;
  error?: PrismCommandError | null;
  cancelRequested: boolean;
}

export interface CreateExportJobInputDto {
  format: string;
  documentPath?: string | null;
  outputPath?: string | null;
  stage?: string | null;
  message?: string | null;
}

export interface UpdateExportJobInputDto {
  id: string;
  outputPath?: string | null;
  stage?: string | null;
  message?: string | null;
}

export interface CompleteExportJobInputDto {
  id: string;
  outputPath?: string | null;
  message?: string | null;
}

export interface FailExportJobInputDto {
  id: string;
  stage?: string | null;
  message?: string | null;
  error: PrismCommandError;
}

export function createExportJobNative(input: CreateExportJobInputDto) {
  return invokeNativeCommand<unknown>('create_export_job', { input });
}

export function updateExportJobNative(input: UpdateExportJobInputDto) {
  return invokeNativeCommand<unknown>('update_export_job', { input });
}

export function completeExportJobNative(input: CompleteExportJobInputDto) {
  return invokeNativeCommand<unknown>('complete_export_job', { input });
}

export function failExportJobNative(input: FailExportJobInputDto) {
  return invokeNativeCommand<unknown>('fail_export_job', { input });
}

export function cancelExportJobNative(jobId: string) {
  return invokeNativeCommand<unknown>('cancel_export_job', { jobId });
}

export function getExportJobNative(jobId: string) {
  return invokeNativeCommand<unknown>('get_export_job', { jobId });
}

export function listExportJobsNative() {
  return invokeNativeCommand<unknown>('list_export_jobs');
}
