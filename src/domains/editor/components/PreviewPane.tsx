import { useEffect, useRef, useState } from 'react';
import { readFile, stat } from '../../../platform/tauri/fileSystem';
import { openExternalUrl } from '../../../platform/tauri/opener';
import { ContentTheme, DEFAULT_SETTINGS, isContentTheme } from '../../settings/types';
import { useSettingsStore } from '../../settings/store';
import { getMermaidThemeConfig, getThemeContract } from '../../themes';
import { dirname, joinPath } from '../../workspace/services/path';
import { t, useI18n } from '../../i18n';
import { readExportResource } from '../../export/resources/exportResourceClient';
import {
  collectPreviewDomPostProcessTargets,
  getPreviewDomTargetHints,
  type PreviewDomPostProcessTargets,
} from './previewDomTargets';
import { getMarkmapOptions, getMarkmapPalette } from './markmap';
import { createPlantUmlSvgElement } from './plantUml';
import {
  isPerfInstrumentationEnabled,
  markPerf,
  markPerfDuration,
} from '../../../lib/performanceInstrumentation';

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
const PREVIEW_AUTO_CODE_HIGHLIGHT_LIMIT = PREVIEW_RENDER_LARGE_DOC_LIMIT;
const PREVIEW_RENDER_SMALL_DEBOUNCE_MS = 120;
const PREVIEW_RENDER_MEDIUM_DEBOUNCE_MS = 220;
const PREVIEW_RENDER_LARGE_DEBOUNCE_MS = 600;
const PREVIEW_KATEX_BATCH_THRESHOLD = 24;
const PREVIEW_KATEX_BATCH_SIZE = 12;
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
let katexModulePromise: Promise<typeof import('katex')> | null = null;
let mermaidModulePromise: Promise<typeof import('mermaid')> | null = null;
let markmapTransformerPromise: Promise<typeof import('markmap-lib')['Transformer']> | null = null;
let markmapViewPromise: Promise<typeof import('markmap-view')['Markmap']> | null = null;
let markdownRenderServicePromise: Promise<typeof import('../../../lib/markdownRenderService')['markdownRenderService']> | null = null;

function decodeHashAnchor(rawHref: string) {
  const rawHash = rawHref.trim().replace(/^#/, '');
  if (!rawHash) return '';
  try {
    return decodeURIComponent(rawHash);
  } catch {
    return rawHash;
  }
}

function findHashAnchorTarget(container: HTMLElement, rawHref: string) {
  const decodedHash = decodeHashAnchor(rawHref);
  if (!decodedHash) return null;
  const rawHash = rawHref.trim().replace(/^#/, '');
  return Array.from(container.querySelectorAll<HTMLElement>('[id], a[name]')).find((element) => (
    element.id === decodedHash
    || element.id === rawHash
    || element.getAttribute('name') === decodedHash
    || element.getAttribute('name') === rawHash
  )) ?? null;
}

function scrollToHashAnchor(container: HTMLElement, rawHref: string) {
  const target = findHashAnchorTarget(container, rawHref);
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  return true;
}

function getPreviewRenderDebounceMs(contentLength: number) {
  if (contentLength > PREVIEW_RENDER_LARGE_DOC_LIMIT) return PREVIEW_RENDER_LARGE_DEBOUNCE_MS;
  if (contentLength > PREVIEW_RENDER_SMALL_DOC_LIMIT) return PREVIEW_RENDER_MEDIUM_DEBOUNCE_MS;
  return PREVIEW_RENDER_SMALL_DEBOUNCE_MS;
}

function loadMarkmapTransformer() {
  markmapTransformerPromise ??= import('markmap-lib').then((module) => module.Transformer);
  return markmapTransformerPromise;
}

function loadMarkmapView() {
  markmapViewPromise ??= import('markmap-view').then((module) => module.Markmap);
  return markmapViewPromise;
}

function shouldShowPreviewUpdatingStatus(contentLength: number) {
  return contentLength > PREVIEW_RENDER_LARGE_DOC_LIMIT;
}

function getPreviewMarkdownRenderOptions(contentLength: number) {
  const options: {
    frontMatterMode: 'metadata';
    autoDetectUnlabeledCode?: boolean;
    highlightCode?: boolean;
    lightweightTables?: boolean;
    renderMath?: boolean;
  } = {
    frontMatterMode: 'metadata',
  };
  if (contentLength > PREVIEW_AUTO_CODE_HIGHLIGHT_LIMIT) {
    options.autoDetectUnlabeledCode = false;
    options.highlightCode = false;
    options.lightweightTables = true;
    options.renderMath = false;
  }
  return options;
}

function getKatexPreviewBatchSize(placeholderCount: number) {
  return placeholderCount > PREVIEW_KATEX_BATCH_THRESHOLD ? PREVIEW_KATEX_BATCH_SIZE : 1;
}

function getMermaidPreviewBatchSize(placeholderCount: number) {
  return placeholderCount > PREVIEW_MERMAID_BATCH_THRESHOLD ? PREVIEW_MERMAID_BATCH_SIZE : 1;
}

function loadKatexModule() {
  if (!katexModulePromise) {
    katexModulePromise = import('katex').catch((error) => {
      katexModulePromise = null;
      throw error;
    });
  }
  return katexModulePromise;
}

function loadMermaidModule() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').catch((error) => {
      mermaidModulePromise = null;
      throw error;
    });
  }
  return mermaidModulePromise;
}

