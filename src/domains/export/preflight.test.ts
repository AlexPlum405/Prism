import { beforeEach, describe, expect, it, vi } from 'vitest';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async () => ({ svg: '<svg></svg>' })),
}));

const fsMock = vi.hoisted(() => ({
  exists: vi.fn(async () => true),
}));
const markdownToHtmlMock = vi.hoisted(() => vi.fn(() => ''));

vi.mock('mermaid', () => ({ default: mermaidMock }));
vi.mock('@tauri-apps/plugin-fs', () => fsMock);
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../../lib/markdownToHtml', () => ({ markdownToHtml: markdownToHtmlMock }));

import {
  buildExportPreflightDiagnostics,
  scanMarkdownKatexDiagnostics,
  scanMarkdownRenderDiagnostics,
} from './preflight';

describe('export preflight diagnostics', () => {
  beforeEach(() => {
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockReset();
    mermaidMock.render.mockResolvedValue({ svg: '<svg></svg>' });
    fsMock.exists.mockReset();
    fsMock.exists.mockResolvedValue(true);
    markdownToHtmlMock.mockClear();
  });

  it('blocks export when local images are missing', async () => {
    fsMock.exists.mockResolvedValue(false);

    const diagnostics = await buildExportPreflightDiagnostics({
      content: '![missing](assets/missing.png)',
      documentPath: '/repo/docs/page.md',
      format: 'pdf',
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        kind: 'image',
        line: 1,
        severity: 'error',
        source: 'image-diagnostics',
      }),
    ]);
    expect(fsMock.exists).toHaveBeenCalledWith('/repo/docs/assets/missing.png');
  });

  it('reports Mermaid parser failures before export starts', async () => {
    mermaidMock.render.mockRejectedValueOnce(new Error('Parse error'));

    const diagnostics = await buildExportPreflightDiagnostics({
      content: '```mermaid\ngraph TD\n  A -->\n```',
      documentPath: '/repo/docs/page.md',
      format: 'html',
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        kind: 'render',
        line: 1,
        message: 'Mermaid 渲染失败：Parse error',
        source: 'render-diagnostics',
      }),
    ]);
  });

  it('reports duplicate heading anchors before export starts', async () => {
    const diagnostics = await buildExportPreflightDiagnostics({
      content: '# Intro\n\n## Intro',
      documentPath: '/repo/docs/page.md',
      format: 'docx',
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        kind: 'link',
        line: 3,
        message: '标题锚点 #intro 与第 1 行重复',
        source: 'heading-diagnostics',
      }),
    ]);
  });

  it('reports markdown table diagnostics before export starts', async () => {
    const diagnostics = await buildExportPreflightDiagnostics({
      content: '| A | B |\n| 1 | 2 |',
      documentPath: '/repo/docs/page.md',
      format: 'pdf',
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        kind: 'table',
        line: 1,
        severity: 'error',
        source: 'table-diagnostics',
      }),
    ]);
  });

  it('reports KaTeX render errors with source locations when available', () => {
    const diagnostics = scanMarkdownKatexDiagnostics('公式：$\\badcommand$');

    expect(diagnostics[0]).toMatchObject({
      kind: 'render',
      line: 1,
      severity: 'error',
      source: 'render-diagnostics',
    });
  });

  it('skips full preview rendering in lightweight live diagnostics', async () => {
    const diagnostics = await scanMarkdownRenderDiagnostics('# 正文\n\n没有公式的普通内容', {
      includePreviewRenderCheck: false,
    });

    expect(diagnostics).toEqual([]);
    expect(markdownToHtmlMock).not.toHaveBeenCalled();
  });
});
