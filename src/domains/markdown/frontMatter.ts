import { dump, load } from 'js-yaml';
import {
  frontMatterObject,
  frontMatterScalar,
  splitFrontMatterBlock,
} from './frontMatterBlock';

export interface DocumentFrontMatterProperties {
  author: string;
  date: string;
  description: string;
  exportRaw: string;
  status: string;
  tags: string;
  title: string;
}

export interface ParsedDocumentFrontMatter {
  body: string;
  data: Record<string, unknown>;
  error: string | null;
  hasFrontMatter: boolean;
  properties: DocumentFrontMatterProperties;
}

export const EMPTY_DOCUMENT_FRONT_MATTER_PROPERTIES: DocumentFrontMatterProperties = {
  title: '',
  tags: '',
  description: '',
  author: '',
  date: '',
  status: '',
  exportRaw: '',
};

function tagsValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => frontMatterScalar(item).trim()).filter(Boolean).join(', ');
  }
  return frontMatterScalar(value);
}

function exportValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return dump(value, { lineWidth: -1, noRefs: true, sortKeys: false }).trim();
}

function propertiesFromData(data: Record<string, unknown>): DocumentFrontMatterProperties {
  return {
    title: frontMatterScalar(data.title),
    tags: tagsValue(data.tags),
    description: frontMatterScalar(data.description),
    author: frontMatterScalar(data.author),
    date: frontMatterScalar(data.date),
    status: frontMatterScalar(data.status),
    exportRaw: exportValue(data.export),
  };
}

export function parseDocumentFrontMatter(content: string): ParsedDocumentFrontMatter {
  const block = splitFrontMatterBlock(content);
  if (!block.hasBlock) {
    return {
      body: content,
      data: {},
      error: null,
      hasFrontMatter: false,
      properties: { ...EMPTY_DOCUMENT_FRONT_MATTER_PROPERTIES },
    };
  }

  try {
    const data = frontMatterObject(load(block.raw));
    return {
      body: block.body,
      data,
      error: null,
      hasFrontMatter: true,
      properties: propertiesFromData(data),
    };
  } catch (error) {
    return {
      body: content,
      data: {},
      error: error instanceof Error ? error.message : String(error),
      hasFrontMatter: true,
      properties: { ...EMPTY_DOCUMENT_FRONT_MATTER_PROPERTIES },
    };
  }
}
