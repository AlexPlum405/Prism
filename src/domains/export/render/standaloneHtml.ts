import { markdownToHtml } from '../../../lib/markdownToHtml';
import { getExportTitle } from '../pipeline/exportPipelineContext';
import { getWriteClassByTheme } from '../exportSettings';
import type { ExportDocumentInput } from '../types';
import { collectExportCss } from './exportCss';
import { escapeHtml } from './htmlFragmentRenderer';

export async function buildStandaloneHtml(
  input: ExportDocumentInput,
  renderedRoot?: HTMLElement,
  options: { includeTheme?: boolean; rasterSafeCss?: boolean } = {},
) {
  const css = options.includeTheme === false ? '' : await collectExportCss({
    ...input,
    rasterSafe: options.rasterSafeCss,
  });
  const body = (() => {
    if (!renderedRoot) {
      return `<div class="prism-export-document prism-export-template--${input.templateId ?? 'theme'} preview-compat preview-compat--${input.contentTheme}">
        <div id="write" class="${getWriteClassByTheme(input.contentTheme)}">${markdownToHtml(input.content)}</div>
      </div>`;
    }

    const clone = renderedRoot.cloneNode(true) as HTMLElement;
    clone.removeAttribute('style');
    return clone.outerHTML;
  })();

  return `<!DOCTYPE html>
<html lang="${input.locale ?? 'zh-CN'}" data-content-theme="${input.contentTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(getExportTitle(input))}</title>
  <meta name="generator" content="Prism">
  ${input.author ? `<meta name="author" content="${escapeHtml(input.author)}">` : ''}
  ${input.date ? `<meta name="date" content="${escapeHtml(input.date)}">` : ''}
  ${css ? `<style>${css}</style>` : ''}
</head>
<body class="${document.body.classList.contains('dark') ? 'dark' : ''}">
${body}
</body>
</html>`;
}
