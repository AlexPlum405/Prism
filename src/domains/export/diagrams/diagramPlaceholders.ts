/**
 * 把渲染好的 Markdown 里的图表占位符换成真正的 SVG。
 * 三种图表各有自己的超时与失败兜底：渲染失败时把错误写进 pre 标签，
 * 让导出的文件本身就带着失败原因，而不是静默丢掉一张图。
 */
import type { ContentTheme } from '../../settings/types';
import type { ExportDocumentInput } from '../types';
import { t } from '../../i18n/runtime';
import { createPlantUmlSvgElement } from '../../editor/components/plantUml';
import {
  EXPORT_FONT_READY_TIMEOUT_MS,
  EXPORT_MARKMAP_RENDER_TIMEOUT_MS,
  EXPORT_MERMAID_RENDER_TIMEOUT_MS,
  EXPORT_PLANTUML_RENDER_TIMEOUT_MS,
} from '../exportConstants';
import { reportProgress } from '../pipeline/exportPipelineContext';
import { escapeHtml } from '../render/htmlFragmentRenderer';
import { nextExportFrame as nextFrame, withExportTimeout as withTimeout } from '../rendering';
import { normalizePlantUmlSvg } from './svgDocument';
import {
  createMermaidExportRenderSandbox,
  getMermaidExportConfig,
  normalizeMermaidSvg,
} from './mermaidSvg';
import { createMarkmapSvgElement } from './staticMarkmap';

export function applyExportDiagramPlaceholderLayout(placeholder: HTMLElement) {
  placeholder.style.display = 'block';
  placeholder.style.boxSizing = 'border-box';
  placeholder.style.width = '100%';
  placeholder.style.maxWidth = '100%';
  placeholder.style.minHeight = '0';
  placeholder.style.margin = '8px 0';
  placeholder.style.overflow = 'visible';
}

export async function renderMermaidPlaceholders(root: HTMLElement, contentTheme: ContentTheme, input: ExportDocumentInput) {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-placeholder'));
  if (placeholders.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize(getMermaidExportConfig(contentTheme) as any);

  if ('fonts' in document) {
    try {
      await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, t('export.error.fontLoadTimeout'));
    } catch {
      // Font readiness is best effort.
    }
  }

  for (const [index, placeholder] of placeholders.entries()) {
    const encoded = placeholder.getAttribute('data-mermaid');
    if (!encoded) continue;
    const source = decodeURIComponent(encoded);
    const renderSandbox = createMermaidExportRenderSandbox();
    if (placeholders.length > 1) {
      reportProgress(input, t('export.progress.renderDiagramIndexed', { index: index + 1, total: placeholders.length }));
    }
    try {
      const { svg } = await withTimeout(
        mermaid.render(`prism-export-mermaid-${Date.now()}-${index}`, source, renderSandbox),
        EXPORT_MERMAID_RENDER_TIMEOUT_MS,
        t('export.error.mermaidTimeout', { index: index + 1 }),
      );
      placeholder.innerHTML = svg;
      placeholder.style.display = 'flex';
      placeholder.style.justifyContent = 'center';
      placeholder.style.margin = '8px 0';
      placeholder.style.boxSizing = 'border-box';
      placeholder.style.width = '100%';
      placeholder.style.maxWidth = '100%';
      placeholder.style.overflow = 'hidden';
      const svgEl = placeholder.querySelector('svg');
      if (svgEl) normalizeMermaidSvg(svgEl);
    } catch (err) {
      placeholder.innerHTML = `<pre>${escapeHtml(t('export.error.mermaidRenderFailed'))}: ${escapeHtml(String(err))}</pre>`;
    } finally {
      renderSandbox.remove();
    }
    await nextFrame();
  }
}

export async function renderMarkmapPlaceholders(root: HTMLElement, contentTheme: ContentTheme, input: ExportDocumentInput) {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.markmap-placeholder'));
  if (placeholders.length === 0) return;

  for (const [index, placeholder] of placeholders.entries()) {
    const encoded = placeholder.getAttribute('data-markmap');
    if (!encoded) continue;
    if (placeholders.length > 1) {
      reportProgress(input, t('export.progress.renderDiagramIndexed', { index: index + 1, total: placeholders.length }));
    }
    try {
      const svg = await withTimeout(
        createMarkmapSvgElement(decodeURIComponent(encoded), contentTheme),
        EXPORT_MARKMAP_RENDER_TIMEOUT_MS,
        t('export.error.markmapTimeout', { index: index + 1 }),
      );
      applyExportDiagramPlaceholderLayout(placeholder);
      placeholder.replaceChildren(svg);
      placeholder.removeAttribute('aria-busy');
      placeholder.removeAttribute('data-markmap');
      await nextFrame();
    } catch (err) {
      placeholder.innerHTML = `<pre>${escapeHtml(t('export.error.markmapRenderFailed'))}: ${escapeHtml(String(err))}</pre>`;
    }
  }
}

export async function createExportPlantUmlSvgElement(source: string, contentTheme: ContentTheme, input?: ExportDocumentInput) {
  const svg = await createPlantUmlSvgElement(source, contentTheme, { documentPath: input?.documentPath });
  svg.classList.add('plantuml-image');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'PlantUML diagram');
  normalizePlantUmlSvg(svg);
  return svg;
}

export async function renderPlantUmlPlaceholders(root: HTMLElement, contentTheme: ContentTheme, input: ExportDocumentInput) {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.plantuml-placeholder'));
  if (placeholders.length === 0) return;

  for (const [index, placeholder] of placeholders.entries()) {
    const encoded = placeholder.getAttribute('data-plantuml');
    if (!encoded) continue;
    if (placeholders.length > 1) {
      reportProgress(input, t('export.progress.renderDiagramIndexed', { index: index + 1, total: placeholders.length }));
    }
    try {
      const svg = await withTimeout(
        createExportPlantUmlSvgElement(decodeURIComponent(encoded), contentTheme, input),
        EXPORT_PLANTUML_RENDER_TIMEOUT_MS,
        t('export.error.plantUmlTimeout', { index: index + 1 }),
      );
      applyExportDiagramPlaceholderLayout(placeholder);
      placeholder.replaceChildren(svg);
      await nextFrame();
      const insertedSvg = placeholder.querySelector<SVGSVGElement>('svg.plantuml-image');
      if (insertedSvg) normalizePlantUmlSvg(insertedSvg);
      placeholder.removeAttribute('aria-busy');
      placeholder.removeAttribute('data-plantuml');
      await nextFrame();
    } catch (err) {
      placeholder.innerHTML = `<pre>${escapeHtml(t('export.error.plantUmlRenderFailed'))}: ${escapeHtml(String(err))}</pre>`;
    }
  }
}
