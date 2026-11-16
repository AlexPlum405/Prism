import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/**
 * 岛与岛之间的缝。
 *
 * 缝本身是 16px 的留白（画布色），静置时什么都没有，鼠标进入只改变光标。
 * 拖动时只给必要的数值反馈：当前两侧宽度的读数条，和画在「原本位置」上的
 * 旧边界虚影（由父级渲染）。抓手胶囊与双向箭头图标已移除——它们既不提供
 * 信息，又会让整条缝在拖动时显得很吵。
 */

export interface IslandGutterProps {
  /** 无障碍名称，例如「调整侧栏宽度」。 */
  label: string;
  /** 被拖拽这一侧的当前宽度，也用作 aria-valuenow。 */
  value: number;
  valueMin: number;
  valueMax: number;
  /** 读数条左侧那段的名称，例如「侧栏」「源文」。 */
  startName: string;
  /** 读数条右侧那段的名称，例如「源文」「预览」。 */
  endName: string;
  /** 相邻那块的当前宽度，只用于读数条展示。 */
  partnerValue: number;
  onResizeStart: () => void;
  /** nextValue 是「被拖这一侧的新宽度」，由父级决定怎么吸收。 */
  onResize: (nextValue: number) => void;
  onResizeEnd: () => void;
  onReset: () => void;
}

export function IslandGutter({
  label,
  value,
  valueMin,
  valueMax,
  startName,
  endName,
  partnerValue,
  onResizeStart,
  onResize,
  onResizeEnd,
  onReset,
}: IslandGutterProps) {
  const [dragging, setDragging] = useState(false);
  const [delta, setDelta] = useState(0);
  const startRef = useRef<{ x: number; value: number } | null>(null);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // 这里刻意不 preventDefault：WKWebView 会因此在 pointerdown 后吞掉
    // 兼容鼠标事件，双击复位就永远收不到 dblclick。防选中的职责交给
    // .island-gutter 的 user-select: none 与 body.island-resizing。
    // 双击复位兜底：某些引擎只给 pointerdown 的 detail，不给 dblclick。
    if (event.detail >= 2) {
      startRef.current = null;
      onReset();
      return;
    }
    // jsdom 没有 setPointerCapture，测试里退化成普通事件流即可。
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startRef.current = { x: event.clientX, value };
    setDelta(0);
    setDragging(true);
    document.body.classList.add('island-resizing');
    onResizeStart();
  }, [onResizeStart, value]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    const next = start.value + (event.clientX - start.x);
    setDelta(Math.round(event.clientX - start.x));
    onResize(next);
  }, [onResize]);

  const finish = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    startRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    setDragging(false);
    document.body.classList.remove('island-resizing');
    onResizeEnd();
  }, [onResizeEnd]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onResizeStart();
    onResize(value + (event.key === 'ArrowRight' ? 8 : -8));
    onResizeEnd();
  }, [onResize, onResizeEnd, onResizeStart, value]);

  const deltaLabel = delta === 0 ? '' : `${delta > 0 ? '+' : ''}${delta}`;

  return (
    <div className="island-gutter" data-dragging={dragging ? 'true' : undefined}>
      <div
        className="island-gutter__hit"
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={valueMin}
        aria-valuemax={valueMax}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onDoubleClick={onReset}
        onKeyDown={handleKeyDown}
      />
      {dragging && (
        <div className="island-readout" aria-hidden="true">
          <span>{startName} {Math.round(value)} · {endName} {Math.round(partnerValue)}</span>
          {deltaLabel && <span className="island-readout__delta">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}

/** 拖动时画在「原边界」上的虚影点线；位置由父级按拖动起点算。 */
export function IslandGhost({ x, label }: { x: number; label: ReactNode }) {
  return (
    <div className="island-ghost" style={{ left: x }} aria-hidden="true">
      <span className="island-ghost__label">{label}</span>
    </div>
  );
}
