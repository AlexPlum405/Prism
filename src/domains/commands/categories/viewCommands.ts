import type { CommandContext, CommandDefinition } from '../types';

interface ViewCommandDeps {
  hasDocument: (context: CommandContext) => boolean;
  handleZoom: (direction: 'in' | 'out' | 'reset', context: CommandContext) => Promise<void>;
  handleDevTools: (context: CommandContext) => Promise<void>;
}

export function createViewCommands(deps: ViewCommandDeps): CommandDefinition[] {
  const { hasDocument, handleZoom, handleDevTools } = deps;

  return [
    {
      id: 'sourceMode',
      category: 'view',
      keywords: ['edit', 'source'],
      shortcuts: [{ code: 'Slash', mod: true }],
      enabled: hasDocument,
      checked: (context) => context.documentStore.currentDocument?.viewMode === 'edit',
      run: (context) => context.documentStore.setViewMode('edit'),
    },
    {
      id: 'splitMode',
      category: 'view',
      keywords: ['split'],
      enabled: hasDocument,
      checked: (context) => context.documentStore.currentDocument?.viewMode === 'split',
      run: (context) => context.documentStore.setViewMode('split'),
    },
    {
      id: 'previewMode',
      category: 'view',
      keywords: ['preview'],
      enabled: hasDocument,
      checked: (context) => context.documentStore.currentDocument?.viewMode === 'preview',
      run: (context) => context.documentStore.setViewMode('preview'),
    },
    {
      id: 'toggleSidebar',
      category: 'view',
      keywords: ['sidebar'],
      shortcuts: [{ code: 'KeyL', mod: true, shift: true }],
      checked: (context) => context.workspaceStore.sidebarVisible,
      run: (context) => context.workspaceStore.toggleSidebar(),
    },
    {
      id: 'showFiles',
      category: 'view',
      keywords: ['files'],
      checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'files',
      run: (context) => context.workspaceStore.setSidebarTab('files'),
    },
    {
      id: 'showDocs',
      category: 'view',
      palette: false,
      checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'files',
      run: (context) => context.workspaceStore.setSidebarTab('files'),
    },
    {
      id: 'showOutline',
      category: 'view',
      keywords: ['outline'],
      checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'outline',
      run: (context) => context.workspaceStore.setSidebarTab('outline'),
    },
    {
      id: 'focusMode',
      category: 'view',
      keywords: ['focus'],
      shortcuts: [{ code: 'F8' }],
      checked: (context) => context.workspaceStore.focusMode,
      run: (context) => context.workspaceStore.toggleFocusMode(),
    },
    {
      id: 'typewriterMode',
      category: 'view',
      keywords: ['typewriter'],
      shortcuts: [{ code: 'F9' }],
      checked: (context) => context.workspaceStore.typewriterMode,
      run: (context) => context.workspaceStore.toggleTypewriterMode(),
    },
    {
      id: 'wordWrap',
      category: 'view',
      keywords: ['wrap', 'line wrap'],
      checked: (context) => context.settingsStore.wordWrap,
      run: (context) => context.settingsStore.setWordWrap(!context.settingsStore.wordWrap),
    },
    {
      id: 'statusBar',
      category: 'view',
      keywords: ['status'],
      checked: (context) => context.workspaceStore.statusBarVisible,
      run: (context) => context.workspaceStore.toggleStatusBar(),
    },
    {
      id: 'actualSize',
      category: 'view',
      keywords: ['zoom', 'reset'],
      shortcuts: [{ code: 'Digit9', mod: true, shift: true }],
      run: (context) => handleZoom('reset', context),
    },
    {
      id: 'zoomIn',
      category: 'view',
      keywords: ['zoom', 'in'],
      shortcuts: [{ code: 'Equal', mod: true, shift: true }],
      run: (context) => handleZoom('in', context),
    },
    {
      id: 'zoomOut',
      category: 'view',
      keywords: ['zoom', 'out'],
      shortcuts: [{ code: 'Minus', mod: true, shift: true }],
      run: (context) => handleZoom('out', context),
    },
    {
      id: 'devTools',
      category: 'view',
      keywords: ['dev', 'debug'],
      shortcuts: [{ code: 'F12', shift: true }],
      run: handleDevTools,
    },
  ] satisfies CommandDefinition[];
}
