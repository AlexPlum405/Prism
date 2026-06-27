export interface PresentationSlide {
  background?: string;
  backgroundIframe?: string;
  markdown: string;
}

export type PresentationConfigValue = boolean | number | string | null | PresentationConfigValue[];

export interface PresentationConfig {
  [key: string]: PresentationConfigValue | undefined;
  backgroundTransition?: string;
  controls?: boolean;
  progress?: boolean;
  slideNumber?: boolean | string;
  transition?: string;
  transitionSpeed?: string;
}

export interface PresentationDeck {
  config: PresentationConfig;
  slides: PresentationSlide[];
}

const SLIDE_SEPARATOR_PATTERN = /^\s*---\s*$/;
const LEADING_HTML_COMMENT_PATTERN = /^\s*<!--([\s\S]*?)-->\s*/;
const SLIDE_ATTRIBUTE_COMMENT_PATTERN = /<!--\s*\.slide:\s*([\s\S]*?)-->/g;
const ELEMENT_ATTRIBUTE_COMMENT_PATTERN = /^(.*?)(?:\s*)<!--\s*\.element:\s*([\s\S]*?)-->\s*$/;
const ATTRIBUTE_PATTERN = /([A-Za-z][\w-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;

function findFrontMatterEndLine(lines: string[]) {
  if (lines[0]?.trim() !== '---') return -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') return index;
  }
  return -1;
}

function parsePresentationConfigValue(rawValue: string): PresentationConfigValue {
  const value = rawValue.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const body = value.slice(1, -1).trim();
    if (!body) return [];
    return body.split(',').map((item) => parsePresentationConfigValue(item));
  }
  return value;
}

function extractLeadingConfig(markdown: string): { config: PresentationConfig; markdown: string } {
  const match = LEADING_HTML_COMMENT_PATTERN.exec(markdown);
  if (!match) return { config: {}, markdown };

  const config: PresentationConfig = {};
  const commentBody = match[1] ?? '';
  commentBody.split('\n').forEach((line) => {
    const entry = /^\s*([A-Za-z][\w.-]*)\s*:\s*(.*?)\s*$/.exec(line);
    if (!entry) return;
    const key = entry[1];
    if (!key) return;
    config[key] = parsePresentationConfigValue(entry[2] ?? '');
  });

  return {
    config,
    markdown: markdown.slice(match[0].length),
  };
}

function parseSlideAttributes(rawAttributes: string) {
  const attrs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = ATTRIBUTE_PATTERN.exec(rawAttributes)) !== null) {
    const key = match[1];
    if (!key) continue;
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function renderElementAttributes(attrs: Record<string, string>) {
  return Object.entries(attrs)
    .filter(([key]) => /^[A-Za-z][\w-]*$/.test(key))
    .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
    .join(' ');
}

function applyElementAttributeComments(markdown: string) {
  return markdown.split('\n').map((line) => {
    const match = ELEMENT_ATTRIBUTE_COMMENT_PATTERN.exec(line);
    if (!match) return line;

    const before = match[1] ?? '';
    const attrs = parseSlideAttributes(match[2] ?? '');
    if (!attrs.class?.split(/\s+/).includes('fragment')) return before.trimEnd();

    const renderedAttrs = renderElementAttributes(attrs);
    const listMatch = /^(\s*(?:[-+*]|\d+[.)])\s+)(.*)$/.exec(before);
    if (listMatch) {
      return `${listMatch[1]}<span ${renderedAttrs}>${listMatch[2].trim()}</span>`;
    }

    return `<p ${renderedAttrs}>${before.trim()}</p>`;
  }).join('\n');
}

function extractSlideMetadata(markdown: string): PresentationSlide {
  let background: string | undefined;
  let backgroundIframe: string | undefined;
  const withoutSlideComments = markdown.replace(SLIDE_ATTRIBUTE_COMMENT_PATTERN, (_comment, rawAttributes: string) => {
    const attrs = parseSlideAttributes(rawAttributes);
    background = attrs['data-background'] ?? background;
    backgroundIframe = attrs['data-background-iframe'] ?? backgroundIframe;
    return '';
  }).trim();

  return {
    background,
    backgroundIframe,
    markdown: applyElementAttributeComments(withoutSlideComments),
  };
}

export function getPresentationDeck(content: string): PresentationDeck {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const frontMatterEnd = findFrontMatterEndLine(lines);
  const bodyStart = frontMatterEnd >= 0 ? frontMatterEnd + 1 : 0;
  const body = lines.slice(bodyStart);
  const chunks: string[] = [];
  let current: string[] = [];

  body.forEach((line) => {
    if (SLIDE_SEPARATOR_PATTERN.test(line)) {
      chunks.push(current.join('\n'));
      current = [];
      return;
    }
    current.push(line);
  });
  chunks.push(current.join('\n'));

  const firstChunk = chunks[0] ?? '';
  const { config, markdown } = extractLeadingConfig(firstChunk);
  const normalizedChunks = [markdown, ...chunks.slice(1)];

  const slides = normalizedChunks
    .map((chunk) => extractSlideMetadata(chunk))
    .filter((slide) => slide.markdown.trim().length > 0 || slide.backgroundIframe);

  return { config, slides };
}

export function getPresentationSlides(content: string): PresentationSlide[] {
  return getPresentationDeck(content).slides;
}

export function hasPresentationSlides(content: string) {
  return getPresentationSlides(content).length > 1;
}
