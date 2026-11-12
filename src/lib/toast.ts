import {
  TOAST_ACTION_DURATION_MS,
  TOAST_DEFAULT_DURATION_MS,
  TOAST_ERROR_DURATION_MS,
  TOAST_STRING_DURATION_MS,
} from './feedbackTiming';

/**
 * 低于该时长的提示不显示倒计时进度线。
 * 2.8s 的短提示一闪而过，画一条来不及被读的进度线只是噪音。
 */
export const TOAST_TIMER_MIN_MS = TOAST_DEFAULT_DURATION_MS;

/** 退场动画时长，须与 CSS 的 --duration-toast-out 保持一致 */
export const TOAST_EXIT_MS = 200;

export type ToastTone = 'neutral' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick?: () => void | Promise<void>;
  dismissOnClick?: boolean;
}

export type ToastInput = string | {
  tone?: ToastTone;
  title: string;
  message?: string;
  actions?: ToastAction[];
  durationMs?: number | null;
};

export interface ToastState {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  actions: ToastAction[];
  durationMs: number | null;
}

/**
 * 全应用统一的提示函数签名。第二个参数只在传纯文本时有意义，
 * 用于给「已保存 / 已导出」这类有明确成败的反馈补上语义。
 */
export type ShowToast = (input: ToastInput, tone?: ToastTone) => void;

let nextToastId = 1;

/**
 * 纯文本提示可额外指定语义：`showToast(msg, 'success')`。
 * 字符串默认 neutral —— 这正是「复制路径」曾显示成黑色实心圆点的原因，
 * 因此凡是有明确成败含义的调用都应显式给出 tone。
 */
export function createToastState(input: ToastInput, tone?: ToastTone): ToastState {
  if (typeof input === 'string') {
    const resolvedTone = tone ?? 'neutral';
    return {
      id: nextToastId++,
      tone: resolvedTone,
      title: input,
      actions: [],
      durationMs: resolvedTone === 'error' ? TOAST_ERROR_DURATION_MS : TOAST_STRING_DURATION_MS,
    };
  }

  const hasAction = (input.actions?.length ?? 0) > 0;
  return {
    id: nextToastId++,
    tone: input.tone ?? 'neutral',
    title: input.title,
    message: input.message,
    actions: input.actions ?? [],
    durationMs: input.durationMs === undefined
      ? hasAction ? TOAST_ACTION_DURATION_MS : TOAST_DEFAULT_DURATION_MS
      : input.durationMs,
  };
}
