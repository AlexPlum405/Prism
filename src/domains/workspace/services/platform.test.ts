import { describe, expect, it } from 'vitest';
import { getRuntimePlatform, getShowInFileManagerLabel } from './platform';

describe('workspace platform services', () => {
  it('detects runtime platforms from navigator values', () => {
    expect(getRuntimePlatform({ platform: 'MacIntel', userAgent: 'Mozilla' })).toBe('mac');
    expect(getRuntimePlatform({ platform: 'Win32', userAgent: 'Mozilla' })).toBe('windows');
    expect(getRuntimePlatform({ platform: 'Linux x86_64', userAgent: 'Mozilla' })).toBe('windows');
  });

  it('renders platform specific file manager labels', () => {
    expect(getShowInFileManagerLabel('mac')).toBe('在访达中显示');
    expect(getShowInFileManagerLabel('windows')).toBe('在资源管理器中显示');
  });
});
