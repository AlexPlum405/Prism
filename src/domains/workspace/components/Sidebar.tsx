import { FileNode, SidebarTab } from '../types';
import { FileTree } from './FileTree';
import { OutlinePanel } from './OutlinePanel';
import { useI18n } from '../../i18n';

const IconPlus = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M9.32 3.35a.68.68 0 0 1 1.36 0v5.97h5.97a.68.68 0 1 1 0 1.36h-5.97v5.97a.68.68 0 1 1-1.36 0v-5.97H3.35a.68.68 0 1 1 0-1.36h5.97V3.35Z" />
  </svg>
);

const IconGrid = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M5.2 3.35h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05H5.2A1.05 1.05 0 0 1 4.15 7.5V4.4c0-.58.47-1.05 1.05-1.05Zm6.5 0h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05h-3.1a1.05 1.05 0 0 1-1.05-1.05V4.4c0-.58.47-1.05 1.05-1.05Zm-6.5 8.1h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05H5.2a1.05 1.05 0 0 1-1.05-1.05v-3.1c0-.58.47-1.05 1.05-1.05Zm6.5 0h3.1c.58 0 1.05.47 1.05 1.05v3.1c0 .58-.47 1.05-1.05 1.05h-3.1a1.05 1.05 0 0 1-1.05-1.05v-3.1c0-.58.47-1.05 1.05-1.05Z" />
  </svg>
);

interface SidebarProps {
  fileTree: FileNode[];
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  documentContent: string;
  activePath?: string | null;
  onFileClick?: (path: string) => void;
  onOutlineClick?: (line: number) => void;
  /** 页脚：新建文件。 */
  onNewFile?: () => void;
  /** 页脚：文件夹/工作区操作菜单。 */
  onFolderContextMenu?: React.MouseEventHandler;
  /** 页脚：树 / 列表切换。 */
  onToggleFileTreeMode?: () => void;
  fileTreeMode?: 'tree' | 'list';
  /** 页脚中间那行说明文字，默认取工作区目录名。 */
  footerLabel?: string;
}

/**
 * 侧栏岛。
 *
 * 页脚的 `+ / Examples / 网格 / «` 原本在状态栏左侧。挪进来是「浮岛」结构
 * 相对旧分栏的结构性差异：那簇按钮管的是侧栏自己，挂在跨三栏的状态栏上
 * 会让「谁属于谁」变得含糊。
 */
export function Sidebar({
  fileTree,
  sidebarTab,
  setSidebarTab,
  documentContent,
  activePath,
  onFileClick,
  onOutlineClick,
  onNewFile,
  onFolderContextMenu,
  onToggleFileTreeMode,
  fileTreeMode = 'list',
  footerLabel,
}: SidebarProps) {
  const { t } = useI18n();
  const tabs = [
    { key: 'files' as SidebarTab, label: t('workspace.sidebar.files') },
    { key: 'outline' as SidebarTab, label: t('workspace.sidebar.outline') },
  ];

  return (
    <div className="island-sidebar">
      <div className="island-sidebar__segment" role="tablist">
        {tabs.map((tab) => {
          const isActive = sidebarTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className="island-sidebar__segment-item"
              data-active={isActive ? 'true' : undefined}
              onClick={() => setSidebarTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="island-sidebar__body">
        {sidebarTab === 'files' ? (
          <FileTree
            nodes={fileTree}
            activePath={activePath}
            onFileClick={onFileClick || (() => {})}
          />
        ) : (
          <OutlinePanel
            content={documentContent}
            onHeadingClick={onOutlineClick}
          />
        )}
      </div>

      <div className="island-sidebar__footer">
        <button
          type="button"
          className="island-sidebar__add"
          title={t('status.newFile')}
          aria-label={t('status.newFile')}
          onClick={onNewFile}
        >
          <IconPlus />
        </button>
        <button
          type="button"
          className="island-sidebar__footer-label"
          title={t('status.workspaceActions')}
          onClick={onFolderContextMenu}
          onContextMenu={onFolderContextMenu}
        >
          {footerLabel}
        </button>
        <span className="island-sidebar__spacer" />
        <button
          type="button"
          className="island-sidebar__icon-btn"
          data-active={fileTreeMode === 'tree' ? 'true' : undefined}
          title={fileTreeMode === 'tree' ? t('status.switchToList') : t('status.switchToTree')}
          aria-label={fileTreeMode === 'tree' ? t('status.switchToList') : t('status.switchToTree')}
          onClick={onToggleFileTreeMode}
        >
          <IconGrid />
        </button>
      </div>
    </div>
  );
}
