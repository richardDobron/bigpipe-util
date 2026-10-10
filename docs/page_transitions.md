---
id: page_transitions
title: Page transitions
sidebar_label: Page transitions
---

With page transitions, the links of the site load the next page into the element with the content of the page, the
canvas, instead of loading the page in full. The header, the scripts and everything the page has loaded stay, so only
the content of the next page and its pagelets are requested and rendered.

The server turns them on for a page by calling `Quickling.init()` with the canvas, see `Quickling` in the PHP library:

```javascript
Quickling.init(document.getElementById('content'), {
  version: '2026-10-10',          // a page of another version is loaded in full
  inactivePageRegex: '^/admin',   // paths always loaded in full
  badRequestKeys: ['print'],      // query parameters that need a full load
  sessionLength: 50               // after this many page transitions the next page is loaded in full
});
```

## Navigation

`PageTransitions` takes over the clicks on the links of the page and the GET forms. A link is left to the browser when
it goes to another origin, opens a new window (`target`), is a `download`, is handled by the [Primer](primer.md)
(`rel="async"`, `rel="dialog"`, `ajaxify`), has `rel="external"`, or is clicked with a modifier key or another button
than the main one. A link to a fragment of the current page only scrolls to it.

`PageTransitions.go(url)` loads a page from JavaScript. The back and forward buttons load the page of the history entry
and restore its scroll position.

When a page transition can't be used, the page is loaded in full: when the page must not be handled, the request
fails, or the server sends a page of another version, e.g. after a deploy.

## The request

`Quickling` requests the URL with `GET` and the parameter `quickling[version]`. The server responds with an
[AsyncResponse](async_request.md) whose `payload` has:

- `version`: the version of the page, compared with the one of `Quickling.init()`.
- `title`: the title of the page.
- `body_class`: the class of `<body>`.
- `redirect`: a URL to go to instead, with a page transition, or in full with `force`.

Before the response is applied, the pagelets in the canvas are destroyed, `pagelet/destroy` is informed with the
canvas as `root`, and the canvas is emptied. Its DOM operations then fill the canvas (the element the request is
relative to) and its pagelets are loaded like on a page. Only the response of the latest page transition is applied.

## Leaving a page

A page that is left runs its leave hooks, its timers are cleared, and its requests in flight are abandoned unless they
were sent with `setAllowCrossPageTransition(true)`, see [AsyncRequest](async_request.md):

```javascript
import PageTransitions from 'bigpipe-util/dist/PageTransitions';
import { setInterval } from 'bigpipe-util/dist/core/TimerStorage';

setInterval(refreshTimes, 60000);  // cleared when the page is left

PageTransitions.addBeforeLeaveHook(() => (form.dirty ? 'You have unsaved changes.' : null));
PageTransitions.addLeaveHook(() => player.stop());
```

`core/TimerStorage` has `setTimeout`, `setInterval`, `requestAnimationFrame` and `requestIdleCallback` (with their
`clear` and `cancel` functions) that end with the page, and `setTimeoutAcrossTransitions`,
`setIntervalAcrossTransitions`, `requestAnimationFrameAcrossTransitions` and `requestIdleCallbackAcrossTransitions`
for the timers that outlive it. The plain browser functions outlive the page too.

## Events

Informed through [Arbiter](arbiter.md):

| Event                          | When                                                       |
|--------------------------------|------------------------------------------------------------|
| `pre_page_transition`          | Before a page is left, with `from` and `to`.               |
| `page_transition`              | A handler loads the next page, with its `uri`.             |
| `onload/exit`                  | The page is left for the next one.                         |
| `ajaxpipe/send`                | The request for the next page is sent.                     |
| `ajaxpipe/first_response`      | The response is about to be applied.                       |
| `ajaxpipe/onbeforeclearcanvas` | The canvas is about to be emptied.                         |
| `quickling/response`           | The response was applied.                                  |
| `page_fragment_transition`     | A link to a fragment of the page was followed.             |

Handlers of other kinds of page transitions can be added with `PageTransitions.registerHandler(handler, priority)`: a
handler gets the URL and returns `true` when it loads the page.
