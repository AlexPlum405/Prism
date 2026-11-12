import * as fs from '@tauri-apps/plugin-fs';
import { appDataDir } from './path';

export type { FileInfo } from '@tauri-apps/plugin-fs';

type NativeRemoveOptions = Parameters<typeof fs.remove>[1];
type RemoveOptions = NonNullable<NativeRemoveOptions>;
type InternalRemoveOptions = RemoveOptions & {
  allowDirectUserPathRemoval?: boolean;
  reason?: string;
};
type PrismRemoveOptions = InternalRemoveOptions;
type ScopedRemoveOptions = RemoveOptions & { reason?: string };

let appDataDirPromise: Promise<string | null> | null = null;

function normalizeForRemovalGuard(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

async function getAppDataDirForRemovalGuard(): Promise<string | null> {
  if (!appDataDirPromise) {
    appDataDirPromise = appDataDir().catch(() => null);
  }
  return appDataDirPromise;
}

async function getNormalizedAppDataDir(): Promise<string | null> {
  const appDataPath = await getAppDataDirForRemovalGuard();
  return appDataPath ? normalizeForRemovalGuard(appDataPath) : null;
}

async function isAppDataPath(path: string): Promise<boolean> {
  const normalizedAppData = await getNormalizedAppDataDir();
  if (!normalizedAppData) return false;
  const normalizedPath = normalizeForRemovalGuard(path);
  return normalizedPath === normalizedAppData || normalizedPath.startsWith(`${normalizedAppData}/`);
}

async function isAppDataRootPath(path: string): Promise<boolean> {
  const normalizedAppData = await getNormalizedAppDataDir();
  return Boolean(normalizedAppData && normalizeForRemovalGuard(path) === normalizedAppData);
}

async function shouldBlockDirectRemove(path: string, options?: PrismRemoveOptions): Promise<boolean> {
  if (options?.allowDirectUserPathRemoval) return false;
  if (await isAppDataPath(path)) return false;
  return true;
}

function extractNativeRemoveOptions(options?: InternalRemoveOptions): RemoveOptions | undefined {
  const {
    allowDirectUserPathRemoval: _allowDirectUserPathRemoval,
    reason: _reason,
    ...nativeOptions
  } = options ?? {};
  return Object.keys(nativeOptions).length > 0 ? nativeOptions as RemoveOptions : undefined;
}

function removeNative(path: string, options?: RemoveOptions) {
  return options ? fs.remove(path, options) : fs.remove(path);
}

export const copyFile: typeof fs.copyFile = (...args) => fs.copyFile(...args);
export const exists: typeof fs.exists = (...args) => fs.exists(...args);
export const mkdir: typeof fs.mkdir = (...args) => fs.mkdir(...args);
export const readDir: typeof fs.readDir = (...args) => fs.readDir(...args);
export const readFile: typeof fs.readFile = (...args) => fs.readFile(...args);
export const readTextFile: typeof fs.readTextFile = (...args) => fs.readTextFile(...args);
export const remove = async (path: string, options?: PrismRemoveOptions) => {
  if (await shouldBlockDirectRemove(path, options)) {
    throw new Error(
      `Blocked unscoped file removal for ${path}${options?.reason ? ` (${options.reason})` : ''}`,
    );
  }
  return removeNative(path, extractNativeRemoveOptions(options));
};
export const removeAppDataPath = async (path: string, options?: ScopedRemoveOptions) => {
  if (!(await isAppDataPath(path))) {
    throw new Error(
      `Blocked app-data removal outside Prism storage for ${path}${options?.reason ? ` (${options.reason})` : ''}`,
    );
  }
  if (options?.recursive && await isAppDataRootPath(path)) {
    throw new Error(
      `Blocked recursive removal of Prism app data root for ${path}${options.reason ? ` (${options.reason})` : ''}`,
    );
  }
  return removeNative(path, extractNativeRemoveOptions(options));
};
export const removeConfirmedUserPathPermanently = async (path: string, options?: ScopedRemoveOptions) => {
  return removeNative(path, extractNativeRemoveOptions({
    ...options,
    allowDirectUserPathRemoval: true,
  }));
};
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
  removeAppDataPath,
  removeConfirmedUserPathPermanently,
  rename,
  stat,
  writeFile,
  writeTextFile,
};
