/**
 * 原生菜单的编辑类快捷键在按键进入 WKWebView 之前就被 macOS 菜单系统消费，
 * 前端只收到一条菜单事件，拿不到 keydown——这正好绕过了 useAppShortcuts 里
 * 「输入框内保持原生行为」的那道守卫。结果是在设置项、重命名框里按 ⌘A 选中的
 * 是编辑器全文，⌘Z 撤销的是文稿而不是输入框里的字。
 *
 * 这里按焦点把动作还给浏览器：焦点落在 CodeMirror 之外的可编辑控件上时，
 * 直接执行原生动作并拦下菜单事件。
 */
const NATIVE_EDIT_COMMANDS = new Set(['undo', 'redo', 'cut', 'copy', 'selectAll']);

function getFocusedEditable(): HTMLElement | null {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) return null;
  // 编辑器内的一切都交给 CodeMirror：它有自己的事务与撤销栈
  if (element.closest('.cm-editor')) return null;
  if (element instanceof HTMLInputElement) return element;
  if (element instanceof HTMLTextAreaElement) return element;
  if (element.isContentEditable) return element;
  return null;
}

/**
 * @returns true 表示已经由浏览器执行，调用方不应再把它转发给编辑器
 */
export function runEditCommandOnFocusedControl(action: string): boolean {
  if (!NATIVE_EDIT_COMMANDS.has(action)) return false;

  const target = getFocusedEditable();
  if (!target) return false;

  if (action === 'selectAll') {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.select();
      return true;
    }
    return document.execCommand('selectAll');
  }

  try {
    return document.execCommand(action);
  } catch {
    return false;
  }
}
