import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createIslandPreference,
  fitIslandWidths,
  ISLAND_LIMITS,
  resizeEditorPreference,
  resizeSidebarPreference,
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
    available: Math.max(0, available - 36),
    paneCount,
    sidebarVisible,
  }), [available, paneCount, sidebarVisible]);

  const widths = useMemo(() => fitIslandWidths(preference, options), [preference, options]);

  const startSidebarDrag = useCallback(() => {
    setGhost({ x: 18 + widths.sidebar, label: `原边界 ${Math.round(18 + widths.sidebar)}` });
  }, [widths.sidebar]);

  const startDocumentDrag = useCallback(() => {
    const x = 18 + (sidebarVisible ? widths.sidebar + 16 : 0) + widths.editor;
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
