import type { ContentTheme } from '../../settings/types';

interface PlantUmlRenderOptions {
  documentPath?: string;
}

interface PlantUmlLittleRuntime {
  convert: (source: string) => string;
  graphvizVersion: string;
  version: string;
}

type PlantUmlNodeKind = 'class' | 'interface' | 'enum' | 'actor' | 'participant' | 'usecase' | 'component' | 'state';

interface PlantUmlThemeColors {
  background: string;
  headerFill: string;
  lineColor: string;
  mutedTextColor: string;
  primaryColor: string;
  textColor: string;
}

interface PlantUmlNode {
  id: string;
  kind: PlantUmlNodeKind;
  label: string;
  attributes: string[];
  methods: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PlantUmlRelationship {
  from: string;
  label: string;
  to: string;
  type: string;
}

interface PlantUmlDiagram {
  nodes: PlantUmlNode[];
  relationships: PlantUmlRelationship[];
}

let plantUmlLittleRuntimePromise: Promise<PlantUmlLittleRuntime> | null = null;
const plantUmlSvgCache = new Map<string, Promise<string>>();

const PLANT_UML_RELATION_PATTERN = /^(.+?)\s+([.<|*o+#[\]}{]*[-.]+(?:left|right|up|down)?[-.]*[.>|*o+#[\]}{]*)\s+(.+?)(?:\s*:\s*(.+))?$/i;

function getPlantUmlThemeColors(contentTheme: ContentTheme): PlantUmlThemeColors {
  switch (contentTheme) {
    case 'inkstone':
      return {
        background: '#FBF7EF',
        headerFill: '#F4E8D6',
        lineColor: '#9A3412',
        mutedTextColor: '#6F5E46',
        primaryColor: '#FFFAF0',
        textColor: '#2B261D',
      };
    case 'slate':
      return {
        background: '#F5F8FA',
        headerFill: '#E6EEF2',
        lineColor: '#246A73',
        mutedTextColor: '#667680',
        primaryColor: '#FBFDFE',
        textColor: '#1F2933',
      };
    case 'mono':
      return {
        background: '#FAFAF7',
        headerFill: '#EFEFEA',
        lineColor: '#B91C1C',
        mutedTextColor: '#525A52',
        primaryColor: '#FAFAF7',
        textColor: '#101310',
      };
    case 'nocturne':
      return {
        background: '#10110E',
        headerFill: '#24231B',
        lineColor: '#C45A84',
        mutedTextColor: '#A89D8A',
        primaryColor: '#1A1A15',
        textColor: '#E8DDC8',
      };
    case 'carbon':
      return {
        background: '#000000',
        headerFill: '#1C1C1C',
        lineColor: '#A3E635',
        mutedTextColor: '#A8A8A8',
        primaryColor: '#0F0F0F',
        textColor: '#EDEDED',
      };
    default:
      return {
        background: '#f7f7f7',
        headerFill: '#F1F1F1',
        lineColor: '#1C5D33',
        mutedTextColor: '#666666',
        primaryColor: '#FFFFFF',
        textColor: '#262626',
      };
  }
}

export function getPlantUmlSkinparams(contentTheme: ContentTheme) {
  const colors = getPlantUmlThemeColors(contentTheme);
  const baseParams = [
    `skinparam backgroundColor ${colors.background}`,
    `skinparam defaultTextColor ${colors.textColor}`,
    `skinparam defaultFontColor ${colors.textColor}`,
    'skinparam defaultFontName "Helvetica"',
    'skinparam defaultFontSize 12',
    `skinparam actorBackgroundColor ${colors.primaryColor}`,
    `skinparam actorFontColor ${colors.textColor}`,
    `skinparam participantBackgroundColor ${colors.primaryColor}`,
    `skinparam participantFontColor ${colors.textColor}`,
    `skinparam classBackgroundColor ${colors.primaryColor}`,
    `skinparam classFontColor ${colors.textColor}`,
    `skinparam classAttributeFontColor ${colors.textColor}`,
    `skinparam sequenceActorBackgroundColor ${colors.primaryColor}`,
    `skinparam sequenceActorFontColor ${colors.textColor}`,
    `skinparam sequenceGroupBackgroundColor ${colors.primaryColor}`,
    `skinparam sequenceGroupHeaderFontColor ${colors.textColor}`,
    'skinparam sequenceMessageTextAlignment center',
  ].join('\n');

  const arrowParams = `
skinparam arrowColor ${colors.lineColor}
skinparam sequenceArrowColor ${colors.lineColor}
skinparam usecaseArrowColor ${colors.lineColor}
skinparam classArrowColor ${colors.lineColor}
skinparam componentArrowColor ${colors.lineColor}
skinparam stateArrowColor ${colors.lineColor}
skinparam activityArrowColor ${colors.lineColor}`;

  const componentParams = `
skinparam note {
  BackgroundColor ${colors.primaryColor}
  FontColor ${colors.textColor}
}
skinparam activity {
  BackgroundColor ${colors.primaryColor}
  FontColor ${colors.textColor}
  ArrowColor ${colors.lineColor}
}
skinparam state {
  BackgroundColor ${colors.primaryColor}
  FontColor ${colors.textColor}
  ArrowColor ${colors.lineColor}
}
skinparam usecase {
  BackgroundColor ${colors.primaryColor}
  FontColor ${colors.textColor}
}
skinparam component {
  BackgroundColor ${colors.primaryColor}
  FontColor ${colors.textColor}
  ArrowColor ${colors.lineColor}
}`;

  return baseParams + arrowParams + componentParams;
}

function stripPlantUmlSkinparams(source: string) {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  let skippingSkinparamBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (skippingSkinparamBlock) {
      if (trimmed === '}') {
        skippingSkinparamBlock = false;
      }
      continue;
    }

    if (/^skinparam\b/i.test(trimmed)) {
      if (trimmed.includes('{') && !trimmed.includes('}')) {
        skippingSkinparamBlock = true;
      }
      continue;
    }

    output.push(line);
  }

  return output.join('\n').trimStart();
}

function injectPlantUmlSkinparams(source: string, skinparams: string) {
  const startPattern = /(^|\n)(@start[a-z0-9_:-]*[^\n\r]*(?:\r?\n|$))/i;
  const match = startPattern.exec(source);
  if (!match) return `${skinparams}\n${source}`;

  const insertionIndex = match.index + match[1].length + match[2].length;
  return `${source.slice(0, insertionIndex)}${skinparams}\n${source.slice(insertionIndex)}`;
}

export function preparePlantUmlSource(source: string, contentTheme: ContentTheme) {
  const withoutInlineSkinparams = stripPlantUmlSkinparams(source);
  return injectPlantUmlSkinparams(withoutInlineSkinparams, getPlantUmlSkinparams(contentTheme));
}

function getPlantUmlSvgCacheKey(source: string, contentTheme: ContentTheme, options: PlantUmlRenderOptions) {
  return [
    contentTheme,
    options.documentPath ?? '',
    preparePlantUmlSource(source, contentTheme),
  ].join('\u0000');
}

function createPlantUmlRenderError(message: string) {
  return new Error(message || 'PlantUML render failed');
}

async function loadPlantUmlLittleRuntime(): Promise<PlantUmlLittleRuntime> {
  if (!plantUmlLittleRuntimePromise) {
    plantUmlLittleRuntimePromise = Promise.all([
      import('@kookyleo/graphviz-anywhere-web/wasm'),
      import('@kookyleo/plantuml-little-web'),
    ]).then(async ([graphvizWasmModule, plantUmlModule]) => {
      const graphvizModule = await graphvizWasmModule.default();
      const graphviz = {
        layout(dot: string, format = 'svg', engine = 'dot') {
          const instance = new graphvizModule.CGraphviz();
          try {
            const output = instance.layout(dot, format, engine);
            const lastError = graphvizModule.CGraphviz.lastError().trim();
            if (!output) {
              throw createPlantUmlRenderError(lastError || 'Graphviz produced empty output');
            }
            return output;
          } finally {
            instance.delete();
          }
        },
        version: () => graphvizModule.CGraphviz.version(),
      };
      plantUmlModule.setup({ graphviz });
      return {
        convert: plantUmlModule.convert,
        graphvizVersion: graphviz.version(),
        version: plantUmlModule.version(),
      };
    });
  }

  return plantUmlLittleRuntimePromise;
}

function createAsciiPlaceholder(index: number, original: string) {
  const charCount = Array.from(original).length;
  const suffix = 'x'.repeat(Math.max(4, charCount * 2));
  return `PrismCjk${index.toString(36)}${suffix}`;
}

function encodeNonAsciiRunsForPlantUmlLittle(source: string) {
  const valueToPlaceholder = new Map<string, string>();
  const replacements: Array<[string, string]> = [];
  const encoded = source.replace(/[^\x00-\x7F]+/g, (value) => {
    let placeholder = valueToPlaceholder.get(value);
    if (!placeholder) {
      placeholder = createAsciiPlaceholder(valueToPlaceholder.size, value);
      valueToPlaceholder.set(value, placeholder);
      replacements.push([placeholder, value]);
    }
    return placeholder;
  });

  return { encoded, replacements };
}

function extractFirstSvgMarkup(svgText: string) {
  const match = /<svg\b[\s\S]*?<\/svg>/i.exec(svgText);
  return match?.[0] ?? '';
}

function restorePlantUmlTextPlaceholders(svg: SVGSVGElement, replacements: Array<[string, string]>) {
  if (replacements.length === 0) return;

  const walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
  const touchedTextElements = new Set<SVGElement>();
  let current = walker.nextNode();
  while (current) {
    let text = current.textContent ?? '';
    let changed = false;
    for (const [placeholder, value] of replacements) {
      if (text.includes(placeholder)) {
        text = text.split(placeholder).join(value);
        changed = true;
      }
    }
    if (changed) {
      current.textContent = text;
      const parent = current.parentElement;
      if (parent instanceof SVGElement && parent.tagName.toLowerCase() === 'text') {
        touchedTextElements.add(parent);
      }
    }
    current = walker.nextNode();
  }

  touchedTextElements.forEach((textElement) => {
    textElement.removeAttribute('lengthAdjust');
    textElement.removeAttribute('textLength');
  });

  svg.querySelectorAll<SVGElement>('[data-qualified-name]').forEach((element) => {
    const qualifiedName = element.getAttribute('data-qualified-name');
    if (!qualifiedName) return;
    let restored = qualifiedName;
    for (const [placeholder, value] of replacements) {
      restored = restored.split(placeholder).join(value);
    }
    if (restored !== qualifiedName) element.setAttribute('data-qualified-name', restored);
  });
}

function getSvgNumberAttribute(element: SVGElement, attribute: string) {
  const value = Number(element.getAttribute(attribute));
  return Number.isFinite(value) ? value : null;
}

function entityHasVisibleOwnText(entity: SVGElement, label: string) {
  return Array.from(entity.querySelectorAll('text')).some((textElement) => (
    (textElement.textContent ?? '').trim().includes(label)
  ));
}

function appendMissingEntityLabel(
  entity: SVGElement,
  label: string,
  contentTheme: ContentTheme | undefined,
) {
  const rect = Array.from(entity.children)
    .find((child): child is SVGRectElement => child.tagName.toLowerCase() === 'rect');
  if (!rect) return false;

  const x = getSvgNumberAttribute(rect, 'x') ?? 0;
  const y = getSvgNumberAttribute(rect, 'y') ?? 0;
  const width = getSvgNumberAttribute(rect, 'width');
  const height = getSvgNumberAttribute(rect, 'height');
  if (!width || !height) return false;

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.textContent = label;
  text.setAttribute('x', String(x + width / 2));
  text.setAttribute('y', String(y + height / 2 + 4.5));
  text.setAttribute('fill', getPlantUmlThemeColors(contentTheme ?? 'miaoyan').textColor);
  text.setAttribute('font-family', 'sans-serif');
  text.setAttribute('font-size', '14');
  text.setAttribute('text-anchor', 'middle');
  entity.append(text);
  return true;
}

function repairMissingPlantUmlEntityLabels(
  svg: SVGSVGElement,
  contentTheme?: ContentTheme,
) {
  svg.querySelectorAll<SVGElement>('g.entity[data-qualified-name]').forEach((entity) => {
    const label = entity.getAttribute('data-qualified-name')?.trim();
    if (!label || entityHasVisibleOwnText(entity, label)) return;
    appendMissingEntityLabel(entity, label, contentTheme);
  });
}

export function createPlantUmlSvgElementFromString(
  svgText: string,
  metadata: {
    contentTheme?: ContentTheme;
    graphvizVersion?: string;
    replacements?: Array<[string, string]>;
    rendererVersion?: string;
  } = {},
) {
  const svgMarkup = extractFirstSvgMarkup(svgText);
  if (!svgMarkup) throw createPlantUmlRenderError('PlantUML returned no SVG output');

  const parsed = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) {
    throw createPlantUmlRenderError('PlantUML returned invalid SVG output');
  }

  const parsedSvg = parsed.documentElement;
  if (parsedSvg.tagName.toLowerCase() !== 'svg') {
    throw createPlantUmlRenderError('PlantUML returned invalid SVG root');
  }

  const svg = document.importNode(parsedSvg, true) as unknown as SVGSVGElement;
  restorePlantUmlTextPlaceholders(svg, metadata.replacements ?? []);
  repairMissingPlantUmlEntityLabels(svg, metadata.contentTheme);
  svg.classList.add('plantuml-image');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'PlantUML diagram');
  svg.setAttribute('data-plantuml-renderer', 'plantuml-little');
  if (metadata.rendererVersion) {
    svg.setAttribute('data-plantuml-version', metadata.rendererVersion);
  }
  if (metadata.graphvizVersion) {
    svg.setAttribute('data-graphviz-version', metadata.graphvizVersion);
  }
  svg.style.display = 'block';
  svg.style.marginInline = 'auto';
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
  return svg;
}

