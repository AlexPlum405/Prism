import { autocompletion } from '@codemirror/autocomplete';
import { Compartment } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import type { ContentTheme } from '../../settings/types';
import { contentThemeFacet } from '../extensions/markdownHighlight';
import {
  createMarkdownLinkCompletionSource,
  type QueryWorkspaceLinkTargets,
  type WorkspaceLinkFile,
} from '../extensions/linkCompletion';
import { createSlashMenuCompletionSource } from '../extensions/slashMenu';

export const editorLineNumbersCompartment = new Compartment();
export const editorLineWrappingCompartment = new Compartment();
export const editorDarkThemeCompartment = new Compartment();
export const editorContentThemeCompartment = new Compartment();
export const editorTypographyCompartment = new Compartment();
export const editorLinkCompletionCompartment = new Compartment();
export const editorPhrasesCompartment = new Compartment();

const editorDarkThemeExtension = [
  oneDark,
  EditorView.theme(
    {
      '.cm-content': { color: '#E2E8F0' },
      '.cm-gutters': { borderRight: '1px solid var(--stroke-surface)' },
    },
    { dark: true },
  ),
];

const DARK_CONTENT_THEMES = new Set(['nocturne']);
const LIGHT_CONTENT_THEMES = new Set(['miaoyan', 'inkstone', 'slate', 'mono']);

export function shouldUseDarkEditor(contentTheme: string, theme: string) {
  return DARK_CONTENT_THEMES.has(contentTheme)
    ? true
    : LIGHT_CONTENT_THEMES.has(contentTheme)
      ? false
      : theme === 'dark';
}

export function getLineNumberExtensions(showLineNumbers: boolean) {
  return showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [];
}

export function getLineWrappingExtensions(wordWrap: boolean) {
  return wordWrap ? [EditorView.lineWrapping] : [];
}

export function getDarkThemeExtensions(isEditorDark: boolean) {
  return isEditorDark ? editorDarkThemeExtension : [];
}

export function getContentThemeExtension(contentTheme: ContentTheme) {
  return contentThemeFacet.of(contentTheme);
}

export function getEditorTypographyStyle(
  fontSize: number,
  lineHeight: number,
  fontFamily: string,
  useThemeFont = false,
) {
  const lineHeightPx = Math.round(fontSize * lineHeight * 100) / 100;
  const variables: Record<string, string> = {
    '--prism-editor-font-size': `${fontSize}px`,
    '--prism-editor-line-height': `${lineHeightPx}px`,
  };
  if (!useThemeFont) {
    variables['--prism-editor-font-family'] = fontFamily;
  }

  return {
    fontFamily: useThemeFont ? undefined : fontFamily,
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeightPx}px`,
    variables,
  };
}

export function getTypographyExtension(
  fontSize: number,
  lineHeight: number,
  fontFamily: string,
  useThemeFont: boolean,
) {
  const typography = getEditorTypographyStyle(fontSize, lineHeight, fontFamily, useThemeFont);
  const rootStyle: Record<string, string> = {
    ...typography.variables,
    fontSize: typography.fontSize,
  };
  const scrollerStyle: Record<string, string> = {
    lineHeight: typography.lineHeight,
  };
  if (typography.fontFamily) {
    rootStyle.fontFamily = typography.fontFamily;
    scrollerStyle.fontFamily = typography.fontFamily;
  }

  return EditorView.theme({
    '&': rootStyle,
    '.cm-scroller': scrollerStyle,
    '.cm-line': {
      lineHeight: typography.lineHeight,
    },
  });
}

export function getLinkCompletionExtension(input: {
  currentDocumentPath?: string;
  queryWorkspaceLinkTargets?: QueryWorkspaceLinkTargets;
  workspaceFiles: WorkspaceLinkFile[];
  workspaceRootPath?: string | null;
}) {
  return autocompletion({
    activateOnTyping: true,
    override: [
      createSlashMenuCompletionSource(),
      createMarkdownLinkCompletionSource(() => input),
    ],
  });
}
