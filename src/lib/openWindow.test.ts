import { beforeEach, describe, expect, it, vi } from 'vitest';

const webviewWindowMock = vi.hoisted(() => vi.fn(function MockWebviewWindow(
  this: any,
  _label: string,
  _options: Record<string, unknown>,
) {
  this.once = vi.fn(async () => undefined);
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: webviewWindowMock,
}));

describe('openPrismWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens new windows as blank documents without restoring the guide or session', async () => {
    const { openPrismWindow } = await import('./openWindow');

    await openPrismWindow();

    expect(webviewWindowMock).toHaveBeenCalledTimes(1);
    expect(webviewWindowMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      url: '/?newWindow=1',
      visible: false,
    }));
  });

  it('keeps explicit file paths in the new window URL', async () => {
    const { openPrismWindow } = await import('./openWindow');

    await openPrismWindow({ filePath: '/tmp/current.md' });

    expect(webviewWindowMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      url: '/?file=%2Ftmp%2Fcurrent.md',
    }));
  });

  it('encodes markdown paths with spaces and non-ASCII characters', async () => {
    const { openPrismWindow } = await import('./openWindow');

    await openPrismWindow({ filePath: '/tmp/中文 文档.markdown' });

    expect(webviewWindowMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      url: '/?file=%2Ftmp%2F%E4%B8%AD%E6%96%87+%E6%96%87%E6%A1%A3.markdown',
    }));
  });

  it('keeps explicit folder paths in the new window URL', async () => {
    const { openPrismWindow } = await import('./openWindow');

    await openPrismWindow({ folderPath: '/Users/Alex/Documents/Prism 测试' });

    expect(webviewWindowMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      url: '/?folder=%2FUsers%2FAlex%2FDocuments%2FPrism+%E6%B5%8B%E8%AF%95',
    }));
  });

});
