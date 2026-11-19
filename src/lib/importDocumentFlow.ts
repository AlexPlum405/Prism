import { exists, mkdir, readFile, writeFile } from '../platform/tauri/fileSystem';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { basename, dirname, joinPath } from '../domains/workspace/services';
import { addRecentFile } from '../domains/workspace/services';
import { writeDocumentFileSession } from '../domains/document/services/fileSafety';
import {
  decodeImportText,
  detectImportFormat,
  importedDocumentStem,
  type ImportFormat,
} from '../domains/import/importFormat';
import { importDocxAsMarkdown } from '../domains/import/docxImport';
import { importHtmlAsMarkdown } from '../domains/import/htmlImport';
import type { ImportAsset, ImportConversionResult } from '../domains/import/types';
import { t } from '../domains/i18n';
import { grantImportFileScope, grantWorkspaceDirectoryScope } from './fileSystemScope';
import type { OpenDocumentFlowContext } from './openDocumentFlow';

export interface ImportDocumentResult {
  assetCount: number;
  format: ImportFormat;
  path: string;
  warnings: string[];
}

export interface ImportDocumentContext {
  documentStore: OpenDocumentFlowContext['documentStore'];
  showToast?: OpenDocumentFlowContext['showToast'];
  workspaceStore: OpenDocumentFlowContext['workspaceStore'];
}

function splitExtension(fileName: string): { extension: string; stem: string } {
  const index = fileName.lastIndexOf('.');
  if (index <= 0) return { extension: '', stem: fileName };
  return { extension: fileName.slice(index), stem: fileName.slice(0, index) };
}

async function uniqueImportPath(directory: string, stem: string): Promise<string> {
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : ` (${index})`;
    const candidate = joinPath(directory, `${stem}${suffix}.md`);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(t('import.nameCollision'));
}

async function uniqueAssetPath(directory: string, fileName: string): Promise<string> {
  const { extension, stem } = splitExtension(fileName);
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `-${index + 1}`;
    const candidate = joinPath(directory, `${stem}${suffix}${extension}`);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(t('import.nameCollision'));
}

async function writeImportAssets(
  directory: string,
  assets: ImportAsset[],
): Promise<void> {
  const assetsDirectory = joinPath(directory, 'assets');
  await mkdir(assetsDirectory, { recursive: true });

  for (const asset of assets) {
    const path = await uniqueAssetPath(assetsDirectory, asset.fileName);
    await writeFile(path, asset.bytes, { createNew: true });
  }
}

function convertSource(bytes: Uint8Array, format: ImportFormat): ImportConversionResult {
  if (format === 'docx') return importDocxAsMarkdown(bytes);

  const text = decodeImportText(bytes);
  if (format === 'html') return importHtmlAsMarkdown(text);

  // 已经是 Markdown / 纯文本时不做任何转写，避免把用户写好的语法二次解释
  return { assets: [], markdown: text, warnings: [] };
}

async function refreshWorkspaceTree(context: ImportDocumentContext): Promise<void> {
  const { rootPath, workspaceTreeScope } = context.workspaceStore;
  if (!rootPath) return;

  try {
    const tree = await loadFolderTree(rootPath, { scope: workspaceTreeScope ?? 'currentLevel' });
    context.workspaceStore.setFileTree(tree);
  } catch (error) {
    console.error('[importDocumentFlow] Failed to refresh workspace tree:', error);
  }
}

/**
 * 把外部文档导入成工作区里的 Markdown 文稿。
 *
 * 落盘顺序是「先资源、后正文」：正文一旦存在，用户就会打开它；如果图片
 * 后写而中途失败，文稿里会留下一片坏图链接。
 */
export async function importDocumentFromPath(
  sourcePath: string,
  context: ImportDocumentContext,
): Promise<ImportDocumentResult> {
  const format = detectImportFormat(sourcePath);
  if (!format) throw new Error(t('import.unsupported'));

  await grantImportFileScope(sourcePath);

  const bytes = await readFile(sourcePath);
  const converted = convertSource(bytes, format);
  const content = format === 'html' || format === 'docx'
    ? converted.markdown.trim()
    : converted.markdown;

  if (!content.trim()) throw new Error(t('import.emptyContent'));

  const targetDirectory = context.workspaceStore.rootPath || dirname(sourcePath);
  if (!context.workspaceStore.rootPath) {
    await grantWorkspaceDirectoryScope(targetDirectory).catch(() => undefined);
  }

  const stem = importedDocumentStem(sourcePath, t('import.untitledStem'));
  const targetPath = await uniqueImportPath(targetDirectory, stem);

  if (converted.assets.length > 0) {
    await writeImportAssets(targetDirectory, converted.assets);
  }

  const snapshot = await writeDocumentFileSession({
    createNew: true,
    content,
    path: targetPath,
  });

  context.documentStore.openDocument(targetPath, basename(targetPath), content, snapshot);
  addRecentFile(targetPath, basename(targetPath));
  await refreshWorkspaceTree(context);

  return {
    assetCount: converted.assets.length,
    format,
    path: targetPath,
    warnings: converted.warnings,
  };
}
