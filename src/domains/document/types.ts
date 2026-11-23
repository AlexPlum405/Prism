import type { DocumentProfile } from '../workspace/services';

export type DocumentViewMode = 'edit' | 'split' | 'preview' | 'wysiwyg';

export type DocumentSaveStatus = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
export type DocumentSaveIssue = 'external-modified' | 'missing' | 'permission-denied' | 'unavailable';

export interface OpenDocument {
  path: string;
  profile?: DocumentProfile;
  name: string;
  content: string;
  isDirty: boolean;
  lastSavedAt: number;
  lastSavedContent?: string | null;
  lastKnownMtime: number | null;
  lastKnownSize: number | null;
  saveStatus: DocumentSaveStatus;
  saveError: string | null;
  saveIssue?: DocumentSaveIssue | null;
  viewMode: DocumentViewMode;
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
