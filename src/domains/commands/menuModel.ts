import type { MenuItem, MenuSection } from '../../components/shell/types';
import type { CommandContext, CommandId } from './types';
import {
  getCommandDefinition,
  getPrimaryShortcutLabel,
  isCommandEnabled,
} from './registry';
import type { ShortcutDisplayStyle } from './platform';

type MenuModelItem =
  | { type: 'separator' }
  | { command: CommandId; label?: string; hidden?: (context: CommandContext) => boolean }
  | { label: string; children: MenuModelItem[]; hidden?: (context: CommandContext) => boolean }
  | { dynamic: (context: CommandContext) => MenuItem[] };

type MenuModel = Record<string, MenuModelItem[]>;

const menuModel: MenuModel = {
  '文件': [
    { command: 'new' },
    { command: 'newWindow' },
    {
      label: '模板',
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
      label: '打开最近文档',
      children: [
        {
          dynamic: (context) => {
            const recentFiles = context.settingsStore.recentFiles.slice(0, 10);
            if (recentFiles.length === 0) {
              return [{ label: '无最近文档', disabled: true }];
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
      label: '导出',
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
  '编辑': [
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
      label: '查找与替换',
      children: [
        { command: 'showSearch' },
        { command: 'showReplace' },
      ],
    },
    {
      label: '复制为',
      children: [
        { command: 'copyPlain', label: '纯文本' },
        { command: 'copyMd', label: 'Markdown' },
        { command: 'copyHtml', label: 'HTML' },
      ],
    },
  ],
  '插入': [
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
      label: '表格',
      children: [
        { command: 'insertTable' },
        { command: 'formatTable' },
        { command: 'addTableRow' },
        { command: 'addTableColumn' },
        { command: 'deleteTableRow' },
        { command: 'deleteTableColumn' },
      ],
    },
    { type: 'separator' },
    { command: 'hr' },
    { command: 'footnote' },
    { command: 'linkReference' },
    { command: 'toc' },
    { command: 'yaml' },
  ],
  '格式': [
    { command: 'bold' },
    { command: 'italic' },
    { command: 'underline' },
    { command: 'strikethrough' },
    { command: 'inlineCode' },
    { type: 'separator' },
    {
      label: '段落样式',
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
      label: '标题级别',
      children: [
        { command: 'increaseHeading' },
        { command: 'decreaseHeading' },
      ],
    },
    {
      label: '块级源码操作',
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
  '视图': [
    { command: 'sourceMode' },
    { command: 'splitMode' },
    { command: 'previewMode' },
    { type: 'separator' },
    { command: 'toggleSidebar' },
    {
      label: '侧边栏',
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
  '主题': [
    { command: 'themeMiaoyan' },
    { command: 'themeInkstone' },
    { command: 'themeSlate' },
    { command: 'themeMono' },
    { command: 'themeNocturne' },
  ],
  '窗口': [
    { command: 'minimize' },
    { command: 'fullscreen' },
    { command: 'alwaysOnTop' },
    { type: 'separator' },
    { command: 'newWindow' },
  ],
  '帮助': [
    { command: 'commandPalette' },
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
      label: item.label,
      submenu: true,
      children,
    };
  }

  if (!('command' in item)) return null;

  const definition = getCommandDefinition(item.command);
  return {
    label: item.label ?? definition.label,
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
      section,
      normalizeItems(
        items
          .map((item) => toMenuItem(item, context, displayStyle))
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
