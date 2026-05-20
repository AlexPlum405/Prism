import type { LinkDiagnostic } from '../editor/extensions/linkDiagnostics';
import type { ImageDiagnostic } from '../editor/extensions/imageDiagnostics';
import type { HeadingDiagnostic } from '../editor/extensions/headingDiagnostics';
import type { TableDiagnostic } from '../editor/extensions/tables';
import type { TypographyDiagnostic } from '../editor/extensions/typographyDiagnostics';
import { t, type I18nKey } from '../i18n';
import type { PrismDiagnostic } from './types';

const LINK_REASON_KEY: Record<LinkDiagnostic['kind'], I18nKey> = {
  'empty-target': 'editor.linkDiagnostics.reason.emptyTarget',
  'missing-file': 'editor.linkDiagnostics.reason.missingFile',
  'missing-heading': 'editor.linkDiagnostics.reason.missingHeading',
};

const LINK_ACTION_KEY: Record<LinkDiagnostic['kind'], I18nKey> = {
  'empty-target': 'editor.linkDiagnostics.action.emptyTarget',
  'missing-file': 'editor.linkDiagnostics.action.missingFile',
  'missing-heading': 'editor.linkDiagnostics.action.missingHeading',
};

export function linkDiagnosticsToPrismDiagnostics(diagnostics: LinkDiagnostic[]): PrismDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    action: t(LINK_ACTION_KEY[diagnostic.kind]),
    column: diagnostic.column,
    kind: 'link',
    line: diagnostic.line,
    message: diagnostic.message,
    reason: t(LINK_REASON_KEY[diagnostic.kind]),
    severity: 'error',
    source: 'link-diagnostics',
  }));
}

const IMAGE_REASON_KEY: Record<ImageDiagnostic['kind'], I18nKey> = {
  'empty-target': 'diagnostics.image.empty-target.reason',
  'missing-file': 'diagnostics.image.missing-file.reason',
  'unsupported-protocol': 'diagnostics.image.unsupported-protocol.reason',
  'unresolved-relative': 'diagnostics.image.unresolved-relative.reason',
};

const IMAGE_ACTION_KEY: Record<ImageDiagnostic['kind'], I18nKey> = {
  'empty-target': 'diagnostics.image.empty-target.action',
  'missing-file': 'diagnostics.image.missing-file.action',
  'unsupported-protocol': 'diagnostics.image.unsupported-protocol.action',
  'unresolved-relative': 'diagnostics.image.unresolved-relative.action',
};

export function imageDiagnosticsToPrismDiagnostics(diagnostics: ImageDiagnostic[]): PrismDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    action: t(IMAGE_ACTION_KEY[diagnostic.kind]),
    column: diagnostic.column,
    kind: 'image',
    line: diagnostic.line,
    message: diagnostic.message,
    reason: t(IMAGE_REASON_KEY[diagnostic.kind]),
    severity: 'error',
    source: 'image-diagnostics',
  }));
}

const HEADING_REASON_KEY: Record<HeadingDiagnostic['kind'], I18nKey> = {
  'duplicate-anchor': 'diagnostics.heading.duplicateAnchor.reason',
};

const HEADING_ACTION_KEY: Record<HeadingDiagnostic['kind'], I18nKey> = {
  'duplicate-anchor': 'diagnostics.heading.duplicateAnchor.action',
};

export function headingDiagnosticsToPrismDiagnostics(diagnostics: HeadingDiagnostic[]): PrismDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    action: t(HEADING_ACTION_KEY[diagnostic.kind]),
    column: diagnostic.column,
    kind: 'link',
    line: diagnostic.line,
    message: diagnostic.message,
    reason: t(HEADING_REASON_KEY[diagnostic.kind]),
    severity: 'error',
    source: 'heading-diagnostics',
  }));
}

const TYPOGRAPHY_ACTION_KEY: Record<TypographyDiagnostic['kind'], I18nKey> = {
  'cjk-latin-spacing': 'editor.typography.action.spacing',
  'halfwidth-punctuation': 'editor.typography.action.punctuation',
  'heading-hierarchy': 'editor.typography.action.heading',
  'repeated-empty-lines': 'editor.typography.action.emptyLines',
};

export function typographyDiagnosticsToPrismDiagnostics(diagnostics: TypographyDiagnostic[]): PrismDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    action: t(TYPOGRAPHY_ACTION_KEY[diagnostic.kind]),
    column: diagnostic.column,
    kind: 'typography',
    line: diagnostic.line,
    message: diagnostic.message,
    reason: diagnostic.suggestion,
    severity: 'info',
    source: 'typography-diagnostics',
  }));
}

export function tableDiagnosticsToPrismDiagnostics(diagnostics: TableDiagnostic[]): PrismDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    action: diagnostic.action,
    column: diagnostic.column,
    kind: 'table',
    line: diagnostic.line,
    message: diagnostic.message,
    reason: diagnostic.reason,
    severity: diagnostic.severity,
    source: 'table-diagnostics',
  }));
}
