import { useEffect, useRef, useState } from 'react';
import { readFile, stat } from '../../../platform/tauri/fileSystem';
import { markdownRenderService } from '../../../lib/markdownRenderService';
import { openExternalUrl } from '../../../platform/tauri/opener';
import { ContentTheme, DEFAULT_SETTINGS, isContentTheme } from '../../settings/types';
import { useSettingsStore } from '../../settings/store';
import { getMermaidThemeConfig, getThemeContract } from '../../themes';
import { dirname, joinPath } from '../../workspace/services/path';
import { t, useI18n } from '../../i18n';

interface PreviewPaneProps {
  content: string;
  documentPath?: string;
  renderStrategy?: 'deferred' | 'immediate';
  onNotice?: (message: string) => void;
  onOpenDocumentLink?: (
    target: string,
    options: { kind: 'markdown' | 'wiki'; sourcePath?: string },
  ) => void | Promise<void>;
}

const PREVIEW_RENDER_SMALL_DOC_LIMIT = 30 * 1024;
const PREVIEW_RENDER_LARGE_DOC_LIMIT = 300 * 1024;
const PREVIEW_RENDER_SMALL_DEBOUNCE_MS = 120;
const PREVIEW_RENDER_MEDIUM_DEBOUNCE_MS = 220;
const PREVIEW_RENDER_LARGE_DEBOUNCE_MS = 600;
const PREVIEW_MERMAID_BATCH_THRESHOLD = 10;
const PREVIEW_MERMAID_BATCH_SIZE = 3;
const PREVIEW_MEDIA_CACHE_LIMIT = 96;
const mermaidSvgCache = new Map<string, string>();
const mermaidFontReadyCache = new Map<string, Promise<void>>();
let lastMermaidConfigSignature: string | null = null;

interface PreviewMediaCacheEntry {
  objectUrl: string;
  signature: string;
}

const previewMediaCache = new Map<string, PreviewMediaCacheEntry>();

function getPreviewRenderDebounceMs(contentLength: number) {
  if (contentLength > PREVIEW_RENDER_LARGE_DOC_LIMIT) return PREVIEW_RENDER_LARGE_DEBOUNCE_MS;
  if (contentLength > PREVIEW_RENDER_SMALL_DOC_LIMIT) return PREVIEW_RENDER_MEDIUM_DEBOUNCE_MS;
  return PREVIEW_RENDER_SMALL_DEBOUNCE_MS;
}

function shouldShowPreviewUpdatingStatus(contentLength: number) {
  return contentLength > PREVIEW_RENDER_LARGE_DOC_LIMIT;
}

function getMermaidPreviewBatchSize(placeholderCount: number) {
  return placeholderCount > PREVIEW_MERMAID_BATCH_THRESHOLD ? PREVIEW_MERMAID_BATCH_SIZE : 1;
}

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

