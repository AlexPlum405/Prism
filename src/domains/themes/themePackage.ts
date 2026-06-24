import {
  CONTENT_THEMES,
  isBuiltInContentTheme,
  isThemeId,
  type ContentTheme,
} from '../settings/types';
import { t } from '../i18n';
import type { DocxThemeContract, ThemeContract, ThemePreviewMaxWidth } from './themeContract';
import { builtInThemeContracts } from './themeContract';
import { ThemeError } from './themeErrors';
import { validateThemeCss } from './themeCss';

export const THEME_SCHEMA_VERSION = 1;
export const THEME_MANIFEST_FILENAME = 'theme.json';
export const THEME_CSS_FILENAME = 'theme.css';
export const THEME_DIRECTORY_NAME = 'themes';

export interface ThemeFontAsset {
  family: string;
  file: string;
}

export interface ThemeManifest {
  schemaVersion: number;
  id: string;
  name: string;
  author?: string;
  version?: string;
  description?: string;
  isDark?: boolean;
  fonts?: ThemeFontAsset[];
  previewImage?: string;
  contract?: PartialThemeContract;
}

export type PartialThemeContract = Partial<{
  editor: Partial<ThemeContract['editor']>;
  preview: Partial<ThemeContract['preview']>;
  search: Partial<ThemeContract['search']>;
  export: Partial<{
    writeClass: string;
    docx: Partial<DocxThemeContract>;
  }>;
  code: Partial<ThemeContract['code']>;
  mermaid: Partial<ThemeContract['mermaid']>;
  selection: Partial<ThemeContract['selection']>;
}>;

export interface ThemePackage {
  id: ContentTheme;
  name: string;
  author: string;
  version: string;
  description: string;
  isDark: boolean;
  directory: string;
  css: string;
  contract: ThemeContract;
  fonts: ThemeFontAsset[];
  previewImagePath?: string;
}

function stringValue(value: unknown, fallback: string, maxLength = 240) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function previewMaxWidthValue(value: unknown, fallback: ThemePreviewMaxWidth): ThemePreviewMaxWidth {
  if (value === 'none') return 'none';
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1280, Math.max(520, value));
}

function objectValue<T extends object>(value: unknown): Partial<T> {
  return value && typeof value === 'object' ? value as Partial<T> : {};
}

function normalizeDocxColor(value: unknown, fallback: string) {
  const raw = typeof value === 'string' ? value.trim().replace(/^#/, '') : '';
  return /^[0-9a-fA-F]{6}$/.test(raw) ? raw.toUpperCase() : fallback;
}

function normalizeDocxContract(value: unknown, fallback: DocxThemeContract): DocxThemeContract {
  const candidate = objectValue<DocxThemeContract>(value);
  return {
    font: stringValue(candidate.font, fallback.font, 120),
    codeFont: stringValue(candidate.codeFont, fallback.codeFont, 120),
    text: normalizeDocxColor(candidate.text, fallback.text),
    muted: normalizeDocxColor(candidate.muted, fallback.muted),
    accent: normalizeDocxColor(candidate.accent, fallback.accent),
    fill: normalizeDocxColor(candidate.fill, fallback.fill),
    border: normalizeDocxColor(candidate.border, fallback.border),
  };
}

function normalizeFontAssets(value: unknown): ThemeFontAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((font): ThemeFontAsset | null => {
      if (!font || typeof font !== 'object') return null;
      const candidate = font as Partial<ThemeFontAsset>;
      const family = stringValue(candidate.family, '', 120);
      const file = normalizeThemeRelativePath(candidate.file);
      if (!family || !file || !/\.(ttf|otf|woff|woff2)$/i.test(file)) return null;
      return { family, file };
    })
    .filter((font): font is ThemeFontAsset => Boolean(font));
}

export function normalizeThemeRelativePath(value: unknown) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\\/g, '/').trim();
  if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) return '';
  const parts = normalized.split('/').filter((part) => part && part !== '.');
  if (parts.some((part) => part === '..')) return '';
  return parts.join('/');
}

export function assertUserThemeId(themeId: unknown) {
  if (!isThemeId(themeId)) {
    throw new ThemeError('invalid_theme', t('theme.idInvalid'));
  }
  if (isBuiltInContentTheme(themeId)) {
    throw new ThemeError('built_in_theme_id', t('theme.builtInId', { themeId }), themeId);
  }
  return themeId;
}

