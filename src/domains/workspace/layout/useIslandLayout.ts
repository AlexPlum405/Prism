import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ISLAND_WIDTHS,
  fitIslandWidths,
  ISLAND_LIMITS,
  resetIslandWidths,
  resizeEditor,
  resizeSidebar,
  type DocumentPaneCount,
  type IslandWidths,
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
 * 宽度只在这里维护一份：栏缝拖拽、窗口缩放、双击复位都改同一处，
 * 三块岛自己不做 flex 伸缩，避免拖动时另一块被隐式改宽导致读数错位。
 */
export function useIslandLayout({ paneCount, sidebarVisible }: UseIslandLayoutOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(0);
  const [widths, setWidths] = useState<IslandWidths>({ ...DEFAULT_ISLAND_WIDTHS });
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

  // 可用宽度变化时按比例收敛一次；宽度不够时缩，够用时保持用户拖过的值。
  useEffect(() => {
    if (available <= 0) return;
    setWidths((prev) => fitIslandWidths(prev, {
      available: available - 36,
      paneCount,
      sidebarVisible,
    }));
  }, [available, paneCount, sidebarVisible]);

  const options = useCallback(() => ({
    available: Math.max(0, available - 36),
    paneCount,
    sidebarVisible,
  }), [available, paneCount, sidebarVisible]);

  const startSidebarDrag = useCallback(() => {
    setGhost({ x: 18 + widths.sidebar, label: `原边界 ${Math.round(18 + widths.sidebar)}` });
  }, [widths.sidebar]);

  const startDocumentDrag = useCallback(() => {
    const x = 18 + (sidebarVisible ? widths.sidebar + 16 : 0) + widths.editor;
    setGhost({ x, label: `原边界 ${Math.round(x)}` });
  }, [sidebarVisible, widths.editor, widths.sidebar]);

  const resizeSidebarTo = useCallback((next: number) => {
    setWidths((prev) => resizeSidebar(prev, next, options()));
  }, [options]);

  const resizeEditorTo = useCallback((next: number) => {
    setWidths((prev) => resizeEditor(prev, next));
  }, []);

  const endDrag = useCallback(() => setGhost(null), []);

  const reset = useCallback(() => {
    setGhost(null);
    setWidths(resetIslandWidths(options()));
  }, [options]);

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
