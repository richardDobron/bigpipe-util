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

- A bundler that supports dynamic `require()` with an expression, such as [webpack](https://webpack.js.org/).
- A backend that answers with BigPipe responses, e.g. `richarddobron/bigpipe` for PHP 8.0+.

## 1. Install the package

```shell
npm install bigpipe-util
```

## 2. Set up the entrypoint

In your entrypoint (e.g. `resources/js/app.js`), start the [Primer](primer.md) and define `window.require`. BigPipe
calls it to load the modules that the server refers to by name:

```javascript title="resources/js/app.js"
import Primer from 'bigpipe-util/dist/Primer';

Primer();

window.require = (modulePath) => {
  return modulePath.startsWith('bigpipe-util/')
    ? require('bigpipe-util/dist/' + modulePath.replace(/^bigpipe-util\/(src|dist)\//, '') + '.js').default
    : require('./' + modulePath).default;
};
```

- Module names that start with `bigpipe-util/` are loaded from this package. The server may refer to them as
  `bigpipe-util/src/...`, which is mapped to the published `dist` folder.
- Any other name is loaded relative to the entrypoint, so `require('UserLoggedInAlert')` on the server loads
  `resources/js/UserLoggedInAlert.js`.

## 3. Handle the modules of the first page load

At the end of the page, pass the modules required during the page render to [ServerJS](server_js.md):

```php title="layout.php"
<script>
    (new (require("bigpipe-util/src/ServerJS"))).handle(<?=json_encode(\dobron\BigPipe\BigPipe::jsmods())?>);
</script>
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

$response->bigPipe()->require("require('MyModule').init()", [
    'first argument',
    'second argument',
]);

$response->send();
```

## Next steps

- Make links and forms asynchronous with the [Primer](primer.md).
- Send requests from your code with [AsyncRequest](async_request.md).
- Learn what the server sends back in [How it works](how_it_works.md).
