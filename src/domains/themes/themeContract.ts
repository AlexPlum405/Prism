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
      background: '#fbf7ef',
      text: '#2b261d',
      secondaryText: '#7a6e5b',
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
      codeFontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#fbf7ef',
      text: '#2b261d',
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 1000,
      writeClass: 'markdown-body heti inkstone-write',
    },
    search: {
      background: 'color-mix(in srgb, #fbf7ef 92%, #000)',
      text: '#2b261d',
      secondaryText: '#7a6e5b',
      fieldBackground: '#fbf7ef',
      fieldBorder: 'color-mix(in srgb, #d8c7a6 80%, #000)',
      focus: '#9a3412',
      shadow: '0 9px 22px rgba(72, 58, 35, 0.16), 0 1px 3px rgba(72, 58, 35, 0.12)',
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
    },
    export: {
      writeClass: 'markdown-body heti inkstone-write',
      docx: {
        font: 'Kaiti SC',
        codeFont: 'Menlo',
        text: '2B261D',
        muted: '6F5E46',
        accent: '9A3412',
        fill: 'F1E6D2',
        border: 'D8C7A6',
      },
    },
    code: {
      background: '#f1e6d2',
      inlineBackground: '#eef2e6',
      text: '#2b261d',
      comment: '#7a6e5b',
      keyword: '#9a3412',
      string: '#214e9a',
      meta: '#8f2f18',
      attribute: '#2f6f4e',
      symbol: '#8f2f18',
    },
    mermaid: {
      theme: 'base',
      fontSize: 15,
      fontFamily: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
      fontLoadFamily: '"Songti SC"',
      themeVariables: {
        background: '#fbf7ef',
        primaryColor: '#fffaf0',
        primaryTextColor: '#2b261d',
        primaryBorderColor: '#9a3412',
        secondaryColor: '#efe2c3',
        secondaryTextColor: '#2b261d',
        secondaryBorderColor: '#d8c7a6',
        tertiaryColor: '#f6edd8',
        tertiaryTextColor: '#6f5e46',
        tertiaryBorderColor: '#d8c7a6',
        lineColor: '#9a3412',
        textColor: '#2b261d',
        mainBkg: '#fffaf0',
        secondBkg: '#efe2c3',
        nodeBorder: '#9a3412',
        nodeBkg: '#fffaf0',
        clusterBkg: '#efe2c3',
        clusterBorder: '#d8c7a6',
        titleColor: '#8f2f18',
        edgeLabelBackground: '#fbf7ef',
        edgeLabelTextColor: '#2b261d',
        actorBkg: '#fffaf0',
        actorBorder: '#9a3412',
        actorTextColor: '#2b261d',
        signalColor: '#9a3412',
        signalTextColor: '#2b261d',
        noteBkgColor: '#efe2c3',
        noteBorderColor: '#d8c7a6',
        noteTextColor: '#2b261d',
        arrowheadColor: '#9a3412',
        relationColor: '#9a3412',
      },
    },
    selection: {
      background: '#e1d4bd',
      text: '#2b261d',
      matchBackground: 'color-mix(in srgb, #9a3412 15%, transparent)',
      currentMatchBackground: '#9a3412',
      currentMatchText: '#fbf7ef',
    },
  },
  slate: {
    id: 'slate',
    label: 'Slate Manual',
    isDark: false,
    editor: {
      background: '#f5f8fa',
      text: '#1f2933',
      secondaryText: '#667680',
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
      codeFontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#f5f8fa',
      text: '#1f2933',
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 1000,
      writeClass: 'markdown-body heti slate-write',
    },
    search: {
      background: 'color-mix(in srgb, #f5f8fa 92%, #000)',
      text: '#1f2933',
      secondaryText: '#667680',
      fieldBackground: '#f5f8fa',
      fieldBorder: 'color-mix(in srgb, #c7d5da 82%, #000)',
      focus: '#b45309',
      shadow: '0 9px 22px rgba(35, 49, 53, 0.15), 0 1px 3px rgba(35, 49, 53, 0.11)',
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    export: {
      writeClass: 'markdown-body heti slate-write',
      docx: {
        font: 'Arial',
        codeFont: 'Menlo',
        text: '1F2933',
        muted: '4C5F68',
        accent: '246A73',
        fill: 'E4ECEF',
        border: 'C7D5DA',
      },
    },
    code: {
      background: '#eaf1f3',
      inlineBackground: '#e2ecef',
      text: '#1f2933',
      comment: '#667680',
      keyword: '#246a73',
      string: '#2356b8',
      meta: '#b45309',
      attribute: '#b45309',
      symbol: '#7a4e0b',
    },
    mermaid: {
      theme: 'base',
      fontSize: 14,
      fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', -apple-system, BlinkMacSystemFont, sans-serif",
      fontLoadFamily: '"IBM Plex Sans"',
      themeVariables: {
        background: '#f5f8fa',
        primaryColor: '#fbfdfe',
        primaryTextColor: '#1f2933',
        primaryBorderColor: '#b45309',
        secondaryColor: '#e4ecef',
        secondaryTextColor: '#1f2933',
        secondaryBorderColor: '#c7d5da',
        tertiaryColor: '#eaf1f3',
        tertiaryTextColor: '#4c5f68',
        tertiaryBorderColor: '#c7d5da',
        lineColor: '#b45309',
        textColor: '#1f2933',
        mainBkg: '#fbfdfe',
        secondBkg: '#e4ecef',
        nodeBorder: '#b45309',
        nodeBkg: '#fbfdfe',
        clusterBkg: '#e4ecef',
        clusterBorder: '#c7d5da',
        titleColor: '#246a73',
        edgeLabelBackground: '#f5f8fa',
        edgeLabelTextColor: '#1f2933',
        actorBkg: '#fbfdfe',
        actorBorder: '#b45309',
        actorTextColor: '#1f2933',
        signalColor: '#b45309',
        signalTextColor: '#1f2933',
        noteBkgColor: '#e4ecef',
        noteBorderColor: '#c7d5da',
        noteTextColor: '#1f2933',
        arrowheadColor: '#b45309',
        relationColor: '#b45309',
      },
    },
    selection: {
      background: '#d8e2e6',
      text: '#1f2933',
      matchBackground: 'color-mix(in srgb, #b45309 15%, transparent)',
      currentMatchBackground: '#b45309',
      currentMatchText: '#f5f8fa',
    },
  },
  mono: {
    id: 'mono',
    label: 'Mono Lab',
    isDark: false,
    editor: {
      background: '#fafaf7',
      text: '#101310',
      secondaryText: '#626961',
      fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, 'PingFang SC', monospace",
      codeFontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#fafaf7',
      text: '#101310',
      fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, 'PingFang SC', monospace",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 1000,
      writeClass: 'markdown-body heti mono-write',
    },
    search: {
      background: 'color-mix(in srgb, #fafaf7 92%, #000)',
      text: '#101310',
      secondaryText: '#626961',
      fieldBackground: '#fafaf7',
      fieldBorder: 'color-mix(in srgb, #deded6 82%, #000)',
      focus: '#b91c1c',
      shadow: '0 9px 22px rgba(24, 26, 24, 0.15), 0 1px 3px rgba(24, 26, 24, 0.1)',
      fontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, 'PingFang SC', monospace",
    },
    export: {
      writeClass: 'markdown-body heti mono-write',
      docx: {
        font: 'Menlo',
        codeFont: 'Menlo',
        text: '101310',
        muted: '4D564C',
        accent: '6D28D9',
        fill: 'E9EEE3',
        border: 'D7DBD0',
      },
    },
    code: {
      background: '#eef2eb',
      inlineBackground: '#e9ede6',
      text: '#101310',
      comment: '#626961',
      keyword: '#6d28d9',
      string: '#047857',
      meta: '#b91c1c',
      attribute: '#0f766e',
      symbol: '#9a3412',
    },
    mermaid: {
      theme: 'base',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, 'PingFang SC', monospace",
      fontLoadFamily: '"JetBrains Mono"',
      themeVariables: {
        background: '#fafaf7',
        primaryColor: '#fafaf7',
        primaryTextColor: '#101310',
        primaryBorderColor: '#b91c1c',
        secondaryColor: '#e9eee3',
        secondaryTextColor: '#101310',
        secondaryBorderColor: '#d7dbd0',
        tertiaryColor: '#eef2eb',
        tertiaryTextColor: '#4d564c',
        tertiaryBorderColor: '#d7dbd0',
        lineColor: '#b91c1c',
        textColor: '#101310',
        mainBkg: '#fafaf7',
        secondBkg: '#e9eee3',
        nodeBorder: '#b91c1c',
        nodeBkg: '#fafaf7',
        clusterBkg: '#e9eee3',
        clusterBorder: '#d7dbd0',
        titleColor: '#6d28d9',
        edgeLabelBackground: '#fafaf7',
        edgeLabelTextColor: '#101310',
        actorBkg: '#fafaf7',
        actorBorder: '#b91c1c',
        actorTextColor: '#101310',
        signalColor: '#b91c1c',
        signalTextColor: '#101310',
        noteBkgColor: '#e9eee3',
        noteBorderColor: '#d7dbd0',
        noteTextColor: '#101310',
        arrowheadColor: '#b91c1c',
        relationColor: '#b91c1c',
      },
    },
    selection: {
      background: '#deded6',
      text: '#101310',
      matchBackground: 'color-mix(in srgb, #b91c1c 15%, transparent)',
      currentMatchBackground: '#b91c1c',
      currentMatchText: '#fafaf7',
    },
  },
  nocturne: {
    id: 'nocturne',
    label: 'Nocturne Dark',
    isDark: true,
    editor: {
      background: '#10110e',
      text: '#e8ddc8',
      secondaryText: '#a89d8a',
      fontFamily: "'Newsreader', 'Source Serif 4', 'Songti SC', 'STSong', 'Iowan Old Style', Georgia, serif",
      codeFontFamily: "SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace",
      lineHeight: 1.74,
    },
    preview: {
      background: '#10110e',
      text: '#e8ddc8',
      fontFamily: "'Newsreader', 'Source Serif 4', 'Songti SC', 'STSong', 'Iowan Old Style', Georgia, serif",
      fontSize: 16,
      lineHeight: 1.74,
      maxWidth: 920,
      writeClass: 'markdown-body heti nocturne-write',
    },
    search: {
      background: 'color-mix(in srgb, #10110e 82%, #000)',
      text: '#e8ddc8',
      secondaryText: '#a89d8a',
      fieldBackground: 'color-mix(in srgb, #10110e 88%, #fff)',
      fieldBorder: 'color-mix(in srgb, #332f27 76%, #fff)',
      focus: '#c45a84',
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
        accent: 'D6A84F',
        fill: 'EEE9DE',
        border: 'D7CBB8',
      },
    },
    code: {
      background: '#1a1a15',
      inlineBackground: '#22221b',
      text: '#e8ddc8',
      comment: '#a89d8a',
      keyword: '#d6a84f',
      string: '#6cb6d9',
      meta: '#c45a84',
      attribute: '#d16a93',
      symbol: '#8fbf73',
    },
    mermaid: {
      theme: 'base',
      fontSize: 15,
      fontFamily: "'Newsreader', 'Source Serif 4', 'Songti SC', 'STSong', 'Iowan Old Style', Georgia, serif",
      fontLoadFamily: '"Newsreader"',
      themeVariables: {
        background: '#10110e',
        primaryColor: '#10110e',
        primaryTextColor: '#e8ddc8',
        primaryBorderColor: '#c45a84',
        secondaryColor: '#23231c',
        secondaryTextColor: '#e8ddc8',
        secondaryBorderColor: '#3b362c',
        tertiaryColor: '#1a1a15',
        tertiaryTextColor: '#d5c5a8',
        tertiaryBorderColor: '#3b362c',
        lineColor: '#c45a84',
        textColor: '#e8ddc8',
        mainBkg: '#10110e',
        secondBkg: '#23231c',
        nodeBorder: '#c45a84',
        nodeBkg: '#1a1a15',
        clusterBkg: '#23231c',
        clusterBorder: '#3b362c',
        titleColor: '#d6a84f',
        edgeLabelBackground: '#1a1a15',
        edgeLabelTextColor: '#e8ddc8',
        actorBkg: '#1a1a15',
        actorBorder: '#c45a84',
        actorTextColor: '#e8ddc8',
        signalColor: '#c45a84',
        signalTextColor: '#e8ddc8',
        noteBkgColor: '#23231c',
        noteBorderColor: '#3b362c',
        noteTextColor: '#e8ddc8',
        arrowheadColor: '#c45a84',
        relationColor: '#c45a84',
      },
    },
    selection: {
      background: '#3b362c',
      text: '#e8ddc8',
      matchBackground: 'color-mix(in srgb, #c45a84 22%, transparent)',
      currentMatchBackground: '#c45a84',
      currentMatchText: '#10110e',
    },
  },
  carbon: {
    id: 'carbon',
    label: 'Carbon Black',
    isDark: true,
    editor: {
      background: '#000000',
      text: '#ededed',
      secondaryText: '#9b9b9b',
      fontFamily: "'Inter', 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      codeFontFamily: "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace",
      lineHeight: 1.72,
    },
    preview: {
      background: '#000000',
      text: '#ededed',
      fontFamily: "'Inter', 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      fontSize: 16,
      lineHeight: 1.72,
      maxWidth: 960,
      writeClass: 'markdown-body heti carbon-write',
    },
    search: {
      background: '#050505',
      text: '#ededed',
      secondaryText: '#9b9b9b',
      fieldBackground: '#080808',
      fieldBorder: '#262626',
      focus: '#a3e635',
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
        accent: 'A3E635',
        fill: 'F2F2F2',
        border: 'D7D7D7',
      },
    },
    code: {
      background: '#080808',
      inlineBackground: '#0f0f0f',
      text: '#ededed',
      comment: '#777777',
      keyword: '#6cb6d9',
      string: '#a78bfa',
      meta: '#a78bfa',
      attribute: '#d16a93',
      symbol: '#a3e635',
    },
    mermaid: {
      theme: 'base',
      fontSize: 14,
      fontFamily: "'Inter', 'SF Pro Text', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
      fontLoadFamily: '"Inter"',
      themeVariables: {
        background: '#000000',
        primaryColor: '#0f0f0f',
        primaryTextColor: '#ededed',
        primaryBorderColor: '#a3e635',
        secondaryColor: '#080808',
        secondaryTextColor: '#ededed',
        secondaryBorderColor: '#2a2a2a',
        tertiaryColor: '#121212',
        tertiaryTextColor: '#d8dee9',
        tertiaryBorderColor: '#2a2a2a',
        lineColor: '#a3e635',
        textColor: '#ededed',
        mainBkg: '#0f0f0f',
        secondBkg: '#080808',
        nodeBorder: '#a3e635',
        nodeBkg: '#0f0f0f',
        clusterBkg: '#080808',
        clusterBorder: '#2a2a2a',
        titleColor: '#6cb6d9',
        edgeLabelBackground: '#000000',
        edgeLabelTextColor: '#ededed',
        actorBkg: '#0f0f0f',
        actorBorder: '#a3e635',
        actorTextColor: '#ededed',
        signalColor: '#a3e635',
        signalTextColor: '#ededed',
        noteBkgColor: '#080808',
        noteBorderColor: '#2a2a2a',
        noteTextColor: '#ededed',
        arrowheadColor: '#a3e635',
        relationColor: '#a3e635',
      },
    },
    selection: {
      background: '#25183f',
      text: '#ededed',
      matchBackground: 'color-mix(in srgb, #a3e635 24%, transparent)',
      currentMatchBackground: '#a3e635',
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
