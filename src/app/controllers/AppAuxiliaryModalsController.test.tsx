import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppAuxiliaryModalsController } from './AppAuxiliaryModalsController';

vi.mock('../../components/shell/ShortcutPanel', () => ({
  ShortcutPanel: ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (
    visible ? <button onClick={onClose}>shortcut-panel</button> : null
  ),
}));

vi.mock('../../components/shell/CommandPalette', () => ({
  CommandPalette: ({
    visible,
    onClose,
    onExecute,
  }: {
    visible: boolean;
    onClose: () => void;
    onExecute: (commandId: string) => void;
  }) => (
    visible
      ? (
          <div>
            <button onClick={onClose}>command-close</button>
            <button onClick={() => onExecute('quickOpen')}>command-execute</button>
          </div>
        )
      : null
  ),
}));

vi.mock('../../components/shell/AboutModal', () => ({
  AboutModal: ({
    visible,
    onCheckUpdate,
    onClose,
  }: {
    visible: boolean;
    onCheckUpdate: () => void;
    onClose: () => void;
  }) => (
    visible
      ? (
          <div>
            <button onClick={onClose}>about-close</button>
            <button onClick={onCheckUpdate}>about-update</button>
          </div>
        )
      : null
  ),
}));

function renderController(overrides: Partial<Parameters<typeof AppAuxiliaryModalsController>[0]> = {}) {
  const props: Parameters<typeof AppAuxiliaryModalsController>[0] = {
    aboutVisible: true,
    commandPaletteMode: 'files',
    commandPaletteVisible: true,
    currentDocument: null,
    files: [],
    recentFiles: [],
    shortcutPanelVisible: true,
    workspaceIndex: null,
    workspaceIndexing: false,
    workspaceRoot: null,
    onAboutCheckUpdate: vi.fn(),
    onAboutClose: vi.fn(),
    onCommandPaletteClose: vi.fn(),
    onCommandPaletteExecute: vi.fn(),
    onShortcutPanelClose: vi.fn(),
    ...overrides,
  };

  render(<AppAuxiliaryModalsController {...props} />);
  return props;
}

describe('AppAuxiliaryModalsController', () => {
  it('routes close and action callbacks for auxiliary modals', () => {
    const props = renderController();

    fireEvent.click(screen.getByText('shortcut-panel'));
    fireEvent.click(screen.getByText('command-close'));
    fireEvent.click(screen.getByText('command-execute'));
    fireEvent.click(screen.getByText('about-close'));
    fireEvent.click(screen.getByText('about-update'));

    expect(props.onShortcutPanelClose).toHaveBeenCalledTimes(1);
    expect(props.onCommandPaletteClose).toHaveBeenCalledTimes(1);
    expect(props.onCommandPaletteExecute).toHaveBeenCalledWith('quickOpen');
    expect(props.onAboutClose).toHaveBeenCalledTimes(1);
    expect(props.onAboutCheckUpdate).toHaveBeenCalledTimes(1);
  });
});
