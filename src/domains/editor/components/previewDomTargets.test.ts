import { describe, expect, it, vi } from 'vitest';
import {
  collectPreviewDomPostProcessTargets,
  getPreviewDomTargetHints,
} from './previewDomTargets';

describe('preview DOM target collection', () => {
  it('skips DOM scans when the HTML has no post-process targets', () => {
    const write = document.createElement('div');
    write.innerHTML = '<p>普通段落</p><pre><code>const x = 1;</code></pre>';
    const querySelectorAll = vi.spyOn(write, 'querySelectorAll');

    const hints = getPreviewDomTargetHints(write.innerHTML, '/Users/Alex/Notes/Plan.md');
    const targets = collectPreviewDomPostProcessTargets(write, hints);

    expect(hints).toEqual({
      katexPlaceholders: false,
      media: false,
      katexErrors: false,
      mermaid: false,
    });
    expect(querySelectorAll).not.toHaveBeenCalled();
    expect(targets.katexPlaceholders).toHaveLength(0);
    expect(targets.mediaElements).toHaveLength(0);
    expect(targets.katexErrorElements).toHaveLength(0);
    expect(targets.mermaidPlaceholders).toHaveLength(0);
  });

  it('collects media, KaTeX placeholders/errors, and Mermaid placeholders in one DOM walk', () => {
    const write = document.createElement('div');
    write.innerHTML = [
      '<p><img alt="local" src="assets/a.png"></p>',
      '<picture><source src="assets/a.webp"></picture>',
      '<span class="katex-placeholder" data-katex="x" data-katex-display="false">x</span>',
      '<span class="katex-error" title="bad">\\bad</span>',
      '<div class="mermaid-placeholder" data-mermaid="graph"></div>',
    ].join('');

    const hints = getPreviewDomTargetHints(write.innerHTML, '/Users/Alex/Notes/Plan.md');
    const targets = collectPreviewDomPostProcessTargets(write, hints);

    expect(targets.katexPlaceholders).toHaveLength(1);
    expect(targets.mediaElements).toHaveLength(2);
    expect(targets.katexErrorElements).toHaveLength(1);
    expect(targets.mermaidPlaceholders).toHaveLength(1);
  });

  it('does not collect local media targets without a document path', () => {
    const write = document.createElement('div');
    write.innerHTML = '<img alt="local" src="assets/a.png"><div class="mermaid-placeholder"></div>';

    const hints = getPreviewDomTargetHints(write.innerHTML);
    const targets = collectPreviewDomPostProcessTargets(write, hints);

    expect(hints.media).toBe(false);
    expect(hints.katexPlaceholders).toBe(false);
    expect(hints.mermaid).toBe(true);
    expect(targets.katexPlaceholders).toHaveLength(0);
    expect(targets.mediaElements).toHaveLength(0);
    expect(targets.mermaidPlaceholders).toHaveLength(1);
  });
});
