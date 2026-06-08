import { useEffect, useMemo, useRef, useState } from 'react';
import { readTextFile } from '../../../platform/tauri/fileSystem';
import type { OpenDocument } from '../../document/types';
import type { RecentFileEntry } from '../../settings/types';
import type { FileNode } from '../types';
import {
  applyWorkspaceIndexOverlay,
  buildWorkspaceIndexIncremental,
  flattenFiles,
  isSupportedMarkdownPath,
  normalizePathForCompare,
  type WorkspaceIndex,
  type WorkspaceIndexSourceDocument,
} from '../services';
import { buildWorkspaceIndexNativeModel } from '../services/workspaceIndexNative';
import { isNativeCommandUnavailableError } from '../../../platform/tauri/result';

const INDEX_BATCH_THRESHOLD = 40;
const INDEX_BATCH_SIZE = 20;

type WorkspaceIndexFile = Pick<FileNode, 'modifiedAt' | 'path' | 'size'>;

export interface WorkspaceIndexSourceCacheEntry extends WorkspaceIndexSourceDocument {
  modifiedAt?: number;
  size?: number;
}

interface ReadWorkspaceIndexSourcesOptions {
  batchSize?: number;
  batchThreshold?: number;
  yieldBetweenBatches?: () => Promise<void>;
}

function nextIndexBatchFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function readWorkspaceIndexSource(
  node: WorkspaceIndexFile,
): Promise<WorkspaceIndexSourceDocument | null> {
  try {
    return {
      path: node.path,
      content: await readTextFile(node.path),
    };
  } catch {
    return null;
  }
}

export async function readWorkspaceIndexSources(
  files: WorkspaceIndexFile[],
  options: ReadWorkspaceIndexSourcesOptions = {},
): Promise<WorkspaceIndexSourceDocument[]> {
  const batchThreshold = options.batchThreshold ?? INDEX_BATCH_THRESHOLD;
  const batchSize = options.batchSize ?? INDEX_BATCH_SIZE;
  const yieldBetweenBatches = options.yieldBetweenBatches ?? nextIndexBatchFrame;

  if (files.length <= batchThreshold) {
    return (await Promise.all(files.map(readWorkspaceIndexSource)))
      .filter((item): item is WorkspaceIndexSourceDocument => Boolean(item));
  }

  const documents: WorkspaceIndexSourceDocument[] = [];
  for (let start = 0; start < files.length; start += batchSize) {
    const batch = files.slice(start, start + batchSize);
    const batchDocuments = await Promise.all(batch.map(readWorkspaceIndexSource));
    documents.push(...batchDocuments.filter((item): item is WorkspaceIndexSourceDocument => Boolean(item)));
    if (start + batchSize < files.length) {
      await yieldBetweenBatches();
    }
  }

  return documents;
}

function hasStableSourceMetadata(file: WorkspaceIndexFile) {
  return file.modifiedAt !== undefined || file.size !== undefined;
}

function isCachedWorkspaceIndexSourceFresh(
  file: WorkspaceIndexFile,
  cached: WorkspaceIndexSourceCacheEntry | undefined,
) {
  return Boolean(
    cached
    && hasStableSourceMetadata(file)
    && cached.modifiedAt === file.modifiedAt
    && cached.size === file.size,
  );
}

export async function readWorkspaceIndexSourcesIncremental(
  files: WorkspaceIndexFile[],
  cache: Map<string, WorkspaceIndexSourceCacheEntry>,
  options: ReadWorkspaceIndexSourcesOptions = {},
): Promise<WorkspaceIndexSourceDocument[]> {
  const activeKeys = new Set<string>();
  const filesToRead: WorkspaceIndexFile[] = [];

  files.forEach((file) => {
    const key = normalizePathForCompare(file.path);
    activeKeys.add(key);
    if (!isCachedWorkspaceIndexSourceFresh(file, cache.get(key))) {
      filesToRead.push(file);
    }
  });

  const changedSources = await readWorkspaceIndexSources(filesToRead, options);
  const changedSourceByPath = new Map(changedSources.map((source) => [
    normalizePathForCompare(source.path),
    source,
  ]));

  filesToRead.forEach((file) => {
    const key = normalizePathForCompare(file.path);
    const source = changedSourceByPath.get(key);
    if (!source) {
      cache.delete(key);
      return;
    }

    cache.set(key, {
      ...source,
      modifiedAt: file.modifiedAt,
      size: file.size,
    });
  });

  [...cache.keys()].forEach((key) => {
    if (!activeKeys.has(key)) {
      cache.delete(key);
    }
  });

  return files
    .map((file) => cache.get(normalizePathForCompare(file.path)))
    .filter((item): item is WorkspaceIndexSourceCacheEntry => Boolean(item));
}

