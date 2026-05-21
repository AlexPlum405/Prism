import { nextExportFrame } from './rendering';

export const EXPORT_PAGE_SPLIT_EPSILON = 2;
export const EXPORT_ATOMIC_SPACER_CLASS = 'prism-export-page-spacer';
export const EXPORT_ATOMIC_BLOCK_CLASS = 'prism-export-atomic';
export const EXPORT_ATOMIC_GROUP_CLASS = 'prism-export-atomic-group';
export const EXPORT_MIN_ATOMIC_SCALE = 0.05;
export const EXPORT_ATOMIC_BLOCK_SELECTOR = [
  'img',
  'svg',
  'canvas',
  'figure',
  'table',
  'pre',
  '.mermaid-placeholder',
  '.katex-display',
  '.prism-export-toc',
  '.prism-html-block',
  '[data-prism-docx-visual-target]',
  '[data-prism-docx-mermaid-target]',
  `[data-prism-export-atomic="true"]`,
].join(',');

function isElementInsideAtomicBlock(element: Element) {
  const parent = element.parentElement?.closest(`.${EXPORT_ATOMIC_BLOCK_CLASS}, ${EXPORT_ATOMIC_BLOCK_SELECTOR}`);
  return Boolean(parent);
}

function isStyledVisualBlock(element: Element) {
  if (element.matches('.prism-export-document, .prism-export-document #write')) return false;
  if (!/^(div|section|article|aside|details|blockquote)$/i.test(element.tagName)) return false;
  const style = element.getAttribute('style') ?? '';
  return /\b(background(?:-color)?|border(?:-[a-z]+)?|box-shadow|outline)\s*:/i.test(style);
}

function isScalableAtomicBlock(element: HTMLElement) {
  return element.matches('img, svg, canvas, figure, .mermaid-placeholder, .katex-display, .prism-html-block, [data-prism-export-atomic="true"]')
    || isStyledVisualBlock(element);
}

export function markExportAtomicBlocks(root: HTMLElement) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(EXPORT_ATOMIC_BLOCK_SELECTOR));
  root.querySelectorAll<HTMLElement>('div, section, article, aside, details, blockquote').forEach((element) => {
    if (isStyledVisualBlock(element)) candidates.push(element);
  });

  candidates.forEach((element) => {
    if (isElementInsideAtomicBlock(element)) return;
    element.classList.add(EXPORT_ATOMIC_BLOCK_CLASS);
    element.dataset.prismExportAtomic = 'true';
  });
}

function isTopLevelAtomicBlock(element: HTMLElement) {
  return !element.parentElement?.closest(`.${EXPORT_ATOMIC_BLOCK_CLASS}`);
}

function findAtomicBlockHeadingSibling(element: HTMLElement) {
  const heading = element.previousElementSibling;
  if (!heading?.matches('h1, h2, h3, h4, h5, h6')) return null;
  if (heading.closest(`.${EXPORT_ATOMIC_GROUP_CLASS}`)) return null;
  return heading as HTMLElement;
}

function groupExportHeadingAtomicBlocks(root: HTMLElement) {
  const atomicBlocks = Array.from(root.querySelectorAll<HTMLElement>(`.${EXPORT_ATOMIC_BLOCK_CLASS}`))
    .filter(isTopLevelAtomicBlock);

  atomicBlocks.forEach((element) => {
    if (element.closest(`.${EXPORT_ATOMIC_GROUP_CLASS}`)) return;
    const heading = findAtomicBlockHeadingSibling(element);
    if (!heading) return;
    if (!heading.parentNode || heading.parentNode !== element.parentNode) return;

    const group = element.ownerDocument.createElement('div');
    group.className = `${EXPORT_ATOMIC_GROUP_CLASS} ${EXPORT_ATOMIC_BLOCK_CLASS}`;
    group.dataset.prismExportAtomic = 'true';
    heading.parentNode.insertBefore(group, heading);

    let node: ChildNode | null = heading;
    while (node) {
      const nextNode: ChildNode | null = node.nextSibling;
      group.appendChild(node);
      if (node === element) break;
      node = nextNode;
    }
  });
}

function scaleOversizedAtomicBlock(element: HTMLElement, pageCssHeight: number) {
  if (!isScalableAtomicBlock(element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.height <= pageCssHeight - EXPORT_PAGE_SPLIT_EPSILON) return false;
  const scale = Math.max(EXPORT_MIN_ATOMIC_SCALE, Math.min(1, (pageCssHeight - EXPORT_PAGE_SPLIT_EPSILON) / rect.height));
  element.style.transformOrigin = 'top center';
  element.style.transform = `scale(${Number(scale.toFixed(4))})`;
  element.style.width = `${Number((100 / scale).toFixed(4))}%`;
  element.style.maxHeight = `${Math.max(1, Math.floor(pageCssHeight - EXPORT_PAGE_SPLIT_EPSILON))}px`;
  element.style.marginLeft = 'auto';
  element.style.marginRight = 'auto';
  element.style.breakInside = 'avoid';
  element.style.pageBreakInside = 'avoid';
  return true;
}

export async function prepareExportAtomicPagination(root: HTMLElement, pageCssHeight: number) {
  if (!Number.isFinite(pageCssHeight) || pageCssHeight <= 0) return;
  markExportAtomicBlocks(root);
  groupExportHeadingAtomicBlocks(root);
  root.querySelectorAll(`.${EXPORT_ATOMIC_SPACER_CLASS}`).forEach((element) => element.remove());

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    await nextExportFrame();
    const rootRect = root.getBoundingClientRect();
    const atomicBlocks = Array.from(root.querySelectorAll<HTMLElement>(`.${EXPORT_ATOMIC_BLOCK_CLASS}`))
      .filter((element) => !element.closest(`.${EXPORT_ATOMIC_SPACER_CLASS}`))
      .filter(isTopLevelAtomicBlock);

    for (const element of atomicBlocks) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      if (rect.height < 2 || rect.width < 2) continue;

      if (scaleOversizedAtomicBlock(element, pageCssHeight)) {
        changed = true;
        continue;
      }

      const top = Math.max(0, rect.top - rootRect.top);
      const offsetInPage = top % pageCssHeight;
      if (offsetInPage <= EXPORT_PAGE_SPLIT_EPSILON) continue;
      const remaining = pageCssHeight - offsetInPage;
      if (rect.height <= remaining - EXPORT_PAGE_SPLIT_EPSILON) continue;

      const spacer = element.ownerDocument.createElement('div');
      spacer.className = EXPORT_ATOMIC_SPACER_CLASS;
      spacer.setAttribute('aria-hidden', 'true');
      Object.assign(spacer.style, {
        display: 'block',
        width: '100%',
        height: `${Math.ceil(remaining)}px`,
        margin: '0',
        padding: '0',
        border: '0',
        breakAfter: 'page',
        pageBreakAfter: 'always',
      });
      element.parentNode?.insertBefore(spacer, element);
      changed = true;
    }

    if (!changed) break;
  }
}
