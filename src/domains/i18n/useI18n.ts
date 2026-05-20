import { useSyncExternalStore } from 'react';
import {
  formatLocalizedNumber,
  getCurrentLocale,
  getLocalePreference,
  getLocaleSnapshot,
  subscribeLocale,
  t,
} from './runtime';

export function useI18n() {
  useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot);

  return {
    t,
    formatNumber: formatLocalizedNumber,
    locale: getCurrentLocale(),
    localePreference: getLocalePreference(),
  };
}
