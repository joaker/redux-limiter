import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThrottledSelector } from './useThrottledSelector';

// --- rAF mock ---

let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;

const flush = (timestamp = 16) => {
  const callbacks = [...rafCallbacks.values()];
  rafCallbacks.clear();
  callbacks.forEach((cb) => cb(timestamp));
};

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

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Helpers ---

type CounterState = { count: number; unrelated: number };

function makeStore(initialState: CounterState = { count: 0, unrelated: 0 }) {
  return createStore(
    (state: CounterState = initialState, action: { type: string }) => {
      switch (action.type) {
        case 'INCREMENT':
          return { ...state, count: state.count + 1 };
        case 'UNRELATED':
          return { ...state, unrelated: state.unrelated + 1 };
        default:
          return state;
      }
    },
    initialState,
  );
}

function makeWrapper(store: ReturnType<typeof makeStore>) {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

// --- Tests ---

describe('useThrottledSelector', () => {
  it('returns the initial selected state synchronously', () => {
    const store = makeStore({ count: 42, unrelated: 0 });
    const { result } = renderHook(
      () => useThrottledSelector((s: CounterState) => s.count),
      { wrapper: makeWrapper(store) },
    );

    expect(result.current).toBe(42);
  });

  it('updates after a dispatch on the next animation frame', () => {
    const store = makeStore();
    const { result } = renderHook(
      () => useThrottledSelector((s: CounterState) => s.count),
      { wrapper: makeWrapper(store) },
    );

    expect(result.current).toBe(0);

    act(() => {
      store.dispatch({ type: 'INCREMENT' });
    });

    // Not yet updated — rAF is pending
    expect(result.current).toBe(0);

    act(() => {
      flush();
    });

    expect(result.current).toBe(1);
  });

  it('coalesces multiple dispatches into a single re-render', () => {
    const store = makeStore();
    let renderCount = 0;

    const { result } = renderHook(
      () => {
        renderCount++;
        return useThrottledSelector((s: CounterState) => s.count);
      },
      { wrapper: makeWrapper(store) },
    );

    const initialRenders = renderCount;

    act(() => {
      store.dispatch({ type: 'INCREMENT' });
      store.dispatch({ type: 'INCREMENT' });
      store.dispatch({ type: 'INCREMENT' });
    });

    act(() => {
      flush();
    });

    expect(result.current).toBe(3);
    expect(renderCount - initialRenders).toBe(1);
  });

  it('does not re-render when the selected value is unchanged', () => {
    const store = makeStore();
    let renderCount = 0;

    renderHook(
      () => {
        renderCount++;
        return useThrottledSelector((s: CounterState) => s.count);
      },
      { wrapper: makeWrapper(store) },
    );

    const initialRenders = renderCount;

    act(() => {
      store.dispatch({ type: 'UNRELATED' });
    });

    act(() => {
      flush();
    });

    expect(renderCount - initialRenders).toBe(0);
  });

  it('respects a custom equality function', () => {
    const store = makeStore();
    let renderCount = 0;

    // Never consider the value changed
    const alwaysEqual = () => true;

    renderHook(
      () => {
        renderCount++;
        return useThrottledSelector(
          (s: CounterState) => s.count,
          alwaysEqual,
        );
      },
      { wrapper: makeWrapper(store) },
    );

    const initialRenders = renderCount;

    act(() => {
      store.dispatch({ type: 'INCREMENT' });
    });

    act(() => {
      flush();
    });

    expect(renderCount - initialRenders).toBe(0);
  });

  it('cleans up the subscription and rAF on unmount', () => {
    const store = makeStore();
    const { unmount } = renderHook(
      () => useThrottledSelector((s: CounterState) => s.count),
      { wrapper: makeWrapper(store) },
    );

    unmount();

    act(() => {
      store.dispatch({ type: 'INCREMENT' });
    });

    expect(rafCallbacks.size).toBe(0);
  });

  it('throttles to maxFps', () => {
    const store = makeStore();
    let renderCount = 0;

    renderHook(
      () => {
        renderCount++;
        return useThrottledSelector(
          (s: CounterState) => s.count,
          Object.is,
          30,
        );
      },
      { wrapper: makeWrapper(store) },
    );

    const initialRenders = renderCount;

    act(() => {
      store.dispatch({ type: 'INCREMENT' });
    });

    // 16ms — not enough for 30fps
    act(() => {
      flush(16);
    });

    expect(renderCount - initialRenders).toBe(0);

    // 50ms — enough for 30fps
    act(() => {
      flush(50);
    });

    expect(renderCount - initialRenders).toBe(1);
  });
});
