import { describe, expect, it } from 'vitest';
import { scanHeadingAnchorDiagnostics } from './headingDiagnostics';

describe('heading anchor diagnostics', () => {
  it('reports duplicate heading anchors after slug normalization', () => {
    expect(scanHeadingAnchorDiagnostics([
      '# API 设计',
      '',
      '## API `设计`!',
    ].join('\n'))).toEqual([
      {
        column: 1,
        firstLine: 1,
        kind: 'duplicate-anchor',
        line: 3,
        message: '标题锚点 #api-设计 与第 1 行重复',
        slug: 'api-设计',
      },
    ]);
  });

  it('ignores unique heading anchors', () => {
    expect(scanHeadingAnchorDiagnostics('# A\n\n## B')).toEqual([]);
  });
});
