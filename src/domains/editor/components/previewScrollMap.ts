export interface CodeLineElement {
  element: HTMLElement;
  line: number;
  endLine?: number;
}

interface PreviewScrollMapEntry {
  line: number;
  endLine?: number;
  top: number;
  height: number;
}

export interface PreviewScrollMap {
  entries: PreviewScrollMapEntry[];
  signature: string;
}

function getPreviewSourceRoot(preview: HTMLElement): HTMLElement {
  if (preview.id === 'write') return preview;
  return preview.querySelector<HTMLElement>('#write') ?? preview;
}

const FLAT_SOURCE_MAP_MARKER = 'prism-preview-source-map:flat';

function readFlatPreviewSourceMap(root: HTMLElement): number[] | null {
  const firstChild = root.firstChild;
  if (firstChild?.nodeType !== 8) return null;

  const value = firstChild.nodeValue?.trim() ?? '';
  if (value === FLAT_SOURCE_MAP_MARKER) return [];
  if (!value.startsWith(`${FLAT_SOURCE_MAP_MARKER}:`)) return null;

  const lines = value.slice(FLAT_SOURCE_MAP_MARKER.length + 1);
  if (!lines) return [];
  let currentLine = 0;
  return lines.split(',').flatMap((encodedDelta) => {
    const delta = Number.parseInt(encodedDelta, 36);
    if (!Number.isFinite(delta)) return [];
    currentLine += delta;
    return [currentLine];
  });
}

function readSourceLine(element: HTMLElement): number | null {
  const raw = element.getAttribute('data-source-line') ?? element.getAttribute('data-line');
  const line = raw ? Number(raw) : NaN;
  return Number.isFinite(line) ? line : null;
}

function pushSourceLineElement(elements: HTMLElement[], element: Element | null | undefined) {
  if (!(element instanceof HTMLElement)) return;
  if (element.hasAttribute('data-source-line') || element.hasAttribute('data-line')) {
    elements.push(element);
  }
}

function getCodeBlockEndLine(el: HTMLElement, line: number): number | undefined {
  if (el.tagName !== 'PRE') return undefined;
  const firstElement = el.firstElementChild;
  const codeEl = firstElement?.tagName === 'CODE' ? firstElement : null;
  const text = codeEl?.textContent || el.textContent || '';
  const lineCount = (text.match(/\n/g) || []).length + 1;
  return line + lineCount - 1;
}

function getElementTop(element: HTMLElement, preview: HTMLElement, previewTop?: number): number {
  const baseTop = previewTop ?? preview.getBoundingClientRect().top;
  return element.getBoundingClientRect().top - baseTop + preview.scrollTop;
}

function getPreviewScrollMapSignature(preview: HTMLElement, revision: number) {
  const write = preview.querySelector<HTMLElement>('#write');
  return [
    revision,
    preview.scrollHeight,
    preview.clientHeight,
    preview.clientWidth,
    write?.childElementCount ?? 0,
  ].join(':');
}

export function collectCodeLineElements(preview: HTMLElement): CodeLineElement[] {
  const root = getPreviewSourceRoot(preview);
  const flatSourceMap = readFlatPreviewSourceMap(root);
  if (flatSourceMap) {
    return collectFlatCodeLineElements(root, flatSourceMap);
  }

  const elements: CodeLineElement[] = [];
  const nodes = collectPreviewSourceLineElements(root);
  nodes.forEach((el) => {
    const line = readSourceLine(el);
    if (line === null) return;

    const endLine = getCodeBlockEndLine(el, line);
    if (endLine !== undefined) {
      elements.push({ element: el, line, endLine });
      return;
    }

    // 列表容器跳过（子元素会被单独处理）
    if (el.tagName === 'UL' || el.tagName === 'OL') return;

    elements.push({ element: el, line });
  });
  elements.sort((a, b) => a.line - b.line);
  return elements;
}

