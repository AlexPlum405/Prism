import { describe, expect, it } from 'vitest';
import {
  getCurrentLocale,
  getMissingTranslationKeys,
  resolveAppLocale,
  setLocaleForTesting,
  t,
} from './index';

describe('i18n runtime', () => {
  it('keeps translation keys complete across supported app locales', () => {
    expect(getMissingTranslationKeys()).toEqual({
      'zh-CN': [],
      'en-US': [],
      'ja-JP': [],
    });
  });

  it('resolves auto locale from navigator-like language lists', () => {
    expect(resolveAppLocale('auto', ['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveAppLocale('auto', ['ja-JP', 'en-US'])).toBe('ja-JP');
    expect(resolveAppLocale('auto', ['en-US'])).toBe('en-US');
    expect(resolveAppLocale('auto', ['fr-FR'])).toBe('zh-CN');
  });

  it('updates document lang and falls back to the active locale messages', () => {
    setLocaleForTesting('ja-JP');

    expect(getCurrentLocale()).toBe('ja-JP');
    expect(document.documentElement.lang).toBe('ja-JP');
    expect(t('settings.language.label')).toBe('表示言語');

    setLocaleForTesting('zh-CN');
  });
});
