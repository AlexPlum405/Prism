import { useCallback, useEffect, useRef, useState } from 'react';
import { createToastState, type ToastInput, type ToastState } from '../lib/toast';
import { onAppEvent } from '../platform/events/appEvents';

export function useAppToast() {
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const nextToast = createToastState(input);
    setToast(nextToast);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (nextToast.durationMs !== null && nextToast.durationMs > 0) {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, nextToast.durationMs);
    }
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
  }, []);

  useEffect(() => {
    return onAppEvent('toast.show', (detail) => {
      if (detail) showToast(detail);
    });
  }, [showToast]);

  return {
    toast,
    showToast,
    dismissToast,
  };
}
