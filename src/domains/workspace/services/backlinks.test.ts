import { describe, expect, it } from 'vitest';
import { scanBacklinks } from './backlinks';

describe('workspace backlinks', () => {
  it('finds markdown and wiki references to the current document', () => {
    const references = scanBacklinks({
      currentPath: '/repo/docs/target.md',
      workspaceRoot: '/repo',
      documents: [
        {
          path: '/repo/docs/source.md',
          name: 'source.md',
          content: [
            '# Source',
            '[Target](target.md)',
            '[[docs/target]]',
            '![image](target.md)',
          ].join('\n'),
        },
        {
          path: '/repo/README.md',
          name: 'README.md',
          content: '[Target](docs/target.md)',
        },
        {
          path: '/repo/docs/target.md',
          name: 'target.md',
          content: '[Self](target.md)',
        },
      ],
    });

    expect(references.map((reference) => ({
      path: reference.path,
      line: reference.line,
      column: reference.column,
    }))).toEqual([
      { path: '/repo/README.md', line: 1, column: 1 },
      { path: '/repo/docs/source.md', line: 2, column: 1 },
      { path: '/repo/docs/source.md', line: 3, column: 1 },
    ]);
    expect(references[0].excerpt).toContain('Target');
  });

  it('matches wiki aliases by filename or workspace-relative path without the markdown extension', () => {
    const references = scanBacklinks({
      currentPath: '/repo/notes/daily.md',
      workspaceRoot: '/repo',
      documents: [
        { path: '/repo/index.md', name: 'index.md', content: '[[daily]] [[notes/daily]] [[notes/other]]' },
      ],
    });

    expect(references).toHaveLength(2);
  });
});
