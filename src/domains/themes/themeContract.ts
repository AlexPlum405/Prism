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
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
      codeFontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#fcfbf7',
      text: '#24231f',
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
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
      focus: '#b75a2a',
      shadow: '0 9px 22px rgba(72, 58, 35, 0.16), 0 1px 3px rgba(72, 58, 35, 0.12)',
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
    },
    export: {
      writeClass: 'markdown-body heti inkstone-write',
      docx: {
        font: 'Kaiti SC',
        codeFont: 'Menlo',
        text: '24231F',
        muted: '6B6355',
        accent: 'B75A2A',
        fill: 'F0EADF',
        border: 'D7CEBD',
      },
    },
    code: {
      background: '#f2eee4',
      inlineBackground: '#edf0e8',
      text: '#24231f',
      comment: '#817868',
      keyword: '#b75a2a',
      string: '#2458a6',
      meta: '#7a3e1d',
      attribute: '#1f7a63',
      symbol: '#7a3e1d',
    },
    mermaid: {
      theme: 'base',
      fontSize: 15,
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
      fontLoadFamily: '"Songti SC"',
      themeVariables: {
        background: '#fcfbf7',
        primaryColor: '#fffdf8',
        primaryTextColor: '#24231f',
        primaryBorderColor: '#b75a2a',
        secondaryColor: '#f0eadf',
        secondaryTextColor: '#24231f',
        secondaryBorderColor: '#d7cebd',
        tertiaryColor: '#f5f1e7',
        tertiaryTextColor: '#6b6355',
        tertiaryBorderColor: '#d7cebd',
        lineColor: '#b75a2a',
        textColor: '#24231f',
        mainBkg: '#fffdf8',
        secondBkg: '#f0eadf',
        nodeBorder: '#b75a2a',
        nodeBkg: '#fffdf8',
        clusterBkg: '#f0eadf',
        clusterBorder: '#d7cebd',
        titleColor: '#7a3e1d',
        edgeLabelBackground: '#fcfbf7',
        edgeLabelTextColor: '#24231f',
        actorBkg: '#fffdf8',
        actorBorder: '#b75a2a',
        actorTextColor: '#24231f',
        signalColor: '#b75a2a',
        signalTextColor: '#24231f',
        noteBkgColor: '#f0eadf',
        noteBorderColor: '#d7cebd',
        noteTextColor: '#24231f',
        arrowheadColor: '#b75a2a',
        relationColor: '#b75a2a',
      },
    },
    selection: {
      background: '#ded8cb',
      text: '#24231f',
      matchBackground: 'color-mix(in srgb, #b75a2a 15%, transparent)',
      currentMatchBackground: '#b75a2a',
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
      focus: '#d97706',
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
        accent: 'D97706',
        fill: 'E4E9E9',
        border: 'CBD4D5',
      },
    },
    code: {
      background: '#edf1f1',
      inlineBackground: '#e6ecee',
      text: '#222829',
      comment: '#6e7778',
      keyword: '#315f9d',
      string: '#0b7a99',
      meta: '#d97706',
      attribute: '#9a3412',
      symbol: '#7c3aed',
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
        primaryBorderColor: '#d97706',
        secondaryColor: '#e4e9e9',
        secondaryTextColor: '#222829',
        secondaryBorderColor: '#cbd4d5',
        tertiaryColor: '#edf1f1',
        tertiaryTextColor: '#4e5a5c',
        tertiaryBorderColor: '#cbd4d5',
        lineColor: '#d97706',
        textColor: '#222829',
        mainBkg: '#fbfcfc',
        secondBkg: '#e4e9e9',
        nodeBorder: '#d97706',
        nodeBkg: '#fbfcfc',
        clusterBkg: '#e4e9e9',
        clusterBorder: '#cbd4d5',
        titleColor: '#315f9d',
        edgeLabelBackground: '#f7f8f8',
        edgeLabelTextColor: '#222829',
        actorBkg: '#fbfcfc',
        actorBorder: '#d97706',
        actorTextColor: '#222829',
        signalColor: '#d97706',
        signalTextColor: '#222829',
        noteBkgColor: '#e4e9e9',
        noteBorderColor: '#cbd4d5',
        noteTextColor: '#222829',
        arrowheadColor: '#d97706',
        relationColor: '#d97706',
      },
    },
    selection: {
      background: '#d8dddd',
      text: '#222829',
      matchBackground: 'color-mix(in srgb, #d97706 15%, transparent)',
      currentMatchBackground: '#d97706',
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
      focus: '#be123c',
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
        accent: 'BE123C',
        fill: 'E7EBE4',
        border: 'D4D8D0',
      },
    },
    code: {
      background: '#f0f3ee',
      inlineBackground: '#e9ece7',
      text: '#171817',
      comment: '#70746d',
      keyword: '#5b21b6',
      string: '#047857',
      meta: '#be123c',
      attribute: '#0f766e',
      symbol: '#7c2d12',
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
        primaryBorderColor: '#be123c',
        secondaryColor: '#e7ebe4',
        secondaryTextColor: '#171817',
        secondaryBorderColor: '#d4d8d0',
        tertiaryColor: '#f0f3ee',
        tertiaryTextColor: '#4d564c',
        tertiaryBorderColor: '#d4d8d0',
        lineColor: '#be123c',
        textColor: '#171817',
        mainBkg: '#fbfbfa',
        secondBkg: '#e7ebe4',
        nodeBorder: '#be123c',
        nodeBkg: '#fbfbfa',
        clusterBkg: '#e7ebe4',
        clusterBorder: '#d4d8d0',
        titleColor: '#5b21b6',
        edgeLabelBackground: '#fbfbfa',
        edgeLabelTextColor: '#171817',
        actorBkg: '#fbfbfa',
        actorBorder: '#be123c',
        actorTextColor: '#171817',
        signalColor: '#be123c',
        signalTextColor: '#171817',
        noteBkgColor: '#e7ebe4',
        noteBorderColor: '#d4d8d0',
        noteTextColor: '#171817',
        arrowheadColor: '#be123c',
        relationColor: '#be123c',
      },
    },
    selection: {
      background: '#dcdcd8',
      text: '#171817',
      matchBackground: 'color-mix(in srgb, #be123c 15%, transparent)',
      currentMatchBackground: '#be123c',
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
      focus: '#c084fc',
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
        accent: 'C084FC',
        fill: 'EEE9DE',
        border: 'D7CBB8',
      },
    },
    code: {
      background: '#20241f',
      inlineBackground: '#252a24',
      text: '#e5e1d7',
      comment: '#9b9486',
      keyword: '#f0c674',
      string: '#7dd3fc',
      meta: '#c084fc',
      attribute: '#f472b6',
      symbol: '#86efac',
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
        primaryBorderColor: '#c084fc',
        secondaryColor: '#262b25',
        secondaryTextColor: '#e5e1d7',
        secondaryBorderColor: '#394035',
        tertiaryColor: '#20241f',
        tertiaryTextColor: '#cfc6b5',
        tertiaryBorderColor: '#394035',
        lineColor: '#c084fc',
        textColor: '#e5e1d7',
        mainBkg: '#171a18',
        secondBkg: '#262b25',
        nodeBorder: '#c084fc',
        nodeBkg: '#20241f',
        clusterBkg: '#262b25',
        clusterBorder: '#394035',
        titleColor: '#f0c674',
        edgeLabelBackground: '#20241f',
        edgeLabelTextColor: '#e5e1d7',
        actorBkg: '#20241f',
        actorBorder: '#c084fc',
        actorTextColor: '#e5e1d7',
        signalColor: '#c084fc',
        signalTextColor: '#e5e1d7',
        noteBkgColor: '#262b25',
        noteBorderColor: '#394035',
        noteTextColor: '#e5e1d7',
        arrowheadColor: '#c084fc',
        relationColor: '#c084fc',
      },
    },
    selection: {
      background: '#394035',
      text: '#e5e1d7',
      matchBackground: 'color-mix(in srgb, #c084fc 22%, transparent)',
      currentMatchBackground: '#c084fc',
      currentMatchText: '#171a18',
    },
  },
  carbon: {
    id: 'carbon',
    label: 'Carbon Black',
    isDark: true,
    editor: {
      background: '#000000',
      text: '#f2f2f2',
      secondaryText: '#9ca3af',
      fontFamily: "'Inter', 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      codeFontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace",
      lineHeight: 1.72,
    },
    preview: {
      background: '#000000',
      text: '#f2f2f2',
      fontFamily: "'Inter', 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      fontSize: 16,
      lineHeight: 1.72,
      maxWidth: 960,
      writeClass: 'markdown-body heti carbon-write',
    },
    search: {
      background: '#050505',
      text: '#f2f2f2',
      secondaryText: '#9ca3af',
      fieldBackground: '#090909',
      fieldBorder: '#262626',
      focus: '#bd93f9',
      shadow: '0 16px 34px rgba(0, 0, 0, 0.72), 0 1px 3px rgba(0, 0, 0, 0.5)',
      fontFamily: "'Inter', 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    },
    export: {
      writeClass: 'markdown-body heti carbon-write',
      docx: {
        font: 'Arial',
        codeFont: 'Menlo',
        text: '242424',
        muted: '666666',
        accent: '7A4DCC',
        fill: 'F2F2F2',
        border: 'D7D7D7',
      },
    },
    code: {
      background: '#0b0b0b',
      inlineBackground: '#111111',
      text: '#f2f2f2',
      comment: '#7c8491',
      keyword: '#ffb86c',
      string: '#8be9fd',
      meta: '#bd93f9',
      attribute: '#ff79c6',
      symbol: '#50fa7b',
    },
    mermaid: {
      theme: 'base',
      fontSize: 14,
      fontFamily: "'Inter', 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      fontLoadFamily: '"Inter"',
      themeVariables: {
        background: '#000000',
        primaryColor: '#111111',
        primaryTextColor: '#f2f2f2',
        primaryBorderColor: '#bd93f9',
        secondaryColor: '#0b0b0b',
        secondaryTextColor: '#f2f2f2',
        secondaryBorderColor: '#2f2f2f',
        tertiaryColor: '#151515',
        tertiaryTextColor: '#d8dee9',
        tertiaryBorderColor: '#2f2f2f',
        lineColor: '#ffb86c',
        textColor: '#f2f2f2',
        mainBkg: '#111111',
        secondBkg: '#0b0b0b',
        nodeBorder: '#bd93f9',
        nodeBkg: '#111111',
        clusterBkg: '#0b0b0b',
        clusterBorder: '#2f2f2f',
        titleColor: '#ffb86c',
        edgeLabelBackground: '#000000',
        edgeLabelTextColor: '#f2f2f2',
        actorBkg: '#111111',
        actorBorder: '#bd93f9',
        actorTextColor: '#f2f2f2',
        signalColor: '#ffb86c',
        signalTextColor: '#f2f2f2',
        noteBkgColor: '#0b0b0b',
        noteBorderColor: '#2f2f2f',
        noteTextColor: '#f2f2f2',
        arrowheadColor: '#ffb86c',
        relationColor: '#ffb86c',
      },
    },
    selection: {
      background: '#2f2146',
      text: '#f2f2f2',
      matchBackground: 'color-mix(in srgb, #bd93f9 24%, transparent)',
      currentMatchBackground: '#bd93f9',
      currentMatchText: '#000000',
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
