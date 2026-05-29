import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { taskListCheckboxExtension } from './taskListCheckbox';

function createTaskListEditor(doc: string) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        taskListCheckboxExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            update.view.dom.dispatchEvent(new CustomEvent('doc-change'));
          }
        }),
      ],
    }),
  });

  return { parent, view };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('task list checkbox editor extension', () => {
  it('renders markdown task markers as clickable editor checkboxes', () => {
    const { parent } = createTaskListEditor('- [ ] First\n- [x] Done');

    const checkboxes = parent.querySelectorAll<HTMLInputElement>('.cm-task-list-checkbox');

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
  });

  it('toggles the source markdown marker when clicking the editor checkbox', () => {
    const { parent, view } = createTaskListEditor('- [ ] First');
    const checkbox = parent.querySelector<HTMLInputElement>('.cm-task-list-checkbox');

    checkbox?.click();

    expect(view.state.doc.toString()).toBe('- [x] First');
  });

  it('toggles checked task markers back to unchecked source markdown', () => {
    const { parent, view } = createTaskListEditor('1. [X] First');
    const checkbox = parent.querySelector<HTMLInputElement>('.cm-task-list-checkbox');

    checkbox?.click();

    expect(view.state.doc.toString()).toBe('1. [ ] First');
  });
});
