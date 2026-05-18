import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('ViewModeSwitch titlebar placement', () => {
  const css = readFileSync(resolve(__dirname, 'ViewModeSwitch.module.css'), 'utf8');

  it('keeps the MiaoYan titlebar offset out of Windows only', () => {
    const miaoyanOffset = css.indexOf(":global(html[data-content-theme='miaoyan']) .container");
    const windowsReset = css.indexOf(":global(html[data-platform='windows'][data-content-theme='miaoyan']) .container");

    expect(miaoyanOffset).toBeGreaterThan(-1);
    expect(windowsReset).toBeGreaterThan(miaoyanOffset);
    expect(css.slice(windowsReset)).toContain('transform: none');
  });
});
