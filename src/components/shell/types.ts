export interface MenuItemBase {
  action?: string;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  submenu?: boolean;
  children?: MenuItem[];
  hidden?: boolean;
}

export interface MenuItemNormal extends MenuItemBase {
  label: string;
  checked?: boolean;
  type?: never;
}

export interface MenuItemSeparator {
  type: 'separator';
  label?: never;
  action?: never;
  shortcut?: never;
  disabled?: never;
  submenu?: never;
}

export type MenuItem = MenuItemNormal | MenuItemSeparator;

export interface MenuSection {
  [key: string]: MenuItem[];
}

export interface MenuAction {
  (action: string): void;
}
