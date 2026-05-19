import type { CommandContext, CommandDefinition } from '../types';

interface WindowCommandDeps {
  handleFullscreen: (context: CommandContext) => Promise<void>;
  handleAlwaysOnTop: (context: CommandContext) => Promise<void>;
  minimize: () => Promise<void>;
}

export function createWindowCommands(deps: WindowCommandDeps): CommandDefinition[] {
  const { handleFullscreen, handleAlwaysOnTop, minimize } = deps;

  return [
    {
      id: 'minimize',
      label: '最小化',
      category: '窗口',
      shortcuts: [{ code: 'KeyM', mod: true }],
      run: minimize,
    },
    {
      id: 'fullscreen',
      label: '切换全屏',
      category: '窗口',
      shortcuts: [{ code: 'F11' }],
      checked: (context) => context.workspaceStore.isFullscreen,
      run: handleFullscreen,
    },
    {
      id: 'alwaysOnTop',
      label: '保持窗口在最前端',
      category: '窗口',
      keywords: ['top', 'pin'],
      checked: (context) => context.workspaceStore.isAlwaysOnTop,
      run: handleAlwaysOnTop,
    },
  ] satisfies CommandDefinition[];
}
