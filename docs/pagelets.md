---
id: pagelets
title: Pagelets
sidebar_label: Pagelets
---

A pagelet is an independent part of the page, like a sidebar or a feed, with its own content, CSS and JavaScript.
`BigPipe` shows each pagelet as soon as its CSS is loaded and loads the JavaScript files of the pagelets only after all
of them are displayed, so scripts never delay the content.

The server renders the pagelets, see `dobron\BigPipe\Pagelet` in the PHP library. For every pagelet, it outputs:

```javascript
(window.__bigpipe = window.__bigpipe || []).push(['arrive', {
  id: "sidebar",
  css: ["/css/sidebar.css"],
  js: ["/js/sidebar.js"],
  domops: [["setContent", "#sidebar", false, {"__html": "..."}]],
  jsmods: {"require": [["Sidebar", "init", []]]},
  onload: {"require": [["SidebarChat", "connect", []]]},
  onafterload: {"require": [["SidebarPrefetch", "start", []]]},
  is_last: true,
}]);
```

The script queues the pagelet until the entrypoint has run, so the entrypoint can be loaded any way, see
[Getting started](getting_started.md#3-handle-the-modules-of-the-first-page-load).

## Lifecycle

1. **Arrive.** The CSS files of the pagelet start loading through the [Bootloader](bootloader.md), which loads
   every file once.
2. **Display.** When its CSS (and its [display resources](bootloader.md#display-resources)) is loaded, the DOM
   operations of the pagelet are applied and its `jsmods` are handled by [ServerJS](server_js.md). A module of the
   page bundle runs right away, a [bootloadable module](bootloader.md#bootloadable-modules) once its files are loaded.
3. **Load JS.** When the last pagelet (`is_last`) has arrived and all pagelets are displayed, the JS files of all
   pagelets start loading. A pagelet with `jsNonBlock` loads its JS files right after it is displayed instead.
4. **Onload.** When the JS files of a pagelet are loaded, its `onload` jsmods are handled: the module calls that
   need those files. Pagelets run their `onload` jsmods in the order they arrived.
5. **After load.** When every pagelet has run its `onload` jsmods and the window has loaded, the optional
   `onafterload` jsmods of the pagelets are handled. Use them for work that must not compete with the page, like
   prefetching or analytics.

The phases are exported as `BIGPIPE_PHASE` and `PAGELET_PHASE` from `bigpipe-util/dist/BigPipe`. `BigPipe` is a
singleton, so `new BigPipe()` always returns the same instance with the registered `pagelets`.

## Display order

Pagelets are displayed as soon as their CSS is loaded, in any order. The server can order
them, see `Pagelet::setPhase()` and `Pagelet::displayAfter()` in the PHP library:

- `phase` (default `0`): a pagelet is displayed after the pagelets of a lower phase that have arrived, e.g. the
  content of the page in phase 0 before the sidebar and ads in phase 1. The server sends the pagelets in the order
  of their phases.
- `display_dependency`: the ids of the pagelets it is displayed after, e.g. a chat that needs the feed on the page.
  It waits for them to arrive.

```javascript
(window.__bigpipe = window.__bigpipe || []).push(['arrive', {
  id: "chat",
  phase: 1,
  display_dependency: ["feed"],
  // ...
}]);
```

The JS of the pagelets still loads only when all of them are displayed.

## Events and timing

Every pagelet informs `Pagelet/event` through [Arbiter](arbiter.md) on each step of its
lifecycle, with the `event`, the `id` of the pagelet and the time `ts` from `performance.now()`:

| Event          | When                                            |
|----------------|-------------------------------------------------|
| `arrive`       | The pagelet arrived.                            |
| `css`          | Its CSS files start loading.                    |
| `cssLoad`      | Its CSS files are loaded.                       |
| `displayStart` | Its DOM operations are about to be applied.     |
| `display`      | It is displayed.                                |
| `jsStart`      | The JS files start loading.                     |
| `jsDone`       | Its JS files are loaded, its `jsmods` run next. |
| `onload`       | Its `jsmods` have run.                          |

The times are kept in `pagelet.timings` and marked with `performance.mark()` as `pagelet_<id>_<event>`, so they
show in the performance panel of the browser. The names are exported as `PAGELET_EVENT`.

The page informs its own events, exported as `BIGPIPE_EVENT`, with the time `ts`: `BigPipe/init` when `BigPipe` is
created, `BigPipe/tti` when the [time to interactive](#time-to-interactive) is reached, `BigPipe/allPageletsDisplayed`
when the last pagelet has arrived and all are displayed, and `BigPipe/allPageletsLoaded` when all have run their `jsmods`. They are informed as states, so a module that subscribes later is called right
away, and they are marked with `performance.mark()` as well. The pagelets of a response, e.g. a lazy pagelet, do
not count for them: they load their JS on their own, once the last of them has arrived and all are displayed. The
pagelets of a [page transition](page_transitions.md) are the next page, which informs them again.

```javascript
new Arbiter().subscribe('Pagelet/event', ({ event, id, ts }) => {
  if (event === 'display') {
    analytics.track('pagelet_displayed', { id, ts });
  }
});
```

## Content Security Policy

With a nonce-based policy, `BigPipe` adds the nonce of the page to the stylesheets and scripts it loads. It takes the
nonce from the `CSPNonce` module, which the PHP library defines in the page script after `BigPipe::setNonce()`, or
else from the first `<script nonce="...">` on the page, e.g. the inline script of the page.

With [Trusted Types](https://developer.mozilla.org/docs/Web/API/Trusted_Types_API), a policy that requires them
(`require-trusted-types-for 'script'`) blocks strings in `innerHTML`, `insertAdjacentHTML`, the `src` of a script and
the `Function` constructor. BigPipe passes the HTML of the server, the scripts the Bootloader loads and the code of the
deprecated `eval` DOM operation through its own policy, `bigpipe`, so allow it:

```text
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types bigpipe
```

The policy passes the values as they are: they come from the server of the page, like the page itself. Browsers
without Trusted Types get the strings.

## Loading pagelets from an endpoint

A pagelet can be loaded later from an endpoint, e.g. a pagelet below the fold. The server prints its placeholder,
the root element of the pagelet, and calls `UIPagelet.loadFromEndpoint()` with it, see `LazyPagelet` in the PHP
library:

```javascript
UIPagelet.loadFromEndpoint('/pagelets/feed', 'pagelet_feed', { page: 2 }, { load: 'visible' });
```

It requests the URL with the data when the placeholder comes within 300 pixels of the viewport (`visible`, default),
when the browser is idle (`idle`) or right away (`load`). The response puts the pagelet in the place of the
placeholder, and `BigPipe` loads its CSS and JS like on a page. While it loads, the placeholder has the `async-saving`
class, and errors go to the [default error handler](async_request.md#default-error-handler). When the pagelet the
placeholder is in is destroyed, it stops waiting and aborts the request.

## Infinite scroll

A list loads its next page when the user scrolls to its end. The server
prints a plain "See more" link handled by the [Primer](primer.md) and creates `MorePagerFetchOnScroll` with it, see
`MorePager` in the PHP library:

```javascript
new MorePagerFetchOnScroll(document.getElementById('more_pager'), 300);
```

It clicks the link when it comes within the offset of the viewport. The response appends the items and replaces the
link with the one of the next page, or removes it. `remove()` stops waiting, and so does destroying the pagelet the
link is in.

## Time to interactive

The pagelets of the first `phase`s are the content the user is waiting for, the others are the rest of the page. The
server tells which ones with `tti_phase`, a field of a pagelet: the time to interactive is reached when every pagelet
of the phases up to it is displayed.

```javascript
new Arbiter().subscribe('BigPipe/tti', ({ phase, ts }) => {
  analytics.track('interactive', { phase, ts });
});
```

The event is informed once per page as a state, so a module that subscribes later is called right away. It waits until
no pagelet of the phases up to `tti_phase` can arrive any more: the server marked the last pagelet of the phase with
`last_in_phase`, or a pagelet of a later phase or the last pagelet has arrived. A page transition forgets it for the
next page.

## Phases

The server marks the last pagelet of every phase with `last_in_phase`, so the browser knows a phase is complete
without waiting for the next one, which may take longer to render. Once every pagelet of a phase and of the phases
before it is displayed, `BigPipe/phaseDisplayed` is informed with the phase, e.g. to start what can wait for the
first screen. It is informed once, not as a state, so a module that subscribes later is not called;
`new BigPipe().isPhaseDisplayed(phase)` tells whether the phase is displayed already:

```javascript
new Arbiter().subscribe('BigPipe/phaseDisplayed', ({ phase }) => {
  if (phase === 0) {
    startChat();
  }
});
```

Without `last_in_phase`, a phase is complete once the last pagelet of the page has arrived.

Right after the time to interactive, the browser downloads the `js` and `allResources` of the pagelets of the later
phases in the background (`<link rel="preload">`), without running them. The scripts then are in the cache when the pagelets
load their JS, after all of them are displayed, and nothing competes with the content of the first phases before. A
pagelet of a later phase that arrives after the time to interactive is prefetched when it arrives.

## Destroying pagelets

A pagelet is destroyed when a pagelet with the same id replaces it, e.g. when the server refreshes it, or when the
DOM operations of a response remove its root element. Destroying a pagelet destroys the pagelets inside it, runs its
destructors, informs `Pagelet/destroy` with its `id` and `root` through [Arbiter](arbiter.md) and empties its root
element.

A module stops what it started for a pagelet in a destructor, e.g. a subscription or a timer:

```javascript
import BigPipe from 'bigpipe-util/dist/BigPipe';
import Arbiter from 'bigpipe-util/dist/core/Arbiter';

export default class Feed {
  init(element) {
    const subscription = new Arbiter().subscribe('POST/ADDED', post => this.add(post));
    const timer = setInterval(() => this.refreshTimes(), 60000);

    new BigPipe().getPageletForNode(element)?.addDestructor(() => {
      subscription.remove();
      clearInterval(timer);
    });
  }
}
```

`getPageletForNode()` finds the pagelet an element is in, by its root element `#pagelet_<id>`. `getRoot()` returns
the root of a displayed pagelet, and `removePagelet(pagelet)` destroys a pagelet.

## Errors

A failing pagelet does not stop the page. A pagelet that fails to arrive is reported, and the next pagelets arrive as
usual. When the DOM operations of a pagelet fail, the error is reported, `Pagelet/error` is informed through
[Arbiter](arbiter.md) with its `id` and the `error`, and the pagelet still counts as displayed: its modules run and the
JS of the page loads. Every module call is isolated too, see [ServerJS](server_js.md).

```javascript
new Arbiter().subscribe('Pagelet/error', ({ id }) => {
  document.getElementById('pagelet_' + id).classList.add('pagelet-failed');
});
```

Errors are reported with `reportError()`: they are thrown asynchronously, so they reach `window.onerror` and the error
tracking of the page without stopping BigPipe.
