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
import {
  getSlashSnippetLabel,
  SLASH_SNIPPET_COMMAND_ORDER,
} from '../editor/extensions/slashSnippets';

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
  navigation: 'menu.navigation',
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
  pastePlainText: 'menu.pastePlainText',
  table: 'menu.table',
  heading: 'menu.heading',
  paragraphStyle: 'menu.paragraphStyle',
  headingLevel: 'menu.headingLevel',
  blockOperations: 'menu.blockOperations',
  selectionTransform: 'menu.selectionTransform',
  tabSnippets: 'menu.tabSnippets',
  toQuote: 'menu.toQuote',
  toTaskList: 'menu.toTaskList',
  toCallout: 'menu.toCallout',
  exportWithPrevious: 'menu.exportWithPrevious',
  exportOverwritePrevious: 'menu.exportOverwritePrevious',
  documentInfo: 'menu.documentInfo',
  sidebar: 'menu.sidebar',
} as const;

function localizeMenuLabel(label: string) {
  const key = menuLabelKeys[label as keyof typeof menuLabelKeys];
  return key ? t(key) : label;
}

function getCommandDisabledReason(command: CommandId, context: CommandContext): string | undefined {
  const currentDocument = context.documentStore.currentDocument;
  const isExportCommand = command === 'exportPdf'
    || command === 'exportDocx'
    || command === 'exportHtml'
    || command === 'exportPng';
  const isPreviousExportCommand = command === 'exportWithPrevious'
    || command === 'exportOverwritePrevious';

  if (!isExportCommand && !isPreviousExportCommand) return undefined;

  if (!currentDocument) return t('menu.disabled.noDocumentForExport');
  if (currentDocument.profile?.supportsExport === false) return t('menu.disabled.markdownExportOnly');
  if (isPreviousExportCommand) return t('menu.disabled.noPreviousExport');

  return undefined;
}

const menuModel: MenuModel = {
  file: [
    { command: 'new' },
    { type: 'separator' },
    { command: 'open' },
    { command: 'openFolder' },
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
    { command: 'fileProperties' },
    { type: 'separator' },
    { command: 'preferences' },
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
    { command: 'pastePlain', label: 'pastePlainText' },
    { type: 'separator' },
    { command: 'selectAll' },
    { type: 'separator' },
    { command: 'showSearch' },
    { command: 'showReplace' },
    { command: 'workspaceSearch' },
    { type: 'separator' },
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
    { command: 'insertImage' },
    { command: 'insertTable', label: 'table' },
    { type: 'separator' },
    { command: 'codeBlock' },
    { command: 'mathBlock' },
    { command: 'quote' },
    { command: 'insertCallout' },
    { command: 'insertToggle' },
    { type: 'separator' },
    { command: 'hr' },
    { command: 'footnote' },
    { command: 'toc' },
    { command: 'yaml' },
    { type: 'separator' },
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
  ],
  format: [
    { command: 'bold' },
    { command: 'italic' },
    { command: 'underline' },
    { command: 'strikethrough' },
    { command: 'inlineCode' },
    { type: 'separator' },
    { command: 'paragraph', label: 'paragraphStyle' },
    {
      label: 'heading',
      children: [
        { command: 'h1' },
        { command: 'h2' },
        { command: 'h3' },
        { command: 'h4' },
        { command: 'h5' },
        { command: 'h6' },
      ],
    },
    { command: 'increaseHeading' },
    { command: 'decreaseHeading' },
    { type: 'separator' },
    { command: 'selectionQuote', label: 'toQuote' },
    { command: 'selectionTaskList', label: 'toTaskList' },
    { command: 'selectionCallout', label: 'toCallout' },
    {
      label: 'tabSnippets',
      children: [
        {
          dynamic: (context) => {
            const disabled = !context.documentStore.currentDocument
              || context.documentStore.currentDocument.profile?.kind === 'text';
            return SLASH_SNIPPET_COMMAND_ORDER.map((command) => ({
              label: `/${command} · ${getSlashSnippetLabel(command)}`,
              action: `insertSlashSnippet:${command}`,
              disabled,
            }));
          },
        },
      ],
    },
    { type: 'separator' },
    { command: 'clearFormat' },
    { command: 'autoFormat' },
  ],
  navigation: [
    { command: 'quickOpen' },
    { command: 'workspaceSearch' },
    { type: 'separator' },
    { command: 'openDocumentProperties' },
    { command: 'showDocumentLinks' },
    { command: 'showBacklinks' },
    { command: 'showRelationGraph' },
    { command: 'showOutline' },
  ],
  view: [
    { command: 'sourceMode' },
    { command: 'splitMode' },
    { command: 'previewMode' },
    { command: 'presentationMode' },
    { type: 'separator' },
    { command: 'toggleSidebar' },
    { command: 'showFiles' },
    { command: 'showOutline' },
    { type: 'separator' },
    { command: 'focusMode' },
    { command: 'typewriterMode' },
    { command: 'wordWrap' },
    { command: 'statusBar' },
    { type: 'separator' },
    {
      label: 'theme',
      children: [
        {
          dynamic: (context) => getAvailableThemeEntries().map((theme) => ({
            label: theme.source === 'user' ? `${theme.label}` : theme.label,
            action: `setTheme:${encodeURIComponent(theme.id)}`,
            checked: context.settingsStore.contentTheme === theme.id,
          })),
        },
      ],
    },
    { type: 'separator' },
    { command: 'actualSize' },
    { command: 'zoomIn' },
    { command: 'zoomOut' },
  ],
  export: [
    { command: 'exportWithPrevious', label: 'exportWithPrevious' },
    { command: 'exportOverwritePrevious', label: 'exportOverwritePrevious' },
    { type: 'separator' },
    { command: 'exportPdf' },
    { command: 'exportDocx' },
    { command: 'exportHtml' },
    { command: 'exportPng' },
    { type: 'separator' },
    { command: 'exportSettings' },
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
    { command: 'mdReference' },
    { command: 'migrationGuide' },
    { command: 'checkUpdate' },
    { type: 'separator' },
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
  const disabled = !isCommandEnabled(definition.id, context);
  return {
    label: item.label ? localizeMenuLabel(item.label) : getLocalizedCommandLabel(definition.id),
    action: definition.id,
    shortcut: getPrimaryShortcutLabel(definition.id, displayStyle),
    checked: definition.checked?.(context) ?? false,
    disabled,
    disabledReason: disabled ? getCommandDisabledReason(definition.id, context) : undefined,
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
