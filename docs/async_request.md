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
| `abandon()`                       | Aborts the request without calling its handlers, except the finally handler.         |
| `setOption(name, value)`          | Sets an option, see [retries](#retries).                                             |
| `setAllowCrossPageTransition(allow)` | Lets the request outlive its page, see below.                                    |

Every request is sent with the `X-Requested-With: XMLHttpRequest` header and a `__req` parameter with a counter of
the requests made from the page.

A [page transition](page_transitions.md) abandons the requests of the page it leaves, so their responses never reach
the next page. A request that must outlive its page, e.g. one that saves something in the background, calls
`setAllowCrossPageTransition(true)`.

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

## Success event

When a response without an error has been handled, a `success` event bubbles from the relative element of the request,
e.g. the link or form of the [Primer](primer.md), with the response as `event.detail.response`. For a streamed
response it is dispatched with the last part. Listen to it on the element or any element above it:

```javascript
form.addEventListener('success', ({ detail }) => console.log(detail.response.payload));
```

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
| `isWarning`   | Always `false`: a warning is not an error, see below.                                        |
| `isTransient` | Trying again may help: network errors, timeouts, 5xx and 429 statuses, or as the server marked it. |
| `payload`     | The payload of a `server` error, `null` otherwise.                                          |

- `server`: the server sent an error with `$response->setError()`. The DOM operations and modules of the response
  are applied anyway, e.g. to mark an invalid field. An error the server marked as a warning (`$isWarning`) is not a
  failure: the handler gets the response, with its `error`, `errorSummary` and `errorDescription`. The response may
  have an error status, e.g. `send(422)`: it is applied the same way, and `status` is the status.
- `http`: the server answered with a status other than 2xx, e.g. 404 or 500. Redirects are followed by the browser.
  A BigPipe response with an error status but without an error is applied too.
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

## Token refresh

A token expires, e.g. with the session of the user, and the server then rejects the request. `AsyncRequest` gets a new token
and sends the request again, once, so the user does not lose the form they filled in. The server can do it two ways:

- **Answer with a new token.** A response with `"csrf_refresh": 1` that defines the `CSRFToken` module again says the
  request was rejected because of its token. The response is applied, which replaces the token, and the request is sent
  again with the new one. Its handlers are not called for the rejection; they are called for the second response.
- **Name a refresh URL.** When the `CSRFToken` module has a `refresh` URL and the server responds with `419` (the status
  Laravel uses for an expired token), the browser requests the URL, a response that defines the token, and then sends the
  request again.

```json
{ "define": [["CSRFToken", {"token": "...", "header": "X-CSRF-TOKEN", "refresh": "/csrf-token"}]] }
```

A request is sent again once: if the token is rejected again, the second response is handled like any other, or the `419` is
an `http` error. If the refresh itself fails, the `419` is reported. A request that was abandoned meanwhile is not sent.

## Retries

A request with the `retries` option is sent again right away when it fails with a network error, e.g. a dropped
connection, as many times as the option says. The handlers are called once, for the last attempt. HTTP errors,
invalid responses and timeouts are not retried.

```javascript
new AsyncRequest('/ajax/feed')
  .setMethod('GET')
  .setOption('retries', 2)
  .send();
```

Retry only requests that are safe to send twice, like `GET` requests: the server may have handled a request whose
response was lost.

## Streamed responses

With the `stream` option, the request sends the `__stream` parameter, and the server can answer in parts, e.g. every
pagelet as soon as it is rendered, see `AsyncResponse::stream()` in the PHP library. Every part is a response of its
own: it is applied, and the pre-response handler and the handler (or the error handler) are called with it, as soon as
it arrives. `is_first` and `is_last` of the response tell which part it is; the finally handler is called once, at the
end.

```javascript
new AsyncRequest('/ajax/search')
  .setMethod('GET')
  .setOption('stream', true)
  .setHandler(response => {
    if (response.is_last) {
      spinner.hide();
    }
  })
  .send();
```

A server that doesn't stream sends a single response, with both `is_first` and `is_last`. A request whose response
started arriving is not retried. The parts arrive over the same `XMLHttpRequest`, so CSRF tokens, timeouts and
abandoning work as usual. See [how it works](how_it_works.md#streamed-responses) for the format.

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

- `refresh`: a same-origin URL that answers with a new token, see [Token refresh](#token-refresh).

A later response that defines the module again replaces the token. Without the module, add the token yourself:

```javascript
const token = document.querySelector('meta[name=csrf-token]').getAttribute('content');

new AsyncRequest('/ajax/save')
  .setRequestHeader('X-CSRF-TOKEN', token)
  .send();
```
