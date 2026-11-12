import { afterEach, describe, expect, it, vi } from 'vitest';
import { runEditCommandOnFocusedControl } from './editCommandFocus';

function mountInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.value = 'hello';
  document.body.appendChild(input);
  input.focus();
  return input;
}

function mountCodeMirror(): HTMLElement {
  const editor = document.createElement('div');
  editor.className = 'cm-editor';
  const content = document.createElement('div');
  content.className = 'cm-content';
  content.setAttribute('contenteditable', 'true');
  editor.appendChild(content);
  document.body.appendChild(editor);
  content.focus();
  return content;
}

describe('runEditCommandOnFocusedControl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('ignores commands that are not native edit actions', () => {
    mountInput();
    expect(runEditCommandOnFocusedControl('exportPdf')).toBe(false);
  });

  it('does nothing when the focused element is not editable', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.focus();
    expect(runEditCommandOnFocusedControl('copy')).toBe(false);
  });

  it('leaves every action to the editor when focus is inside CodeMirror', () => {
    mountCodeMirror();
    const execCommand = vi.fn();
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    expect(runEditCommandOnFocusedControl('selectAll')).toBe(false);
    expect(runEditCommandOnFocusedControl('undo')).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('selects the value of a focused text input instead of the document', () => {
    const input = mountInput();
    input.setSelectionRange(0, 0);

    expect(runEditCommandOnFocusedControl('selectAll')).toBe(true);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(5);
  });

  it('delegates copy and undo on a focused input to the browser', () => {
    mountInput();
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    expect(runEditCommandOnFocusedControl('copy')).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');

    expect(runEditCommandOnFocusedControl('undo')).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('undo');
  });

  it('reports false when the browser refuses the command', () => {
    mountInput();
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    expect(runEditCommandOnFocusedControl('cut')).toBe(false);
  });
});
