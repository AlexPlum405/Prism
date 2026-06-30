import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('macOS window hit testing configuration', () => {
  it('keeps overlay titlebar windows decorated so native traffic lights and webview hit testing agree', () => {
    const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
    const windows = config.app?.windows ?? [];

    for (const windowConfig of windows) {
      if (windowConfig.titleBarStyle === 'Overlay') {
        expect(windowConfig.decorations).toBe(true);
      }
    }
  });

  it('keeps macOS document windows eligible for native close, minimize, and zoom actions', () => {
    const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
    const windows = config.app?.windows ?? [];

    expect(windows.length).toBeGreaterThan(0);

    for (const windowConfig of windows) {
      expect(windowConfig.closable).toBe(true);
      expect(windowConfig.minimizable).toBe(true);
      expect(windowConfig.maximizable).toBe(true);
    }
  });
});
