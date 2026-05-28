import * as opener from '@tauri-apps/plugin-opener';

export const openPathWithDefaultApp: typeof opener.openPath = (...args) => opener.openPath(...args);
export const openExternalUrl: typeof opener.openUrl = (...args) => opener.openUrl(...args);
export const revealPathInFileManager: typeof opener.revealItemInDir = (...args) => opener.revealItemInDir(...args);
