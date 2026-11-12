import { useCallback, useEffect, useRef, useState } from 'react';
import { createToastState, TOAST_EXIT_MS, type ToastInput, type ToastState, type ToastTone } from '../lib/toast';
import { onAppEvent } from '../platform/events/appEvents';

export function useAppToast() {
  const toastTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const leavingRef = useRef(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [leaving, setLeaving] = useState(false);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  /**
   * 退场不再立即置空：先标记 leaving 播完 200ms 淡出，再真正卸载。
   * 旧实现直接 setToast(null)，视觉上是瞬断。
   */
  const dismissToast = useCallback(() => {
    clearToastTimer();
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    exitTimerRef.current = window.setTimeout(() => {
      leavingRef.current = false;
      exitTimerRef.current = null;
      setLeaving(false);
      setToast(null);
    }, TOAST_EXIT_MS);
  }, [clearToastTimer]);

  const showToast = useCallback((input: ToastInput, tone?: ToastTone) => {
    const nextToast = createToastState(input, tone);
    // 新提示顶替退场中的旧提示：先终止退场，避免残留的卸载定时器把它抹掉
    clearExitTimer();
    leavingRef.current = false;
    setLeaving(false);
    setToast(nextToast);
    clearToastTimer();
    if (nextToast.durationMs !== null && nextToast.durationMs > 0) {
      toastTimerRef.current = window.setTimeout(() => {
        toastTimerRef.current = null;
        dismissToast();
      }, nextToast.durationMs);
    }
  }, [clearExitTimer, clearToastTimer, dismissToast]);

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
  }, []);

  useEffect(() => {
    return onAppEvent('toast.show', (detail) => {
      if (detail) showToast(detail);
    });
  }, [showToast]);

  return {
    toast,
    leaving,
    showToast,
    dismissToast,
  };
}
