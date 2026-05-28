import { invokeNativeCommand } from './nativeCommands';

export function readSettingsFileNative() {
  return invokeNativeCommand<unknown>('read_settings_file');
}

export function writeSettingsFileNative(contents: string) {
  return invokeNativeCommand<void>('write_settings_file', { contents });
}
