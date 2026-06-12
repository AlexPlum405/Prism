/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SplitView,
  collectCodeLineElements,
  lineToPreviewScrollTop,
  pageOffsetToLine,
  shouldSyncPreviewScrollToEditor,
} from './SplitView';

const mockState = vi.hoisted(() => ({
  jumpToLine: vi.fn(),
  setScrollRatio: vi.fn(),
  mounts: 0,
  unmounts: 0,
}));

vi.mock('./EditorPane', async () => {
  const React = await import('react');

  return {
    EditorPane: React.forwardRef((props: {
      content: string;
      onScrollRatioChange?: (ratio: number) => void;
      onSelectionTextChange?: (text: string) => void;
    }, ref) => {
      React.useEffect(() => {
        mockState.mounts += 1;
        return () => {
          mockState.unmounts += 1;
        };
      }, []);

      React.useImperativeHandle(ref, () => ({
        focus: vi.fn(),
        jumpToLine: mockState.jumpToLine,
        setScrollRatio: mockState.setScrollRatio,
        scrollToLine: vi.fn(),
        execSearch: vi.fn(),
        restoreSearch: vi.fn(),
        getSelectedText: vi.fn(() => ''),
      }));

      return React.createElement(
        'div',
        { 'data-testid': 'editor-pane' },
        props.content,
        React.createElement('button', {
          'data-testid': 'editor-scroll-ratio',
          onClick: () => props.onScrollRatioChange?.(0.42),
          type: 'button',
        }),
        React.createElement('button', {
          'data-testid': 'editor-selection',
          onClick: () => props.onSelectionTextChange?.('选中文本 selected text'),
          type: 'button',
        }),
      );
    }),
  };
});

vi.mock('./PreviewPane', () => ({
  PreviewPane: ({
    content,
    renderStrategy,
    onOpenDocumentLink,
  }: {
    content: string;
    renderStrategy?: 'deferred' | 'immediate';
    onOpenDocumentLink?: (target: string, options: { kind: 'markdown' | 'wiki'; sourcePath?: string }) => void;
  }) => (
    <div data-testid="preview-pane" data-render-strategy={renderStrategy}>
      <div id="write">
        <p data-source-line="6">{content}</p>
        <button type="button" data-preview-source-line="9">跳到源码</button>
        <button
          type="button"
          onClick={() => onOpenDocumentLink?.('manual-test', { kind: 'wiki', sourcePath: '/repo/current.md' })}
        >
          manual-test
        </button>
      </div>
    </div>
  ),
}));

