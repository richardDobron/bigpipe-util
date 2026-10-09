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

The phases are exported as `BIGPIPE_PHASE`, `PAGELET_PHASE` and `RESOURCE_PHASE` from
`bigpipe-util/dist/BigPipe`. `BigPipe` is a singleton, so `new BigPipe()` always returns the same instance with
the registered `pagelets`.

## Content Security Policy

With a nonce-based policy, `BigPipe` adds the nonce of the page to the stylesheets and scripts it loads. It takes the
nonce from the first `<script nonce="...">` on the page, e.g. the inline script that calls `onPageletArrive`.
