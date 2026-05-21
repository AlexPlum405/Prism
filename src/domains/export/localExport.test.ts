import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportDocumentLocal } from './localExport';
import type { ExportDocumentInput, ExportFormat } from './types';

const exportMocks = vi.hoisted(() => ({
  html: vi.fn(),
  pdf: vi.fn(),
  docx: vi.fn(),
  png: vi.fn(),
}));

vi.mock('./adapters/html', () => ({
  exportHtmlAdapter: exportMocks.html,
}));

vi.mock('./adapters/pdf', () => ({
  exportPdfAdapter: exportMocks.pdf,
}));

vi.mock('./adapters/docx', () => ({
  exportDocxAdapter: exportMocks.docx,
}));

vi.mock('./adapters/png', () => ({
  exportPngAdapter: exportMocks.png,
}));

function createInput(): ExportDocumentInput {
  return {
    content: '# Export',
    filename: 'export.md',
    contentTheme: 'miaoyan',
  };
}

describe('exportDocumentLocal', () => {
  beforeEach(() => {
    Object.values(exportMocks).forEach((mock) => mock.mockReset().mockResolvedValue(true));
  });

  it.each([
    ['html', 'html'],
    ['pdf', 'pdf'],
    ['docx', 'docx'],
    ['png', 'png'],
  ] as const)('loads the %s export strategy', async (format, mockKey) => {
    const input = createInput();

    await expect(exportDocumentLocal(input, format, `/tmp/export.${format}`)).resolves.toBe(true);

    expect(exportMocks[mockKey]).toHaveBeenCalledWith(input, `/tmp/export.${format}`);
  });

  it('rejects unsupported formats at the strategy boundary', async () => {
    await expect(
      exportDocumentLocal(createInput(), 'markdown' as ExportFormat, '/tmp/export.md'),
    ).rejects.toThrow();
  });
});
