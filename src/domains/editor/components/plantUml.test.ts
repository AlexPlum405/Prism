import { describe, expect, it } from 'vitest';
import {
  getPlantUmlSvgUrl,
  PLANT_UML_RENDER_CACHE_BUSTER,
  PLANT_UML_SVG_ENDPOINT,
  preparePlantUmlSource,
} from './plantUml';

describe('PlantUML rendering helpers', () => {
  it('builds a standard PlantUML SVG URL that the public server can decode', () => {
    const url = getPlantUmlSvgUrl('@startuml\nAlice -> Bob\n@enduml', 'miaoyan');

    expect(url).toMatch(new RegExp(`^${PLANT_UML_SVG_ENDPOINT}[0-9A-Za-z_-]+\\?${PLANT_UML_RENDER_CACHE_BUSTER}$`));
    expect(url).not.toContain('/svg/~1');
    expect(url).not.toContain('@startuml');
    expect(url.length).toBeGreaterThan(PLANT_UML_SVG_ENDPOINT.length);
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

    expect(source).toContain('skinparam backgroundColor #f7f7f7');
    expect(source).toContain('skinparam defaultTextColor #262626');
    expect(source).toContain('skinparam defaultFontSize 12');
    expect(source).toContain('skinparam arrowColor #1C5D33');
    expect(source).not.toContain('skinparam classBorderColor');
    expect(source).not.toContain('skinparam classAttributeIconSize');
    expect(source).not.toContain('skinparam roundcorner');
    expect(source).not.toContain('skinparam backgroundColor red');
    expect(source).not.toContain('skinparam defaultFontSize 99');
    expect(source).not.toContain('BackgroundColor blue');
    expect(source).toContain('@startuml\nAlice -> Bob\n@enduml');
  });

  it('uses dark diagram colors for the Nocturne theme', () => {
    const source = preparePlantUmlSource('@startuml\nAlice -> Bob\n@enduml', 'nocturne');

    expect(source).toContain('skinparam backgroundColor #282e33');
    expect(source).toContain('skinparam defaultTextColor #E7E9EA');
    expect(source).toContain('skinparam arrowColor #54C59F');
  });
});
