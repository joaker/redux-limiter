## Synopsis
Limit the rate at which redux published change notifications

For each [action published to redux](http://redux.js.org/docs/basics/Actions.html), redux will attempt to push a change notification that will initiate a document rendering.  Since the human eye perceives 60 frames per second as being contiguous motion, initiating renderings more frequently than that is superfluous.  Time spent on superfluous renderings could be better spent elsewhere, such as processing more actions

redux-limiter throttles the rate of change notification.  Applications which mutate state more frequently than they need UI updates can receive significant performance boosts

## Motivation

Boost the throughput of actions through redux by ignoring render requests unnecessary for appearance of continuity

## Caveat Codor

This module is appropriate if you are using [stateless components](http://tylermcginnis.com/functional-components-vs-stateless-functional-components-vs-stateless-components/).  Since the object of this module is to skip update frames, you want to use it with components that are dependent only on components that are dependent on redux state alone

## Installation

Install the package:

$ npm install redux-limiter

Contribute to the package:

$ git clone https://github.com/joaker/redux-limiter.git

## Usage
```js
import {createStore} from 'redux';
import limitStore from 'redux-limiter';
import {Provider} from 'react-redux';
import App from 'components/App'; // or whatever your base component is

// create a reducer
const reducer = (state = 1, action) => {
  switch (action.type) {
    case 'NEXT':
      return state + 1;
  }
  return state;
}

// create a base store
const baseStore = createStore(reducer, defaultState);

// choose a rate to for throttle updates (rate >= 1; default rate is 1)
const throttleRate = 2;

// limit the store with react-limiter
const store = limitStore(baseStore, throttleRate);

// register the store with your provider
return (
  <Provider store={store}>
    <App/>
  </Provider>
);
```

## Benchmark

The [benchmark project](http://github.com/joaker/limiter-test) provides a simple sample application for demonstrating performance at different limiting rates

<!-- ## Tests

TODO: npm test -->

## Modules
react, redux, react-router
socketio, webpack/express
css-modules

<!-- mongodb -->

## Contributors

Jack Ofnotrade

## License

MIT
