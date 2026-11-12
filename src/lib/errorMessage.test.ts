import { describe, expect, it } from 'vitest';
import { formatUnknownError } from './errorMessage';
import { PrismNativeError } from '../platform/tauri/result';

describe('formatUnknownError', () => {
  it('prefers the i18n copy for known native error codes', () => {
    const error = new PrismNativeError({
      code: 'file_not_found',
      message: 'File does not exist',
    });
    expect(formatUnknownError(error)).toBe('文件不存在');
  });

  it('falls back to the message for codes without dedicated copy', () => {
    const error = new PrismNativeError({
      code: 'permission_denied',
      message: 'Failed to read workspace: Permission denied (os error 13)',
    });
    expect(formatUnknownError(error)).toBe(
      'Failed to read workspace: Permission denied (os error 13)',
    );
  });

  it('never surfaces event.type as user copy', () => {
    expect(formatUnknownError(new Event('error'))).toBe('未知事件错误');
  });

  it('trims plain strings and errors', () => {
    expect(formatUnknownError('  spaced  ')).toBe('spaced');
    expect(formatUnknownError(new Error('  boom  '))).toBe('boom');
  });

  it('uses the caller fallback before the generic one', () => {
    expect(formatUnknownError(new Error(''), '自定义兜底')).toBe('自定义兜底');
    expect(formatUnknownError(undefined, '自定义兜底')).toBe('自定义兜底');
  });

  it('falls back to the generic copy when nothing is provided', () => {
    expect(formatUnknownError(undefined)).toBe('未知错误');
  });
});
