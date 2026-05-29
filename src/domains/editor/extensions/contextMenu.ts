import type { ContextMenuItem } from '../../../components/shell/ContextMenu';
import {
  getPrimaryShortcutLabel,
  type CommandContext,
  type CommandId,
} from '../../commands';
import { getLocalizedCommandLabel, t } from '../../i18n';

function commandItem(
  id: CommandId,
  shortcutStyle: CommandContext['settingsStore']['shortcutStyle'],
  options: { danger?: boolean; disabled?: boolean; label?: string } = {},
): ContextMenuItem {
  return {
    label: options.label ?? getLocalizedCommandLabel(id),
    action: id,
    shortcut: getPrimaryShortcutLabel(id, shortcutStyle),
    danger: options.danger,
    disabled: options.disabled,
  };
}

export function getEditorContextMenuItems(
  hasSelection: boolean,
  shortcutStyle: CommandContext['settingsStore']['shortcutStyle'],
  isInTable = false,
): ContextMenuItem[] {
  return [
    commandItem('cut', shortcutStyle, { disabled: !hasSelection }),
    commandItem('copy', shortcutStyle, { disabled: !hasSelection }),
    commandItem('paste', shortcutStyle),
    commandItem('pastePlain', shortcutStyle),
    { type: 'separator' },
    commandItem('bold', shortcutStyle),
    commandItem('italic', shortcutStyle),
    commandItem('underline', shortcutStyle),
    commandItem('strikethrough', shortcutStyle),
    { type: 'separator' },
    {
      label: t('menu.blockOperations'),
      children: [
        commandItem('moveParagraphUp', shortcutStyle),
        commandItem('moveParagraphDown', shortcutStyle),
        commandItem('duplicateParagraph', shortcutStyle),
        commandItem('deleteParagraph', shortcutStyle, { danger: true }),
        { type: 'separator' },
        commandItem('selectionQuote', shortcutStyle),
        commandItem('selectionCalloutNote', shortcutStyle),
        commandItem('selectionCalloutWarning', shortcutStyle),
        commandItem('selectionCalloutTip', shortcutStyle),
        commandItem('selectionCalloutImportant', shortcutStyle),
        commandItem('selectionTaskList', shortcutStyle),
        { type: 'separator' },
        commandItem('duplicateSection', shortcutStyle),
        commandItem('foldCurrentHeading', shortcutStyle),
      ],
    },
    ...(isInTable ? [{
      label: t('menu.table'),
      children: [
        commandItem('insertTableRowAbove', shortcutStyle),
        commandItem('insertTableRowBelow', shortcutStyle),
        commandItem('insertTableColumnLeft', shortcutStyle),
        commandItem('insertTableColumnRight', shortcutStyle),
        { type: 'separator' },
        commandItem('moveTableRowUp', shortcutStyle),
        commandItem('moveTableRowDown', shortcutStyle),
        commandItem('moveTableColumnLeft', shortcutStyle),
        commandItem('moveTableColumnRight', shortcutStyle),
        { type: 'separator' },
        commandItem('alignTableColumnLeft', shortcutStyle),
        commandItem('alignTableColumnCenter', shortcutStyle),
        commandItem('alignTableColumnRight', shortcutStyle),
        commandItem('sortTableAsc', shortcutStyle),
        commandItem('sortTableDesc', shortcutStyle),
        { type: 'separator' },
        commandItem('formatTable', shortcutStyle),
        commandItem('selectTable', shortcutStyle),
        commandItem('copyTableMarkdown', shortcutStyle),
        commandItem('copyTableHtml', shortcutStyle),
        commandItem('copyTableCsv', shortcutStyle),
      ],
    } satisfies ContextMenuItem] : []),
    { type: 'separator' },
    {
      label: t('menu.copyAs'),
      children: [
        commandItem('copyPlain', shortcutStyle, { label: t('menu.plainText'), disabled: !hasSelection }),
        commandItem('copyMd', shortcutStyle, { label: 'Markdown', disabled: !hasSelection }),
        commandItem('copyHtml', shortcutStyle, { label: 'HTML', disabled: !hasSelection }),
      ],
    },
  ];
}
