import isPlainObject from 'lodash/isPlainObject'
import $$observable from 'symbol-observable'

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
export var ActionTypes = {
  INIT: '@@redux/INIT'
}

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [initialState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} enhancer The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
export default function createStoreLimiter(store, initialBlinkPerBroadcast = 8) {
  if (typeof store === 'undefined') {
    throw new Error('The store provided to createStoreLimiter was undefined.  An underlying store is required.')
  }

  var underlyingStore = store;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;

  let blinkPerBroadcast = initialBlinkPerBroadcast;
  function setRate(newRate){
    blinkPerBroadcast = newRate;
  }

  function getRate(){
    return blinkPerBroadcast;
  }

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return underlyingStore.getState();
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.')
    }

    var isSubscribed = true

    ensureCanMutateNextListeners()
    nextListeners.push(listener)

    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      isSubscribed = false

      ensureCanMutateNextListeners()
      var index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
    }
  }

  let needUpdate = false;
  let updateRequestCount = 0;
  let updatesCompletedCount = 0;

  // Set the flag that indicates if an update is required to 'true'
  const flagUpdateRequested = () => {
    updateRequestCount += 1;
    needUpdate = 'update requested';
  }

  // Clear the flag that indicates if an update is required
  const flagUpdateComplete = () => {
    updatesCompletedCount += 1;
    needUpdate = false;
  };

  /**
   * Broadcast - notify all registered listeners that this has changed
   */
  function broadcast(){
    var listeners = currentListeners = nextListeners
    for (var i = 0; i < listeners.length; i++) {
      listeners[i]()
    }
  }




  let broadcastRequest;
  let loopCount = 0;
  const inBroadcastLoop = () => {
    loopCount += 1;
    const isInFrame = (loopCount % blinkPerBroadcast) == 0;
    return isInFrame;
  };
  const broadcastLoop = () => {
    // Perform the broadcast, if a broadcast is needed
    if (needUpdate){
      const willBroadcast = inBroadcastLoop();
      if(willBroadcast){
        // flag the requested update as complete (do that asap)
        flagUpdateComplete();
        broadcast();
      }
    }

    // fetch the next frame, if we're still using this
    broadcastRequest = requestAnimationFrame(broadcastLoop);
  }

  /**
   * Start the rate limited broadcasts
   */
  const startBroadcast = () => {
    broadcastRequest = requestAnimationFrame(broadcastLoop);
  };


  /**
   * Stop the rate limited broadcasts
   */
  const stopBroadcast = () => {
    cancelAnimationFrame(broadcastRequest);
  }

  /**
   * Dispatches an action to the underlying store. It is the only way to trigger a state change
   *
   * Notifications from the underlying store will issue and update request that is throttled to the throttling rate
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */
  function dispatch(action) {

    // Forward the action to the underlying store
    underlyingStore.dispatch(action);

    return action
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    underlyingStore.replaceReducer(nextReducer);
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/zenparsing/es-observable
   */
  function observable() {
    var outerSubscribe = subscribe
    return {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        var unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  function subscribeToUnderlyingStore() {
    const unsubscriber = underlyingStore.subscribe(flagUpdateRequested);
    return unsubscriber;
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT })


  subscribeToUnderlyingStore();

  startBroadcast();

  return {
    start: startBroadcast,
    stop: stopBroadcast,
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable,
    setRate,
    getRate,
  }
}
