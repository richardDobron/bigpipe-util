---
id: how_it_works
title: How it works
sidebar_label: How it works
---

BigPipe moves the decision about what happens on the page to the server. The browser only sends a request, the
server answers with a list of instructions and `bigpipe-util` executes them.

1. The user clicks a link or submits a form handled by the [Primer](primer.md), or your code sends an
   [AsyncRequest](async_request.md).
2. The server responds with DOM operations (`domops`) and JavaScript modules to call (`jsmods`).
3. [AsyncResponse](#asyncresponse) applies the DOM operations, then [ServerJS](server_js.md) loads and calls the
   modules.

## Response format

A response is JSON prefixed with the `for (;;);` shield. The shield makes the response unusable when it's loaded
with a `<script>` tag from another site; `AsyncRequest` strips it before parsing.

```text
for (;;);{"payload":null,"domops":[...],"jsmods":{"require":[...]},"__ar":1}
```

| Key       | Description                                                                         |
|-----------|-------------------------------------------------------------------------------------|
| `payload` | Custom data for your handler, see `setPayload()` on the server.                     |
| `domops`  | [DOM operations](#dom-operations), applied in order.                                |
| `jsmods`  | Modules to call, see [ServerJS](server_js.md).                                      |
| `__ar`    | Marks the response as an async response.                                            |

The whole response object is also passed to the handler set with
[`setHandler()`](async_request.md#handlers).

## DOM operations

Each operation is an array `[type, selector, targetRelative, content]`:

```json
["appendContent", "ul.logs", false, {"__html": "<li>appended line</li>"}]
```

- `type`: one of `setContent`, `appendContent`, `prependContent`, `insertAfter`, `insertBefore`, `replace`,
  `remove`, `hide`, `show` and `eval`.
- `selector`: a CSS selector of the element to change.
- `targetRelative`: when `true`, the operation targets the element that sent the request (the clicked link or the
  submitted form), or the element matching `selector` inside it. The PHP library sets it when the selector is
  empty.
- `content`: HTML wrapped in the `__html` [transport marker](server_js.md#transport-markers), or JavaScript code
  for `eval`, which runs with `this` bound to the element.

Operations whose selector matches nothing are skipped. With `__DEV__` defined and truthy, an error is logged to the
console.

## AsyncResponse

`AsyncRequest` hands every successful response to `AsyncResponse`. You can use it directly to process a response
you received in another way, e.g. over a WebSocket:

```javascript
import AsyncResponse from 'bigpipe-util/dist/async/AsyncResponse';

socket.addEventListener('message', ({ data }) => {
  new AsyncResponse().handle(JSON.parse(data));
});
```