export function buildUserThemeContract(manifest: ThemeManifest): ThemeContract {
  const id = assertUserThemeId(manifest.id);
  const base = builtInThemeContracts.miaoyan;
  const source = objectValue<PartialThemeContract>(manifest.contract);
  const editor = objectValue<ThemeContract['editor']>(source.editor);
  const preview = objectValue<ThemeContract['preview']>(source.preview);
  const search = objectValue<ThemeContract['search']>(source.search);
  const exportContract = objectValue<NonNullable<PartialThemeContract['export']>>(source.export);
  const code = objectValue<ThemeContract['code']>(source.code);
  const mermaid = objectValue<ThemeContract['mermaid']>(source.mermaid);
  const selection = objectValue<ThemeContract['selection']>(source.selection);

  return {
    id,
    label: stringValue(manifest.name, id),
    isDark: Boolean(manifest.isDark),
    editor: {
      ...base.editor,
      ...editor,
      fontFamily: stringValue(editor.fontFamily, base.editor.fontFamily, 400),
      codeFontFamily: stringValue(editor.codeFontFamily, base.editor.codeFontFamily, 240),
      lineHeight: numberValue(editor.lineHeight, base.editor.lineHeight, 1.1, 3),
    },
    preview: {
      ...base.preview,
      ...preview,
      fontFamily: stringValue(preview.fontFamily, base.preview.fontFamily, 400),
      fontSize: numberValue(preview.fontSize, base.preview.fontSize, 10, 36),
      lineHeight: numberValue(preview.lineHeight, base.preview.lineHeight, 1.1, 3),
      maxWidth: previewMaxWidthValue(preview.maxWidth, base.preview.maxWidth),
      writeClass: stringValue(preview.writeClass, base.preview.writeClass, 320),
    },
    search: {
      ...base.search,
      ...search,
      fontFamily: stringValue(search.fontFamily, base.search.fontFamily, 400),
    },
    export: {
      writeClass: stringValue(exportContract.writeClass, preview.writeClass ?? base.export.writeClass, 320),
      docx: normalizeDocxContract(exportContract.docx, base.export.docx),
    },
    code: {
      ...base.code,
      ...code,
    },
    mermaid: {
      ...base.mermaid,
      ...mermaid,
      theme: mermaid.theme === 'base' || mermaid.theme === 'neutral' ? mermaid.theme : base.mermaid.theme,
      fontSize: numberValue(mermaid.fontSize, base.mermaid.fontSize, 10, 24),
      fontFamily: stringValue(mermaid.fontFamily, base.mermaid.fontFamily, 400),
      fontLoadFamily: stringValue(mermaid.fontLoadFamily, base.mermaid.fontLoadFamily, 160),
      themeVariables: {
        ...base.mermaid.themeVariables,
        ...objectValue<Record<string, string>>(mermaid.themeVariables),
      },
    },
    selection: {
      ...base.selection,
      ...selection,
    },
  };
}

export function parseThemeManifest(raw: string): ThemeManifest {
  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new ThemeError('invalid_theme', t('theme.jsonInvalid'));
  }

  if (!manifest || typeof manifest !== 'object') {
    throw new ThemeError('invalid_theme', t('theme.jsonNotObject'));
  }

  const candidate = manifest as Partial<ThemeManifest>;
  if (candidate.schemaVersion !== THEME_SCHEMA_VERSION) {
    throw new ThemeError('invalid_theme', t('theme.schemaUnsupported', { version: THEME_SCHEMA_VERSION }));
  }
  const id = assertUserThemeId(candidate.id);
  const name = stringValue(candidate.name, '');
  if (!name) {
    throw new ThemeError('invalid_theme', t('theme.nameMissing'), id);
  }

  return {
    schemaVersion: THEME_SCHEMA_VERSION,
    id,
    name,
    author: stringValue(candidate.author, '', 120),
    version: stringValue(candidate.version, '', 80),
    description: stringValue(candidate.description, '', 500),
    isDark: Boolean(candidate.isDark),
    fonts: normalizeFontAssets(candidate.fonts),
    previewImage: normalizeThemeRelativePath(candidate.previewImage),
    contract: objectValue<PartialThemeContract>(candidate.contract),
  };
}

export function validateThemePackageInput(input: {
  manifest: ThemeManifest;
  css: string;
  directory: string;
}) {
  validateThemeCss(input.css, input.manifest.id);
  const fonts = normalizeFontAssets(input.manifest.fonts);
  const previewImagePath = input.manifest.previewImage
    ? input.manifest.previewImage
    : undefined;

  return {
    id: input.manifest.id,
    name: input.manifest.name,
    author: input.manifest.author ?? '',
    version: input.manifest.version ?? '',
    description: input.manifest.description ?? '',
    isDark: Boolean(input.manifest.isDark),
    directory: input.directory,
    css: input.css,
    contract: buildUserThemeContract(input.manifest),
    fonts,
    previewImagePath,
  } satisfies ThemePackage;
}

export const BUILT_IN_THEME_IDS = new Set<string>(CONTENT_THEMES);

export const __themePackageTesting = {
  normalizeDocxColor,
  normalizeFontAssets,
  stringValue,
};
