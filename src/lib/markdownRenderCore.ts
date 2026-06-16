import type { MarkdownToHtmlOptions } from './markdownToHtml';
import type { AppLocale } from '../domains/i18n/types';

export type MarkdownRenderOptions = MarkdownToHtmlOptions;

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
