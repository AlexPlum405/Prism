export type PrismDiagnosticKind =
  | 'link'
  | 'image'
  | 'render'
  | 'export'
  | 'typography'
  | 'table';

export type PrismDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface PrismDiagnostic {
  action?: string;
  column?: number;
  detail?: string;
  id?: string;
  kind: PrismDiagnosticKind;
  line?: number;
  message: string;
  reason?: string;
  severity: PrismDiagnosticSeverity;
  source: string;
  target?: string;
}

export function createPrismDiagnosticId(input: {
  column?: number;
  kind: PrismDiagnosticKind;
  line?: number;
  message: string;
  source: string;
  target?: string;
}) {
  return [
    input.source,
    input.kind,
    input.line ?? 'none',
    input.column ?? 'none',
    input.target || input.message,
  ].join(':');
}

export function isActionableErrorDiagnostic(diagnostic: PrismDiagnostic) {
  return diagnostic.severity === 'error';
}

export function getActionableErrorDiagnostics(diagnostics: PrismDiagnostic[]) {
  return diagnostics.filter(isActionableErrorDiagnostic);
}
