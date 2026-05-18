import { dump, load } from 'js-yaml';

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

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const EMPTY_PROPERTIES: DocumentFrontMatterProperties = {
  title: '',
  tags: '',
  description: '',
  author: '',
  date: '',
  status: '',
  exportRaw: '',
};

function stringValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value);
}

function tagsValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => stringValue(item).trim()).filter(Boolean).join(', ');
  }
  return stringValue(value);
}

function exportValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return dump(value, { lineWidth: -1, noRefs: true, sortKeys: false }).trim();
}

function normalizeLoadedYaml(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function propertiesFromData(data: Record<string, unknown>): DocumentFrontMatterProperties {
  return {
    title: stringValue(data.title),
    tags: tagsValue(data.tags),
    description: stringValue(data.description),
    author: stringValue(data.author),
    date: stringValue(data.date),
    status: stringValue(data.status),
    exportRaw: exportValue(data.export),
  };
}

function parseExportRaw(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const loaded = load(trimmed);
  return loaded === undefined ? trimmed : loaded;
}

function setStringField(data: Record<string, unknown>, key: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    delete data[key];
    return;
  }
  data[key] = trimmed;
}

export function parseDocumentFrontMatter(content: string): ParsedDocumentFrontMatter {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) {
    return {
      body: content,
      data: {},
      error: null,
      hasFrontMatter: false,
      properties: { ...EMPTY_PROPERTIES },
    };
  }

  try {
    const data = normalizeLoadedYaml(load(match[1]));
    return {
      body: content.slice(match[0].length),
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
      properties: { ...EMPTY_PROPERTIES },
    };
  }
}

export function updateDocumentFrontMatter(
  content: string,
  properties: DocumentFrontMatterProperties,
): string {
  const parsed = parseDocumentFrontMatter(content);
  if (parsed.error) {
    throw new Error('当前 Front Matter 不是有效 YAML，无法安全更新');
  }

  const data = { ...parsed.data };
  setStringField(data, 'title', properties.title);
  setStringField(data, 'description', properties.description);
  setStringField(data, 'author', properties.author);
  setStringField(data, 'date', properties.date);
  setStringField(data, 'status', properties.status);

  const tags = properties.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length > 0) data.tags = tags;
  else delete data.tags;

  const exportValue = parseExportRaw(properties.exportRaw);
  if (exportValue === undefined || exportValue === '') delete data.export;
  else data.export = exportValue;

  if (Object.keys(data).length === 0) {
    return parsed.body.replace(/^\r?\n/, '');
  }

  const yaml = dump(data, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  }).trimEnd();

  return `---\n${yaml}\n---\n${parsed.body.startsWith('\n') ? parsed.body : `\n${parsed.body}`}`;
}
