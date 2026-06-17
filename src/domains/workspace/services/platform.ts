import { t } from '../../i18n/runtime';

export type RuntimePlatform = 'mac' | 'windows' | 'linux';

export function getRuntimePlatform(
  nav: Pick<Navigator, 'platform' | 'userAgent'> | undefined =
    typeof navigator === 'undefined' ? undefined : navigator,
): RuntimePlatform {
  if (!nav) return 'mac';

  const platform = nav.platform.toLowerCase();
  const userAgent = nav.userAgent.toLowerCase();

  if (platform.includes('mac') || userAgent.includes('mac os')) return 'mac';
  if (platform.includes('win') || userAgent.includes('windows')) return 'windows';
  if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) return 'linux';
  return 'linux';
}

export function getFileManagerName(platform: RuntimePlatform = getRuntimePlatform()): string {
  if (platform === 'mac') return t('workspace.fileManager.mac');
  if (platform === 'linux') return t('workspace.fileManager.linux');
  return t('workspace.fileManager.windows');
}

export function getShowInFileManagerLabel(platform: RuntimePlatform = getRuntimePlatform()): string {
  return t('workspace.fileManager.showIn', { manager: getFileManagerName(platform) });
}
