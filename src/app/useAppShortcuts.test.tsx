import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppShortcuts } from './useAppShortcuts';
import type { CommandContext, CommandDefinition } from '../domains/commands';

function dispatchKeyboardEvent(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('useAppShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('toggles focus mode with Escape before command matching', () => {
    const findCommand = vi.fn();
    const toggleFocusMode = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: vi.fn(() => ({} as CommandContext)),
      findCommand,
      focusMode: true,
      toggleFocusMode,
    }));

    dispatchKeyboardEvent(window, { key: 'Escape' });

    expect(toggleFocusMode).toHaveBeenCalledTimes(1);
    expect(findCommand).not.toHaveBeenCalled();
  });

  it('keeps Escape available from editable fields while focus mode is active', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const findCommand = vi.fn();
    const toggleFocusMode = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: vi.fn(() => ({} as CommandContext)),
      findCommand,
      focusMode: true,
      toggleFocusMode,
    }));

    dispatchKeyboardEvent(input, { key: 'Escape' });

    expect(toggleFocusMode).toHaveBeenCalledTimes(1);
    expect(findCommand).not.toHaveBeenCalled();
  });

  it('ignores keyboard events already handled by nested controls', () => {
    const findCommand = vi.fn();
    const toggleFocusMode = vi.fn();
    const runCommandById = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: vi.fn(() => ({} as CommandContext)),
      findCommand,
      focusMode: true,
      runCommandById,
      toggleFocusMode,
    }));

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Escape',
    });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(toggleFocusMode).not.toHaveBeenCalled();
    expect(findCommand).not.toHaveBeenCalled();
    expect(runCommandById).not.toHaveBeenCalled();
  });

  it('runs matched keyboard commands with the current command context', async () => {
    const command = { id: 'save', category: 'file' } as CommandDefinition;
    const context = {} as CommandContext;
    const runCommandById = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: () => context,
      findCommand: () => command,
      focusMode: false,
      runCommandById,
      toggleFocusMode: vi.fn(),
    }));

    dispatchKeyboardEvent(window, { key: 's', code: 'KeyS', metaKey: true });

    await waitFor(() => {
      expect(runCommandById).toHaveBeenCalledWith('save', context);
    });
  });

  it.each([
    ['input', 'selectAll', { key: 'a', code: 'KeyA', metaKey: true }],
    ['textarea', 'copy', { key: 'c', code: 'KeyC', metaKey: true }],
    ['select', 'paste', { key: 'v', code: 'KeyV', metaKey: true }],
    ['contenteditable', 'undo', { key: 'z', code: 'KeyZ', metaKey: true }],
    ['input', 'showSearch', { key: 'f', code: 'KeyF', metaKey: true }],
    ['textarea', 'showReplace', { key: 'h', code: 'KeyH', metaKey: true }],
  ])('preserves native %s handling for %s', (targetKind, commandId, eventInit) => {
    const target = targetKind === 'contenteditable'
      ? document.createElement('div')
      : document.createElement(targetKind);
    if (targetKind === 'contenteditable') {
      target.setAttribute('contenteditable', 'true');
    }
    document.body.append(target);
    const command = { id: commandId, category: 'edit' } as CommandDefinition;
    const runCommandById = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: vi.fn(() => ({} as CommandContext)),
      findCommand: () => command,
      focusMode: false,
      runCommandById,
      toggleFocusMode: vi.fn(),
    }));

    const event = dispatchKeyboardEvent(target, eventInit);

    expect(event.defaultPrevented).toBe(false);
    expect(runCommandById).not.toHaveBeenCalled();
  });

  it('keeps true global commands available from editable fields', async () => {
    const input = document.createElement('input');
    document.body.append(input);
    const command = { id: 'save', category: 'file' } as CommandDefinition;
    const context = {} as CommandContext;
    const runCommandById = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: () => context,
      findCommand: () => command,
      focusMode: false,
      runCommandById,
      toggleFocusMode: vi.fn(),
    }));

    const event = dispatchKeyboardEvent(input, { key: 's', code: 'KeyS', metaKey: true });

    await waitFor(() => {
      expect(runCommandById).toHaveBeenCalledWith('save', context);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps unhandled CodeMirror shortcuts in the app command registry', async () => {
    const editor = document.createElement('div');
    editor.className = 'cm-editor';
    const content = document.createElement('div');
    content.className = 'cm-content';
    content.setAttribute('contenteditable', 'true');
    editor.append(content);
    document.body.append(editor);
    const command = { id: 'bold', category: 'format' } as CommandDefinition;
    const context = {} as CommandContext;
    const runCommandById = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: () => context,
      findCommand: () => command,
      focusMode: false,
      runCommandById,
      toggleFocusMode: vi.fn(),
    }));

    const event = dispatchKeyboardEvent(content, { key: 'b', code: 'KeyB', metaKey: true });

    await waitFor(() => {
      expect(runCommandById).toHaveBeenCalledWith('bold', context);
    });
    expect(event.defaultPrevented).toBe(true);
  });
});
