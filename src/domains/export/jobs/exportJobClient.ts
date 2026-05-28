import {
  cancelExportJobNative,
  completeExportJobNative,
  createExportJobNative,
  failExportJobNative,
  getExportJobNative,
  listExportJobsNative,
  updateExportJobNative,
  type CompleteExportJobInputDto,
  type CreateExportJobInputDto,
  type ExportJobDto,
  type FailExportJobInputDto,
  type UpdateExportJobInputDto,
} from '../../../platform/tauri/exportJobs';
import { isNativeCommandUnavailableError, type PrismCommandError } from '../../../platform/tauri/result';

export type ExportJob = ExportJobDto;
export type CreateExportJobInput = CreateExportJobInputDto;
export type UpdateExportJobInput = UpdateExportJobInputDto;
export type CompleteExportJobInput = CompleteExportJobInputDto;
export type FailExportJobInput = FailExportJobInputDto;

export class ExportCancelledError extends Error {
  jobId: string;

  constructor(jobId: string) {
    super('Export was cancelled');
    this.name = 'ExportCancelledError';
    this.jobId = jobId;
    Object.setPrototypeOf(this, ExportCancelledError.prototype);
  }
}

let localJobSequence = 0;
const localJobs = new Map<string, ExportJob>();

function nowMs() {
  return Date.now();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isPrismCommandError(value: unknown): value is PrismCommandError {
  return Boolean(
    isObject(value)
    && typeof value.code === 'string'
    && typeof value.message === 'string',
  );
}

function isExportJob(value: unknown): value is ExportJob {
  return Boolean(
    isObject(value)
    && typeof value.id === 'string'
    && typeof value.format === 'string'
    && typeof value.status === 'string'
    && typeof value.stage === 'string'
    && typeof value.message === 'string'
    && typeof value.createdAt === 'number'
    && typeof value.updatedAt === 'number'
    && typeof value.cancelRequested === 'boolean'
    && (value.error === undefined || value.error === null || isPrismCommandError(value.error)),
  );
}

function shouldUseLocalFallback(error: unknown): boolean {
  return isNativeCommandUnavailableError(error);
}

function rememberLocalJob(job: ExportJob): ExportJob {
  localJobs.set(job.id, job);
  return job;
}

function createLocalJob(input: CreateExportJobInput): ExportJob {
  const now = nowMs();
  return rememberLocalJob({
    id: `local-export-${now}-${++localJobSequence}`,
    format: input.format,
    documentPath: input.documentPath ?? null,
    outputPath: input.outputPath ?? null,
    status: 'running',
    stage: input.stage ?? 'prepare',
    message: input.message ?? '',
    createdAt: now,
    updatedAt: now,
    error: null,
    cancelRequested: false,
  });
}

function updateLocalJob(
  id: string,
  update: (job: ExportJob) => ExportJob,
): ExportJob {
  const existing = localJobs.get(id);
  if (!existing) {
    throw new Error(`Export job not found: ${id}`);
  }
  const next = update(existing);
  rememberLocalJob(next);
  return next;
}

function readNativeJob(value: unknown): ExportJob | null {
  if (!isExportJob(value)) return null;
  return rememberLocalJob(value);
}

export async function createExportJob(input: CreateExportJobInput): Promise<ExportJob> {
  try {
    return readNativeJob(await createExportJobNative(input)) ?? createLocalJob(input);
  } catch (error) {
    if (shouldUseLocalFallback(error)) return createLocalJob(input);
    throw error;
  }
}

export async function updateExportJob(input: UpdateExportJobInput): Promise<ExportJob> {
  try {
    const nativeJob = readNativeJob(await updateExportJobNative(input));
    if (nativeJob) return nativeJob;
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
  }

  return updateLocalJob(input.id, (job) => ({
    ...job,
    outputPath: input.outputPath ?? job.outputPath,
    stage: input.stage ?? job.stage,
    message: input.message ?? job.message,
    updatedAt: nowMs(),
  }));
}

export async function completeExportJob(input: CompleteExportJobInput): Promise<ExportJob> {
  try {
    const nativeJob = readNativeJob(await completeExportJobNative(input));
    if (nativeJob) return nativeJob;
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
  }

  return updateLocalJob(input.id, (job) => ({
    ...job,
    outputPath: input.outputPath ?? job.outputPath,
    status: 'completed',
    stage: 'completed',
    message: input.message ?? job.message,
    updatedAt: nowMs(),
    error: null,
    cancelRequested: false,
  }));
}

export async function failExportJob(input: FailExportJobInput): Promise<ExportJob> {
  try {
    const nativeJob = readNativeJob(await failExportJobNative(input));
    if (nativeJob) return nativeJob;
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
  }

  return updateLocalJob(input.id, (job) => ({
    ...job,
    status: 'failed',
    stage: input.stage ?? 'failed',
    message: input.message ?? input.error.message,
    updatedAt: nowMs(),
    error: input.error,
  }));
}

export async function cancelExportJob(jobId: string): Promise<ExportJob> {
  try {
    const nativeJob = readNativeJob(await cancelExportJobNative(jobId));
    if (nativeJob) return nativeJob;
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
  }

  return updateLocalJob(jobId, (job) => ({
    ...job,
    status: 'cancelled',
    stage: 'cancel_requested',
    message: 'Export cancellation requested',
    updatedAt: nowMs(),
    cancelRequested: true,
  }));
}

export async function getExportJob(jobId: string): Promise<ExportJob> {
  try {
    const nativeJob = readNativeJob(await getExportJobNative(jobId));
    if (nativeJob) return nativeJob;
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
  }

  const localJob = localJobs.get(jobId);
  if (!localJob) throw new Error(`Export job not found: ${jobId}`);
  return localJob;
}

export async function listExportJobs(): Promise<ExportJob[]> {
  try {
    const nativeJobs = await listExportJobsNative();
    if (Array.isArray(nativeJobs) && nativeJobs.every(isExportJob)) {
      nativeJobs.forEach(rememberLocalJob);
      return nativeJobs;
    }
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
  }

  return [...localJobs.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export async function throwIfExportCancelled(jobId: string): Promise<void> {
  const job = await getExportJob(jobId);
  if (job.cancelRequested) {
    throw new ExportCancelledError(jobId);
  }
}
