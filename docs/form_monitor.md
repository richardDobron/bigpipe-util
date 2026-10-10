---
id: form_monitor
title: FormMonitor
sidebar_label: FormMonitor
---

`FormMonitor` tracks whether a form has unsaved changes. While the form is dirty, leaving the page asks the user first:
before a [page transition](page_transitions.md) with `confirm()`, and before the page is closed or reloaded with the
prompt of the browser, both through [Run.onBeforeUnload()](run.md#leaving-a-page).

```javascript
import FormMonitor from 'bigpipe-util/dist/core/FormMonitor';

const monitor = new FormMonitor(document.getElementById('post-form'), {
  message: 'You have unsaved changes.',   // or a function that gets the form, the default
  warn: true                              // false only tracks, without asking
});

monitor.subscribe('dirty', () => saveButton.disabled = false);
monitor.subscribe('clean', () => saveButton.disabled = true);
```

The form is clean when it is created. It becomes dirty when the values of its fields differ from that state (the
fields, checkboxes, selects and files that would be submitted), and clean again when they are changed back or the form
is reset.

| Method                       | Description                                                                         |
|------------------------------|-------------------------------------------------------------------------------------|
| `subscribe(event, callback)` | `change` (after every edit), `dirty` and `clean` (when the state changes). Returns `{ remove() }`. |
| `isDirty()`                  | Whether the form has unsaved changes.                                               |
| `reset()`                    | Takes the current values as the saved state, e.g. after saving without a form submit. |
| `destroy()`                  | Stops monitoring. Done automatically when the pagelet or canvas that holds the form is destroyed, or the page is left. |

## Saving

- A form with `rel="async"` (see the [Primer](primer.md)) becomes clean when its request succeeds, see the
  [success event](async_request.md#success-event). If the request fails, it stays dirty.
- A form that is submitted normally becomes clean when it is submitted, so the page that follows is not asked about
  it. A submit that is cancelled by another handler leaves the form dirty.

## From the server

The module is created with the form, so the server can start monitoring it:

```php
$response->call('bigpipe-util/dist/core/FormMonitor', null, [
    dobronBigPipeTransportMarker::element('post-form'),
    ['message' => 'Leave without saving the post?'],
]);
```
