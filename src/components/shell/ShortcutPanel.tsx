import { useEffect } from 'react';
import { commandRegistry, getPrimaryShortcutLabel } from '../../domains/commands';
import { useSettingsStore } from '../../domains/settings/store';
import { getLocalizedCommandCategory, getLocalizedCommandLabel, useI18n } from '../../domains/i18n';
import type { CommandCategory } from '../../domains/commands/types';

interface ShortcutItem {
  category: CommandCategory;
  shortcuts: Array<{ keys: string; description: string }>;
}

const CATEGORY_ORDER: CommandCategory[] = ['file', 'edit', 'insert', 'format', 'view', 'window', 'help'];

function getShortcutItems(shortcutStyle: ReturnType<typeof useSettingsStore.getState>['shortcutStyle']): ShortcutItem[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    shortcuts: commandRegistry
      .filter((command) => command.category === category)
      .map((command) => ({
        keys: getPrimaryShortcutLabel(command.id, shortcutStyle),
        description: getLocalizedCommandLabel(command.id),
      }))
      .filter((item): item is { keys: string; description: string } => Boolean(item.keys)),
  })).filter((category) => category.shortcuts.length > 0);
}

interface ShortcutPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function ShortcutPanel({ visible, onClose }: ShortcutPanelProps) {
  const { t } = useI18n();
  const shortcutStyle = useSettingsStore((s) => s.shortcutStyle);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  const shortcuts = getShortcutItems(shortcutStyle);

  return (
    <>
      <div className="sp-overlay" onClick={onClose} />
      <div className="sp" role="dialog" aria-label={t('shortcut.title')}>
        <div className="sp-header">
          <h2>{t('shortcut.title')}</h2>
          <button className="sp-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="sp-content">
          {shortcuts.map((category) => (
            <div key={category.category} className="sp-category">
              <h3>{getLocalizedCommandCategory(category.category as CommandCategory)}</h3>
              <div className="sp-list">
                {category.shortcuts.map((s, i) => (
                  <div key={i} className="sp-item">
                    <span className="sp-item-desc">{s.description}</span>
                    <span className="sp-item-keys">{s.keys}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
