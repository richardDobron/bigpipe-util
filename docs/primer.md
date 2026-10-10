---
id: primer
title: Primer
sidebar_label: Primer
---

The Primer makes links and forms asynchronous without writing any JavaScript. It registers a single `click` and
`submit` listener on the document, so it also works for content added later.

```javascript
import Primer from 'bigpipe-util/dist/Primer';

Primer();
```

The Primer cancels the click or submit at once and sends the request through `AsyncRequest` as soon as it is available,
so it can be started early and `AsyncRequest` loaded on demand, see [Loading AsyncRequest on demand](#loading-asyncrequest-on-demand).

## Links

Add the URL to call in `ajaxify` and pick the behaviour with `rel`:

```html
<a href="#" ajaxify="/ajax/remove.php" rel="async">Remove item</a>
```

| `rel`        | Method | Description                                   |
|--------------|--------|-----------------------------------------------|
| `async`      | `GET`  | Sends the request and handles the response.   |
| `async-post` | `POST` | The same as `async`, but with `POST`.         |
| `dialog`     | `POST` | Intended for requests that open a dialog.     |

Links with a real `href` (other than `#`) still open normally when clicked with the middle mouse button or with a
modifier key, so users can open them in a new tab.

## Forms

Forms with `rel="async"` are submitted in the background. The form data, including the name and value of the
button that submitted it, is sent to `ajaxify` or, if missing, to `action`, with the form's `method`.

```html
<form action="/ajax/subscribe.php" method="POST" rel="async">
  <input name="email" type="email">
  <button type="submit" name="plan" value="free">Subscribe</button>
</form>
```

While the request is running:

- the inputs, selects and textareas are made read-only and the submit button is disabled, unless the form has the
  `disable-prevent-form` class,
- an element with the `form-loader` class inside the form gets the `loading` class.

## Loading AsyncRequest on demand

The Primer does not import `AsyncRequest`: it asks the [Bootloader](bootloader.md) for the module
`bigpipe-util/dist/async/AsyncRequest`, which the module loader resolves like the modules the server calls (the
`ModuleRegistry` of this package provides it). A click before the module is available is not lost and does not
follow the link: it is cancelled and the request is sent the moment the module is loaded. Further clicks on the same
link, or submits of the same form, are ignored in the meantime, and the data of a form is the data at the time of the
submit.

This lets a small entrypoint with the Primer run early, e.g. in the `<head>`, while `AsyncRequest` and the rest of
the library load later:

```javascript title="early.js"
import Primer from 'bigpipe-util/dist/Primer';
import Bootloader from 'bigpipe-util/dist/Bootloader';

Bootloader.setResourceMap({ 'main.js': { type: 'js', src: '/static/main.js' } });
Bootloader.enableBootload({ 'bigpipe-util/dist/async/AsyncRequest': ['main.js'] });

Primer();
```

`main.js` is the entrypoint with `import 'bigpipe-util/dist/ModuleRegistry'`; once it has run, the module resolves
and the waiting requests are sent. If the module can't be loaded, the error is reported and the link or form works
again.

## Loading state

The link or form gets the `async-saving` class while its request is running. Clicks on a link with this class are
ignored, which prevents double submits. Use it to show a spinner:

```css
.async-saving {
  cursor: progress;
  opacity: 0.6;
}
```

## Errors

The requests of links and forms have no error handler of their own, so their errors go to the
[default error handler](async_request.md#default-error-handler), e.g. to show them in a dialog.

## Relative targets

The link or form becomes the relative element of the request. DOM operations with an empty selector target it,
see [DOM operations](how_it_works.md#dom-operations).
