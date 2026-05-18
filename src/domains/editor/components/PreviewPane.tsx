import { useMemo, useEffect, useRef, useState } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import { markdownToHtml } from '../../../lib/markdownToHtml';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ContentTheme, DEFAULT_SETTINGS, isContentTheme } from '../../settings/types';
import { useSettingsStore } from '../../settings/store';
import { getMermaidThemeConfig, getThemeContract } from '../../themes';
import { dirname, joinPath } from '../../workspace/services/path';

interface PreviewPaneProps {
  content: string;
  documentPath?: string;
  onNotice?: (message: string) => void;
}

const PREVIEW_RENDER_DEBOUNCE_MS = 120;
const mermaidSvgCache = new Map<string, string>();

function getCurrentContentTheme(): ContentTheme {
  const theme = document.documentElement.getAttribute('data-content-theme');
  return isContentTheme(theme) ? theme : DEFAULT_SETTINGS.contentTheme;
}

function getExternalHttpUrl(rawHref: string, resolvedHref: string) {
  if (/^https?:\/\//i.test(rawHref)) return rawHref;
  if (rawHref.startsWith('//') && /^https?:\/\//i.test(resolvedHref)) return resolvedHref;
  return null;
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function isExternalMediaSrc(value: string) {
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) return true;
  if (isWindowsAbsolutePath(value)) return false;
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function resolvePreviewMediaPath(rawSrc: string, documentPath?: string) {
  const src = rawSrc.trim();
  if (!src || !documentPath || src.startsWith('#') || src.startsWith('?')) return null;
  if (isExternalMediaSrc(src)) return null;
  if (src.startsWith('/')) return src;
  if (isWindowsAbsolutePath(src)) return src;
  return joinPath(dirname(documentPath), src);
}

function getPreviewMediaMimeType(filePath: string) {
  const normalized = filePath.toLowerCase();
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function resolveLocalPreviewMedia(
  container: HTMLElement,
  documentPath: string | undefined,
  options: {
    isCancelled: () => boolean;
    trackObjectUrl: (url: string) => void;
  },
) {
  if (!documentPath) return;

  const mediaElements = Array.from(container.querySelectorAll<HTMLImageElement | HTMLSourceElement>('img[src], source[src]'));

  await Promise.all(mediaElements.map(async (media) => {
    const rawSrc = media.getAttribute('src') ?? '';
    const filePath = resolvePreviewMediaPath(rawSrc, documentPath);
    if (!filePath) return;

    try {
      const bytes = await readFile(filePath);
      if (options.isCancelled()) return;

      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: getPreviewMediaMimeType(filePath) }));
      options.trackObjectUrl(objectUrl);
      media.dataset.prismOriginalSrc = rawSrc;
      media.dataset.prismFileSrc = filePath;
      media.setAttribute('src', objectUrl);
    } catch (error) {
      media.dataset.prismMediaError = error instanceof Error ? error.message : String(error);
    }
  }));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRenderError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function getMermaidCacheKey(contentTheme: ContentTheme, code: string) {
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = Math.imul(31, hash) + code.charCodeAt(index) | 0;
  }
  return `${contentTheme}:${hash.toString(36)}:${code.length}`;
}

function createMermaidRenderSandbox() {
  const sandbox = document.createElement('div');
  sandbox.dataset.prismMermaidSandbox = 'true';
  sandbox.setAttribute('aria-hidden', 'true');
  Object.assign(sandbox.style, {
    position: 'absolute',
    inset: '0 auto auto -10000px',
    width: '800px',
    height: '600px',
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  document.body.appendChild(sandbox);
  return sandbox;
}

function renderMermaidSvg(container: HTMLElement, svg: string) {
  container.classList.remove('mermaid-placeholder--failed');
  container.innerHTML = svg;
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.margin = '1.5em 0';
  const svgEl = container.querySelector('svg');
  if (svgEl) {
    requestAnimationFrame(() => normalizeMermaidSvg(svgEl));
  }
}

function renderMermaidError(container: HTMLElement, error: unknown) {
  const sourceLine = container.getAttribute('data-source-line') ?? container.getAttribute('data-line') ?? '';
  const sourceAction = sourceLine
    ? `<button type="button" data-preview-source-line="${escapeHtml(sourceLine)}">跳到源码</button>`
    : '';

  container.classList.add('mermaid-placeholder--failed');
  container.innerHTML = `
    <div class="preview-render-error" role="note" data-render-kind="mermaid">
      <div class="preview-render-error-main">
        <div class="preview-render-error-title">Mermaid 渲染失败</div>
        <div class="preview-render-error-message">${escapeHtml(formatRenderError(error))}</div>
      </div>
      <div class="preview-render-error-actions">
        ${sourceLine ? `<span>源码行 ${escapeHtml(sourceLine)}</span>` : ''}
        ${sourceAction}
      </div>
    </div>
  `;
}

export const __previewPaneTesting = {
  clearMermaidCache: () => mermaidSvgCache.clear(),
};

function readClosestSourceLine(element: Element) {
  const sourceElement = element.closest<HTMLElement>('[data-source-line], [data-line]');
  return sourceElement?.getAttribute('data-source-line') ?? sourceElement?.getAttribute('data-line') ?? '';
}

function enhanceKatexErrors(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('.katex-error').forEach((errorElement) => {
    if (errorElement.dataset.previewKatexEnhanced === 'true') return;

    const sourceLine = readClosestSourceLine(errorElement);
    const message = errorElement.getAttribute('title') || 'KaTeX 渲染失败';
    errorElement.dataset.previewKatexEnhanced = 'true';
    errorElement.classList.add('preview-katex-error');
    errorElement.setAttribute('title', message);

    if (!sourceLine) return;

    errorElement.setAttribute('data-preview-source-line', sourceLine);
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'preview-katex-error-action';
    action.dataset.previewSourceLine = sourceLine;
    action.textContent = '跳到源码';
    errorElement.insertAdjacentElement('afterend', action);
  });
}

async function waitForDiagramFont(contentTheme: ContentTheme) {
  if (!('fonts' in document)) return;
  const fontLoadFamily = getThemeContract(contentTheme).mermaid.fontLoadFamily;
  try {
    await Promise.all([
      document.fonts.load(`15px ${fontLoadFamily}`),
      document.fonts.ready,
    ]);
  } catch {
    // Font loading is a visual enhancement; Mermaid can still render with fallbacks.
  }
}

function waitForPreviewRenderSlot() {
  return new Promise<void>((resolve) => {
    const idleWindow = window as Window & typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(() => resolve(), { timeout: 300 });
      return;
    }

    window.setTimeout(resolve, 0);
  });
}

function normalizeMermaidSvg(svg: SVGSVGElement) {
  svg.style.display = 'block';
  svg.style.marginInline = 'auto';
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');

  svg.querySelectorAll('foreignObject').forEach((node) => {
    const el = node as SVGGraphicsElement;
    el.style.overflow = 'visible';
    el.setAttribute('overflow', 'visible');
  });

  svg.querySelectorAll<HTMLElement>('.nodeLabel, .edgeLabel, .label, .cluster-label').forEach((label) => {
    label.style.overflow = 'visible';
    label.style.lineHeight = '1.35';
  });

  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      const padding = 28;
      const x = Math.floor(box.x - padding);
      const y = Math.floor(box.y - padding);
      const width = Math.ceil(box.width + padding * 2);
      const height = Math.ceil(box.height + padding * 2);
      svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
      svg.setAttribute('height', String(height));
    }
  } catch {
    // Some SVGs can throw while fonts/images settle; CSS overflow still prevents most clipping.
  }
}

