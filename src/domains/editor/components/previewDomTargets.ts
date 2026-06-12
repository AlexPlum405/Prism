export interface PreviewDomTargetHints {
  media: boolean;
  katexErrors: boolean;
  mermaid: boolean;
}

export interface PreviewDomPostProcessTargets {
  mediaElements: Array<HTMLImageElement | HTMLSourceElement>;
  katexErrorElements: HTMLElement[];
  mermaidPlaceholders: HTMLElement[];
}

const EMPTY_PREVIEW_DOM_TARGETS: PreviewDomPostProcessTargets = {
  mediaElements: [],
  katexErrorElements: [],
  mermaidPlaceholders: [],
};

const MEDIA_HTML_PATTERN = /<(?:img|source)\b/i;

export function getPreviewDomTargetHints(html: string, documentPath?: string): PreviewDomTargetHints {
  return {
    media: Boolean(documentPath && MEDIA_HTML_PATTERN.test(html)),
    katexErrors: html.includes('katex-error'),
    mermaid: html.includes('mermaid-placeholder'),
  };
}

function isMediaElement(element: Element): element is HTMLImageElement | HTMLSourceElement {
  const tagName = element.tagName.toUpperCase();
  return (tagName === 'IMG' || tagName === 'SOURCE') && element.hasAttribute('src');
}

export function collectPreviewDomPostProcessTargets(
  write: HTMLElement,
  hints: PreviewDomTargetHints,
): PreviewDomPostProcessTargets {
  const selectors: string[] = [];
  if (hints.media) selectors.push('img[src]', 'source[src]');
  if (hints.katexErrors) selectors.push('.katex-error');
  if (hints.mermaid) selectors.push('.mermaid-placeholder');
  if (selectors.length === 0) return EMPTY_PREVIEW_DOM_TARGETS;

  const mediaElements: Array<HTMLImageElement | HTMLSourceElement> = [];
  const katexErrorElements: HTMLElement[] = [];
  const mermaidPlaceholders: HTMLElement[] = [];

  write.querySelectorAll<HTMLElement>(selectors.join(',')).forEach((element) => {
    if (hints.media && isMediaElement(element)) {
      mediaElements.push(element);
    }
    if (hints.katexErrors && element.classList.contains('katex-error')) {
      katexErrorElements.push(element);
    }
    if (hints.mermaid && element.classList.contains('mermaid-placeholder')) {
      mermaidPlaceholders.push(element);
    }
  });

  return {
    mediaElements,
    katexErrorElements,
    mermaidPlaceholders,
  };
}

