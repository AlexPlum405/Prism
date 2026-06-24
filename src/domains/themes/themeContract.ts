import { CONTENT_THEMES, type BuiltInContentTheme, type ContentTheme } from '../settings/types';

export interface MermaidThemeContract {
  theme: 'base' | 'neutral';
  fontSize: number;
  fontFamily: string;
  fontLoadFamily: string;
  themeVariables: Record<string, string>;
}

export interface DocxThemeContract {
  font: string;
  codeFont: string;
  text: string;
  muted: string;
  accent: string;
  fill: string;
  border: string;
}

export type ThemePreviewMaxWidth = number | 'none';

export interface ThemeContract {
  id: ContentTheme;
  label: string;
  isDark: boolean;
  editor: {
    background: string;
    text: string;
    secondaryText: string;
    fontFamily: string;
    codeFontFamily: string;
    lineHeight: number;
  };
  preview: {
    background: string;
    text: string;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    maxWidth: ThemePreviewMaxWidth;
    writeClass: string;
  };
  search: {
    background: string;
    text: string;
    secondaryText: string;
    fieldBackground: string;
    fieldBorder: string;
    focus: string;
    shadow: string;
    fontFamily: string;
  };
  export: {
    writeClass: string;
    docx: DocxThemeContract;
  };
  code: {
    background: string;
    inlineBackground: string;
    text: string;
    comment: string;
    keyword: string;
    string: string;
    meta: string;
    attribute: string;
    symbol: string;
  };
  mermaid: MermaidThemeContract;
  selection: {
    background: string;
    text: string;
    matchBackground: string;
    currentMatchBackground: string;
    currentMatchText: string;
  };
}

