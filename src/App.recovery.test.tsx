import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { shouldShowRecoveryPrompt } from './App';
import { useDocumentStore } from './domains/document/store';
import { useRecoveryQueue } from './domains/document/hooks/useRecoveryQueue';
import type { RecoverySnapshot } from './domains/document/services/recovery';
import { useSettingsStore } from './domains/settings/store';
import { DEFAULT_SETTINGS } from './domains/settings/types';
import { useWorkspaceStore } from './domains/workspace/store';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/tmp/app-data'),
  downloadDir: vi.fn().mockResolvedValue('/tmp/downloads'),
  homeDir: vi.fn().mockResolvedValue('/tmp/home'),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(false),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readTextFile: vi.fn().mockResolvedValue('{}'),
  stat: vi.fn().mockResolvedValue({ size: 0, mtime: new Date(1000) }),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./hooks/useBootstrap', () => ({
  useBootstrap: vi.fn(),
}));

vi.mock('./domains/document/hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

vi.mock('./domains/document/hooks/useExternalFileChangeMonitor', () => ({
  useExternalFileChangeMonitor: vi.fn(),
}));

vi.mock('./domains/document/hooks/useRecoveryQueue', () => ({
  useRecoveryQueue: vi.fn(),
}));

vi.mock('./domains/document/components/DocumentView', () => ({
  DocumentView: () => <div data-testid="document-view" />,
}));

vi.mock('./components/shell/WindowShell', () => ({
  WindowShell: ({ children }: { children: any }) => (
    <div data-testid="window-shell">{children}</div>
  ),
}));

vi.mock('./components/shell/TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}));

vi.mock('./components/shell/MenuBar', () => ({
  MenuBar: () => <div data-testid="menu-bar" />,
}));

vi.mock('./domains/workspace/components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('./domains/workspace/components/StatusBar', () => ({
  StatusBar: ({
    exportProgress,
    exportProgressInBackground,
    onShowExportProgress,
  }: {
    exportProgress?: string | null;
    exportProgressInBackground?: boolean;
    onShowExportProgress?: () => void;
  }) => (
    <div data-testid="status-bar">
      {exportProgress && exportProgressInBackground && (
        <button type="button" onClick={onShowExportProgress}>导出中</button>
      )}
    </div>
  ),
}));

vi.mock('./components/shell/ContextMenu', () => ({
  ContextMenu: () => <div data-testid="context-menu" />,
}));

vi.mock('./components/shell/ShortcutPanel', () => ({
  ShortcutPanel: () => null,
}));

vi.mock('./components/shell/CommandPalette', () => ({
  CommandPalette: () => null,
}));

vi.mock('./components/shell/AboutModal', () => ({
  AboutModal: () => null,
}));

vi.mock('./components/shell/SettingsModal', () => ({
  SettingsModal: () => null,
}));

vi.mock('./domains/editor/components/LinkDiagnosticsPanel', () => ({
  LinkDiagnosticsPanel: () => null,
}));

vi.mock('./domains/editor/components/TypographyDiagnosticsPanel', () => ({
  TypographyDiagnosticsPanel: () => null,
}));

vi.mock('./domains/commands', () => ({
  findCommandByKeyboardEvent: vi.fn(() => null),
  getCommandMenuItems: vi.fn(() => []),
  getMenuSections: vi.fn(() => []),
  isCommandId: vi.fn(() => false),
  runCommand: vi.fn(),
}));

vi.mock('./domains/export', () => ({
  getExportFormatLabel: vi.fn((format: string) => format.toUpperCase()),
}));

vi.mock('./domains/workspace/components/fileTreeContextMenu', () => ({
  createFileTreeContextMenuItems: vi.fn(() => []),
}));

vi.mock('./lib/fileActions', () => ({
  executeFileAction: vi.fn(),
}));

vi.mock('./lib/fileSystemScope', () => ({
  grantWorkspaceDirectoryScope: vi.fn(),
}));

vi.mock('./domains/document/services/conflictResolution', () => ({
  overwriteConflictedDocument: vi.fn(),
  reloadConflictedDocument: vi.fn(),
  saveConflictedDocumentAs: vi.fn(),
}));

