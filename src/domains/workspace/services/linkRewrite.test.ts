import { describe, expect, it } from 'vitest';
import {
  planLinkRewrites,
  rebaseMovedDocumentLinks,
  rewriteDocumentLinksForMovedPath,
} from './linkRewrite';
import type { DocumentLinkFile } from './documentLinks';

const ROOT = '/workspace';

function workspaceFiles(paths: string[]): DocumentLinkFile[] {
  return paths.map((path) => ({
    name: path.split('/').pop() ?? path,
    path,
  }));
}

function rewrite(content: string, options: {
  documentPath?: string;
  files?: string[];
  nextPath: string;
  previousPath: string;
}) {
  const documentPath = options.documentPath ?? `${ROOT}/index.md`;
  return rewriteDocumentLinksForMovedPath({
    content,
    documentPath,
    nextPath: options.nextPath,
    previousPath: options.previousPath,
    workspaceFiles: workspaceFiles(options.files ?? [documentPath, options.previousPath]),
    workspaceRoot: ROOT,
  });
}

describe('rewriteDocumentLinksForMovedPath', () => {
  it('rewrites a relative markdown link when the target is renamed', () => {
    const result = rewrite('见 [旧标题](notes/old.md) 一节。', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe('见 [旧标题](notes/new.md) 一节。');
    expect(result.references).toHaveLength(1);
    expect(result.references[0]).toMatchObject({ kind: 'markdown', line: 1, nextTarget: 'notes/new.md' });
  });

  it('keeps the anchor and query suffix intact', () => {
    const result = rewrite('[章节](notes/old.md#第-2-节)', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe('[章节](notes/new.md#第-2-节)');
  });

  it('rewrites wiki links by bare name when the author used a bare name', () => {
    const result = rewrite('参考 [[old]] 与 [[old|别名]]。', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe('参考 [[new]] 与 [[new|别名]]。');
    expect(result.references).toHaveLength(2);
  });

  it('keeps a workspace-relative wiki target relative', () => {
    const result = rewrite('参考 [[notes/old]]。', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/archive/new.md`,
    });

    expect(result.content).toBe('参考 [[archive/new]]。');
  });

  it('preserves the extension-less style of markdown links', () => {
    const result = rewrite('[旧](notes/old)', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe('[旧](notes/new)');
  });

  it('re-encodes targets that were percent-encoded', () => {
    const result = rewrite('[旧](notes/%E6%97%A7.md)', {
      files: [`${ROOT}/index.md`, `${ROOT}/notes/旧.md`],
      previousPath: `${ROOT}/notes/旧.md`,
      nextPath: `${ROOT}/notes/新.md`,
    });

    expect(result.content).toBe('[旧](notes/%E6%96%B0.md)');
  });

  it('rewrites image references too', () => {
    const result = rewrite('![图](assets/old.md)', {
      previousPath: `${ROOT}/assets/old.md`,
      nextPath: `${ROOT}/assets/new.md`,
    });

    expect(result.content).toBe('![图](assets/new.md)');
  });

  it('computes an upward relative path when the target moves out of the folder', () => {
    const result = rewrite('[旧](old.md)', {
      documentPath: `${ROOT}/notes/index.md`,
      files: [`${ROOT}/notes/index.md`, `${ROOT}/notes/old.md`],
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/archive/new.md`,
    });

    expect(result.content).toBe('[旧](../archive/new.md)');
  });

  it('leaves external and unrelated links alone', () => {
    const content = '[外部](https://example.com/old.md) 与 [其他](notes/other.md)';
    const result = rewrite(content, {
      files: [`${ROOT}/index.md`, `${ROOT}/notes/old.md`, `${ROOT}/notes/other.md`],
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe(content);
    expect(result.references).toHaveLength(0);
  });

  it('does not touch link syntax inside fenced code blocks', () => {
    const content = [
      '真实链接 [旧](notes/old.md)',
      '',
      '```md',
      '示例 [旧](notes/old.md)',
      '```',
    ].join('\n');
    const result = rewrite(content, {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toContain('真实链接 [旧](notes/new.md)');
    expect(result.content).toContain('示例 [旧](notes/old.md)');
    expect(result.references).toHaveLength(1);
  });

  it('does not touch link syntax inside inline code spans', () => {
    const result = rewrite('写作 `[旧](notes/old.md)` 语法', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe('写作 `[旧](notes/old.md)` 语法');
  });

  it('returns the content untouched when the path did not change', () => {
    const content = '[旧](notes/old.md)';
    const result = rewrite(content, {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/old.md`,
    });

    expect(result.content).toBe(content);
    expect(result.references).toHaveLength(0);
  });

  it('rewrites every occurrence on the same line', () => {
    const result = rewrite('[一](notes/old.md) 和 [二](notes/old.md)', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe('[一](notes/new.md) 和 [二](notes/new.md)');
    expect(result.references).toHaveLength(2);
  });

  it('does not confuse a label that repeats the target text', () => {
    const result = rewrite('[notes/old.md](notes/old.md)', {
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
    });

    expect(result.content).toBe('[notes/old.md](notes/new.md)');
  });
});

describe('planLinkRewrites', () => {
  it('returns only the documents that reference the moved path', () => {
    const plans = planLinkRewrites({
      documents: [
        { content: '[旧](notes/old.md)', path: `${ROOT}/a.md` },
        { content: '没有链接', path: `${ROOT}/b.md` },
        { content: '参考 [[old]]', path: `${ROOT}/c.md` },
      ],
      previousPath: `${ROOT}/notes/old.md`,
      nextPath: `${ROOT}/notes/new.md`,
      workspaceFiles: workspaceFiles([
        `${ROOT}/a.md`,
        `${ROOT}/b.md`,
        `${ROOT}/c.md`,
        `${ROOT}/notes/old.md`,
      ]),
      workspaceRoot: ROOT,
    });

    expect(plans.map((plan) => plan.path)).toEqual([`${ROOT}/a.md`, `${ROOT}/c.md`]);
    expect(plans[0].content).toBe('[旧](notes/new.md)');
    expect(plans[1].content).toBe('参考 [[new]]');
  });
});

describe('rebaseMovedDocumentLinks', () => {
  it('re-anchors relative links when the document itself moves', () => {
    const result = rebaseMovedDocumentLinks({
      content: '![图](assets/pic.png) 与 [邻居](sibling.md)',
      previousPath: `${ROOT}/notes/doc.md`,
      nextPath: `${ROOT}/archive/doc.md`,
    });

    expect(result.content).toBe('![图](../notes/assets/pic.png) 与 [邻居](../notes/sibling.md)');
    expect(result.references).toHaveLength(2);
  });

  it('leaves the content untouched when the folder does not change', () => {
    const content = '[邻居](sibling.md)';
    const result = rebaseMovedDocumentLinks({
      content,
      previousPath: `${ROOT}/notes/doc.md`,
      nextPath: `${ROOT}/notes/renamed.md`,
    });

    expect(result.content).toBe(content);
    expect(result.references).toHaveLength(0);
  });

  it('ignores absolute and external targets', () => {
    const content = '[根](/root.md) 和 [远程](https://example.com/a.md)';
    const result = rebaseMovedDocumentLinks({
      content,
      previousPath: `${ROOT}/notes/doc.md`,
      nextPath: `${ROOT}/archive/doc.md`,
    });

    expect(result.content).toBe(content);
  });
});