export const builtInThemeContracts = {
  miaoyan: {
    id: 'miaoyan',
    label: 'MiaoYan',
    isDark: false,
    editor: {
      background: '#ffffff',
      text: '#262626',
      secondaryText: '#777777',
      fontFamily:
        "'TsangerJinKai02-W04', 'TsangerJinKai02 W04', 'TsangerJinKai02', 'PingFangSC-Regular', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      codeFontFamily: "'Menlo', SFMono-Regular, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#ffffff',
      text: '#262626',
      fontFamily:
        "'TsangerJinKai02-W04', 'TsangerJinKai02 W04', 'TsangerJinKai02', 'PingFangSC-Regular', -apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 'none',
      writeClass: 'markdown-body heti',
    },
    search: {
      background: '#eeeeee',
      text: '#262626',
      secondaryText: '#777777',
      fieldBackground: '#ffffff',
      fieldBorder: '#cfcfcf',
      focus: '#1c5d33',
      shadow: '0 9px 22px rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.12)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif",
    },
    export: {
      writeClass: 'markdown-body heti',
      docx: {
        font: 'Kaiti SC',
        codeFont: 'Menlo',
        text: '282828',
        muted: '6F6F6F',
        accent: '1C5D33',
        fill: 'F7F7F7',
        border: 'DDDDDD',
      },
    },
    code: {
      background: '#f7f7f7',
      inlineBackground: '#f7f7f7',
      text: '#24292e',
      comment: '#6a737d',
      keyword: '#d73a49',
      string: '#032f62',
      meta: '#208bff',
      attribute: '#e36209',
      symbol: '#8250df',
    },
    mermaid: {
      theme: 'base',
      fontSize: 15,
      fontFamily:
        "'TsangerJinKai02 W04', 'TsangerJinKai02', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif",
      fontLoadFamily: '"TsangerJinKai02-W04"',
      themeVariables: {
        background: '#f7f7f7',
        textColor: '#262626',
        primaryColor: '#ffffff',
        primaryTextColor: '#1f2933',
        primaryBorderColor: '#d0d7e2',
        secondaryColor: '#f0f3f6',
        secondaryTextColor: '#1f2933',
        secondaryBorderColor: '#d0d7e2',
        tertiaryColor: '#ffffff',
        tertiaryTextColor: '#333333',
        tertiaryBorderColor: '#d0d7e2',
        lineColor: '#1C5D33',
        mainBkg: '#ffffff',
        secondBkg: '#f0f3f6',
        nodeBorder: '#262626',
        nodeBkg: '#ffffff',
        clusterBkg: '#f0f3f6',
        clusterBorder: '#262626',
        edgeLabelBackground: 'transparent',
        edgeLabelTextColor: '#262626',
        actorBkg: '#ffffff',
        actorBorder: '#262626',
        actorTextColor: '#262626',
        signalColor: '#1C5D33',
        signalTextColor: '#262626',
        noteBkgColor: '#f0f3f6',
        noteBorderColor: '#262626',
        noteTextColor: '#262626',
        arrowheadColor: '#1C5D33',
        relationColor: '#1C5D33',
        titleColor: '#1C5D33',
      },
    },
    selection: {
      background: '#d9d9d9',
      text: '#262626',
      matchBackground: 'color-mix(in srgb, #1c5d33 15%, transparent)',
      currentMatchBackground: '#1c5d33',
      currentMatchText: '#ffffff',
    },
  },
  inkstone: {
    id: 'inkstone',
    label: 'Inkstone Light',
    isDark: false,
    editor: {
      background: '#fcfbf7',
      text: '#24231f',
      secondaryText: '#817868',
      fontFamily: "'TsangerJinKai02-W04', 'TsangerJinKai02 W04', 'Kaiti SC', 'STKaiti', 'Songti SC', serif",
      codeFontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#fcfbf7',
      text: '#24231f',
      fontFamily: "'TsangerJinKai02-W04', 'TsangerJinKai02 W04', 'Kaiti SC', 'STKaiti', 'Songti SC', serif",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 1000,
      writeClass: 'markdown-body heti inkstone-write',
    },
    search: {
      background: 'color-mix(in srgb, #fcfbf7 92%, #000)',
      text: '#24231f',
      secondaryText: '#817868',
      fieldBackground: '#fcfbf7',
      fieldBorder: 'color-mix(in srgb, #d7cebd 80%, #000)',
      focus: '#466f57',
      shadow: '0 9px 22px rgba(72, 58, 35, 0.16), 0 1px 3px rgba(72, 58, 35, 0.12)',
      fontFamily: "'TsangerJinKai02-W04', 'TsangerJinKai02 W04', 'Kaiti SC', 'STKaiti', 'Songti SC', serif",
    },
    export: {
      writeClass: 'markdown-body heti inkstone-write',
      docx: {
        font: 'Kaiti SC',
        codeFont: 'Menlo',
        text: '24231F',
        muted: '6B6355',
        accent: '466F57',
        fill: 'F0EADF',
        border: 'D7CEBD',
      },
    },
    code: {
      background: '#f2eee4',
      inlineBackground: '#edf0e8',
      text: '#24231f',
      comment: '#817868',
      keyword: '#8f4638',
      string: '#466f57',
      meta: '#7d5146',
      attribute: '#286c62',
      symbol: '#6b7560',
    },
    mermaid: {
      theme: 'base',
      fontSize: 15,
      fontFamily: "'TsangerJinKai02-W04', 'Kaiti SC', 'STKaiti', 'Songti SC', serif",
      fontLoadFamily: '"TsangerJinKai02-W04"',
      themeVariables: {
        background: '#fcfbf7',
        primaryColor: '#fffdf8',
        primaryTextColor: '#24231f',
        primaryBorderColor: '#466f57',
        secondaryColor: '#f0eadf',
        secondaryTextColor: '#24231f',
        secondaryBorderColor: '#d7cebd',
        tertiaryColor: '#f5f1e7',
        tertiaryTextColor: '#6b6355',
        tertiaryBorderColor: '#d7cebd',
        lineColor: '#466f57',
        textColor: '#24231f',
        mainBkg: '#fffdf8',
        nodeBorder: '#466f57',
        clusterBkg: '#f0eadf',
        clusterBorder: '#d7cebd',
        titleColor: '#8f4638',
        edgeLabelBackground: '#fcfbf7',
      },
    },
    selection: {
      background: '#ded8cb',
      text: '#24231f',
      matchBackground: 'color-mix(in srgb, #466f57 15%, transparent)',
      currentMatchBackground: '#466f57',
      currentMatchText: '#fcfbf7',
    },
  },
  slate: {
    id: 'slate',
    label: 'Slate Manual',
    isDark: false,
    editor: {
      background: '#f7f8f8',
      text: '#222829',
      secondaryText: '#6e7778',
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
      codeFontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#f7f8f8',
      text: '#222829',
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 1000,
      writeClass: 'markdown-body heti slate-write',
    },
    search: {
      background: 'color-mix(in srgb, #f7f8f8 92%, #000)',
      text: '#222829',
      secondaryText: '#6e7778',
      fieldBackground: '#f7f8f8',
      fieldBorder: 'color-mix(in srgb, #cbd4d5 82%, #000)',
      focus: '#587a85',
      shadow: '0 9px 22px rgba(35, 49, 53, 0.15), 0 1px 3px rgba(35, 49, 53, 0.11)',
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    export: {
      writeClass: 'markdown-body heti slate-write',
      docx: {
        font: 'Arial',
        codeFont: 'Menlo',
        text: '222829',
        muted: '4E5A5C',
        accent: '587A85',
        fill: 'E4E9E9',
        border: 'CBD4D5',
      },
    },
    code: {
      background: '#edf1f1',
      inlineBackground: '#e6ecee',
      text: '#222829',
      comment: '#6e7778',
      keyword: '#4f6d7a',
      string: '#2a7080',
      meta: '#587a85',
      attribute: '#2f6170',
      symbol: '#667985',
    },
    mermaid: {
      theme: 'base',
      fontSize: 14,
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
      fontLoadFamily: '"IBM Plex Sans"',
      themeVariables: {
        background: '#f7f8f8',
        primaryColor: '#fbfcfc',
        primaryTextColor: '#222829',
        primaryBorderColor: '#587a85',
        secondaryColor: '#e4e9e9',
        secondaryTextColor: '#222829',
        secondaryBorderColor: '#cbd4d5',
        tertiaryColor: '#edf1f1',
        tertiaryTextColor: '#4e5a5c',
        tertiaryBorderColor: '#cbd4d5',
        lineColor: '#587a85',
        textColor: '#222829',
        mainBkg: '#fbfcfc',
        nodeBorder: '#587a85',
        clusterBkg: '#e4e9e9',
        clusterBorder: '#cbd4d5',
        titleColor: '#4f6d7a',
        edgeLabelBackground: '#f7f8f8',
      },
    },
    selection: {
      background: '#d8dddd',
      text: '#222829',
      matchBackground: 'color-mix(in srgb, #587a85 15%, transparent)',
      currentMatchBackground: '#587a85',
      currentMatchText: '#f7f8f8',
    },
  },
  mono: {
    id: 'mono',
    label: 'Mono Lab',
    isDark: false,
    editor: {
      background: '#fbfbfa',
      text: '#171817',
      secondaryText: '#70746d',
      fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, 'PingFang SC', monospace",
      codeFontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#fbfbfa',
      text: '#171817',
      fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, 'PingFang SC', monospace",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 1000,
      writeClass: 'markdown-body heti mono-write',
    },
    search: {
      background: 'color-mix(in srgb, #fbfbfa 92%, #000)',
      text: '#171817',
      secondaryText: '#70746d',
      fieldBackground: '#fbfbfa',
      fieldBorder: 'color-mix(in srgb, #dcdcd8 82%, #000)',
      focus: '#3b6f48',
      shadow: '0 9px 22px rgba(24, 26, 24, 0.15), 0 1px 3px rgba(24, 26, 24, 0.1)',
      fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, 'PingFang SC', monospace",
    },
    export: {
      writeClass: 'markdown-body heti mono-write',
      docx: {
        font: 'Menlo',
        codeFont: 'Menlo',
        text: '171817',
        muted: '4D564C',
        accent: '3B6F48',
        fill: 'E7EBE4',
        border: 'D4D8D0',
      },
    },
    code: {
      background: '#f0f3ee',
      inlineBackground: '#e9ece7',
      text: '#171817',
      comment: '#70746d',
      keyword: '#6d4c9f',
      string: '#14756c',
      meta: '#3b6f48',
      attribute: '#2f5f45',
      symbol: '#3b6f48',
    },
    mermaid: {
      theme: 'base',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, 'PingFang SC', monospace",
      fontLoadFamily: '"JetBrains Mono"',
      themeVariables: {
        background: '#fbfbfa',
        primaryColor: '#fbfbfa',
        primaryTextColor: '#171817',
        primaryBorderColor: '#3b6f48',
        secondaryColor: '#e7ebe4',
        secondaryTextColor: '#171817',
        secondaryBorderColor: '#d4d8d0',
        tertiaryColor: '#f0f3ee',
        tertiaryTextColor: '#4d564c',
        tertiaryBorderColor: '#d4d8d0',
        lineColor: '#3b6f48',
        textColor: '#171817',
        mainBkg: '#fbfbfa',
        nodeBorder: '#3b6f48',
        clusterBkg: '#e7ebe4',
        clusterBorder: '#d4d8d0',
        titleColor: '#6d4c9f',
        edgeLabelBackground: '#fbfbfa',
      },
    },
    selection: {
      background: '#dcdcd8',
      text: '#171817',
      matchBackground: 'color-mix(in srgb, #3b6f48 15%, transparent)',
      currentMatchBackground: '#3b6f48',
      currentMatchText: '#fbfbfa',
    },
  },
  nocturne: {
    id: 'nocturne',
    label: 'Nocturne Dark',
    isDark: true,
    editor: {
      background: '#171a18',
      text: '#e5e1d7',
      secondaryText: '#9b9486',
      fontFamily: "'Newsreader', 'Source Serif 4', 'Songti SC', 'STSong', 'Iowan Old Style', Georgia, serif",
      codeFontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#171a18',
      text: '#e5e1d7',
      fontFamily: "'Newsreader', 'Source Serif 4', 'Songti SC', 'STSong', 'Iowan Old Style', Georgia, serif",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 920,
      writeClass: 'markdown-body heti nocturne-write',
    },
    search: {
      background: 'color-mix(in srgb, #171a18 82%, #000)',
      text: '#e5e1d7',
      secondaryText: '#9b9486',
      fieldBackground: 'color-mix(in srgb, #171a18 88%, #fff)',
      fieldBorder: 'color-mix(in srgb, #33382f 76%, #fff)',
      focus: '#86a878',
      shadow: '0 12px 28px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.38)',
      fontFamily: "'Newsreader', 'Source Serif 4', 'Songti SC', 'STSong', 'Iowan Old Style', Georgia, serif",
    },
    export: {
      writeClass: 'markdown-body heti nocturne-write',
      docx: {
        font: 'Georgia',
        codeFont: 'Menlo',
        text: '2B2A27',
        muted: '5E574C',
        accent: '6F7F62',
        fill: 'EEE9DE',
        border: 'D7CBB8',
      },
    },
    code: {
      background: '#20241f',
      inlineBackground: '#252a24',
      text: '#e5e1d7',
      comment: '#9b9486',
      keyword: '#d1ad82',
      string: '#86a878',
      meta: '#a8b996',
      attribute: '#8cc7b0',
      symbol: '#9fb39a',
    },
    mermaid: {
      theme: 'base',
      fontSize: 15,
      fontFamily: "'Newsreader', 'Source Serif 4', 'Songti SC', 'STSong', 'Iowan Old Style', Georgia, serif",
      fontLoadFamily: '"Newsreader"',
      themeVariables: {
        background: '#171a18',
        primaryColor: '#171a18',
        primaryTextColor: '#e5e1d7',
        primaryBorderColor: '#86a878',
        secondaryColor: '#262b25',
        secondaryTextColor: '#e5e1d7',
        secondaryBorderColor: '#394035',
        tertiaryColor: '#20241f',
        tertiaryTextColor: '#cfc6b5',
        tertiaryBorderColor: '#394035',
        lineColor: '#86a878',
        textColor: '#e5e1d7',
        mainBkg: '#171a18',
        nodeBorder: '#86a878',
        clusterBkg: '#262b25',
        clusterBorder: '#394035',
        titleColor: '#d1ad82',
        edgeLabelBackground: '#20241f',
      },
    },
    selection: {
      background: '#394035',
      text: '#e5e1d7',
      matchBackground: 'color-mix(in srgb, #86a878 22%, transparent)',
      currentMatchBackground: '#86a878',
      currentMatchText: '#171a18',
    },
  },
} satisfies Record<BuiltInContentTheme, ThemeContract>;

export const themeContracts = builtInThemeContracts;

export function getThemeContract(theme: ContentTheme): ThemeContract {
  return builtInThemeContracts[theme as BuiltInContentTheme] ?? builtInThemeContracts.miaoyan;
}

export function mapThemeContracts<T>(selector: (contract: ThemeContract) => T): Record<BuiltInContentTheme, T> {
  return Object.fromEntries(
    CONTENT_THEMES.map((theme) => [theme, selector(builtInThemeContracts[theme])]),
  ) as Record<BuiltInContentTheme, T>;
}

export function getMermaidThemeConfig(theme: ContentTheme) {
  const contract = getThemeContract(theme).mermaid;
  return {
    theme: contract.theme,
    securityLevel: 'loose' as const,
    fontSize: contract.fontSize,
    fontFamily: contract.fontFamily,
    themeVariables: contract.themeVariables,
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      nodeSpacing: 80,
      rankSpacing: 80,
      padding: 30,
      curve: 'basis' as const,
    },
    elk: {
      nodeSpacing: 80,
      rankSpacing: 80,
      padding: 40,
      mergeEdges: true,
    },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true },
    journey: { useMaxWidth: true },
  };
}
