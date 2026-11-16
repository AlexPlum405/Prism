import { FileNode, SidebarTab } from '../types';
import { FileTree } from './FileTree';
import { OutlinePanel } from './OutlinePanel';
import { useI18n } from '../../i18n';
import { PLUS_PATH, VIEW_LIST_PATH, VIEW_TREE_PATH } from '../../../components/icons/islandIconPaths';

/* 页脚图标路径取自 components/icons/islandIconPaths，与标题栏侧栏开关共用
   同一套 20×20 / 纯 fill / 1.20–1.30 圆头笔画。过去这排是实心小块 +
   stroke 加号，线宽和留白都跟外壳图标对不上。 */
const IconPlus = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d={PLUS_PATH} />
  </svg>
);

/** 树/网格视图：2×2 空心小方块，保留原本「方块」的语义但换成细线环。 */
const IconViewTree = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path fillRule="evenodd" clipRule="evenodd" d={VIEW_TREE_PATH} />
  </svg>
);

/** 列表视图：三条圆头横线，点击后形状明显改变，空工作区里也有反馈。 */
const IconViewList = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
    <path d={VIEW_LIST_PATH} />
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

      {/* 三列等宽端头让中间的工作区名真正落在页脚中心；两态图标不同，
          点下去立刻有可见反馈（空工作区里树/列表内容相同也不会像没反应）。 */}
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
        <button
          type="button"
          className="island-sidebar__icon-btn"
          data-active={fileTreeMode === 'tree' ? 'true' : undefined}
          title={fileTreeMode === 'tree' ? t('status.switchToList') : t('status.switchToTree')}
          aria-label={fileTreeMode === 'tree' ? t('status.switchToList') : t('status.switchToTree')}
          aria-pressed={fileTreeMode === 'tree'}
          onClick={onToggleFileTreeMode}
        >
          {fileTreeMode === 'tree' ? <IconViewTree /> : <IconViewList />}
        </button>
      </div>
    </div>
  );
}
