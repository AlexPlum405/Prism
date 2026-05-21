import { describe, expect, it, vi } from 'vitest';
import { APP_EVENT_NAMES, emitAppEvent, onAppEvent } from './appEvents';

describe('appEvents', () => {
  it('emits typed payloads on the existing DOM event names', () => {
    const listener = vi.fn();
    window.addEventListener(APP_EVENT_NAMES['command.run'], listener);

    emitAppEvent('command.run', { action: 'save' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent<{ action: string }>).detail).toEqual({
      action: 'save',
    });

    window.removeEventListener(APP_EVENT_NAMES['command.run'], listener);
  });

  it('returns an unsubscribe function for typed listeners', () => {
    const listener = vi.fn();
    const unsubscribe = onAppEvent('export.progress', listener);

    emitAppEvent('export.progress', { visible: true, message: '正在导出' });
    unsubscribe();
    emitAppEvent('export.progress', { visible: false });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      { visible: true, message: '正在导出' },
      expect.objectContaining({ type: APP_EVENT_NAMES['export.progress'] }),
    );
  });
});
