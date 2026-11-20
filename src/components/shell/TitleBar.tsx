import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ViewModeSwitch } from '../../domains/document/components/ViewModeSwitch';
import { getRuntimePlatform } from '../../domains/workspace/services';
import { useI18n } from '../../domains/i18n';
import type { DocumentSaveStatus } from '../../domains/document/types';
import { MenuDropdown } from './MenuDropdown';
import { PANEL_CHEVRON, PANEL_DIVIDER, PANEL_RING } from '../icons/islandIconPaths';
import type { MenuSection } from './types';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  docName: string;
  /** 标题栏右侧的状态区（字数、诊断、聚焦、导出），由 App 组装后传入。 */
  statusSlot?: React.ReactNode;
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
 * 侧栏图标：环、竖线、箭头都取自 components/icons/islandIconPaths 的 16 单位
 * 网格（1px 环厚、整数坐标），与侧栏页脚的视图按钮同一套线宽。
 * 展开态在环内叠一道 1px 竖线标出左栏，收起态换成右向箭头。
 */

const IconPanelLeftOn = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
    <path fillRule="evenodd" clipRule="evenodd" d={PANEL_RING} />
    <path d={PANEL_DIVIDER} />
  </svg>
);

const IconPanelLeftOff = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
    <path fillRule="evenodd" clipRule="evenodd" d={PANEL_RING} />
    <path d={PANEL_CHEVRON} />
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
  statusSlot,
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
      <div className={styles.inlineMenu} ref={inlineMenuRef} data-tauri-drag-region={macosDragRegion}>
        {Object.keys(menuSections).map((menuName) => (
          <div key={menuName} className={styles.inlineMenuItemWrapper} data-tauri-drag-region={macosDragRegion}>
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

  /* macOS 上标题栏这一行的空白都应该能拖窗口：红绿灯左侧的留白命中 .titlebar，
     文件名/菜单文字上下的留白命中各自的容器。Tauri 的拖动脚本只看被点元素自身的
     data-tauri-drag-region（e.target，不向上找），所以标在容器上不会吃掉按钮点击。 */
  const macosDragRegion = IS_MACOS ? '' : undefined;

  return (
    <div
      className={`${styles.titlebar} ${IS_MACOS ? styles.macos : IS_WINDOWS ? styles.windows : styles.linux} app-titlebar`}
      data-tauri-drag-region={macosDragRegion}
    >
      {IS_MACOS ? (
        <>
          {/* 文件名 → 侧栏开关 → 菜单：这一组的右缘由侧栏浮岛右缘决定（CSS 变量），
              开关因此落在浮岛右边界上方，收起时变量不更新，按钮停在原处。 */}
          <div className={styles.macosLeftGroup} data-tauri-drag-region={macosDragRegion}>
            <div className={styles.macosFileName}>{renderTitleContent()}</div>
            {renderSidebarToggle()}
          </div>
          {renderInlineMenu()}
          <div className={styles.macosDragSpacer} data-titlebar-section="macos-drag-spacer" data-tauri-drag-region={macosDragRegion} />
          <div className={styles.titlebarActions} data-tauri-drag-region={macosDragRegion}>
            {statusSlot}
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
            {statusSlot}
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
          <div className={styles.titlebarActions}>{statusSlot}</div>
          {renderWindowControls()}
        </>
      )}
    </div>
  );
}
