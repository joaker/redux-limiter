import { useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { createRAFThrottle } from './useRAFThrottle';

/**
 * A throttled alternative to react-redux's useSelector.
 *
 * Instead of re-rendering on every Redux dispatch, this hook coalesces
 * multiple store updates into at most one re-render per animation frame,
 * preventing superfluous renders in high-frequency dispatch scenarios.
 *
 * @param selector   - A function that takes the Redux state and returns a value.
 * @param equalityFn - Comparison function to determine if the selected value has
 *                     changed. Defaults to Object.is (reference equality).
 * @param maxFps     - Cap re-renders to this many times per second. Defaults to
 *                     the display's native refresh rate (~60fps).
 */
export function useThrottledSelector<TSelected>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selector: (state: any) => TSelected,
  equalityFn: (prev: TSelected, next: TSelected) => boolean = Object.is,
  maxFps?: number,
): TSelected {
  const store = useStore();

  // Always keep refs up-to-date so the subscription callback uses the latest
  // selector and equalityFn without needing to re-subscribe on every render.
  const selectorRef = useRef(selector);
  const equalityFnRef = useRef(equalityFn);
  selectorRef.current = selector;
  equalityFnRef.current = equalityFn;

  const [selectedState, setSelectedState] = useState<TSelected>(() =>
    selector(store.getState()),
  );

  // Track the last rendered value in a ref so the rAF callback can compare
  // without capturing a stale closure over selectedState.
  const selectedStateRef = useRef<TSelected>(selectedState);
  selectedStateRef.current = selectedState;

  useEffect(() => {
    const checkForUpdate = () => {
      const next = selectorRef.current(store.getState());
      if (!equalityFnRef.current(selectedStateRef.current, next)) {
        selectedStateRef.current = next;
        setSelectedState(next);
      }
    };

    const { requestUpdate, cleanup } = createRAFThrottle(checkForUpdate, maxFps);

    // Catch any state change that occurred between the initial render and
    // when the subscription is established.
    checkForUpdate();

    const unsubscribe = store.subscribe(requestUpdate);

    return () => {
      unsubscribe();
      cleanup();
    };
  }, [store, maxFps]);

  return selectedState;
}
