export interface PreviewDomTargetHints {
  katexPlaceholders: boolean;
  media: boolean;
  katexErrors: boolean;
  mermaid: boolean;
  markmap: boolean;
  plantUml: boolean;
}

export interface PreviewDomPostProcessTargets {
  katexPlaceholders: HTMLElement[];
  mediaElements: Array<HTMLImageElement | HTMLSourceElement>;
  katexErrorElements: HTMLElement[];
  mermaidPlaceholders: HTMLElement[];
  markmapPlaceholders: HTMLElement[];
  plantUmlPlaceholders: HTMLElement[];
}

const EMPTY_PREVIEW_DOM_TARGETS: PreviewDomPostProcessTargets = {
  katexPlaceholders: [],
  mediaElements: [],
  katexErrorElements: [],
  mermaidPlaceholders: [],
  markmapPlaceholders: [],
  plantUmlPlaceholders: [],
};

const MEDIA_HTML_PATTERN = /<(?:img|source)\b/i;

export function getPreviewDomTargetHints(html: string, documentPath?: string): PreviewDomTargetHints {
  return {
    katexPlaceholders: html.includes('katex-placeholder'),
    media: Boolean(documentPath && MEDIA_HTML_PATTERN.test(html)),
    katexErrors: html.includes('katex-error'),
    mermaid: html.includes('mermaid-placeholder'),
    markmap: html.includes('markmap-placeholder'),
    plantUml: html.includes('plantuml-placeholder'),
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
  if (!hints.katexPlaceholders && !hints.media && !hints.katexErrors && !hints.mermaid && !hints.markmap && !hints.plantUml) {
    return EMPTY_PREVIEW_DOM_TARGETS;
  }

  const katexPlaceholders: HTMLElement[] = [];
  const mediaElements: Array<HTMLImageElement | HTMLSourceElement> = [];
  const katexErrorElements: HTMLElement[] = [];
  const mermaidPlaceholders: HTMLElement[] = [];
  const markmapPlaceholders: HTMLElement[] = [];
  const plantUmlPlaceholders: HTMLElement[] = [];
  const walker = write.ownerDocument.createTreeWalker(write, NodeFilter.SHOW_ELEMENT);

  let element = walker.currentNode as HTMLElement | null;
  while (element) {
    if (hints.katexPlaceholders && element.classList.contains('katex-placeholder')) {
      katexPlaceholders.push(element);
    }
    if (hints.media && isMediaElement(element)) {
      mediaElements.push(element);
    }
    if (hints.katexErrors && element.classList.contains('katex-error')) {
      katexErrorElements.push(element);
    }
    if (hints.mermaid && element.classList.contains('mermaid-placeholder')) {
      mermaidPlaceholders.push(element);
    }
    if (hints.markmap && element.classList.contains('markmap-placeholder')) {
      markmapPlaceholders.push(element);
    }
    if (hints.plantUml && element.classList.contains('plantuml-placeholder')) {
      plantUmlPlaceholders.push(element);
    }
    element = walker.nextNode() as HTMLElement | null;
  }

  return {
    katexPlaceholders,
    mediaElements,
    katexErrorElements,
    mermaidPlaceholders,
    markmapPlaceholders,
    plantUmlPlaceholders,
  };
}
