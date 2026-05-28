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
} from '../../platform/tauri/fileSystem';
import { appDataDir } from '../../platform/tauri/path';
import { openPathWithDefaultApp } from '../../platform/tauri/opener';
import { isNativeCommandUnavailableError } from '../../platform/tauri/result';
import {
  deleteUserThemeNative,
  getThemesDirectoryNative,
  openThemesDirectoryNative,
  readThemePackageSourceNative,
  scanInstalledThemesNative,
  type NativeThemePackageSourceDto,
  type NativeThemeScanResultDto,
} from '../../platform/tauri/themeStore';
import { getCurrentLocale, t } from '../i18n';
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isNativeThemePackageSource(value: unknown): value is NativeThemePackageSourceDto {
  return Boolean(
    isObject(value)
    && typeof value.directory === 'string'
    && typeof value.id === 'string'
    && typeof value.manifest === 'string'
    && typeof value.css === 'string',
  );
}

function isNativeInvalidThemePackage(value: unknown): value is InvalidThemePackage {
  return Boolean(
    isObject(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.directory === 'string'
    && typeof value.error === 'string',
  );
}

function isNativeThemeScanResult(value: unknown): value is NativeThemeScanResultDto {
  return Boolean(
    isObject(value)
    && Array.isArray(value.valid)
    && value.valid.every(isNativeThemePackageSource)
    && Array.isArray(value.invalid)
    && value.invalid.every(isNativeInvalidThemePackage),
  );
}

function shouldFallbackToTypeScript(error: unknown) {
  return isNativeCommandUnavailableError(error);
}

export async function getThemesDirectory() {
  try {
    const themesDir = await getThemesDirectoryNative();
    if (typeof themesDir === 'string' && themesDir.trim()) return themesDir;
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
  }
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
    throw new ThemeError('invalid_theme', t('theme.invalidAssetPath', { path: relativePath }));
  }
  return normalized.split('/').reduce((current, part) => joinPath(current, part), themeDirectory);
}

async function assertThemeAssetExists(themeDirectory: string, relativePath: string, label: string) {
  const assetPath = joinThemeAssetPath(themeDirectory, relativePath);
  if (!(await exists(assetPath))) {
    throw new ThemeError('invalid_theme', t('theme.assetMissing', { label, path: relativePath }));
  }
  const info = await stat(assetPath);
  if (!info.isFile) {
    throw new ThemeError('invalid_theme', t('theme.assetNotFile', { label, path: relativePath }));
  }
  return assetPath;
}

export async function readThemePackageFromDirectory(themeDirectory: string): Promise<ThemePackage> {
  const readFromSource = async (source: NativeThemePackageSourceDto) => {
    const manifest = parseThemeManifest(source.manifest);
    for (const font of manifest.fonts ?? []) {
      await assertThemeAssetExists(themeDirectory, font.file, t('theme.fontAsset'));
    }
    if (manifest.previewImage) {
      if (!/\.(png|jpe?g)$/i.test(manifest.previewImage)) {
        throw new ThemeError('invalid_theme', t('theme.previewImageUnsupported'), manifest.id);
      }
      await assertThemeAssetExists(themeDirectory, manifest.previewImage, t('theme.previewImageAsset'));
    }

    return validateThemePackageInput({ manifest, css: source.css, directory: themeDirectory });
  };

  try {
    const source = await readThemePackageSourceNative(themeDirectory);
    if (isNativeThemePackageSource(source)) return readFromSource(source);
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
  }

  const manifestPath = joinPath(themeDirectory, THEME_MANIFEST_FILENAME);
  const cssPath = joinPath(themeDirectory, THEME_CSS_FILENAME);

  if (!(await exists(manifestPath))) {
    throw new ThemeError('invalid_theme', t('theme.missingJson'));
  }
  if (!(await exists(cssPath))) {
    throw new ThemeError('invalid_theme', t('theme.missingCss'));
  }

  return readFromSource({
    directory: themeDirectory,
    id: basename(themeDirectory),
    manifest: await readTextFile(manifestPath),
    css: await readTextFile(cssPath),
  });
}

async function scanInstalledThemePackagesNativeFirst() {
  try {
    const result = await scanInstalledThemesNative();
    if (!isNativeThemeScanResult(result)) return null;

    const valid: ThemePackage[] = [];
    const invalid: InvalidThemePackage[] = [...result.invalid];

    for (const source of result.valid) {
      try {
        valid.push(await readThemePackageFromDirectory(source.directory));
      } catch (error) {
        invalid.push({
          id: source.id,
          name: source.id,
          directory: source.directory,
          error: getThemeErrorMessage(error),
        });
      }
    }

    return { valid, invalid };
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
    return null;
  }
}

export async function scanInstalledThemePackages() {
  const nativeResult = await scanInstalledThemePackagesNativeFirst();
  if (nativeResult) {
    const locale = getCurrentLocale();
    nativeResult.valid.sort((a, b) => a.name.localeCompare(b.name, locale));
    nativeResult.invalid.sort((a, b) => a.name.localeCompare(b.name, locale));
    return nativeResult;
  }

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

  const locale = getCurrentLocale();
  valid.sort((a, b) => a.name.localeCompare(b.name, locale));
  invalid.sort((a, b) => a.name.localeCompare(b.name, locale));
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
      throw new ThemeError('invalid_theme', t('theme.directorySymlink', { name: entry.name }));
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
    throw new ThemeError('invalid_theme', t('theme.zipInvalidAssetPath', { path: relativePath }));
  }
  const targetPath = joinThemeAssetPath(targetDirectory, normalized);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);
}

export async function removeThemeDirectory(themeId: string) {
  try {
    await deleteUserThemeNative(themeId);
    return;
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
  }

  const themesDir = await ensureThemesDirectory();
  const target = joinPath(themesDir, themeId);
  if (await exists(target)) {
    await remove(target, { recursive: true });
  }
}

export async function openThemesDirectory() {
  try {
    await openThemesDirectoryNative();
    return;
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
  }

  await openPathWithDefaultApp(await ensureThemesDirectory());
}

export function getThemeDirectoryNameFromPath(path: string) {
  return basename(path).replace(/\.(?:zip|prism-theme)$/i, '');
}
