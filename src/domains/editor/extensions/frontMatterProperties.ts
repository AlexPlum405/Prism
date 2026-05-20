import { dump, load } from 'js-yaml';
import { t } from '../../i18n';
import {
  parseDocumentFrontMatter,
  type DocumentFrontMatterProperties,
} from '../../markdown/frontMatter';

export {
  parseDocumentFrontMatter,
  type DocumentFrontMatterProperties,
  type ParsedDocumentFrontMatter,
} from '../../markdown/frontMatter';

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

export function updateDocumentFrontMatter(
  content: string,
  properties: DocumentFrontMatterProperties,
): string {
  const parsed = parseDocumentFrontMatter(content);
  if (parsed.error) {
    throw new Error(t('editor.properties.invalidYaml'));
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
