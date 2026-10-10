---
id: poller
title: Poller
sidebar_label: Poller
---

`Poller` sends a request again and again, e.g. to check for new notifications. The next request is sent an interval
after the last one finished, so slow responses never pile up. Like any [AsyncRequest](async_request.md), the DOM
operations and modules of a response are applied.

The server starts a poller with a module call, see `Poller` in the PHP library:

```javascript
new Poller({
  uri: '/notifications/poll',
  data: { since: 1728550000 },
  interval: 30000
});
```

| Option                   | Default | Description                                                                                       |
|--------------------------|---------|---------------------------------------------------------------------------------------------------|
| `uri`, `method`, `data`  | `GET`   | The request to send. Without `uri`, `setupRequest` sets up the request.                           |
| `setupRequest`           |         | `(request, poller) => …`, sets up every request, e.g. its handler.                                |
| `interval`               |         | Milliseconds between two requests, at least 2 seconds, or a function of the number of requests.   |
| `maxRequests`            | no limit| The poller stops after this many requests and informs `done`.                                     |
| `muteWhenHidden`         | `true`  | Pauses while the page is hidden, e.g. in a background tab.                                        |
| `muteWhenIdle`           | `0`     | Pauses when the user was not active for this many milliseconds, and goes on once they are.        |
| `clearOnQuicklingEvents` | `true`  | A [page transition](page_transitions.md) ends the poller.                                         |
| `dontStart`              | `false` | Waits for `start()`.                                                                              |
| `id`                     |         | Lets the server control the poller, see below.                                                    |

A poller is controlled with `start()`, `stop()`, `reset()`, `mute()`, `resume()`, `skip()` (skips the next request),
`setInterval(ms)` and `destroy()`. `subscribe('done', callback)` is called when it stops after `maxRequests`.

## Controlled by the server

With an `id`, every request of the poller sends the `__poller` parameter with it, and a response can call the methods of
the poller as the module of that id, e.g. to poll less often or to stop:

```json
{"jsmods": {"require": [["poller_notifications", "setInterval", [60000]]]}}
```

## Visibility and user activity

The poller uses two modules that can be used on their own:

- `core/Visibility`: `isHidden()`, and `subscribe(Visibility.HIDDEN | Visibility.VISIBLE, callback)` when the page is
  hidden or shown.
- `core/UserActivity`: `isActive(ms)`, whether the user scrolled, moved the mouse, clicked, typed or focused the window
  in the last `ms` milliseconds, and `subscribe(callback)` when they are active again.
