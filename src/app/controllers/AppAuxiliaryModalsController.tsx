import { AboutModal } from '../../components/shell/AboutModal';
import { CommandPalette, type CommandPaletteMode } from '../../components/shell/CommandPalette';
import { ShortcutPanel } from '../../components/shell/ShortcutPanel';
import type { OpenDocument } from '../../domains/document/types';
import type { RecentFile, WorkspaceIndex } from '../../domains/workspace/services';
import type { FileNode } from '../../domains/workspace/types';

interface AppAuxiliaryModalsControllerProps {
  aboutVisible: boolean;
  commandPaletteMode: CommandPaletteMode;
  commandPaletteVisible: boolean;
  currentDocument: OpenDocument | null;
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
  currentDocument,
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
        currentDocument={currentDocument}
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
