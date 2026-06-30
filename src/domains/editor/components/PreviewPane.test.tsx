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
const markmapMock = vi.hoisted(() => ({
  create: vi.fn(),
  fit: vi.fn(),
  setData: vi.fn(),
  transform: vi.fn(),
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
const plantUmlMock = vi.hoisted(() => ({
  createPlantUmlSvgElement: vi.fn(async (source: string) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('plantuml-image');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'PlantUML diagram');
    svg.setAttribute('data-plantuml-renderer', 'plantuml-little');
    svg.setAttribute('viewBox', '0 0 120 60');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = source;
    svg.append(text);
    return svg;
  }),
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

vi.mock('markmap-lib', () => ({
  Transformer: vi.fn(function Transformer() {
    return {
      transform: markmapMock.transform,
    };
  }),
}));

vi.mock('markmap-view', () => ({
  Markmap: {
    create: markmapMock.create,
  },
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

vi.mock('./plantUml', () => ({
  createPlantUmlSvgElement: plantUmlMock.createPlantUmlSvgElement,
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
    markmapMock.create.mockReset();
    markmapMock.create.mockReturnValue({ destroy: vi.fn(), fit: markmapMock.fit, setData: markmapMock.setData });
    markmapMock.fit.mockReset();
    markmapMock.fit.mockResolvedValue(undefined);
    markmapMock.setData.mockReset();
    markmapMock.setData.mockImplementation((root) => {
      const svg = document.querySelector('.markmap-placeholder svg.markmap-svg');
      if (svg) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('markmap-node');
        svg.append(group);
      }
      return Promise.resolve(root);
    });
    markmapMock.transform.mockReset();
    markmapMock.transform.mockReturnValue({ root: { content: 'Root', children: [] } });
    plantUmlMock.createPlantUmlSvgElement.mockClear();
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
    __previewPaneTesting.clearMarkmapCache();
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

  it('uses the active theme preview font size while the user setting is still default', () => {
    document.documentElement.setAttribute('data-content-theme', 'miaoyan');

    render(<PreviewPane content="# Hello" />);

    const write = document.querySelector<HTMLElement>('#write');
    expect(write?.style.fontSize).toBe('16px');
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
    expect(__previewPaneTesting.getMermaidDisplayScale('miaoyan')).toBe(1);
    expect(__previewPaneTesting.getMermaidDisplayScale('inkstone')).toBe(1);
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

  it('renders PlantUML placeholders as local inline SVG diagrams', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      `<div class="plantuml-placeholder" data-plantuml="${encodeURIComponent('@startuml\nAlice -> Bob\n@enduml')}" data-source-line="4"></div>`,
    );

    render(<PreviewPane content="```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```" renderStrategy="immediate" />);

    const image = await screen.findByLabelText('PlantUML diagram');
    expect(image.tagName.toLowerCase()).toBe('svg');
    expect(image).toHaveClass('plantuml-image');
    expect(image).toHaveAttribute('data-plantuml-renderer', 'plantuml-little');
    expect(image).not.toHaveAttribute('src');
    expect(image.textContent).toContain('Alice');
    expect(image.textContent).toContain('Bob');
    expect(plantUmlMock.createPlantUmlSvgElement).toHaveBeenCalledWith(
      '@startuml\nAlice -> Bob\n@enduml',
      'inkstone',
      { documentPath: undefined },
    );
  });

  it('renders Markmap placeholders as interactive SVG diagrams', async () => {
    document.documentElement.setAttribute('data-content-theme', 'miaoyan');
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      `<div class="markmap-placeholder" data-markmap="${encodeURIComponent('# 项目\n- 用户\n- 场景')}" data-source-line="6"></div>`,
    );

    render(<PreviewPane content="```markmap\n# 项目\n- 用户\n- 场景\n```" renderStrategy="immediate" />);

    await waitFor(() => {
      expect(markmapMock.transform).toHaveBeenCalledWith('# 项目\n- 用户\n- 场景');
    });
    expect(markmapMock.create).toHaveBeenCalledTimes(1);
    expect(markmapMock.create).toHaveBeenCalledWith(expect.any(SVGElement), expect.any(Object));
    await waitFor(() => {
      expect(markmapMock.setData).toHaveBeenCalledWith({ content: 'Root', children: [] });
      expect(markmapMock.fit).toHaveBeenCalledTimes(1);
    });
    const svg = document.querySelector('.markmap-placeholder svg.markmap-svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Markmap diagram');
    expect(svg).toHaveStyle({ height: '450px', minHeight: '450px', width: '100%' });
  });

  it('uses a static SVG Markmap fallback on WebKit so macOS WebView does not render a blank canvas', async () => {
    const originalUserAgent = window.navigator.userAgent;
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    markmapMock.transform.mockReturnValueOnce({
      root: {
        content: '&#x804a;&#x658b;&#x5fd7;&#x5f02;&#xb7;&#x5a74;&#x5b81;',
        children: [
          { content: '<strong>&#x738b;&#x5b50;&#x670d;</strong>', children: [{ content: '&#x8eab;&#x4efd;&#xff1a;&#x4e66;&#x751f;' }] },
          { content: '<strong>&#x5a74;&#x5b81;</strong>', children: [{ content: '&#x7279;&#x5f81;&#xff1a;&#x5584;&#x7b11;&#x5982;&#x82b1;' }] },
        ],
      },
    });
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      `<div class="markmap-placeholder" data-markmap="${encodeURIComponent('# 聊斋志异·婴宁\n- 王子服\n- 婴宁')}" data-source-line="6"></div>`,
    );

    try {
      render(<PreviewPane content="```markmap\n# 聊斋志异·婴宁\n- 王子服\n- 婴宁\n```" renderStrategy="immediate" />);

      await waitFor(() => {
        expect(document.querySelectorAll('.markmap-placeholder .markmap-node').length).toBeGreaterThan(0);
      });

      const svg = document.querySelector('.markmap-placeholder svg.markmap-svg');
      expect(svg).toHaveAttribute('data-markmap-renderer', 'static');
      expect(svg?.textContent).toContain('聊斋志异·婴宁');
      expect(svg?.textContent).toContain('王子服');
      expect(svg?.textContent).toContain('婴宁');
      expect(markmapMock.create).not.toHaveBeenCalled();
      expect(markmapMock.setData).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        value: originalUserAgent,
      });
    }
  });

  it('renders Markmap failures as source-locatable diagnostics', async () => {
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      `<div class="markmap-placeholder" data-markmap="${encodeURIComponent('# 项目\n- 用户')}" data-source-line="9"></div>`,
    );
    markmapMock.transform.mockImplementationOnce(() => {
      throw new Error('bad markmap');
    });

    render(<PreviewPane content="```markmap\n# 项目\n- 用户\n```" renderStrategy="immediate" />);

    await waitFor(() => {
      expect(screen.getByText('Markmap 渲染失败')).toBeInTheDocument();
    });
    expect(screen.getByText('bad markmap')).toBeInTheDocument();
    expect(screen.getByText('源码行 9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳到源码' })).toHaveAttribute('data-preview-source-line', '9');
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

  it('keeps rendered Mermaid SVGs at their natural diagram size instead of stretching to the preview width', async () => {
    document.documentElement.setAttribute('data-content-theme', 'miaoyan');
    const mermaidHtml = `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent('graph TD; A-->B')}" data-source-line="2"></div>`;
    vi.mocked(markdownToHtml).mockReturnValue(mermaidHtml);
    mermaidMock.render.mockResolvedValueOnce({
      svg: '<svg width="100%" height="360" viewBox="0 0 420 360"><text>Diagram</text></svg>',
    });

    render(<PreviewPane content="```mermaid\ngraph TD; A-->B\n```" renderStrategy="immediate" />);

    await waitFor(() => {
      const svg = document.querySelector<SVGSVGElement>('.mermaid-placeholder svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.style.width).toBe('420px');
    });
    const svg = document.querySelector<SVGSVGElement>('.mermaid-placeholder svg');
    expect(svg?.getAttribute('width')).toBe('420');
    expect(svg?.getAttribute('height')).toBe('360');
    expect(svg?.style.maxWidth).toBe('min(100%, 920px)');
    expect(svg?.style.height).toBe('auto');
    expect(mermaidMock.initialize).toHaveBeenCalledWith(expect.objectContaining({
      flowchart: expect.objectContaining({ useMaxWidth: true, curve: 'basis' }),
      sequence: expect.objectContaining({ useMaxWidth: true }),
      gantt: expect.objectContaining({ useMaxWidth: true }),
      journey: expect.objectContaining({ useMaxWidth: true }),
    }));
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

    const katexError = await screen.findByText('\\bad');
    await waitFor(() => {
      expect(katexError).toHaveClass('preview-katex-error');
    });
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

  it('scrolls same-document hash links inside the preview', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(markdownToHtml).mockReturnValueOnce(
      '<nav><a href="#%E6%96%87%E6%9C%AC%E6%A0%BC%E5%BC%8F">文本格式</a></nav><h2 id="文本格式">文本格式标题</h2>',
    );

    try {
      render(<PreviewPane content="[文本格式](#文本格式)" renderStrategy="immediate" />);
      await flushPreviewRender();

      fireEvent.click(await screen.findByText('文本格式'));

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
      expect(openerMock.openUrl).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
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
