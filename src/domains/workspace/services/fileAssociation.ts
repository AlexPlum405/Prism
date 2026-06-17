export type DocumentProfileKind = 'markdown' | 'text';

export interface DocumentProfile {
  kind: DocumentProfileKind;
  supportsExport: boolean;
  supportsMarkdownLinks: boolean;
  supportsPreview: boolean;
  supportsRelationGraph: boolean;
}

export const MARKDOWN_DOCUMENT_EXTENSIONS = ['md', 'markdown'] as const;
export const TEXT_DOCUMENT_EXTENSIONS = [
  'txt',
  'text',
  'sql',
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  'xml',
  'csv',
  'tsv',
  'log',
  'ini',
  'conf',
  'env',
] as const;
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  ...MARKDOWN_DOCUMENT_EXTENSIONS,
  ...TEXT_DOCUMENT_EXTENSIONS,
] as const;

export const MARKDOWN_DOCUMENT_PROFILE: DocumentProfile = {
  kind: 'markdown',
  supportsExport: true,
  supportsMarkdownLinks: true,
  supportsPreview: true,
  supportsRelationGraph: true,
};

export const TEXT_DOCUMENT_PROFILE: DocumentProfile = {
  kind: 'text',
  supportsExport: false,
  supportsMarkdownLinks: false,
  supportsPreview: false,
  supportsRelationGraph: false,
};

export const DOCUMENT_FILE_FILTERS = [
  { name: 'Markdown', extensions: [...MARKDOWN_DOCUMENT_EXTENSIONS] },
  { name: 'Text', extensions: [...TEXT_DOCUMENT_EXTENSIONS] },
];

export const MARKDOWN_FILE_FILTERS = DOCUMENT_FILE_FILTERS;
export const SUPPORTED_MARKDOWN_EXTENSIONS = MARKDOWN_DOCUMENT_EXTENSIONS;

function extensionForPath(path: string): string {
  const match = /\.([^.\\/]+)$/.exec(path);
  return match?.[1]?.toLowerCase() ?? '';
}

export function isSupportedMarkdownPath(path: string): boolean {
  return MARKDOWN_DOCUMENT_EXTENSIONS.includes(extensionForPath(path) as typeof MARKDOWN_DOCUMENT_EXTENSIONS[number]);
}

export function isTextDocumentPath(path: string): boolean {
  return TEXT_DOCUMENT_EXTENSIONS.includes(extensionForPath(path) as typeof TEXT_DOCUMENT_EXTENSIONS[number]);
}

export function isSupportedDocumentPath(path: string): boolean {
  return isSupportedMarkdownPath(path) || isTextDocumentPath(path);
}

export function getDocumentProfileForPath(path: string): DocumentProfile | null {
  if (isSupportedMarkdownPath(path)) return MARKDOWN_DOCUMENT_PROFILE;
  if (isTextDocumentPath(path)) return TEXT_DOCUMENT_PROFILE;
  return null;
}

export function getDocumentProfileOrMarkdown(path: string): DocumentProfile {
  return getDocumentProfileForPath(path) ?? MARKDOWN_DOCUMENT_PROFILE;
}
