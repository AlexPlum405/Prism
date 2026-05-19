import { describe, expect, it } from 'vitest';
import {
  linkDiagnosticsToPrismDiagnostics,
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
});
