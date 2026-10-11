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
with a `<script>` tag from another site; `AsyncRequest` strips it before parsing. The server sends it as
`application/json` with `X-Content-Type-Options: nosniff`, so the browser never runs it as a script either.

```text
for (;;);{"payload":null,"domops":[...],"jsmods":{"require":[...]},"__ar":1}
```

| Key       | Description                                                                         |
|-----------|-------------------------------------------------------------------------------------|
| `payload` | Custom data for your handler, see `setPayload()` on the server.                     |
| `domops`  | [DOM operations](#dom-operations), applied in order.                                |
| `pagelets`| Optional [pagelets](pagelets.md), handed to `BigPipe` after the DOM operations, e.g. a pagelet loaded lazily or refreshed. |
| `jsmods`  | Modules to call, see [ServerJS](server_js.md).                                      |
| `revision` | Optional revision of the deploy of the server, see [a new deploy](page_transitions.md#a-new-deploy). |
| `resource_map` | Optional names of CSS and JS files, see the [Bootloader](bootloader.md#resource-map). |
| `bootloadable` | Optional files of modules loaded on demand, see [bootloadable modules](bootloader.md#bootloadable-modules). |
| `__ar`    | Marks the response as an async response.                                            |

`AsyncResponse` reads the revision first, then `resource_map` and `bootloadable`, applies the DOM operations, hands
the pagelets to `BigPipe` and calls the modules last.

`AsyncRequest` reads a few more keys. `csrf_refresh` sends the request again, once, with a new
[CSRF token](async_request.md#token-refresh). `error`, `errorSummary`, `errorDescription`, `errorIsWarning` and
`isTransient` describe an [error](async_request.md#errors) the server sent.

The whole response object is also passed to the handler set with
[`setHandler()`](async_request.md#handlers).

## Streamed responses

A [streamed response](async_request.md#streamed-responses) is a series of parts, each followed by the delimiter
`/*<!-- fetch-stream -->*/`. A part is JSON with a response as `content` and `finished` on the last part:

```text
{"content":{"payload":{"title":"Feed"},"domops":[...],"jsmods":{"define":[...]}},"finished":false}/*<!-- fetch-stream -->*/
{"content":{"pagelets":[{"id":"feed",...}]},"finished":false}/*<!-- fetch-stream -->*/
{"content":{"pagelets":[{"id":"__bigpipe_last","is_last":true,...}],"jsmods":{"require":[...]}},"finished":true}/*<!-- fetch-stream -->*/
```

## DOM operations

Each operation is an array `[type, selector, targetRelative, content]`:

```json
["appendContent", "ul.logs", false, {"__html": "<li>appended line</li>"}]
```

- `type`: one of `setContent`, `appendContent`, `prependContent`, `insertAfter`, `insertBefore`, `replace`,
  `morph`, `morphContent` (see [morphing](dom.md#morphing)), `remove`, `hide`, `show` and `eval` (deprecated: a Content Security Policy without `'unsafe-eval'` blocks it, call
  a module with [jsmods](server_js.md) instead).
- `selector`: a CSS selector of the element to change.
- `targetRelative`: when `true`, the operation targets the element that sent the request (the clicked link or the
  submitted form), or the element matching `selector` inside it. The PHP library sets it when the selector is
  empty.
- `content`: HTML wrapped in the `__html` [transport marker](server_js.md#transport-markers), or JavaScript code
  for `eval`, which runs with `this` bound to the element.

The content of a pagelet of the page may be `{"__container": "u_0_5"}` instead, the id of a hidden `<code>` element
the page printed before the script of the pagelet, with the HTML in a comment, where `\` and `-` are escaped with a
backslash (see `BigPipe::setHtmlContainers()` in the PHP library). The HTML is then not escaped in the JSON of the
script, and the browser does not parse it until the pagelet is displayed. The container is removed.

Operations whose selector matches nothing are skipped. With `__DEV__` defined and truthy (see
[Getting started](getting_started.md#optional-debug-messages)), an error is logged to the
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
