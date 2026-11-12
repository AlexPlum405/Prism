import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/**
 * 岛与岛之间的缝。
 *
 * 缝本身是 16px 的留白（画布色），不是线：静置时里面什么都没有，鼠标进入
 * 才淡入一个 14×64 的抓手。拖动时抓手跟着走，读数条挂在抓手右侧，
 * 旧边界虚影由父级画在「原本的位置」上——所以虚影不在这里渲染，
 * 这里只负责上报位移。
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

function MoveHorizontalIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M1 6h10" />
      <path d="M3.4 3.6 1 6l2.4 2.4" />
      <path d="M8.6 3.6 11 6l-2.4 2.4" />
    </svg>
  );
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
    event.preventDefault();
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
      <div className="island-grip" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      {dragging && (
        <div className="island-readout" aria-hidden="true">
          <span className="island-readout__icon"><MoveHorizontalIcon /></span>
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
