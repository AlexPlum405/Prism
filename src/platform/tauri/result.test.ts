import { describe, expect, it } from 'vitest';
import { isNativeCommandUnavailableError, normalizeNativeError, PrismNativeError } from './result';

describe('normalizeNativeError', () => {
  it('keeps structured native errors', () => {
    const error = normalizeNativeError({
      code: 'file_not_found',
      message: 'File does not exist',
      hint: 'Choose another file',
      path: '/tmp/missing.md',
      stage: 'open',
    });

    expect(error).toBeInstanceOf(PrismNativeError);
    expect(error.name).toBe('PrismNativeError');
    expect(error.code).toBe('file_not_found');
    expect(error.message).toBe('File does not exist');
    expect(error.hint).toBe('Choose another file');
    expect(error.path).toBe('/tmp/missing.md');
    expect(error.stage).toBe('open');
  });

  it('wraps legacy string errors as unknown native errors', () => {
    const error = normalizeNativeError('legacy error');

    expect(error).toBeInstanceOf(PrismNativeError);
    expect(error.code).toBe('unknown_error');
    expect(error.message).toBe('legacy error');
  });

  it('returns existing PrismNativeError instances unchanged', () => {
    const original = new PrismNativeError({
      code: 'permission_denied',
      message: 'Permission denied',
    });

    expect(normalizeNativeError(original)).toBe(original);
  });

  it('detects missing native command errors for fallback paths', () => {
    expect(isNativeCommandUnavailableError(new PrismNativeError({
      code: 'unknown_error',
      message: 'unknown command read_document_file',
    }))).toBe(true);

    expect(isNativeCommandUnavailableError(new PrismNativeError({
      code: 'file_not_found',
      message: 'File does not exist',
    }))).toBe(false);
  });
});
