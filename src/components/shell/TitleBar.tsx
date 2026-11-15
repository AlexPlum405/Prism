import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ViewModeSwitch } from '../../domains/document/components/ViewModeSwitch';
import { getRuntimePlatform } from '../../domains/workspace/services';
import { useI18n } from '../../domains/i18n';
import type { DocumentSaveStatus } from '../../domains/document/types';
import { MenuDropdown } from './MenuDropdown';
import type { MenuSection } from './types';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  docName: string;
  isDirty?: boolean;
  menuSections?: MenuSection;
  onMenuAction?: (action: string) => void;
  onRenameDocument?: (name: string) => void | Promise<void>;
  saveError?: string | null;
  saveStatus?: DocumentSaveStatus;
  /** 侧栏开关：和 Codex 一样放在标题栏右簇里，而不是状态栏。 */
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
}

const RUNTIME_PLATFORM = getRuntimePlatform();
const IS_MACOS = RUNTIME_PLATFORM === 'mac';
const IS_WINDOWS = RUNTIME_PLATFORM === 'windows';

/**
 * 侧栏图标：结构与 ViewModeSwitch 的 IconSplit 同源——20×20 viewBox、纯 fill、
 * evenodd 挖空成 1.35 宽的描边环。展开态在环内加一道细分隔条（左侧窄栏），
 * 收起态去掉分隔条、改画一个右向箭头，两态轮廓一致但一眼能分。
 */
const PANEL_RING =
  'M6.1 3.9h7.8a3.2 3.2 0 0 1 3.2 3.2v5.8a3.2 3.2 0 0 1-3.2 3.2H6.1a3.2 3.2 0 0 1-3.2-3.2V7.1a3.2 3.2 0 0 1 3.2-3.2Zm0 1.35a1.85 1.85 0 0 0-1.85 1.85v5.8c0 1.02.83 1.85 1.85 1.85h7.8a1.85 1.85 0 0 0 1.85-1.85V7.1a1.85 1.85 0 0 0-1.85-1.85H6.1Z';

const IconPanelLeftOn = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path fillRule="evenodd" clipRule="evenodd" d={PANEL_RING} />
    <rect x="7.05" y="5.4" width="1.3" height="9.2" rx="0.65" />
  </svg>
);

const IconPanelLeftOff = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path fillRule="evenodd" clipRule="evenodd" d={PANEL_RING} />
    <path d="M9.75 7.58a.68.68 0 0 1 .96 0l2.2 2.15a.74.74 0 0 1 0 1.06l-2.2 2.15a.68.68 0 1 1-.96-.96l1.76-1.72-1.76-1.72a.68.68 0 0 1 0-.96Z" />
  </svg>
);

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
  menuSections,
  onMenuAction,
  onRenameDocument,
  saveError = null,
  saveStatus,
  sidebarVisible = true,
  onToggleSidebar,
}: TitleBarProps) {
  const { t } = useI18n();
  const [window] = useState(() => getSafeWindowControls());
  const displayDocName = docName.replace(/\.md$/i, '');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(displayDocName);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const inlineMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (inlineMenuRef.current && !inlineMenuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

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

  const renderTitleContent = (titleClassName = '') => (
    <div className={`${styles.title} ${titleClassName}`.trim()}>
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
  );

  const renderWindowControls = () => (
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
  );

  /**
   * 标题栏内联菜单。原先是 Windows 专用（macOS 走原生菜单栏），但浮岛方案
   * 要求标题栏只有 52px 一行，菜单必须收进这一行，否则三岛的高度会被挤掉
   * 一整行。macOS 下菜单仍由同一份 menuSections 驱动，行为不变。
   */
  const renderInlineMenu = () => {
    if (!menuSections || !onMenuAction) return null;

    return (
      <div className={styles.inlineMenu} ref={inlineMenuRef}>
        {Object.keys(menuSections).map((menuName) => (
          <div key={menuName} className={styles.inlineMenuItemWrapper}>
            <button
              type="button"
              className={`${styles.inlineMenuItem} ${activeMenu === menuName ? styles.active : ''}`}
              aria-haspopup="menu"
              aria-expanded={activeMenu === menuName}
              onClick={() => setActiveMenu(activeMenu === menuName ? null : menuName)}
              onMouseDown={(event) => event.stopPropagation()}
              onMouseEnter={() => {
                if (activeMenu) setActiveMenu(menuName);
              }}
            >
              {menuName}
            </button>
            {activeMenu === menuName && (
              <MenuDropdown
                items={menuSections[menuName]}
                onAction={onMenuAction}
                onClose={() => setActiveMenu(null)}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSidebarToggle = () => {
    if (!onToggleSidebar) return null;
    return (
      <button
        type="button"
        className={`${styles.sidebarToggle} ${sidebarVisible ? styles.sidebarToggleOn : ''}`}
        title={sidebarVisible ? t('status.collapseSidebar') : t('status.expandSidebar')}
        aria-label={sidebarVisible ? t('status.collapseSidebar') : t('status.expandSidebar')}
        aria-pressed={sidebarVisible}
        onClick={onToggleSidebar}
      >
        {sidebarVisible ? <IconPanelLeftOn /> : <IconPanelLeftOff />}
      </button>
    );
  };

  return (
    <div
      className={`${styles.titlebar} ${IS_MACOS ? styles.macos : IS_WINDOWS ? styles.windows : styles.linux} app-titlebar`}
    >
      {IS_MACOS ? (
        <>
          {renderSidebarToggle()}
          <div className={styles.macosTitleGroup}>
            {renderTitleContent()}
          </div>
          {renderInlineMenu()}
          <div className={styles.macosDragSpacer} data-titlebar-section="macos-drag-spacer" data-tauri-drag-region />
          <div className={styles.titlebarActions}>
            <ViewModeSwitch variant="titlebarBorderless" />
          </div>
        </>
      ) : IS_WINDOWS ? (
        <>
          <div className={styles.windowsLeftCluster} data-titlebar-section="windows-left-cluster">
            {renderInlineMenu()}
          </div>
          <div className={styles.windowsCenterTitle} data-titlebar-section="windows-center-title" data-tauri-drag-region>
            <div className={`${styles.titleGroup} ${styles.windowsTitleGroup}`}>
              {renderTitleContent(styles.windowsTitle)}
            </div>
          </div>
          <div className={styles.windowsDragSpacer} data-titlebar-section="windows-drag-spacer" data-tauri-drag-region />
          <div className={styles.windowsRightCluster} data-titlebar-section="windows-right-cluster">
            {renderSidebarToggle()}
            <ViewModeSwitch variant="titlebarBorderless" />
            <div className={styles.windowsControlsDivider} aria-hidden="true" />
            {renderWindowControls()}
          </div>
        </>
      ) : (
        <>
          <div className={styles.windowsTitleCluster} data-titlebar-section="windows-title-cluster">
            {renderSidebarToggle()}
            <ViewModeSwitch flushStart />
            <div className={`${styles.titleGroup} ${styles.windowsTitleGroup}`}>
              {renderTitleContent(styles.windowsTitle)}
            </div>
          </div>
          <div className={styles.windowsDragSpacer} data-titlebar-section="windows-drag-spacer" data-tauri-drag-region />
          {renderWindowControls()}
        </>
      )}
    </div>
  );
}
