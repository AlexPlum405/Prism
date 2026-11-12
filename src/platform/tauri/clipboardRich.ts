import { invokeNativeCommand } from './nativeCommands';

export interface WriteClipboardRichInputDto {
  html?: string;
  text?: string;
  pngBytesBase64?: string;
}

/**
 * 经 NSPasteboard 原生写入富剪贴板。
 * WKWebView 的 navigator.clipboard.write 在 await 之后会丢失用户手势而失败
 * （WebKit bug 222262），应用内统一走原生命令。
 */
export function writeClipboardRichNative(input: WriteClipboardRichInputDto) {
  return invokeNativeCommand<void>('write_clipboard_rich', { input });
}

export function writeClipboardTextNative(text: string) {
  return invokeNativeCommand<void>('write_clipboard_rich', { input: { text } });
}

export interface ClipboardPayloadDto {
  html?: string | null;
  text?: string | null;
}

/**
 * 经 NSPasteboard 原生读取剪贴板的 html 与 text。
 * WKWebView 的 navigator.clipboard.read/readText 需要瞬时用户手势，
 * 原生菜单触发的命令不满足该条件，会弹系统授权框或静默失败。
 */
export function readClipboardPayloadNative() {
  return invokeNativeCommand<ClipboardPayloadDto>('read_clipboard_payload');
}

export function isTauriClipboardRuntime() {
  return Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}
