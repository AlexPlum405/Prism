import { describe, expect, it, vi } from 'vitest';
import { createEditorRuntime, getEditorPhrases } from './createEditorRuntime';

describe('createEditorRuntime', () => {
  it('creates a CodeMirror view with the provided document', () => {
    const parent = document.createElement('div');
    const view = createEditorRuntime({
      doc: '# Title',
      extensions: [],
      parent,
    });

    expect(view.state.doc.toString()).toBe('# Title');
    expect(parent.querySelector('.cm-editor')).toBeTruthy();

    view.destroy();
  });

  it('maps CodeMirror phrases through Prism i18n', () => {
    const t = vi.fn((key: string) => `i18n:${key}`);

    expect(getEditorPhrases(t).Find).toBe('i18n:editor.cm.find');
    expect(getEditorPhrases(t).regexp).toBe('i18n:editor.cm.regexp');
  });
});
