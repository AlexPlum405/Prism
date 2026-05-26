import { create } from 'zustand';
import { DocumentSaveIssue, DocumentScrollState, DocumentState } from './types';
import type { FileSnapshot } from './fileSnapshot';
import { useSettingsStore } from '../settings/store';
import { t } from '../i18n';

interface DocumentStore extends DocumentState {
  openDocument: (path: string, name: string, content: string, snapshot?: FileSnapshot | null) => void;
  closeDocument: () => void;
  createNewDocument: (content?: string, name?: string) => void;
  updateContent: (content: string) => void;
  updateDocumentPath: (oldPath: string, newPath: string, name: string) => void;
  updateScrollState: (scrollState: Partial<DocumentScrollState>) => void;
  setViewMode: (viewMode: 'edit' | 'split' | 'preview') => void;
  updateFileSnapshot: (path: string, snapshot: FileSnapshot | null) => void;
  markSaving: (path?: string) => void;
  markSaved: (path?: string, snapshot?: FileSnapshot | null) => void;
  markSaveFailed: (error: unknown, path?: string) => void;
  markSaveConflict: (error: unknown, path?: string, issue?: DocumentSaveIssue) => void;
}

function formatSaveError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return t('document.saveFailed');
}

const DEFAULT_SCROLL_STATE: DocumentScrollState = {
  editorRatio: 0,
  previewRatio: 0,
};

export const useDocumentStore = create<DocumentStore>((set) => ({
  currentDocument: null,

  openDocument: (path, name, content, snapshot = null) => {
    set({
      currentDocument: {
        path,
        name,
        content,
        isDirty: false,
        lastSavedAt: Date.now(),
        lastKnownMtime: snapshot?.mtimeMs ?? null,
        lastKnownSize: snapshot?.size ?? null,
        saveStatus: 'saved',
        saveError: null,
        saveIssue: null,
        viewMode: useSettingsStore.getState().defaultViewMode,
        scrollState: { ...DEFAULT_SCROLL_STATE },
      },
    });
  },

  closeDocument: () => {
    set({ currentDocument: null });
  },

  createNewDocument: (content = '', name = 'Untitled.md') => {
    const hasInitialContent = content.length > 0;
    set({
      currentDocument: {
        path: '',
        name,
        content,
        isDirty: hasInitialContent,
        lastSavedAt: Date.now(),
        lastKnownMtime: null,
        lastKnownSize: null,
        saveStatus: hasInitialContent ? 'dirty' : 'saved',
        saveError: null,
        saveIssue: null,
        viewMode: useSettingsStore.getState().defaultViewMode,
        scrollState: { ...DEFAULT_SCROLL_STATE },
      },
    });
  },

  updateContent: (content) => {
    set((state) => {
      if (!state.currentDocument) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          content,
          isDirty: true,
          saveStatus: 'dirty',
          saveError: null,
          saveIssue: null,
        },
      };
    });
  },

  updateDocumentPath: (oldPath, newPath, name) => {
    set((state) => {
      if (!state.currentDocument || state.currentDocument.path !== oldPath) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          path: newPath,
          name,
        },
      };
    });
  },

  updateFileSnapshot: (path, snapshot) => {
    set((state) => {
      if (!state.currentDocument || state.currentDocument.path !== path) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          lastKnownMtime: snapshot?.mtimeMs ?? null,
          lastKnownSize: snapshot?.size ?? null,
        },
      };
    });
  },

  updateScrollState: (scrollState) => {
    set((state) => {
      if (!state.currentDocument) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          scrollState: {
            ...state.currentDocument.scrollState,
            ...scrollState,
          },
        },
      };
    });
  },

  setViewMode: (viewMode) => {
    set((state) => {
      if (!state.currentDocument) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          viewMode,
        },
      };
    });
  },

  markSaving: (path) => {
    set((state) => {
      if (!state.currentDocument) return state;
      if (path !== undefined && state.currentDocument.path !== path) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          saveStatus: 'saving',
          saveError: null,
          saveIssue: null,
        },
      };
    });
  },

  markSaved: (path, snapshot) => {
    set((state) => {
      if (!state.currentDocument) return state;
      if (path !== undefined && state.currentDocument.path !== path) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          isDirty: false,
          lastSavedAt: Date.now(),
          lastKnownMtime: snapshot ? snapshot.mtimeMs : state.currentDocument.lastKnownMtime,
          lastKnownSize: snapshot ? snapshot.size : state.currentDocument.lastKnownSize,
          saveStatus: 'saved',
          saveError: null,
          saveIssue: null,
        },
      };
    });
  },

  markSaveFailed: (error, path) => {
    set((state) => {
      if (!state.currentDocument) return state;
      if (path !== undefined && state.currentDocument.path !== path) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          isDirty: true,
          saveStatus: 'failed',
          saveError: formatSaveError(error),
          saveIssue: null,
        },
      };
    });
  },

  markSaveConflict: (error, path, issue = 'external-modified') => {
    set((state) => {
      if (!state.currentDocument) return state;
      if (path !== undefined && state.currentDocument.path !== path) return state;
      return {
        currentDocument: {
          ...state.currentDocument,
          isDirty: true,
          saveStatus: 'conflict',
          saveError: formatSaveError(error),
          saveIssue: issue,
        },
      };
    });
  },
}));