export function PreviewPane({ content, documentPath, onNotice }: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentTheme, setContentTheme] = useState<ContentTheme>(getCurrentContentTheme);
  const [renderContent, setRenderContent] = useState(content);
  const previewFontFamily = useSettingsStore((s) => s.previewFontFamily);
  const previewFontSize = useSettingsStore((s) => s.previewFontSize);

  useEffect(() => {
    if (content === renderContent) return;
    const timer = window.setTimeout(() => {
      setRenderContent(content);
    }, PREVIEW_RENDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [content, renderContent]);

  const html = useMemo(() => {
    try {
      return markdownToHtml(renderContent, { frontMatterMode: 'metadata' });
    } catch {
      return '<p>渲染失败</p>';
    }
  }, [renderContent]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next = getCurrentContentTheme();
      setContentTheme((prev) => (prev === next ? prev : next));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-content-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    const write = containerRef.current?.querySelector<HTMLElement>('#write');
    if (!write) {
      return () => {
        cancelled = true;
      };
    }
    void resolveLocalPreviewMedia(write, documentPath, {
      isCancelled: () => cancelled,
      trackObjectUrl: (url) => objectUrls.push(url),
    });
    enhanceKatexErrors(write);
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [html, documentPath]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleLinkClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href) {
        const rawHref = anchor.getAttribute('href')?.trim() ?? '';
        if (!rawHref || rawHref.startsWith('#')) return;

        const externalUrl = getExternalHttpUrl(rawHref, anchor.href);
        if (externalUrl) {
          e.preventDefault();
          try {
            await openUrl(externalUrl);
          } catch {
            onNotice?.('打开外部链接失败');
          }
          return;
        }

        e.preventDefault();
        onNotice?.('预览中的本地链接已拦截，请通过文件树打开');
      }
    };

    container.addEventListener('click', handleLinkClick);
    return () => container.removeEventListener('click', handleLinkClick);
  }, [html, onNotice]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const placeholders = container.querySelectorAll('.mermaid-placeholder');
    if (placeholders.length === 0) return;

    const mermaidConfig = getMermaidThemeConfig(contentTheme);
    let cancelled = false;
    const scheduleRender =
      'requestIdleCallback' in window
        ? (callback: () => void) => {
            const id = window.requestIdleCallback(callback, { timeout: 300 });
            return () => window.cancelIdleCallback(id);
          }
        : (callback: () => void) => {
            const id = window.setTimeout(callback, 0);
            return () => window.clearTimeout(id);
          };

    const cancelScheduledRender = scheduleRender(() => {
      import('mermaid').then(({ default: mermaid }) => {
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          ...mermaidConfig,
          suppressErrorRendering: true,
        });

        const placeholderList = Array.from(placeholders);
        void (async () => {
          await waitForDiagramFont(contentTheme);

          for (const [i, placeholder] of placeholderList.entries()) {
            if (cancelled) return;
            const el = placeholder as HTMLElement;
            const encoded = el.getAttribute('data-mermaid');
            if (!encoded) continue;

            const code = decodeURIComponent(encoded);
            const cacheKey = getMermaidCacheKey(contentTheme, code);
            const cachedSvg = mermaidSvgCache.get(cacheKey);
            if (cachedSvg) {
              renderMermaidSvg(el, cachedSvg);
              await waitForPreviewRenderSlot();
              continue;
            }

            const id = `mermaid-${Date.now()}-${i}`;
            const renderSandbox = createMermaidRenderSandbox();

            try {
              const { svg } = await mermaid.render(id, code, renderSandbox);
              if (cancelled) return;
              mermaidSvgCache.set(cacheKey, svg);
              renderMermaidSvg(el, svg);
            } catch (err) {
              if (cancelled) return;
              renderMermaidError(el, err);
            } finally {
              renderSandbox.remove();
            }

            await waitForPreviewRenderSlot();
          }
        })();
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [html, contentTheme]);

  return (
    <div ref={containerRef} className={`preview-compat preview-compat--${contentTheme}`}>
      <div
        id="write"
        className={getThemeContract(contentTheme).preview.writeClass}
        style={{
          fontFamily: previewFontFamily === 'inherit' ? undefined : previewFontFamily,
          fontSize: `${previewFontSize}px`,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
