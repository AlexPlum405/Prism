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
      category: 'window',
      shortcuts: [{ code: 'KeyM', mod: true }],
      run: minimize,
    },
    {
      id: 'fullscreen',
      category: 'window',
      shortcuts: [{ code: 'F11' }],
      checked: (context) => context.workspaceStore.isFullscreen,
      run: handleFullscreen,
    },
    {
      id: 'alwaysOnTop',
      category: 'window',
      keywords: ['top', 'pin'],
      checked: (context) => context.workspaceStore.isAlwaysOnTop,
      run: handleAlwaysOnTop,
    },
  ] satisfies CommandDefinition[];
}
