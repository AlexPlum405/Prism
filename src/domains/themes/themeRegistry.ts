import { CONTENT_THEMES, type BuiltInContentTheme, type ContentTheme } from '../settings/types';
import { t } from '../i18n';
import {
  builtInThemeContracts,
  type MermaidThemeContract,
  type ThemeContract,
} from './themeContract';
import {
  getThemeCssAssetUrls,
  injectThemeCss,
  removeInjectedThemeStyles,
  replaceThemeCssAssetUrls,
} from './themeCss';
import { ThemeError } from './themeErrors';
import {
  readThemeAssetAsObjectUrl,
  scanInstalledThemePackages,
  type InvalidThemePackage,
} from './themeStorage';
import type { ThemePackage } from './themePackage';

export type ThemeEntrySource = 'built-in' | 'user' | 'invalid';

export interface ThemeRegistryEntry {
  id: ContentTheme;
  name: string;
  label: string;
  source: ThemeEntrySource;
  isDark: boolean;
  contract: ThemeContract;
  directory?: string;
  version?: string;
  author?: string;
  description?: string;
  previewImagePath?: string;
  error?: string;
  package?: ThemePackage;
}

export interface ApplyThemeResult {
  themeId: ContentTheme;
  fallback: boolean;
  warnings: string[];
}

let registryEntries: ThemeRegistryEntry[] = buildBuiltInEntries();
let activeThemeObjectUrls: string[] = [];
let activeThemeFontFamilies = new Set<string>();

function buildBuiltInEntries(): ThemeRegistryEntry[] {
  return CONTENT_THEMES.map((id) => {
    const contract = builtInThemeContracts[id];
    return {
      id,
      name: contract.label,
      label: contract.label,
      source: 'built-in',
      isDark: contract.isDark,
      contract,
    } satisfies ThemeRegistryEntry;
  });
}

function buildUserEntry(themePackage: ThemePackage): ThemeRegistryEntry {
  return {
    id: themePackage.id,
    name: themePackage.name,
    label: themePackage.name,
    source: 'user',
    isDark: themePackage.isDark,
    contract: themePackage.contract,
    directory: themePackage.directory,
    version: themePackage.version,
    author: themePackage.author,
    description: themePackage.description,
    previewImagePath: themePackage.previewImagePath,
    package: themePackage,
  };
}

function buildInvalidEntry(themePackage: InvalidThemePackage): ThemeRegistryEntry {
  return {
    id: themePackage.id,
    name: themePackage.name,
    label: `${themePackage.name} (${t('theme.invalidSuffix')})`,
    source: 'invalid',
    isDark: false,
    contract: builtInThemeContracts.miaoyan,
    directory: themePackage.directory,
    error: themePackage.error,
  };
}

function setRuntimeEntries(userThemes: ThemePackage[], invalidThemes: InvalidThemePackage[]) {
  registryEntries = [
    ...buildBuiltInEntries(),
    ...userThemes.map(buildUserEntry),
    ...invalidThemes.map(buildInvalidEntry),
  ];
}

export async function reloadThemeRegistry() {
  const { valid, invalid } = await scanInstalledThemePackages();
  setRuntimeEntries(valid, invalid);
  return getThemeRegistrySnapshot();
}

export async function initializeThemeRegistry() {
  return reloadThemeRegistry();
}

export function getThemeRegistrySnapshot() {
  return registryEntries.map((entry) => ({ ...entry }));
}

export function getAvailableThemeEntries() {
  return registryEntries.filter((entry) => entry.source !== 'invalid');
}

export function getUserThemeEntries() {
  return registryEntries.filter((entry) => entry.source === 'user');
}

export function getInvalidThemeEntries() {
  return registryEntries.filter((entry) => entry.source === 'invalid');
}

export function getThemeEntry(themeId: ContentTheme | null | undefined) {
  if (!themeId) return undefined;
  return registryEntries.find((entry) => entry.id === themeId);
}

export function isRegisteredContentTheme(themeId: ContentTheme | null | undefined) {
  const entry = getThemeEntry(themeId);
  return Boolean(entry && entry.source !== 'invalid');
}

export function getThemeContract(themeId: ContentTheme): ThemeContract {
  const entry = getThemeEntry(themeId);
  if (entry && entry.source !== 'invalid') return entry.contract;
  return builtInThemeContracts.miaoyan;
}

