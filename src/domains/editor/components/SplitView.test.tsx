/**
 * @vitest-environment jsdom
 */
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../../document/store';
import {
  SplitView,
  __splitViewFontZoomTesting,
  collectCodeLineElements,
  lineToPreviewScrollTop,
  pageOffsetToLine,
  shouldSyncPreviewScrollToEditor,
} from './SplitView';
import {
  buildPreviewScrollMap,
  lineToPreviewScrollTopInMap,
  pageOffsetToLineInMap,
} from './previewScrollMap';
import { hasPresentationSlides } from '../extensions/presentation';
import { useSettingsStore } from '../../settings/store';
import { DEFAULT_SETTINGS } from '../../settings/types';

const mockState = vi.hoisted(() => ({
  jumpToLine: vi.fn(),
  setScrollRatio: vi.fn(),
  mountDelayFrames: 0,
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
      const [ready, setReady] = React.useState(mockState.mountDelayFrames <= 0);

      React.useEffect(() => {
        mockState.mounts += 1;
        return () => {
          mockState.unmounts += 1;
        };
      }, []);

      React.useEffect(() => {
        if (ready) return;

        let cancelled = false;
        let remaining = mockState.mountDelayFrames;
        let frame: number | null = null;
        const tick = () => {
          if (cancelled) return;
          if (remaining <= 0) {
            setReady(true);
            return;
          }
          remaining -= 1;
          frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => {
          cancelled = true;
          if (frame !== null) cancelAnimationFrame(frame);
        };
      }, [ready]);

      React.useImperativeHandle(ref, () => ready
        ? ({
            focus: vi.fn(),
            jumpToLine: mockState.jumpToLine,
            setScrollRatio: mockState.setScrollRatio,
            scrollToLine: vi.fn(),
            execSearch: vi.fn(),
            restoreSearch: vi.fn(),
            getSelectedText: vi.fn(() => ''),
          })
        : null, [ready]);

      return React.createElement(
        'div',
        { 'data-ready': ready ? 'true' : 'false', 'data-testid': 'editor-pane' },
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
        {content.includes('- [ ]') ? (
          <ul className="cb">
            <li data-source-line="1">
              <input type="checkbox" data-task-checkbox-index="0" />
              First task
            </li>
          </ul>
        ) : null}
        {content.includes('- [x]') ? (
          <ul className="cb">
            <li className="strike" data-source-line="1">
              <input type="checkbox" data-task-checkbox-index="0" defaultChecked />
              First task
            </li>
          </ul>
        ) : null}
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

vi.mock('./PresentationOverlay', () => ({
  PresentationOverlay: ({ content, onClose }: { content: string; onClose: () => void }) => (
    <div role="dialog" aria-label="Prism 演示">
      <span>{content}</span>
      <button type="button" onClick={onClose}>关闭</button>
    </div>
  ),
}));

function installScrollIntoViewMock() {
  const original = HTMLElement.prototype.scrollIntoView;
  const scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;

  return {
    scrollIntoView,
    restore: () => {
      if (original) {
        HTMLElement.prototype.scrollIntoView = original;
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: Element['scrollIntoView'] }).scrollIntoView;
      }
    },
  };
}

function mockNavigatorPlatform(platform: string) {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: platform,
  });

  return () => {
    if (original) {
      Object.defineProperty(window.navigator, 'platform', original);
      return;
    }
    Reflect.deleteProperty(window.navigator, 'platform');
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SplitView editor lifecycle', () => {
  const originalSettings = useSettingsStore.getState();

  beforeEach(() => {
    mockState.jumpToLine.mockClear();
    mockState.setScrollRatio.mockClear();
    mockState.mountDelayFrames = 0;
    mockState.mounts = 0;
    mockState.unmounts = 0;
    useDocumentStore.setState({ currentDocument: null });
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      exportDefaults: { ...DEFAULT_SETTINGS.exportDefaults },
      setFontSize: originalSettings.setFontSize,
      setPreviewFontSize: originalSettings.setPreviewFontSize,
    });
  });

  it('keeps the editor mounted when switching through preview mode so undo history survives', async () => {
    const props = {
      content: 'hello Prism',
      onChange: vi.fn(),
      onCursorChange: vi.fn(),
    };
    const { rerender } = render(<SplitView {...props} viewMode="edit" />);

    expect(await screen.findByTestId('editor-pane')).toBeTruthy();
    expect(mockState.mounts).toBe(1);
    expect(mockState.unmounts).toBe(0);

    rerender(<SplitView {...props} viewMode="preview" />);

    expect(screen.getByTestId('editor-pane')).toHaveAttribute('data-ready', 'true');
    expect(screen.getByTestId('preview-pane')).toBeTruthy();
    expect(mockState.mounts).toBe(1);
    expect(mockState.unmounts).toBe(0);

    rerender(<SplitView {...props} viewMode="edit" />);

    expect(screen.getByTestId('editor-pane')).toHaveAttribute('data-ready', 'true');
    expect(mockState.mounts).toBe(1);
    expect(mockState.unmounts).toBe(0);
  });

  it('does not mount the hidden editor when a document starts in preview-only mode', () => {
    render(
      <SplitView
        content="preview-only startup"
        viewMode="preview"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('preview-pane')).toBeTruthy();
    expect(screen.queryByTestId('editor-pane')).toBeNull();
    expect(mockState.mounts).toBe(0);
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

  it('toggles task list checkboxes in preview-only mode without mounting the editor', () => {
    const onChange = vi.fn();
    render(
      <SplitView
        content="- [ ] First task"
        viewMode="preview"
        onChange={onChange}
        onCursorChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith('- [x] First task');
    expect(mockState.jumpToLine).not.toHaveBeenCalled();
    expect(screen.queryByTestId('editor-pane')).toBeNull();
  });

  it('unchecks task list checkboxes from the preview DOM', () => {
    const onChange = vi.fn();
    render(
      <SplitView
        content="- [x] First task"
        viewMode="preview"
        onChange={onChange}
        onCursorChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith('- [ ] First task');
    expect(mockState.jumpToLine).not.toHaveBeenCalled();
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

  it('zooms editor and preview font sizes with the platform font zoom wheel shortcut', async () => {
    const saveSettings = vi.fn(async () => undefined);
    useSettingsStore.setState({
      contentTheme: 'miaoyan',
      fontSize: 16,
      previewFontSize: 16,
      saveSettings,
    });
    const restorePlatform = mockNavigatorPlatform('MacIntel');

    try {
      const { container } = render(
        <SplitView
          content="Preview block"
          viewMode="split"
          onChange={vi.fn()}
          onCursorChange={vi.fn()}
        />,
      );
      const surface = container.firstElementChild as HTMLElement;
      const event = createEvent.wheel(surface, {
        deltaY: -120,
        metaKey: true,
      });

      fireEvent(surface, event);

      expect(event.defaultPrevented).toBe(true);
      await waitFor(() => {
        expect(useSettingsStore.getState().fontSize).toBe(17);
        expect(useSettingsStore.getState().previewFontSize).toBe(17);
      });
      expect(saveSettings).not.toHaveBeenCalled();
    } finally {
      restorePlatform();
    }
  });

  it('coalesces rapid font zoom wheel updates and persists once after zooming stops', async () => {
    vi.useFakeTimers();
    const saveSettings = vi.fn(async () => undefined);
    useSettingsStore.setState({
      contentTheme: 'miaoyan',
      fontSize: 16,
      previewFontSize: 16,
      saveSettings,
    });
    const restorePlatform = mockNavigatorPlatform('MacIntel');

    try {
      const { container } = render(
        <SplitView
          content="Preview block"
          viewMode="split"
          onChange={vi.fn()}
          onCursorChange={vi.fn()}
        />,
      );
      const surface = container.firstElementChild as HTMLElement;

      for (let index = 0; index < 5; index += 1) {
        fireEvent(surface, createEvent.wheel(surface, {
          deltaY: -80,
          metaKey: true,
        }));
      }

      expect(saveSettings).not.toHaveBeenCalled();
      expect(useSettingsStore.getState().fontSize).toBe(16);

      act(() => {
        vi.advanceTimersByTime(16);
      });

      expect(useSettingsStore.getState().fontSize).toBe(21);
      expect(useSettingsStore.getState().previewFontSize).toBe(21);
      expect(saveSettings).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(219);
      });
      expect(saveSettings).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });

      expect(saveSettings).toHaveBeenCalledTimes(1);
    } finally {
      restorePlatform();
    }
  });

  it('does not zoom document fonts while wheel events start from controls', () => {
    const setFontSize = vi.fn();
    const setPreviewFontSize = vi.fn();
    useSettingsStore.setState({ setFontSize, setPreviewFontSize });
    const restorePlatform = mockNavigatorPlatform('Win32');

    try {
      render(
        <SplitView
          content="Preview block"
          viewMode="split"
          onChange={vi.fn()}
          onCursorChange={vi.fn()}
        />,
      );
      const button = screen.getByRole('button', { name: '跳到源码' });
      const event = createEvent.wheel(button, {
        ctrlKey: true,
        deltaY: -120,
      });

      fireEvent(button, event);

      expect(event.defaultPrevented).toBe(false);
      expect(setFontSize).not.toHaveBeenCalled();
      expect(setPreviewFontSize).not.toHaveBeenCalled();
    } finally {
      restorePlatform();
    }
  });

  it('opens presentation overlay from the global presentation event when slides exist', async () => {
    const content = '# 第一页\n\n---\n\n# 第二页';
    expect(hasPresentationSlides(content)).toBe(true);
    render(
      <SplitView
        content={content}
        viewMode="preview"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-presentation-open', { detail: {} }));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Prism 演示' })).toBeTruthy();
    });
  });

  it('shows a notice instead of opening presentation overlay when there is only one slide', () => {
    const onNotice = vi.fn();
    render(
      <SplitView
        content="# 只有一页"
        viewMode="preview"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
        onNotice={onNotice}
      />,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-presentation-open', { detail: {} }));
    });

    expect(screen.queryByRole('dialog', { name: 'Prism 演示' })).toBeNull();
    expect(onNotice).toHaveBeenCalledWith('演示预览需要使用独立一行 --- 分隔至少两页内容。');
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

  it('debounces preview search input without scrolling during typing', async () => {
    vi.useFakeTimers();
    const { scrollIntoView, restore } = installScrollIntoViewMock();

    try {
      render(
        <SplitView
          content="alpha beta alpha"
          viewMode="preview"
          onChange={vi.fn()}
          onCursorChange={vi.fn()}
        />,
      );

      fireEvent.keyDown(window, {
        bubbles: true,
        cancelable: true,
        code: 'KeyF',
        key: 'f',
        metaKey: true,
      });
      fireEvent.change(screen.getByPlaceholderText('查找'), { target: { value: 'alpha' } });

      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(document.querySelectorAll('.preview-search-match')).toHaveLength(0);

      await act(async () => {
        vi.advanceTimersByTime(139);
      });

      expect(document.querySelectorAll('.preview-search-match')).toHaveLength(0);

      await act(async () => {
        vi.advanceTimersByTime(1);
        vi.advanceTimersByTime(16);
      });

      expect(document.querySelectorAll('.preview-search-match')).toHaveLength(2);
      expect(document.querySelectorAll('.preview-search-match--current')).toHaveLength(1);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('scrolls preview search when moving between matches', async () => {
    vi.useFakeTimers();
    const { scrollIntoView, restore } = installScrollIntoViewMock();

    try {
      render(
        <SplitView
          content="alpha beta alpha"
          viewMode="preview"
          onChange={vi.fn()}
          onCursorChange={vi.fn()}
        />,
      );

      fireEvent.keyDown(window, {
        bubbles: true,
        cancelable: true,
        code: 'KeyF',
        key: 'f',
        metaKey: true,
      });
      fireEvent.change(screen.getByPlaceholderText('查找'), { target: { value: 'alpha' } });

      await act(async () => {
        vi.advanceTimersByTime(140);
        vi.advanceTimersByTime(16);
      });

      expect(scrollIntoView).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTitle('下一个'));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(Array.from(document.querySelectorAll('.preview-search-match')).map((mark) => mark.className)).toEqual([
        'preview-search-match',
        'preview-search-match preview-search-match--current',
      ]);
    } finally {
      restore();
    }
  });

  it('clears preview search marks when closing document search', async () => {
    vi.useFakeTimers();

    render(
      <SplitView
        content="alpha beta alpha"
        viewMode="preview"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, {
      bubbles: true,
      cancelable: true,
      code: 'KeyF',
      key: 'f',
      metaKey: true,
    });
    fireEvent.change(screen.getByPlaceholderText('查找'), { target: { value: 'alpha' } });

    await act(async () => {
      vi.advanceTimersByTime(140);
      vi.advanceTimersByTime(16);
    });

    expect(document.querySelectorAll('.preview-search-match')).toHaveLength(2);

    fireEvent.click(screen.getByTitle('完成'));

    expect(screen.queryByPlaceholderText('查找')).toBeNull();
    expect(document.querySelectorAll('.preview-search-match')).toHaveLength(0);
  });

  it('closes document search when workspace search opens', async () => {
    vi.useFakeTimers();

    render(
      <SplitView
        content="alpha beta alpha"
        viewMode="preview"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, {
      bubbles: true,
      cancelable: true,
      code: 'KeyF',
      key: 'f',
      metaKey: true,
    });
    fireEvent.change(screen.getByPlaceholderText('查找'), { target: { value: 'alpha' } });

    await act(async () => {
      vi.advanceTimersByTime(140);
      vi.advanceTimersByTime(16);
    });

    expect(screen.getByPlaceholderText('查找')).toBeTruthy();
    expect(document.querySelectorAll('.preview-search-match')).toHaveLength(2);

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-search', {
        detail: { action: 'workspace', rootPath: '/repo/notes' },
      }));
    });

    expect(screen.queryByPlaceholderText('查找')).toBeNull();
    expect(document.querySelectorAll('.preview-search-match')).toHaveLength(0);
  });

  it('switches from preview to split before opening replace', async () => {
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', 'alpha beta alpha');
    useDocumentStore.getState().setViewMode('preview');

    function StoreBackedSplitView() {
      const currentViewMode = useDocumentStore((state) => state.currentDocument?.viewMode ?? 'preview');
      return (
        <SplitView
          content="alpha beta alpha"
          documentPath="/repo/current.md"
          viewMode={currentViewMode}
          onChange={vi.fn()}
          onCursorChange={vi.fn()}
        />
      );
    }

    render(<StoreBackedSplitView />);

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-search', { detail: { action: 'replace' } }));
    });

    expect(useDocumentStore.getState().currentDocument?.viewMode).toBe('split');
    expect(await screen.findByPlaceholderText('替换')).toBeTruthy();
    expect(screen.getByTestId('editor-pane')).toBeTruthy();
  });

  it('does not capture Cmd+Shift+F as document search', () => {
    render(
      <SplitView
        content="alpha beta alpha"
        viewMode="split"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, {
      bubbles: true,
      cancelable: true,
      code: 'KeyF',
      key: 'f',
      metaKey: true,
      shiftKey: true,
    });

    expect(screen.queryByPlaceholderText('查找')).toBeNull();
  });

  it('ignores workspace search events inside the document search panel', () => {
    render(
      <SplitView
        content="alpha beta alpha"
        viewMode="split"
        onChange={vi.fn()}
        onCursorChange={vi.fn()}
      />,
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-search', {
        detail: { action: 'workspace', rootPath: '/repo/notes' },
      }));
    });

    expect(screen.queryByPlaceholderText('查找')).toBeNull();
  });

  it('queues preview-only source jumps until the editor is mounted', async () => {
    vi.useFakeTimers();
    mockState.mountDelayFrames = 2;
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Current');
    useDocumentStore.getState().setViewMode('preview');

    function StoreBackedSplitView() {
      const currentViewMode = useDocumentStore((state) => state.currentDocument?.viewMode ?? 'preview');
      return (
        <SplitView
          content="Preview block"
          documentPath="/repo/current.md"
          viewMode={currentViewMode}
          onChange={vi.fn()}
          onCursorChange={vi.fn()}
        />
      );
    }

    render(<StoreBackedSplitView />);

    fireEvent.click(screen.getByRole('button', { name: '跳到源码' }));

    expect(useDocumentStore.getState().currentDocument?.viewMode).toBe('split');
    expect(mockState.jumpToLine).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(16 * 12);
    });

    expect(screen.getByTestId('editor-pane')).toHaveAttribute('data-ready', 'true');
    await act(async () => {
      vi.advanceTimersByTime(16 * 4);
    });

    expect(mockState.jumpToLine).toHaveBeenCalledWith(9);
  });
});

