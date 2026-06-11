import { markdownToHtml } from './markdownToHtml';
import {
  type MarkdownRenderOptions,
  type MarkdownRenderRequest,
} from './markdownRenderCore';
import { getCurrentLocale } from '../domains/i18n';
import type { AppLocale } from '../domains/i18n';

export interface MarkdownRenderResult {
  html: string;
  /** 该结果是否已过期（有更晚的请求发出）。调用方应忽略 stale 结果。 */
  stale: boolean;
}

interface WorkerLike {
  postMessage(message: MarkdownRenderRequest): void;
  onmessage: ((event: { data: { seq: number; html: string; error?: string } }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  terminate(): void;
}

export type WorkerFactory = () => WorkerLike | null;

interface PendingRender {
  content: string;
  options: MarkdownRenderOptions;
  requestSeq: number;
  resolve: (result: MarkdownRenderResult) => void;
  reject: (error: unknown) => void;
}

/** 默认 Worker 工厂：仅在浏览器且支持 Worker 时创建，否则返回 null 触发主线程降级。 */
function defaultWorkerFactory(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./markdownRender.worker.ts', import.meta.url), {
      type: 'module',
    }) as unknown as WorkerLike;
  } catch {
    return null;
  }
}

/**
 * 创建预览渲染服务。优先用 Worker 离主线程渲染；Worker 不可用（jsdom/旧环境/创建失败）时
 * 自动降级为主线程渲染（包在 microtask 中让出，预览绝不白屏）。
 *
 * render() 返回带 stale 标记的结果：每次调用递增序号，更晚的请求会使先前结果 stale，
 * 调用方据此丢弃过期回包，保证旧结果不覆盖新结果。
 */
export function createMarkdownRenderService(workerFactory: WorkerFactory = defaultWorkerFactory) {
  let worker: WorkerLike | null | undefined; // undefined = 未初始化
  let seq = 0;
  const pending = new Map<number, PendingRender>();

  function ensureWorker(): WorkerLike | null {
    if (worker === undefined) {
      worker = workerFactory();
      if (worker) {
        worker.onmessage = (event) => {
          const { seq: responseSeq, html, error } = event.data;
          const request = pending.get(responseSeq);
          if (!request) return; // 已被更晚请求取代或不存在
          pending.delete(responseSeq);
          if (error) {
            renderOnMainThread(request.content, request.options, request.requestSeq)
              .then(request.resolve, request.reject);
            return;
          }
          request.resolve({ html, stale: responseSeq !== seq });
        };
        worker.onerror = () => {
          // Worker 运行期出错：丢弃 worker，并把已发出的请求转到主线程降级。
          worker?.terminate();
          worker = null;
          fallbackPendingRequestsToMainThread();
        };
      }
    }
    return worker;
  }

  function renderOnMainThread(
    content: string,
    options: MarkdownRenderOptions,
    requestSeq: number,
  ): Promise<MarkdownRenderResult> {
    // 主线程 locale 本就正确，直接调用 markdownToHtml，避免 setLocale 副作用。
    return Promise.resolve().then(() => ({
      html: markdownToHtml(content, options),
      stale: requestSeq !== seq,
    }));
  }

  function fallbackPendingRequestsToMainThread(): void {
    const pendingRequests = Array.from(pending.values());
    pending.clear();

    for (const request of pendingRequests) {
      renderOnMainThread(request.content, request.options, request.requestSeq)
        .then(request.resolve, request.reject);
    }
  }

  return {
    render(content: string, options: MarkdownRenderOptions = {}): Promise<MarkdownRenderResult> {
      seq += 1;
      const requestSeq = seq;
      const activeWorker = ensureWorker();

      if (!activeWorker) {
        return renderOnMainThread(content, options, requestSeq);
      }

      const locale: AppLocale = getCurrentLocale();
      return new Promise<MarkdownRenderResult>((resolve, reject) => {
        pending.set(requestSeq, {
          content,
          options,
          requestSeq,
          resolve,
          reject,
        });
        try {
          activeWorker.postMessage({ seq: requestSeq, content, options, locale });
        } catch {
          // postMessage 失败：清理并降级主线程。
          pending.delete(requestSeq);
          worker = null;
          renderOnMainThread(content, options, requestSeq).then(resolve, reject);
        }
      });
    },

    /** 当前是否使用 Worker（用于测试/诊断）。 */
    isUsingWorker(): boolean {
      return ensureWorker() !== null;
    },

    dispose() {
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  };
}

/** 应用级单例渲染服务。 */
export const markdownRenderService = createMarkdownRenderService();
