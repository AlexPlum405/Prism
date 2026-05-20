import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ViewModeSwitch } from '../../domains/document/components/ViewModeSwitch';
import { getRuntimePlatform } from '../../domains/workspace/services';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  docName: string;
  isDirty?: boolean;
}

const IS_MACOS = getRuntimePlatform() === 'mac';

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

export function TitleBar({ docName, isDirty = false }: TitleBarProps) {
  const [window] = useState(() => getCurrentWindow());

  const handleMinimize = async () => {
    try { await window.minimize(); } catch (e) { console.error('minimize failed', e); }
  };
  const handleMaximize = async () => {
    try { await window.toggleMaximize(); } catch (e) { console.error('toggleMaximize failed', e); }
  };
  const handleClose = async () => {
    try { await window.close(); } catch (e) { console.error('close failed', e); }
  };

  return (
    <div
      className={`${styles.titlebar} ${IS_MACOS ? styles.macos : ''} app-titlebar`}
      data-tauri-drag-region
    >
      <div className={styles.brand}>
        <div className={styles.logo}>P</div>
        <div className={styles.titleGroup}>
          <div className={styles.title}>
            <span className={styles.docName}>{docName.replace(/\.md$/, '')}</span>
            {isDirty && <span className={styles.dirtyRing} title="已修改未保存" aria-label="已修改未保存" />}
            <span className={styles.sep}>—</span>
            <span className={styles.app}>Prism</span>
          </div>
        </div>
      </div>
      <ViewModeSwitch />
      {!IS_MACOS && (
        <div className={styles.controls}>
          <button className={styles.btn} onClick={handleMinimize} title="最小化" aria-label="最小化">
            <IconMin />
          </button>
          <button className={styles.btn} onClick={handleMaximize} title="最大化" aria-label="最大化">
            <IconMax />
          </button>
          <button className={`${styles.btn} ${styles.close}`} onClick={handleClose} title="关闭" aria-label="关闭">
            <IconClose />
          </button>
        </div>
      )}
    </div>
  );
}