describe('SplitView font zoom helpers', () => {
  it('uses Command on Apple platforms and Ctrl on other desktop platforms', () => {
    expect(__splitViewFontZoomTesting.shouldUseFontZoomModifier(
      { ctrlKey: false, metaKey: true },
      'MacIntel',
    )).toBe(true);
    expect(__splitViewFontZoomTesting.shouldUseFontZoomModifier(
      { ctrlKey: true, metaKey: false },
      'MacIntel',
    )).toBe(false);
    expect(__splitViewFontZoomTesting.shouldUseFontZoomModifier(
      { ctrlKey: true, metaKey: false },
      'Win32',
    )).toBe(true);
  });

  it('accumulates small wheel deltas before changing font size', () => {
    expect(__splitViewFontZoomTesting.consumeFontZoomWheelDelta(-20, 0)).toEqual({
      remainder: -20,
      steps: 0,
    });
    expect(__splitViewFontZoomTesting.consumeFontZoomWheelDelta(-65, -20)).toEqual({
      remainder: -5,
      steps: 1,
    });
    expect(__splitViewFontZoomTesting.consumeFontZoomWheelDelta(180, 0)).toEqual({
      remainder: 20,
      steps: -2,
    });
  });

  it('clamps font sizes to the settings range', () => {
    expect(__splitViewFontZoomTesting.clampDocumentFontSize(4, 10, 32)).toBe(10);
    expect(__splitViewFontZoomTesting.clampDocumentFontSize(18.4, 10, 32)).toBe(18);
    expect(__splitViewFontZoomTesting.clampDocumentFontSize(48, 10, 32)).toBe(32);
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

  it('collects fast-path flat source maps without walking every descendant', () => {
    const preview = document.createElement('div');
    preview.appendChild(document.createComment('prism-preview-source-map:flat:2,2,4,4'));
    preview.insertAdjacentHTML('beforeend', [
      '<h2>标题</h2>',
      '<div class="prism-simple-table prism-simple-table--cols-2">',
      '<span>项目</span><span>状态</span><span>预览</span><span>通过</span>',
      '</div>',
      '<ul><li>列表项</li></ul>',
      '<pre>line 1\nline 2</pre>',
    ].join(''));

    const elements = collectCodeLineElements(preview);

    expect(elements.map((element) => element.line)).toEqual([2, 4, 8, 12]);
    expect(elements.map((element) => element.element.tagName)).toEqual(['H2', 'DIV', 'LI', 'PRE']);
    expect(elements.at(-1)?.endLine).toBe(13);
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
    const scrollMap = buildPreviewScrollMap(preview, elements);
    const maxDrift = samples.reduce((max, line) => {
      const scrollTop = lineToPreviewScrollTopInMap(line, scrollMap);
      expect(scrollTop).not.toBeNull();
      const roundTrippedLine = pageOffsetToLineInMap(scrollTop!, scrollMap);
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