const snapshot: RecoverySnapshot = {
  id: 'doc:1000',
  documentId: 'doc',
  documentPath: '/tmp/a.md',
  documentName: 'a.md',
  content: '# Draft',
  createdAt: 1000,
  reason: 'autosave',
  filePath: '/app/recovery/doc/1000.json',
};

const recoveryHandlers = {
  restore: vi.fn(),
  discard: vi.fn(),
};

function mockRecoveryQueue(activeRecoverySnapshot: RecoverySnapshot | null = snapshot) {
  vi.mocked(useRecoveryQueue).mockReturnValue({
    activeRecoverySnapshot,
    recoveryAction: null,
    handleRestoreRecovery: recoveryHandlers.restore,
    handleDiscardRecovery: recoveryHandlers.discard,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/');
  document.documentElement.removeAttribute('data-platform');
  document.body.className = '';

  useDocumentStore.setState({ currentDocument: null });
  useWorkspaceStore.setState({
    mode: 'single',
    rootPath: null,
    fileTree: [],
    fileTreeMode: 'tree',
    fileSortMode: 'name',
    sidebarVisible: true,
    sidebarTab: 'files',
    focusMode: false,
    statusBarVisible: true,
    typewriterMode: false,
    isFullscreen: false,
    isAlwaysOnTop: false,
  });
  useSettingsStore.setState({
    ...DEFAULT_SETTINGS,
    loadSettings: vi.fn().mockResolvedValue(undefined),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  });

  mockRecoveryQueue();
});

describe('App recovery prompt wiring', () => {
  it('marks the runtime platform for scoped visual compensation', () => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    mockRecoveryQueue(null);

    const { unmount } = render(<App />);

    expect(document.documentElement).toHaveAttribute('data-platform', 'windows');
    expect(document.body).toHaveClass('platform-windows');

    unmount();

    expect(document.documentElement).not.toHaveAttribute('data-platform');
    expect(document.body).not.toHaveClass('platform-windows');
  });

  it('shows the recovery modal from the active startup snapshot and forwards actions', () => {
    render(<App />);

    expect(screen.getByRole('dialog', { name: '恢复文档' })).toBeInTheDocument();
    expect(screen.getByText('发现未保存版本')).toBeInTheDocument();
    expect(screen.getByText('a.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '恢复这个版本' }));
    fireEvent.click(screen.getByRole('button', { name: '丢弃快照' }));

    expect(recoveryHandlers.restore).toHaveBeenCalledTimes(1);
    expect(recoveryHandlers.discard).toHaveBeenCalledTimes(1);
  });

  it('hides recovery while the current document is in save conflict', () => {
    useDocumentStore.setState({
      currentDocument: {
        path: '/tmp/a.md',
        name: 'a.md',
        content: '# Draft',
        isDirty: true,
        lastSavedAt: 1000,
        lastKnownMtime: 1000,
        lastKnownSize: 7,
        saveStatus: 'conflict',
        saveError: '文件已在磁盘上被外部修改',
        viewMode: 'edit',
        scrollState: { editorRatio: 0, previewRatio: 0 },
      },
    });

    render(<App />);

    expect(screen.queryByRole('dialog', { name: '恢复文档' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '文件冲突' })).toBeInTheDocument();
  });
});

describe('shouldShowRecoveryPrompt', () => {
  it('keeps recovery behind save dialogs and save conflicts', () => {
    expect(shouldShowRecoveryPrompt({
      hasSnapshot: true,
      hasSaveDialog: false,
      hasSaveConflict: false,
    })).toBe(true);

    expect(shouldShowRecoveryPrompt({
      hasSnapshot: true,
      hasSaveDialog: true,
      hasSaveConflict: false,
    })).toBe(false);

    expect(shouldShowRecoveryPrompt({
      hasSnapshot: true,
      hasSaveDialog: false,
      hasSaveConflict: true,
    })).toBe(false);

    expect(shouldShowRecoveryPrompt({
      hasSnapshot: false,
      hasSaveDialog: false,
      hasSaveConflict: false,
    })).toBe(false);
  });
});

describe('App export diagnostics wiring', () => {
  it('shows export progress, clears stale failures, and hides progress when complete', async () => {
    mockRecoveryQueue(null);
    render(<App />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('prism-export-failure', {
        detail: {
          title: 'PDF 导出失败',
          diagnostic: 'stage: render-pdf\nerror: simulated export failure',
        },
      }));
    });

    expect(screen.getByRole('dialog', { name: 'PDF 导出失败' })).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('prism-export-progress', {
        detail: { visible: true, message: '正在写入 PDF 文件' },
      }));
    });

    expect(screen.queryByRole('dialog', { name: 'PDF 导出失败' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('正在写入 PDF 文件');

    await act(async () => {
      window.dispatchEvent(new CustomEvent('prism-export-progress', {
        detail: { visible: false },
      }));
    });

    expect(screen.queryByText('正在写入 PDF 文件')).not.toBeInTheDocument();
  });

  it('can move export progress to the status bar and restore the toast', async () => {
    mockRecoveryQueue(null);
    useDocumentStore.setState({
      currentDocument: {
        path: '/tmp/report.md',
        name: 'report.md',
        content: '# Report',
        isDirty: false,
        lastSavedAt: 1000,
        lastKnownMtime: 1000,
        lastKnownSize: 8,
        saveStatus: 'saved',
        saveError: null,
        viewMode: 'edit',
        scrollState: { editorRatio: 0, previewRatio: 0 },
      },
    });
    render(<App />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('prism-export-progress', {
        detail: { visible: true, message: '正在生成 PDF 页面 2 / 49' },
      }));
    });

    expect(screen.getByRole('status')).toHaveTextContent('正在生成 PDF 页面 2 / 49');

    fireEvent.click(screen.getByRole('button', { name: '后台' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出中' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '导出中' }));

    expect(screen.getByRole('status')).toHaveTextContent('正在生成 PDF 页面 2 / 49');
  });

  it('shows export failure diagnostics and copies them to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    mockRecoveryQueue(null);

    render(<App />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('prism-export-failure', {
        detail: {
          title: 'PDF 导出失败',
          diagnostic: 'stage: render-pdf\nerror: simulated export failure',
          documentPath: '/tmp/report.md',
          message: 'simulated export failure',
          nextSteps: '检查输出目录后重试',
          outputPath: '/tmp/report.pdf',
          stage: '正在写入 PDF 文件',
        },
      }));
    });

    expect(screen.getByRole('dialog', { name: 'PDF 导出失败' })).toBeInTheDocument();
    expect(screen.getByText('正在写入 PDF 文件')).toBeInTheDocument();
    expect(screen.getByText('/tmp/report.md')).toBeInTheDocument();
    expect(screen.getByText('/tmp/report.pdf')).toBeInTheDocument();
    expect(screen.getByText('simulated export failure')).toBeInTheDocument();
    expect(screen.getByText('检查输出目录后重试')).toBeInTheDocument();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'stage: render-pdf\nerror: simulated export failure',
    );

    fireEvent.click(screen.getByRole('button', { name: '复制诊断文本' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('stage: render-pdf\nerror: simulated export failure');
    });
    expect(screen.getByRole('status')).toHaveTextContent('导出诊断文本已复制');
  });

  it('renders structured toast actions from the app toast event', async () => {
    const onOpen = vi.fn();
    mockRecoveryQueue(null);

    render(<App />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('prism-toast', {
        detail: {
          tone: 'success',
          title: 'PDF 导出完成',
          message: 'report.pdf',
          actions: [{ label: '打开', onClick: onOpen }],
          durationMs: null,
        },
      }));
    });

    expect(screen.getByRole('status')).toHaveTextContent('PDF 导出完成');
    expect(screen.getByRole('status')).toHaveTextContent('report.pdf');

    fireEvent.click(screen.getByRole('button', { name: '打开' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText('PDF 导出完成')).not.toBeInTheDocument();
    });
  });
});
