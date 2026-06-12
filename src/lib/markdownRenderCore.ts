import { markdownToHtml } from './markdownToHtml';
import { getCurrentLocale, setLocaleForTesting } from '../domains/i18n';
import type { AppLocale } from '../domains/i18n';

// 渲染请求的选项，复用 markdownToHtml 的第二参数类型（无需改动 markdownToHtml.ts）。
export type MarkdownRenderOptions = NonNullable<Parameters<typeof markdownToHtml>[1]>;

export interface MarkdownRenderRequest {
  /** 递增序号，用于丢弃过期回包。 */
  seq: number;
  content: string;
  options: MarkdownRenderOptions;
  /** 已解析的具体 locale（绝不为 'auto'），用于 Worker 内设定 i18n 文案语言。 */
  locale: AppLocale;
}

export interface MarkdownRenderWorkerTiming {
  markdownToHtmlMs: number;
}

export interface MarkdownRenderResponse {
  seq: number;
  html: string;
  timing: MarkdownRenderWorkerTiming;
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * 在「指定 locale」下渲染 markdown。用于 Worker 上下文：Worker 是独立模块实例，
 * i18n 的 currentLocale 默认 zh-CN，必须按主线程传入的 locale 设定后再渲染，
 * 否则 front matter / citation 文案会语言错误。渲染后恢复原 locale，避免副作用。
 *
 * 注意：主线程 fallback 路径不应调用本函数（其 locale 已正确），直接用 markdownToHtml 即可，
 * 以免触发 setLocale 的监听副作用。
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
