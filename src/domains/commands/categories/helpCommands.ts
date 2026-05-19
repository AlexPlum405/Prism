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
      label: '设置中心',
      category: '文件',
      shortcuts: [{ code: 'Comma', mod: true }],
      run: (context) => context.openSettings?.(),
    },
    {
      id: 'mdReference',
      label: 'Markdown 参考',
      category: '帮助',
      run: () => handleHelpLink('mdReference'),
    },
    {
      id: 'showShortcuts',
      label: '键盘快捷键',
      category: '帮助',
      keywords: ['shortcut', 'keyboard'],
      run: (context) => context.openShortcuts?.(),
    },
    {
      id: 'checkUpdate',
      label: '检查更新',
      category: '帮助',
      keywords: ['update', 'release', 'version'],
      run: handleCheckUpdate,
    },
    {
      id: 'github',
      label: 'GitHub 仓库',
      category: '帮助',
      keywords: ['github'],
      run: () => handleHelpLink('github'),
    },
    {
      id: 'feedback',
      label: '反馈问题',
      category: '帮助',
      keywords: ['feedback', 'issue'],
      run: () => handleHelpLink('feedback'),
    },
    {
      id: 'about',
      label: '关于 Prism',
      category: '帮助',
      keywords: ['about', 'info'],
      run: (context) => context.openAbout?.(),
    },
  ] satisfies CommandDefinition[];
}
