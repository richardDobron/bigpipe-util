<img src="bigpipe.svg" alt="BigPipe logo">

The JavaScript runtime of BigPipe, a microframework for PHP and JavaScript. It sends requests, applies the DOM operations a server responds with, shows the pagelets of a page as they arrive, loads the next page into the layout and calls the JavaScript modules the server asks for. The server side is [richarddobron/bigpipe](https://github.com/richardDobron/bigpipe-php) for PHP, but any backend that speaks the [response format](docs/how_it_works.md) works.

## 👀 Demo App
Try the app with [live demo](http://bigpipe.etexweb.sk). It is a Laravel 13 application, [installed from the PHP repository](https://github.com/richardDobron/bigpipe-php/tree/main/demo-app), with:

- **Tutorials**: a working example of every feature, each with its code and a panel that shows what the server sent back.
- **A demo app**: a blog, a shop, a dashboard of streamed pagelets, notifications and a profile, with every page a page transition.

## 📕 Full documentation
https://richarddobron.github.io/bigpipe-php/

The pages of this package are in [docs](docs): [getting started](docs/getting_started.md), [how it works](docs/how_it_works.md) and one page for every part, listed [below](#-what-is-inside).

## ℹ️ Requirements
* A bundler: [webpack](https://webpack.js.org/), [Vite](https://vite.dev/) or similar. The package ships ES modules and CommonJS.
* A backend that answers with BigPipe responses, e.g. `richarddobron/bigpipe` for PHP 8.0 or higher.

## 📦 Installation
Follow these steps to install and set up:

### 1. Install composer package:
```shell
$ composer require richarddobron/bigpipe
```

### 2. Install npm package:
```shell
$ npm install bigpipe-util
```

### 3. Add the following to /path/to/resources/js/app.js:
```javascript
import Primer from 'bigpipe-util/dist/Primer';
import { setModuleLoader } from 'bigpipe-util/dist/ModuleRegistry';

Primer();
```

Then tell BigPipe how to load your modules by name (the server calls e.g. `$response->call('UserLoggedInAlert')`):

**webpack**
```javascript
setModuleLoader(modulePath => require('./' + modulePath).default);
```

**Vite**
```javascript
const modules = import.meta.glob(['./**/*.js', '!./app.js'], { eager: true });

setModuleLoader(modulePath => modules[`./${modulePath}.js`]?.default);
```

> Already using your own `window.require`? It keeps working, see the
> [getting started guide](docs/getting_started.md#upgrading-from-windowrequire).

### 4. Add this line to the page footer:
```html
<?= \dobron\BigPipe\BigPipe::render() ?>
```
It prints the script that sends the pagelets and the modules of the page to the browser. It queues them until the entrypoint has run, so the entrypoint can be a classic, `async`, `defer` or module script, before or after it. See the [getting started guide](docs/getting_started.md#3-handle-the-modules-of-the-first-page-load).

## 🚀 Quick start

Write a module, a default export:

```javascript
// resources/js/UserLoggedInAlert.js
export default function UserLoggedInAlert(username) {
  alert(`Welcome, ${username}!`);
}
```

and call it from the server:

```php
$response = new \dobron\BigPipe\AsyncResponse();

$response->call('UserLoggedInAlert', null, ['Marvin']);
$response->send();
```

Make a link or a form asynchronous with the [Primer](docs/primer.md), and answer with DOM operations:

```html
<a href="/items/123/remove" ajaxify="/ajax/remove.php?id=123" rel="async">Remove</a>
```

```php
$response = new \dobron\BigPipe\AsyncResponse();

$response->remove('#item-' . (int) $_GET['id']);
$response->send();
```

## 🧩 What is inside

**Requests and responses**
* [Primer](docs/primer.md): makes links and forms with `rel` asynchronous, with the progress of file uploads, and can load `AsyncRequest` on demand.
* [AsyncRequest](docs/async_request.md): requests with handlers, structured errors, timeouts, retries, `abandon()`, streamed responses, a `success` event and a CSRF token that is refreshed when it expires.
* [How it works](docs/how_it_works.md): the response format, DOM operations and `AsyncResponse`. The HTML of a pagelet can come in a hidden container of the page (`__container`) instead of the JSON.
* [ServerJS](docs/server_js.md): calls the modules of a response, keeps instances and defined modules, transport markers, and [modules the server chooses](docs/server_js.md#modules-the-server-chooses) (`__rc`).
* [DOM](docs/dom.md) (with morphing) and [Arbiter](docs/arbiter.md), a small event system with states.

**Pages**
* [Pagelets](docs/pagelets.md): independent parts of a page, displayed as they arrive, in [phases](docs/pagelets.md#phases) (`last_in_phase`, `BigPipe/phaseDisplayed`), with lifecycle events, timings and a time to interactive (`BigPipe/tti`); loaded on demand with `UIPagelet` and `MorePagerFetchOnScroll`. They work with [Trusted Types](docs/pagelets.md#content-security-policy).
* The inline scripts of a page queue the pagelets and modules in `window.__bigpipe` until the entrypoint has run, see [getting started](docs/getting_started.md#3-handle-the-modules-of-the-first-page-load).
* [Page transitions](docs/page_transitions.md): load the next page into the layout instead of in full, and notice [a new deploy](docs/page_transitions.md#a-new-deploy) (`BigPipeRevision`, `BigPipe/newRevision`).
* [Bootloader](docs/bootloader.md): loads CSS and JavaScript once, and modules only when they are called, with `ifRequired`, `requireDeferred` and `requireCond`.
* [Poller](docs/poller.md): requests a URL again and again, controlled by the server.
* [Run](docs/run.md): `onLoad`, `onAfterLoad`, `onBeforeUnload`, `onLeave`, `onUnload` and `onCleanupOrLeave`, for full page loads and page transitions alike.

**User interface**
* [Layer](docs/layer.md): a base for everything that floats, with behaviors (hide on <kbd>Esc</kbd>, outside click and page transition, focus handling, fades) and `ModalLayer` and `ContextualLayer`. It sets no class names, so Bootstrap, Tailwind or your own CSS work.
* [Dialogs](docs/dialog.md): dialogs that are layers, with a built-in modal without dependencies. Bootstrap markup by default; the templates and class names can be replaced for Tailwind or your own CSS.
* [Form](docs/form.md) and [FormMonitor](docs/form_monitor.md): read a form the way PHP does, and warn before unsaved changes are lost.
* [Utilities](docs/utilities.md): `onVisible`, `DataStore`, `Cookie`, `WebStorage`, `KeyEventController` and more. Timers that end with the page are in `TimerStorage`, see [leaving a page](docs/page_transitions.md#leaving-a-page).

## 🛜 Request API

```javascript
import AsyncRequest from 'bigpipe-util/dist/async/AsyncRequest';

const request = (new AsyncRequest('/ajax/remove.php'))
  // or .setURI('/ajax/remove.php')
  .setMethod('POST')
  .setData({
    param: 'value',
  })
  .setOption('retries', 2)
  .setInitialHandler(() => {
      // pre-request callback function
  })
  .setHandler((jsonResponse) => {
      // A function to be called if the request succeeds
  })
  .setErrorHandler((xhr, error) => {
      // A function to be called if the request fails
  })
  .setFinallyHandler((xhr) => {
      // after request callback function
  })
  .send();

if (OH_NOES_WE_NEED_TO_CANCEL_RIGHT_NOW_OR_ELSE) {
  request.abort();
}
```

## 🧱 Building blocks

A floating menu that hides on a click outside, on <kbd>Esc</kbd> and before a page transition:

```javascript
import ContextualLayer from 'bigpipe-util/dist/core/layer/ContextualLayer';
import HideOnBlur from 'bigpipe-util/dist/core/layer/HideOnBlur';
import HideOnEscape from 'bigpipe-util/dist/core/layer/HideOnEscape';
import HideOnTransition from 'bigpipe-util/dist/core/layer/HideOnTransition';

new ContextualLayer(menu, {
  context: button,
  position: 'below',
  behaviors: [HideOnBlur, HideOnEscape, HideOnTransition],
}).show();
```

Run code when the page is left, however it is left, and ask before unsaved work is lost:

```javascript
import Run from 'bigpipe-util/dist/core/Run';
import FormMonitor from 'bigpipe-util/dist/core/FormMonitor';

Run.onLeave(() => socket.close());
new FormMonitor(document.getElementById('post-form'), { message: 'Leave without saving?' });
```

Call a module only if it is loaded already, or get a reference to one that loads later:

```javascript
import ifRequired from 'bigpipe-util/dist/core/ifRequired';
import requireDeferred from 'bigpipe-util/dist/core/requireDeferred';

ifRequired('Editor', Editor => Editor.save());
requireDeferred('Editor').onReady(Editor => Editor.open());
```

# ⚡️ What all can be Ajaxifed?

## 🔗 Links
```html
<a href="#"
   ajaxify="/ajax/remove.php"
   rel="async">Remove Item</a>
```

## 📝 Forms
```html
<form action="/submit.php"
      method="POST"
      rel="async">
    <input name="user">
    <input type="submit" name="Done">
</form>
```

A form with a chosen file is uploaded in the background, and reports its progress as an `uploadprogress` event, to `<progress>` elements inside it and as the CSS variable `--upload-progress`.

## 💬 Dialogs
```html
<a href="#"
   ajaxify="/ajax/modal.php"
   rel="dialog">Open Modal</a>
```

## 🌟 Inspiration

BigPipe is inspired by Facebook's BigPipe. For more details
read their blog post: [Pipelining web pages for high performance][blog].

## 💡 Motivation

There is a large number of PHP projects for which moving to modern frameworks like Laravel Livewire, React, Vue.js (and many more!) could be very challenging.

The purpose of this library is to rapidly reduce the continuously repetitive code to work with the DOM and improve the communication barrier between PHP and JavaScript.

## 📑 Versioning

| bigpipe-util | richarddobron/bigpipe |
|--------------|-----------------------|
| 0.2.x        | 1.x                   |
| 2.x          | 2.x                   |

From 2.0, `bigpipe-util` and the PHP library share the major and minor version: a release that changes what the server
sends comes out in both, e.g. 2.1.x of `bigpipe-util` works with 2.1.0 of the PHP library. Fixes are released on their
own as patch versions.

A release is the version in `package.json`, published by hand with `npm publish`. Before it publishes, npm runs the lint,
the tests and the build (`prepublishOnly`); `dist` is built on publish and isn't in the repository.

## 🤝 Contributing

We welcome contributions! If you'd like to help improve this project, feel free to open an issue or submit a pull request.

```shell
npm install
npm test        # vitest
npm run lint
npm run build   # CommonJS in dist, ES modules in dist/esm
```

## 📜 License

The MIT License (MIT). Please see [License File](LICENSE) for more information.

[blog]: https://www.facebook.com/notes/facebook-engineering/bigpipe-pipelining-web-pages-for-high-performance/389414033919
