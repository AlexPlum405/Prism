/// <reference lib="webworker" />
import {
  handleMarkdownRenderRequest,
  type MarkdownRenderRequest,
  type MarkdownRenderResponse,
} from './markdownRenderCore';

// 预览渲染 Worker：在工作线程内执行 markdownToHtml，避免大文档渲染阻塞主线程。
// 通过 vite 的 `new Worker(new URL('./markdownRender.worker.ts', import.meta.url), { type: 'module' })` 加载。
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<MarkdownRenderRequest>) => {
  const request = event.data;
  try {
    const response = handleMarkdownRenderRequest(request);
    ctx.postMessage(response satisfies MarkdownRenderResponse);
  } catch (error) {
    // 渲染失败也回包（带原序号），由主线程决定降级/提示，不静默吞掉。
    ctx.postMessage({
      seq: request.seq,
      html: '',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
