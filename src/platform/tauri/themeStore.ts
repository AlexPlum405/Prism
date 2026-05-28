import { invokeNativeCommand } from './nativeCommands';

export interface NativeThemePackageSourceDto {
  directory: string;
  id: string;
  manifest: string;
  css: string;
}

export interface NativeInvalidThemePackageDto {
  id: string;
  name: string;
  directory: string;
  error: string;
}

export interface NativeThemeScanResultDto {
  valid: NativeThemePackageSourceDto[];
  invalid: NativeInvalidThemePackageDto[];
}

export function getThemesDirectoryNative() {
  return invokeNativeCommand<unknown>('get_themes_directory');
}

export function scanInstalledThemesNative() {
  return invokeNativeCommand<unknown>('scan_installed_themes');
}

export function readThemePackageSourceNative(themeDirectory: string) {
  return invokeNativeCommand<unknown>('read_theme_package_source', { themeDirectory });
}

export function deleteUserThemeNative(themeId: string) {
  return invokeNativeCommand<void>('delete_user_theme', { themeId });
}

export function openThemesDirectoryNative() {
  return invokeNativeCommand<void>('open_themes_directory');
}
