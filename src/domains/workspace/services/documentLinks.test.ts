import { describe, expect, it } from 'vitest';
import { extractDocumentLinks, resolveDocumentLinkTarget } from './documentLinks';

const workspaceFiles = [
  { path: '/repo/docs/manual-test.md', name: 'manual-test.md', title: '人工测试手册' },
  { path: '/repo/docs/linking-note.md', name: 'linking-note.md' },
  { path: '/repo/README.md', name: 'README.md' },
];

describe('resolveDocumentLinkTarget', () => {
  it('resolves relative markdown links from the current document directory', () => {
    expect(resolveDocumentLinkTarget({
      kind: 'markdown',
      target: 'linking-note.md',
      sourcePath: '/repo/docs/manual-test.md',
      workspaceRoot: '/repo',
      workspaceFiles,
    })).toEqual({ path: '/repo/docs/linking-note.md' });
  });

  it('resolves wiki links by basename without markdown extension', () => {
    expect(resolveDocumentLinkTarget({
      kind: 'wiki',
      target: 'manual-test',
      sourcePath: '/repo/docs/linking-note.md',
      workspaceRoot: '/repo',
      workspaceFiles,
    })).toEqual({ path: '/repo/docs/manual-test.md' });
  });

  it('resolves wiki links by workspace-relative path', () => {
    expect(resolveDocumentLinkTarget({
      kind: 'wiki',
      target: 'docs/manual-test',
      sourcePath: '/repo/README.md',
      workspaceRoot: '/repo',
      workspaceFiles,
    })).toEqual({ path: '/repo/docs/manual-test.md' });
  });

  it('resolves wiki links by indexed document title', () => {
    expect(resolveDocumentLinkTarget({
      kind: 'wiki',
      target: '人工测试手册',
      sourcePath: '/repo/docs/linking-note.md',
      workspaceRoot: '/repo',
      workspaceFiles,
    })).toEqual({ path: '/repo/docs/manual-test.md' });
  });

  it('ignores external links', () => {
    expect(resolveDocumentLinkTarget({
      kind: 'markdown',
      target: 'https://example.com/doc.md',
      sourcePath: '/repo/docs/manual-test.md',
      workspaceRoot: '/repo',
      workspaceFiles,
    })).toBeNull();
  });

  it('extracts current document markdown and wiki links for the document links panel', () => {
    const links = extractDocumentLinks([
      '# Links',
      '[Manual](docs/manual-test.md)',
      '![Image](assets/banner.png)',
      '[[linking-note|Linking Note]]',
    ].join('\n'));

    expect(links).toEqual([
      {
        kind: 'markdown',
        target: 'docs/manual-test.md',
        label: 'Manual',
        line: 2,
        column: 1,
      },
      {
        kind: 'wiki',
        target: 'linking-note',
        label: 'Linking Note',
        line: 4,
        column: 1,
      },
    ]);
  });
});
