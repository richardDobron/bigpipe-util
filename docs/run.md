---
id: run
title: Run
sidebar_label: Run
---

`Run` registers callbacks for the moments of a page's life: when it is loaded, before it is left and when it is left.
They work for a full page load and for a [page transition](page_transitions.md) alike, so the same code is right
whether the user closes the tab or follows a link that loads the next page into the canvas. Every function returns a
subscription, `remove()` unregisters the callback, and an error in a callback is reported without stopping the others.

```javascript
import Run from 'bigpipe-util/dist/core/Run';

Run.onLoad(() => init());                       // the DOM is ready
Run.onAfterLoad(() => prefetch());              // the window has loaded
Run.onBeforeUnload(() => (dirty ? 'You have unsaved changes.' : null));
Run.onLeave(() => socket.close());              // the page is left
Run.onUnload(() => navigator.sendBeacon('/log', data));
Run.onCleanupOrLeave(element, () => observer.disconnect());
```

| Function                          | Runs                                                                                           |
|-----------------------------------|------------------------------------------------------------------------------------------------|
| `onLoad(callback)`                | When the DOM is ready, or right away if it already is.                                          |
| `onAfterLoad(callback)`           | After the `load` event of the window, or on the next tick if it already happened.               |
| `onBeforeUnload(hook)`            | Before the page is left. The hook returns a message to ask the user first, or nothing.          |
| `onLeave(callback)`               | Once, when the page is left with a page transition, closed, reloaded or navigated away from.   |
| `onUnload(callback)`              | When the page is closed, reloaded or navigated away from (`pagehide`), not on a page transition. |
| `onCleanupOrLeave(element, callback)` | Once, when the pagelet or canvas that holds the element is destroyed, or the page is left.   |

## Leaving a page

`onBeforeUnload()` asks for confirmation before the user loses unsaved work. For a page transition the message is shown
with `confirm()` and declining keeps the page; for a close or a reload the browser shows its own prompt, with its own
text. When a page transition ends in a full page load because no handler loads the page, the user is asked once.

`onLeave()` is the place to stop what the page started: sockets, observers, listeners on the document. Use
`onUnload()` only for what must run when the page really goes away, like sending a beacon, as a page transition keeps
the document.

[FormMonitor](form_monitor.md) uses `onBeforeUnload()` to ask before a form with unsaved changes is left.

`onCleanupOrLeave()` ties a cleanup to an element. The elements inside a pagelet are gone when the pagelet is destroyed,
e.g. when a page transition empties the canvas or a response replaces the pagelet, long before the page is left:

```javascript
class Clock {
  init(element) {
    const timer = setInterval(() => (element.textContent = new Date().toLocaleTimeString()), 1000);

    Run.onCleanupOrLeave(element, () => clearInterval(timer));
  }
}
```

The timers of `core/TimerStorage` and the requests of a page end with it without any of this, see
[Page transitions](page_transitions.md#leaving-a-page).
