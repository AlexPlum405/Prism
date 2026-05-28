import * as fs from '@tauri-apps/plugin-fs';

export type { FileInfo } from '@tauri-apps/plugin-fs';

export const copyFile: typeof fs.copyFile = (...args) => fs.copyFile(...args);
export const exists: typeof fs.exists = (...args) => fs.exists(...args);
export const mkdir: typeof fs.mkdir = (...args) => fs.mkdir(...args);
export const readDir: typeof fs.readDir = (...args) => fs.readDir(...args);
export const readFile: typeof fs.readFile = (...args) => fs.readFile(...args);
export const readTextFile: typeof fs.readTextFile = (...args) => fs.readTextFile(...args);
export const remove: typeof fs.remove = (...args) => fs.remove(...args);
export const rename: typeof fs.rename = (...args) => fs.rename(...args);
export const stat: typeof fs.stat = (...args) => fs.stat(...args);
export const writeFile: typeof fs.writeFile = (...args) => fs.writeFile(...args);
export const writeTextFile: typeof fs.writeTextFile = (...args) => fs.writeTextFile(...args);

export const fileSystem = {
  copyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  stat,
  writeFile,
  writeTextFile,
};
