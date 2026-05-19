import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/types';
import {
  buildExportFailureDiagnostic,
  getExportCitationPathValidation,
} from './diagnostics';

describe('export diagnostics', () => {
  it('validates bibliography and CSL path suffixes for export diagnostics', () => {
    expect(getExportCitationPathValidation({
      bibliographyPath: '/docs/references.bib',
      cslStylePath: '/docs/chinese.csl',
    })).toBe('通过');

    expect(getExportCitationPathValidation({
      bibliographyPath: '/docs/references.txt',
      cslStylePath: '/docs/chinese.css',
    })).toBe('参考文献文件后缀需为 .bib / .bibtex / .json；CSL 样式文件后缀需为 .csl');

    expect(getExportCitationPathValidation({
      bibliographyPath: '',
      cslStylePath: '/docs/chinese.csl',
    })).toBe('缺少参考文献文件');
  });

  it('builds a complete failure diagnostic with format, paths, warnings, citations, and pandoc state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));

    try {
      const diagnostic = buildExportFailureDiagnostic({
        format: 'pdf',
        documentName: 'preview-heavy.md',
        documentPath: '/workspace/preview-heavy.md',
        outputPath: '/workspace/preview-heavy.pdf',
        stage: '正在调用 WebKit PDF 引擎',
        settings: {
          ...DEFAULT_SETTINGS,
          contentTheme: 'miaoyan',
          exportDefaults: {
            ...DEFAULT_SETTINGS.exportDefaults,
            templateId: 'theme',
            toc: true,
            pngScale: 4,
          },
          pandoc: {
            path: '/opt/homebrew/bin/pandoc',
            detected: true,
            version: 'pandoc 3.2.1',
            lastCheckedAt: 1_779_201_600_000,
            lastError: '',
          },
          citation: {
            bibliographyPath: '/workspace/references.bib',
            cslStylePath: '/workspace/chinese.csl',
          },
        },
        warnings: ['引用渲染降级为占位符'],
        error: new Error('PDF 页面尺寸计算失败'),
      });

      expect(diagnostic).toContain('Prism 导出失败诊断');
      expect(diagnostic).toContain('时间: 2026-05-20T12:00:00.000Z');
      expect(diagnostic).toContain('格式: PDF (pdf)');
      expect(diagnostic).toContain('阶段: 正在调用 WebKit PDF 引擎');
      expect(diagnostic).toContain('文档路径: /workspace/preview-heavy.md');
      expect(diagnostic).toContain('输出路径: /workspace/preview-heavy.pdf');
      expect(diagnostic).toContain('导出清晰度: 4x');
      expect(diagnostic).toContain('引用路径校验: 通过');
      expect(diagnostic).toContain('Pandoc 引用条件: 满足');
      expect(diagnostic).toContain('Pandoc 状态: 可用');
      expect(diagnostic).toContain('Pandoc 路径: /opt/homebrew/bin/pandoc');
      expect(diagnostic).toContain('导出警告:\n- 引用渲染降级为占位符');
      expect(diagnostic).toContain('错误: PDF 页面尺寸计算失败');
    } finally {
      vi.useRealTimers();
    }
  });
});
