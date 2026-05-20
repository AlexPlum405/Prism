import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Vite packaged asset paths', () => {
  it('uses relative asset URLs so Tauri bundled apps can load the frontend', () => {
    const config = readFileSync('vite.config.ts', 'utf8');

    expect(config).toContain("base: './'");
  });
});
