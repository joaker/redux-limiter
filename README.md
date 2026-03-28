## Synopsis

Throttle Redux selector re-renders to animation frame rate via a React hook.

Every Redux dispatch triggers a potential re-render. When actions arrive faster than the display can refresh (~60fps), components re-render more often than they need to. `redux-limiter` solves this with `useThrottledSelector` — a drop-in alternative to `useSelector` that coalesces rapid store updates into at most one re-render per animation frame.

## Motivation

Boost the throughput of actions through Redux by skipping render requests that are invisible to the human eye.

## Caveat

This hook is appropriate for components whose props derive entirely from Redux state. Since intermediate frames are intentionally skipped, any component with non-Redux local state that must stay in sync per-dispatch should continue using `useSelector`.

## Demo

See redux-limiter in action by clicking "Optimize" in this [seating optimizer](https://immense-lake-53069.herokuapp.com/#/Venue?_k=fsv0q2).

## Installation

```
npm install redux-limiter
```

## Usage

```tsx
import { useThrottledSelector } from 'redux-limiter';

function Counter() {
  // Re-renders at most once per animation frame (~60fps),
  // even if the store is updated hundreds of times per second.
  const count = useThrottledSelector((state: RootState) => state.counter.count);
  return <div>{count}</div>;
}
```

No store wrapping required. Swap `useSelector` for `useThrottledSelector` in the components where you want throttled updates.

## API

```ts
useThrottledSelector<TSelected>(
  selector: (state: any) => TSelected,
  equalityFn?: (prev: TSelected, next: TSelected) => boolean,
  maxFps?: number
): TSelected
```

| Parameter    | Default        | Description                                                                                          |
|--------------|----------------|------------------------------------------------------------------------------------------------------|
| `selector`   | required       | Selector function, same as `useSelector`                                                             |
| `equalityFn` | `Object.is`    | Controls whether a new selector result triggers a re-render                                          |
| `maxFps`     | device refresh | Cap updates to at most this many times per second (e.g. `30` for 30fps instead of the default 60fps) |

## Migrating from v1

v1 wrapped the Redux store globally:

```js
const store = limitStore(baseStore, throttleRate);

<Provider store={store}>
  <App />
</Provider>
```

v2 works at the component level — no store wrapping needed:

```tsx
// Before (v1 + useSelector)
const value = useSelector((state: RootState) => state.value);

// After (v2)
const value = useThrottledSelector((state: RootState) => state.value);
```

## Benchmark

The [benchmark project](http://github.com/joaker/limiter-test) provides a sample application for demonstrating performance at different throttle rates.

## Contributors

Jack Ofnotrade

## License

MIT
