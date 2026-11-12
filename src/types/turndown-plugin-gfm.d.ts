declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';

  /** gfm 插件注册的规则组：tables / strikethrough / taskListItems */
  export const gfm: TurndownService.Plugin;
  export const tables: TurndownService.Plugin;
  export const strikethrough: TurndownService.Plugin;
  export const taskListItems: TurndownService.Plugin;
  export const highlightedCodeBlock: TurndownService.Plugin;
}
