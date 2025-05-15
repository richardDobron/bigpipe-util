<img src="bigpipe.svg" alt="BigPipe logo">

This library currently implements small part of [Facebook BigPipe][blog] so far, but the advantage is to efficiently insert/replace content and work with the DOM. It is also possible to easily call JavaScript modules from PHP.


## 👀 Demo App
Try the app with [live demo](http://bigpipe.xf.cz).

## 📕 Full documentation
https://richarddobron.github.io/bigpipe-php/

## ℹ️ Requirements
* PHP 7.1 or higher
* Webpack

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
import Primer from 'bigpipe-util/src/Primer';

Primer();

window.require = (modulePath) => {
  return modulePath.startsWith('bigpipe-util/')
    ? require('bigpipe-util/' + modulePath.substring(13) + '.js').default
    : require('./' + modulePath).default;
};
```

### 4. Add these lines to the page footer:
```html
<script>
    (new (require("bigpipe-util/ServerJS"))).handle(<?=json_encode(\dobron\BigPipe\BigPipe::jsmods())?>);
</script>
```

## Request API

```javascript
import AsyncRequest from 'bigpipe-util/src/AsyncRequest';

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
  .setErrorHandler((xhr) => {
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

## 🤝 Contributing

We welcome contributions! If you'd like to help improve this project, feel free to open an issue or submit a pull request.

## 📜 License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.

[blog]: https://www.facebook.com/notes/facebook-engineering/bigpipe-pipelining-web-pages-for-high-performance/389414033919
