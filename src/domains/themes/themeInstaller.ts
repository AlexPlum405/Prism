import { unzipSync } from 'fflate';
import {
  exists,
  mkdir,
  readFile,
  remove,
  rename,
  stat,
} from '../../platform/tauri/fileSystem';
import { t } from '../i18n';
import { joinPath } from '../workspace/services/path';
import {
  THEME_CSS_FILENAME,
  THEME_MANIFEST_FILENAME,
  assertUserThemeId,
  normalizeThemeRelativePath,
} from './themePackage';
import { ThemeError } from './themeErrors';
import {
  copyThemeDirectory,
  ensureThemesDirectory,
  getThemeDirectoryNameFromPath,
  readThemePackageFromDirectory,
  removeThemeDirectory,
  writeThemeFile,
} from './themeStorage';

export interface InstallThemeResult {
  id: string;
  name: string;
  directory: string;
  replaced: boolean;
}

function isThemeArchivePath(path: string) {
  return /\.(zip|prism-theme)$/i.test(path);
}

function normalizeZipEntries(entries: Record<string, Uint8Array>) {
  const files = Object.entries(entries)
    .filter(([path]) => !path.endsWith('/'))
    .map(([path, bytes]) => {
      const normalized = normalizeThemeRelativePath(path);
      if (!normalized) {
        throw new ThemeError('invalid_theme', t('theme.zipInvalidPath', { path }));
      }
      return [normalized, bytes] as const;
    });

  if (files.length === 0) {
    throw new ThemeError('invalid_theme', t('theme.zipEmpty'));
  }

  const hasRootManifest = files.some(([path]) => path === THEME_MANIFEST_FILENAME);
  if (hasRootManifest) return files;

  const rootNames = new Set(files.map(([path]) => path.split('/')[0]));
  if (rootNames.size !== 1) {
    throw new ThemeError('invalid_theme', t('theme.zipMissingRoot'));
  }
  const rootName = Array.from(rootNames)[0];
  const stripped = files.map(([path, bytes]) => {
    const nextPath = path.slice(rootName.length + 1);
    if (!nextPath) {
      throw new ThemeError('invalid_theme', t('theme.zipInvalidPath', { path }));
    }
    return [nextPath, bytes] as const;
  });

  if (!stripped.some(([path]) => path === THEME_MANIFEST_FILENAME)) {
    throw new ThemeError('invalid_theme', t('theme.zipMissingJson'));
  }
  return stripped;
}

async function writeZipToDirectory(sourcePath: string, targetDirectory: string) {
  const bytes = await readFile(sourcePath);
  const entries = normalizeZipEntries(unzipSync(bytes));
  if (!entries.some(([path]) => path === THEME_CSS_FILENAME)) {
    throw new ThemeError('invalid_theme', t('theme.zipMissingCss'));
  }
  for (const [relativePath, data] of entries) {
    await writeThemeFile(targetDirectory, relativePath, data);
  }
}

async function stageThemeFromPath(sourcePath: string, stagingDirectory: string) {
  const info = await stat(sourcePath);
  if (info.isDirectory) {
    await copyThemeDirectory(sourcePath, stagingDirectory);
    return;
  }
  if (!info.isFile || !isThemeArchivePath(sourcePath)) {
    throw new ThemeError('invalid_theme', t('theme.choosePackage'));
  }
  await writeZipToDirectory(sourcePath, stagingDirectory);
}

async function safeRemove(path: string) {
  try {
    if (await exists(path)) await remove(path, { recursive: true });
  } catch {
    // Cleanup failures should not hide the primary import error.
  }
}

export async function installThemeFromPath(sourcePath: string, options: { replace?: boolean } = {}): Promise<InstallThemeResult> {
  const themesDir = await ensureThemesDirectory();
  const stagingDirectory = joinPath(themesDir, `.incoming-${Date.now()}-${getThemeDirectoryNameFromPath(sourcePath)}`);
  const backupDirectory = joinPath(themesDir, `.backup-${Date.now()}`);

  await mkdir(stagingDirectory, { recursive: true });

  try {
    await stageThemeFromPath(sourcePath, stagingDirectory);
    const themePackage = await readThemePackageFromDirectory(stagingDirectory);
    const themeId = assertUserThemeId(themePackage.id);
    const targetDirectory = joinPath(themesDir, themeId);
    const targetExists = await exists(targetDirectory);

    if (targetExists && !options.replace) {
      throw new ThemeError('theme_exists', t('theme.exists', { themeId }), themeId);
    }

    if (targetExists) {
      await rename(targetDirectory, backupDirectory);
    }

    try {
      await rename(stagingDirectory, targetDirectory);
      await safeRemove(backupDirectory);
      return {
        id: themeId,
        name: themePackage.name,
        directory: targetDirectory,
        replaced: targetExists,
      };
    } catch (error) {
      if (targetExists && await exists(backupDirectory)) {
        await safeRemove(targetDirectory);
        await rename(backupDirectory, targetDirectory);
      }
      throw error;
    }
  } finally {
    await safeRemove(stagingDirectory);
  }
}

export async function deleteInstalledUserTheme(themeId: string) {
  assertUserThemeId(themeId);
  await removeThemeDirectory(themeId);
}

export const __themeInstallerTesting = {
  normalizeZipEntries,
};
