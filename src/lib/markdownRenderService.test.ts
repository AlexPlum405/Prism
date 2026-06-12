import { describe, expect, it, afterEach } from 'vitest';
import { markdownToHtml } from './markdownToHtml';
import {
  createMarkdownRenderService,
  type WorkerFactory,
} from './markdownRenderService';
import {
  handleMarkdownRenderRequest,
  renderMarkdownWithLocale,
} from './markdownRenderCore';
import { getCurrentLocale, setLocaleForTesting } from '../domains/i18n';

const FRONT_MATTER_DOC = [
  '---',
  'title: 标题',
  '---',
  '',
  '# 正文',
].join('\n');

// 假 Worker：用 markdownRenderCore 同步算出结果，但通过 microtask 异步回包，
// 可控制延迟以测试过期丢弃。
function createFakeWorkerFactory(options: { delayMs?: number } = {}): WorkerFactory {
  return () => {
    const worker = {
      onmessage: null as null | ((event: { data: ReturnType<typeof handleMarkdownRenderRequest> }) => void),
      onerror: null as null | ((event: unknown) => void),
      postMessage(message: { seq: number; content: string; options: any; locale: any }) {
        const response = handleMarkdownRenderRequest(message);
        const deliver = () => worker.onmessage?.({ data: response });
        if (options.delayMs && options.delayMs > 0) {
          setTimeout(deliver, options.delayMs);
        } else {
          queueMicrotask(deliver);
        }
      },
      terminate() {},
    };
    return worker;
  };
}

function createErroredWorkerFactory(kind: 'runtime-error' | 'message-error'): WorkerFactory {
  return () => {
    const worker = {
      onmessage: null as null | ((event: { data: { seq: number; html: string; error?: string } }) => void),
      onerror: null as null | ((event: unknown) => void),
      postMessage(message: { seq: number }) {
        queueMicrotask(() => {
          if (kind === 'runtime-error') {
            worker.onerror?.(new Error('worker failed'));
            return;
          }

          worker.onmessage?.({
            data: {
              seq: message.seq,
              html: '',
              error: 'worker render failed',
            },
          });
        });
      },
      terminate() {},
    };
    return worker;
  };
}

async function raceWithTimeout<T>(promise: Promise<T>, timeoutMs = 30): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
  ]);
}

afterEach(() => {
  setLocaleForTesting('zh-CN');
});

describe('renderMarkdownWithLocale', () => {
  it('在指定 locale 下渲染 front matter 文案，并恢复原 locale', () => {
    setLocaleForTesting('zh-CN');
    const en = renderMarkdownWithLocale(FRONT_MATTER_DOC, { frontMatterMode: 'metadata' }, 'en-US');
    expect(en).toContain('Document Properties');
    // 渲染后恢复原 locale，不留副作用
    expect(getCurrentLocale()).toBe('zh-CN');
  });
});

describe('createMarkdownRenderService — 降级路径（无 Worker）', () => {
  it('无 Worker 环境返回与 markdownToHtml 字节一致的 HTML', async () => {
    const service = createMarkdownRenderService(() => null);
    expect(service.isUsingWorker()).toBe(false);
    const result = await service.render('# 标题\n\n正文 **加粗**。', { frontMatterMode: 'metadata' });
    expect(result.html).toBe(markdownToHtml('# 标题\n\n正文 **加粗**。', { frontMatterMode: 'metadata' }));
    expect(result.stale).toBe(false);
    expect(result.timing.mode).toBe('main');
    expect(result.timing.markdownToHtmlMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.elapsedMs).toBeGreaterThanOrEqual(result.timing.markdownToHtmlMs);
  });

  it('降级路径正确渲染富内容（表格/代码/KaTeX/Callout）', async () => {
    const service = createMarkdownRenderService(() => null);
    const doc = '| A | B |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst x=1;\n```\n\n$$E=mc^2$$\n\n> [!NOTE]\n> 提示';
    const result = await service.render(doc);
    expect(result.html).toBe(markdownToHtml(doc));
  });
});

describe('createMarkdownRenderService — Worker 路径', () => {
  it('Worker 输出与 markdownToHtml 字节一致', async () => {
    const service = createMarkdownRenderService(createFakeWorkerFactory());
    expect(service.isUsingWorker()).toBe(true);
    const doc = '# 标题\n\n正文 `代码`。';
    const result = await service.render(doc, { frontMatterMode: 'metadata' });
    expect(result.html).toBe(markdownToHtml(doc, { frontMatterMode: 'metadata' }));
    expect(result.timing.mode).toBe('worker');
    expect(result.timing.markdownToHtmlMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.elapsedMs).toBeGreaterThanOrEqual(result.timing.markdownToHtmlMs);
  });

  it('过期回包被标记 stale，只有最新请求 stale=false', async () => {
    const service = createMarkdownRenderService(createFakeWorkerFactory({ delayMs: 5 }));
    const p1 = service.render('# 第一次');
    const p2 = service.render('# 第二次');
    const p3 = service.render('# 第三次');
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    // 前两个过期
    expect(r1.stale).toBe(true);
    expect(r2.stale).toBe(true);
    // 最后一个是最新
    expect(r3.stale).toBe(false);
    expect(r3.html).toBe(markdownToHtml('# 第三次'));
  });

  it('Worker 运行期失败时会释放首个 pending 请求并降级主线程渲染', async () => {
    const service = createMarkdownRenderService(createErroredWorkerFactory('runtime-error'));
    const result = await raceWithTimeout(service.render('# 默认预览\n\n正文', { frontMatterMode: 'metadata' }));

    expect(result).not.toBe('timeout');
    expect(result).toMatchObject({
      html: markdownToHtml('# 默认预览\n\n正文', { frontMatterMode: 'metadata' }),
      stale: false,
    });
    expect(service.isUsingWorker()).toBe(false);
  });

  it('Worker 回包错误时会用原请求内容降级主线程渲染', async () => {
    const service = createMarkdownRenderService(createErroredWorkerFactory('message-error'));
    const result = await raceWithTimeout(service.render('# 回包失败\n\n正文', { frontMatterMode: 'metadata' }));

    expect(result).not.toBe('timeout');
    expect(result).toMatchObject({
      html: markdownToHtml('# 回包失败\n\n正文', { frontMatterMode: 'metadata' }),
      stale: false,
    });
  });
});

describe('createMarkdownRenderService — 三语 i18n', () => {
  it.each([
    ['zh-CN', '文档属性'],
    ['en-US', 'Document Properties'],
    ['ja-JP', '文書プロパティ'],
  ] as const)('Worker 路径在 %s 下渲染正确的 front matter 文案', async (locale, expectedLabel) => {
    setLocaleForTesting(locale);
    const service = createMarkdownRenderService(createFakeWorkerFactory());
    const result = await service.render(FRONT_MATTER_DOC, { frontMatterMode: 'metadata' });
    expect(result.html).toContain(expectedLabel);
  });
});
