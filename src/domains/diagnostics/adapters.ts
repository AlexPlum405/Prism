import type { LinkDiagnostic } from '../editor/extensions/linkDiagnostics';
import type { TypographyDiagnostic } from '../editor/extensions/typographyDiagnostics';
import type { PrismDiagnostic } from './types';

const LINK_REASON: Record<LinkDiagnostic['kind'], string> = {
  'empty-target': '链接目标为空，点击后没有可打开的位置。',
  'missing-file': '工作区里没有找到这个相对路径对应的 Markdown 文件。',
  'missing-heading': '目标文件存在，但没有匹配的标题锚点。',
};

const LINK_ACTION: Record<LinkDiagnostic['kind'], string> = {
  'empty-target': '定位后补全目标',
  'missing-file': '定位后修正路径',
  'missing-heading': '定位后修正标题',
};

export function linkDiagnosticsToPrismDiagnostics(diagnostics: LinkDiagnostic[]): PrismDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    action: LINK_ACTION[diagnostic.kind],
    column: diagnostic.column,
    kind: 'link',
    line: diagnostic.line,
    message: diagnostic.message,
    reason: LINK_REASON[diagnostic.kind],
    severity: 'error',
    source: 'link-diagnostics',
  }));
}

const TYPOGRAPHY_ACTION: Record<TypographyDiagnostic['kind'], string> = {
  'cjk-latin-spacing': '定位后调整空格',
  'halfwidth-punctuation': '定位后替换标点',
  'heading-hierarchy': '定位后调整层级',
  'repeated-empty-lines': '定位后压缩空行',
};

export function typographyDiagnosticsToPrismDiagnostics(diagnostics: TypographyDiagnostic[]): PrismDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    action: TYPOGRAPHY_ACTION[diagnostic.kind],
    column: diagnostic.column,
    kind: 'typography',
    line: diagnostic.line,
    message: diagnostic.message,
    reason: diagnostic.suggestion,
    severity: 'info',
    source: 'typography-diagnostics',
  }));
}
