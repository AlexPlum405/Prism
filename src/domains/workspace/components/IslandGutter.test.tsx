import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IslandGutter } from './IslandGutter';

function setup(overrides: Partial<React.ComponentProps<typeof IslandGutter>> = {}) {
  const props = {
    label: '调整源码与预览的宽度',
    value: 548,
    valueMin: 380,
    valueMax: 820,
    startName: '源文',
    endName: '预览',
    partnerValue: 556,
    onResizeStart: vi.fn(),
    onResize: vi.fn(),
    onResizeEnd: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  render(<IslandGutter {...props} />);
  return props;
}

const hit = () => screen.getByRole('separator');

describe('IslandGutter', () => {
  it('is a vertical separator exposing the current width', () => {
    setup();
    expect(hit()).toHaveAttribute('aria-orientation', 'vertical');
    expect(hit()).toHaveAttribute('aria-valuenow', '548');
    expect(hit()).toHaveAttribute('aria-valuemin', '380');
    expect(hit()).toHaveAttribute('aria-valuemax', '820');
    expect(hit()).toHaveAttribute('aria-label', '调整源码与预览的宽度');
  });

  it('reports the pointer delta as a new width and shows the readout', () => {
    const props = setup();

    fireEvent.pointerDown(hit(), { button: 0, clientX: 800, pointerId: 1 });
    expect(props.onResizeStart).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains('island-resizing')).toBe(true);

    fireEvent.pointerMove(hit(), { clientX: 832, pointerId: 1 });
    expect(props.onResize).toHaveBeenLastCalledWith(580);

    // 读数条：源文 548 · 预览 556 +32
    expect(screen.getByText('源文 548 · 预览 556')).toBeTruthy();
    expect(screen.getByText('+32')).toBeTruthy();

    fireEvent.pointerUp(hit(), { clientX: 832, pointerId: 1 });
    expect(props.onResizeEnd).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains('island-resizing')).toBe(false);
    expect(screen.queryByText('+32')).toBeNull();
  });

  it('marks the gutter as dragging while the pointer is down', () => {
    setup();
    const gutter = hit().parentElement as HTMLElement;
    fireEvent.pointerDown(hit(), { button: 0, clientX: 800, pointerId: 1 });
    expect(gutter).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerUp(hit(), { clientX: 800, pointerId: 1 });
    expect(gutter).not.toHaveAttribute('data-dragging');
  });

  it('resets on double click', () => {
    const props = setup();
    fireEvent.doubleClick(hit());
    expect(props.onReset).toHaveBeenCalledTimes(1);
  });

  it('nudges by 8px with the arrow keys', () => {
    const props = setup();
    fireEvent.keyDown(hit(), { key: 'ArrowRight' });
    expect(props.onResize).toHaveBeenLastCalledWith(556);
    fireEvent.keyDown(hit(), { key: 'ArrowLeft' });
    expect(props.onResize).toHaveBeenLastCalledWith(540);
    expect(props.onResizeStart).toHaveBeenCalledTimes(2);
    expect(props.onResizeEnd).toHaveBeenCalledTimes(2);
  });

  it('ignores vertical arrows', () => {
    const props = setup();
    fireEvent.keyDown(hit(), { key: 'ArrowUp' });
    expect(props.onResize).not.toHaveBeenCalled();
  });
});
