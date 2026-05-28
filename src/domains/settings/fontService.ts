import { openDialog } from '../../platform/tauri/dialogs';
import { appDataDir } from '../../platform/tauri/path';
import { copyFile, exists, mkdir, readFile, remove } from '../../platform/tauri/fileSystem';
import type { CustomFont, FontSource } from './types';
import { joinPath } from '../workspace/services/path';
import { t, type I18nKey } from '../i18n';

const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const;

type FontExtension = (typeof FONT_EXTENSIONS)[number];

export const BUILTIN_FONT_OPTIONS = [
  {
    id: 'cascadia',
    label: 'Cascadia Code',
    family: 'Cascadia Code, Consolas, monospace',
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    family: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  },
  {
    id: 'sf-mono',
    label: 'SF Mono',
    family: "'SF Mono', Menlo, Monaco, monospace",
  },
  {
    id: 'tsanger',
    label: '霞鹜文楷',
    family: "'TsangerJinKai02-W04', 'Kaiti SC', serif",
  },
  {
    id: 'source-serif',
    label: 'Source Serif',
    family: "'Source Serif 4', Georgia, serif",
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Sans',
    family: "'IBM Plex Sans', 'PingFang SC', sans-serif",
  },
] as const;

export const SYSTEM_FONT_OPTIONS = [
  {
    id: 'system-sans',
    label: 'System Sans',
    labelKey: 'settings.font.systemSans' as I18nKey,
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: 'system-serif',
    label: 'System Serif',
    labelKey: 'settings.font.systemSerif' as I18nKey,
    family: 'Georgia, "Times New Roman", "Songti SC", serif',
  },
  {
    id: 'system-mono',
    label: 'System Mono',
    labelKey: 'settings.font.systemMono' as I18nKey,
    family: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
] as const;

export interface ImportedFontResult {
  font: CustomFont;
  sourcePath: string;
  targetPath: string;
}

function basename(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, '');
}

function getFontExtension(path: string): FontExtension | null {
  const extension = path.split('.').pop()?.toLowerCase();
  return FONT_EXTENSIONS.includes(extension as FontExtension)
    ? extension as FontExtension
    : null;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function getFontsDir() {
  return joinPath(await appDataDir(), 'fonts');
}

function makeFontId(filename: string) {
  return `${stripExtension(filename).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

async function ensureFontsDir() {
  const fontsDir = await getFontsDir();
  if (!(await exists(fontsDir))) {
    await mkdir(fontsDir, { recursive: true });
  }
  return fontsDir;
}

async function registerFont(font: CustomFont) {
  if (!('FontFace' in window)) return;

  try {
    const data = await readFile(font.path);
    const blob = new Blob([data], { type: `font/${font.format}` });
    const url = URL.createObjectURL(blob);
    const face = new FontFace(font.family, `url("${url}")`);
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    console.error('[FontService] Failed to register font:', font.path, err);
  }
}

export async function importCustomFont(): Promise<ImportedFontResult | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'Fonts', extensions: [...FONT_EXTENSIONS] }],
  });
  if (!selected || Array.isArray(selected)) return null;

  const format = getFontExtension(selected);
  if (!format) {
    throw new Error(t('settings.font.unsupported'));
  }

  const sourceFilename = basename(selected);
  const filename = `${Date.now()}-${sanitizeFilename(sourceFilename)}`;
  const targetPath = joinPath(await ensureFontsDir(), filename);
  await copyFile(selected, targetPath);

  const displayName = stripExtension(sourceFilename);
  const font: CustomFont = {
    id: makeFontId(sourceFilename),
    family: `Prism ${displayName}`,
    displayName,
    filename,
    path: targetPath,
    format,
    importedAt: Date.now(),
  };

  await registerFont(font);
  return { font, sourcePath: selected, targetPath };
}

export async function registerCustomFonts(fonts: CustomFont[]) {
  await Promise.all(fonts.map(registerFont));
}

export async function deleteCustomFontFile(font: CustomFont) {
  try {
    if (await exists(font.path)) await remove(font.path);
  } catch (err) {
    console.error('[FontService] Failed to delete font:', font.path, err);
  }
}

export function resolveFontSource(
  source: FontSource,
  customFonts: CustomFont[],
  fallback: string,
) {
  if (source.kind === 'theme') return fallback;
  if (source.kind === 'custom') {
    return customFonts.find((font) => font.id === source.value)?.family ?? fallback;
  }
  return source.value || fallback;
}

export async function readCustomFontBytes(font: CustomFont) {
  return readFile(font.path);
}

export const __fontServiceTesting = {
  getFontsDir,
};
