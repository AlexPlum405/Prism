import { resources, type I18nKey, type I18nParams } from './resources';
import {
  APP_LOCALES,
  isLocalePreference,
  type AppLocale,
  type LocalePreference,
} from './types';

type Listener = () => void;

const listeners = new Set<Listener>();
let currentPreference: LocalePreference = 'zh-CN';
let currentLocale: AppLocale = 'zh-CN';
let installedLanguageListener = false;

function getNavigatorLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }
  return navigator.language ? [navigator.language] : [];
}

function normalizeLanguageCode(language: string): string {
  return language.trim().toLowerCase().replace('_', '-');
}

export function resolveAppLocale(
  preference: LocalePreference,
  languages: readonly string[] = getNavigatorLanguages(),
): AppLocale {
  if (preference !== 'auto') return preference;

  for (const language of languages) {
    const normalized = normalizeLanguageCode(language);
    if (normalized.startsWith('zh')) return 'zh-CN';
    if (normalized.startsWith('ja')) return 'ja-JP';
    if (normalized.startsWith('en')) return 'en-US';
  }

  return 'zh-CN';
}

function notify() {
  listeners.forEach((listener) => listener());
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.setAttribute('data-locale', locale);
}

function updateLocale(preference: LocalePreference, forceNotify = false) {
  const nextLocale = resolveAppLocale(preference);
  const changed = preference !== currentPreference || nextLocale !== currentLocale;
  currentPreference = preference;
  currentLocale = nextLocale;
  applyDocumentLocale(currentLocale);
  if (changed || forceNotify) notify();
}

export function applyLocaleRuntime(preference: LocalePreference) {
  updateLocale(preference);
  installLocaleChangeListener();
}

export function installLocaleChangeListener() {
  if (installedLanguageListener || typeof window === 'undefined') return;
  installedLanguageListener = true;
  window.addEventListener('languagechange', () => {
    if (currentPreference === 'auto') updateLocale('auto', true);
  });
}

export function getLocalePreference() {
  return currentPreference;
}

export function getCurrentLocale() {
  return currentLocale;
}

export function setLocaleForTesting(preference: LocalePreference) {
  updateLocale(preference, true);
}

export function subscribeLocale(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocaleSnapshot() {
  return `${currentPreference}:${currentLocale}`;
}

export function formatMessage(
  template: string,
  params: I18nParams = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function t(key: I18nKey, params?: I18nParams): string {
  const message =
    resources[currentLocale]?.[key] ??
    resources['en-US'][key] ??
    resources['zh-CN'][key] ??
    key;
  return params ? formatMessage(message, params) : message;
}

export function formatLocalizedNumber(value: number): string {
  try {
    return new Intl.NumberFormat(currentLocale).format(value);
  } catch {
    return String(value);
  }
}

export function normalizeLocalePreference(value: unknown): LocalePreference {
  return isLocalePreference(value) ? value : 'auto';
}

export function getMissingTranslationKeys(): Record<AppLocale, I18nKey[]> {
  const sourceKeys = Object.keys(resources['zh-CN']) as I18nKey[];
  return Object.fromEntries(
    APP_LOCALES.map((locale) => [
      locale,
      sourceKeys.filter((key) => !resources[locale][key]),
    ]),
  ) as Record<AppLocale, I18nKey[]>;
}
