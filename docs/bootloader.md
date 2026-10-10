---
id: bootloader
title: Bootloader
sidebar_label: Bootloader
---

`Bootloader` loads the stylesheets and scripts of the page: the CSS and JS of the [pagelets](pagelets.md) and of
the modules the server calls. Every file is loaded once, also when two pagelets or two names point to it, and a
`<link rel="stylesheet">` or `<script src>` already on the page is not loaded again. With a
[Content Security Policy](pagelets.md#content-security-policy), the elements get the nonce of the page.

## Resource map

The server can name its files in a resource map, e.g. to send short names instead of long URLs with content hashes.
A pagelet or a response carries the map in `resource_map`, and its `css` and `js` can then use the names:

```javascript
{
  "id": "feed",
  "css": ["feed.css"],
  "js": ["feed.js"],
  "resource_map": {
    "feed.css": {"type": "css", "src": "/static/feed.1a2b3c.css"},
    "feed.js": {"type": "js", "src": "/static/feed.4d5e6f.js"}
  }
}
```

A name keeps the first resource it was given. Anything that is not a name in the map is a URL.

## Loading resources

```javascript
import Bootloader from 'bigpipe-util/dist/Bootloader';

Bootloader.setResourceMap({ 'editor.css': { type: 'css', src: '/static/editor.css' } });
Bootloader.loadResources(['editor.css', '/static/editor.js'], () => openEditor());
```

`loadResources(names, callback, type)` calls back once all the resources are loaded, right away when they already
are. A resource that fails to load counts as loaded, so one broken file does not stop the page. A URL that is not in
the map is loaded as the given `type`, or by its extension (`.css` as a stylesheet, anything else as a script).
Scripts run in the order they were added.
