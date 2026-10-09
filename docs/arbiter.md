---
id: arbiter
title: Arbiter
sidebar_label: Arbiter
---

Arbiter is a simple publish/subscribe event system for communication between modules. All instances share the same
subscribers, so a module can inform others without a reference to them.

```javascript
import Arbiter from 'bigpipe-util/dist/core/Arbiter';

const subscription = new Arbiter().subscribe('ORDER/READY', (order) => console.log(order));

// Somewhere else
new Arbiter().inform('ORDER/READY', {
  orderId: 12300,
  total: 100.99,
});

// When the callback is no longer needed, e.g. the component is removed
subscription.remove();
```

| Method                           | Description                                                          |
|----------------------------------|----------------------------------------------------------------------|
| `subscribe(event, callback)`     | Calls the callback with the arguments of every `inform()`. Returns a subscription, `remove()` removes it. |
| `unsubscribe(event, callback)`   | Removes the callback.                                                |
| `inform(event, ...args)`         | Calls the subscribers of the event.                                  |
| `informState(event, ...args)`    | Like `inform()`, and callbacks subscribed later are called right away with these arguments. |
| `clearState(event)`              | Forgets the arguments of `informState()`.                            |
| `clearSubscribers(event)`        | Removes all subscribers of the event.                                |
| `getSubscribers(event)`          | Returns the subscribers of the event.                                |

An error thrown by a subscriber doesn't stop the others. It's rethrown asynchronously, so it still shows in the
console.

## State

An event that happens once, like "the user is logged in", is easy to miss: a module that subscribes after it was
informed would wait forever. Inform it with `informState()` instead, and later subscribers are called right away
with the last arguments:

```javascript
new Arbiter().informState('USER/LOGGED_IN', user);

// Later, e.g. in a module loaded afterwards
new Arbiter().subscribe('USER/LOGGED_IN', (user) => greet(user)); // called right away
```

Combined with [ServerJS](server_js.md), the server can inform your modules too:

```javascript title="OrderEvents.js"
import Arbiter from 'bigpipe-util/dist/core/Arbiter';

export default {
  ready(order) {
    new Arbiter().inform('ORDER/READY', order);
  },
};
```

```php
$response->bigPipe()->require("require('OrderEvents').ready()", [$order]);
```