export function collectPreviewSourceLineElements(preview: HTMLElement): HTMLElement[] {
  const root = getPreviewSourceRoot(preview);
  if (readFlatPreviewSourceMap(root)) {
    return collectFlatPreviewSourceLineElements(root);
  }

  const document = root.ownerDocument;
  const elements: HTMLElement[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

  let current = walker.currentNode as HTMLElement | null;
  while (current) {
    if (current.hasAttribute('data-source-line') || current.hasAttribute('data-line')) {
      elements.push(current);
    }
    current = walker.nextNode() as HTMLElement | null;
  }

  return elements;
}

function findFlatPreviewSourceElement(target: Element | null, root: HTMLElement): HTMLElement | null {
  let element = target instanceof HTMLElement ? target : target?.parentElement ?? null;
  while (element && element !== root) {
    if (
      isFlatSidecarMappedElement(element)
      || element.hasAttribute('data-source-line')
      || element.hasAttribute('data-line')
    ) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

export function findPreviewSourceLineElement(
  target: Element | null,
  preview: HTMLElement,
): { element: HTMLElement; line: number } | null {
  const attributedElement = target?.closest<HTMLElement>('[data-source-line], [data-line]');
  if (attributedElement) {
    const line = readSourceLine(attributedElement);
    if (line !== null) return { element: attributedElement, line };
  }

  const root = getPreviewSourceRoot(preview);
  const flatSourceMap = readFlatPreviewSourceMap(root);
  if (!flatSourceMap) return null;

  const sourceElement = findFlatPreviewSourceElement(target, root);
  if (!sourceElement) return null;

  const entry = collectFlatCodeLineElements(root, flatSourceMap)
    .find((candidate) => candidate.element === sourceElement);
  return entry ? { element: entry.element, line: entry.line } : null;
}

export function findPreviewElementForSourceLine(
  preview: HTMLElement,
  line: number,
): HTMLElement | null {
  const root = getPreviewSourceRoot(preview);
  if (!readFlatPreviewSourceMap(root)) {
    const exactTarget = root.querySelector<HTMLElement>(`[data-source-line="${line}"], [data-line="${line}"]`);
    if (exactTarget) return exactTarget;
  }

  const elements = collectCodeLineElements(root);
  return elements.find((entry) => entry.line === line)?.element ?? null;
}

function isFlatSidecarMappedElement(element: HTMLElement) {
  if (/^H[1-6]$/.test(element.tagName)) return true;
  if (element.tagName === 'P') return true;
  if (element.tagName === 'PRE') return true;
  if (element.tagName === 'BLOCKQUOTE') return true;
  if (element.tagName === 'LI') return true;
  if (element.tagName === 'HR') return true;
  return element.classList.contains('prism-simple-table');
}

function collectFlatCodeLineElements(root: HTMLElement, sourceLines: number[]): CodeLineElement[] {
  const elements: CodeLineElement[] = [];
  let sourceIndex = 0;

  const pushMappedElement = (element: Element | null | undefined) => {
    if (!(element instanceof HTMLElement)) return;

    let line: number | null = null;
    if (isFlatSidecarMappedElement(element)) {
      line = sourceLines[sourceIndex] ?? null;
      sourceIndex += 1;
    } else {
      line = readSourceLine(element);
    }
    if (line === null || !Number.isFinite(line)) return;

    const endLine = getCodeBlockEndLine(element, line);
    elements.push(endLine === undefined ? { element, line } : { element, line, endLine });
  };

  let child = root.firstElementChild;
  while (child) {
    pushMappedElement(child);

    if (child.tagName === 'UL' || child.tagName === 'OL') {
      let item = child.firstElementChild;
      while (item) {
        pushMappedElement(item);
        item = item.nextElementSibling;
      }
    } else if (child.classList.contains('prism-large-pre-table')) {
      let row = child.firstElementChild;
      while (row) {
        pushMappedElement(row);
        row = row.nextElementSibling;
      }
    }

    child = child.nextElementSibling;
  }

  elements.sort((a, b) => a.line - b.line);
  return elements;
}

function collectFlatPreviewSourceLineElements(root: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];

  let child = root.firstElementChild;
  while (child) {
    if (child instanceof HTMLElement && isFlatSidecarMappedElement(child)) {
      elements.push(child);
    } else {
      pushSourceLineElement(elements, child);
    }

    if (child.tagName === 'UL' || child.tagName === 'OL') {
      let item = child.firstElementChild;
      while (item) {
        if (item instanceof HTMLElement && isFlatSidecarMappedElement(item)) {
          elements.push(item);
        } else {
          pushSourceLineElement(elements, item);
        }
        item = item.nextElementSibling;
      }
    } else if (child.classList.contains('prism-large-pre-table')) {
      let row = child.firstElementChild;
      while (row) {
        pushSourceLineElement(elements, row);
        row = row.nextElementSibling;
      }
    }

    child = child.nextElementSibling;
  }

  return elements;
}

export function buildPreviewScrollMap(
  preview: HTMLElement,
  elements: CodeLineElement[] = collectCodeLineElements(preview),
  signature = getPreviewScrollMapSignature(preview, 0),
): PreviewScrollMap {
  const previewTop = preview.getBoundingClientRect().top;
  const entries = elements
    .filter((entry) => entry.element.offsetHeight > 0)
    .map((entry) => ({
      line: entry.line,
      endLine: entry.endLine,
      top: getElementTop(entry.element, preview, previewTop),
      height: entry.element.offsetHeight,
    }));

  return { entries, signature };
}

export function lineToPreviewScrollTopInMap(line: number, map: PreviewScrollMap): number | null {
  const elements = map.entries;
  if (elements.length === 0) return null;
  if (line <= elements[0].line) return 0;

  let previous: PreviewScrollMapEntry | null = null;
  let next: PreviewScrollMapEntry | null = null;
  for (const entry of elements) {
    if (entry.line === line) {
      previous = entry;
      break;
    } else if (entry.line > line) {
      next = entry;
      break;
    }
    previous = entry;
  }
  if (!previous) return null;

  const previousTop = previous.top;
  const previousHeight = previous.height;

  if (previous.endLine && previous.endLine > previous.line && line < previous.endLine) {
    const progress = (line - previous.line) / (previous.endLine - previous.line);
    return previousTop + previousHeight * progress;
  }

  if (previous.endLine && next && next.line !== previous.line) {
    const progress = (line - previous.endLine) / (next.line - previous.endLine);
    return (previousTop + previousHeight) + progress * (next.top - (previousTop + previousHeight));
  }

  if (next && next.line !== previous.line) {
    const progress = (line - previous.line) / (next.line - previous.line);
    return (previousTop + previousHeight) + progress * (next.top - (previousTop + previousHeight));
  }

  return previousTop;
}

export function pageOffsetToLineInMap(scrollTop: number, map: PreviewScrollMap): number | null {
  const visible = map.entries;
  if (visible.length === 0) return null;

  let previousIndex = 0;
  let lo = 0;
  let hi = visible.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const top = visible[mid].top;
    if (top <= scrollTop) {
      previousIndex = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const previous = visible[previousIndex];
  const next = visible[previousIndex + 1];
  const previousTop = previous.top;
  const previousHeight = previous.height;
  const offsetFromPrevious = scrollTop - previousTop;

  if (previous.endLine && previous.endLine > previous.line) {
    if (offsetFromPrevious >= 0 && offsetFromPrevious <= previousHeight) {
      const progress = previousHeight > 0 ? offsetFromPrevious / previousHeight : 0;
      return previous.line + progress * (previous.endLine - previous.line);
    }
  }

  if (next) {
    const distance = next.top - previousTop;
    const progress = distance > 0 ? offsetFromPrevious / distance : 0;
    const startLine = previous.endLine ?? previous.line;
    return startLine + progress * (next.line - startLine);
  }

  return previous.line;
}

export function lineToPreviewScrollTop(
  line: number,
  elements: CodeLineElement[],
  preview: HTMLElement,
): number | null {
  return lineToPreviewScrollTopInMap(line, buildPreviewScrollMap(preview, elements));
}

export function pageOffsetToLine(
  scrollTop: number,
  elements: CodeLineElement[],
  preview: HTMLElement,
): number | null {
  return pageOffsetToLineInMap(scrollTop, buildPreviewScrollMap(preview, elements));
}

export function createPreviewScrollMapCache() {
  let revision = 0;
  let cached: { preview: HTMLElement; map: PreviewScrollMap } | null = null;

  return {
    invalidate() {
      revision += 1;
      cached = null;
    },
    get(preview: HTMLElement) {
      const signature = getPreviewScrollMapSignature(preview, revision);
      if (cached?.preview === preview && cached.map.signature === signature) {
        return cached.map;
      }
      const map = buildPreviewScrollMap(preview, collectCodeLineElements(preview), signature);
      cached = { preview, map };
      return map;
    },
  };
}