async function renderPlantUmlSvgStringUncached(
  source: string,
  contentTheme: ContentTheme,
  options: PlantUmlRenderOptions,
) {
  const runtime = await loadPlantUmlLittleRuntime();
  const preparedSource = preparePlantUmlSource(source, contentTheme);
  const { encoded, replacements } = encodeNonAsciiRunsForPlantUmlLittle(preparedSource);
  const svgText = runtime.convert(encoded);
  const svg = createPlantUmlSvgElementFromString(svgText, {
    contentTheme,
    graphvizVersion: runtime.graphvizVersion,
    rendererVersion: runtime.version,
    replacements,
  });
  svg.setAttribute('data-plantuml-document-path', options.documentPath ?? '');
  return new XMLSerializer().serializeToString(svg);
}

export async function renderPlantUmlSvgString(
  source: string,
  contentTheme: ContentTheme,
  options: PlantUmlRenderOptions = {},
) {
  const key = getPlantUmlSvgCacheKey(source, contentTheme, options);
  let cached = plantUmlSvgCache.get(key);
  if (!cached) {
    cached = renderPlantUmlSvgStringUncached(source, contentTheme, options).catch((error) => {
      if (plantUmlSvgCache.get(key) === cached) {
        plantUmlSvgCache.delete(key);
      }
      throw error;
    });
    plantUmlSvgCache.set(key, cached);
  }

  return cached;
}

