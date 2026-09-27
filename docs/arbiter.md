---
id: arbiter
title: Arbiter
sidebar_label: Arbiter
---

Arbiter is a simple publish/subscribe event system for communication between modules. All instances share the same
subscribers, so a module can inform others without a reference to them.

```javascript
import Arbiter from 'bigpipe-util/dist/core/Arbiter';

const onOrderReady = (order) => console.log(order);

new Arbiter().subscribe('ORDER/READY', onOrderReady);

// Somewhere else
new Arbiter().inform('ORDER/READY', {
  orderId: 12300,
  total: 100.99,
});
```

| Method                           | Description                                                          |
|----------------------------------|----------------------------------------------------------------------|
| `subscribe(event, callback)`     | Calls the callback with the arguments of every `inform()`.           |
| `unsubscribe(event, callback)`   | Removes the callback.                                                |
| `inform(event, ...args)`         | Calls the subscribers of the event.                                  |
| `clearSubscribers(event)`        | Removes all subscribers of the event.                                |
| `getSubscribers(event)`          | Returns the subscribers of the event.                                |

An error thrown by a subscriber doesn't stop the others. It's rethrown asynchronously, so it still shows in the
console.

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
