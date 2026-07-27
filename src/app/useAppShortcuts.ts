import { useCallback, useEffect } from 'react';
import {
  findCommandByKeyboardEvent,
  runCommand,
  type CommandContext,
  type CommandDefinition,
  type CommandId,
} from '../domains/commands';

interface UseAppShortcutsInput {
  createCommandContext: () => CommandContext;
  findCommand?: (event: KeyboardEvent) => CommandDefinition | null;
  focusMode: boolean;
  runCommandById?: (id: CommandId, context: CommandContext) => void | Promise<void>;
  toggleFocusMode: () => void;
}

const NATIVE_CODEMIRROR_SHORTCUTS = new Set<CommandId>(['paste', 'pastePlain']);

function getTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function isCodeMirrorTarget(target: Element | null): boolean {
  return Boolean(target?.closest('.cm-editor, .cm-content'));
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = getTargetElement(target);
  if (!element) return false;
  if (element.closest('input, textarea, select')) return true;
  if (element.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

function shouldPreserveEditableShortcut(event: KeyboardEvent, command: CommandDefinition): boolean {
  if (!isEditableTarget(event.target)) return false;
  if (isCodeMirrorTarget(getTargetElement(event.target))) {
    return NATIVE_CODEMIRROR_SHORTCUTS.has(command.id);
  }
  return command.category === 'edit' || command.category === 'format' || command.category === 'insert';
}

export function useAppShortcuts({
  createCommandContext,
  findCommand = findCommandByKeyboardEvent,
  focusMode,
  runCommandById = runCommand,
  toggleFocusMode,
}: UseAppShortcutsInput) {
  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;

    if (event.key === 'Escape' && focusMode) {
      toggleFocusMode();
      return;
    }

    const command = findCommand(event);
    if (command) {
      if (shouldPreserveEditableShortcut(event, command)) return;
      event.preventDefault();
      await runCommandById(command.id, createCommandContext());
    }
  }, [createCommandContext, findCommand, focusMode, runCommandById, toggleFocusMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
