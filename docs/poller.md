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
| `shareAcrossTabs`        | `false` | Only one tab sends the requests, see [below](#shared-across-tabs). `true` shares by `uri`, a string by that name. |
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

## Shared across tabs

A user with the page open in ten tabs would send ten requests per interval. With `shareAcrossTabs`, the tabs with a
poller of the same name elect a leader, and only the leader sends the requests. The other tabs get its responses and
apply them like their own, so every tab shows the new notifications.

```javascript
new Poller({ uri: '/notifications/poll', interval: 30000, shareAcrossTabs: true });
```

- A hidden tab gives up the lead with `muteWhenHidden`, so a visible tab polls when there is one. When every tab is
  hidden, none does.
- When the leader is closed, hidden or leaves the page, the next tab leads and sends a request right away.
- The other tabs apply the DOM operations, modules and pagelets of the responses, not the handlers of `setupRequest`.
  Error responses are not shared.
- A call of a response to the poller of the leader, e.g. `[id, 'setInterval', [60000]]`, is a call to the poller of
  each tab, whose `id` differs.
- `isLeader()` tells whether this tab sends the requests.

It needs the [Web Locks API](https://developer.mozilla.org/docs/Web/API/Web_Locks_API) and `BroadcastChannel`; without
them, every tab polls. `core/TabLeader` elects the leader and can be used on its own:
`TabLeader.request(name, onLead)` calls `onLead` once this tab leads, and its `release()` gives up the lead.

## Visibility and user activity

The poller uses two modules that can be used on their own:

- `core/Visibility`: `isHidden()`, and `subscribe(Visibility.HIDDEN | Visibility.VISIBLE, callback)` when the page is
  hidden or shown. It informs `Visibility/hidden` and `Visibility/visible` through [Arbiter](arbiter.md), with the
  `changeTime`.
- `core/UserActivity`: `isActive(ms)`, whether the user scrolled, moved the mouse, clicked, typed or focused the window
  in the last `ms` milliseconds, and `subscribe(callback)` when they are active again after more than half a second.
  It informs `UserActivity/activity` through [Arbiter](arbiter.md), with the DOM `event`, the `idleness` in
  milliseconds and the time of the inform, `lastInform`.
