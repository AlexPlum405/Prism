import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppShortcuts } from './useAppShortcuts';
import type { CommandContext, CommandDefinition } from '../domains/commands';

describe('useAppShortcuts', () => {
  afterEach(() => {
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

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(toggleFocusMode).toHaveBeenCalledTimes(1);
    expect(findCommand).not.toHaveBeenCalled();
  });

  it('runs matched keyboard commands with the current command context', async () => {
    const command = { id: 'save' } as CommandDefinition;
    const context = {} as CommandContext;
    const runCommandById = vi.fn();

    renderHook(() => useAppShortcuts({
      createCommandContext: () => context,
      findCommand: () => command,
      focusMode: false,
      runCommandById,
      toggleFocusMode: vi.fn(),
    }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }));

    await waitFor(() => {
      expect(runCommandById).toHaveBeenCalledWith('save', context);
    });
  });
});
