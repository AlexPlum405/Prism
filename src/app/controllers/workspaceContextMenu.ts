import type { ContextMenuItem } from '../../components/shell/ContextMenu';

export interface WorkspaceContextMenuState {
  items: ContextMenuItem[];
  kind: 'file' | 'menu';
  x: number;
  y: number;
}
