import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import type { LanguageFn } from 'highlight.js';

export const PRISM_HIGHLIGHT_LANGUAGES = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  dockerfile,
  ini,
  java,
  javascript,
  json,
  markdown,
  php,
  python,
  ruby,
  rust,
  shell,
  sql,
  swift,
  typescript,
  xml,
  yaml,
} satisfies Record<string, LanguageFn>;

export const PRISM_HIGHLIGHT_ALIASES: Record<string, string | string[]> = {
  bash: ['sh', 'zsh'],
  cpp: ['cc', 'cxx', 'c++', 'hpp'],
  csharp: ['cs'],
  dockerfile: ['docker'],
  javascript: ['js', 'jsx', 'mjs', 'cjs'],
  markdown: ['md', 'mkd', 'mdown'],
  php: ['php3', 'php4', 'php5'],
  python: ['py'],
  shell: ['console', 'shell-session'],
  typescript: ['ts', 'tsx'],
  xml: ['html', 'xhtml', 'svg'],
  yaml: ['yml'],
};

export const PRISM_HIGHLIGHT_AUTO_SUBSET = [
  'typescript',
  'javascript',
  'json',
  'css',
  'xml',
  'markdown',
  'bash',
  'python',
  'rust',
  'swift',
  'sql',
  'yaml',
];

for (const [language, definition] of Object.entries(PRISM_HIGHLIGHT_LANGUAGES)) {
  hljs.registerLanguage(language, definition);
}

for (const [languageName, aliasList] of Object.entries(PRISM_HIGHLIGHT_ALIASES)) {
  hljs.registerAliases(aliasList, { languageName });
}

export function isPrismCodeHighlightLanguage(language: string) {
  return Boolean(hljs.getLanguage(language));
}

export function highlightPrismCode(code: string, language: string) {
  return hljs.highlight(code, { language, ignoreIllegals: true });
}

export function highlightPrismCodeAuto(code: string) {
  return hljs.highlightAuto(code, PRISM_HIGHLIGHT_AUTO_SUBSET);
}
