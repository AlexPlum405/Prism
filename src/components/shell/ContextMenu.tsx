import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ContextMenuItem {
  label?: string;
  action?: string;
  icon?: ReactNode;
  shortcut?: string;
  checked?: boolean;
  type?: 'separator' | 'item';
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  children?: ContextMenuItem[];
  hidden?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onAction: (action: string) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [submenuSide, setSubmenuSide] = useState<'right' | 'left'>('right');
  const cleanedItems = useMemo(() => normalizeContextMenuItems(items), [items]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const margin = 8;
    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

    const nextLeft = Math.min(Math.max(x, margin), maxLeft);
    const nextTop = Math.min(Math.max(y, margin), maxTop);
    const estimatedSubmenuWidth = 236;

    setPosition({ left: nextLeft, top: nextTop });
    setSubmenuSide(
      nextLeft + rect.width + estimatedSubmenuWidth + margin > window.innerWidth
        ? 'left'
        : 'right',
    );
  }, [x, y, cleanedItems]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`custom-context-menu submenu-${submenuSide}`}
      role="menu"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ContextMenuItems items={cleanedItems} onAction={onAction} onClose={onClose} />
    </div>
  );
}

function normalizeContextMenuItems(items: ContextMenuItem[]): ContextMenuItem[] {
  const visibleItems: ContextMenuItem[] = items
    .filter((item) => !item.hidden)
    .map((item) => item.children ? {
      ...item,
      children: normalizeContextMenuItems(item.children),
    } : item);

  return visibleItems.filter((item, idx, arr) => {
    if (item.type !== 'separator') return true;
    if (idx === 0 || idx === arr.length - 1) return false;
    return arr[idx - 1]?.type !== 'separator';
  });
}

function ContextMenuItems({
  items,
  onAction,
  onClose,
}: {
  items: ContextMenuItem[];
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {items.map((item, idx) => {
        if (item.type === 'separator') {
          return <div key={`sep-${idx}`} className="menu-separator" />;
        }

        const childItems = item.children?.length ? item.children : [];
        const hasSubmenu = childItems.length > 0;
        const cls = [
          'menu-item',
          hasSubmenu ? 'has-submenu' : '',
          item.danger ? 'danger' : '',
          item.disabled ? 'disabled' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const content = (
          <div
            className={cls}
            role="menuitem"
            aria-haspopup={hasSubmenu ? true : undefined}
            aria-disabled={item.disabled ? true : undefined}
            title={item.disabledReason}
            onClick={(e) => {
              e.stopPropagation();
              if (item.disabled || hasSubmenu) return;
              if (item.action) onAction(item.action);
              onClose();
            }}
          >
            <div className="menu-icon-slot">
              {item.icon}
              {item.checked && <span className="check-mark" />}
            </div>
            <span className="menu-label-wrap">
              <span className="menu-label">{item.label}</span>
              {item.disabled && item.disabledReason ? (
                <span className="menu-disabled-reason">{item.disabledReason}</span>
              ) : null}
            </span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
            {hasSubmenu && <span className="menu-submenu-arrow">›</span>}
          </div>
        );

        if (!hasSubmenu) {
          return <div key={`${item.label}-${idx}`} className="menu-item-wrap">{content}</div>;
        }

        return (
          <div key={`${item.label}-${idx}`} className="menu-item-wrap">
            {content}
            <div className="custom-context-submenu" role="menu">
              <ContextMenuItems items={childItems} onAction={onAction} onClose={onClose} />
            </div>
          </div>
        );
      })}
    </>
  );
}