function loadMarkdownRenderService() {
  if (!markdownRenderServicePromise) {
    markdownRenderServicePromise = import('../../../lib/markdownRenderService')
      .then(({ markdownRenderService }) => markdownRenderService)
      .catch((error) => {
        markdownRenderServicePromise = null;
        throw error;
      });
  }
  return markdownRenderServicePromise;
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function roundTimingMs(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.round(value * 10) / 10;
}

function shouldLogPreviewPerformance() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem('prism.previewPerf') === '1';
  } catch {
    return false;
  }
}

function logPreviewPerformance(stage: string, data: Record<string, unknown>) {
  if (!shouldLogPreviewPerformance()) return;

  const normalized = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'number' ? roundTimingMs(value) : value,
    ]),
  );
  console.debug('[Prism preview perf]', { stage, ...normalized });
}

function schedulePreviewTask(
  callback: () => void,
  options: { immediate?: boolean; timeout?: number } = {},
) {
  const win = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (options.immediate) {
    const id = win.setTimeout(callback, 0);
    return () => win.clearTimeout(id);
  }

  if (typeof win.requestIdleCallback === 'function') {
    const id = win.requestIdleCallback(callback, { timeout: options.timeout ?? 250 });
    return () => {
      if (typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(id);
      }
    };
  }

  const id = win.setTimeout(callback, 0);
  return () => win.clearTimeout(id);
}

function waitForNextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function waitForElementLayout(element: Element) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForNextAnimationFrame();
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return;
  }
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

function getPreviewDocumentLinkTarget(anchor: HTMLAnchorElement) {
  const wikiTarget = anchor.getAttribute('data-prism-wiki-target')?.trim();
  if (wikiTarget) {
    return { kind: 'wiki' as const, target: wikiTarget };
  }

  const rawHref = anchor.getAttribute('href')?.trim() ?? '';
  if (!rawHref || rawHref.startsWith('#')) return null;
  if (getExternalHttpUrl(rawHref, anchor.href)) return null;
  if (hasUnsupportedLinkProtocol(rawHref)) return null;
  return { kind: 'markdown' as const, target: rawHref };
}

function resolvePreviewMediaPath(rawSrc: string, documentPath?: string) {
  const src = safeDecodePreviewMediaSrc(stripPreviewMediaSrcMetadata(rawSrc.trim()));
  if (!src || !documentPath || src.startsWith('#') || src.startsWith('?')) return null;
  if (isExternalMediaSrc(src)) return null;
  if (src.startsWith('/')) return src;
  if (isWindowsAbsolutePath(src)) return src;
  return joinPath(dirname(documentPath), src);
}

function stripPreviewMediaSrcMetadata(src: string) {
  const hashIndex = src.indexOf('#');
  const queryIndex = src.indexOf('?');
  const indexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  return indexes.length > 0 ? src.slice(0, Math.min(...indexes)) : src;
}

