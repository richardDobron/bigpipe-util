---
id: getting_started
title: Getting started
sidebar_label: Getting started
---

`bigpipe-util` is the JavaScript runtime of [BigPipe](https://richarddobron.github.io/bigpipe-php/). It sends
requests, applies the DOM operations the server responds with and calls the JavaScript modules the server asks for.
The server side is usually [bigpipe-php](https://github.com/richardDobron/bigpipe-php), but any backend that speaks
the [response format](how_it_works.md) works.

## Requirements

- A bundler, such as [webpack](https://webpack.js.org/) or [Vite](https://vite.dev/). `bigpipe-util` ships both
  ES modules and CommonJS and doesn't depend on a specific bundler. Loading your own modules by name is up to your
  application, see [step 2](#2-set-up-the-entrypoint).
- A backend that answers with BigPipe responses, e.g. `richarddobron/bigpipe` for PHP 8.0+.

## 1. Install the package

```shell
npm install bigpipe-util
```

## 2. Set up the entrypoint

In your entrypoint (e.g. `resources/js/app.js`), start the [Primer](primer.md) and tell BigPipe how to load your
modules. The server refers to them by name, e.g. `require('UserLoggedInAlert')`, and BigPipe calls the loader to
get the module. The loader has to return the module itself (its default export) synchronously.

**webpack**

```javascript title="resources/js/app.js"
import Primer from 'bigpipe-util/dist/Primer';
import { setModuleLoader } from 'bigpipe-util/dist/ModuleRegistry';

Primer();

setModuleLoader(modulePath => require('./' + modulePath).default);
```

**Vite**

```javascript title="resources/js/app.js"
import Primer from 'bigpipe-util/dist/Primer';
import { setModuleLoader } from 'bigpipe-util/dist/ModuleRegistry';

Primer();

// Eager, because modules are called synchronously. The entrypoint itself is excluded.
const modules = import.meta.glob(['./**/*.js', '!./app.js'], { eager: true });

setModuleLoader(modulePath => modules[`./${modulePath}.js`]?.default);
```

- Any name is loaded relative to the entrypoint, so `require('UserLoggedInAlert')` on the server loads
  `resources/js/UserLoggedInAlert.js`. Names can contain folders, e.g. `Admin/Panel`.
- A loader that returns nothing for a name makes BigPipe throw `module "..." was not found`.
- Modules of this package are resolved automatically. The server may refer to them as `bigpipe-util/src/...` (or
  `bigpipe-util/dist/...`); you don't need to handle them in the loader.
- `setModuleLoader()` also defines `window.require`, which the inline script in the next step uses. Pass
  `{ global: false }` as the second argument to prevent it.
- Single modules can be registered under an exact name with `registerModules({ Name: module })`. They win over the
  loader.

### Vite: the `events` module

[Dialogs](dialog.md) use `modal-vanilla`, which imports the Node.js module `events`. Vite doesn't polyfill Node.js
modules for the browser, so loading fails with `Class extends value [object Object] is not a constructor or null`.
Install the npm package of the same name and point the import to it (the trailing slash selects the package instead of
the Node.js module):

```shell
npm install events
```

```javascript title="vite.config.js"
export default defineConfig({
  resolve: { alias: { events: 'events/' } }
});
```

Restart Vite with `--force` to rebuild its dependency cache. webpack 5 picks the `events` package up on its own when
it's installed.

### Upgrading from `window.require`

Defining `window.require` yourself still works when no loader is set, so existing setups don't have to change. The
loader above replaces the `bigpipe-util/` branch of the old function: you only write the part for your own modules.

## 3. Handle the modules of the first page load

At the end of the page, print the script that sends the [pagelets](pagelets.md) and the modules required during the
page render to the browser. With PHP it's one line:

```php title="layout.php"
<?= \dobron\BigPipe\BigPipe::render() ?>
```

The entrypoint can be loaded any way: a classic `<script src>`, `async`, `defer` or a `<script type="module">` as Vite
adds it, before or after this script. The inline scripts queue their calls in `window.__bigpipe`, and
`ModuleRegistry` runs them in their order once the module loader is set, and every later one right away:

```javascript
(window.__bigpipe = window.__bigpipe || []).push(['arrive', pagelet]); // BigPipe.onPageletArrive()
(window.__bigpipe = window.__bigpipe || []).push(['handle', jsmods]);  // ServerJS.handle()
```

With an entrypoint loaded before the pagelets, e.g. a classic script in the `<head>`, every pagelet is displayed as
soon as it arrives. A deferred entrypoint displays the pagelets that arrived before it once it runs. Without
`setModuleLoader()`, the queue runs after the entrypoint when the page defines its own `window.require`, or else
once the document is parsed; `processQueue()` from `ModuleRegistry` runs it yourself.

## Optional: debug messages

Some warnings (e.g. a DOM operation that matches nothing) are logged only when `__DEV__` is defined and truthy. In
webpack define it with `DefinePlugin`, in Vite with `define`:

```javascript title="vite.config.js"
export default defineConfig({
  define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production') }
});
```

## 4. Write your first module

A module is a default export: a function, a class or an object.

```javascript title="resources/js/MyModule.js"
export default class MyModule {
  init(...args) {
    console.log('Hello world!', args);
  }
}
```

Call it from the server:

```php
$response = new \dobron\BigPipe\AsyncResponse();

$response->call('MyModule', 'init', [
    'first argument',
    'second argument',
]);

$response->send();
```

## Next steps

- Make links and forms asynchronous with the [Primer](primer.md).
- Send requests from your code with [AsyncRequest](async_request.md).
- Learn what the server sends back in [How it works](how_it_works.md).
