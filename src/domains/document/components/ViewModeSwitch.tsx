import { useDocumentStore } from '../store';
import styles from './ViewModeSwitch.module.css';
import { useI18n } from '../../i18n';
import type { I18nKey } from '../../i18n';

type ViewMode = 'edit' | 'split' | 'preview';

const IconEdit = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M5.9 2.9h6.7c1.1 0 1.8.1 2.35.38.48.24.87.63 1.11 1.11.28.55.38 1.25.38 2.35v2.38a.67.67 0 0 1-1.34 0V6.78c0-.83-.04-1.32-.18-1.6a1.54 1.54 0 0 0-.67-.67c-.28-.14-.77-.18-1.6-.18H5.94c-.83 0-1.32.04-1.6.18-.29.15-.52.38-.67.67-.14.28-.18.77-.18 1.6v6.44c0 .83.04 1.32.18 1.6.15.29.38.52.67.67.28.14.77.18 1.6.18h2.98a.67.67 0 1 1 0 1.34H5.9c-1.1 0-1.8-.1-2.35-.38a2.89 2.89 0 0 1-1.11-1.11c-.28-.55-.38-1.25-.38-2.35V6.74c0-1.1.1-1.8.38-2.35.24-.48.63-.87 1.11-1.11.55-.28 1.25-.38 2.35-.38Zm.13 3.62c0-.34.28-.62.62-.62h5.88a.62.62 0 1 1 0 1.24H6.65a.62.62 0 0 1-.62-.62Zm0 3.02c0-.34.28-.62.62-.62h4.28a.62.62 0 1 1 0 1.24H6.65a.62.62 0 0 1-.62-.62Zm8.58 1.48a1.1 1.1 0 0 1 1.56 0l.62.62c.43.43.43 1.13 0 1.56l-3.2 3.2c-.2.2-.46.34-.74.4l-1.73.37a.58.58 0 0 1-.69-.69l.37-1.73c.06-.28.2-.54.4-.74l3.41-2.99Z" />
  </svg>
);

const IconSplit = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M4.9 3.15h10.2c1.15 0 1.8.12 2.33.4.43.23.78.58 1.01 1.01.28.53.4 1.18.4 2.33v6.22c0 1.15-.12 1.8-.4 2.33-.23.43-.58.78-1.01 1.01-.53.28-1.18.4-2.33.4H4.9c-1.15 0-1.8-.12-2.33-.4a2.42 2.42 0 0 1-1.01-1.01c-.28-.53-.4-1.18-.4-2.33V6.89c0-1.15.12-1.8.4-2.33.23-.43.58-.78 1.01-1.01.53-.28 1.18-.4 2.33-.4Zm4.28 1.36H4.92c-.8 0-1.18.05-1.47.2-.2.11-.36.27-.47.47-.15.29-.2.67-.2 1.47v6.7c0 .8.05 1.18.2 1.47.11.2.27.36.47.47.29.15.67.2 1.47.2h4.26V4.51Zm1.36 10.98h4.54c.8 0 1.18-.05 1.47-.2.2-.11.36-.27.47-.47.15-.29.2-.67.2-1.47v-6.7c0-.8-.05-1.18-.2-1.47a1.06 1.06 0 0 0-.47-.47c-.29-.15-.67-.2-1.47-.2h-4.54v10.98Z" />
  </svg>
);

const IconPreview = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M10 2.95c3.32 0 5.86 2.05 7.37 4.93.7 1.34.7 2.9 0 4.24-1.51 2.88-4.05 4.93-7.37 4.93s-5.86-2.05-7.37-4.93a4.55 4.55 0 0 1 0-4.24C4.14 5 6.68 2.95 10 2.95Zm0 1.36c-2.77 0-4.88 1.68-6.17 4.2a3.2 3.2 0 0 0 0 2.98c1.29 2.52 3.4 4.2 6.17 4.2s4.88-1.68 6.17-4.2a3.2 3.2 0 0 0 0-2.98c-1.29-2.52-3.4-4.2-6.17-4.2Zm0 2.45a3.24 3.24 0 1 1 0 6.48 3.24 3.24 0 0 1 0-6.48Zm0 1.35a1.89 1.89 0 1 0 0 3.78 1.89 1.89 0 0 0 0-3.78Z" />
  </svg>
);

const VIEW_MODES: Array<{ key: ViewMode; labelKey: I18nKey; icon: () => JSX.Element }> = [
  { key: 'edit', labelKey: 'document.view.edit', icon: IconEdit },
  { key: 'split', labelKey: 'document.view.split', icon: IconSplit },
  { key: 'preview', labelKey: 'document.view.preview', icon: IconPreview },
];

interface ViewModeSwitchProps {
  className?: string;
  flushStart?: boolean;
}

export function ViewModeSwitch({ className = '', flushStart = false }: ViewModeSwitchProps = {}) {
  const { t } = useI18n();
  const viewMode = useDocumentStore((s) => s.currentDocument?.viewMode);
  const supportsPreview = useDocumentStore((s) => s.currentDocument?.profile?.supportsPreview ?? true);
  const setViewMode = useDocumentStore((s) => s.setViewMode);

  if (!viewMode) return null;

  const viewModes = supportsPreview
    ? VIEW_MODES
    : VIEW_MODES.filter((mode) => mode.key === 'edit');

  return (
    <div className={`${styles.container} ${flushStart ? styles.flushStart : ''} ${className}`.trim()}>
      {viewModes.map((m) => {
        const Icon = m.icon;
        const label = t(m.labelKey);
        return (
          <button
            key={m.key}
            className={`${styles.btn} ${viewMode === m.key ? styles.active : ''}`}
            onClick={() => setViewMode(m.key)}
            title={label}
            aria-label={label}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
