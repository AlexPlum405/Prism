import { describe, expect, it } from 'vitest';
import { getShortcutDisplayPlatform, getShortcutLabel, shortcutMatchesEvent } from './platform';
import type { ShortcutBinding } from './types';

function keyEvent(
  code: string,
  modifiers: Partial<Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {},
): KeyboardEvent {
  return {
    code,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

describe('command shortcut platform helpers', () => {
  it('formats mod shortcuts with platform-native labels', () => {
    const shortcut: ShortcutBinding = { code: 'KeyP', mod: true };

    expect(getShortcutLabel(shortcut, 'mac')).toBe('⌘P');
    expect(getShortcutLabel(shortcut, 'windows')).toBe('Ctrl+P');
    expect(getShortcutLabel(shortcut, 'linux')).toBe('Ctrl+P');
  });

  it('formats explicit modifier combinations without losing the key label', () => {
    const shortcut: ShortcutBinding = { code: 'BracketLeft', mod: true, shift: true, alt: true };

    expect(getShortcutLabel(shortcut, 'mac')).toBe('⌥⇧⌘[');
    expect(getShortcutLabel(shortcut, 'windows')).toBe('Ctrl+Alt+Shift+[');
    expect(getShortcutLabel(shortcut, 'linux')).toBe('Ctrl+Alt+Shift+[');
  });

  it('hides platform-specific shortcuts on other platforms', () => {
    const windowsOnly: ShortcutBinding = { code: 'KeyY', mod: true, platforms: ['windows'] };
    const nonMacShortcut: ShortcutBinding = { code: 'KeyY', mod: true, platforms: ['windows', 'linux'] };

    expect(getShortcutLabel(windowsOnly, 'mac')).toBeUndefined();
    expect(getShortcutLabel(windowsOnly, 'windows')).toBe('Ctrl+Y');
    expect(getShortcutLabel(windowsOnly, 'linux')).toBeUndefined();
    expect(getShortcutLabel(nonMacShortcut, 'linux')).toBe('Ctrl+Y');
  });

  it('matches mod shortcuts against meta on mac and ctrl on windows', () => {
    const shortcut: ShortcutBinding = { code: 'KeyP', mod: true };

    expect(shortcutMatchesEvent(shortcut, keyEvent('KeyP', { metaKey: true }), 'mac')).toBe(true);
    expect(shortcutMatchesEvent(shortcut, keyEvent('KeyP', { ctrlKey: true }), 'mac')).toBe(false);
    expect(shortcutMatchesEvent(shortcut, keyEvent('KeyP', { ctrlKey: true }), 'windows')).toBe(true);
    expect(shortcutMatchesEvent(shortcut, keyEvent('KeyP', { metaKey: true }), 'windows')).toBe(false);
    expect(shortcutMatchesEvent(shortcut, keyEvent('KeyP', { ctrlKey: true }), 'linux')).toBe(true);
    expect(shortcutMatchesEvent(shortcut, keyEvent('KeyP', { metaKey: true }), 'linux')).toBe(false);
  });

  it('respects explicit platform filters while matching events', () => {
    const windowsOnly: ShortcutBinding = { code: 'KeyY', mod: true, platforms: ['windows'] };
    const nonMacShortcut: ShortcutBinding = { code: 'KeyY', mod: true, platforms: ['windows', 'linux'] };

    expect(shortcutMatchesEvent(windowsOnly, keyEvent('KeyY', { metaKey: true }), 'mac')).toBe(false);
    expect(shortcutMatchesEvent(windowsOnly, keyEvent('KeyY', { ctrlKey: true }), 'windows')).toBe(true);
    expect(shortcutMatchesEvent(windowsOnly, keyEvent('KeyY', { ctrlKey: true }), 'linux')).toBe(false);
    expect(shortcutMatchesEvent(nonMacShortcut, keyEvent('KeyY', { ctrlKey: true }), 'linux')).toBe(true);
  });

  it('uses the requested shortcut display platform when not set to auto', () => {
    expect(getShortcutDisplayPlatform('mac')).toBe('mac');
    expect(getShortcutDisplayPlatform('windows')).toBe('windows');
  });
});
