import { t } from '../../i18n';

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
  return 'linux';
}

export function getFileManagerName(platform: RuntimePlatform = getRuntimePlatform()): string {
  if (platform === 'mac') return t('workspace.fileManager.mac');
  if (platform === 'windows') return t('workspace.fileManager.windows');
  return t('workspace.fileManager.linux');
}

export function getShowInFileManagerLabel(platform: RuntimePlatform = getRuntimePlatform()): string {
  return t('workspace.fileManager.showIn', { manager: getFileManagerName(platform) });
}
