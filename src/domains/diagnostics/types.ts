export type PrismDiagnosticKind =
  | 'link'
  | 'image'
  | 'render'
  | 'export'
  | 'typography';

export type PrismDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface PrismDiagnostic {
  action?: string;
  column?: number;
  kind: PrismDiagnosticKind;
  line?: number;
  message: string;
  reason?: string;
  severity: PrismDiagnosticSeverity;
  source: string;
}

export function isActionableErrorDiagnostic(diagnostic: PrismDiagnostic) {
  return diagnostic.severity === 'error';
}

export function getActionableErrorDiagnostics(diagnostics: PrismDiagnostic[]) {
  return diagnostics.filter(isActionableErrorDiagnostic);
}
