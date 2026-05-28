export interface PrismCommandError {
  code: string;
  message: string;
  hint?: string | null;
  path?: string | null;
  stage?: string | null;
}

function isPrismCommandError(error: unknown): error is PrismCommandError {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && typeof (error as { code?: unknown }).code === 'string'
    && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string',
  );
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error === null || error === undefined) return 'Unknown native error';

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export class PrismNativeError extends Error {
  code: string;
  hint?: string | null;
  path?: string | null;
  stage?: string | null;

  constructor(error: PrismCommandError) {
    super(error.message);
    this.name = 'PrismNativeError';
    this.code = error.code;
    this.hint = error.hint;
    this.path = error.path;
    this.stage = error.stage;
    Object.setPrototypeOf(this, PrismNativeError.prototype);
  }
}

export function normalizeNativeError(error: unknown): PrismNativeError {
  if (error instanceof PrismNativeError) return error;
  if (isPrismCommandError(error)) {
    return new PrismNativeError(error);
  }

  return new PrismNativeError({
    code: 'unknown_error',
    message: getUnknownErrorMessage(error),
  });
}

export function isNativeCommandUnavailableError(error: unknown): boolean {
  if (!(error instanceof PrismNativeError)) return false;
  if (error.code !== 'unknown_error') return false;
  return /unknown command|command .* not found|not implemented|not available|__tauri|tauri_internals|window\.__tauri|reading ['"]invoke['"]|invoke.*undefined|not a function/i
    .test(error.message);
}
