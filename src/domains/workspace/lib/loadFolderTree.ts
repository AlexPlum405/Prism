import { readDir, readTextFile, stat } from '../../../platform/tauri/fileSystem';
import { FileNode } from '../types';
import { isSupportedMarkdownPath, joinPath } from '../services';

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '.next',
  '.cache',
  '__pycache__',
  'venv',
  '.venv',
]);

const MAX_DEPTH = 8;

function stripFrontmatter(content: string): string {
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      return content.slice(end + 4);
    }
  }
  return content;
}

function extractPreview(content: string): string {
  if (!content) return '';

  let text = stripFrontmatter(content);
  text = text.replace(/^\|.*\|$/gm, '');
  text = text.replace(/^[\s]*\|[-| :]*\|[\s]*$/gm, '');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/\$\$[\s\S]*?\$\$/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  text = text.replace(/^#+\s+(.*)$/gm, '$1');
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  text = text.replace(/^>+\s*/gm, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/\$([^$]+)\$/g, '$1');
  text = text.replace(/[*_~]{1,3}/g, '');
  text = text.replace(/<[^>]*>/g, '');

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.join(' ').slice(0, 100);
}

async function buildFileNode(path: string, name: string): Promise<FileNode> {
  let preview = '';
  let size: number | undefined;
  let createdAt: number | undefined;
  let modifiedAt: number | undefined;

  try {
    const info = await stat(path);
    size = info.size;
    createdAt = info.birthtime?.getTime();
    modifiedAt = info.mtime?.getTime();
  } catch {
    size = undefined;
    createdAt = undefined;
    modifiedAt = undefined;
  }

  try {
    const content = await readTextFile(path);
    preview = extractPreview(content);
  } catch {
    preview = '';
  }

  return {
    path,
    name,
    kind: 'file',
    preview,
    size,
    createdAt,
    modifiedAt,
  };
}

async function readFolderChildren(folderPath: string, depth: number): Promise<FileNode[]> {
  if (depth >= MAX_DEPTH) return [];

  let entries;
  try {
    entries = await readDir(folderPath);
  } catch (err) {
    console.error(`[loadFolderTree] Failed to read dir ${folderPath}:`, err);
    return [];
  }

  const visibleEntries = entries
    .filter((entry) => !entry.name.startsWith('.'))
    .filter((entry) => {
      if (!entry.isDirectory) return entry.isFile && isSupportedMarkdownPath(entry.name);
      return !IGNORE_DIRS.has(entry.name);
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const nodes = await Promise.all(
    visibleEntries.map(async (entry): Promise<FileNode | null> => {
      const fullPath = joinPath(folderPath, entry.name);

      if (entry.isDirectory) {
        const children = await readFolderChildren(fullPath, depth + 1);
        // 只保留包含文件的目录（递归后 children 非空）
        if (children.length === 0) return null;
        return {
          path: fullPath,
          name: entry.name,
          kind: 'directory',
          children,
        };
      }

      return buildFileNode(fullPath, entry.name);
    }),
  );

  return nodes.filter((n): n is FileNode => n !== null);
}

export async function loadFolderTree(folderPath: string): Promise<FileNode[]> {
  return readFolderChildren(folderPath, 0);
}
