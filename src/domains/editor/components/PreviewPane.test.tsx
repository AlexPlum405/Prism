import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markdownToHtml } from '../../../lib/markdownToHtml';
import { useSettingsStore } from '../../settings/store';
import { DEFAULT_SETTINGS } from '../../settings/types';
import { __previewPaneTesting, PreviewPane } from './PreviewPane';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));
const katexMock = vi.hoisted(() => ({
  renderToString: vi.fn((value: string, options: { displayMode?: boolean } = {}) => (
    options.displayMode
      ? `<span class="katex-display"><span class="katex-html">${value}</span></span>`
      : `<span class="katex"><span class="katex-html">${value}</span></span>`
  )),
}));
const openerMock = vi.hoisted(() => ({
  openUrl: vi.fn(),
}));
const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));
const renderServiceMock = vi.hoisted(() => ({
  render: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: fsMock.readFile,
  stat: fsMock.stat,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: openerMock.openUrl,
}));

vi.mock('mermaid', () => ({
  default: mermaidMock,
}));

vi.mock('katex', () => ({
  default: katexMock,
}));

vi.mock('../../../lib/markdownToHtml', () => ({
  markdownToHtml: vi.fn(() => '<p>Hello preview</p>'),
}));

vi.mock('../../../lib/markdownRenderService', () => ({
  markdownRenderService: renderServiceMock,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

async function flushPreviewRender() {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) {
      await Promise.resolve();
    }
  });
}

