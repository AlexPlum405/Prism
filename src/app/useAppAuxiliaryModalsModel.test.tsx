import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppAuxiliaryModalsModel } from './useAppAuxiliaryModalsModel';
import { emitAppEvent } from '../platform/events/appEvents';

describe('useAppAuxiliaryModalsModel', () => {
  it('opens and closes the auxiliary modal states', () => {
    const { result } = renderHook(() => useAppAuxiliaryModalsModel());

    act(() => {
      result.current.openAbout();
      result.current.openShortcuts();
      result.current.openQuickOpen();
    });

    expect(result.current.aboutVisible).toBe(true);
    expect(result.current.shortcutPanelVisible).toBe(true);
    expect(result.current.commandPaletteVisible).toBe(true);
    expect(result.current.commandPaletteMode).toBe('files');

    act(() => {
      result.current.closeAbout();
      result.current.closeShortcutPanel();
      result.current.closeCommandPalette();
    });

    expect(result.current.aboutVisible).toBe(false);
    expect(result.current.shortcutPanelVisible).toBe(false);
    expect(result.current.commandPaletteVisible).toBe(false);
  });

  it('opens workspace search in search mode', () => {
    const { result } = renderHook(() => useAppAuxiliaryModalsModel());

    act(() => {
      result.current.openWorkspaceSearch();
    });

    expect(result.current.commandPaletteVisible).toBe(true);
    expect(result.current.commandPaletteMode).toBe('search');
  });

  it('opens workspace search from folder search events', () => {
    const { result } = renderHook(() => useAppAuxiliaryModalsModel());

    act(() => {
      emitAppEvent('search.open', { action: 'workspace', rootPath: '/repo/notes' });
    });

    expect(result.current.commandPaletteVisible).toBe(true);
    expect(result.current.commandPaletteMode).toBe('search');
  });
});
