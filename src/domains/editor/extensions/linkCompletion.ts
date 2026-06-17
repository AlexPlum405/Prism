import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import { getMarkdownHeadingSlug } from './headingSlug';

export interface WorkspaceLinkFile {
  headings?: Array<{ slug: string; title: string }>;
  name: string;
  path: string;
  title?: string;
}

export type WorkspaceLinkCompletionMode = 'markdown' | 'wiki';

export interface WorkspaceLinkCompletionTarget {
  detail: string;
  kind: 'file' | 'keyword';
  label: string;
  target: string;
  title: string;
}

export type QueryWorkspaceLinkTargets = (input: {
  currentDocumentPath?: string;
  limit: number;
  mode: WorkspaceLinkCompletionMode;
  query: string;
}) => Promise<WorkspaceLinkCompletionTarget[] | null>;

export interface MarkdownLinkCompletionContext {
  currentDocumentPath?: string;
  queryWorkspaceLinkTargets?: QueryWorkspaceLinkTargets;
  workspaceFiles: WorkspaceLinkFile[];
  workspaceRootPath?: string | null;
}

const MARKDOWN_FILE_RE = /\.(md|markdown)$/i;

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/');
}

function stripRoot(path: string, rootPath?: string | null): string {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = rootPath ? normalizePath(rootPath).replace(/\/+$/, '') : '';
  if (!normalizedRoot) return normalizedPath;
  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
}

function stripMarkdownExtension(path: string): string {
  return path.replace(/\.(md|markdown)$/i, '');
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || path;
}

function relativePath(fromDir: string, toPath: string): string {
  const fromParts = normalizePath(fromDir).split('/').filter(Boolean);
  const toParts = normalizePath(toPath).split('/').filter(Boolean);
  while (fromParts.length && toParts.length && fromParts[0].toLowerCase() === toParts[0].toLowerCase()) {
    fromParts.shift();
    toParts.shift();
  }
  return `${'../'.repeat(fromParts.length)}${toParts.join('/')}`;
}

export function getMarkdownLinkTrigger(linePrefix: string): { fromOffset: number; query: string } | null {
  const match = linePrefix.match(/\]\(([^)\s]*)$/);
  if (!match) return null;
  return {
    fromOffset: linePrefix.length - match[1].length,
    query: match[1],
  };
}

