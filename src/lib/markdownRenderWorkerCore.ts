import { markdownToHtml } from './markdownToHtml';
import type {
  MarkdownRenderOptions,
  MarkdownRenderRequest,
  MarkdownRenderResponse,
} from './markdownRenderCore';
import { getCurrentLocale, setLocaleForTesting } from '../domains/i18n/runtime';
import type { AppLocale } from '../domains/i18n/types';

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * 在「指定 locale」下渲染 markdown。用于 Worker 上下文：Worker 是独立模块实例，
 * i18n 的 currentLocale 默认 zh-CN，必须按主线程传入的 locale 设定后再渲染。
 */
export function renderMarkdownWithLocale(
  content: string,
  options: MarkdownRenderOptions,
  locale: AppLocale,
): string {
  const previous = getCurrentLocale();
  if (locale !== previous) setLocaleForTesting(locale);
  try {
    return markdownToHtml(content, options);
  } finally {
    if (locale !== previous) setLocaleForTesting(previous);
  }
}

/** 处理一条渲染请求，返回带相同序号的响应。Worker 与单测共用。 */
export function handleMarkdownRenderRequest(request: MarkdownRenderRequest): MarkdownRenderResponse {
  const startedAt = nowMs();
  const html = renderMarkdownWithLocale(request.content, request.options, request.locale);
  return {
    seq: request.seq,
    html,
    timing: {
      markdownToHtmlMs: nowMs() - startedAt,
    },
  };
}
