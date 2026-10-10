<img src="bigpipe.svg" alt="BigPipe logo">

The JavaScript runtime of BigPipe, a microframework for PHP and JavaScript. It sends requests, applies the DOM operations a server responds with, shows the pagelets of a page as they arrive and calls JavaScript modules the server asks for. The server side is [richarddobron/bigpipe](https://github.com/richardDobron/bigpipe-php) for PHP, but any backend that speaks the [response format](docs/how_it_works.md) works.


## 👀 Demo App
Try the app with [live demo](http://bigpipe.xf.cz).

## 📕 Full documentation
https://richarddobron.github.io/bigpipe-php/

## ℹ️ Requirements
* A bundler: [webpack](https://webpack.js.org/), [Vite](https://vite.dev/) or similar
* A backend that answers with BigPipe responses, e.g. `richarddobron/bigpipe` for PHP 8.0 or higher

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

> Vite needs an alias for the `events` module used by dialogs, see the
> [getting started guide](docs/getting_started.md#vite-the-events-module).

> Already using your own `window.require`? It keeps working, see the
> [getting started guide](docs/getting_started.md#upgrading-from-windowrequire).

### 4. Add this line to the page footer:
```html
<?= \dobron\BigPipe\BigPipe::render() ?>
```
It prints the script that sends the pagelets and the modules of the page to the browser, so load the entrypoint with a classic `<script src>` before it. With a deferred `<script type="module">` entrypoint, hand the modules to [ServerJS](docs/server_js.md) once `DOMContentLoaded` fires, see the [getting started guide](docs/getting_started.md#3-handle-the-modules-of-the-first-page-load).

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

## 🧩 What is inside

* [Primer](docs/primer.md): makes links and forms with `rel` asynchronous.
* [AsyncRequest](docs/async_request.md): requests with handlers, errors, retries, `abandon()` and streamed responses.
* [Pagelets](docs/pagelets.md): independent parts of a page, displayed as they arrive, loaded on demand with `UIPagelet` and `MorePagerFetchOnScroll`.
* [Page transitions](docs/page_transitions.md): load the next page into the layout instead of in full.
* [Bootloader](docs/bootloader.md): loads CSS and JavaScript once, and modules only when they are called.
* [ServerJS](docs/server_js.md): calls the modules of a response, keeps instances and defined modules.
* [Poller](docs/poller.md): requests a URL again and again, controlled by the server.
* [Dialogs](docs/dialog.md), [DOM](docs/dom.md) (with morphing), [Arbiter](docs/arbiter.md) and [utilities](docs/utilities.md).

## 🛜 Request API

```javascript
import AsyncRequest from 'bigpipe-util/dist/async/AsyncRequest';

const request = (new AsyncRequest('/ajax/remove.php'))
  // or .setURI('/ajax/remove.php')
  .setMethod('POST')
  .setData({
    param: 'value',
  })
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

A release is a tag of the version in `package.json`, e.g. `npm version minor && git push --follow-tags`. The `Release`
workflow then tests, builds and publishes it to npm; `dist` is built on publish and isn't in the repository.

## 🤝 Contributing

We welcome contributions! If you'd like to help improve this project, feel free to open an issue or submit a pull request.

## 📜 License

The MIT License (MIT). Please see [License File](LICENSE) for more information.

[blog]: https://www.facebook.com/notes/facebook-engineering/bigpipe-pipelining-web-pages-for-high-performance/389414033919
