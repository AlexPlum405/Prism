import { exists, mkdir, writeFile } from '../../../platform/tauri/fileSystem';
import { t } from '../../i18n';

interface ClipboardImageInput {
  documentName: string;
  documentPath: string;
  file: File;
  now?: Date;
}

const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const SUPPORTED_IMAGE_EXTENSION_RE = /\.(gif|jpe?g|png|webp)$/i;

function dirname(path: string): string {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join(path.includes('\\') ? '\\' : '/');
}

function joinFsPath(dir: string, name: string): string {
  const trimmed = dir.replace(/[\\/]+$/, '');
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${trimmed}${sep}${name}`;
}

function stripMarkdownExtension(filename: string): string {
  return filename.replace(/\.(md|markdown|txt)$/i, '') || 'document';
}

export function getClipboardImageExtension(mimeType: string, filename = ''): string {
  const byType = IMAGE_EXTENSION_BY_TYPE[mimeType.toLowerCase()];
  if (byType) return byType;

  const extension = filename.match(SUPPORTED_IMAGE_EXTENSION_RE)?.[1]?.toLowerCase();
  if (extension === 'jpeg') return 'jpg';
  return extension ?? 'png';
}

export function isSupportedImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.startsWith('image/') || SUPPORTED_IMAGE_EXTENSION_RE.test(file.name);
}

export function getNativeImageFilePath(file: File): string | null {
  const candidate = (file as File & { path?: unknown }).path;
  return typeof candidate === 'string' && candidate.trim() ? candidate : null;
}

export function getMarkdownImageForPath(path: string, alt = ''): string {
  return `![${alt}](${path.replace(/\\/g, '/')})`;
}

export function sanitizeAssetSegment(value: string): string {
  return value
    .replace(/\.(md|markdown|txt)$/i, '')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    || 'document';
}

export function formatPastedImageTimestamp(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

export function getPastedImageAssetTarget(input: {
  documentName: string;
  documentPath: string;
  extension: string;
  index?: number;
  now: Date;
}) {
  const documentDir = dirname(input.documentPath);
  const assetFolder = sanitizeAssetSegment(stripMarkdownExtension(input.documentName));
  const assetDir = joinFsPath(joinFsPath(documentDir, 'assets'), assetFolder);
  const suffix = input.index && input.index > 0 ? `-${input.index + 1}` : '';
  const filename = `image-${formatPastedImageTimestamp(input.now)}${suffix}.${input.extension}`;

  return {
    assetDir,
    filename,
    filePath: joinFsPath(assetDir, filename),
    markdownPath: `assets/${assetFolder}/${filename}`,
  };
}

export async function saveClipboardImage(input: ClipboardImageInput): Promise<string> {
  const extension = getClipboardImageExtension(input.file.type, input.file.name);
  const now = input.now ?? new Date();

  let target = getPastedImageAssetTarget({
    documentName: input.documentName,
    documentPath: input.documentPath,
    extension,
    now,
  });

  if (!(await exists(target.assetDir))) {
    await mkdir(target.assetDir, { recursive: true });
  }

  for (let index = 0; index < 100; index += 1) {
    target = getPastedImageAssetTarget({
      documentName: input.documentName,
      documentPath: input.documentPath,
      extension,
      index,
      now,
    });
    if (!(await exists(target.filePath))) {
      const bytes = new Uint8Array(await input.file.arrayBuffer());
      await writeFile(target.filePath, bytes);
      return `![${target.filename}](${target.markdownPath})`;
    }
  }

  throw new Error(t('editor.image.uniqueNameFailed'));
}
