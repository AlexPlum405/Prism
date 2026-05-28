import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { I18nKey, I18nParams } from '../../i18n/resources';

type EditorTranslate = (key: I18nKey, params?: I18nParams) => string;

interface CreateEditorRuntimeInput {
  doc: string;
  extensions: Extension[];
  parent: HTMLElement;
}

export function createEditorRuntime({
  doc,
  extensions,
  parent,
}: CreateEditorRuntimeInput) {
  const state = EditorState.create({
    doc,
    extensions,
  });

  return new EditorView({
    state,
    parent,
  });
}

export function getEditorPhrases(t: EditorTranslate) {
  return {
    Find: t('editor.cm.find'),
    Replace: t('editor.cm.replaceWith'),
    next: t('editor.search.next'),
    previous: t('editor.search.previous'),
    all: t('editor.search.replaceAll'),
    'match case': t('editor.cm.matchCase'),
    regexp: t('editor.cm.regexp'),
    'by word': t('editor.cm.wholeWord'),
    replace: t('editor.search.replace'),
    'replace all': t('editor.search.replaceAll'),
  };
}