export function getWikiLinkTrigger(linePrefix: string): { fromOffset: number; query: string } | null {
  const match = linePrefix.match(/\[\[([^\]\n]*)$/);
  if (!match) return null;
  return {
    fromOffset: linePrefix.length - match[1].length,
    query: match[1],
  };
}

export function getMarkdownHeadingCompletionOptions(content: string): Completion[] {
  return content.split('\n').flatMap((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return [];
    const title = match[2].trim();
    const slug = getMarkdownHeadingSlug(title);
    if (!slug) return [];
    return [{
      label: `#${slug}`,
      type: 'keyword',
      detail: title,
    }];
  });
}

export function getWorkspaceFileCompletionOptions(context: MarkdownLinkCompletionContext): Completion[] {
  const baseDir = context.currentDocumentPath
    ? dirname(context.currentDocumentPath)
    : normalizePath(context.workspaceRootPath ?? '');

  return context.workspaceFiles
    .filter((file) => MARKDOWN_FILE_RE.test(file.name))
    .map((file) => {
      const label = baseDir
        ? relativePath(baseDir, file.path)
        : stripRoot(file.path, context.workspaceRootPath);
      return {
        label,
        type: 'file',
        detail: file.name,
      } satisfies Completion;
    });
}

export function getWikiLinkCompletionOptions(context: MarkdownLinkCompletionContext): Completion[] {
  const baseDir = context.currentDocumentPath
    ? dirname(context.currentDocumentPath)
    : normalizePath(context.workspaceRootPath ?? '');

  return context.workspaceFiles
    .filter((file) => MARKDOWN_FILE_RE.test(file.name))
    .flatMap((file) => {
      const relative = stripRoot(file.path, context.workspaceRootPath);
      const target = baseDir ? relativePath(baseDir, file.path) : relative;
      const pathLabel = stripMarkdownExtension(relative);
      const explicitTitle = file.title?.trim();
      const title = explicitTitle || stripMarkdownExtension(basename(file.name));
      const options: Completion[] = [{
        label: pathLabel,
        type: 'file',
        detail: explicitTitle || file.name,
        apply: createWikiMarkdownLinkApply(`[${title}](${target})`),
      }];

      if (explicitTitle && normalizePath(title).toLowerCase() !== normalizePath(pathLabel).toLowerCase()) {
        options.push({
          label: title,
          type: 'file',
          detail: relative,
          apply: createWikiMarkdownLinkApply(`[${title}](${target})`),
        });
      }

      file.headings?.forEach((heading) => {
        if (!heading.title || !heading.slug) return;
        options.push({
          label: heading.title,
          type: 'keyword',
          detail: `${relative}#${heading.slug}`,
          apply: createWikiMarkdownLinkApply(`[${heading.title}](${target}#${heading.slug})`),
        });
      });

      return options;
    });
}

export function getWikiHeadingCompletionOptions(content: string): Completion[] {
  return content.split('\n').flatMap((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return [];
    const title = match[2].trim();
    const slug = getMarkdownHeadingSlug(title);
    if (!slug) return [];
    return [{
      label: `#${slug}`,
      type: 'keyword',
      detail: title,
      apply: createWikiMarkdownLinkApply(`[${title}](#${slug})`),
    } satisfies Completion];
  });
}

export function getWorkspaceLinkCompletionOptionsFromTargets(
  targets: WorkspaceLinkCompletionTarget[],
  mode: WorkspaceLinkCompletionMode,
): Completion[] {
  return targets.map((target) => {
    if (mode === 'wiki') {
      const title = target.title || target.label;
      return {
        label: target.label,
        type: target.kind,
        detail: target.detail,
        apply: createWikiMarkdownLinkApply(`[${title}](${target.target})`),
      } satisfies Completion;
    }

    return {
      label: target.label,
      type: target.kind,
      detail: target.detail,
    } satisfies Completion;
  });
}

function createWikiMarkdownLinkApply(insert: string): Completion['apply'] {
  return (view: EditorView, _completion: Completion, from: number, to: number) => {
    const replaceFrom = Math.max(0, from - 2);
    view.dispatch({
      changes: { from: replaceFrom, to, insert },
      selection: { anchor: replaceFrom + insert.length },
      scrollIntoView: true,
    });
  };
}

export function createMarkdownLinkCompletionSource(
  getContext: () => MarkdownLinkCompletionContext,
) {
  return (context: CompletionContext): CompletionResult | Promise<CompletionResult> | null => {
    const line = context.state.doc.lineAt(context.pos);
    const linePrefix = line.text.slice(0, context.pos - line.from);
    const wikiTrigger = getWikiLinkTrigger(linePrefix);
    if (wikiTrigger) {
      const completionContext = getContext();
      const from = line.from + wikiTrigger.fromOffset;
      const localHeadingOptions = getWikiHeadingCompletionOptions(context.state.doc.toString());
      const fallbackOptions = () => [
        ...getWikiLinkCompletionOptions(completionContext),
        ...localHeadingOptions,
      ];

      if (completionContext.queryWorkspaceLinkTargets) {
        return completionContext.queryWorkspaceLinkTargets({
          currentDocumentPath: completionContext.currentDocumentPath,
          limit: 80,
          mode: 'wiki',
          query: wikiTrigger.query,
        })
          .then((targets) => ({
            from,
            options: targets
              ? [
                  ...getWorkspaceLinkCompletionOptionsFromTargets(targets, 'wiki'),
                  ...localHeadingOptions,
                ]
              : fallbackOptions(),
            validFor: /^[^\]\n]*$/,
          }))
          .catch(() => ({
            from,
            options: fallbackOptions(),
            validFor: /^[^\]\n]*$/,
          }));
      }

      return {
        from,
        options: fallbackOptions(),
        validFor: /^[^\]\n]*$/,
      };
    }

    const trigger = getMarkdownLinkTrigger(linePrefix);
    if (!trigger) return null;

    const completionContext = getContext();
    const from = line.from + trigger.fromOffset;
    const localHeadingOptions = getMarkdownHeadingCompletionOptions(context.state.doc.toString());
    const fallbackOptions = () => [
      ...getWorkspaceFileCompletionOptions(completionContext),
      ...localHeadingOptions,
    ];

    if (completionContext.queryWorkspaceLinkTargets) {
      return completionContext.queryWorkspaceLinkTargets({
        currentDocumentPath: completionContext.currentDocumentPath,
        limit: 80,
        mode: 'markdown',
        query: trigger.query,
      })
        .then((targets) => ({
          from,
          options: targets
            ? [
                ...getWorkspaceLinkCompletionOptionsFromTargets(targets, 'markdown'),
                ...localHeadingOptions,
              ]
            : fallbackOptions(),
          validFor: /^[^)\s]*$/,
        }))
        .catch(() => ({
          from,
          options: fallbackOptions(),
          validFor: /^[^)\s]*$/,
        }));
    }

    return {
      from,
      options: fallbackOptions(),
      validFor: /^[^)\s]*$/,
    };
  };
}