describe('SplitView editor lifecycle', () => {
  beforeEach(() => {
    mockState.jumpToLine.mockClear();
    mockState.setScrollRatio.mockClear();
    mockState.mounts = 0;
    mockState.unmounts = 0;
  });

  it('keeps the editor mounted when switching through preview mode so undo history survives', () => {
    const props = {
      content: 'hello Prism',
      onChange: vi.fn(),
      onCursorChange: vi.fn(),
    };
    const { rerender } = render(<SplitView {...props} viewMode="edit" />);

    expect(screen.getByTestId('editor-pane')).toBeTruthy();
    expect(mockState.mounts).toBe(1);
    expect(mockState.unmounts).toBe(0);

    rerender(<SplitView {...props} viewMode="preview" />);

    expect(screen.getByTestId('editor-pane')).toBeTruthy();
    expect(screen.getByTestId('preview-pane')).toBeTruthy();
    expect(mockState.mounts).toBe(1);
    expect(mockState.unmounts).toBe(0);

    rerender(<SplitView {...props} viewMode="edit" />);

    expect(screen.getByTestId('editor-pane')).toBeTruthy();
    expect(mockState.mounts).toBe(1);
    expect(mockState.unmounts).toBe(0);
  });

  it('asks the preview pane to flush rendering immediately in preview-only mode', () => {
    const props = {
      content: 'large preview content',
      onChange: vi.fn(),
      onCursorChange: vi.fn(),
    };
    const { rerender } = render(<SplitView {...props} viewMode="split" />);

    expect(screen.getByTestId('preview-pane')).toHaveAttribute('data-render-strategy', 'deferred');

    rerender(<SplitView {...props} viewMode="preview" />);

    expect(screen.getByTestId('preview-pane')).toHaveAttribute('data-render-strategy', 'immediate');
  });

  it('keeps plain preview clicks in reading mode', () => {
    render(
      <SplitView
        content="Preview block"
        viewMode="split"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    const preview = screen.getByTestId('preview-pane');
    fireEvent.click(preview.querySelector('[data-source-line="6"]') as HTMLElement);

    expect(mockState.jumpToLine).not.toHaveBeenCalled();
  });

  it('jumps to the source line when a preview block is clicked with a source modifier', () => {
    render(
      <SplitView
        content="Preview block"
        viewMode="split"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    const preview = screen.getByTestId('preview-pane');
    fireEvent.click(preview.querySelector('[data-source-line="6"]') as HTMLElement, { metaKey: true });

    expect(mockState.jumpToLine).toHaveBeenCalledWith(6);
  });

  it('jumps to the source line from a preview render diagnostic action', () => {
    render(
      <SplitView
        content="Preview block"
        viewMode="split"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '跳到源码' }));

    expect(mockState.jumpToLine).toHaveBeenCalledWith(9);
  });

  it('forwards preview document link clicks', () => {
    const onOpenDocumentLink = vi.fn();
    render(
      <SplitView
        content="[[manual-test]]"
        documentPath="/repo/current.md"
        viewMode="split"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
        onOpenDocumentLink={onOpenDocumentLink}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'manual-test' }));

    expect(onOpenDocumentLink).toHaveBeenCalledWith('manual-test', {
      kind: 'wiki',
      sourcePath: '/repo/current.md',
    });
  });

  it('reports editor and preview scroll ratios for the current document', () => {
    const onScrollStateChange = vi.fn();
    render(
      <SplitView
        content="Preview block"
        viewMode="split"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
        onScrollStateChange={onScrollStateChange}
      />,
    );

    fireEvent.click(screen.getByTestId('editor-scroll-ratio'));

    const previewScroller = screen.getByTestId('preview-pane').parentElement as HTMLElement;
    Object.defineProperty(previewScroller, 'scrollHeight', { configurable: true, value: 300 });
    Object.defineProperty(previewScroller, 'clientHeight', { configurable: true, value: 100 });
    previewScroller.scrollTop = 50;
    fireEvent.scroll(previewScroller);

    expect(onScrollStateChange).toHaveBeenCalledWith({ editorRatio: 0.42 });
    expect(onScrollStateChange).toHaveBeenCalledWith({ previewRatio: 0.25 });
  });

  it('does not scan source-line anchors while scrolling preview-only documents', () => {
    const onScrollStateChange = vi.fn();
    render(
      <SplitView
        content="Preview block"
        viewMode="preview"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
        onScrollStateChange={onScrollStateChange}
      />,
    );

    const previewScroller = screen.getByTestId('preview-pane').parentElement as HTMLElement;
    const querySelectorAll = vi.spyOn(previewScroller, 'querySelectorAll');
    Object.defineProperty(previewScroller, 'scrollHeight', { configurable: true, value: 300 });
    Object.defineProperty(previewScroller, 'clientHeight', { configurable: true, value: 100 });
    previewScroller.scrollTop = 50;
    fireEvent.scroll(previewScroller);

    expect(onScrollStateChange).toHaveBeenCalledWith({ previewRatio: 0.25 });
    expect(querySelectorAll).not.toHaveBeenCalledWith('[data-source-line], [data-line]');
  });

  it('forwards editor selection text changes', () => {
    const onSelectionTextChange = vi.fn();
    render(
      <SplitView
        content="Preview block"
        viewMode="edit"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
        onSelectionTextChange={onSelectionTextChange}
      />,
    );

    fireEvent.click(screen.getByTestId('editor-selection'));

    expect(onSelectionTextChange).toHaveBeenCalledWith('选中文本 selected text');
  });

  it('copies selected preview text with Cmd+C in preview mode', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <SplitView
        content="Preview selected text"
        viewMode="preview"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    const paragraph = screen.getByTestId('preview-pane').querySelector('p') as HTMLParagraphElement;
    const textNode = paragraph.firstChild;
    expect(textNode).not.toBeNull();
    const range = document.createRange();
    range.setStart(textNode!, 0);
    range.setEnd(textNode!, 'Preview selected text'.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyC',
      key: 'c',
      metaKey: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith('Preview selected text');
  });
});

function setLayoutBox(element: HTMLElement, top: number, height: number) {
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height });
  element.getBoundingClientRect = () => ({
    x: 0,
    y: top,
    top,
    left: 0,
    bottom: top + height,
    right: 760,
    width: 760,
    height,
    toJSON: () => ({}),
  } as DOMRect);
}

function appendMappedBlock(
  preview: HTMLElement,
  tagName: 'h2' | 'p' | 'pre' | 'figure' | 'div',
  sourceLine: number,
  top: number,
  height: number,
  text?: string,
) {
  const element = document.createElement(tagName);
  element.setAttribute('data-source-line', String(sourceLine));
  if (tagName === 'pre') {
    const code = document.createElement('code');
    code.textContent = text ?? 'line 1\nline 2\nline 3\nline 4';
    element.appendChild(code);
  } else {
    element.textContent = text ?? `source line ${sourceLine}`;
  }
  setLayoutBox(element, top, height);
  preview.appendChild(element);
  return element;
}

