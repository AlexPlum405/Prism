import { useEffect } from 'react';
import { useI18n } from '../domains/i18n/useI18n';
import { getNativeAppMenuLabels } from '../domains/i18n/appMenuLabels';
import { updateAppMenuLabelsNative } from '../platform/tauri/nativeCommands';

/**
 * 让 macOS 系统菜单栏跟随界面语言。
 *
 * 菜单是 Rust 在 app 启动时构建的，那时 settings 还没读出来，只能先挂中文。
 * 这里挂上语言变化就重建一次：首次启动会看到极短的中文菜单，之后一直跟随设置。
 * 失败时静默——菜单语言不对不值得打断用户，下次切换语言会重试。
 */
export function useNativeMenuLabels(): void {
  const { locale } = useI18n();

  useEffect(() => {
    void updateAppMenuLabelsNative(getNativeAppMenuLabels()).catch(() => undefined);
  }, [locale]);
}
