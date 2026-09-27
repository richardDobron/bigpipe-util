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
| `setData(data)`                   | An object (sent URL-encoded, nested objects as `a[b]=c`) or a `FormData`.            |
| `setRequestHeader(name, value)`   | Adds a request header.                                                               |
| `setRelative(element)`            | The element that sent the request, see [relative targets](primer.md#relative-targets). |
| `send()`                          | Sends the request and returns the `XMLHttpRequest`.                                  |
| `abort()`                         | Aborts the request.                                                                  |

Every request is sent with the `X-Requested-With: XMLHttpRequest` header and a `__req` parameter with a counter of
the requests made from the page.

## Handlers

| Method                   | Called                                                                                  |
|--------------------------|-----------------------------------------------------------------------------------------|
| `setInitialHandler(fn)`  | Right before the request is sent.                                                       |
| `setHandler(fn)`         | With the parsed response, after its DOM operations and modules were applied.            |
| `setErrorHandler(fn)`    | With the `XMLHttpRequest` when the status isn't 2xx/3xx or the request failed.          |
| `setFinallyHandler(fn)`  | With the `XMLHttpRequest` after the request finished, successfully or not.              |

## CSRF tokens

Add the token to every request, e.g. in Laravel:

```javascript
const token = document.querySelector('meta[name=csrf-token]').getAttribute('content');

new AsyncRequest('/ajax/save')
  .setRequestHeader('X-CSRF-TOKEN', token)
  .send();
```
