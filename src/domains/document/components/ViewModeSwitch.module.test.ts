import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('ViewModeSwitch titlebar placement', () => {
  const css = readFileSync(resolve(__dirname, 'ViewModeSwitch.module.css'), 'utf8');

  it('keeps the MiaoYan titlebar offset out of non-mac titlebar layouts', () => {
    const miaoyanOffset = css.indexOf(":global(html[data-content-theme='miaoyan']) .container");
    const windowsReset = css.indexOf(":global(html[data-platform='windows'][data-content-theme='miaoyan']) .container");
    const linuxReset = css.indexOf(":global(html[data-platform='linux'][data-content-theme='miaoyan']) .container");

    expect(miaoyanOffset).toBeGreaterThan(-1);
    expect(windowsReset).toBeGreaterThan(miaoyanOffset);
    expect(linuxReset).toBeGreaterThan(windowsReset);
    expect(css.slice(windowsReset)).toContain('transform: none');
    expect(css.slice(linuxReset)).toContain('transform: none');
  });

  it('defines an internal flush-start variant for titlebar layouts that start with the switch', () => {
    const container = css.indexOf('.container');
    const flushStart = css.indexOf('.flushStart');

    expect(flushStart).toBeGreaterThan(container);
    expect(css.slice(flushStart)).toContain('margin-left: 0');
  });
});
