import { create } from 'zustand';
import { WorkspaceState, FileNode, SidebarTab, FileTreeMode, FileSortMode, WorkspaceTreeScope } from './types';

interface WorkspaceStore extends WorkspaceState {
  setRootPath: (path: string) => void;
  setFileTree: (tree: FileNode[]) => void;
  setWorkspace: (path: string, tree: FileNode[]) => void;
  setFileTreeMode: (mode: FileTreeMode) => void;
  setFileSortMode: (mode: FileSortMode) => void;
  setWorkspaceTreeScope: (scope: WorkspaceTreeScope) => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleStatusBar: () => void;
  toggleTypewriterMode: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleFocusMode: () => void;
  setFullscreen: (v: boolean) => void;
  setAlwaysOnTop: (v: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  mode: 'single',
  rootPath: null,
  fileTree: [],
  fileTreeMode: 'tree',
  fileSortMode: 'name',
  workspaceTreeScope: 'currentLevel',
  sidebarVisible: true,
  sidebarTab: 'files',
  focusMode: false,
  statusBarVisible: true,
  typewriterMode: false,
  isFullscreen: false,
  isAlwaysOnTop: false,

  setRootPath: (path) => {
    set({ rootPath: path, mode: 'folder', workspaceTreeScope: 'currentLevel' });
  },

  setFileTree: (tree) => {
    set({ fileTree: tree });
  },

  setWorkspace: (path, tree) => {
    set({ rootPath: path, fileTree: tree, mode: 'folder', workspaceTreeScope: 'currentLevel' });
  },

  setFileTreeMode: (fileTreeMode) => {
    set({ fileTreeMode });
  },

  setFileSortMode: (fileSortMode) => {
    set({ fileSortMode });
  },

  setWorkspaceTreeScope: (workspaceTreeScope) => {
    set({ workspaceTreeScope });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarVisible: !state.sidebarVisible }));
  },

  setSidebarVisible: (visible) => {
    set({ sidebarVisible: visible });
  },

  toggleStatusBar: () => {
    set((state) => ({ statusBarVisible: !state.statusBarVisible }));
  },

  toggleTypewriterMode: () => {
    set((state) => ({ typewriterMode: !state.typewriterMode }));
  },

  setFullscreen: (isFullscreen: boolean) => set({ isFullscreen }),
  setAlwaysOnTop: (isAlwaysOnTop: boolean) => set({ isAlwaysOnTop }),

  setSidebarTab: (tab) => {
    set({ sidebarTab: tab, sidebarVisible: true });
  },

  toggleFocusMode: () => {
    set((state) => ({
      focusMode: !state.focusMode,
      sidebarVisible: state.focusMode ? true : false,
      statusBarVisible: state.focusMode ? true : false,
    }));
  },
}));
