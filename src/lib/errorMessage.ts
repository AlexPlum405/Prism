import { t } from '../domains/i18n/runtime';

/**
 * 把任意抛出物压成一句可展示的文案。
 *
 * 项目里曾有 11 份同构实现，分支还不一致：有的处理 Event、有的不处理，
 * 有的对空白消息 trim、有的不 trim——同一个错误从不同入口触发，用户看到的
 * 文案可能不同。统一到这里之后，行为只有一个真身。
 *
 * Event 分支刻意不返回 `event.type`（'error' / 'abort' 这类标识），
 * 那是给开发者看的，不是文案。
 */
export function formatUnknownError(error: unknown, fallback?: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
  } else if (error instanceof Event) {
    return t('common.unknownEventError');
  } else if (typeof error === 'string') {
    const message = error.trim();
    if (message) return message;
  }
  return fallback ?? t('common.unknownError');
}
