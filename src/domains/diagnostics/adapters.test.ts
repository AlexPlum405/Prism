import { describe, expect, it } from 'vitest';
import {
  headingDiagnosticsToPrismDiagnostics,
  imageDiagnosticsToPrismDiagnostics,
  linkDiagnosticsToPrismDiagnostics,
  tableDiagnosticsToPrismDiagnostics,
  typographyDiagnosticsToPrismDiagnostics,
} from './adapters';
import { getActionableErrorDiagnostics } from './types';

describe('diagnostic adapters', () => {
  it('maps link diagnostics to actionable Prism error diagnostics', () => {
    const diagnostics = linkDiagnosticsToPrismDiagnostics([
      {
        column: 4,
        kind: 'missing-file',
        line: 2,
        message: '未找到链接文件 docs/missing.md',
        target: 'docs/missing.md',
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        action: '定位后修正路径',
        column: 4,
        kind: 'link',
        line: 2,
        message: '未找到链接文件 docs/missing.md',
        reason: '工作区里没有找到这个相对路径对应的 Markdown 文件。',
        severity: 'error',
        source: 'link-diagnostics',
      }),
    ]);
    expect(getActionableErrorDiagnostics(diagnostics)).toHaveLength(1);
  });

  it('maps image diagnostics to actionable Prism error diagnostics', () => {
    const diagnostics = imageDiagnosticsToPrismDiagnostics([
      {
        column: 1,
        kind: 'missing-file',
        line: 3,
        message: '未找到图片文件 /repo/assets/missing.png',
        resolvedPath: '/repo/assets/missing.png',
        target: 'assets/missing.png',
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        action: '修正路径或重新插入图片',
        column: 1,
        kind: 'image',
        line: 3,
        reason: 'Prism 无法在当前文档附近找到这个本地图片文件。',
        severity: 'error',
        source: 'image-diagnostics',
      }),
    ]);
    expect(getActionableErrorDiagnostics(diagnostics)).toHaveLength(1);
  });

  it('maps duplicate heading anchors to actionable Prism error diagnostics', () => {
    const diagnostics = headingDiagnosticsToPrismDiagnostics([
      {
        column: 1,
        firstLine: 1,
        kind: 'duplicate-anchor',
        line: 4,
        message: '标题锚点 #intro 与第 1 行重复',
        slug: 'intro',
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        action: '重命名其中一个标题',
        kind: 'link',
        line: 4,
        reason: '重复标题会生成相同锚点，目录、跳转链接或导出书签可能定位到错误位置。',
        severity: 'error',
        source: 'heading-diagnostics',
      }),
    ]);
  });

  it('maps typography diagnostics as non-error writing suggestions', () => {
    const diagnostics = typographyDiagnosticsToPrismDiagnostics([
      {
        column: 3,
        kind: 'cjk-latin-spacing',
        line: 1,
        message: '中英文之间缺少空格',
        suggestion: '在中文与英文/数字之间补一个半角空格。',
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        action: '定位后调整空格',
        kind: 'typography',
        message: '中英文之间缺少空格',
        reason: '在中文与英文/数字之间补一个半角空格。',
        severity: 'info',
        source: 'typography-diagnostics',
      }),
    ]);
    expect(getActionableErrorDiagnostics(diagnostics)).toHaveLength(0);
  });

  it('maps table diagnostics into the shared Prism diagnostics panel model', () => {
    const diagnostics = tableDiagnosticsToPrismDiagnostics([
      {
        action: '格式化表格',
        column: 1,
        kind: 'inconsistent-columns',
        line: 8,
        message: '表格行列数不一致',
        reason: '部分行的单元格数量与表头不同。',
        severity: 'error',
      },
    ]);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        action: '格式化表格',
        column: 1,
        kind: 'table',
        line: 8,
        message: '表格行列数不一致',
        reason: '部分行的单元格数量与表头不同。',
        severity: 'error',
        source: 'table-diagnostics',
      }),
    ]);
    expect(getActionableErrorDiagnostics(diagnostics)).toHaveLength(1);
  });
});
