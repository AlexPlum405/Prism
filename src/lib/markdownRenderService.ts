import {
  type MarkdownRenderOptions,
  type MarkdownRenderRequest,
  type MarkdownRenderResponse,
} from './markdownRenderCore';
import { getCurrentLocale } from '../domains/i18n/runtime';
import type { AppLocale } from '../domains/i18n/types';

export interface MarkdownRenderResult {
  html: string;
  /** 该结果是否已过期（有更晚的请求发出）。调用方应忽略 stale 结果。 */
  stale: boolean;
  timing: MarkdownRenderTiming;
}

export interface MarkdownRenderTiming {
  mode: 'worker' | 'main';
  /** markdownToHtml 本体耗时；Worker 模式下来自 Worker 内部。 */
  markdownToHtmlMs: number;
  /** 从 render() 发起到结果可用的总耗时，包含 Worker 往返或主线程降级等待。 */
  elapsedMs: number;
}

interface WorkerLike {
  postMessage(message: MarkdownRenderRequest): void;
  onmessage: ((event: { data: MarkdownRenderResponse & { error?: string } }) => void) | null;
  onerror?: ((event: unknown) => void) | null;
  terminate(): void;
}

export type WorkerFactory = () => WorkerLike | null;

interface PendingRender {
  content: string;
  locale: AppLocale;
  options: MarkdownRenderOptions;
  requestSeq: number;
  requestedAtMs: number;
  resolve: (result: MarkdownRenderResult) => void;
  reject: (error: unknown) => void;
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

async function renderMarkdownOnMainThread(content: string, options: MarkdownRenderOptions) {
  const { markdownToHtml } = await import('./markdownToHtml');
  return markdownToHtml(content, options);
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
  let warmupRequested = false;
  let activeWorkerRequestSeq: number | null = null;
  let queuedWorkerRequest: PendingRender | null = null;
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
          if (activeWorkerRequestSeq === responseSeq) {
            activeWorkerRequestSeq = null;
          }
          if (error) {
            renderOnMainThread(request.content, request.options, request.requestSeq, request.requestedAtMs)
              .then(request.resolve, request.reject)
              .finally(flushQueuedWorkerRequest);
            return;
          }
          const finishedAt = nowMs();
          request.resolve({
            html,
            stale: responseSeq !== seq,
            timing: {
              mode: 'worker',
              markdownToHtmlMs: event.data.timing?.markdownToHtmlMs ?? finishedAt - request.requestedAtMs,
              elapsedMs: finishedAt - request.requestedAtMs,
            },
          });
          flushQueuedWorkerRequest();
        };
        worker.onerror = () => {
          // Worker 运行期出错：丢弃 worker，并把已发出的请求转到主线程降级。
          worker?.terminate();
          worker = null;
          activeWorkerRequestSeq = null;
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
    requestedAtMs = nowMs(),
  ): Promise<MarkdownRenderResult> {
    // 主线程 locale 本就正确，直接调用 markdownToHtml，避免 setLocale 副作用。
    return Promise.resolve().then(async () => {
      const renderStartedAt = nowMs();
      const html = await renderMarkdownOnMainThread(content, options);
      const finishedAt = nowMs();
      return {
        html,
        stale: requestSeq !== seq,
        timing: {
          mode: 'main' as const,
          markdownToHtmlMs: finishedAt - renderStartedAt,
          elapsedMs: finishedAt - requestedAtMs,
        },
      };
    });
  }

  function fallbackPendingRequestsToMainThread(): void {
    const pendingRequests = Array.from(pending.values());
    pending.clear();
    queuedWorkerRequest = null;
    activeWorkerRequestSeq = null;

    for (const request of pendingRequests) {
      renderOnMainThread(request.content, request.options, request.requestSeq, request.requestedAtMs)
        .then(request.resolve, request.reject);
    }
  }

  function resolveSupersededWorkerRequest(request: PendingRender): void {
    pending.delete(request.requestSeq);
    const finishedAt = nowMs();
    request.resolve({
      html: '',
      stale: true,
      timing: {
        mode: 'worker',
        markdownToHtmlMs: 0,
        elapsedMs: finishedAt - request.requestedAtMs,
      },
    });
  }

  function postWorkerRequest(activeWorker: WorkerLike, request: PendingRender): void {
    activeWorkerRequestSeq = request.requestSeq;
    try {
      activeWorker.postMessage({
        seq: request.requestSeq,
        content: request.content,
        options: request.options,
        locale: request.locale,
      });
    } catch {
      // postMessage 失败：清理并降级主线程。
      pending.delete(request.requestSeq);
      activeWorkerRequestSeq = null;
      worker = null;
      renderOnMainThread(request.content, request.options, request.requestSeq, request.requestedAtMs)
        .then(request.resolve, request.reject)
        .finally(flushQueuedWorkerRequest);
    }
  }

  function flushQueuedWorkerRequest(): void {
    if (activeWorkerRequestSeq !== null || !queuedWorkerRequest) return;

    const request = queuedWorkerRequest;
    queuedWorkerRequest = null;
    const activeWorker = ensureWorker();
    if (!activeWorker) {
      pending.delete(request.requestSeq);
      renderOnMainThread(request.content, request.options, request.requestSeq, request.requestedAtMs)
        .then(request.resolve, request.reject)
        .finally(flushQueuedWorkerRequest);
      return;
    }
    postWorkerRequest(activeWorker, request);
  }

  return {
    warmup(): boolean {
      if (warmupRequested) return worker !== null;
      const activeWorker = ensureWorker();
      if (!activeWorker) return false;

      warmupRequested = true;
      try {
        activeWorker.postMessage({
          seq: 0,
          content: '',
          options: {},
          locale: getCurrentLocale(),
        });
        return true;
      } catch {
        warmupRequested = false;
        worker = null;
        return false;
      }
    },

    render(content: string, options: MarkdownRenderOptions = {}): Promise<MarkdownRenderResult> {
      seq += 1;
      const requestSeq = seq;
      const requestedAtMs = nowMs();
      const locale: AppLocale = getCurrentLocale();
      const activeWorker = ensureWorker();

      if (!activeWorker) {
        return renderOnMainThread(content, options, requestSeq, requestedAtMs);
      }

      return new Promise<MarkdownRenderResult>((resolve, reject) => {
        const request: PendingRender = {
          content,
          locale,
          options,
          requestSeq,
          requestedAtMs,
          resolve,
          reject,
        };
        pending.set(requestSeq, request);

        if (activeWorkerRequestSeq !== null) {
          if (queuedWorkerRequest) {
            resolveSupersededWorkerRequest(queuedWorkerRequest);
          }
          queuedWorkerRequest = request;
          return;
        }

        postWorkerRequest(activeWorker, request);
      });
    },

    /** 当前是否使用 Worker（用于测试/诊断）。 */
    isUsingWorker(): boolean {
      return ensureWorker() !== null;
    },

    dispose() {
      worker?.terminate();
      worker = null;
      warmupRequested = false;
      activeWorkerRequestSeq = null;
      queuedWorkerRequest = null;
      pending.clear();
    },
  };
}

/** 应用级单例渲染服务。 */
export const markdownRenderService = createMarkdownRenderService();
