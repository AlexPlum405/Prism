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
      label: '编辑模式',
      category: '视图',
      keywords: ['edit', 'source'],
      shortcuts: [{ code: 'Slash', mod: true }],
      enabled: hasDocument,
      checked: (context) => context.documentStore.currentDocument?.viewMode === 'edit',
      run: (context) => context.documentStore.setViewMode('edit'),
    },
    {
      id: 'splitMode',
      label: '分栏模式',
      category: '视图',
      keywords: ['split'],
      enabled: hasDocument,
      checked: (context) => context.documentStore.currentDocument?.viewMode === 'split',
      run: (context) => context.documentStore.setViewMode('split'),
    },
    {
      id: 'previewMode',
      label: '预览模式',
      category: '视图',
      keywords: ['preview'],
      enabled: hasDocument,
      checked: (context) => context.documentStore.currentDocument?.viewMode === 'preview',
      run: (context) => context.documentStore.setViewMode('preview'),
    },
    {
      id: 'toggleSidebar',
      label: '显示侧边栏',
      category: '视图',
      keywords: ['sidebar'],
      shortcuts: [{ code: 'KeyL', mod: true, shift: true }],
      checked: (context) => context.workspaceStore.sidebarVisible,
      run: (context) => context.workspaceStore.toggleSidebar(),
    },
    {
      id: 'showFiles',
      label: '文件',
      category: '视图',
      keywords: ['files'],
      checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'files',
      run: (context) => context.workspaceStore.setSidebarTab('files'),
    },
    {
      id: 'showDocs',
      label: '文件',
      category: '视图',
      palette: false,
      checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'files',
      run: (context) => context.workspaceStore.setSidebarTab('files'),
    },
    {
      id: 'showOutline',
      label: '大纲',
      category: '视图',
      keywords: ['outline'],
      checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'outline',
      run: (context) => context.workspaceStore.setSidebarTab('outline'),
    },
    {
      id: 'focusMode',
      label: '专注模式',
      category: '视图',
      keywords: ['focus'],
      shortcuts: [{ code: 'F8' }],
      checked: (context) => context.workspaceStore.focusMode,
      run: (context) => context.workspaceStore.toggleFocusMode(),
    },
    {
      id: 'typewriterMode',
      label: '打字机模式',
      category: '视图',
      keywords: ['typewriter'],
      shortcuts: [{ code: 'F9' }],
      checked: (context) => context.workspaceStore.typewriterMode,
      run: (context) => context.workspaceStore.toggleTypewriterMode(),
    },
    {
      id: 'wordWrap',
      label: '自动换行',
      category: '视图',
      keywords: ['wrap', 'line wrap'],
      checked: (context) => context.settingsStore.wordWrap,
      run: (context) => context.settingsStore.setWordWrap(!context.settingsStore.wordWrap),
    },
    {
      id: 'statusBar',
      label: '显示状态栏',
      category: '视图',
      keywords: ['status'],
      checked: (context) => context.workspaceStore.statusBarVisible,
      run: (context) => context.workspaceStore.toggleStatusBar(),
    },
    {
      id: 'actualSize',
      label: '实际大小',
      category: '视图',
      keywords: ['zoom', 'reset'],
      shortcuts: [{ code: 'Digit9', mod: true, shift: true }],
      run: (context) => handleZoom('reset', context),
    },
    {
      id: 'zoomIn',
      label: '放大',
      category: '视图',
      keywords: ['zoom', 'in'],
      shortcuts: [{ code: 'Equal', mod: true, shift: true }],
      run: (context) => handleZoom('in', context),
    },
    {
      id: 'zoomOut',
      label: '缩小',
      category: '视图',
      keywords: ['zoom', 'out'],
      shortcuts: [{ code: 'Minus', mod: true, shift: true }],
      run: (context) => handleZoom('out', context),
    },
    {
      id: 'devTools',
      label: '开发者工具',
      category: '视图',
      keywords: ['dev', 'debug'],
      shortcuts: [{ code: 'F12', shift: true }],
      run: handleDevTools,
    },
  ] satisfies CommandDefinition[];
}
