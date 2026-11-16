import type { CommandId } from '../commands/types';
import { isCommandId } from '../commands';
import { getLocalizedCommandLabel } from './commands';

/**
 * macOS 系统菜单栏里的 action id，顺序与 src-tauri/src/lib.rs 的 build_app_menu 一致。
 *
 * 这份清单会漂移，所以配了一条测试（appMenuLabels.test.ts）直接读 lib.rs 比对：
 * 菜单加了项却没进这里，标签就会退回 Rust 的中文兜底。
 */
export const NATIVE_MENU_ACTIONS = [
  'preferences',
  'new',
  'newWindow',
  'open',
  'openFolder',
  'quickOpen',
  'save',
  'saveAs',
  'openCurrentLocation',
  'copyCurrentFilePath',
  'closeDocument',
  'undo',
  'redo',
  'cut',
  'copy',
  'pastePlain',
  'selectAll',
  'showSearch',
  'showReplace',
  'workspaceSearch',
  'sourceMode',
  'splitMode',
  'previewMode',
  'toggleSidebar',
  'showOutline',
  'showDocumentDiagnostics',
  'actualSize',
  'zoomIn',
  'zoomOut',
  'alwaysOnTop',
  'showShortcuts',
  'mdReference',
  'migrationGuide',
  'checkUpdate',
  'github',
  'feedback',
] as const;

/**
 * macOS 系统菜单栏的标签表。
 *
 * 菜单在 Rust 启动时构建，那会儿前端还没跑，只能先用中文默认值；前端拿到
 * settings 里的 locale 后调用一次 `update_app_menu_labels` 重建，语言切换时
 * 再调一次。不这么做的话，英文/日文用户看到的是中文菜单栏——而三语验收
 * 把「九组菜单」写进了发布门槛。
 */
export function getNativeAppMenuLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const action of NATIVE_MENU_ACTIONS) {
    if (!isCommandId(action)) continue;
    labels[action] = getLocalizedCommandLabel(action as CommandId);
  }
  return labels;
}
