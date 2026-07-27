import { describe, expect, it, vi } from 'vitest';
import { applyLinkRewrites, scanLinkRewritesForMovedPath } from './linkRewriteFlow';
import type { FileNode } from '../domains/workspace/types';

const ROOT = '/workspace';

function fileNode(path: string): FileNode {
  return {
    kind: 'file',
    name: path.split('/').pop() ?? path,
    path,
  };
}

describe('scanLinkRewritesForMovedPath', () => {
  it('finds documents whose links point at the renamed file', async () => {
    const files = new Map([
      [`${ROOT}/a.md`, '见 [旧](notes/old.md)'],
      [`${ROOT}/b.md`, '无关内容'],
      [`${ROOT}/c.md`, '参考 [[old]]'],
    ]);

    const plans = await scanLinkRewritesForMovedPath({
      fileTree: [
        fileNode(`${ROOT}/a.md`),
        fileNode(`${ROOT}/b.md`),
        fileNode(`${ROOT}/c.md`),
        fileNode(`${ROOT}/notes/new.md`),
      ],
      nextPath: `${ROOT}/notes/new.md`,
      previousPath: `${ROOT}/notes/old.md`,
      readFile: async (path) => files.get(path) ?? '',
      workspaceRoot: ROOT,
    });

    expect(plans.map((plan) => plan.path)).toEqual([`${ROOT}/a.md`, `${ROOT}/c.md`]);
    expect(plans[0].content).toBe('见 [旧](notes/new.md)');
    expect(plans[1].content).toBe('参考 [[new]]');
  });

  it('prefers unsaved in-memory content over the file on disk', async () => {
    const plans = await scanLinkRewritesForMovedPath({
      fileTree: [fileNode(`${ROOT}/a.md`), fileNode(`${ROOT}/notes/new.md`)],
      nextPath: `${ROOT}/notes/new.md`,
      overlay: new Map([[`${ROOT}/a.md`, '未保存 [旧](notes/old.md)']]),
      previousPath: `${ROOT}/notes/old.md`,
      readFile: async () => '磁盘上的旧内容，无链接',
      workspaceRoot: ROOT,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0].content).toBe('未保存 [旧](notes/new.md)');
  });

  it('skips non-markdown documents even when they contain link-like text', async () => {
    const plans = await scanLinkRewritesForMovedPath({
      fileTree: [fileNode(`${ROOT}/data.json`), fileNode(`${ROOT}/notes.txt`)],
      nextPath: `${ROOT}/notes/new.md`,
      previousPath: `${ROOT}/notes/old.md`,
      readFile: async () => '[旧](notes/old.md)',
      workspaceRoot: ROOT,
    });

    expect(plans).toHaveLength(0);
  });

  it('ignores unreadable files instead of failing the whole scan', async () => {
    const plans = await scanLinkRewritesForMovedPath({
      fileTree: [fileNode(`${ROOT}/broken.md`), fileNode(`${ROOT}/ok.md`)],
      nextPath: `${ROOT}/notes/new.md`,
      previousPath: `${ROOT}/notes/old.md`,
      readFile: async (path) => {
        if (path.endsWith('broken.md')) throw new Error('EACCES');
        return '[旧](notes/old.md)';
      },
      workspaceRoot: ROOT,
    });

    expect(plans.map((plan) => plan.path)).toEqual([`${ROOT}/ok.md`]);
  });

  it('returns nothing when the path did not actually change', async () => {
    const plans = await scanLinkRewritesForMovedPath({
      fileTree: [fileNode(`${ROOT}/a.md`)],
      nextPath: `${ROOT}/notes/old.md`,
      previousPath: `${ROOT}/notes/old.md`,
      readFile: async () => '[旧](notes/old.md)',
      workspaceRoot: ROOT,
    });

    expect(plans).toHaveLength(0);
  });
});

describe('applyLinkRewrites', () => {
  it('writes every planned document', async () => {
    const writeFile = vi.fn(async () => {});
    const result = await applyLinkRewrites({
      plans: [
        { content: 'A', path: `${ROOT}/a.md`, references: [] },
        { content: 'B', path: `${ROOT}/b.md`, references: [] },
      ],
      writeFile,
    });

    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(result.written).toEqual([`${ROOT}/a.md`, `${ROOT}/b.md`]);
    expect(result.failed).toHaveLength(0);
  });

  it('reports partial failure without aborting the remaining writes', async () => {
    const result = await applyLinkRewrites({
      plans: [
        { content: 'A', path: `${ROOT}/a.md`, references: [] },
        { content: 'B', path: `${ROOT}/locked.md`, references: [] },
        { content: 'C', path: `${ROOT}/c.md`, references: [] },
      ],
      writeFile: async (path) => {
        if (path.endsWith('locked.md')) throw new Error('EPERM');
      },
    });

    expect(result.written).toEqual([`${ROOT}/a.md`, `${ROOT}/c.md`]);
    expect(result.failed).toEqual([{ error: 'EPERM', path: `${ROOT}/locked.md` }]);
  });
});