export function useWorkspaceIndexModel(input: {
  currentDocument: OpenDocument | null;
  fileTree: FileNode[];
  rootPath: string | null;
  recentFiles: RecentFileEntry[];
}): {
  workspaceIndex: WorkspaceIndex | null;
  workspaceIndexing: boolean;
} {
  const {
    currentDocument,
    fileTree,
    rootPath,
    recentFiles,
  } = input;
  const [baseWorkspaceIndex, setBaseWorkspaceIndex] = useState<WorkspaceIndex | null>(null);
  const [workspaceIndexing, setWorkspaceIndexing] = useState(false);
  const fallbackIndexCacheRef = useRef<{
    index: WorkspaceIndex | null;
    rootPath: string | null;
    sources: Map<string, WorkspaceIndexSourceCacheEntry>;
  }>({
    index: null,
    rootPath: null,
    sources: new Map(),
  });
  const recentFilesKey = useMemo(
    () => recentFiles.map((file) => `${file.path}:${file.lastOpened}`).join('\n'),
    [recentFiles],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!rootPath) {
        setBaseWorkspaceIndex(null);
        fallbackIndexCacheRef.current = {
          index: null,
          rootPath: null,
          sources: new Map(),
        };
        setWorkspaceIndexing(false);
        return;
      }

      setWorkspaceIndexing(true);

      try {
        const nativeIndex = await buildWorkspaceIndexNativeModel({
          rootPath,
          currentDocumentOverride: null,
          recentFiles: [],
        });
        if (!cancelled && nativeIndex) {
          setBaseWorkspaceIndex(nativeIndex);
          setWorkspaceIndexing(false);
          return;
        }
      } catch (error) {
        if (!isNativeCommandUnavailableError(error)) {
          console.warn('[useWorkspaceIndexModel] Native workspace index unavailable, falling back to TypeScript:', error);
        }
      }

      const files = flattenFiles(fileTree, rootPath)
        .map(({ node }) => node)
        .filter((node) => isSupportedMarkdownPath(node.path));

      if (files.length === 0) {
        setBaseWorkspaceIndex(null);
        setWorkspaceIndexing(false);
        return;
      }

      if (fallbackIndexCacheRef.current.rootPath !== rootPath) {
        fallbackIndexCacheRef.current = {
          index: null,
          rootPath,
          sources: new Map(),
        };
      }

      const documents = await readWorkspaceIndexSourcesIncremental(
        files,
        fallbackIndexCacheRef.current.sources,
      );
      const fallbackIndex = buildWorkspaceIndexIncremental({
        documents,
        fileTree,
        previousIndex: fallbackIndexCacheRef.current.index,
        workspaceRoot: rootPath,
      });
      fallbackIndexCacheRef.current.index = fallbackIndex;

      if (!cancelled) {
        setBaseWorkspaceIndex(fallbackIndex);
        setWorkspaceIndexing(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [fileTree, rootPath]);

  const workspaceIndex = useMemo<WorkspaceIndex | null>(() => {
    if (!baseWorkspaceIndex) return null;
    return applyWorkspaceIndexOverlay(baseWorkspaceIndex, {
      currentDocument: currentDocument?.path
        ? { path: currentDocument.path, content: currentDocument.content }
        : null,
      recentFiles,
    });
  }, [baseWorkspaceIndex, currentDocument?.content, currentDocument?.path, recentFiles, recentFilesKey]);

  return {
    workspaceIndex,
    workspaceIndexing,
  };
}
