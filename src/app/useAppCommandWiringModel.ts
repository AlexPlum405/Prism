import { useCallback } from 'react';
import { useAppCommandContext } from './useAppCommandContext';
import { useAppShortcuts } from './useAppShortcuts';

type AppCommandContextInput = Parameters<typeof useAppCommandContext>[0];

interface UseAppCommandWiringModelInput extends AppCommandContextInput {
  closeAbout: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
}

export function useAppCommandWiringModel({
  closeAbout,
  focusMode,
  toggleFocusMode,
  ...commandContextInput
}: UseAppCommandWiringModelInput) {
  const {
    createCommandContext,
    handleCommandAction,
    menuSections,
  } = useAppCommandContext(commandContextInput);

  const handleAboutCheckUpdate = useCallback(() => {
    closeAbout();
    void handleCommandAction('checkUpdate');
  }, [closeAbout, handleCommandAction]);

  useAppShortcuts({
    createCommandContext,
    focusMode,
    toggleFocusMode,
  });

  return {
    createCommandContext,
    handleAboutCheckUpdate,
    handleCommandAction,
    menuSections,
  };
}
