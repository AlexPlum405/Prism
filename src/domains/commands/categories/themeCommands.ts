import type { CommandDefinition } from '../types';

export function createThemeCommands(): CommandDefinition[] {
  return [
    {
      id: 'themeMiaoyan',
      label: 'MiaoYan（妙言）',
      category: '主题',
      checked: (context) => context.settingsStore.contentTheme === 'miaoyan',
      run: (context) => context.settingsStore.setContentTheme('miaoyan'),
    },
    {
      id: 'themeInkstone',
      label: 'Inkstone Light',
      category: '主题',
      checked: (context) => context.settingsStore.contentTheme === 'inkstone',
      run: (context) => context.settingsStore.setContentTheme('inkstone'),
    },
    {
      id: 'themeSlate',
      label: 'Slate Manual',
      category: '主题',
      checked: (context) => context.settingsStore.contentTheme === 'slate',
      run: (context) => context.settingsStore.setContentTheme('slate'),
    },
    {
      id: 'themeMono',
      label: 'Mono Lab',
      category: '主题',
      checked: (context) => context.settingsStore.contentTheme === 'mono',
      run: (context) => context.settingsStore.setContentTheme('mono'),
    },
    {
      id: 'themeNocturne',
      label: 'Nocturne Dark',
      category: '主题',
      checked: (context) => context.settingsStore.contentTheme === 'nocturne',
      run: (context) => context.settingsStore.setContentTheme('nocturne'),
    },
  ] satisfies CommandDefinition[];
}
