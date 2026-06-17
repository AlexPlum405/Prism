import type { DocumentProfile } from '../workspace/services';

export type DocumentSaveStatus = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
export type DocumentSaveIssue = 'external-modified' | 'missing' | 'permission-denied' | 'unavailable';

export interface OpenDocument {
  path: string;
  profile?: DocumentProfile;
  name: string;
  content: string;
  isDirty: boolean;
  lastSavedAt: number;
  lastKnownMtime: number | null;
  lastKnownSize: number | null;
  saveStatus: DocumentSaveStatus;
  saveError: string | null;
  saveIssue?: DocumentSaveIssue | null;
  viewMode: 'edit' | 'split' | 'preview';
  scrollState: DocumentScrollState;
  cursor?: { line: number; column: number };
}

export interface DocumentScrollState {
  editorRatio: number;
  previewRatio: number;
}

export interface DocumentState {
  currentDocument: OpenDocument | null;
}
