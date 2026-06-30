import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMarkdownHeadingSlug, scanMarkdownLinks } from './linkDiagnostics';

describe('markdown link diagnostics', () => {
  it('builds stable heading slugs for Chinese and English headings', () => {
    expect(getMarkdownHeadingSlug('API 设计（第一版）')).toBe('api-设计第一版');
    expect(getMarkdownHeadingSlug('Hello `Prism` World')).toBe('hello-prism-world');
  });

  it('reports missing same-document heading anchors', () => {
    const diagnostics = scanMarkdownLinks([
      '# 已存在',
      '## 发布计划（第一版）!',
      '',
      '[ok](#已存在)',
      '[punctuation ok](#发布计划第一版)',
      '[bad](#不存在)',
    ].join('\n'));

    expect(diagnostics).toEqual([
      {
        column: 1,
        kind: 'missing-heading',
        line: 6,
        message: '未找到标题锚点 #不存在',
        target: '#不存在',
      },
    ]);
  });

  it('does not report missing heading anchors in the bundled Prism Markdown guide', () => {
    const guide = readFileSync(
      join(process.cwd(), 'src-tauri/resources/Initial/Examples/Prism Markdown 语法指南.md'),
      'utf8',
    );

    const diagnostics = scanMarkdownLinks(guide).filter((diagnostic) => diagnostic.kind === 'missing-heading');

    expect(diagnostics).toEqual([]);
  });

  it('reports missing relative files when workspace files are available', () => {
    const diagnostics = scanMarkdownLinks('[missing](docs/missing.md) [external](https://example.com)', {
      currentPath: '/repo/README.md',
      workspaceFiles: ['/repo/docs/existing.md'],
      workspaceRoot: '/repo',
    });

    expect(diagnostics).toEqual([
      {
        column: 1,
        kind: 'missing-file',
        line: 1,
        message: '未找到链接文件 docs/missing.md',
        target: 'docs/missing.md',
      },
    ]);
  });

  it('resolves relative links from the current document directory', () => {
    expect(scanMarkdownLinks('[ok](assets/image.png)', {
      currentPath: '/repo/docs/page.md',
      workspaceFiles: ['/repo/docs/assets/image.png'],
      workspaceRoot: '/repo',
    })).toEqual([]);
  });

  it('does not report image targets as missing when the workspace index only tracks markdown files', () => {
    const diagnostics = scanMarkdownLinks('![ok](assets/image.png) [missing](docs/missing.md)', {
      currentPath: '/repo/docs/page.md',
      workspaceFiles: ['/repo/docs/existing.md'],
      workspaceRoot: '/repo',
    });

    expect(diagnostics).toEqual([
      {
        column: 25,
        kind: 'missing-file',
        line: 1,
        message: '未找到链接文件 docs/missing.md',
        target: 'docs/missing.md',
      },
    ]);
  });

  it('can validate image targets when an asset-aware index is available', () => {
    expect(scanMarkdownLinks('![missing](assets/missing.png)', {
      currentPath: '/repo/docs/page.md',
      validateImageTargets: true,
      workspaceFiles: ['/repo/docs/assets/existing.png'],
      workspaceRoot: '/repo',
    })).toEqual([
      {
        column: 1,
        kind: 'missing-file',
        line: 1,
        message: '未找到链接文件 assets/missing.png',
        target: 'assets/missing.png',
      },
    ]);

    expect(scanMarkdownLinks('![ok](assets/existing.png)', {
      currentPath: '/repo/docs/page.md',
      validateImageTargets: true,
      workspaceFiles: ['/repo/docs/assets/existing.png'],
      workspaceRoot: '/repo',
    })).toEqual([]);
  });

  it('reports empty link targets', () => {
    expect(scanMarkdownLinks('[empty]()')).toEqual([
      {
        column: 1,
        kind: 'empty-target',
        line: 1,
        message: '链接目标为空',
        target: '',
      },
    ]);
  });
});
