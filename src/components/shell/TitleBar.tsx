import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ViewModeSwitch } from '../../domains/document/components/ViewModeSwitch';
import { getRuntimePlatform } from '../../domains/workspace/services';
import { useI18n } from '../../domains/i18n';
import type { DocumentSaveStatus } from '../../domains/document/types';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  docName: string;
  isDirty?: boolean;
  onRenameDocument?: (name: string) => void | Promise<void>;
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

type WindowControls = Pick<ReturnType<typeof getCurrentWindow>, 'close' | 'minimize' | 'toggleMaximize'>;

function getSafeWindowControls(): WindowControls | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

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
  onRenameDocument,
  saveError = null,
  saveStatus,
}: TitleBarProps) {
  const { t } = useI18n();
  const [window] = useState(() => getSafeWindowControls());
  const displayDocName = docName.replace(/\.md$/i, '');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(displayDocName);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const effectiveSaveStatus = saveStatus ?? (isDirty ? 'dirty' : 'saved');
  const saveFeedback = getSaveFeedback(effectiveSaveStatus, saveError, t);

  useEffect(() => {
    if (!isRenaming) setRenameDraft(displayDocName);
  }, [displayDocName, isRenaming]);

  useEffect(() => {
    if (!isRenaming) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isRenaming]);

  const startRename = () => {
    if (!onRenameDocument) return;
    setRenameDraft(displayDocName);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setRenameDraft(displayDocName);
    setIsRenaming(false);
  };

  const commitRename = () => {
    const nextName = renameDraft.trim();
    setIsRenaming(false);
    if (!nextName || nextName === displayDocName) {
      setRenameDraft(displayDocName);
      return;
    }

    void onRenameDocument?.(nextName);
  };

  const handleMinimize = async () => {
    if (!window) return;
    try { await window.minimize(); } catch (e) { console.error('minimize failed', e); }
  };
  const handleMaximize = async () => {
    if (!window) return;
    try { await window.toggleMaximize(); } catch (e) { console.error('toggleMaximize failed', e); }
  };
  const handleClose = async () => {
    if (!window) return;
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
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    className={styles.renameInput}
                    value={renameDraft}
                    aria-label={t('titlebar.renameDocument')}
                    onBlur={commitRename}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitRename();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                ) : onRenameDocument ? (
                  <button
                    type="button"
                    className={styles.docNameButton}
                    title={t('titlebar.renameDocument')}
                    aria-label={t('titlebar.renameDocument')}
                    onClick={startRename}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {displayDocName}
                  </button>
                ) : (
                  <span className={styles.docName}>{displayDocName}</span>
                )}
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
          <ViewModeSwitch />
        </>
      ) : (
        <>
          <div className={styles.windowsTitleCluster} data-titlebar-section="windows-title-cluster">
            <ViewModeSwitch flushStart />
            <div className={`${styles.titleGroup} ${styles.windowsTitleGroup}`}>
              <div className={`${styles.title} ${styles.windowsTitle}`}>
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    className={styles.renameInput}
                    value={renameDraft}
                    aria-label={t('titlebar.renameDocument')}
                    onBlur={commitRename}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        commitRename();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                  />
                ) : onRenameDocument ? (
                  <button
                    type="button"
                    className={styles.docNameButton}
                    title={t('titlebar.renameDocument')}
                    aria-label={t('titlebar.renameDocument')}
                    onClick={startRename}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {displayDocName}
                  </button>
                ) : (
                  <span className={styles.docName}>{displayDocName}</span>
                )}
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