describe('SplitView preview scroll mapping', () => {
  it('only syncs preview scroll back to the editor in split mode', () => {
    expect(shouldSyncPreviewScrollToEditor('edit')).toBe(false);
    expect(shouldSyncPreviewScrollToEditor('preview')).toBe(false);
    expect(shouldSyncPreviewScrollToEditor('split')).toBe(true);
  });

  it('maps long-document source lines and preview offsets without large drift', () => {
    const preview = document.createElement('div');
    setLayoutBox(preview, 0, 640);
    let top = 0;

    for (let section = 1; section <= 120; section += 1) {
      const baseLine = section * 20;
      appendMappedBlock(preview, 'h2', baseLine, top, 32);
      top += 32;
      appendMappedBlock(preview, 'p', baseLine + 2, top, 72);
      top += 72;
      appendMappedBlock(preview, 'pre', baseLine + 5, top, 96);
      top += 96;
    }

    const elements = collectCodeLineElements(preview);
    const section80CodeLine = 80 * 20 + 7;
    const section80CodeTop = (80 - 1) * 200 + 32 + 72;
    const mappedCodeScroll = lineToPreviewScrollTop(section80CodeLine, elements, preview);

    expect(elements).toHaveLength(360);
    expect(mappedCodeScroll).toBeCloseTo(section80CodeTop + 64);
    expect(Math.round(pageOffsetToLine(mappedCodeScroll!, elements, preview)!)).toBe(section80CodeLine);

    const section118ParagraphLine = 118 * 20 + 2;
    const mappedParagraphScroll = lineToPreviewScrollTop(section118ParagraphLine, elements, preview);

    expect(mappedParagraphScroll).toBeCloseTo((118 - 1) * 200 + 32);
    expect(Math.round(pageOffsetToLine(mappedParagraphScroll!, elements, preview)!)).toBe(section118ParagraphLine);
  });

  it('keeps media-heavy preview round-trip drift within one source line', () => {
    const preview = document.createElement('div');
    setLayoutBox(preview, 0, 720);
    let top = 0;
    let sourceLine = 1;
    const samples: number[] = [];

    for (let section = 1; section <= 100; section += 1) {
      appendMappedBlock(preview, 'h2', sourceLine, top, 36, `第 ${section} 节`);
      samples.push(sourceLine);
      top += 36;
      sourceLine += 2;

      for (let paragraph = 1; paragraph <= 10; paragraph += 1) {
        const height = 48 + ((section + paragraph) % 4) * 12;
        appendMappedBlock(preview, 'p', sourceLine, top, height, `第 ${section}-${paragraph} 段`);
        if (paragraph === 1 || paragraph === 7) {
          samples.push(sourceLine);
        }
        top += height;
        sourceLine += 3;
      }

      if (section <= 50) {
        appendMappedBlock(preview, 'figure', sourceLine, top, 180 + (section % 3) * 40, `图片 ${section}`);
        if (section % 10 === 0) {
          samples.push(sourceLine);
        }
        top += 180 + (section % 3) * 40;
        sourceLine += 2;
      }

      if (section % 5 === 0) {
        appendMappedBlock(preview, 'div', sourceLine, top, 220, `Mermaid ${section}`);
        samples.push(sourceLine);
        top += 220;
        sourceLine += 5;

        appendMappedBlock(preview, 'div', sourceLine, top, 84, `KaTeX ${section}`);
        top += 84;
        sourceLine += 3;
      }

      if (section % 10 === 0) {
        appendMappedBlock(
          preview,
          'pre',
          sourceLine,
          top,
          144,
          'line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8',
        );
        samples.push(sourceLine + 4);
        top += 144;
        sourceLine += 10;
      }
    }

    const startedAt = performance.now();
    const elements = collectCodeLineElements(preview);
    const maxDrift = samples.reduce((max, line) => {
      const scrollTop = lineToPreviewScrollTop(line, elements, preview);
      expect(scrollTop).not.toBeNull();
      const roundTrippedLine = pageOffsetToLine(scrollTop!, elements, preview);
      expect(roundTrippedLine).not.toBeNull();
      return Math.max(max, Math.abs(roundTrippedLine! - line));
    }, 0);
    const durationMs = performance.now() - startedAt;

    expect(elements.length).toBeGreaterThan(1100);
    expect(samples.length).toBeGreaterThan(250);
    expect(maxDrift).toBeLessThan(1);
    expect(durationMs).toBeLessThan(500);
  });
});