export async function createPlantUmlSvgElement(
  source: string,
  contentTheme: ContentTheme,
  options: PlantUmlRenderOptions = {},
) {
  const svgText = await renderPlantUmlSvgString(source, contentTheme, options);
  return createPlantUmlSvgElementFromString(svgText);
}

export function clearPlantUmlSvgCache() {
  plantUmlSvgCache.clear();
}

function normalizeLine(line: string) {
  return line.trim().replace(/\s+/g, ' ');
}

function stripQuotes(value: string) {
  return value.trim().replace(/^"(.+)"$/, '$1').replace(/^\[(.+)]$/, '$1').trim();
}

function normalizeNodeId(value: string) {
  return stripQuotes(value)
    .replace(/\s+as\s+\S+$/i, '')
    .replace(/[{}]/g, '')
    .trim();
}

function parseNodeNameAndAlias(source: string) {
  const clean = source.replace(/\s*\{\s*$/, '').trim();
  const match = /^(?:"([^"]+)"|([^\s]+))(?:\s+as\s+("[^"]+"|[^\s]+))?/i.exec(clean);
  if (!match) return null;
  const label = stripQuotes(match[1] ?? match[2] ?? '');
  const alias = match[3] ? stripQuotes(match[3]) : label;
  return { alias, label };
}

