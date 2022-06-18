<img src="bigpipe.svg">

This library currently implements small part of [Facebook BigPipe][blog] so far, but the advantage is to efficiently insert/replace content and work with the DOM. It is also possible to easily call JavaScript modules from PHP.


## Demo App
Try the app with [live demo](http://bigpipe.xf.cz).

## Requirements
* PHP 7.1 or higher
* Node 8, 10+.
* Webpack

## Installation

These steps are required:
1. Install composer package:
```shell
$ composer require richarddobron/bigpipe
```

2. Install npm package:
```shell
$ npm install bigpipe-util
```

3. Add this lines to /path/to/resources/js/app.js:
```javascript
import Primer from 'bigpipe-util/src/Primer';

Primer();

window.require = (modulePath) => {
  return modulePath.startsWith('bigpipe-util/')
    ? require('bigpipe-util/' + modulePath.substring(13) + '.js').default
    : require('./' + modulePath).default;
};
```

4. Create file /path/to/resources/js/ServerJS.js
   - this step is optional, but if you skip it, use this in next step:
   ```require("bigpipe-util/ServerJS")```
```javascript
import ServerJSImpl from 'bigpipe-util/src/ServerJS';
export default class ServerJS extends ServerJSImpl {
}
```

5. Add this lines to page footer:
```html
<script>
    (new (require("ServerJS"))).handle(<?=json_encode(\dobron\BigPipe\BigPipe::jsmods())?>);
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
  .send();

if (OH_NOES_WE_NEED_TO_CANCEL_RIGHT_NOW_OR_ELSE) {
  request.abort();
}
```

# What all can be Ajaxifed?

## Links
```html
<a href="#"
   ajaxify="/ajax/remove.php"
   rel="async">Remove Item</a>
```

## Forms
```html
<form action="/submit.php"
      method="POST"
      rel="async">
    <input name="user">
    <input type="submit" name="Done">
</form>
```

## Dialogs
```html
<a href="#"
   ajaxify="/ajax/modal.php"
   rel="dialog">Open Modal</a>
```

## Inspiration

BigPipe is inspired by the concept behind Facebook's BigPipe. For more details
read their blog post: [Pipelining web pages for high performance][blog].

## Motivation

There is a large number of PHP projects for which moving to modern frameworks like Laravel Livewire, React, Vue.js (and many more!) could be very challenging.

The purpose of this library is to rapidly reduce the continuously repetitive code to work with the DOM and improve the communication barrier between PHP and JavaScript.

## Credits

- [Richard Dobroň][link-author]

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.

[link-author]: https://github.com/richardDobron
[blog]: https://www.facebook.com/notes/facebook-engineering/bigpipe-pipelining-web-pages-for-high-performance/389414033919
