import { useEffect, useMemo, useState } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { OpenDocument } from '../../document/types';
import type { RecentFileEntry } from '../../settings/types';
import type { FileNode } from '../types';
import {
  buildWorkspaceIndex,
  flattenFiles,
  isSamePath,
  type WorkspaceIndex,
  type WorkspaceIndexSourceDocument,
} from '../services';

const MARKDOWN_FILE_RE = /\.(md|markdown|txt)$/i;

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
  const [workspaceIndexSources, setWorkspaceIndexSources] = useState<WorkspaceIndexSourceDocument[]>([]);
  const [workspaceIndexing, setWorkspaceIndexing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!rootPath) {
        setWorkspaceIndexSources([]);
        setWorkspaceIndexing(false);
        return;
      }

      const files = flattenFiles(fileTree, rootPath)
        .map(({ node }) => node)
        .filter((node) => MARKDOWN_FILE_RE.test(node.path));

      if (files.length === 0) {
        setWorkspaceIndexSources([]);
        setWorkspaceIndexing(false);
        return;
      }

      setWorkspaceIndexing(true);
      const documents = (await Promise.all(files.map(async (node) => {
        try {
          return {
            path: node.path,
            content: await readTextFile(node.path),
          };
        } catch {
          return null;
        }
      }))).filter((item): item is WorkspaceIndexSourceDocument => Boolean(item));

      if (!cancelled) {
        setWorkspaceIndexSources(documents);
        setWorkspaceIndexing(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [fileTree, rootPath]);

  const workspaceIndexDocuments = useMemo(() => {
    if (!currentDocument?.path || !MARKDOWN_FILE_RE.test(currentDocument.path)) {
      return workspaceIndexSources;
    }

    return [
      ...workspaceIndexSources.filter((document) => !isSamePath(document.path, currentDocument.path!)),
      { path: currentDocument.path, content: currentDocument.content },
    ];
  }, [currentDocument?.content, currentDocument?.path, workspaceIndexSources]);

  const workspaceIndex = useMemo<WorkspaceIndex | null>(() => {
    if (!rootPath) return null;
    return buildWorkspaceIndex({
      fileTree,
      workspaceRoot: rootPath,
      documents: workspaceIndexDocuments,
      recentFiles,
    });
  }, [fileTree, recentFiles, rootPath, workspaceIndexDocuments]);

  return {
    workspaceIndex,
    workspaceIndexing,
  };
}
