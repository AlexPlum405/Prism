import { describe, expect, it, beforeEach } from 'vitest';
import { useDocumentStore } from './store';
import { useSettingsStore } from '../settings/store';

beforeEach(() => {
  useDocumentStore.setState({ currentDocument: null });
  useSettingsStore.setState({ defaultViewMode: 'split' });
});

describe('document store save status', () => {
  it('creates template-backed new documents as dirty unsaved drafts', () => {
    useDocumentStore.getState().createNewDocument('# Template', 'template.md');

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: '',
      name: 'template.md',
      content: '# Template',
      isDirty: true,
      saveStatus: 'dirty',
      saveError: null,
    });
  });

  it('marks opened documents as saved', () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A', { size: 3, mtimeMs: 1000 });

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: false,
      lastSavedContent: '# A',
      lastKnownMtime: 1000,
      lastKnownSize: 3,
      saveStatus: 'saved',
      saveError: null,
      scrollState: { editorRatio: 0, previewRatio: 0 },
    });
  });

  it('opens text documents in edit mode even when the default view uses preview', () => {
    useSettingsStore.setState({ defaultViewMode: 'preview' });

    useDocumentStore.getState().openDocument('/tmp/query.sql', 'query.sql', 'select 1;');
    useDocumentStore.getState().setViewMode('preview');

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      profile: expect.objectContaining({ kind: 'text', supportsPreview: false }),
      viewMode: 'edit',
    });
  });

  it('marks edited content as dirty and clears previous save errors', () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A');
    useDocumentStore.getState().markSaveFailed(new Error('disk full'), '/tmp/a.md');
    useDocumentStore.getState().updateContent('# B');

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# B',
      isDirty: true,
      saveStatus: 'dirty',
      saveError: null,
    });
  });

  it('ignores stale save results for a different path', () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A');
    useDocumentStore.getState().updateContent('# B');
    useDocumentStore.getState().markSaved('/tmp/other.md');

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      saveStatus: 'dirty',
    });
  });

  it('remembers editor and preview scroll ratios without marking content dirty', () => {
    useDocumentStore.getState().openDocument('/tmp/a.md', 'a.md', '# A');

    useDocumentStore.getState().updateScrollState({ editorRatio: 0.25 });
    useDocumentStore.getState().updateScrollState({ previewRatio: 0.75 });

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: false,
      saveStatus: 'saved',
      scrollState: { editorRatio: 0.25, previewRatio: 0.75 },
    });
  });
});
