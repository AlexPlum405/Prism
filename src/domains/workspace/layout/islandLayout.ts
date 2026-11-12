/**
 * 浮岛布局的宽度计算。
 *
 * 两个概念必须分开：
 * - **偏好**（IslandPreference）：用户通过拖拽表达的意图，只由拖拽与双击复位改变；
 * - **渲染宽度**（IslandWidths）：按当前可用空间算出来的实际像素，随窗口变化。
 *
 * 分开的原因：窗口缩窄时三块岛要一起让路，但这份让路不能写回偏好——否则把窗口
 * 拉回去时侧栏会停在被压窄的值上，再也回不到 268。
 *
 * 坐标约定：`available` 是 .island-main 的内容宽（已扣掉左右各 18px 外留白），
 * 栏缝宽度固定 16px，不参与分配。
 */

export const GUTTER_W = 16;

/** 设计基准：268 / 548 / 556，窗口 1440 时正好 18+268+16+548+16+556+18 = 1440。 */
export const DEFAULT_ISLAND_WIDTHS = {
  sidebar: 268,
  editor: 548,
  preview: 556,
} as const;

export const ISLAND_LIMITS = {
  sidebar: { min: 200, max: 360 },
  editor: { min: 380, max: 820 },
  preview: { min: 320, max: 820 },
} as const;

export interface IslandWidths {
  sidebar: number;
  editor: number;
  preview: number;
}

/** 用户意图：侧栏宽 + 编辑器在「文档区」里占的比例。 */
export interface IslandPreference {
  sidebar: number;
  editorShare: number;
}

export function createIslandPreference(): IslandPreference {
  return {
    sidebar: DEFAULT_ISLAND_WIDTHS.sidebar,
    editorShare: DEFAULT_ISLAND_WIDTHS.editor / (DEFAULT_ISLAND_WIDTHS.editor + DEFAULT_ISLAND_WIDTHS.preview),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 可见的文档岛数量：0（没有打开文档）/ 1（纯编辑或纯预览）/ 2（分栏）。
 * 侧栏是否显示单独传，因为侧栏收起时栏缝也要一起消失。
 */
export type DocumentPaneCount = 0 | 1 | 2;

export interface FitOptions {
  available: number;
  paneCount: DocumentPaneCount;
  sidebarVisible: boolean;
}

/** 计算给三块岛分配的总宽（已扣掉栏缝）。 */
export function getIslandBudget({ available, paneCount, sidebarVisible }: FitOptions) {
  const gutters = (sidebarVisible ? 1 : 0) + (paneCount === 2 ? 1 : 0);
  return Math.max(0, available - gutters * GUTTER_W);
}

/** 把偏好换算成当前窗口下的实际像素宽。 */
export function fitIslandWidths(preference: IslandPreference, options: FitOptions): IslandWidths {
  const budget = getIslandBudget(options);
  const docMinimum = options.paneCount === 2
    ? ISLAND_LIMITS.editor.min + ISLAND_LIMITS.preview.min
    : 0;

  if (!options.sidebarVisible) {
    return { sidebar: 0, editor: budget, preview: budget };
  }

  if (options.paneCount === 0) {
    return { sidebar: Math.max(0, Math.min(preference.sidebar, budget)), editor: 0, preview: 0 };
  }

  // 窗口不够宽时先压侧栏，而不是压文档区：否则预览岛会被推到最小宽以下并横向溢出。
  const sidebar = clamp(
    preference.sidebar,
    ISLAND_LIMITS.sidebar.min,
    Math.max(ISLAND_LIMITS.sidebar.min, Math.min(ISLAND_LIMITS.sidebar.max, budget - docMinimum)),
  );
  const docBudget = Math.max(0, budget - sidebar);

  if (options.paneCount === 1) {
    return { sidebar, editor: docBudget, preview: docBudget };
  }

  const editor = clamp(
    Math.round(docBudget * preference.editorShare),
    ISLAND_LIMITS.editor.min,
    Math.max(ISLAND_LIMITS.editor.min, Math.min(ISLAND_LIMITS.editor.max, docBudget - ISLAND_LIMITS.preview.min)),
  );
  return { sidebar, editor, preview: Math.max(0, docBudget - editor) };
}

/** 拖动第一条缝：只改侧栏偏好，文档区自己吃掉差值。 */
export function resizeSidebarPreference(
  preference: IslandPreference,
  nextSidebar: number,
): IslandPreference {
  return {
    ...preference,
    sidebar: clamp(Math.round(nextSidebar), ISLAND_LIMITS.sidebar.min, ISLAND_LIMITS.sidebar.max),
  };
}

/** 拖动第二条缝：调整编辑器/预览的分界，二者之和不变，于是换算成新的占比。 */
export function resizeEditorPreference(
  preference: IslandPreference,
  nextEditor: number,
  options: FitOptions,
): IslandPreference {
  const widths = fitIslandWidths(preference, options);
  const pairTotal = widths.editor + widths.preview;
  if (pairTotal <= 0) return preference;

  const editorMin = Math.max(ISLAND_LIMITS.editor.min, pairTotal - ISLAND_LIMITS.preview.max);
  const editorMax = Math.min(ISLAND_LIMITS.editor.max, pairTotal - ISLAND_LIMITS.preview.min);
  const editor = clamp(
    Math.round(nextEditor),
    Math.min(editorMin, editorMax),
    Math.max(editorMin, editorMax),
  );
  return { ...preference, editorShare: editor / pairTotal };
}