function getDeclarationKind(rawKind: string): PlantUmlNodeKind {
  const normalized = rawKind.toLowerCase().replace(/\s+/g, ' ');
  if (normalized.includes('interface')) return 'interface';
  if (normalized.includes('enum')) return 'enum';
  if (normalized.includes('actor')) return 'actor';
  if (normalized.includes('participant')) return 'participant';
  if (normalized.includes('usecase')) return 'usecase';
  if (normalized.includes('component')) return 'component';
  if (normalized.includes('state')) return 'state';
  return 'class';
}

function createNode(kind: PlantUmlNodeKind, label: string, alias?: string): PlantUmlNode {
  const id = alias || label;
  return {
    id,
    kind,
    label,
    attributes: [],
    methods: [],
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
}

function splitClassMember(rawMember: string) {
  const member = rawMember.trim().replace(/^[+#~\-]\s*/, '').trim();
  if (!member) return null;
  return {
    kind: member.includes('(') ? 'method' : 'attribute',
    text: member,
  };
}

function addNode(nodes: PlantUmlNode[], aliasMap: Map<string, string>, node: PlantUmlNode) {
  const existing = nodes.find((candidate) => candidate.id === node.id || candidate.label === node.label);
  if (existing) {
    aliasMap.set(node.id, existing.id);
    aliasMap.set(node.label, existing.id);
    return existing;
  }
  nodes.push(node);
  aliasMap.set(node.id, node.id);
  aliasMap.set(node.label, node.id);
  return node;
}

function resolveNodeId(endpoint: string, nodes: PlantUmlNode[], aliasMap: Map<string, string>) {
  const normalized = normalizeNodeId(endpoint);
  const mapped = aliasMap.get(normalized);
  if (mapped) return mapped;
  const node = addNode(nodes, aliasMap, createNode('class', normalized));
  return node.id;
}

function parsePlantUmlSource(source: string): PlantUmlDiagram {
  const lines = stripPlantUmlSkinparams(source)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("'") && !line.startsWith('//'))
    .filter((line) => !/^@start\w*/i.test(line) && !/^@enduml/i.test(line));

  const nodes: PlantUmlNode[] = [];
  const aliasMap = new Map<string, string>();
  const relationships: PlantUmlRelationship[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const declaration = /^(abstract\s+class|class|interface|enum|actor|participant|usecase|component|state)\s+(.+)$/i.exec(line);
    if (declaration) {
      const kind = getDeclarationKind(declaration[1]);
      const parsedName = parseNodeNameAndAlias(declaration[2]);
      if (!parsedName) continue;
      const node = addNode(nodes, aliasMap, createNode(kind, parsedName.label, parsedName.alias));
      const hasBlockStart = line.includes('{');
      const hasInlineBlockEnd = line.includes('}');

      if (hasBlockStart && !hasInlineBlockEnd) {
        for (index += 1; index < lines.length; index += 1) {
          const memberLine = lines[index].trim();
          if (memberLine === '}') break;
          const member = splitClassMember(memberLine);
          if (!member) continue;
          if (member.kind === 'method') node.methods.push(member.text);
          else node.attributes.push(member.text);
        }
      }
      continue;
    }

    const relationship = PLANT_UML_RELATION_PATTERN.exec(line);
    if (!relationship) continue;
    const from = resolveNodeId(relationship[1], nodes, aliasMap);
    const to = resolveNodeId(relationship[3], nodes, aliasMap);
    relationships.push({
      from,
      label: normalizeLine(relationship[4] ?? ''),
      to,
      type: relationship[2],
    });
  }

  if (nodes.length === 0 && source.trim()) {
    addNode(nodes, aliasMap, createNode('class', 'PlantUML'));
  }

  return { nodes, relationships };
}

function measureTextWidth(text: string, fontSize = 12) {
  return [...text].reduce((total, char) => (
    total + (char.charCodeAt(0) > 255 ? fontSize : fontSize * 0.56)
  ), 0);
}

function measureNode(node: PlantUmlNode) {
  if (node.kind === 'actor') {
    node.width = Math.max(104, Math.ceil(measureTextWidth(node.label, 13) + 36));
    node.height = 98;
    return;
  }

  const members = [...node.attributes, ...node.methods];
  const maxTextWidth = Math.max(
    measureTextWidth(node.label, 13),
    ...members.map((member) => measureTextWidth(member, 11)),
    96,
  );
  node.width = Math.min(260, Math.max(146, Math.ceil(maxTextWidth + 32)));
  node.height = Math.max(54, 38 + members.length * 19 + (node.methods.length > 0 && node.attributes.length > 0 ? 8 : 0));
}

function layoutDiagram(diagram: PlantUmlDiagram) {
  diagram.nodes.forEach(measureNode);
  const nodeCount = Math.max(1, diagram.nodes.length);
  const columns = nodeCount <= 2 ? nodeCount : Math.ceil(Math.sqrt(nodeCount));
  const cellWidth = Math.max(...diagram.nodes.map((node) => node.width), 150) + 96;
  const cellHeight = Math.max(...diagram.nodes.map((node) => node.height), 92) + 78;
  const padding = 28;

  diagram.nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    node.x = padding + column * cellWidth + Math.max(0, (cellWidth - 96 - node.width) / 2);
    node.y = padding + row * cellHeight;
  });

  const rows = Math.ceil(nodeCount / columns);
  return {
    height: padding * 2 + rows * cellHeight - 78 + Math.max(...diagram.nodes.map((node) => node.height), 92),
    width: padding * 2 + columns * cellWidth - 96,
  };
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K) {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

function appendText(
  parent: SVGElement,
  text: string,
  attrs: Record<string, string | number>,
) {
  const textElement = createSvgElement('text');
  textElement.textContent = text;
  Object.entries(attrs).forEach(([key, value]) => textElement.setAttribute(key, String(value)));
  parent.append(textElement);
  return textElement;
}

function drawNode(parent: SVGElement, node: PlantUmlNode, colors: PlantUmlThemeColors) {
  const group = createSvgElement('g');
  group.setAttribute('class', `plantuml-node plantuml-node--${node.kind}`);
  group.setAttribute('transform', `translate(${node.x} ${node.y})`);
  parent.append(group);

  if (node.kind === 'actor') {
    const centerX = node.width / 2;
    const strokeWidth = '1.2';
    const head = createSvgElement('circle');
    head.setAttribute('cx', String(centerX));
    head.setAttribute('cy', '18');
    head.setAttribute('r', '11');
    head.setAttribute('fill', colors.primaryColor);
    head.setAttribute('stroke', colors.lineColor);
    head.setAttribute('stroke-width', strokeWidth);
    group.append(head);

    const body = createSvgElement('path');
    body.setAttribute('d', `M ${centerX} 30 L ${centerX} 58 M ${centerX - 22} 40 L ${centerX + 22} 40 M ${centerX} 58 L ${centerX - 18} 78 M ${centerX} 58 L ${centerX + 18} 78`);
    body.setAttribute('fill', 'none');
    body.setAttribute('stroke', colors.lineColor);
    body.setAttribute('stroke-width', strokeWidth);
    body.setAttribute('stroke-linecap', 'round');
    group.append(body);

    appendText(group, node.label, {
      x: centerX,
      y: 94,
      fill: colors.textColor,
      'font-family': '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif',
      'font-size': 12,
      'font-weight': 500,
      'text-anchor': 'middle',
    });
    return;
  }

  const rect = createSvgElement('rect');
  rect.setAttribute('width', String(node.width));
  rect.setAttribute('height', String(node.height));
  rect.setAttribute('rx', '5');
  rect.setAttribute('fill', colors.primaryColor);
  rect.setAttribute('stroke', colors.lineColor);
  rect.setAttribute('stroke-width', '1');
  group.append(rect);

  const header = createSvgElement('rect');
  header.setAttribute('width', String(node.width));
  header.setAttribute('height', '34');
  header.setAttribute('rx', '5');
  header.setAttribute('fill', colors.headerFill);
  group.append(header);

  const headerMask = createSvgElement('rect');
  headerMask.setAttribute('y', '28');
  headerMask.setAttribute('width', String(node.width));
  headerMask.setAttribute('height', '7');
  headerMask.setAttribute('fill', colors.headerFill);
  group.append(headerMask);

  const headerLine = createSvgElement('line');
  headerLine.setAttribute('x1', '0');
  headerLine.setAttribute('x2', String(node.width));
  headerLine.setAttribute('y1', '34');
  headerLine.setAttribute('y2', '34');
  headerLine.setAttribute('stroke', colors.lineColor);
  headerLine.setAttribute('stroke-width', '0.8');
  headerLine.setAttribute('opacity', '0.65');
  group.append(headerLine);

  const stereotype = node.kind === 'class' ? '' : `<<${node.kind}>> `;
  appendText(group, `${stereotype}${node.label}`, {
    x: node.width / 2,
    y: 22,
    fill: colors.textColor,
    'font-family': '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif',
    'font-size': 13,
    'font-weight': 600,
    'text-anchor': 'middle',
  });

  let y = 52;
  for (const attribute of node.attributes) {
    appendText(group, attribute, {
      x: 12,
      y,
      fill: colors.textColor,
      'font-family': '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif',
      'font-size': 11,
    });
    y += 19;
  }

  if (node.attributes.length > 0 && node.methods.length > 0) {
    const separator = createSvgElement('line');
    separator.setAttribute('x1', '0');
    separator.setAttribute('x2', String(node.width));
    separator.setAttribute('y1', String(y - 8));
    separator.setAttribute('y2', String(y - 8));
    separator.setAttribute('stroke', colors.lineColor);
    separator.setAttribute('stroke-width', '0.7');
    separator.setAttribute('opacity', '0.45');
    group.append(separator);
  }

  for (const method of node.methods) {
    appendText(group, method, {
      x: 12,
      y,
      fill: colors.textColor,
      'font-family': '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif',
      'font-size': 11,
    });
    y += 19;
  }
}

function getNodeCenter(node: PlantUmlNode) {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function getAnchorPoint(node: PlantUmlNode, target: PlantUmlNode) {
  const source = getNodeCenter(node);
  const destination = getNodeCenter(target);
  const dx = destination.x - source.x;
  const dy = destination.y - source.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx >= 0 ? node.x + node.width : node.x,
      y: source.y,
    };
  }

  return {
    x: source.x,
    y: dy >= 0 ? node.y + node.height : node.y,
  };
}

