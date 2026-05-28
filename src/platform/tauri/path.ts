import * as pathApi from '@tauri-apps/api/path';

export const appDataDir: typeof pathApi.appDataDir = (...args) => pathApi.appDataDir(...args);
export const downloadDir: typeof pathApi.downloadDir = (...args) => pathApi.downloadDir(...args);
export const homeDir: typeof pathApi.homeDir = (...args) => pathApi.homeDir(...args);

export const nativePath = {
  appDataDir,
  downloadDir,
  homeDir,
};
