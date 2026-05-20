import type { MenuItem, MenuSection } from '../../components/shell/types';
import type { CommandContext, CommandId } from './types';
import {
  getCommandDefinition,
  getPrimaryShortcutLabel,
  isCommandEnabled,
} from './registry';
import type { ShortcutDisplayStyle } from './platform';
import { getAvailableThemeEntries } from '../themes';
import { getLocalizedCommandLabel, t } from '../i18n';

type MenuModelItem =
  | { type: 'separator' }
  | { command: CommandId; label?: string; hidden?: (context: CommandContext) => boolean }
  | { label: string; children: MenuModelItem[]; hidden?: (context: CommandContext) => boolean }
  | { dynamic: (context: CommandContext) => MenuItem[] };

type MenuModel = Record<string, MenuModelItem[]>;

const menuLabelKeys = {
  file: 'menu.file',
  edit: 'menu.edit',
  insert: 'menu.insert',
  format: 'menu.format',
  view: 'menu.view',
  theme: 'menu.theme',
  window: 'menu.window',
  help: 'menu.help',
  templates: 'menu.templates',
  openRecent: 'menu.openRecent',
  export: 'menu.export',
  findReplace: 'menu.findReplace',
  copyAs: 'menu.copyAs',
  plainText: 'menu.plainText',
  table: 'menu.table',
  paragraphStyle: 'menu.paragraphStyle',
  headingLevel: 'menu.headingLevel',
  blockOperations: 'menu.blockOperations',
  documentInfo: 'menu.documentInfo',
  sidebar: 'menu.sidebar',
} as const;

function localizeMenuLabel(label: string) {
  const key = menuLabelKeys[label as keyof typeof menuLabelKeys];
  return key ? t(key) : label;
}

