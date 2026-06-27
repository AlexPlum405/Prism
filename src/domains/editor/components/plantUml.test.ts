import { beforeEach, describe, expect, it, vi } from 'vitest';

const graphvizInstanceDeleteMock = vi.hoisted(() => vi.fn());
const graphvizLayoutMock = vi.hoisted(() => vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
const graphvizLoadMock = vi.hoisted(() => vi.fn(async () => ({
  CGraphviz: Object.assign(
    vi.fn(() => ({
      delete: graphvizInstanceDeleteMock,
      layout: graphvizLayoutMock,
    })),
    {
      lastError: vi.fn(() => ''),
      version: vi.fn(() => '15.0.0'),
    },
  ),
})));
const setupMock = vi.hoisted(() => vi.fn());
const convertMock = vi.hoisted(() => vi.fn((source: string) => {
  const tokens = Array.from(new Set(source.match(/PrismCjk[0-9a-z]+/g) ?? []));
  const labels = tokens.length > 0 ? tokens : ['Alice', 'Bob', 'Hello'];
  return [
    '<?plantuml 1.2026.2?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">',
    '<g class="entity">',
    `<text lengthAdjust="spacing" textLength="120">${labels.join(' ')}</text>`,
    '</g>',
    '</svg>',
  ].join('');
}));

vi.mock('@kookyleo/graphviz-anywhere-web/wasm', () => ({
  default: graphvizLoadMock,
}));

vi.mock('@kookyleo/plantuml-little-web', () => ({
  convert: convertMock,
  hasGraphvizBridge: vi.fn(() => true),
  setup: setupMock,
  version: vi.fn(() => '1.2026.2-3'),
}));

import {
  __plantUmlTesting,
  createPlantUmlSvgElement,
  preparePlantUmlSource,
  renderPlantUmlSvgString,
} from './plantUml';

const MIAOYAN_CHARACTER_PLANTUML = [
  '@startuml',
  'class 王子服 {',
  '  -姓名: String',
  '  -身份: 书生',
  '  -性格: 痴情',
  '  +游学()',
  '  +求婚()',
  '}',
  '',
  'class 婴宁 {',
  '  -真身: 狐仙',
  '  -特点: 善笑',
  '  -美貌: 绝世',
  '  +化身人形()',
  '  +展现真容()',
  '}',
  '',
  'class 婴宁母亲 {',
  '  -身份: 老狐仙',
  '  -性格: 慈祥',
  '  +保护女儿()',
  '  +成全恋情()',
  '}',
  '',
  'class 鬼仆 {',
  '  -职责: 护卫',
  '  +服侍主人()',
  '}',
  '',
  '王子服 --> 婴宁 : 爱慕',
  '婴宁 --> 王子服 : 钟情',
  '婴宁母亲 --> 婴宁 : 母女情深',
  '鬼仆 --> 婴宁母亲 : 忠心侍奉',
  '@enduml',
].join('\n');

describe('PlantUML rendering helpers', () => {
  beforeEach(() => {
    __plantUmlTesting.clearPlantUmlSvgCache();
    graphvizLoadMock.mockClear();
    setupMock.mockClear();
    convertMock.mockClear();
  });

  it('renders class diagrams through plantuml-little without remote URLs', async () => {
    const svg = await renderPlantUmlSvgString([
      '@startuml',
      'class 王子服 {',
      '  -姓名: String',
      '  +求婚()',
      '}',
      'class 婴宁 {',
      '  -真身: 狐仙',
      '  +化身人形()',
      '}',
      '王子服 --> 婴宁 : 爱慕',
      '@enduml',
    ].join('\n'), 'miaoyan');

    expect(svg).toContain('data-plantuml-renderer="plantuml-little"');
    expect(svg).toContain('data-plantuml-version="1.2026.2-3"');
    expect(svg).toContain('王子服');
    expect(svg).toContain('婴宁');
    expect(svg).toContain('爱慕');
    expect(svg).toContain('姓名');
    expect(svg).toContain('求婚');
    expect(svg).not.toContain('https://www.plantuml.com');
    expect(svg).not.toContain('@startuml');
    expect(convertMock).toHaveBeenCalledTimes(1);
    expect(convertMock.mock.calls[0][0]).not.toContain('王子服');
  });

  it('creates a DOM SVG element for actor relationships', async () => {
    const svg = await createPlantUmlSvgElement([
      '@startuml',
      'actor Alice',
      'actor Bob',
      'Alice -> Bob : Hello',
      '@enduml',
    ].join('\n'), 'miaoyan');

    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg).toHaveClass('plantuml-image');
    expect(svg.getAttribute('data-plantuml-renderer')).toBe('plantuml-little');
    expect(svg.textContent).toContain('Alice');
    expect(svg.textContent).toContain('Bob');
    expect(svg.textContent).toContain('Hello');
  });

  it('renders the MiaoYan syntax guide character class diagram with complete labels', async () => {
    const svg = await createPlantUmlSvgElement(MIAOYAN_CHARACTER_PLANTUML, 'miaoyan');
    const width = Number(svg.getAttribute('width'));
    const height = Number(svg.getAttribute('height'));

    expect(svg.textContent).toContain('王子服');
    expect(svg.textContent).toContain('婴宁');
    expect(svg.textContent).toContain('婴宁母亲');
    expect(svg.textContent).toContain('鬼仆');
    expect(svg.textContent).toContain('母女情深');
    expect(svg.textContent).toContain('忠心侍奉');
    expect(width).toBeGreaterThan(400);
    expect(height).toBeGreaterThan(260);
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 360');
    expect(svg.getAttribute('data-plantuml-renderer')).toBe('plantuml-little');
    expect(svg.style.maxWidth).toBe('100%');
    expect(svg.style.height).toBe('auto');
    expect(svg.querySelector('text')?.hasAttribute('textLength')).toBe(false);
  });

  it('injects theme skinparams and removes inline skinparam overrides before encoding', () => {
    const source = preparePlantUmlSource(
      [
        '@startuml',
        'skinparam backgroundColor red',
        'skinparam defaultFontSize 99',
        'skinparam note {',
        '  BackgroundColor blue',
        '}',
        'Alice -> Bob',
        '@enduml',
      ].join('\n'),
      'miaoyan',
    );

    expect(source).toContain('@startuml\nskinparam backgroundColor #f7f7f7');
    expect(source).toContain('skinparam defaultTextColor #262626');
    expect(source).toContain('skinparam defaultFontSize 12');
    expect(source).toContain('skinparam arrowColor #1C5D33');
    expect(source).not.toContain('skinparam classBorderColor');
    expect(source).not.toContain('skinparam classAttributeIconSize');
    expect(source).not.toContain('skinparam roundcorner');
    expect(source).not.toContain('skinparam backgroundColor red');
    expect(source).not.toContain('skinparam defaultFontSize 99');
    expect(source).not.toContain('BackgroundColor blue');
    expect(source).toContain('Alice -> Bob\n@enduml');
  });

  it('uses dark diagram colors for the Nocturne theme', () => {
    const source = preparePlantUmlSource('@startuml\nAlice -> Bob\n@enduml', 'nocturne');

    expect(source).toContain('skinparam backgroundColor #10110E');
    expect(source).toContain('skinparam defaultTextColor #E8DDC8');
    expect(source).toContain('skinparam arrowColor #C45A84');
  });

  it('uses true black diagram colors for the Carbon theme', () => {
    const source = preparePlantUmlSource('@startuml\nAlice -> Bob\n@enduml', 'carbon');

    expect(source).toContain('skinparam backgroundColor #000000');
    expect(source).toContain('skinparam defaultTextColor #EDEDED');
    expect(source).toContain('skinparam arrowColor #A3E635');
  });
});
