import { AboutModal } from '../../components/shell/AboutModal';
import { CommandPalette, type CommandPaletteMode } from '../../components/shell/CommandPalette';
import { ShortcutPanel } from '../../components/shell/ShortcutPanel';
import type { RecentFile, WorkspaceIndex } from '../../domains/workspace/services';
import type { FileNode } from '../../domains/workspace/types';

interface AppAuxiliaryModalsControllerProps {
  aboutVisible: boolean;
  commandPaletteMode: CommandPaletteMode;
  commandPaletteVisible: boolean;
  files: FileNode[];
  recentFiles: RecentFile[];
  workspaceIndex: WorkspaceIndex | null;
  workspaceIndexing: boolean;
  workspaceRoot: string | null;
  shortcutPanelVisible: boolean;
  onAboutCheckUpdate: () => void;
  onAboutClose: () => void;
  onCommandPaletteClose: () => void;
  onCommandPaletteExecute: (commandId: string) => void;
  onShortcutPanelClose: () => void;
}

export function AppAuxiliaryModalsController({
  aboutVisible,
  commandPaletteMode,
  commandPaletteVisible,
  files,
  recentFiles,
  shortcutPanelVisible,
  workspaceIndex,
  workspaceIndexing,
  workspaceRoot,
  onAboutCheckUpdate,
  onAboutClose,
  onCommandPaletteClose,
  onCommandPaletteExecute,
  onShortcutPanelClose,
}: AppAuxiliaryModalsControllerProps) {
  return (
    <>
      <ShortcutPanel
        visible={shortcutPanelVisible}
        onClose={onShortcutPanelClose}
      />

      <CommandPalette
        visible={commandPaletteVisible}
        files={files}
        workspaceRoot={workspaceRoot}
        recentFiles={recentFiles}
        workspaceIndex={workspaceIndex}
        workspaceIndexing={workspaceIndexing}
        mode={commandPaletteMode}
        onClose={onCommandPaletteClose}
        onExecute={onCommandPaletteExecute}
      />

      <AboutModal
        visible={aboutVisible}
        onClose={onAboutClose}
        onCheckUpdate={onAboutCheckUpdate}
      />
    </>
  );
}
