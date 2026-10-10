---
id: pagelets
title: Pagelets
sidebar_label: Pagelets
---

A pagelet is an independent part of the page, like a sidebar or a feed, with its own content, CSS and JavaScript.
`BigPipe` shows each pagelet as soon as its CSS is loaded and runs the JavaScript of the pagelets only after all of
them are displayed, so scripts never delay the content.

The server renders the pagelets, see `dobron\BigPipe\Pagelet` in the PHP library. For every pagelet, it outputs:

```javascript
(new (require("bigpipe-util/src/BigPipe"))).onPageletArrive({
  id: "sidebar",
  css: ["/css/sidebar.css"],
  js: ["/js/sidebar.js"],
  domops: [["setContent", "#sidebar", false, {"__html": "..."}]],
  jsmods: {"require": [["Sidebar", "init", []]]},
  onafterload: {"require": [["SidebarPrefetch", "start", []]]},
  is_last: true,
});
```

Like the inline script of [ServerJS](server_js.md), it needs `require` to exist. When the entrypoint is loaded as
`<script type="module">` (Vite), it runs after the page is parsed. Use `<script type="module">` for the inline
scripts as well: they run in document order after the entrypoint, and the pagelets are displayed once the page has
been parsed instead of while it streams. With a classic `<script src>` (webpack) the entrypoint, placed before the
pagelets, makes them display progressively.

## Lifecycle

1. **Arrive.** The CSS files of the pagelet start loading. Files shared by more pagelets are loaded once.
2. **Display.** When its CSS is loaded, the DOM operations of the pagelet are applied.
3. **Load JS.** When the last pagelet (`is_last`) has arrived and all pagelets are displayed, the JS files of all
   pagelets start loading.
4. **Run.** When the JS files of a pagelet are loaded, its `jsmods` are handled by [ServerJS](server_js.md).
   Pagelets run their `jsmods` in the order they arrived.
5. **After load.** When every pagelet has run its `jsmods` and the window has loaded, the optional `onafterload`
   jsmods of the pagelets are handled. Use them for work that must not compete with the page, like prefetching or
   analytics.

The phases are exported as `BIGPIPE_PHASE`, `PAGELET_PHASE` and `RESOURCE_PHASE` from
`bigpipe-util/dist/BigPipe`. `BigPipe` is a singleton, so `new BigPipe()` always returns the same instance with
the registered `pagelets`.

## Content Security Policy

With a nonce-based policy, `BigPipe` adds the nonce of the page to the stylesheets and scripts it loads. It takes the
nonce from the `CSPNonce` module, which the PHP library defines in the page script after `BigPipe::setNonce()`, or
else from the first `<script nonce="...">` on the page, e.g. the inline script that calls `onPageletArrive`.

## Loading pagelets from an endpoint

Like the `UIPagelet` of Facebook, a pagelet can be loaded later from an endpoint, e.g. a pagelet below the fold. The
server prints its placeholder, the root element of the pagelet, and calls `UIPagelet.loadFromEndpoint()` with it, see
`LazyPagelet` in the PHP library:

```javascript
UIPagelet.loadFromEndpoint('/pagelets/feed', 'pagelet_feed', { page: 2 }, { load: 'visible' });
```

It requests the URL with the data when the placeholder comes within 300 pixels of the viewport (`visible`, default),
when the browser is idle (`idle`) or right away (`load`). The response puts the pagelet in the place of the
placeholder, and `BigPipe` loads its CSS and JS like on a page. While it loads, the placeholder has the `async-saving`
class, and errors go to the [default error handler](async_request.md#default-error-handler).

## Infinite scroll

A list loads its next page when the user scrolls to its end. The server
prints a plain "See more" link handled by the [Primer](primer.md) and creates `MorePagerFetchOnScroll` with it, see
`MorePager` in the PHP library:

```javascript
new MorePagerFetchOnScroll(document.getElementById('more_pager'), 300);
```

It clicks the link when it comes within the offset of the viewport. The response appends the items and replaces the
link with the one of the next page, or removes it. `remove()` stops waiting.

## Destroying pagelets

Like the `PageletSet` of Facebook, a pagelet is destroyed when a pagelet with the same id replaces it, e.g. when the
server refreshes it, or when the DOM operations of a response remove its root element. Destroying a pagelet destroys the pagelets inside it, runs its destructors, informs
`pagelet/destroy` with its `id` and `root` through [Arbiter](arbiter.md) and empties its root element.

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
