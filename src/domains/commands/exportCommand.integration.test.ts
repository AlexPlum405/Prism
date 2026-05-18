import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, stat, writeFile as writeNodeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CommandContext, CommandId } from './types';
import type { ExportFormat } from '../export';
import { DEFAULT_SETTINGS } from '../settings/types';
import { EXPORT_GOLDEN_MARKDOWN } from '../export/goldenFixture';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async () => ({
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><text>Command Mermaid</text></svg>',
  })),
}));

const canvasRenderMock = vi.hoisted(() => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  return {
    render: vi.fn(async () => ({
      toDataURL: () => dataUrl,
    })),
  };
});

const fsMock = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('mermaid', () => ({ default: mermaidMock }));
vi.mock('html2canvas', () => ({ default: canvasRenderMock.render }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ ask: vi.fn(), open: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => fsMock);
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(),
  openUrl: vi.fn(),
  revealItemInDir: vi.fn(),
}));

import { runCommand } from './registry';

const EXPORT_COMMANDS = [
  { id: 'exportHtml', format: 'html', filename: 'command-export.html' },
  { id: 'exportPdf', format: 'pdf', filename: 'command-export.pdf' },
  { id: 'exportPng', format: 'png', filename: 'command-export.png' },
  { id: 'exportDocx', format: 'docx', filename: 'command-export.docx' },
] satisfies Array<{ id: CommandId; format: ExportFormat; filename: string }>;

function createExportCommandContext(outputPaths: Record<ExportFormat, string>) {
  const requestExportPath = vi.fn(async (request: { format: ExportFormat }) => outputPaths[request.format]);
  const recordExportHistory = vi.fn();
  const showToast = vi.fn();

  return {
    context: {
      documentStore: {
        currentDocument: {
          path: '/tmp/prism-command-export.md',
          name: 'prism-command-export.md',
          content: EXPORT_GOLDEN_MARKDOWN,
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'split',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...DEFAULT_SETTINGS,
        contentTheme: 'miaoyan',
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          htmlIncludeTheme: true,
          toc: true,
          pageHeaderFooter: false,
          pdfPageNumbers: false,
        },
        recordExportHistory,
      },
      workspaceStore: {},
      requestExportPath,
      showToast,
    } as unknown as CommandContext,
    recordExportHistory,
    requestExportPath,
    showToast,
  };
}

describe('export commands integration', () => {
  const outDir = path.resolve(process.cwd(), '.codex-smoke/complex-export/out');
  const outputPaths = Object.fromEntries(
    EXPORT_COMMANDS.map(({ format, filename }) => [format, path.join(outDir, filename)]),
  ) as Record<ExportFormat, string>;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalImage = globalThis.Image;
  const originalCreateElement = document.createElement.bind(document);
  let createElementSpy: { mockRestore: () => void } | null = null;
  let originalFonts: unknown;

  beforeEach(() => {
    fsMock.readTextFile.mockReset();
    fsMock.stat.mockReset();
    fsMock.stat.mockResolvedValue({ size: 1, mtime: new Date(1000) });
    fsMock.writeTextFile.mockReset();
    fsMock.writeTextFile.mockImplementation(async (targetPath: string, contents: string) => {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeNodeFile(targetPath, contents, 'utf8');
    });
    fsMock.writeFile.mockReset();
    fsMock.writeFile.mockImplementation(async (targetPath: string, contents: Uint8Array) => {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeNodeFile(targetPath, Buffer.from(contents));
    });
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockClear();
    canvasRenderMock.render.mockClear();
    originalFonts = (document as any).fonts;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(performance.now()), 0);
      return 1;
    }) as typeof requestAnimationFrame;
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: any, options?: any) => {
      const element = originalCreateElement(tagName, options);
      if (String(tagName).toLowerCase() === 'iframe') {
        Object.defineProperty(element, 'srcdoc', {
          configurable: true,
          get: () => '',
          set: (value: string) => {
            window.setTimeout(() => {
              const frameDocument = (element as HTMLIFrameElement).contentDocument;
              if (frameDocument) {
                frameDocument.open();
                frameDocument.write(value);
                frameDocument.close();
              }
              (element as HTMLIFrameElement).onload?.(new Event('load'));
            }, 0);
          },
        });
      }
      return element;
    });
    globalThis.Image = class {
      width = 320;
      height = 200;
      naturalWidth = 320;
      naturalHeight = 200;
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(_value: string) {
        window.setTimeout(() => this.onload?.(new Event('load')), 0);
      }
    } as typeof Image;
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame;
    }
    globalThis.Image = originalImage;
    createElementSpy?.mockRestore();
    createElementSpy = null;
    if (originalFonts) {
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: originalFonts,
      });
    } else {
      delete (document as any).fonts;
    }
  });

  it('runs every export command through the real export pipeline and records history', async () => {
    const { context, recordExportHistory, requestExportPath, showToast } = createExportCommandContext(outputPaths);
    const failures: string[] = [];
    const failureListener = (event: Event) => {
      failures.push((event as CustomEvent<{ diagnostic: string }>).detail.diagnostic);
    };
    window.addEventListener('prism-export-failure', failureListener);

    try {
      for (const { id } of EXPORT_COMMANDS) {
        await runCommand(id, context);
      }
    } finally {
      window.removeEventListener('prism-export-failure', failureListener);
    }

    expect(failures).toEqual([]);

    for (const targetPath of Object.values(outputPaths)) {
      expect((await stat(targetPath)).size).toBeGreaterThan(0);
    }

    const html = await readFile(outputPaths.html, 'utf8');
    expect(html).toContain('<title>导出验收文档</title>');
    expect(html).toContain('prism-export-toc');
    expect(html).toContain('Command Mermaid');

    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(new Uint8Array(await readFile(outputPaths.pdf)));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);

    const pngBytes = await readFile(outputPaths.png);
    expect(Array.from(pngBytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const { default: JSZip } = await import('jszip');
    const docx = await JSZip.loadAsync(await readFile(outputPaths.docx));
    const documentXml = await docx.file('word/document.xml')?.async('string');
    expect(documentXml).toContain('导出验收文档');
    expect(documentXml).not.toContain('graph TD');

    expect(requestExportPath).toHaveBeenCalledTimes(4);
    expect(recordExportHistory.mock.calls.map(([entry]) => entry.format)).toEqual(['html', 'pdf', 'png', 'docx']);
    expect(recordExportHistory.mock.calls.map(([entry]) => entry.outputPath)).toEqual([
      outputPaths.html,
      outputPaths.pdf,
      outputPaths.png,
      outputPaths.docx,
    ]);
    const toastTitles = showToast.mock.calls.map(([toast]) => typeof toast === 'string' ? toast : toast.title);
    expect(toastTitles).toEqual(expect.arrayContaining([
      'HTML 导出完成',
      'PDF 导出完成',
      'PNG 图像 导出完成',
      'Word 导出完成',
    ]));
    expect(showToast.mock.calls.every(([toast]) => (
      typeof toast === 'string'
      || (toast.actions ?? []).map((action: any) => action.label).join(',') === '打开,显示位置'
    ))).toBe(true);
  });
});