function drawRelationship(
  parent: SVGElement,
  relationship: PlantUmlRelationship,
  nodesById: Map<string, PlantUmlNode>,
  colors: PlantUmlThemeColors,
  markerId: string,
) {
  const from = nodesById.get(relationship.from);
  const to = nodesById.get(relationship.to);
  if (!from || !to) return;

  const start = getAnchorPoint(from, to);
  const end = getAnchorPoint(to, from);
  const path = createSvgElement('path');
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const curve = Math.abs(start.x - end.x) > Math.abs(start.y - end.y)
    ? `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;

  path.setAttribute('class', 'plantuml-link');
  path.setAttribute('d', curve);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', colors.lineColor);
  path.setAttribute('stroke-width', relationship.type.includes('..') ? '1' : '1.2');
  path.setAttribute('stroke-linecap', 'round');
  if (relationship.type.includes('..')) path.setAttribute('stroke-dasharray', '4 4');
  if (relationship.type.includes('>')) path.setAttribute('marker-end', `url(#${markerId})`);
  parent.append(path);

  if (relationship.label) {
    const labelWidth = Math.max(44, measureTextWidth(relationship.label, 11) + 14);
    const label = createSvgElement('g');
    label.setAttribute('class', 'plantuml-link-label');
    const rect = createSvgElement('rect');
    rect.setAttribute('x', String(midX - labelWidth / 2));
    rect.setAttribute('y', String(midY - 16));
    rect.setAttribute('width', String(labelWidth));
    rect.setAttribute('height', '20');
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', colors.background);
    rect.setAttribute('opacity', '0.92');
    label.append(rect);
    appendText(label, relationship.label, {
      x: midX,
      y: midY - 2,
      fill: colors.mutedTextColor,
      'font-family': '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", sans-serif',
      'font-size': 11,
      'text-anchor': 'middle',
    });
    parent.append(label);
  }
}

export function createFallbackPlantUmlSvgElement(source: string, contentTheme: ContentTheme) {
  const colors = getPlantUmlThemeColors(contentTheme);
  const diagram = parsePlantUmlSource(source);
  const size = layoutDiagram(diagram);
  const svg = createSvgElement('svg');
  const markerId = `plantuml-arrow-${Math.random().toString(36).slice(2)}`;

  svg.classList.add('plantuml-image');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'PlantUML diagram');
  svg.setAttribute('width', String(size.width));
  svg.setAttribute('height', String(size.height));
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  svg.setAttribute('data-plantuml-renderer', 'fallback-local');
  svg.style.display = 'block';
  svg.style.marginInline = 'auto';
  svg.style.width = `${size.width}px`;
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';

  const defs = createSvgElement('defs');
  const marker = createSvgElement('marker');
  marker.setAttribute('id', markerId);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto-start-reverse');
  const arrow = createSvgElement('path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', colors.lineColor);
  marker.append(arrow);
  defs.append(marker);
  svg.append(defs);

  const background = createSvgElement('rect');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', colors.background);
  background.setAttribute('rx', '6');
  svg.append(background);

  const edgeLayer = createSvgElement('g');
  edgeLayer.setAttribute('class', 'plantuml-links');
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]));
  diagram.relationships.forEach((relationship) => drawRelationship(edgeLayer, relationship, nodesById, colors, markerId));
  svg.append(edgeLayer);

  const nodeLayer = createSvgElement('g');
  nodeLayer.setAttribute('class', 'plantuml-nodes');
  diagram.nodes.forEach((node) => drawNode(nodeLayer, node, colors));
  svg.append(nodeLayer);

  return svg;
}

export function renderFallbackPlantUmlSvgString(source: string, contentTheme: ContentTheme) {
  return new XMLSerializer().serializeToString(createFallbackPlantUmlSvgElement(source, contentTheme));
}

export const __plantUmlTesting = {
  clearPlantUmlSvgCache,
  encodeNonAsciiRunsForPlantUmlLittle,
  injectPlantUmlSkinparams,
};
