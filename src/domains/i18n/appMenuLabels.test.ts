import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NATIVE_MENU_ACTIONS } from './appMenuLabels';

/**
 * 菜单是 Rust 侧构建的，标签表在前端。两边靠 action id 对齐，
 * 没有编译期约束——菜单加了项却忘了进表，标签就悄悄退回 Rust 的中文兜底。
 * 这条测试直接读 lib.rs 的源码比对，把漂移挡在 CI 之前。
 */
describe('NATIVE_MENU_ACTIONS', () => {
  it('covers exactly the menu items declared in the Rust menu builder', () => {
    const libRs = readFileSync(
      resolve(process.cwd(), 'src-tauri/src/lib.rs'),
      'utf8',
    );
    const declared = [
      ...libRs.matchAll(/command_menu_item\(\s*(?:handle,\s*)?"([a-zA-Z][a-zA-Z0-9]*)"/g),
    ].map((match) => match[1]);

    expect([...new Set(declared)].sort()).toEqual([...NATIVE_MENU_ACTIONS].sort());
  });
});
