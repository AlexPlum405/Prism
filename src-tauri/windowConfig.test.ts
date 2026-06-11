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
});
