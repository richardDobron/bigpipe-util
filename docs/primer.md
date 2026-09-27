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

## Loading state

The link or form gets the `async-saving` class while its request is running. Clicks on a link with this class are
ignored, which prevents double submits. Use it to show a spinner:

```css
.async-saving {
  cursor: progress;
  opacity: 0.6;
}
```

## Relative targets

The link or form becomes the relative element of the request. DOM operations with an empty selector target it,
see [DOM operations](how_it_works.md#dom-operations).
