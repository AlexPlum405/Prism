import { describe, expect, it } from 'vitest';
import { resolveDocumentLinkTarget } from './documentLinks';

const workspaceFiles = [
  { path: '/repo/docs/manual-test.md', name: 'manual-test.md' },
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

  it('ignores external links', () => {
    expect(resolveDocumentLinkTarget({
      kind: 'markdown',
      target: 'https://example.com/doc.md',
      sourcePath: '/repo/docs/manual-test.md',
      workspaceRoot: '/repo',
      workspaceFiles,
    })).toBeNull();
  });
});
