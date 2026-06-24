import { deflateSync, strToU8 } from 'fflate';
import type { ContentTheme } from '../../settings/types';

export const PLANT_UML_SVG_ENDPOINT = 'https://www.plantuml.com/plantuml/svg/';
export const PLANT_UML_RENDER_CACHE_BUSTER = 'prism=plantuml-v2';

const PLANT_UML_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

function encode6Bit(value: number) {
  return PLANT_UML_ALPHABET[value & 0x3F] ?? '?';
}

function append3Bytes(output: string[], byte1: number, byte2: number, byte3: number) {
  output.push(encode6Bit(byte1 >> 2));
  output.push(encode6Bit(((byte1 & 0x3) << 4) | (byte2 >> 4)));
  output.push(encode6Bit(((byte2 & 0xF) << 2) | (byte3 >> 6)));
  output.push(encode6Bit(byte3 & 0x3F));
}

export function encodePlantUmlSource(source: string) {
  const compressed = deflateSync(strToU8(source), { level: 9 });
  const output: string[] = [];

  for (let index = 0; index < compressed.length; index += 3) {
    append3Bytes(output, compressed[index], compressed[index + 1] ?? 0, compressed[index + 2] ?? 0);
  }

  return output.join('');
}

function isDarkPlantUmlTheme(contentTheme: ContentTheme) {
  return contentTheme === 'nocturne' || contentTheme === 'carbon';
}

function getPlantUmlThemeColors(contentTheme: ContentTheme) {
  if (contentTheme === 'carbon') {
    return {
      background: '#000000',
      lineColor: '#FFB86C',
      primaryColor: '#111111',
      textColor: '#F2F2F2',
    };
  }

  if (isDarkPlantUmlTheme(contentTheme)) {
    return {
      background: '#282e33',
      lineColor: '#54C59F',
      primaryColor: '#2f353d',
      textColor: '#E7E9EA',
    };
  }

  return {
    background: '#f7f7f7',
    lineColor: '#1C5D33',
    primaryColor: '#FFFFFF',
    textColor: '#262626',
  };
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
  ArrowColor ${colors.lineColor}
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

export function preparePlantUmlSource(source: string, contentTheme: ContentTheme) {
  const withoutInlineSkinparams = stripPlantUmlSkinparams(source);
  return `${getPlantUmlSkinparams(contentTheme)}\n${withoutInlineSkinparams}`;
}

export function getPlantUmlSvgUrl(source: string, contentTheme: ContentTheme) {
  return `${PLANT_UML_SVG_ENDPOINT}${encodePlantUmlSource(preparePlantUmlSource(source, contentTheme))}?${PLANT_UML_RENDER_CACHE_BUSTER}`;
}
