import { t } from '../../i18n';
import type { I18nKey } from '../../i18n';
import { dirname, joinPath } from '../../workspace/services/path';

export type ImageDiagnosticKind =
  | 'empty-target'
  | 'missing-file'
  | 'unsupported-protocol'
  | 'unresolved-relative';

export interface ImageDiagnostic {
  column: number;
  kind: ImageDiagnosticKind;
  line: number;
  message: string;
  resolvedPath?: string;
  target: string;
}

interface ImageScanContext {
  documentPath?: string;
  existsPath?: (path: string) => Promise<boolean>;
}

const MARKDOWN_IMAGE_RE = /!\[[^\]\n]*\]\(([^)\n]*)\)/g;
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const IMAGE_MESSAGE_KEY: Record<ImageDiagnosticKind, I18nKey> = {
  'empty-target': 'diagnostics.image.empty-target.message',
  'missing-file': 'diagnostics.image.missing-file.message',
  'unsupported-protocol': 'diagnostics.image.unsupported-protocol.message',
  'unresolved-relative': 'diagnostics.image.unresolved-relative.message',
};

function extractTarget(rawTarget: string): string {
  const trimmed = rawTarget.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('<') && trimmed.includes('>')) {
    return trimmed.slice(1, trimmed.indexOf('>'));
  }
  return trimmed.split(/\s+/)[0];
}

function stripTargetMetadata(target: string) {
  const hashIndex = target.indexOf('#');
  const queryIndex = target.indexOf('?');
  const indexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  return indexes.length > 0 ? target.slice(0, Math.min(...indexes)) : target;
}

function safeDecodeUri(value: string) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function isExternalImageTarget(value: string) {
  return /^https?:\/\//i.test(value)
    || value.startsWith('//')
    || value.startsWith('data:')
    || value.startsWith('blob:');
}

function isUnsupportedImageProtocol(value: string) {
  if (!URL_SCHEME_RE.test(value)) return false;
  return !value.startsWith('file://')
    && !isExternalImageTarget(value)
    && !isWindowsAbsolutePath(value);
}

function fileUrlToPath(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:') return null;
    const path = decodeURIComponent(url.pathname);
    return /^\/[a-zA-Z]:\//.test(path) ? path.slice(1) : path;
  } catch {
    return null;
  }
}

export function resolveMarkdownImagePath(target: string, documentPath?: string): string | null {
  const stripped = stripTargetMetadata(target.trim());
  if (!stripped || isExternalImageTarget(stripped) || isUnsupportedImageProtocol(stripped)) return null;
  if (stripped.startsWith('file://')) return fileUrlToPath(stripped);
  if (stripped.startsWith('/') || isWindowsAbsolutePath(stripped)) return safeDecodeUri(stripped);
  if (!documentPath) return null;
  return joinPath(dirname(documentPath), safeDecodeUri(stripped));
}

async function defaultExistsPath(path: string) {
  try {
    const fs = await import('@tauri-apps/plugin-fs');
    return typeof fs.exists === 'function' ? fs.exists(path) : true;
  } catch {
    return true;
  }
}

function createDiagnostic(input: {
  column: number;
  kind: ImageDiagnosticKind;
  line: number;
  resolvedPath?: string;
  target: string;
}) {
  const path = input.resolvedPath || input.target || t('editor.linkDiagnostics.emptyTarget');
  return {
    ...input,
    message: t(IMAGE_MESSAGE_KEY[input.kind], { path, target: input.target }),
  } satisfies ImageDiagnostic;
}

export async function scanMarkdownImageDiagnostics(
  content: string,
  context: ImageScanContext = {},
): Promise<ImageDiagnostic[]> {
  const diagnostics: ImageDiagnostic[] = [];
  const existsPath = context.existsPath ?? defaultExistsPath;

  for (const [lineIndex, lineText] of content.split('\n').entries()) {
    for (const match of lineText.matchAll(MARKDOWN_IMAGE_RE)) {
      const target = extractTarget(match[1]);
      const column = (match.index ?? 0) + 1;

      if (!target) {
        diagnostics.push(createDiagnostic({
          column,
          kind: 'empty-target',
          line: lineIndex + 1,
          target,
        }));
        continue;
      }

      if (isExternalImageTarget(target)) continue;
      if (isUnsupportedImageProtocol(target)) {
        diagnostics.push(createDiagnostic({
          column,
          kind: 'unsupported-protocol',
          line: lineIndex + 1,
          target,
        }));
        continue;
      }

      const resolvedPath = resolveMarkdownImagePath(target, context.documentPath);
      if (!resolvedPath) {
        diagnostics.push(createDiagnostic({
          column,
          kind: 'unresolved-relative',
          line: lineIndex + 1,
          target,
        }));
        continue;
      }

      if (!(await existsPath(resolvedPath))) {
        diagnostics.push(createDiagnostic({
          column,
          kind: 'missing-file',
          line: lineIndex + 1,
          resolvedPath,
          target,
        }));
      }
    }
  }

  return diagnostics;
}
