import { FileNode, SidebarTab } from '../types';
import { FileTree } from './FileTree';
import { OutlinePanel } from './OutlinePanel';
import { useI18n } from '../../i18n';

interface SidebarProps {
  fileTree: FileNode[];
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  documentContent: string;
  activePath?: string | null;
  onFileClick?: (path: string) => void;
  onOutlineClick?: (line: number) => void;
}

export function Sidebar({
  fileTree,
  sidebarTab,
  setSidebarTab,
  documentContent,
  activePath,
  onFileClick,
  onOutlineClick,
}: SidebarProps) {
  const { t } = useI18n();
  return (
    <div
      className="sidebar"
      style={{
        width: 'clamp(240px, 26vw, 300px)',
        minWidth: '240px',
        flexShrink: 0,
        borderRight: '1px solid var(--theme-divider, var(--border-color))',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: 1,
      }}
    >
      {/* 选项卡容器 */}
      <div
        className="sidebar-tabs"
        style={{
          display: 'flex',
          padding: '12px 16px 4px',
          gap: '12px',
          position: 'relative',
          background: 'transparent',
        }}
      >
        {[
          { key: 'files', label: t('workspace.sidebar.files') },
          { key: 'outline', label: t('workspace.sidebar.outline') },
        ].map((tab) => {
          const isActive = sidebarTab === tab.key;
          return (
            <button
              key={tab.key}
              className="sidebar-tab-button"
              data-active={isActive ? 'true' : undefined}
              onClick={() => setSidebarTab(tab.key as SidebarTab)}
              style={{
                flex: 1,
                padding: '10px 4px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--bg-surface-solid)' : 'transparent',
                boxShadow: isActive ? 'var(--elevation-card)' : 'none',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background var(--duration-feedback) var(--ease-out), color var(--duration-feedback) var(--ease-out), box-shadow var(--duration-feedback) var(--ease-out), transform var(--duration-feedback) var(--ease-out)',
                zIndex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
                margin: '0 4px',
              }}
            >
              {tab.label}
              {isActive && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    left: '42%', 
                    right: '42%', 
                    height: '3px', 
                    background: 'var(--accent)',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px var(--accent-tint-strong)'
                  }} 
                />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {sidebarTab === 'files' && (
          <div style={{ padding: '0 8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <FileTree
              nodes={fileTree}
              activePath={activePath}
              onFileClick={onFileClick || (() => {})}
            />
          </div>
        )}
        {sidebarTab === 'outline' && (
          <OutlinePanel
            content={documentContent}
            onHeadingClick={onOutlineClick}
          />
        )}
      </div>
    </div>
  );
}
