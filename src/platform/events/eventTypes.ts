import type { PrismDiagnostic } from '../../domains/diagnostics/types';
import type { ToastInput } from '../../lib/toast';
import type { FileActionInput } from '../../lib/fileActionCommands';

export type EditorCommandPayload = {
  command: string;
} & Record<string, unknown>;

export interface EditorFormatPayload {
  format: string;
}

export interface EditorHeadingPayload {
  level: string;
}

export interface EditorBlockFormatPayload {
  format: string;
}

export interface CommandRunPayload {
  action: string;
}

export interface SearchOpenPayload {
  action?: string;
  rootPath?: string;
}

export interface FileRenameRequestPayload {
  path: string;
}

export interface ExportProgressPayload {
  visible?: boolean;
  message?: string;
}

export interface ExportFailedPayload {
  diagnostic: string;
  documentPath?: string | null;
  format?: string;
  message?: string;
  nextSteps?: string;
  outputPath?: string | null;
  stage?: string;
  title: string;
}

export interface DiagnosticsOpenPayload {
  diagnostics?: PrismDiagnostic[];
}

export interface AppEventMap {
  'editor.command': EditorCommandPayload;
  'editor.format': EditorFormatPayload;
  'editor.heading': EditorHeadingPayload;
  'editor.blockFormat': EditorBlockFormatPayload;
  'command.run': CommandRunPayload;
  'search.open': SearchOpenPayload;
  'file.action': FileActionInput;
  'file.renameRequest': FileRenameRequestPayload;
  'toast.show': ToastInput;
  'export.progress': ExportProgressPayload;
  'export.failed': ExportFailedPayload;
  'diagnostics.open': DiagnosticsOpenPayload;
  'settings.open': Record<string, never>;
}

export type AppEventKey = keyof AppEventMap;
