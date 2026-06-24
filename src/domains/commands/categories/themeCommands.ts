import type { CommandDefinition } from '../types';

export function createThemeCommands(): CommandDefinition[] {
  return [
    {
      id: 'themeMiaoyan',
      category: 'theme',
      checked: (context) => context.settingsStore.contentTheme === 'miaoyan',
      run: (context) => context.settingsStore.setContentTheme('miaoyan'),
    },
    {
      id: 'themeInkstone',
      category: 'theme',
      checked: (context) => context.settingsStore.contentTheme === 'inkstone',
      run: (context) => context.settingsStore.setContentTheme('inkstone'),
    },
    {
      id: 'themeSlate',
      category: 'theme',
      checked: (context) => context.settingsStore.contentTheme === 'slate',
      run: (context) => context.settingsStore.setContentTheme('slate'),
    },
    {
      id: 'themeMono',
      category: 'theme',
      checked: (context) => context.settingsStore.contentTheme === 'mono',
      run: (context) => context.settingsStore.setContentTheme('mono'),
    },
    {
      id: 'themeNocturne',
      category: 'theme',
      checked: (context) => context.settingsStore.contentTheme === 'nocturne',
      run: (context) => context.settingsStore.setContentTheme('nocturne'),
    },
    {
      id: 'themeCarbon',
      category: 'theme',
      checked: (context) => context.settingsStore.contentTheme === 'carbon',
      run: (context) => context.settingsStore.setContentTheme('carbon'),
    },
  ] satisfies CommandDefinition[];
}
