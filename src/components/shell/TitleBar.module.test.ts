import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('TitleBar drag region styling', () => {
  const css = readFileSync(resolve(__dirname, 'TitleBar.module.css'), 'utf8');

  it('does not use WebKit app-region drag for the whole titlebar', () => {
    expect(css).not.toMatch(/-webkit-app-region\s*:\s*drag/);
    expect(css).not.toMatch(/\bapp-region\s*:\s*drag/);
  });
});
