import type { ToastAction, ToastState } from '../../lib/toast';
import { t } from '../../domains/i18n';

interface ToastProps {
  toast: ToastState;
  onDismiss: () => void;
}

function handleToastAction(action: ToastAction, onDismiss: () => void) {
  if (action.dismissOnClick !== false) onDismiss();
  void action.onClick?.();
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const liveMode = toast.tone === 'error' ? 'assertive' : 'polite';

  return (
    <div
      key={toast.id}
      role="status"
      aria-live={liveMode}
      className={`prism-toast prism-toast--${toast.tone}`}
    >
      <span className="prism-toast-icon" aria-hidden="true" />
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
    </div>
  );
}
