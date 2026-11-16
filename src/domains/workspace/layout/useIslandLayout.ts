import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createIslandPreference,
  fitIslandWidths,
  GUTTER_W,
  ISLAND_LIMITS,
  resizeEditorPreference,
  resizeSidebarPreference,
  WINDOW_PAD_X,
  type DocumentPaneCount,
  type IslandPreference,
} from './islandLayout';

interface UseIslandLayoutOptions {
  paneCount: DocumentPaneCount;
  sidebarVisible: boolean;
}

interface GhostState {
  x: number;
  label: string;
}

/**
 * 浮岛外壳的宽度状态。
 *
 * 只存「偏好」（用户拖出来的意图），实际像素宽每次渲染现算：窗口变窄时三块岛
 * 一起让路，但让路结果不写回偏好，所以把窗口拉宽后岛宽会回到用户拖出的值，
 * 而不是停在被压窄的数字上。
 */
export function useIslandLayout({ paneCount, sidebarVisible }: UseIslandLayoutOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(0);
  const [preference, setPreference] = useState<IslandPreference>(createIslandPreference);
  const [ghost, setGhost] = useState<GhostState | null>(null);

  // 量的是 .island-main 的 clientWidth（已含左右各 18 的 padding，计算里会扣）。
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const read = () => {
      const next = node.clientWidth;
      setAvailable((prev) => (Math.abs(prev - next) < 1 ? prev : next));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const options = useMemo(() => ({
    available: Math.max(0, available - WINDOW_PAD_X * 2),
    paneCount,
    sidebarVisible,
  }), [available, paneCount, sidebarVisible]);

  const widths = useMemo(() => fitIslandWidths(preference, options), [preference, options]);

  // 侧栏浮岛右缘（窗口坐标）发给标题栏，让侧栏开关对齐这条边。
  // 收起时不更新：浮岛消失后开关停在原处，两态不跳位；重新展开再恢复跟随。
  useEffect(() => {
    if (!sidebarVisible || widths.sidebar <= 0) return;
    document.documentElement.style.setProperty(
      '--island-sidebar-edge',
      `${WINDOW_PAD_X + widths.sidebar}px`,
    );
  }, [sidebarVisible, widths.sidebar]);

  const startSidebarDrag = useCallback(() => {
    setGhost({ x: WINDOW_PAD_X + widths.sidebar, label: `原边界 ${Math.round(WINDOW_PAD_X + widths.sidebar)}` });
  }, [widths.sidebar]);

  const startDocumentDrag = useCallback(() => {
    const x = WINDOW_PAD_X + (sidebarVisible ? widths.sidebar + GUTTER_W : 0) + widths.editor;
    setGhost({ x, label: `原边界 ${Math.round(x)}` });
  }, [sidebarVisible, widths.editor, widths.sidebar]);

  const resizeSidebarTo = useCallback((next: number) => {
    setPreference((prev) => resizeSidebarPreference(prev, next));
  }, []);

  const resizeEditorTo = useCallback((next: number) => {
    setPreference((prev) => resizeEditorPreference(prev, next, options));
  }, [options]);

  const endDrag = useCallback(() => setGhost(null), []);

  const reset = useCallback(() => {
    setGhost(null);
    setPreference(createIslandPreference());
  }, []);

  return {
    containerRef,
    widths,
    ghost,
    limits: ISLAND_LIMITS,
    startSidebarDrag,
    startDocumentDrag,
    resizeSidebarTo,
    resizeEditorTo,
    endDrag,
    reset,
  };
}
