export type LocalePreference = 'auto' | 'zh-CN' | 'en-US' | 'ja-JP';
export type AppLocale = Exclude<LocalePreference, 'auto'>;

export const LOCALE_PREFERENCES = ['auto', 'zh-CN', 'en-US', 'ja-JP'] as const;
export const APP_LOCALES = ['zh-CN', 'en-US', 'ja-JP'] as const;

export function isLocalePreference(value: unknown): value is LocalePreference {
  return typeof value === 'string' && LOCALE_PREFERENCES.includes(value as LocalePreference);
}
