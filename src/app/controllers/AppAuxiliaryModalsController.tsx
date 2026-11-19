import { AboutModal } from '../../components/shell/AboutModal';
import { CommandPalette, type CommandPaletteMode } from '../../components/shell/CommandPalette';
import { DocumentStatisticsPanel } from '../../components/shell/DocumentStatisticsPanel';
import { ShortcutPanel } from '../../components/shell/ShortcutPanel';
import type { OpenDocument } from '../../domains/document/types';
import type { RecentFile, WorkspaceIndex, WritingStats } from '../../domains/workspace/services';
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
  statisticsVisible: boolean;
  writingStats: WritingStats;
  onAboutCheckUpdate: () => void;
  onAboutClose: () => void;
  onCommandPaletteClose: () => void;
  onCommandPaletteExecute: (commandId: string) => void;
  onShortcutPanelClose: () => void;
  onStatisticsClose: () => void;
}

export function AppAuxiliaryModalsController({
  aboutVisible,
  commandPaletteMode,
  commandPaletteVisible,
  currentDocument,
  files,
  recentFiles,
  shortcutPanelVisible,
  statisticsVisible,
  writingStats,
  workspaceIndex,
  workspaceIndexing,
  workspaceRoot,
  onAboutCheckUpdate,
  onAboutClose,
  onCommandPaletteClose,
  onCommandPaletteExecute,
  onShortcutPanelClose,
  onStatisticsClose,
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

      <DocumentStatisticsPanel
        visible={statisticsVisible}
        stats={writingStats}
        onClose={onStatisticsClose}
      />

      <AboutModal
        visible={aboutVisible}
        onClose={onAboutClose}
        onCheckUpdate={onAboutCheckUpdate}
      />
    </>
  );
}
