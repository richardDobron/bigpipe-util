---
id: async_request
title: AsyncRequest
sidebar_label: AsyncRequest
---

`AsyncRequest` sends a request to an endpoint that responds with the BigPipe [response format](how_it_works.md). The
DOM operations and modules of the response are applied automatically, before your handler is called.

```javascript
import AsyncRequest from 'bigpipe-util/dist/async/AsyncRequest';

const request = new AsyncRequest('/ajax/remove.php')
  .setMethod('POST')
  .setData({ id: 123 })
  .setHandler((response) => {
    console.log(response.payload);
  })
  .send();

// Cancel the request if it's no longer needed
request.abort();
```

## Methods

All setters return the request, so they can be chained.

| Method                            | Description                                                                          |
|-----------------------------------|--------------------------------------------------------------------------------------|
| `setURI(uri)`                     | The URL to call. It can also be passed to the constructor.                           |
| `setMethod(method)`               | The HTTP method, `POST` by default.                                                  |
| `setData(data)`                   | An object (sent URL-encoded, nested objects as `a[b]=c`, `null` as an empty value, booleans as `1` and `0`, `undefined` and empty arrays left out) or a `FormData`. |
| `setRequestHeader(name, value)`   | Adds a request header.                                                               |
| `setRelative(element)`            | The element that sent the request, see [relative targets](primer.md#relative-targets). |
| `setStatusElement(element)`      | The element gets the status class while the request is running.                      |
| `setStatusClass(className)`      | The status class, `async-saving` by default.                                         |
| `send()`                          | Sends the request and returns the `XMLHttpRequest`.                                  |
| `abort()`                         | Aborts the request.                                                                  |

Every request is sent with the `X-Requested-With: XMLHttpRequest` header and a `__req` parameter with a counter of
the requests made from the page.

## Handlers

| Method                   | Called                                                                                  |
|--------------------------|-----------------------------------------------------------------------------------------|
| `setInitialHandler(fn)`  | Right before the request is sent.                                                       |
| `setPreResponseHandler(fn)` | With the parsed response, before its DOM operations, pagelets and modules are applied. Returning `false` drops the response. |
| `setHandler(fn)`         | With the parsed response, after its DOM operations and modules were applied.            |
| `setErrorHandler(fn)`    | With the `XMLHttpRequest` and the [error](#errors) when the request failed.              |
| `setTransportErrorHandler(fn)` | Instead of the error handler, for failures without a BigPipe response: `http`, `invalid_response`, `network` and `timeout` errors. |
| `setFinallyHandler(fn)`  | With the `XMLHttpRequest` after the request finished, successfully or not.              |
| `setUploadProgressHandler(fn)` | With the upload `ProgressEvent` (`loaded` and `total` bytes) while the data is sent, e.g. a file. |
| `setTimeoutHandler(ms, fn)` | When there is no response in `ms` milliseconds: the request is aborted and `fn` gets a `timeout` error, or the transport error handler without `fn`. |

## Errors

The error handler gets the `XMLHttpRequest` and an error object, the same for every kind of failure:

```javascript
new AsyncRequest('/ajax/save')
  .setErrorHandler((xhr, error) => {
    if (error.isTransient) {
      // e.g. offer to try again
    }
    showMessage(error.summary, error.description);
  })
  .send();
```

| Property      | Description                                                                                  |
|---------------|----------------------------------------------------------------------------------------------|
| `type`        | Why the request failed, one of `ERROR_TYPE` exported by `AsyncRequest`, see below.          |
| `code`        | The code the server sent, or the HTTP status for `http` errors.                               |
| `status`      | The HTTP status, `0` when there is no response.                                               |
| `summary`     | A short title of the error.                                                                  |
| `description` | A sentence for the user.                                                                     |
| `isWarning`   | The server marked the error as a warning.                                                    |
| `isTransient` | Trying again may help: network errors, timeouts, 5xx and 429 statuses, or as the server marked it. |
| `payload`     | The payload of a `server` error, `null` otherwise.                                          |

- `server`: the server sent an error with `$response->setError()`. The DOM operations and modules of the response
  are applied anyway, e.g. to mark an invalid field.
- `http`: the server answered with a 4xx/5xx status.
- `invalid_response`: the response is not a BigPipe response, e.g. a PHP fatal error page.
- `network`: there is no response, e.g. the browser is offline.
- `timeout`: there was no response in time, see `setTimeoutHandler()`.

### Default error handler

Requests without an error handler pass their errors to the default one, e.g. to show them in a dialog:

```javascript
import AsyncRequest from 'bigpipe-util/dist/async/AsyncRequest';
import Dialog from 'bigpipe-util/dist/core/Dialog';

AsyncRequest.setDefaultErrorHandler((xhr, error) => {
  new Dialog().showFromModel({ title: error.summary, body: error.description });
});
```

## CSRF tokens

When the server defines the `CSRFToken` module, e.g. with `BigPipe::setCSRFToken()` in PHP, every request that can
change data (not `GET`, `HEAD` or `OPTIONS`) sends the token, but only to URLs of the same origin:

```json
{
  "define": [["CSRFToken", {"token": "...", "header": "X-CSRF-TOKEN", "param": null}]]
}
```

- `header`: the request header with the token, unless the request sets this header itself.
- `param`: the field of the data with the token.

A later response that defines the module again replaces the token. Without the module, add the token yourself:

```javascript
const token = document.querySelector('meta[name=csrf-token]').getAttribute('content');

new AsyncRequest('/ajax/save')
  .setRequestHeader('X-CSRF-TOKEN', token)
  .send();
```