const menuModel: MenuModel = {
  file: [
    { command: 'new' },
    { command: 'newWindow' },
    {
      label: 'templates',
      children: [
        { command: 'templateReadme' },
        { command: 'templatePrd' },
        { command: 'templateMeeting' },
        { command: 'templateWeekly' },
        { command: 'templateTechnicalPlan' },
        { command: 'templateArticle' },
        { type: 'separator' },
        { command: 'templatePaperDraft' },
        { command: 'templateReadingNote' },
        { command: 'templateResearchSummary' },
        { command: 'templateWhitePaper' },
      ],
    },
    { type: 'separator' },
    { command: 'open' },
    { command: 'openFolder' },
    { command: 'quickOpen' },
    {
      label: 'openRecent',
      children: [
        {
          dynamic: (context) => {
            const recentFiles = context.settingsStore.recentFiles.slice(0, 10);
            if (recentFiles.length === 0) {
              return [{ label: t('menu.noRecent'), disabled: true }];
            }

            return recentFiles.map((file) => ({
              label: file.name,
              action: `openRecentFile:${encodeURIComponent(file.path)}`,
            }));
          },
        },
      ],
    },
    { type: 'separator' },
    { command: 'save' },
    { command: 'saveAs' },
    { command: 'openCurrentLocation' },
    { type: 'separator' },
    { command: 'preferences' },
    { type: 'separator' },
    {
      label: 'export',
      children: [
        { command: 'exportWithPrevious' },
        { command: 'exportOverwritePrevious' },
        { type: 'separator' },
        { command: 'exportPdf' },
        { command: 'exportDocx' },
        { command: 'exportHtml' },
        { command: 'exportPng' },
      ],
    },
    { type: 'separator' },
    { command: 'closeDocument' },
  ],
  edit: [
    { command: 'undo' },
    { command: 'redo' },
    { type: 'separator' },
    { command: 'cut' },
    { command: 'copy' },
    { command: 'paste' },
    { command: 'pastePlain' },
    { type: 'separator' },
    { command: 'selectAll' },
    { type: 'separator' },
    {
      label: 'findReplace',
      children: [
        { command: 'showSearch' },
        { command: 'showReplace' },
        { command: 'workspaceSearch' },
      ],
    },
    {
      label: 'copyAs',
      children: [
        { command: 'copyPlain', label: 'plainText' },
        { command: 'copyMd', label: 'Markdown' },
        { command: 'copyHtml', label: 'HTML' },
      ],
    },
  ],
  insert: [
    { command: 'link' },
    { type: 'separator' },
    { command: 'codeBlock' },
    { command: 'mathBlock' },
    { command: 'quote' },
    { type: 'separator' },
    { command: 'orderedList' },
    { command: 'unorderedList' },
    { command: 'taskList' },
    { type: 'separator' },
    {
      label: 'table',
      children: [
        { command: 'insertTable' },
        { command: 'formatTable' },
        { command: 'selectTable' },
        { type: 'separator' },
        { command: 'addTableRow' },
        { command: 'addTableColumn' },
        { command: 'insertTableRowAbove' },
        { command: 'insertTableRowBelow' },
        { command: 'insertTableColumnLeft' },
        { command: 'insertTableColumnRight' },
        { command: 'deleteTableRow' },
        { command: 'deleteTableColumn' },
        { command: 'moveTableRowUp' },
        { command: 'moveTableRowDown' },
        { command: 'moveTableColumnLeft' },
        { command: 'moveTableColumnRight' },
        { type: 'separator' },
        { command: 'alignTableColumnLeft' },
        { command: 'alignTableColumnCenter' },
        { command: 'alignTableColumnRight' },
        { command: 'sortTableAsc' },
        { command: 'sortTableDesc' },
        { type: 'separator' },
        { command: 'copyTableMarkdown' },
        { command: 'copyTableHtml' },
        { command: 'copyTableCsv' },
        { command: 'copyTableTsv' },
        { type: 'separator' },
        { command: 'convertTableToHtml' },
        { command: 'convertHtmlTableToMarkdown' },
      ],
    },
    { type: 'separator' },
    { command: 'hr' },
    { command: 'footnote' },
    { command: 'linkReference' },
    { command: 'toc' },
    { command: 'yaml' },
  ],
  format: [
    { command: 'bold' },
    { command: 'italic' },
    { command: 'underline' },
    { command: 'strikethrough' },
    { command: 'inlineCode' },
    { type: 'separator' },
    {
      label: 'paragraphStyle',
      children: [
        { command: 'paragraph' },
        { command: 'h1' },
        { command: 'h2' },
        { command: 'h3' },
        { command: 'h4' },
        { command: 'h5' },
        { command: 'h6' },
      ],
    },
    {
      label: 'headingLevel',
      children: [
        { command: 'increaseHeading' },
        { command: 'decreaseHeading' },
      ],
    },
    {
      label: 'blockOperations',
      children: [
        { command: 'moveParagraphUp' },
        { command: 'moveParagraphDown' },
        { command: 'duplicateParagraph' },
        { command: 'deleteParagraph' },
        { command: 'moveSectionUp' },
        { command: 'moveSectionDown' },
        { command: 'duplicateSection' },
        { command: 'foldCurrentHeading' },
        { type: 'separator' },
        { command: 'selectionQuote' },
        { command: 'selectionCalloutNote' },
        { command: 'selectionCalloutWarning' },
        { command: 'selectionCalloutTip' },
        { command: 'selectionUnorderedList' },
        { command: 'selectionOrderedList' },
        { command: 'selectionTaskList' },
      ],
    },
    { type: 'separator' },
    { command: 'clearFormat' },
  ],
  view: [
    { command: 'sourceMode' },
    { command: 'splitMode' },
    { command: 'previewMode' },
    { type: 'separator' },
    {
      label: 'documentInfo',
      children: [
        { command: 'openDocumentProperties' },
        { command: 'showDocumentLinks' },
        { command: 'showBacklinks' },
        { command: 'showRelationGraph' },
      ],
    },
    { type: 'separator' },
    { command: 'toggleSidebar' },
    {
      label: 'sidebar',
      children: [
        { command: 'showFiles' },
        { command: 'showOutline' },
      ],
    },
    { type: 'separator' },
    { command: 'focusMode' },
    { command: 'typewriterMode' },
    { command: 'wordWrap' },
    { command: 'statusBar' },
    { type: 'separator' },
    { command: 'actualSize' },
    { command: 'zoomIn' },
    { command: 'zoomOut' },
    { type: 'separator' },
    { command: 'devTools' },
  ],
  theme: [
    {
      dynamic: (context) => getAvailableThemeEntries().map((theme) => ({
        label: theme.source === 'user' ? `${theme.label}` : theme.label,
        action: `setTheme:${encodeURIComponent(theme.id)}`,
        checked: context.settingsStore.contentTheme === theme.id,
      })),
    },
  ],
  window: [
    { command: 'minimize' },
    { command: 'fullscreen' },
    { command: 'alwaysOnTop' },
    { type: 'separator' },
    { command: 'newWindow' },
  ],
  help: [
    { command: 'showShortcuts' },
    { command: 'checkUpdate' },
    { type: 'separator' },
    { command: 'mdReference' },
    { command: 'github' },
    { command: 'feedback' },
    { type: 'separator' },
    { command: 'about' },
  ],
};

