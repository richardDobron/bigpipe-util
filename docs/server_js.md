---
id: server_js
title: ServerJS
sidebar_label: ServerJS
---

`ServerJS` calls the JavaScript modules that the server requires. It handles the `jsmods` of every response and,
at the end of the page, the modules required while rendering it:

```php
<script>
    (new (require("bigpipe-util/src/ServerJS"))).handle(<?=json_encode(\dobron\BigPipe\BigPipe::jsmods())?>);
</script>
```

## Requiring modules

`jsmods.require` is a list of `[module, method, args]`:

```json
{
  "require": [
    ["UserLoggedInAlert", null, ["Marvin"]],
    ["ChartRenderer", "render", [{"__e": "chart"}, [10, 20, 30]]]
  ]
}
```

The module is loaded with `window.require(module)`, see [Getting started](getting_started.md#2-set-up-the-entrypoint).

- Without a method, the module is called as a constructor with the arguments: `new UserLoggedInAlert('Marvin')`.
- With a method, a class is instantiated without arguments and the method is called with them:
  `new ChartRenderer().render(element, [10, 20, 30])`. A module that exports an object has the method called on
  the object directly.

In PHP:

```php
$response->bigPipe()->require("require('UserLoggedInAlert')", ['Marvin']);
$response->bigPipe()->require("require('ChartRenderer').render()", [
    \dobron\BigPipe\TransportMarker::transportElement('chart'),
    [10, 20, 30],
]);
```

## Transport markers

Arguments are JSON, so values that JSON can't express are sent as markers and replaced before the module is
called:

| Marker    | Replaced with                                      | PHP                                   |
|-----------|----------------------------------------------------|---------------------------------------|
| `__e`     | The element with this `id`.                        | `TransportMarker::transportElement()` |
| `__m`     | The module loaded with `window.require()`.         | `TransportMarker::transportModule()`  |
| `__map`   | A `Map` created from the list of `[key, value]`.   | `TransportMarker::transportMap()`     |
| `__set`   | A `Set` created from the list of values.           | `TransportMarker::transportSet()`     |
| `__html`  | Used for the HTML content of DOM operations.       | `TransportMarker::transportHtml()`    |

Markers are replaced at any depth of the arguments.
