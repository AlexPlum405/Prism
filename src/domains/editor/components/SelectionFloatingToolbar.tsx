import type { EditorFormat } from '../extensions/formatting';
import { useI18n, type I18nKey } from '../../i18n';

type SelectionToolbarAction = {
  format: EditorFormat;
  label: string;
  titleKey: I18nKey;
};

const ACTIONS: SelectionToolbarAction[] = [
  { format: 'bold', label: 'B', titleKey: 'command.bold' },
  { format: 'italic', label: 'I', titleKey: 'command.italic' },
  { format: 'underline', label: 'U', titleKey: 'command.underline' },
  { format: 'strikethrough', label: 'S', titleKey: 'command.strikethrough' },
  { format: 'highlight', label: 'H', titleKey: 'editor.selectionToolbar.highlight' },
  { format: 'code', label: '<>', titleKey: 'command.inlineCode' },
  { format: 'link', label: '[]', titleKey: 'command.link' },
  { format: 'quote', label: '>', titleKey: 'command.quote' },
];

interface SelectionFloatingToolbarProps {
  onFormat: (format: EditorFormat) => void;
  visible: boolean;
  x: number;
  y: number;
}

export function SelectionFloatingToolbar({
  onFormat,
  visible,
  x,
  y,
}: SelectionFloatingToolbarProps) {
  const { t } = useI18n();

  if (!visible) return null;

  return (
    <div
      aria-label={t('editor.selectionToolbar.label')}
      className="prism-selection-toolbar"
      onMouseDown={(event) => event.preventDefault()}
      role="toolbar"
      style={{ left: x, top: y }}
    >
      {ACTIONS.map((action) => (
        <button
          key={action.format}
          aria-label={t(action.titleKey)}
          title={t(action.titleKey)}
          type="button"
          onClick={() => onFormat(action.format)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