function normalizeItems(items: MenuItem[]): MenuItem[] {
  const visibleItems = items.filter((item) => {
    if (item.type === 'separator') return true;
    return !item.hidden;
  });

  return visibleItems.filter((item, index, source) => {
    if (item.type !== 'separator') return true;
    if (index === 0 || index === source.length - 1) return false;
    return source[index - 1]?.type !== 'separator';
  });
}

function toMenuItem(
  item: MenuModelItem,
  context: CommandContext,
  displayStyle: ShortcutDisplayStyle,
): MenuItem | null {
  if ('dynamic' in item) return null;
  if ('hidden' in item && item.hidden?.(context)) return null;
  if ('type' in item && item.type === 'separator') return { type: 'separator' };

  if ('children' in item) {
    const children = normalizeItems(
      item.children
        .flatMap((child) => {
          if ('dynamic' in child) return child.dynamic(context);
          const menuItem = toMenuItem(child, context, displayStyle);
          return menuItem ? [menuItem] : [];
        }),
    );

    if (!children.length) return null;

    return {
      label: localizeMenuLabel(item.label),
      submenu: true,
      children,
    };
  }

  if (!('command' in item)) return null;

  const definition = getCommandDefinition(item.command);
  return {
    label: item.label ? localizeMenuLabel(item.label) : getLocalizedCommandLabel(definition.id),
    action: definition.id,
    shortcut: getPrimaryShortcutLabel(definition.id, displayStyle),
    checked: definition.checked?.(context) ?? false,
    disabled: !isCommandEnabled(definition.id, context),
  };
}

export function getMenuSections(context: CommandContext): MenuSection {
  const displayStyle = context.settingsStore.shortcutStyle;

  return Object.fromEntries(
    Object.entries(menuModel).map(([section, items]) => [
      localizeMenuLabel(section),
      normalizeItems(
        items
          .flatMap((item) => {
            if ('dynamic' in item) return item.dynamic(context);
            const menuItem = toMenuItem(item, context, displayStyle);
            return menuItem ? [menuItem] : [];
          })
          .filter((item): item is MenuItem => Boolean(item)),
      ),
    ]),
  );
}

export function getCommandMenuItems(ids: CommandId[], context: CommandContext): MenuItem[] {
  const displayStyle = context.settingsStore.shortcutStyle;

  return normalizeItems(
    ids.map((id) => toMenuItem({ command: id }, context, displayStyle)).filter((item): item is MenuItem => Boolean(item)),
  );
}
