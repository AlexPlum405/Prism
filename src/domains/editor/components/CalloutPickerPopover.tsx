import { useEffect, useRef } from 'react';
import type { CalloutKind } from '../extensions/callouts';
import { EDITOR_CALLOUT_KINDS } from '../extensions/calloutSnippets';
import { useI18n } from '../../i18n';
import type { I18nKey } from '../../i18n';

interface CalloutPickerPopoverProps {
  mode: 'insert' | 'selection';
  onClose: () => void;
  onSelect: (kind: CalloutKind) => void;
  visible: boolean;
  x: number;
  y: number;
}

const CALLOUT_PICKER_LABEL_KEYS: Record<CalloutKind, I18nKey> = {
  note: 'editor.calloutPicker.note.label',
  warning: 'editor.calloutPicker.warning.label',
  tip: 'editor.calloutPicker.tip.label',
  important: 'editor.calloutPicker.important.label',
};

const CALLOUT_PICKER_DESCRIPTION_KEYS: Record<CalloutKind, I18nKey> = {
  note: 'editor.calloutPicker.note.description',
  warning: 'editor.calloutPicker.warning.description',
  tip: 'editor.calloutPicker.tip.description',
  important: 'editor.calloutPicker.important.description',
};

export function CalloutPickerPopover({
  mode,
  onClose,
  onSelect,
  visible,
  x,
  y,
}: CalloutPickerPopoverProps) {
  const { t } = useI18n();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const handleMouseDown = (event: MouseEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose, visible]);

  if (!visible) return null;

  return (
    <div
      ref={popoverRef}
      className="prism-callout-picker"
      role="dialog"
      aria-label={mode === 'selection' ? t('editor.calloutPicker.selectionTitle') : t('editor.calloutPicker.insertTitle')}
      style={{ left: x, top: y }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="prism-callout-picker__title">
        {mode === 'selection' ? t('editor.calloutPicker.selectionTitle') : t('editor.calloutPicker.insertTitle')}
      </div>
      <div className="prism-callout-picker__subtitle">
        {mode === 'selection' ? t('editor.calloutPicker.selectionSubtitle') : t('editor.calloutPicker.insertSubtitle')}
      </div>
      <div className="prism-callout-picker__list">
        {EDITOR_CALLOUT_KINDS.map((kind) => (
          <button
            key={kind}
            className={`prism-callout-picker__item prism-callout-picker__item--${kind}`}
            data-callout-kind={kind}
            onClick={() => onSelect(kind)}
            type="button"
          >
            <span className="prism-callout-picker__mark" aria-hidden="true" />
            <span>
              <span className="prism-callout-picker__label">
                {t(CALLOUT_PICKER_LABEL_KEYS[kind])}
              </span>
              <span className="prism-callout-picker__description">
                {t(CALLOUT_PICKER_DESCRIPTION_KEYS[kind])}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
