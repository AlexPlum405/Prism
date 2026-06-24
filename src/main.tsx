import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles/global.css';

function renderBootstrapFailure(error: unknown) {
  const root = document.getElementById('root');
  if (!root) return;

  const title = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : '';

  root.innerHTML = `
    <main role="alert" style="box-sizing:border-box;min-height:100vh;padding:48px;color:#262626;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC',sans-serif;">
      <h1 style="margin:0 0 16px;font-size:20px;">Prism 启动失败</h1>
      <p style="margin:0 0 24px;color:#666;">前端入口模块加载失败，已保留诊断信息。</p>
      <pre style="max-height:70vh;overflow:auto;padding:16px;border:1px solid #e6e6e6;border-radius:8px;background:#f7f7f7;color:#262626;font:12px/1.5 SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;"></pre>
    </main>
  `;
  const pre = root.querySelector('pre');
  if (pre) pre.textContent = [title, stack].filter(Boolean).join('\n\n');
}

async function startApp() {
  try {
    const [{ default: App }, { AppErrorBoundary }] = await Promise.all([
      import('./App'),
      import('./components/shell/AppErrorBoundary'),
    ]);

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('[Prism bootstrap] Failed to start app', error);
    renderBootstrapFailure(error);
  }
}

void startApp();

const warmupMarkdownWorker = () => {
  void import('./lib/markdownRenderService').then(({ markdownRenderService }) => {
    markdownRenderService.warmup();
  });
};

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(warmupMarkdownWorker, { timeout: 1200 });
} else {
  globalThis.setTimeout(warmupMarkdownWorker, 0);
}
