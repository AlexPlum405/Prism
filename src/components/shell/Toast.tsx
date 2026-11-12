import type { ReactNode } from 'react';
import { TOAST_TIMER_MIN_MS, type ToastAction, type ToastState, type ToastTone } from '../../lib/toast';
import { t } from '../../domains/i18n';

interface ToastProps {
  toast: ToastState;
  onDismiss: () => void;
  /** 退场中：切换为淡出动画，由 useAppToast 延迟卸载 */
  leaving?: boolean;
}

function handleToastAction(action: ToastAction, onDismiss: () => void) {
  if (action.dismissOnClick !== false) onDismiss();
  void action.onClick?.();
}

/**
 * 语义图标：线条绘制，颜色由 .prism-toast-icon 的 currentColor 决定。
 * 旧版用实心黑圆填满 18px，视觉重量超过正文，是截图里最刺眼的一处。
 */
const TOAST_ICONS: Record<ToastTone, ReactNode> = {
  neutral: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.4" className="prism-toast-icon-dot" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.4 8.4l3 3 6.2-6.6" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.8v6.1" />
      <circle cx="8" cy="12.1" r="1.15" className="prism-toast-icon-dot" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" />
    </svg>
  ),
};

export function Toast({ toast, onDismiss, leaving = false }: ToastProps) {
  const liveMode = toast.tone === 'error' ? 'assertive' : 'polite';
  const showTimer = toast.durationMs !== null && toast.durationMs >= TOAST_TIMER_MIN_MS;

  return (
    <div
      key={toast.id}
      role="status"
      aria-live={liveMode}
      className={`prism-toast prism-toast--${toast.tone}${leaving ? ' is-leaving' : ''}`}
    >
      <span className="prism-toast-icon">{TOAST_ICONS[toast.tone]}</span>
      <span className="prism-toast-copy">
        <span className="prism-toast-title">{toast.title}</span>
        {toast.message && <span className="prism-toast-message">{toast.message}</span>}
      </span>
      {toast.actions.length > 0 && (
        <span className="prism-toast-actions">
          {toast.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="prism-toast-action"
              onClick={() => handleToastAction(action, onDismiss)}
            >
              {action.label}
            </button>
          ))}
        </span>
      )}
      <button
        type="button"
        className="prism-toast-dismiss"
        aria-label={t('toast.close')}
        onClick={onDismiss}
      >
        ×
      </button>
      {showTimer && (
        <span className="prism-toast-timer" aria-hidden="true">
          <i style={{ animationDuration: `${toast.durationMs}ms` }} />
        </span>
      )}
    </div>
  );
}
