import type { CommandContext, CommandDefinition, CommandId } from '../types';

interface HelpCommandDeps {
  handleHelpLink: (command: CommandId) => Promise<void>;
  handleCheckUpdate: (context: CommandContext) => Promise<void>;
}

export function createHelpCommands(deps: HelpCommandDeps): CommandDefinition[] {
  const { handleHelpLink, handleCheckUpdate } = deps;

  return [
    {
      id: 'preferences',
      category: 'file',
      shortcuts: [{ code: 'Comma', mod: true }],
      run: (context) => context.openSettings?.(),
    },
    {
      id: 'mdReference',
      category: 'help',
      run: () => handleHelpLink('mdReference'),
    },
    {
      id: 'migrationGuide',
      category: 'help',
      keywords: ['migration', 'typora', 'miaoyan', 'marktext'],
      run: () => handleHelpLink('migrationGuide'),
    },
    {
      id: 'showShortcuts',
      category: 'help',
      keywords: ['shortcut', 'keyboard'],
      run: (context) => context.openShortcuts?.(),
    },
    {
      id: 'checkUpdate',
      category: 'help',
      keywords: ['update', 'release', 'version'],
      run: handleCheckUpdate,
    },
    {
      id: 'github',
      category: 'help',
      keywords: ['github'],
      run: () => handleHelpLink('github'),
    },
    {
      id: 'feedback',
      category: 'help',
      keywords: ['feedback', 'issue'],
      run: () => handleHelpLink('feedback'),
    },
    {
      id: 'about',
      category: 'help',
      keywords: ['about', 'info'],
      run: (context) => context.openAbout?.(),
    },
  ] satisfies CommandDefinition[];
}
