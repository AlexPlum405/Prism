import {
  copyFile,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  stat,
  writeFile,
} from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import { joinPath } from '../workspace/services/path';
import {
  THEME_CSS_FILENAME,
  THEME_DIRECTORY_NAME,
  THEME_MANIFEST_FILENAME,
  normalizeThemeRelativePath,
  parseThemeManifest,
  validateThemePackageInput,
  type ThemePackage,
} from './themePackage';
import { ThemeError, getThemeErrorMessage } from './themeErrors';

export interface InvalidThemePackage {
  id: string;
  name: string;
  directory: string;
  error: string;
}

function basename(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function dirname(path: string) {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join(path.includes('\\') ? '\\' : '/');
}

export async function getThemesDirectory() {
  return joinPath(await appDataDir(), THEME_DIRECTORY_NAME);
}

export async function ensureThemesDirectory() {
  const themesDir = await getThemesDirectory();
  if (!(await exists(themesDir))) {
    await mkdir(themesDir, { recursive: true });
  }
  return themesDir;
}

export function joinThemeAssetPath(themeDirectory: string, relativePath: string) {
  const normalized = normalizeThemeRelativePath(relativePath);
  if (!normalized) {
    throw new ThemeError('invalid_theme', `主题资源路径不合法：${relativePath}`);
  }
  return normalized.split('/').reduce((current, part) => joinPath(current, part), themeDirectory);
}

async function assertThemeAssetExists(themeDirectory: string, relativePath: string, label: string) {
  const assetPath = joinThemeAssetPath(themeDirectory, relativePath);
  if (!(await exists(assetPath))) {
    throw new ThemeError('invalid_theme', `${label} 缺失：${relativePath}`);
  }
  const info = await stat(assetPath);
  if (!info.isFile) {
    throw new ThemeError('invalid_theme', `${label} 不是文件：${relativePath}`);
  }
  return assetPath;
}

export async function readThemePackageFromDirectory(themeDirectory: string): Promise<ThemePackage> {
  const manifestPath = joinPath(themeDirectory, THEME_MANIFEST_FILENAME);
  const cssPath = joinPath(themeDirectory, THEME_CSS_FILENAME);

  if (!(await exists(manifestPath))) {
    throw new ThemeError('invalid_theme', '主题目录缺少 theme.json');
  }
  if (!(await exists(cssPath))) {
    throw new ThemeError('invalid_theme', '主题目录缺少 theme.css');
  }

  const manifest = parseThemeManifest(await readTextFile(manifestPath));
  const css = await readTextFile(cssPath);
  for (const font of manifest.fonts ?? []) {
    await assertThemeAssetExists(themeDirectory, font.file, '主题字体');
  }
  if (manifest.previewImage) {
    if (!/\.(png|jpe?g)$/i.test(manifest.previewImage)) {
      throw new ThemeError('invalid_theme', '预览图只支持 png / jpg / jpeg', manifest.id);
    }
    await assertThemeAssetExists(themeDirectory, manifest.previewImage, '主题预览图');
  }

  return validateThemePackageInput({ manifest, css, directory: themeDirectory });
}

export async function scanInstalledThemePackages() {
  const themesDir = await ensureThemesDirectory();
  const entries = typeof readDir === 'function'
    ? await readDir(themesDir).catch(() => [])
    : [];
  const valid: ThemePackage[] = [];
  const invalid: InvalidThemePackage[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory || entry.isSymlink) continue;
    const directory = joinPath(themesDir, entry.name);
    try {
      valid.push(await readThemePackageFromDirectory(directory));
    } catch (error) {
      invalid.push({
        id: entry.name,
        name: entry.name,
        directory,
        error: getThemeErrorMessage(error),
      });
    }
  }

  valid.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  invalid.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  return { valid, invalid };
}

export async function readThemeAsset(themeDirectory: string, relativePath: string) {
  return readFile(joinThemeAssetPath(themeDirectory, relativePath));
}

export async function readThemeAssetAsObjectUrl(themeDirectory: string, relativePath: string) {
  const data = await readThemeAsset(themeDirectory, relativePath);
  const ext = relativePath.split('.').pop()?.toLowerCase();
  const type = ext === 'svg'
    ? 'image/svg+xml'
    : ext === 'png'
      ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'woff2'
          ? 'font/woff2'
          : ext === 'woff'
            ? 'font/woff'
            : ext === 'otf'
              ? 'font/otf'
              : ext === 'ttf'
                ? 'font/ttf'
                : 'application/octet-stream';
  return URL.createObjectURL(new Blob([data], { type }));
}

async function copyDirectoryRecursive(sourceDirectory: string, targetDirectory: string) {
  if (!(await exists(targetDirectory))) {
    await mkdir(targetDirectory, { recursive: true });
  }
  const entries = await readDir(sourceDirectory);
  for (const entry of entries) {
    if (entry.isSymlink) {
      throw new ThemeError('invalid_theme', `主题目录不能包含符号链接：${entry.name}`);
    }
    const sourcePath = joinPath(sourceDirectory, entry.name);
    const targetPath = joinPath(targetDirectory, entry.name);
    if (entry.isDirectory) {
      await copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile) {
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
  }
}

export async function copyThemeDirectory(sourceDirectory: string, targetDirectory: string) {
  await copyDirectoryRecursive(sourceDirectory, targetDirectory);
}

export async function writeThemeFile(targetDirectory: string, relativePath: string, bytes: Uint8Array) {
  const normalized = normalizeThemeRelativePath(relativePath);
  if (!normalized) {
    throw new ThemeError('invalid_theme', `ZIP 内资源路径不合法：${relativePath}`);
  }
  const targetPath = joinThemeAssetPath(targetDirectory, normalized);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);
}

export async function removeThemeDirectory(themeId: string) {
  const themesDir = await ensureThemesDirectory();
  const target = joinPath(themesDir, themeId);
  if (await exists(target)) {
    await remove(target, { recursive: true });
  }
}

export async function openThemesDirectory() {
  await openPath(await ensureThemesDirectory());
}

export function getThemeDirectoryNameFromPath(path: string) {
  return basename(path).replace(/\.(?:zip|prism-theme)$/i, '');
}
