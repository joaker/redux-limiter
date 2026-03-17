/**
 * Creates an rAF-based throttle that coalesces multiple update requests into
 * a single callback per animation frame.
 *
 * When maxFps is specified, updates are further throttled to fire at most
 * that many times per second.
 */
export function createRAFThrottle(
  callback: () => void,
  maxFps?: number,
): { requestUpdate: () => void; cleanup: () => void } {
  // SSR guard: requestAnimationFrame is not available in Node
  if (typeof requestAnimationFrame === 'undefined') {
    return { requestUpdate: callback, cleanup: () => {} };
  }

  const minInterval = maxFps != null && maxFps > 0 ? 1000 / maxFps : 0;
  let rafId: number | null = null;
  let lastFiredAt = 0;
  let pendingUpdate = false;

  const loop = (timestamp: DOMHighResTimeStamp) => {
    rafId = null;

    if (!pendingUpdate) return;

    const elapsed = timestamp - lastFiredAt;
    if (minInterval === 0 || elapsed >= minInterval) {
      pendingUpdate = false;
      lastFiredAt = timestamp;
      callback();
    } else {
      // Not enough time has passed for maxFps; wait another frame
      rafId = requestAnimationFrame(loop);
    }
  };

  const requestUpdate = () => {
    pendingUpdate = true;
    if (rafId === null) {
      rafId = requestAnimationFrame(loop);
    }
  };

  const cleanup = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingUpdate = false;
  };

  return { requestUpdate, cleanup };
}
