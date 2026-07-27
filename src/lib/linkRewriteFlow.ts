import { readTextFile, writeTextFile } from '../platform/tauri/fileSystem';
import { flattenFiles } from '../domains/workspace/services/fileTree';
import { isSupportedDocumentPath } from '../domains/workspace/services/fileAssociation';
import {
  planLinkRewrites,
  type PlannedLinkRewrite,
} from '../domains/workspace/services/linkRewrite';
import { isSamePath } from '../domains/workspace/services/path';
import type { DocumentLinkFile } from '../domains/workspace/services/documentLinks';
import type { FileNode } from '../domains/workspace/types';

const MARKDOWN_FILE_RE = /\.(md|markdown)$/i;

export interface LinkRewriteScanInput {
  fileTree: FileNode[];
  nextPath: string;
  previousPath: string;
  /** Content of documents already open in memory, keyed by absolute path. */
  overlay?: Map<string, string>;
  readFile?: (path: string) => Promise<string>;
  workspaceRoot: string | null;
}

export interface LinkRewriteApplyInput {
  plans: PlannedLinkRewrite[];
  writeFile?: (path: string, content: string) => Promise<void>;
}

export interface LinkRewriteApplyResult {
  failed: Array<{ error: string; path: string }>;
  written: string[];
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Find every markdown document in the workspace whose links point at
 * `previousPath` and compute the rewritten content. Only markdown documents can
 * hold links, so text-profile files are skipped.
 */
export async function scanLinkRewritesForMovedPath(
  input: LinkRewriteScanInput,
): Promise<PlannedLinkRewrite[]> {
  const {
    fileTree,
    nextPath,
    overlay,
    previousPath,
    readFile = readTextFile,
    workspaceRoot,
  } = input;

  if (isSamePath(previousPath, nextPath)) return [];

  const nodes = flattenFiles(fileTree, workspaceRoot)
    .map(({ node }) => node)
    .filter((node) => isSupportedDocumentPath(node.path));

  // The renamed file itself is handled by the caller; other documents are the
  // ones that may hold stale references.
  const candidates = nodes.filter((node) => (
    MARKDOWN_FILE_RE.test(node.path)
    && !isSamePath(node.path, previousPath)
    && !isSamePath(node.path, nextPath)
  ));

  const documents: Array<{ content: string; path: string }> = [];
  for (const node of candidates) {
    const inMemory = overlay?.get(node.path);
    if (inMemory !== undefined) {
      documents.push({ content: inMemory, path: node.path });
      continue;
    }
    try {
      documents.push({ content: await readFile(node.path), path: node.path });
    } catch {
      // An unreadable file cannot be rewritten; leave it to link diagnostics.
    }
  }

  // Resolution must run against the pre-rename layout, so the moved file is
  // registered under its old path.
  const workspaceFiles: DocumentLinkFile[] = [
    ...nodes
      .filter((node) => !isSamePath(node.path, nextPath))
      .map((node) => ({ name: node.name, path: node.path })),
    ...(nodes.some((node) => isSamePath(node.path, previousPath))
      ? []
      : [{ name: previousPath.split('/').pop() ?? previousPath, path: previousPath }]),
  ];

  return planLinkRewrites({
    documents,
    nextPath,
    previousPath,
    workspaceFiles,
    workspaceRoot,
  });
}

/**
 * Write the planned rewrites. A failure on one document does not abort the
 * rest — partial success is reported so the caller can surface it.
 */
export async function applyLinkRewrites(
  input: LinkRewriteApplyInput,
): Promise<LinkRewriteApplyResult> {
  const { plans, writeFile = writeTextFile } = input;
  const result: LinkRewriteApplyResult = { failed: [], written: [] };

  for (const plan of plans) {
    try {
      await writeFile(plan.path, plan.content);
      result.written.push(plan.path);
    } catch (err) {
      result.failed.push({ error: formatError(err), path: plan.path });
    }
  }

  return result;
}
