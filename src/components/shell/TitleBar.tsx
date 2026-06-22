import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ViewModeSwitch } from '../../domains/document/components/ViewModeSwitch';
import { getRuntimePlatform } from '../../domains/workspace/services';
import { useI18n } from '../../domains/i18n';
import type { DocumentSaveStatus } from '../../domains/document/types';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  docName: string;
  isDirty?: boolean;
  saveError?: string | null;
  saveStatus?: DocumentSaveStatus;
}

const IS_MACOS = getRuntimePlatform() === 'mac';

const IconMin = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor">
    <path d="M2.5 6h7" />
  </svg>
);
const IconMax = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor">
    <rect x="2.5" y="2.5" width="7" height="7" />
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor">
    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
  </svg>
);

function getSaveFeedback(
  saveStatus: DocumentSaveStatus,
  saveError: string | null | undefined,
  translate: ReturnType<typeof useI18n>['t'],
) {
  if (saveStatus === 'saved') return null;

  if (saveStatus === 'saving') {
    return {
      label: translate('titlebar.saving'),
      title: translate('titlebar.savingTitle'),
      tone: 'saving',
    };
  }

  if (saveStatus === 'failed') {
    return {
      label: translate('titlebar.saveFailed'),
      title: saveError
        ? translate('titlebar.saveFailedTitle', { message: saveError })
        : translate('titlebar.saveFailedFallback'),
      tone: 'failed',
    };
  }

  if (saveStatus === 'conflict') {
    return {
      label: translate('titlebar.conflict'),
      title: saveError
        ? translate('titlebar.conflictTitle', { message: saveError })
        : translate('titlebar.conflictFallback'),
      tone: 'conflict',
    };
  }

  return {
    label: translate('titlebar.unsaved'),
    title: translate('titlebar.unsavedTitle'),
    tone: 'dirty',
  };
}

export function TitleBar({
  docName,
  isDirty = false,
  saveError = null,
  saveStatus,
}: TitleBarProps) {
  const { t } = useI18n();
  const [window] = useState(() => getCurrentWindow());
  const displayDocName = docName.replace(/\.md$/i, '');
  const effectiveSaveStatus = saveStatus ?? (isDirty ? 'dirty' : 'saved');
  const saveFeedback = getSaveFeedback(effectiveSaveStatus, saveError, t);

  const handleMinimize = async () => {
    try { await window.minimize(); } catch (e) { console.error('minimize failed', e); }
  };
  const handleMaximize = async () => {
    try { await window.toggleMaximize(); } catch (e) { console.error('toggleMaximize failed', e); }
  };
  const handleClose = async () => {
    try { await window.close(); } catch (e) { console.error('close failed', e); }
  };

  return (
    <div
      className={`${styles.titlebar} ${IS_MACOS ? styles.macos : styles.windows} app-titlebar`}
      data-tauri-drag-region
    >
      {IS_MACOS ? (
        <>
          <div className={styles.brand}>
            <div className={styles.titleGroup}>
              <div className={styles.title}>
                <span className={styles.docName}>{displayDocName}</span>
                {saveFeedback && (
                  <span
                    className={`${styles.saveBadge} ${styles[saveFeedback.tone]}`}
                    title={saveFeedback.title}
                    aria-label={saveFeedback.title}
                  >
                    <span className={styles.saveBadgeDot} aria-hidden="true" />
                    <span className={styles.saveBadgeLabel}>{saveFeedback.label}</span>
                  </span>
                )}
                <span className={styles.sep}>—</span>
                <span className={styles.app}>Prism</span>
              </div>
            </div>
          </div>
          <ViewModeSwitch />
        </>
      ) : (
        <>
          <div className={styles.windowsTitleCluster} data-titlebar-section="windows-title-cluster">
            <ViewModeSwitch flushStart />
            <div className={`${styles.titleGroup} ${styles.windowsTitleGroup}`}>
              <div className={`${styles.title} ${styles.windowsTitle}`}>
                <span className={styles.docName}>{displayDocName}</span>
                {saveFeedback && (
                  <span
                    className={`${styles.saveBadge} ${styles[saveFeedback.tone]}`}
                    title={saveFeedback.title}
                    aria-label={saveFeedback.title}
                  >
                    <span className={styles.saveBadgeDot} aria-hidden="true" />
                    <span className={styles.saveBadgeLabel}>{saveFeedback.label}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.windowsDragSpacer} data-tauri-drag-region />
        </>
      )}
      {!IS_MACOS && (
        <div className={styles.controls}>
          <button className={styles.btn} onClick={handleMinimize} title={t('titlebar.minimize')} aria-label={t('titlebar.minimize')}>
            <IconMin />
          </button>
          <button className={styles.btn} onClick={handleMaximize} title={t('titlebar.maximize')} aria-label={t('titlebar.maximize')}>
            <IconMax />
          </button>
          <button className={`${styles.btn} ${styles.close}`} onClick={handleClose} title={t('titlebar.close')} aria-label={t('titlebar.close')}>
            <IconClose />
          </button>
        </div>
      )}
    </div>
  );
}
