import { useCallback, useEffect, useState } from 'react';
import type { CommandPaletteMode } from '../components/shell/CommandPalette';
import { onAppEvent } from '../platform/events/appEvents';

export function useAppAuxiliaryModalsModel() {
  const [shortcutPanelVisible, setShortcutPanelVisible] = useState(false);
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<CommandPaletteMode>('files');
  const [aboutVisible, setAboutVisible] = useState(false);

  const closeAbout = useCallback(() => setAboutVisible(false), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteVisible(false), []);
  const closeShortcutPanel = useCallback(() => setShortcutPanelVisible(false), []);
  const openAbout = useCallback(() => setAboutVisible(true), []);
  const openShortcuts = useCallback(() => setShortcutPanelVisible(true), []);
  const openQuickOpen = useCallback(() => {
    setCommandPaletteMode('files');
    setCommandPaletteVisible(true);
  }, []);
  const openWorkspaceSearch = useCallback(() => {
    setCommandPaletteMode('search');
    setCommandPaletteVisible(true);
  }, []);

  useEffect(() => (
    onAppEvent('search.open', ({ action, rootPath }) => {
      if (!rootPath && action !== 'workspace') return;
      openWorkspaceSearch();
    })
  ), [openWorkspaceSearch]);

  return {
    aboutVisible,
    closeAbout,
    closeCommandPalette,
    closeShortcutPanel,
    commandPaletteMode,
    commandPaletteVisible,
    openAbout,
    openQuickOpen,
    openShortcuts,
    openWorkspaceSearch,
    shortcutPanelVisible,
  };
}
