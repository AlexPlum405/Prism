import { act, renderHook } from '@testing-library/react';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import { emitAppEvent } from '../../../platform/events/appEvents';
import { useEditorCommandEventModel } from './useEditorCommandEventModel';

function renderCommandEventModel(overrides: Partial<Parameters<typeof useEditorCommandEventModel>[0]> = {}) {
  const view = {
    focus: vi.fn(),
  } as unknown as EditorView;
  const callbacks = {
    handleFormat: vi.fn(),
    handleFoldCurrentHeading: vi.fn(() => true),
    handleSelectTable: vi.fn(() => true),
    handleSourceBlockOperation: vi.fn(() => true),
    handleTableCommand: vi.fn(() => true),
    handleTableConvert: vi.fn(() => true),
    handleTableCopy: vi.fn(async () => true),
    handleTablePasteText: vi.fn(() => false),
    handleTemplateInsert: vi.fn(() => true),
    setTableInsertVisible: vi.fn(),
    viewRef: { current: view },
    ...overrides,
  };

  const hook = renderHook(() => useEditorCommandEventModel(callbacks));
  return { callbacks, hook, view };
}

describe('useEditorCommandEventModel', () => {
  it('routes editor app events to focused editor handlers', () => {
    const { callbacks } = renderCommandEventModel();

    act(() => {
      emitAppEvent('editor.format', { format: 'bold' });
      emitAppEvent('editor.command', { command: 'sortTableDesc' });
      emitAppEvent('editor.command', { command: 'copyTableCsv' });
      emitAppEvent('editor.command', { command: 'insertTemplate', templateId: 'prd' });
    });

    expect(callbacks.handleFormat).toHaveBeenCalledWith('bold');
    expect(callbacks.handleTableCommand).toHaveBeenCalledWith('sortDesc');
    expect(callbacks.handleTableCopy).toHaveBeenCalledWith('csv');
    expect(callbacks.handleTemplateInsert).toHaveBeenCalledWith('prd');
  });

  it('keeps unknown editor commands available for feature-specific extensions', () => {
    const handleCustomEditorCommand = vi.fn(() => true);
    const { callbacks, view } = renderCommandEventModel({ handleCustomEditorCommand });

    act(() => {
      emitAppEvent('editor.command', { command: 'insertImage', source: 'menu' });
    });

    expect(handleCustomEditorCommand).toHaveBeenCalledWith(
      'insertImage',
      expect.objectContaining({ command: 'insertImage', source: 'menu' }),
      view,
    );
    expect(callbacks.handleTemplateInsert).not.toHaveBeenCalled();
  });

  it('emits command run events from editor context-menu actions', async () => {
    const { hook, view } = renderCommandEventModel();
    const commandRun = vi.fn();
    window.addEventListener('prism-command', commandRun);

    await act(async () => {
      await hook.result.current.handleEditorContextMenuAction('insertTable');
    });

    expect(commandRun).toHaveBeenCalled();
    expect(view.focus).toHaveBeenCalled();
    window.removeEventListener('prism-command', commandRun);
  });
});
