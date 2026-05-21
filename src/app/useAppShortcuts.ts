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

export function useAppShortcuts({
  createCommandContext,
  findCommand = findCommandByKeyboardEvent,
  focusMode,
  runCommandById = runCommand,
  toggleFocusMode,
}: UseAppShortcutsInput) {
  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    if (event.key === 'Escape' && focusMode) {
      toggleFocusMode();
      return;
    }

    const command = findCommand(event);
    if (command) {
      event.preventDefault();
      await runCommandById(command.id, createCommandContext());
    }
  }, [createCommandContext, findCommand, focusMode, runCommandById, toggleFocusMode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
