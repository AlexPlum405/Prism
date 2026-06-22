import styles from './MenuDropdown.module.css';
import type { MenuItem } from './types';

interface MenuDropdownProps {
  items: MenuItem[];
  onAction: (action: string) => void;
  onClose: () => void;
}

const CheckIcon = () => (
  <svg className={styles.checkIcon} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2.5 6.5l2.5 2.5 5-6" />
  </svg>
);

export function MenuDropdown({ items, onAction, onClose }: MenuDropdownProps) {
  const normalizeItems = (source: MenuItem[]) => {
    const visibleItems = source.filter((item) => {
      if (item.type === 'separator') return true;
      return !item.hidden;
    });

    return visibleItems.filter((item, idx, arr) => {
      if (item.type !== 'separator') return true;
      if (idx === 0 || idx === arr.length - 1) return false;
      if (arr[idx - 1]?.type === 'separator') return false;
      return true;
    });
  };

  const cleanedItems = normalizeItems(items);

  const handleItemClick = (item: MenuItem) => {
    if (item.type === 'separator') return;
    if (item.disabled || item.children?.length || item.submenu) return;
    if (item.action) {
      onAction(item.action);
      onClose();
    }
  };

  return (
    <div className={styles.dropdown} role="menu">
      {cleanedItems.map((item, idx) => {
        if (item.type === 'separator') {
          return <div key={`sep-${idx}`} className={styles.separator} role="separator" />;
        }

        const className = [
          styles.item,
          item.disabled ? styles.disabled : '',
          item.submenu ? styles.submenu : '',
        ].filter(Boolean).join(' ');

        const submenuItems = item.children ? normalizeItems(item.children) : [];

        return (
          <div key={`${item.label}-${idx}`} className={styles.itemWrap}>
            <div
              className={className}
              role="menuitem"
              aria-disabled={item.disabled ? true : undefined}
              aria-haspopup={item.submenu || submenuItems.length > 0 ? true : undefined}
              title={item.disabledReason}
              onClick={() => handleItemClick(item)}
            >
              <div className={styles.check}>
                {item.checked ? <CheckIcon /> : null}
              </div>
              <span className={styles.labelWrap}>
                <span className={styles.label}>{item.label}</span>
                {item.disabled && item.disabledReason ? (
                  <span className={styles.disabledReason}>{item.disabledReason}</span>
                ) : null}
              </span>
              <span className={styles.meta}>
                {item.shortcut ? (
                  <span className={styles.shortcut}>{item.shortcut}</span>
                ) : null}
                {item.submenu || submenuItems.length > 0 ? <span className={styles.arrow}>›</span> : null}
              </span>
            </div>
            {submenuItems.length > 0 ? (
              <div className={styles.submenuPanel} role="menu">
                {submenuItems.map((child, childIdx) => {
                  if (child.type === 'separator') {
                    return <div key={`child-sep-${childIdx}`} className={styles.separator} role="separator" />;
                  }

                  const childClassName = [
                    styles.item,
                    child.disabled ? styles.disabled : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <div
                      key={`${child.label}-${childIdx}`}
                      className={childClassName}
                      role="menuitem"
                      aria-disabled={child.disabled ? true : undefined}
                      title={child.disabledReason}
                      onClick={() => handleItemClick(child)}
                    >
                      <div className={styles.check}>
                        {child.checked ? <CheckIcon /> : null}
                      </div>
                      <span className={styles.labelWrap}>
                        <span className={styles.label}>{child.label}</span>
                        {child.disabled && child.disabledReason ? (
                          <span className={styles.disabledReason}>{child.disabledReason}</span>
                        ) : null}
                      </span>
                      <span className={styles.meta}>
                        {child.shortcut ? <span className={styles.shortcut}>{child.shortcut}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