function hasUnsupportedLinkProtocol(value: string) {
  if (value.startsWith('//') || value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) return false;
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

function fileInfoSignature(info: Awaited<ReturnType<typeof stat>>) {
  const mtime = info.mtime instanceof Date
    ? info.mtime.getTime()
    : info.mtime
      ? new Date(info.mtime).getTime()
      : 0;
  return `${info.size}:${Number.isFinite(mtime) ? mtime : 0}`;
}

async function getPreviewMediaSignature(filePath: string) {
  try {
    return fileInfoSignature(await stat(filePath));
  } catch {
    return null;
  }
}

function rememberPreviewMedia(filePath: string, entry: PreviewMediaCacheEntry) {
  const previous = previewMediaCache.get(filePath);
  if (previous?.objectUrl && previous.objectUrl !== entry.objectUrl) {
    URL.revokeObjectURL(previous.objectUrl);
  }
  previewMediaCache.delete(filePath);
  previewMediaCache.set(filePath, entry);

  while (previewMediaCache.size > PREVIEW_MEDIA_CACHE_LIMIT) {
    const oldest = previewMediaCache.keys().next().value as string | undefined;
    if (!oldest) break;
    const removed = previewMediaCache.get(oldest);
    if (removed) URL.revokeObjectURL(removed.objectUrl);
    previewMediaCache.delete(oldest);
  }
}

function applyPreviewMediaObjectUrl(
  mediaElements: Array<HTMLImageElement | HTMLSourceElement>,
  rawSrcByElement: Map<HTMLImageElement | HTMLSourceElement, string>,
  filePath: string,
  objectUrl: string,
) {
  mediaElements.forEach((media) => {
    const rawSrc = rawSrcByElement.get(media) ?? '';
    media.dataset.prismOriginalSrc = rawSrc;
    media.dataset.prismFileSrc = filePath;
    media.setAttribute('src', objectUrl);
  });
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
  const mediaByPath = new Map<string, Array<HTMLImageElement | HTMLSourceElement>>();
  const rawSrcByElement = new Map<HTMLImageElement | HTMLSourceElement, string>();

  mediaElements.forEach((media) => {
    const rawSrc = media.getAttribute('src') ?? '';
    const filePath = resolvePreviewMediaPath(rawSrc, documentPath);
    if (!filePath) return;
    rawSrcByElement.set(media, rawSrc);
    const entries = mediaByPath.get(filePath);
    if (entries) {
      entries.push(media);
    } else {
      mediaByPath.set(filePath, [media]);
    }
  });

  await Promise.all(Array.from(mediaByPath.entries()).map(async ([filePath, elements]) => {
    const signature = await getPreviewMediaSignature(filePath);
    if (options.isCancelled()) return;

    const cached = previewMediaCache.get(filePath);
    if (signature !== null && cached && cached.signature === signature) {
      previewMediaCache.delete(filePath);
      previewMediaCache.set(filePath, cached);
      applyPreviewMediaObjectUrl(elements, rawSrcByElement, filePath, cached.objectUrl);
      return;
    }

    try {
      const bytes = await readFile(filePath);
      if (options.isCancelled()) return;

      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: getPreviewMediaMimeType(filePath) }));
      if (signature === null) {
        options.trackObjectUrl(objectUrl);
      } else {
        rememberPreviewMedia(filePath, { objectUrl, signature });
      }
      applyPreviewMediaObjectUrl(elements, rawSrcByElement, filePath, objectUrl);
    } catch (error) {
      elements.forEach((media) => {
        media.dataset.prismMediaError = error instanceof Error ? error.message : String(error);
      });
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

function initializeMermaidForPreview(
  mermaid: typeof import('mermaid').default,
  mermaidConfig: ReturnType<typeof getMermaidThemeConfig>,
) {
  const nextConfig = {
    startOnLoad: false,
    ...mermaidConfig,
    suppressErrorRendering: true,
  };
  const signature = JSON.stringify(nextConfig);
  if (lastMermaidConfigSignature === signature) return;

  mermaid.initialize(nextConfig);
  lastMermaidConfigSignature = signature;
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
    ? `<button type="button" data-preview-source-line="${escapeHtml(sourceLine)}">${escapeHtml(t('editor.preview.jumpToSource'))}</button>`
    : '';

  container.classList.add('mermaid-placeholder--failed');
  container.innerHTML = `
    <div class="preview-render-error" role="note" data-render-kind="mermaid">
      <div class="preview-render-error-main">
        <div class="preview-render-error-title">${escapeHtml(t('editor.preview.mermaidFailed'))}</div>
        <div class="preview-render-error-message">${escapeHtml(formatRenderError(error))}</div>
      </div>
      <div class="preview-render-error-actions">
        ${sourceLine ? `<span>${escapeHtml(t('editor.preview.sourceLine', { line: sourceLine }))}</span>` : ''}
        ${sourceAction}
      </div>
    </div>
  `;
}

export const __previewPaneTesting = {
  clearMermaidCache: () => {
    mermaidSvgCache.clear();
    mermaidFontReadyCache.clear();
    lastMermaidConfigSignature = null;
  },
  clearPreviewMediaCache: () => {
    previewMediaCache.forEach((entry) => URL.revokeObjectURL(entry.objectUrl));
    previewMediaCache.clear();
  },
  getMermaidPreviewBatchSize,
  getPreviewRenderDebounceMs,
  shouldShowPreviewUpdatingStatus,
};

function readClosestSourceLine(element: Element) {
  const sourceElement = element.closest<HTMLElement>('[data-source-line], [data-line]');
  return sourceElement?.getAttribute('data-source-line') ?? sourceElement?.getAttribute('data-line') ?? '';
}

function enhanceKatexErrors(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('.katex-error').forEach((errorElement) => {
    if (errorElement.dataset.previewKatexEnhanced === 'true') return;

    const sourceLine = readClosestSourceLine(errorElement);
    const message = errorElement.getAttribute('title') || t('editor.preview.katexFailed');
    errorElement.dataset.previewKatexEnhanced = 'true';
    errorElement.classList.add('preview-katex-error');
    errorElement.setAttribute('title', message);

    if (!sourceLine) return;

    errorElement.setAttribute('data-preview-source-line', sourceLine);
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'preview-katex-error-action';
    action.dataset.previewSourceLine = sourceLine;
    action.textContent = t('editor.preview.jumpToSource');
    errorElement.insertAdjacentElement('afterend', action);
  });
}

async function waitForDiagramFont(contentTheme: ContentTheme) {
  if (!('fonts' in document)) return;
  const fontLoadFamily = getThemeContract(contentTheme).mermaid.fontLoadFamily;
  const cacheKey = `${contentTheme}:${fontLoadFamily}`;
  let ready = mermaidFontReadyCache.get(cacheKey);
  if (!ready) {
    ready = Promise.all([
      document.fonts.load(`15px ${fontLoadFamily}`),
      document.fonts.ready,
    ]).then(() => undefined, () => undefined);
    mermaidFontReadyCache.set(cacheKey, ready);
  }
  await ready;
}

function waitForPreviewRenderSlot() {
  return new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
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

export function PreviewPane({
  content,
  documentPath,
  renderStrategy = 'deferred',
  onNotice,
  onOpenDocumentLink,
}: PreviewPaneProps) {
  const { locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentTheme, setContentTheme] = useState<ContentTheme>(getCurrentContentTheme);
  const [renderContent, setRenderContent] = useState(content);
  const [renderPending, setRenderPending] = useState(false);
  const [htmlRenderPending, setHtmlRenderPending] = useState(false);
  const [html, setHtml] = useState('');
  const previewFontFamily = useSettingsStore((s) => s.previewFontFamily);
  const previewFontSize = useSettingsStore((s) => s.previewFontSize);

  useEffect(() => {
    if (content === renderContent) {
      setRenderPending(false);
      return;
    }
    if (renderStrategy === 'immediate') {
      setRenderContent(content);
      setRenderPending(false);
      return;
    }
    setRenderPending(true);
    const timer = window.setTimeout(() => {
      setRenderContent(content);
      setRenderPending(false);
    }, getPreviewRenderDebounceMs(content.length));
    return () => window.clearTimeout(timer);
  }, [content, renderContent, renderStrategy]);

  useEffect(() => {
    let cancelled = false;
    setHtmlRenderPending(true);

    markdownRenderService
      .render(renderContent, { frontMatterMode: 'metadata' })
      .then((result) => {
        if (cancelled || result.stale) return;
        setHtml(result.html);
        setHtmlRenderPending(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHtml(`<p>${t('editor.preview.renderFailed')}</p>`);
        setHtmlRenderPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locale, renderContent]);

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
        const wikiTarget = anchor.getAttribute('data-prism-wiki-target')?.trim();
        if (wikiTarget) {
          e.preventDefault();
          if (onOpenDocumentLink) {
            await onOpenDocumentLink(wikiTarget, { kind: 'wiki', sourcePath: documentPath });
          } else {
            onNotice?.(t('editor.preview.linkDocumentUnavailable'));
          }
          return;
        }

        const rawHref = anchor.getAttribute('href')?.trim() ?? '';
        if (!rawHref || rawHref.startsWith('#')) return;

        const externalUrl = getExternalHttpUrl(rawHref, anchor.href);
        if (externalUrl) {
          e.preventDefault();
          try {
            await openExternalUrl(externalUrl);
          } catch {
            onNotice?.(t('editor.preview.openExternalFailed'));
          }
          return;
        }

        if (hasUnsupportedLinkProtocol(rawHref)) {
          e.preventDefault();
          onNotice?.(t('editor.preview.unsupportedLink'));
          return;
        }

        e.preventDefault();
        if (onOpenDocumentLink) {
          await onOpenDocumentLink(rawHref, { kind: 'markdown', sourcePath: documentPath });
        } else {
          onNotice?.(t('editor.preview.localLinkIntercepted'));
        }
      }
    };

    container.addEventListener('click', handleLinkClick);
    return () => container.removeEventListener('click', handleLinkClick);
  }, [documentPath, html, locale, onNotice, onOpenDocumentLink]);

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
        initializeMermaidForPreview(mermaid, mermaidConfig);

        const placeholderList = Array.from(placeholders);
        const batchSize = getMermaidPreviewBatchSize(placeholderList.length);
        let renderedInBatch = 0;

        const yieldAfterBatch = async (index: number) => {
          renderedInBatch += 1;
          if (renderedInBatch < batchSize || index >= placeholderList.length - 1) return;
          renderedInBatch = 0;
          await waitForPreviewRenderSlot();
        };

        void (async () => {
          let renderSandbox: HTMLElement | null = null;

          try {
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
                continue;
              }

              const id = `mermaid-${Date.now()}-${i}`;
              renderSandbox ??= createMermaidRenderSandbox();
              renderSandbox.replaceChildren();

              try {
                const { svg } = await mermaid.render(id, code, renderSandbox);
                if (cancelled) return;
                mermaidSvgCache.set(cacheKey, svg);
                renderMermaidSvg(el, svg);
              } catch (err) {
                if (cancelled) return;
                renderMermaidError(el, err);
              } finally {
                renderSandbox.replaceChildren();
              }

              await yieldAfterBatch(i);
            }
          } finally {
            renderSandbox?.remove();
          }
        })();
      });
    });

    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [html, contentTheme]);

  const showRenderPendingStatus = (renderPending || htmlRenderPending) && shouldShowPreviewUpdatingStatus(content.length);

  return (
    <div
      ref={containerRef}
      className={`preview-compat preview-compat--${contentTheme}`}
      data-preview-render-pending={renderPending || htmlRenderPending ? 'true' : undefined}
    >
      {showRenderPendingStatus && (
        <div className="preview-render-status" role="status">
          {t('editor.preview.updating')}
        </div>
      )}
      <div
        id="write"
        className={getThemeContract(contentTheme).preview.writeClass}
        aria-busy={showRenderPendingStatus ? 'true' : undefined}
        style={{
          fontFamily: previewFontFamily === 'inherit' ? undefined : previewFontFamily,
          fontSize: `${previewFontSize}px`,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
