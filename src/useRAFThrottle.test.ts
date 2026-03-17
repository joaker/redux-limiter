import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRAFThrottle } from './useRAFThrottle';

describe('createRAFThrottle', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    nextRafId = 0;

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = ++nextRafId;
      rafCallbacks.set(id, cb);
      return id;
    });

    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });
  });

  const flush = (timestamp = 16) => {
    const callbacks = [...rafCallbacks.values()];
    rafCallbacks.clear();
    callbacks.forEach((cb) => cb(timestamp));
  };

  it('invokes the callback on the next animation frame', () => {
    const cb = vi.fn();
    const { requestUpdate } = createRAFThrottle(cb);

    requestUpdate();
    expect(cb).not.toHaveBeenCalled();

    flush();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('coalesces multiple update requests into a single callback per frame', () => {
    const cb = vi.fn();
    const { requestUpdate } = createRAFThrottle(cb);

    requestUpdate();
    requestUpdate();
    requestUpdate();

    flush();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire if no update was requested', () => {
    const cb = vi.fn();
    createRAFThrottle(cb);

    flush();
    expect(cb).not.toHaveBeenCalled();
  });

  it('supports subsequent updates after a flush', () => {
    const cb = vi.fn();
    const { requestUpdate } = createRAFThrottle(cb);

    requestUpdate();
    flush(16);
    expect(cb).toHaveBeenCalledTimes(1);

    requestUpdate();
    flush(32);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending rAF on cleanup without firing the callback', () => {
    const cb = vi.fn();
    const { requestUpdate, cleanup } = createRAFThrottle(cb);

    requestUpdate();
    cleanup();
    flush();

    expect(cb).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
  });

  it('cleanup is safe to call when no update is pending', () => {
    const cb = vi.fn();
    const { cleanup } = createRAFThrottle(cb);

    expect(() => cleanup()).not.toThrow();
  });

  describe('maxFps', () => {
    it('waits until the minimum interval has passed before firing', () => {
      const cb = vi.fn();
      // 30fps = minimum ~33.3ms between updates
      const { requestUpdate } = createRAFThrottle(cb, 30);

      requestUpdate();

      // 16ms elapsed — not enough for 30fps (needs 33.3ms)
      flush(16);
      expect(cb).not.toHaveBeenCalled();

      // 50ms elapsed total — enough for 30fps
      flush(50);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('fires on the first frame when no maxFps is set', () => {
      const cb = vi.fn();
      const { requestUpdate } = createRAFThrottle(cb);

      requestUpdate();
      flush(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