describe('PreviewPane theme switching', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-content-theme', 'inkstone');
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      exportDefaults: { ...DEFAULT_SETTINGS.exportDefaults },
    });
    vi.mocked(markdownToHtml).mockReset();
    vi.mocked(markdownToHtml).mockReturnValue('<p>Hello preview</p>');
    renderServiceMock.render.mockReset();
    renderServiceMock.render.mockImplementation((content: string, options: any) => (
      Promise.resolve({
        html: vi.mocked(markdownToHtml)(content, options),
        stale: false,
        timing: {
          elapsedMs: 1,
          markdownToHtmlMs: 1,
          mode: 'main',
        },
      })
    ));
    mermaidMock.initialize.mockReset();
    mermaidMock.render.mockReset();
    mermaidMock.render.mockResolvedValue({ svg: '<svg viewBox="0 0 10 10"></svg>' });
    katexMock.renderToString.mockClear();
    openerMock.openUrl.mockReset();
    fsMock.readFile.mockReset();
    fsMock.readFile.mockResolvedValue(new Uint8Array([60, 115, 118, 103, 62]));
    fsMock.stat.mockReset();
    fsMock.stat.mockResolvedValue({
      atime: null,
      birthtime: null,
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      mtime: new Date('2026-06-12T00:00:00Z'),
      readonly: false,
      size: 5,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:prism-preview-media'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    __previewPaneTesting.clearKatexCache();
    __previewPaneTesting.clearMermaidCache();
    __previewPaneTesting.clearPreviewMediaCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('does not rerun the markdown pipeline when only the content theme changes', async () => {
    render(<PreviewPane content="# Hello" />);
    await flushPreviewRender();

    expect(markdownToHtml).toHaveBeenCalledTimes(1);
    expect(markdownToHtml).toHaveBeenLastCalledWith('# Hello', { frontMatterMode: 'metadata' });

    act(() => {
      document.documentElement.setAttribute('data-content-theme', 'slate');
    });

    await waitFor(() => {
      expect(document.querySelector('.preview-compat--slate')).toBeInTheDocument();
    });
    expect(markdownToHtml).toHaveBeenCalledTimes(1);
  });

  it('applies preview font settings to the write surface', () => {
    useSettingsStore.setState({
      previewFontFamily: 'Georgia, serif',
      previewFontSource: { kind: 'builtin', value: 'Georgia, serif' },
      previewFontSize: 21,
    });

    render(<PreviewPane content="# Hello" />);

    const write = document.querySelector<HTMLElement>('#write');
    expect(write?.style.fontFamily).toBe('Georgia, serif');
    expect(write?.style.fontSize).toBe('21px');
  });

  it('debounces expensive markdown rendering across rapid content changes', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<PreviewPane content="# First" />);
    await flushPreviewRender();

    expect(markdownToHtml).toHaveBeenCalledTimes(1);

    rerender(<PreviewPane content="# Second" />);
    rerender(<PreviewPane content="# Third" />);

    expect(markdownToHtml).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(markdownToHtml).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    await flushPreviewRender();

    expect(markdownToHtml).toHaveBeenCalledTimes(2);
    expect(markdownToHtml).toHaveBeenLastCalledWith('# Third', { frontMatterMode: 'metadata' });
  });

  it('uses size-aware preview render scheduling for medium and large documents', () => {
    expect(__previewPaneTesting.getPreviewRenderDebounceMs(8 * 1024)).toBe(120);
    expect(__previewPaneTesting.getPreviewRenderDebounceMs(80 * 1024)).toBe(220);
    expect(__previewPaneTesting.getPreviewRenderDebounceMs(360 * 1024)).toBe(600);
    expect(__previewPaneTesting.shouldShowPreviewUpdatingStatus(360 * 1024)).toBe(true);
    expect(__previewPaneTesting.getPreviewMarkdownRenderOptions(80 * 1024)).toEqual({ frontMatterMode: 'metadata' });
    expect(__previewPaneTesting.getPreviewMarkdownRenderOptions(360 * 1024)).toEqual({
      autoDetectUnlabeledCode: false,
      frontMatterMode: 'metadata',
      highlightCode: false,
      lightweightTables: true,
      renderMath: false,
    });
    expect(__previewPaneTesting.getKatexPreviewBatchSize(24)).toBe(1);
    expect(__previewPaneTesting.getKatexPreviewBatchSize(25)).toBe(12);
    expect(__previewPaneTesting.getMermaidPreviewBatchSize(10)).toBe(1);
    expect(__previewPaneTesting.getMermaidPreviewBatchSize(11)).toBe(3);
  });

  it('throttles large-document preview updates and shows a lightweight pending status', async () => {
    vi.useFakeTimers();
    const first = `# First\n${'一'.repeat(310 * 1024)}`;
    const second = `# Second\n${'二'.repeat(310 * 1024)}`;
    const { rerender } = render(<PreviewPane content={first} />);
    await flushPreviewRender();

    expect(markdownToHtml).toHaveBeenCalledTimes(1);

    rerender(<PreviewPane content={second} />);

    expect(screen.getByRole('status')).toHaveTextContent('预览更新中');
    expect(markdownToHtml).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(markdownToHtml).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    await flushPreviewRender();

    expect(markdownToHtml).toHaveBeenCalledTimes(2);
    expect(markdownToHtml).toHaveBeenLastCalledWith(second, {
      autoDetectUnlabeledCode: false,
      frontMatterMode: 'metadata',
      highlightCode: false,
      lightweightTables: true,
      renderMath: false,
    });
    await flushPreviewRender();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('flushes pending preview work immediately when preview-only mode needs the final render', async () => {
    vi.useFakeTimers();
    const first = `# First\n${'一'.repeat(310 * 1024)}`;
    const second = `# Second\n${'二'.repeat(310 * 1024)}`;
    const { rerender } = render(<PreviewPane content={first} />);
    await flushPreviewRender();

    rerender(<PreviewPane content={second} />);

    expect(screen.getByRole('status')).toHaveTextContent('预览更新中');
    expect(markdownToHtml).toHaveBeenCalledTimes(1);

    rerender(<PreviewPane content={second} renderStrategy="immediate" />);
    await flushPreviewRender();

    expect(markdownToHtml).toHaveBeenCalledTimes(2);
    expect(markdownToHtml).toHaveBeenLastCalledWith(second, {
      autoDetectUnlabeledCode: false,
      frontMatterMode: 'metadata',
      highlightCode: false,
      lightweightTables: true,
      renderMath: false,
    });
    await flushPreviewRender();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(markdownToHtml).toHaveBeenCalledTimes(2);
  });

  it('refreshes source-line anchors after debounced content changes', async () => {
    vi.useFakeTimers();
    vi.mocked(markdownToHtml).mockImplementation((content) => (
      content.includes('Updated')
        ? '<h2 data-source-line="80">Updated section</h2><p data-source-line="81">Fresh preview</p>'
        : '<h2 data-source-line="20">Initial section</h2><p data-source-line="21">Stale preview</p>'
    ));

    const { rerender } = render(<PreviewPane content="## Initial section" />);

    await flushPreviewRender();
    expect(document.querySelector('[data-source-line="20"]')).toHaveTextContent('Initial section');

    rerender(<PreviewPane content="## Updated section" />);

    expect(document.querySelector('[data-source-line="20"]')).toHaveTextContent('Initial section');

    act(() => {
      vi.advanceTimersByTime(120);
    });

    await flushPreviewRender();
    expect(document.querySelector('[data-source-line="20"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-source-line="80"]')).toHaveTextContent('Updated section');
    expect(document.querySelector('[data-source-line="81"]')).toHaveTextContent('Fresh preview');
  });

  it('resolves relative preview images against the current document path', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      [
        '<p>',
        '<img alt="local" src="assets/preview-1.png">',
        '<img alt="absolute" src="/Users/Alex/Pictures/preview-2.png">',
        '<img alt="remote" src="https://example.com/preview-3.png">',
        '</p>',
      ].join(''),
    );

    render(<PreviewPane content="images" documentPath="/Users/Alex/Notes/Plan.md" />);

    await waitFor(() => {
      expect(fsMock.readFile).toHaveBeenCalledWith('/Users/Alex/Notes/assets/preview-1.png');
    });
    expect(fsMock.readFile).toHaveBeenCalledWith('/Users/Alex/Pictures/preview-2.png');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(screen.getByAltText('local')).toHaveAttribute('src', 'blob:prism-preview-media');
    expect(screen.getByAltText('absolute')).toHaveAttribute('src', 'blob:prism-preview-media');
    expect(screen.getByAltText('remote')).toHaveAttribute('src', 'https://example.com/preview-3.png');
  });

  it('reuses cached local preview images when the file signature is unchanged', async () => {
    vi.mocked(markdownToHtml).mockReturnValue(
      '<p><img alt="local" src="assets/preview-1.png"></p>',
    );

    const first = render(<PreviewPane content="images" documentPath="/Users/Alex/Notes/Plan.md" />);

    await waitFor(() => {
      expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByAltText('local')).toHaveAttribute('src', 'blob:prism-preview-media');
    first.unmount();

    render(<PreviewPane content="images" documentPath="/Users/Alex/Notes/Plan.md" />);

    await waitFor(() => {
      expect(screen.getByAltText('local')).toHaveAttribute('src', 'blob:prism-preview-media');
    });
    expect(fsMock.stat).toHaveBeenCalledTimes(2);
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('renders Mermaid failures as source-locatable diagnostics', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD')}" data-source-line="4"></div>`,
    );
    mermaidMock.render.mockRejectedValueOnce(new Error('bad <graph>'));

    render(<PreviewPane content="```mermaid\ngraph TD\n```" />);

    await waitFor(() => {
      expect(screen.getByText('Mermaid 渲染失败')).toBeInTheDocument();
    });
    expect(screen.getByText('bad <graph>')).toBeInTheDocument();
    expect(screen.getByText('源码行 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳到源码' })).toHaveAttribute('data-preview-source-line', '4');
  });

  it('keeps Mermaid parser error artifacts out of the app body', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD\n  A -->')}" data-source-line="12"></div>`,
    );
    let sandboxWasConnectedDuringRender = false;
    mermaidMock.render.mockImplementationOnce(async (_id, _code, renderContainer?: Element) => {
      sandboxWasConnectedDuringRender = renderContainer?.isConnected ?? false;
      const libraryErrorSvg = document.createElement('svg');
      libraryErrorSvg.dataset.testid = 'mermaid-library-error-artifact';
      libraryErrorSvg.textContent = 'Syntax error in text';
      (renderContainer ?? document.body).appendChild(libraryErrorSvg);
      throw new Error('Syntax error in text');
    });

    render(<PreviewPane content="```mermaid\ngraph TD\n  A -->\n```" />);

    await waitFor(() => {
      expect(screen.getByText('Mermaid 渲染失败')).toBeInTheDocument();
    });

    const renderContainer = mermaidMock.render.mock.calls[0][2] as Element | undefined;
    expect(renderContainer).toBeInstanceOf(HTMLElement);
    expect((renderContainer as HTMLElement | undefined)?.dataset.prismMermaidSandbox).toBe('true');
    expect(sandboxWasConnectedDuringRender).toBe(true);
    expect(renderContainer?.isConnected).toBe(false);
    expect(document.body.querySelector('[data-testid="mermaid-library-error-artifact"]')).not.toBeInTheDocument();
    expect(screen.getByText('Syntax error in text')).toBeInTheDocument();
  });

  it('reuses cached Mermaid SVG for the same diagram and content theme', async () => {
    const mermaidHtml = `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD; A-->B')}" data-source-line="2"></div>`;
    vi.mocked(markdownToHtml).mockReturnValue(mermaidHtml);

    const first = render(<PreviewPane content="```mermaid\ngraph TD; A-->B\n```" />);

    await waitFor(() => {
      expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    });
    first.unmount();

    render(<PreviewPane content="```mermaid\ngraph TD; A-->B\n```" />);

    await waitFor(() => {
      expect(document.querySelector('.mermaid-placeholder svg')).toBeInTheDocument();
    });
    expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    expect(mermaidMock.initialize).toHaveBeenCalledTimes(1);
  });

  it('applies cached Mermaid SVGs without waiting for frame batches', async () => {
    const mermaidHtml = Array.from({ length: 11 }, (_, index) => (
      `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent(`graph TD; A${index}-->B${index}`)}" data-source-line="${index + 1}"></div>`
    )).join('');
    vi.mocked(markdownToHtml).mockReturnValue(mermaidHtml);
    mermaidMock.render.mockResolvedValue({ svg: '<svg data-testid="cached-mermaid"></svg>' });

    const first = render(<PreviewPane content="many diagrams" />);

    await waitFor(() => {
      expect(document.querySelectorAll('.mermaid-placeholder svg')).toHaveLength(11);
    });
    expect(mermaidMock.render).toHaveBeenCalledTimes(11);
    first.unmount();
    mermaidMock.render.mockClear();

    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const frameCallbacks: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      }),
    });

    try {
      render(<PreviewPane content="many diagrams" />);

      await waitFor(() => {
        expect(document.querySelectorAll('.mermaid-placeholder svg')).toHaveLength(11);
      });
      expect(mermaidMock.render).not.toHaveBeenCalled();
      expect(frameCallbacks.length).toBeGreaterThanOrEqual(11);
    } finally {
      if (originalRequestAnimationFrame) {
        Object.defineProperty(window, 'requestAnimationFrame', {
          configurable: true,
          value: originalRequestAnimationFrame,
        });
      } else {
        Reflect.deleteProperty(window, 'requestAnimationFrame');
      }
    }
  });

  it('waits for the Mermaid preview font only once per theme', async () => {
    const originalFontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
    const fontLoad = vi.fn(() => Promise.resolve([]));
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load: fontLoad,
        ready: Promise.resolve(),
      },
    });
    vi.mocked(markdownToHtml)
      .mockReturnValueOnce(
        `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD; A-->B')}" data-source-line="2"></div>`,
      )
      .mockReturnValueOnce(
        `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD; B-->C')}" data-source-line="2"></div>`,
      );

    try {
      const first = render(<PreviewPane content="first diagram" />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(1);
      });
      first.unmount();

      render(<PreviewPane content="second diagram" />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(2);
      });
      expect(fontLoad).toHaveBeenCalledTimes(1);
    } finally {
      if (originalFontsDescriptor) {
        Object.defineProperty(document, 'fonts', originalFontsDescriptor);
      } else {
        Reflect.deleteProperty(document, 'fonts');
      }
    }
  });

  it('renders multiple Mermaid diagrams sequentially instead of starting them all at once', async () => {
    const firstRender = deferred<{ svg: string }>();
    const secondRender = deferred<{ svg: string }>();
    vi.mocked(markdownToHtml).mockReturnValue(
      [
        `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD; A-->B')}" data-source-line="2"></div>`,
        `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD; B-->C')}" data-source-line="6"></div>`,
      ].join(''),
    );
    mermaidMock.render
      .mockReturnValueOnce(firstRender.promise)
      .mockReturnValueOnce(secondRender.promise);

    render(<PreviewPane content="two diagrams" />);

    await waitFor(() => {
      expect(mermaidMock.render).toHaveBeenCalledTimes(1);
    });

    expect(mermaidMock.render.mock.calls[0][1]).toBe('graph TD; A-->B');

    await act(async () => {
      firstRender.resolve({ svg: '<svg data-testid="first-mermaid"></svg>' });
      await firstRender.promise;
    });

    await waitFor(() => {
      expect(mermaidMock.render).toHaveBeenCalledTimes(2);
    });

    expect(mermaidMock.render.mock.calls[1][1]).toBe('graph TD; B-->C');

    await act(async () => {
      secondRender.resolve({ svg: '<svg data-testid="second-mermaid"></svg>' });
      await secondRender.promise;
    });

    await waitFor(() => {
      expect(document.querySelectorAll('.mermaid-placeholder svg')).toHaveLength(2);
    });
  });

  it('starts Mermaid rendering without waiting for idle scheduling in immediate preview mode', async () => {
    const originalRequestIdleCallback = window.requestIdleCallback;
    const originalCancelIdleCallback = window.cancelIdleCallback;
    const idleCallbacks: IdleRequestCallback[] = [];
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: vi.fn((callback: IdleRequestCallback) => {
        idleCallbacks.push(callback);
        return idleCallbacks.length;
      }),
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(markdownToHtml).mockReturnValue(
      `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD; A-->B')}" data-source-line="2"></div>`,
    );

    try {
      render(<PreviewPane content="```mermaid\ngraph TD; A-->B\n```" renderStrategy="immediate" />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(1);
      });
      expect(idleCallbacks).toHaveLength(0);
    } finally {
      if (originalRequestIdleCallback) {
        Object.defineProperty(window, 'requestIdleCallback', {
          configurable: true,
          value: originalRequestIdleCallback,
        });
      } else {
        Reflect.deleteProperty(window, 'requestIdleCallback');
      }
      if (originalCancelIdleCallback) {
        Object.defineProperty(window, 'cancelIdleCallback', {
          configurable: true,
          value: originalCancelIdleCallback,
        });
      } else {
        Reflect.deleteProperty(window, 'cancelIdleCallback');
      }
    }
  });

  it('yields a frame between Mermaid batches for diagram-heavy previews', async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const frameCallbacks: FrameRequestCallback[] = [];
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      }),
    });
    vi.mocked(markdownToHtml).mockReturnValue(
      Array.from({ length: 11 }, (_, index) => (
        `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent(`graph TD; A${index}-->B${index}`)}" data-source-line="${index + 1}"></div>`
      )).join(''),
    );
    mermaidMock.render.mockResolvedValue({ svg: '<div data-testid="rendered-mermaid"></div>' });

    try {
      render(<PreviewPane content="many diagrams" />);

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(3);
      });
      expect(frameCallbacks).toHaveLength(1);

      await act(async () => {
        frameCallbacks.shift()?.(performance.now());
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mermaidMock.render).toHaveBeenCalledTimes(6);
      });
    } finally {
      if (originalRequestAnimationFrame) {
        Object.defineProperty(window, 'requestAnimationFrame', {
          configurable: true,
          value: originalRequestAnimationFrame,
        });
      } else {
        Reflect.deleteProperty(window, 'requestAnimationFrame');
      }
    }
  });

  it('enhances KaTeX errors with source navigation actions', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      '<p data-source-line="7"><span class="katex-error" title="KaTeX parse error: bad command">\\bad</span></p>',
    );

    render(<PreviewPane content="$\\bad$" />);

    expect(await screen.findByText('\\bad')).toHaveClass('preview-katex-error');
    expect(screen.getByText('\\bad')).toHaveAttribute('data-preview-source-line', '7');
    expect(screen.getByRole('button', { name: '跳到源码' })).toHaveAttribute('data-preview-source-line', '7');
  });

  it('hydrates deferred KaTeX placeholders after the preview HTML is committed', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      `<p data-source-line="3">公式 <span class="katex-placeholder" data-katex="${encodeURIComponent('a^2')}" data-katex-display="false">a^2</span></p>`,
    );

    render(<PreviewPane content="$a^2$" renderStrategy="immediate" />);

    expect(await screen.findByText('a^2')).toHaveClass('katex-placeholder');

    await waitFor(() => {
      expect(katexMock.renderToString).toHaveBeenCalledWith('a^2', {
        displayMode: false,
        throwOnError: true,
      });
      expect(screen.getByText('a^2')).toHaveClass('katex-html');
    });
  });

  it('opens absolute http links through the system opener', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce('<a href="https://example.com/docs">外部链接</a>');

    render(<PreviewPane content="[外部链接](https://example.com/docs)" />);
    fireEvent.click(await screen.findByText('外部链接'));

    await waitFor(() => {
      expect(openerMock.openUrl).toHaveBeenCalledWith('https://example.com/docs');
    });
  });

  it('opens protocol-relative http links through the system opener', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce('<a href="//example.com/docs">协议相对外链</a>');

    render(<PreviewPane content="[协议相对外链](//example.com/docs)" />);
    fireEvent.click(await screen.findByText('协议相对外链'));

    await waitFor(() => {
      expect(openerMock.openUrl).toHaveBeenCalledWith(expect.stringMatching(/^https?:\/\/example\.com\/docs$/));
    });
  });

  it('blocks non-http preview links such as javascript urls', async () => {
    const onNotice = vi.fn();
    vi.mocked(markdownToHtml).mockReturnValueOnce('<a href="javascript:alert(1)">危险链接</a>');

    render(<PreviewPane content="[危险链接](javascript:alert(1))" onNotice={onNotice} />);
    fireEvent.click(await screen.findByText('危险链接'));

    expect(openerMock.openUrl).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith('预览中的链接不可打开');
  });

  it('blocks local preview links and reports a notice', async () => {
    const onNotice = vi.fn();
    vi.mocked(markdownToHtml).mockReturnValueOnce('<a href="docs/local.md">本地链接</a>');

    render(<PreviewPane content="[本地链接](docs/local.md)" onNotice={onNotice} />);
    fireEvent.click(await screen.findByText('本地链接'));

    expect(openerMock.openUrl).not.toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith('预览中的本地链接已拦截，请通过文件树打开');
  });

  it('opens local markdown links through the document link handler', async () => {
    const onOpenDocumentLink = vi.fn();
    vi.mocked(markdownToHtml).mockReturnValueOnce('<a href="docs/local.md">本地链接</a>');

    render(
      <PreviewPane
        content="[本地链接](docs/local.md)"
        documentPath="/repo/current.md"
        onOpenDocumentLink={onOpenDocumentLink}
      />,
    );
    fireEvent.click(await screen.findByText('本地链接'));

    await waitFor(() => {
      expect(onOpenDocumentLink).toHaveBeenCalledWith('docs/local.md', {
        kind: 'markdown',
        sourcePath: '/repo/current.md',
      });
    });
  });

  it('opens wiki document links through the document link handler', async () => {
    const onOpenDocumentLink = vi.fn();
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      '<a href="#" class="prism-wiki-link" data-prism-wiki-target="manual-test">manual-test</a>',
    );

    render(
      <PreviewPane
        content="[[manual-test]]"
        documentPath="/repo/current.md"
        onOpenDocumentLink={onOpenDocumentLink}
      />,
    );
    fireEvent.click(await screen.findByText('manual-test'));

    await waitFor(() => {
      expect(onOpenDocumentLink).toHaveBeenCalledWith('manual-test', {
        kind: 'wiki',
        sourcePath: '/repo/current.md',
      });
    });
  });
});
