/**
 * 浮岛布局的宽度计算。
 *
 * 三块岛不会自己伸缩，宽度全部由这里算出来，原因是栏缝拖拽要求
 * 「三者之和恒等于视口宽 − 外留白 − 栏缝」，一旦某块岛自己 flex，
 * 拖动时另一块就会被隐式改宽，读数条上的数字就和实际对不上。
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 可见的文档岛数量：0（没有打开文档）/ 1（纯编辑或纯预览）/ 2（分栏）。
 * 侧栏是否显示由调用方单独传，因为侧栏收起时栏缝也要一起消失。
 */
export type DocumentPaneCount = 0 | 1 | 2;

interface FitOptions {
  available: number;
  paneCount: DocumentPaneCount;
  sidebarVisible: boolean;
}

/** 计算给三块岛分配的总宽（已扣掉栏缝）。 */
export function getIslandBudget({ available, paneCount, sidebarVisible }: FitOptions) {
  const gutters = (sidebarVisible ? 1 : 0) + (paneCount === 2 ? 1 : 0);
  return Math.max(0, available - gutters * GUTTER_W);
}

/**
 * 把一份宽度按比例压进可用空间。
 *
 * 只缩不放：可用空间变大时保持原宽度（用户拖出来的宽度不应该被窗口拉宽覆盖），
 * 只有放不下时才按比例收缩。编辑器与预览按同一比例缩，避免某一侧先撞到最小宽。
 */
export function fitIslandWidths(
  widths: IslandWidths,
  { available, paneCount, sidebarVisible }: FitOptions,
): IslandWidths {
  const budget = getIslandBudget({ available, paneCount, sidebarVisible });

  if (paneCount === 0) {
    const sidebar = clamp(widths.sidebar, ISLAND_LIMITS.sidebar.min, Math.max(ISLAND_LIMITS.sidebar.min, budget));
    return { sidebar, editor: 0, preview: 0 };
  }

  const sidebar = clamp(
    widths.sidebar,
    ISLAND_LIMITS.sidebar.min,
    Math.min(ISLAND_LIMITS.sidebar.max, Math.max(ISLAND_LIMITS.sidebar.min, budget - 1)),
  );
  const docBudget = Math.max(0, budget - (sidebarVisible ? sidebar : 0));

  if (paneCount === 1) {
    const doc = docBudget;
    return {
      sidebar: sidebarVisible ? sidebar : 0,
      editor: doc,
      preview: doc,
    };
  }

  const currentDoc = widths.editor + widths.preview;
  if (currentDoc <= 0) {
    // 没有文档时（paneCount 0）编辑/预览被清零过，这里不能对半分：
    // 设计基准是 548 : 556，对半会让预览岛凭空窄掉 4px。
    const baseRatio = DEFAULT_ISLAND_WIDTHS.editor / (DEFAULT_ISLAND_WIDTHS.editor + DEFAULT_ISLAND_WIDTHS.preview);
    const editor = Math.round(docBudget * baseRatio);
    return { sidebar: sidebarVisible ? sidebar : 0, editor, preview: docBudget - editor };
  }

  // 窗口变宽时按原比例分配多出来的空间（SPEC 第 7 节：岛宽按剩余宽度比例分配），
  // 否则宽屏下预览岛会把余量吃光，编辑岛显得被挤扁。
  const ratio = docBudget / currentDoc;
  const editor = clamp(Math.round(widths.editor * ratio), ISLAND_LIMITS.editor.min, ISLAND_LIMITS.editor.max);
  const preview = Math.max(ISLAND_LIMITS.preview.min, docBudget - editor);
  return {
    sidebar: sidebarVisible ? sidebar : 0,
    editor: Math.max(ISLAND_LIMITS.editor.min, docBudget - preview),
    preview,
  };
}


/** 拖动第一条缝：只改侧栏宽，文档区自己吃掉差值。 */
export function resizeSidebar(
  widths: IslandWidths,
  nextSidebar: number,
  options: FitOptions,
): IslandWidths {
  const budget = getIslandBudget(options);
  // 侧栏拉宽时文档区跟着变窄，所以上限由「文档区的最小总宽」决定，而不是当前宽度。
  const docMinimum = options.paneCount === 2
    ? ISLAND_LIMITS.editor.min + ISLAND_LIMITS.preview.min
    : 0;
  const maxSidebar = Math.min(
    ISLAND_LIMITS.sidebar.max,
    Math.max(ISLAND_LIMITS.sidebar.min, budget - docMinimum),
  );
  const sidebar = clamp(Math.round(nextSidebar), ISLAND_LIMITS.sidebar.min, maxSidebar);
  return fitIslandWidths({ ...widths, sidebar }, options);
}

/** 拖动第二条缝：调整编辑器/预览的分界，二者之和不变。 */
export function resizeEditor(widths: IslandWidths, nextEditor: number): IslandWidths {
  const pairTotal = widths.editor + widths.preview;
  const editorMin = Math.max(ISLAND_LIMITS.editor.min, pairTotal - ISLAND_LIMITS.preview.max);
  const editorMax = Math.min(ISLAND_LIMITS.editor.max, pairTotal - ISLAND_LIMITS.preview.min);
  const editor = clamp(Math.round(nextEditor), Math.min(editorMin, editorMax), Math.max(editorMin, editorMax));
  return { ...widths, editor, preview: pairTotal - editor };
}

/** 双击抓手：回到设计基准宽度。 */
export function resetIslandWidths(options: FitOptions): IslandWidths {
  return fitIslandWidths({ ...DEFAULT_ISLAND_WIDTHS }, options);
}