function safeDecodePreviewMediaSrc(src: string) {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
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

async function readPreviewMedia(
  filePath: string,
  rawSrc: string,
  documentPath: string | undefined,
) {
  try {
    return {
      bytes: await readFile(filePath),
      mimeType: getPreviewMediaMimeType(filePath),
    };
  } catch (fileSystemError) {
    if (documentPath) {
      const resource = await readExportResource({
        rawSrc,
        documentPath,
      });
      if (resource) {
        return {
          bytes: resource.bytes,
          mimeType: resource.mimeType || getPreviewMediaMimeType(resource.path || filePath),
        };
      }
    }
    throw fileSystemError;
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
  mediaElements: Array<HTMLImageElement | HTMLSourceElement>,
  documentPath: string | undefined,
  options: {
    isCancelled: () => boolean;
    trackObjectUrl: (url: string) => void;
  },
) {
  if (!documentPath || mediaElements.length === 0) return;

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
      const rawSrc = rawSrcByElement.get(elements[0]) ?? filePath;
      const { bytes, mimeType } = await readPreviewMedia(filePath, rawSrc, documentPath);
      if (options.isCancelled()) return;

      const objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
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

function getMermaidDisplayScale(contentTheme: ContentTheme) {
  void contentTheme;
  return 1;
}

function renderMermaidSvg(container: HTMLElement, svg: string, contentTheme: ContentTheme) {
  container.classList.remove('mermaid-placeholder--failed');
  container.innerHTML = svg;
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.removeProperty('margin');
  const svgEl = container.querySelector('svg');
  if (svgEl) {
    requestAnimationFrame(() => normalizeMermaidSvg(svgEl, contentTheme));
  }
}

function parsePositiveSvgNumber(value: string | null | undefined) {
  if (!value || value.trim().endsWith('%')) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getSvgViewBoxSize(svg: SVGSVGElement) {
  const viewBox = svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4) return null;
  const [x, y, width, height] = viewBox;
  if (!viewBox.every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function getMermaidSvgNaturalSize(svg: SVGSVGElement) {
  const viewBoxSize = getSvgViewBoxSize(svg);
  if (viewBoxSize) return viewBoxSize;

  const attrWidth = parsePositiveSvgNumber(svg.getAttribute('width'));
  const attrHeight = parsePositiveSvgNumber(svg.getAttribute('height'));
  if (attrWidth && attrHeight) {
    return { x: 0, y: 0, width: attrWidth, height: attrHeight };
  }

  const styleWidth = parsePositiveSvgNumber(svg.style.width);
  const styleHeight = parsePositiveSvgNumber(svg.style.height);
  if (styleWidth && styleHeight) {
    return { x: 0, y: 0, width: styleWidth, height: styleHeight };
  }

  return null;
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

function renderPlantUmlError(container: HTMLElement, error: unknown) {
  const sourceLine = container.getAttribute('data-source-line') ?? container.getAttribute('data-line') ?? '';
  const sourceAction = sourceLine
    ? `<button type="button" data-preview-source-line="${escapeHtml(sourceLine)}">${escapeHtml(t('editor.preview.jumpToSource'))}</button>`
    : '';

  container.classList.add('plantuml-placeholder--failed');
  container.innerHTML = `
    <div class="preview-render-error" role="note" data-render-kind="plantuml">
      <div class="preview-render-error-main">
        <div class="preview-render-error-title">${escapeHtml(t('editor.preview.plantUmlFailed'))}</div>
        <div class="preview-render-error-message">${escapeHtml(formatRenderError(error))}</div>
      </div>
      <div class="preview-render-error-actions">
        ${sourceLine ? `<span>${escapeHtml(t('editor.preview.sourceLine', { line: sourceLine }))}</span>` : ''}
        ${sourceAction}
      </div>
    </div>
  `;
}

function renderMarkmapError(container: HTMLElement, error: unknown) {
  const sourceLine = container.getAttribute('data-source-line') ?? container.getAttribute('data-line') ?? '';
  const sourceAction = sourceLine
    ? `<button type="button" data-preview-source-line="${escapeHtml(sourceLine)}">${escapeHtml(t('editor.preview.jumpToSource'))}</button>`
    : '';

  container.classList.add('markmap-placeholder--failed');
  container.innerHTML = `
    <div class="preview-render-error" role="note" data-render-kind="markmap">
      <div class="preview-render-error-main">
        <div class="preview-render-error-title">${escapeHtml(t('editor.preview.markmapFailed'))}</div>
        <div class="preview-render-error-message">${escapeHtml(formatRenderError(error))}</div>
      </div>
      <div class="preview-render-error-actions">
        ${sourceLine ? `<span>${escapeHtml(t('editor.preview.sourceLine', { line: sourceLine }))}</span>` : ''}
        ${sourceAction}
      </div>
    </div>
  `;
}

interface StaticMarkmapNode {
  content?: string;
  children?: StaticMarkmapNode[];
}

interface StaticMarkmapLayoutNode {
  depth: number;
  height: number;
  node: StaticMarkmapNode;
  parent: StaticMarkmapLayoutNode | null;
  text: string;
  width: number;
  x: number;
  y: number;
}

function shouldUseStaticMarkmapRenderer() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent;
  const isAppleWebKit = /\bAppleWebKit\b/i.test(userAgent);
  const isChromium = /\b(?:HeadlessChrome|Chrome|Chromium|CriOS|Edg|OPR)\//i.test(userAgent);
  const isFirefox = /\bFirefox\//i.test(userAgent);
  const isSafariLike = /\bSafari\//i.test(userAgent) || /\bVersion\/[\d.]+/i.test(userAgent);
  const isTauriWebView = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return isAppleWebKit && !isChromium && !isFirefox && (isSafariLike || isTauriWebView);
}

function getMarkmapPlainText(content: string | undefined) {
  if (!content) return '';
  const template = document.createElement('template');
  template.innerHTML = content;
  return (template.content.textContent || template.innerText || content)
    .replace(/\s+/g, ' ')
    .trim();
}

function measureStaticMarkmapText(text: string, depth: number, compact: boolean) {
  const normalizedLength = [...text].reduce((total, char) => (
    total + (char.charCodeAt(0) > 255 ? 1.1 : 0.58)
  ), 0);
  const minWidth = compact ? (depth === 0 ? 96 : 68) : (depth === 0 ? 120 : 88);
  const maxWidth = compact ? 180 : 220;
  const charWidth = compact ? 12 : 14;
  const padding = compact ? 16 : 24;
  return Math.max(minWidth, Math.min(maxWidth, Math.ceil(normalizedLength * charWidth) + padding));
}

function createStaticMarkmapLayout(root: StaticMarkmapNode, compact: boolean) {
  const rowGap = compact ? 28 : 38;
  const columnGap = compact ? 176 : 236;
  const paddingX = compact ? 24 : 32;
  const paddingY = compact ? 26 : 36;
  const nodes: StaticMarkmapLayoutNode[] = [];
  let leafIndex = 0;
  let maxDepth = 0;

  function visit(node: StaticMarkmapNode, depth: number, parent: StaticMarkmapLayoutNode | null): StaticMarkmapLayoutNode {
    const text = getMarkmapPlainText(node.content) || t('common.untitled');
    const children = node.children ?? [];
    const layoutNode: StaticMarkmapLayoutNode = {
      depth,
      height: compact ? (depth === 0 ? 24 : 20) : (depth === 0 ? 30 : 26),
      node,
      parent,
      text,
      width: measureStaticMarkmapText(text, depth, compact),
      x: paddingX + depth * columnGap,
      y: paddingY,
    };

    nodes.push(layoutNode);
    maxDepth = Math.max(maxDepth, depth);

    if (children.length === 0) {
      layoutNode.y = paddingY + leafIndex * rowGap;
      leafIndex += 1;
      return layoutNode;
    }

    const childLayouts = children.map((child) => visit(child, depth + 1, layoutNode));
    layoutNode.y = (childLayouts[0].y + childLayouts[childLayouts.length - 1].y) / 2;
    return layoutNode;
  }

  visit(root, 0, null);

  const contentWidth = paddingX * 2 + (maxDepth + 1) * columnGap + (compact ? 120 : 180);
  const contentHeight = Math.max(450, paddingY * 2 + Math.max(leafIndex - 1, 0) * rowGap + (compact ? 28 : 36));
  return {
    height: contentHeight,
    nodes,
    width: Math.max(compact ? 720 : 900, contentWidth),
  };
}

function renderStaticMarkmapSvg(
  svg: SVGSVGElement,
  root: StaticMarkmapNode,
  contentTheme: ContentTheme,
) {
  const palette = getMarkmapPalette(contentTheme);
  const compact = contentTheme === 'miaoyan';
  const layout = createStaticMarkmapLayout(root, compact);

  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('data-markmap-renderer', 'static');

  const edges = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edges.setAttribute('class', 'markmap-edges');
  edges.setAttribute('fill', 'none');
  edges.setAttribute('stroke-linecap', 'round');
  svg.append(edges);

  const nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodeLayer.setAttribute('class', 'markmap-nodes');
  svg.append(nodeLayer);

  for (const node of layout.nodes) {
    if (!node.parent) continue;
    const stroke = palette[node.depth % palette.length] ?? palette[0];
    const startX = node.parent.x + node.parent.width + 8;
    const startY = node.parent.y;
    const endX = node.x - 14;
    const endY = node.y;
    const midX = (startX + endX) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'markmap-link');
    path.setAttribute('d', `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', compact ? (node.depth === 1 ? '1.1' : '0.9') : (node.depth === 1 ? '1.6' : '1.2'));
    path.setAttribute('opacity', node.depth === 1 ? '0.9' : '0.68');
    edges.append(path);
  }

  for (const node of layout.nodes) {
    const color = palette[node.depth % palette.length] ?? palette[0];
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'markmap-node');
    group.setAttribute('transform', `translate(${node.x} ${node.y})`);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = node.text;
    text.setAttribute('x', '0');
    text.setAttribute('y', '0');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', 'currentColor');
    text.setAttribute('font-size', compact ? (node.depth === 0 ? '13' : '12') : (node.depth === 0 ? '16' : '14'));
    text.setAttribute('font-weight', node.depth <= 1 ? '600' : '400');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", Arial, sans-serif');
    group.append(text);

    const underline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    underline.setAttribute('x1', '0');
    underline.setAttribute('x2', String(node.width));
    underline.setAttribute('y1', String(node.height / 2));
    underline.setAttribute('y2', String(node.height / 2));
    underline.setAttribute('stroke', color);
    underline.setAttribute('stroke-width', compact ? (node.depth === 0 ? '1.4' : '1') : (node.depth === 0 ? '2' : '1.3'));
    underline.setAttribute('opacity', node.depth === 0 ? '0.95' : '0.68');
    group.append(underline);

    if (node.node.children?.length) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(node.width + 8));
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', compact ? (node.depth === 0 ? '2.4' : '1.8') : (node.depth === 0 ? '3.2' : '2.5'));
      circle.setAttribute('fill', color);
      circle.setAttribute('opacity', '0.85');
      group.append(circle);
    }

    nodeLayer.append(group);
  }
}

async function renderMarkmapDiagram(
  container: HTMLElement,
  source: string,
  contentTheme: ContentTheme,
  isCancelled: () => boolean,
) {
  container.classList.remove('markmap-placeholder--failed');
  container.setAttribute('aria-busy', 'true');
  container.style.removeProperty('margin');

  try {
    const Transformer = await loadMarkmapTransformer();
    if (isCancelled()) return;

    const transformer = new Transformer();
    const { root } = transformer.transform(source);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('markmap-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Markmap diagram');
    const markmapHeight = 450;
    const markmapWidth = 900;
    const markmapViewBox = `0 0 ${markmapWidth} ${markmapHeight}`;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', String(markmapHeight));
    svg.setAttribute('viewBox', markmapViewBox);
    svg.style.width = '100%';
    svg.style.height = `${markmapHeight}px`;
    svg.style.minHeight = `${markmapHeight}px`;
    svg.style.display = 'block';
    svg.style.overflow = 'visible';

    container.replaceChildren(svg);
    if (shouldUseStaticMarkmapRenderer()) {
      renderStaticMarkmapSvg(svg, root, contentTheme);
      container.removeAttribute('aria-busy');
      return;
    }

    const Markmap = await loadMarkmapView();
    if (isCancelled()) return;

    const markmap = Markmap.create(svg, getMarkmapOptions(contentTheme));
    await markmap.setData(root);
    await waitForElementLayout(svg);

    if (isCancelled()) {
      markmap.destroy?.();
      return;
    }

    await markmap.fit?.();

    if (!svg.querySelector('.markmap-node')) {
      throw new Error('Markmap rendered no visible nodes');
    }

    container.removeAttribute('aria-busy');
  } catch (error) {
    if (isCancelled()) return;
    renderMarkmapError(container, error);
    container.removeAttribute('aria-busy');
  }
}

async function renderPlantUmlImageForCompletion(
  container: HTMLElement,
  source: string,
  contentTheme: ContentTheme,
  documentPath: string | undefined,
  isCancelled: () => boolean,
) {
  try {
    container.classList.remove('plantuml-placeholder--failed');
    container.setAttribute('aria-busy', 'true');
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.removeProperty('margin');

    const svg = await createPlantUmlSvgElement(source, contentTheme, { documentPath });
    if (isCancelled()) return;
    container.replaceChildren(svg);
    container.removeAttribute('aria-busy');
  } catch (error) {
    if (isCancelled()) return;
    renderPlantUmlError(container, error);
    container.removeAttribute('aria-busy');
  }
}

function withPreviewKatexDisplaySourceLine(html: string, sourceLine: string) {
  if (!sourceLine) return html;
  const escapedLine = escapeHtml(sourceLine);
  return html.replace(
    '<span class="katex-display"',
    `<span class="katex-display" data-source-line="${escapedLine}" data-line="${escapedLine}"`,
  );
}

function renderPreviewKatexHtml(
  katex: typeof import('katex'),
  value: string,
  displayMode: boolean,
  sourceLine: string,
) {
  let html: string;

  try {
    html = katex.default.renderToString(value, {
      displayMode,
      throwOnError: true,
    });
  } catch (error) {
    try {
      html = katex.default.renderToString(value, {
        displayMode,
        strict: 'ignore',
        throwOnError: false,
      });
    } catch {
      html = `<span class="katex-error" style="color:#cc0000" title="${escapeHtml(formatRenderError(error))}">${escapeHtml(value)}</span>`;
    }
  }

  return displayMode ? withPreviewKatexDisplaySourceLine(html, sourceLine) : html;
}

function replaceKatexPlaceholder(
  placeholder: HTMLElement,
  html: string,
) {
  const parent = placeholder.parentElement;
  const template = document.createElement('template');
  template.innerHTML = html;
  placeholder.replaceWith(template.content);
  if (!parent) return;
  enhanceKatexErrors(Array.from(parent.querySelectorAll<HTMLElement>('.katex-error')));
}

export const __previewPaneTesting = {
  clearKatexCache: () => {
    katexModulePromise = null;
  },
  clearMermaidCache: () => {
    mermaidSvgCache.clear();
    mermaidFontReadyCache.clear();
    mermaidModulePromise = null;
    lastMermaidConfigSignature = null;
  },
  clearMarkmapCache: () => {
    markmapTransformerPromise = null;
    markmapViewPromise = null;
  },
  clearPreviewMediaCache: () => {
    previewMediaCache.forEach((entry) => URL.revokeObjectURL(entry.objectUrl));
    previewMediaCache.clear();
  },
  getKatexPreviewBatchSize,
  getMermaidDisplayScale,
  getMermaidPreviewBatchSize,
  getPreviewMarkdownRenderOptions,
  getPreviewRenderDebounceMs,
  shouldShowPreviewUpdatingStatus,
};

function readClosestSourceLine(element: Element) {
  const sourceElement = element.closest<HTMLElement>('[data-source-line], [data-line]');
  return sourceElement?.getAttribute('data-source-line') ?? sourceElement?.getAttribute('data-line') ?? '';
}

function enhanceKatexErrors(errorElements: HTMLElement[]) {
  errorElements.forEach((errorElement) => {
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

function normalizeMermaidSvg(svg: SVGSVGElement, contentTheme: ContentTheme) {
  const displayScale = getMermaidDisplayScale(contentTheme);
  svg.style.display = 'block';
  svg.style.marginInline = 'auto';
  svg.style.maxWidth = contentTheme === 'miaoyan' ? 'min(100%, 920px)' : '100%';
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
    label.style.lineHeight = '1.2';
  });

  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      const padding = 12;
      const x = Math.floor(box.x - padding);
      const y = Math.floor(box.y - padding);
      const width = Math.ceil(box.width + padding * 2);
      const height = Math.ceil(box.height + padding * 2);
      svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.style.width = `${Math.ceil(width * displayScale)}px`;
      svg.style.maxWidth = contentTheme === 'miaoyan' ? 'min(100%, 920px)' : '100%';
      svg.style.height = 'auto';
      return;
    }
  } catch {
    // Some SVGs can throw while fonts/images settle; CSS overflow still prevents most clipping.
  }

  const naturalSize = getMermaidSvgNaturalSize(svg);
  if (!naturalSize) return;
  const width = Math.ceil(naturalSize.width);
  const height = Math.ceil(naturalSize.height);
  svg.setAttribute('viewBox', `${naturalSize.x} ${naturalSize.y} ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.style.width = `${Math.ceil(width * displayScale)}px`;
  svg.style.maxWidth = contentTheme === 'miaoyan' ? 'min(100%, 920px)' : '100%';
  svg.style.height = 'auto';
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
  const pointerHandledDocumentLinkRef = useRef<{ anchor: HTMLAnchorElement; timestamp: number } | null>(null);
  const [contentTheme, setContentTheme] = useState<ContentTheme>(getCurrentContentTheme);
  const [renderContent, setRenderContent] = useState(content);
  const [renderPending, setRenderPending] = useState(false);
  const [htmlRenderPending, setHtmlRenderPending] = useState(false);
  const [html, setHtml] = useState('');
  const domTargetsRef = useRef<{
    targets: PreviewDomPostProcessTargets;
    write: HTMLElement;
  } | null>(null);
  const previewFontFamily = useSettingsStore((s) => s.previewFontFamily);
  const previewFontSize = useSettingsStore((s) => s.previewFontSize);
  const themeContract = getThemeContract(contentTheme);
  const effectivePreviewFontSize = previewFontSize === DEFAULT_SETTINGS.previewFontSize
    ? themeContract.preview.fontSize
    : previewFontSize;

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
    const renderStartedAt = nowMs();

    loadMarkdownRenderService()
      .then((markdownRenderService) => (
        markdownRenderService.render(renderContent, getPreviewMarkdownRenderOptions(renderContent.length))
      ))
      .then((result) => {
        if (cancelled || result.stale) return;
        logPreviewPerformance('markdown', {
          contentLength: renderContent.length,
          htmlLength: result.html.length,
          mode: result.timing.mode,
          markdownToHtmlMs: result.timing.markdownToHtmlMs,
          renderElapsedMs: result.timing.elapsedMs,
          requestToStateMs: nowMs() - renderStartedAt,
        });
        markPerfDuration('preview_markdown_render', result.timing.elapsedMs, {
          contentLength: renderContent.length,
          htmlLength: result.html.length,
          mode: result.timing.mode,
          markdownToHtmlMs: result.timing.markdownToHtmlMs,
        });
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

  // DOM commit 归因：本 effect 在 React 把 html 写入 #write 之后运行，
  // 因此 preview_dom_committed 是 commit 完成点；随后两帧 rAF 近似首次绘制。
  // CONTEXT.md 要求先证明 DOM commit 是否为瓶颈，才可改渲染策略。
  useEffect(() => {
    if (!html) return;
    if (!isPerfInstrumentationEnabled()) return;
    markPerf('preview_dom_committed', { htmlLength: html.length });
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        markPerf('preview_painted', { htmlLength: html.length });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [html]);

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
    const scheduledAt = nowMs();
    domTargetsRef.current = null;

    const cancelScheduledPostProcess = schedulePreviewTask(() => {
      if (cancelled) return;
      const write = containerRef.current?.querySelector<HTMLElement>('#write');
      if (!write) return;

      const postProcessStartedAt = nowMs();
      const targetHints = getPreviewDomTargetHints(html, documentPath);
      const scanStartedAt = nowMs();
      const targets = collectPreviewDomPostProcessTargets(write, targetHints);
      const targetScanMs = nowMs() - scanStartedAt;
      domTargetsRef.current = { write, targets };
      const katexPlaceholderCount = targets.katexPlaceholders.length;
      const mediaCount = targets.mediaElements.length;
      const katexErrorCount = targets.katexErrorElements.length;
      const plantUmlPlaceholderCount = targets.plantUmlPlaceholders.length;
      const katexStartedAt = nowMs();
      enhanceKatexErrors(targets.katexErrorElements);
      const katexMs = nowMs() - katexStartedAt;
      const mediaStartedAt = nowMs();
      void resolveLocalPreviewMedia(targets.mediaElements, documentPath, {
        isCancelled: () => cancelled,
        trackObjectUrl: (url) => objectUrls.push(url),
      }).finally(() => {
        if (cancelled) return;
        logPreviewPerformance('dom-postprocess', {
          htmlLength: html.length,
          katexPlaceholderCount,
          mediaCount,
          katexErrorCount,
          plantUmlPlaceholderCount,
          targetScanMs,
          katexMs,
          mediaMs: nowMs() - mediaStartedAt,
          scheduleDelayMs: postProcessStartedAt - scheduledAt,
          elapsedMs: nowMs() - postProcessStartedAt,
        });
        markPerfDuration('preview_post_process', nowMs() - postProcessStartedAt, {
          htmlLength: html.length,
          targetScanMs: roundTimingMs(targetScanMs),
          katexMs: roundTimingMs(katexMs),
          mediaMs: roundTimingMs(nowMs() - mediaStartedAt),
          scheduleDelayMs: roundTimingMs(postProcessStartedAt - scheduledAt),
          katexPlaceholderCount,
          mediaCount,
          plantUmlPlaceholderCount,
        });
      });
    }, { immediate: renderStrategy === 'immediate', timeout: 320 });

    return () => {
      cancelled = true;
      cancelScheduledPostProcess();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [html, documentPath, renderStrategy]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const openDocumentLink = async (
      e: MouseEvent | PointerEvent,
      documentLink: { kind: 'markdown' | 'wiki'; target: string },
    ) => {
      e.preventDefault();
      e.stopPropagation();
      if (onOpenDocumentLink) {
        await onOpenDocumentLink(documentLink.target, { kind: documentLink.kind, sourcePath: documentPath });
        return;
      }

      onNotice?.(documentLink.kind === 'wiki'
        ? t('editor.preview.linkDocumentUnavailable')
        : t('editor.preview.localLinkIntercepted'));
    };

    const handleDocumentLinkPointerUp = async (e: PointerEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor || !anchor.href) return;
      const documentLink = getPreviewDocumentLinkTarget(anchor);
      if (!documentLink) return;

      pointerHandledDocumentLinkRef.current = { anchor, timestamp: performance.now() };
      await openDocumentLink(e, documentLink);
    };

    const handleLinkClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.href) {
        const pointerHandled = pointerHandledDocumentLinkRef.current;
        if (
          pointerHandled?.anchor === anchor
          && performance.now() - pointerHandled.timestamp < 1000
        ) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const wikiTarget = anchor.getAttribute('data-prism-wiki-target')?.trim();
        if (wikiTarget) {
          await openDocumentLink(e, { kind: 'wiki', target: wikiTarget });
          return;
        }

        const rawHref = anchor.getAttribute('href')?.trim() ?? '';
        if (!rawHref) return;
        if (rawHref.startsWith('#')) {
          if (scrollToHashAnchor(container, rawHref)) {
            e.preventDefault();
          }
          return;
        }

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

        await openDocumentLink(e, { kind: 'markdown', target: rawHref });
      }
    };

    container.addEventListener('pointerup', handleDocumentLinkPointerUp);
    container.addEventListener('click', handleLinkClick);
    return () => {
      container.removeEventListener('pointerup', handleDocumentLinkPointerUp);
      container.removeEventListener('click', handleLinkClick);
    };
  }, [documentPath, html, locale, onNotice, onOpenDocumentLink]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!getPreviewDomTargetHints(html).katexPlaceholders) return;
    let cancelled = false;
    const cancelScheduledRender = schedulePreviewTask(() => {
      if (cancelled) return;
      const write = container.querySelector<HTMLElement>('#write');
      if (!write) return;
      const targets = domTargetsRef.current?.write === write
        ? domTargetsRef.current.targets
        : collectPreviewDomPostProcessTargets(write, {
            katexPlaceholders: true,
            media: false,
            katexErrors: false,
            mermaid: false,
            markmap: false,
            plantUml: false,
          });
      const placeholderList = targets.katexPlaceholders;
      if (placeholderList.length === 0) return;

      const katexModule = loadKatexModule();
      katexModule.then((katex) => {
        if (cancelled) return;
        const batchSize = getKatexPreviewBatchSize(placeholderList.length);
        let renderedInBatch = 0;

        const yieldAfterBatch = async (index: number) => {
          renderedInBatch += 1;
          if (renderedInBatch < batchSize || index >= placeholderList.length - 1) return;
          renderedInBatch = 0;
          await waitForPreviewRenderSlot();
        };

        void (async () => {
          const katexStartedAt = nowMs();
          let renderedCount = 0;
          let failedCount = 0;

          for (const [i, placeholder] of placeholderList.entries()) {
            if (cancelled) return;
            if (!placeholder.isConnected) continue;

            const encoded = placeholder.getAttribute('data-katex');
            if (!encoded) continue;

            const value = decodeURIComponent(encoded);
            const displayMode = placeholder.getAttribute('data-katex-display') === 'true';
            const sourceLine = placeholder.getAttribute('data-source-line') ?? readClosestSourceLine(placeholder);
            const nextHtml = renderPreviewKatexHtml(katex, value, displayMode, sourceLine);
            if (nextHtml.includes('katex-error')) {
              failedCount += 1;
            } else {
              renderedCount += 1;
            }
            replaceKatexPlaceholder(placeholder, nextHtml);
            await yieldAfterBatch(i);
          }

          logPreviewPerformance('katex', {
            formulaCount: placeholderList.length,
            renderedCount,
            failedCount,
            elapsedMs: nowMs() - katexStartedAt,
          });
        })();
      });
    }, { immediate: renderStrategy === 'immediate', timeout: 260 });

    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [html, renderStrategy]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!getPreviewDomTargetHints(html).mermaid) return;
    let cancelled = false;
    const cancelScheduledRender = schedulePreviewTask(() => {
      if (cancelled) return;
      const write = container.querySelector<HTMLElement>('#write');
      if (!write) return;
      const targets = domTargetsRef.current?.write === write
        ? domTargetsRef.current.targets
        : collectPreviewDomPostProcessTargets(write, {
            katexPlaceholders: false,
            media: false,
            katexErrors: false,
            mermaid: true,
            markmap: false,
            plantUml: false,
          });
      const placeholderList = targets.mermaidPlaceholders;
      if (placeholderList.length === 0) return;

      const mermaidConfig = getMermaidThemeConfig(contentTheme);
      const mermaidModule = loadMermaidModule();

      mermaidModule.then(({ default: mermaid }) => {
        if (cancelled) return;
        initializeMermaidForPreview(mermaid, mermaidConfig);

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
          const mermaidStartedAt = nowMs();
          let fontWaitMs = 0;
          let cachedCount = 0;
          let renderedCount = 0;
          let failedCount = 0;

          try {
            const fontStartedAt = nowMs();
            await waitForDiagramFont(contentTheme);
            fontWaitMs = nowMs() - fontStartedAt;

            for (const [i, placeholder] of placeholderList.entries()) {
              if (cancelled) return;
              const el = placeholder as HTMLElement;
              const encoded = el.getAttribute('data-mermaid');
              if (!encoded) continue;

              const code = decodeURIComponent(encoded);
              const cacheKey = getMermaidCacheKey(contentTheme, code);
              const cachedSvg = mermaidSvgCache.get(cacheKey);
              if (cachedSvg) {
                cachedCount += 1;
                renderMermaidSvg(el, cachedSvg, contentTheme);
                continue;
              }

              const id = `mermaid-${Date.now()}-${i}`;
              renderSandbox ??= createMermaidRenderSandbox();
              renderSandbox.replaceChildren();

              try {
                const { svg } = await mermaid.render(id, code, renderSandbox);
                if (cancelled) return;
                mermaidSvgCache.set(cacheKey, svg);
                renderedCount += 1;
                renderMermaidSvg(el, svg, contentTheme);
              } catch (err) {
                if (cancelled) return;
                failedCount += 1;
                renderMermaidError(el, err);
              } finally {
                renderSandbox.replaceChildren();
              }

              await yieldAfterBatch(i);
            }

            logPreviewPerformance('mermaid', {
              contentTheme,
              diagramCount: placeholderList.length,
              cachedCount,
              renderedCount,
              failedCount,
              fontWaitMs,
              elapsedMs: nowMs() - mermaidStartedAt,
            });
          } finally {
            renderSandbox?.remove();
          }
        })();
      });
    }, { immediate: renderStrategy === 'immediate', timeout: 300 });

    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [html, contentTheme, renderStrategy]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!getPreviewDomTargetHints(html).markmap) return;
    let cancelled = false;
    const cancelScheduledRender = schedulePreviewTask(() => {
      if (cancelled) return;
      const write = container.querySelector<HTMLElement>('#write');
      if (!write) return;
      const targets = domTargetsRef.current?.write === write
        ? domTargetsRef.current.targets
        : collectPreviewDomPostProcessTargets(write, {
            katexPlaceholders: false,
            media: false,
            katexErrors: false,
            mermaid: false,
            markmap: true,
            plantUml: false,
          });
      const placeholderList = targets.markmapPlaceholders;
      if (placeholderList.length === 0) return;

      const markmapStartedAt = nowMs();
      let renderedCount = 0;

      for (const placeholder of placeholderList) {
        if (cancelled) return;
        if (!placeholder.isConnected) continue;

        const encoded = placeholder.getAttribute('data-markmap');
        if (!encoded) continue;

        const code = decodeURIComponent(encoded);
        void renderMarkmapDiagram(placeholder, code, contentTheme, () => cancelled);
        renderedCount += 1;
      }

      logPreviewPerformance('markmap', {
        contentTheme,
        diagramCount: placeholderList.length,
        renderedCount,
        elapsedMs: nowMs() - markmapStartedAt,
      });
    }, { immediate: renderStrategy === 'immediate', timeout: 300 });

    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [html, contentTheme, renderStrategy]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!getPreviewDomTargetHints(html).plantUml) return;
    let cancelled = false;
    const cancelScheduledRender = schedulePreviewTask(() => {
      if (cancelled) return;
      const write = container.querySelector<HTMLElement>('#write');
      if (!write) return;
      const targets = domTargetsRef.current?.write === write
        ? domTargetsRef.current.targets
        : collectPreviewDomPostProcessTargets(write, {
            katexPlaceholders: false,
            media: false,
            katexErrors: false,
            mermaid: false,
            markmap: false,
            plantUml: true,
          });
      const placeholderList = targets.plantUmlPlaceholders;
      if (placeholderList.length === 0) return;

      void (async () => {
        const plantUmlStartedAt = nowMs();
        let renderedCount = 0;

        await Promise.all(placeholderList.map(async (placeholder) => {
          if (cancelled) return;
          if (!placeholder.isConnected) return;

          const encoded = placeholder.getAttribute('data-plantuml');
          if (!encoded) return;

          const code = decodeURIComponent(encoded);
          await renderPlantUmlImageForCompletion(placeholder, code, contentTheme, documentPath, () => cancelled);
          renderedCount += 1;
        }));

        if (cancelled) return;
        logPreviewPerformance('plantuml', {
          contentTheme,
          diagramCount: placeholderList.length,
          renderedCount,
          elapsedMs: nowMs() - plantUmlStartedAt,
        });
      })();
    }, { immediate: renderStrategy === 'immediate', timeout: 300 });

    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [html, contentTheme, documentPath, renderStrategy]);

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
        className={themeContract.preview.writeClass}
        aria-busy={showRenderPendingStatus ? 'true' : undefined}
        style={{
          fontFamily: previewFontFamily === 'inherit' ? undefined : previewFontFamily,
          fontSize: `${effectivePreviewFontSize}px`,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