export function mapThemeContracts<T>(selector: (contract: ThemeContract) => T): Record<ContentTheme, T> {
  return Object.fromEntries(
    getAvailableThemeEntries().map((entry) => [entry.id, selector(entry.contract)]),
  );
}

function clearActiveThemeAssets() {
  activeThemeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  activeThemeObjectUrls = [];
  activeThemeFontFamilies = new Set<string>();
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getFontFormat(file: string) {
  const extension = file.split('.').pop()?.toLowerCase();
  if (extension === 'woff2') return 'woff2';
  if (extension === 'woff') return 'woff';
  if (extension === 'otf') return 'opentype';
  if (extension === 'ttf') return 'truetype';
  return 'truetype';
}

async function registerThemeFonts(entry: ThemeRegistryEntry) {
  const warnings: string[] = [];
  if (!entry.package || !('FontFace' in window)) return warnings;

  for (const font of entry.package.fonts) {
    if (activeThemeFontFamilies.has(font.family)) continue;
    try {
      await document.fonts.load(`16px "${font.family}"`);
      activeThemeFontFamilies.add(font.family);
    } catch {
      warnings.push(t('theme.fontLoadFailed', { family: font.family }));
    }
  }

  return warnings;
}

async function buildRuntimeCss(entry: ThemeRegistryEntry) {
  if (!entry.package) return '';
  const replacements = new Map<string, string>();
  for (const assetUrl of getThemeCssAssetUrls(entry.package.css)) {
    try {
      const objectUrl = await readThemeAssetAsObjectUrl(entry.package.directory, assetUrl);
      replacements.set(assetUrl, objectUrl);
      activeThemeObjectUrls.push(objectUrl);
    } catch {
      throw new ThemeError('invalid_theme', t('theme.cssAssetMissing', { assetUrl }), entry.id);
    }
  }
  const fontFaceCss = await Promise.all(entry.package.fonts.map(async (font) => {
    const objectUrl = await readThemeAssetAsObjectUrl(entry.package!.directory, font.file);
    activeThemeObjectUrls.push(objectUrl);
    return `@font-face{font-family:"${escapeCssString(font.family)}";src:url("${objectUrl}") format("${getFontFormat(font.file)}");font-display:swap;}`;
  }));
  return `${fontFaceCss.join('\n')}\n${replaceThemeCssAssetUrls(entry.package.css, replacements)}`;
}

export async function applyThemeRuntime(themeId: ContentTheme): Promise<ApplyThemeResult> {
  const entry = getThemeEntry(themeId);
  if (!entry || entry.source === 'invalid') {
    document.documentElement.setAttribute('data-content-theme', 'miaoyan');
    removeInjectedThemeStyles();
    clearActiveThemeAssets();
    return {
      themeId: 'miaoyan',
      fallback: true,
      warnings: entry?.error ? [entry.error] : [t('theme.missingFallback')],
    };
  }

  removeInjectedThemeStyles();
  clearActiveThemeAssets();
  const warnings: string[] = [];

  if (entry.source === 'user') {
    const css = await buildRuntimeCss(entry);
    injectThemeCss(entry.id, css);
    warnings.push(...await registerThemeFonts(entry));
  }

  document.documentElement.setAttribute('data-content-theme', entry.id);
  return { themeId: entry.id, fallback: false, warnings };
}

export function getMermaidThemeConfig(theme: ContentTheme) {
  const contract: MermaidThemeContract = getThemeContract(theme).mermaid;
  return {
    theme: contract.theme,
    securityLevel: 'loose' as const,
    fontSize: contract.fontSize,
    fontFamily: contract.fontFamily,
    themeVariables: contract.themeVariables,
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis' as const,
      nodeSpacing: 80,
      rankSpacing: 80,
      padding: 30,
    },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true },
    journey: { useMaxWidth: true },
  };
}

export function getFallbackContentTheme(theme: ContentTheme | null | undefined): BuiltInContentTheme {
  return theme && isRegisteredContentTheme(theme) ? theme as BuiltInContentTheme : 'miaoyan';
}

export const __themeRegistryTesting = {
  buildBuiltInEntries,
  setRuntimeEntries,
};
