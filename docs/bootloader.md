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
are. A script that fails to load is requested again twice, after half a second and after two more seconds. A resource
that still fails counts as loaded, so one broken file does not stop the page: it is reported with an error and
`getErrorURLs()` lists it, e.g. to load the page in full when a script is missing. A stylesheet that has not loaded
after 5 seconds counts as loaded too, so a slow file does not hold up its pagelet and the JS of the page. A URL that is not in
the map is loaded as the given `type`, or by its extension (`.css` as a stylesheet, anything else as a script).
Scripts run in the order they were added.

## Bootloadable modules

A module that the page rarely needs, like an editor, does not have to be in the bundle of the page. The server lists
the resources it needs in `bootloadable`, with a pagelet or a response, and `ServerJS` loads them before it calls the
module:

```javascript
{
  "resource_map": {
    "editor.css": {"type": "css", "src": "/static/editor.css"},
    "editor.js": {"type": "js", "src": "/static/editor.js"}
  },
  "bootloadable": {"Editor": ["editor.css", "editor.js"]},
  "jsmods": {"require": [["Editor", "open", [{"__e": "post"}]]]}
}
```

The script has to make the module available when it runs, e.g. a chunk of the bundle that calls `registerModules()`
from `bigpipe-util/dist/ModuleRegistry`. The other module calls of the response do not wait for it. A call also waits
for the bootloadable modules it gets as arguments (`{"__m": "Editor"}`) and for the class of an instance it calls or
gets as an argument.

`requireLazy(modules, callback)` does the same in JavaScript: it loads the resources of the bootloadable modules and
calls back with the modules. Modules that are not bootloadable are required right away.

```javascript
import { requireLazy } from 'bigpipe-util/dist/Bootloader';

button.addEventListener('click', () => {
  requireLazy(['Editor'], Editor => Editor.open(textarea));
});
```

## Using a module only if it is there

`ifRequired(name, whenLoaded, whenMissing)` calls `whenLoaded` with the module if it is loaded already, and
`whenMissing` otherwise, without loading anything. It returns what the callback returns. A bootloadable module is
loaded once all its resources are, any other module when the module loader finds it.

```javascript
import ifRequired from 'bigpipe-util/dist/core/ifRequired';

ifRequired('Editor', Editor => Editor.save(), () => console.log('The editor was never opened.'));
```

`requireDeferred(name)` is a reference to a module that is loaded later. Pass it around instead of the module, and
resolve it when you need it:

```javascript
import requireDeferred from 'bigpipe-util/dist/core/requireDeferred';

const editor = requireDeferred('Editor');

editor.preload();                       // preloads the resources while the network is idle
editor.getModuleIfRequired();           // the module, or undefined while it's not loaded
editor.load().then(Editor => {});       // loads the resources, rejects if the module can't be required
editor.loadImmediately(Editor => {});   // the same with a callback
editor.onReady(Editor => {}).remove();  // calls back once it's loaded, `remove()` stops waiting
```

`requireCond(condition, whenTrue, whenFalse)` requires the module named by the branch that matches, so a page can
pick between two implementations without requiring both:

```javascript
import requireCond from 'bigpipe-util/dist/core/requireCond';

const Chart = requireCond(window.matchMedia('(max-width: 600px)').matches, 'SparkLine', 'FullChart');
```

## Display resources

A pagelet waits for its `css` before it is displayed, and for its `js` before it runs its `onload` jsmods. With a
resource map it can split its resources further:

- `displayResources`: what the pagelet needs to be displayed, e.g. its stylesheet.
- `allResources`: everything else, e.g. the stylesheet of a dialog it opens or its scripts. They load when the JS of
  the pagelets loads, and the pagelet runs its `onload` jsmods once they are loaded.

```javascript
{
  "id": "feed",
  "displayResources": ["feed.css"],
  "allResources": ["dialog.css", "feed.js"],
  "resource_map": {
    "feed.css": {"type": "css", "src": "/static/feed.css"},
    "dialog.css": {"type": "css", "src": "/static/dialog.css"},
    "feed.js": {"type": "js", "src": "/static/feed.js"}
  }
}
```

A stylesheet in `allResources` does not delay the display of the pagelet.

## Preloading and prefetching

A bootloadable module with a priority above 0 is preloaded with `<link rel="preload">` while the network is idle,
higher priorities first, so that it loads fast when the server or `requireLazy()` calls it. Its scripts run once the
browser is idle.

```javascript
{
  "bootloadable": {
    "Dialog": {"resources": ["dialog.css", "dialog.js"], "priority": 2},
    "Editor": ["editor.css", "editor.js"]
  }
}
```

`Bootloader.preloadModules(['Dialog'])` preloads the resources of modules right away, e.g. when the user hovers the
button that opens the dialog.

A pagelet can also prefetch what the user is likely to need next: its `prefetchRsrcs` load as soon as it arrives,
and its `prefetchJsmods` run once they are loaded.

```javascript
{
  "id": "feed",
  "prefetchRsrcs": ["composer.js"],
  "prefetchJsmods": {"require": [["Composer", "warmUp"]]}
}
```
