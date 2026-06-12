import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { markdownRenderService } from './lib/markdownRenderService';
import 'katex/dist/katex.min.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const warmupMarkdownWorker = () => {
  markdownRenderService.warmup();
};

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(warmupMarkdownWorker, { timeout: 1200 });
} else {
  globalThis.setTimeout(warmupMarkdownWorker, 0);
}
