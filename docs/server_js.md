---
id: server_js
title: ServerJS
sidebar_label: ServerJS
---

`ServerJS` calls the JavaScript modules that the server requires. It handles the `jsmods` of every response and,
at the end of the page, the modules required while rendering it:

```php
<script>
    document.addEventListener('DOMContentLoaded', function () {
        (new (require("bigpipe-util/src/ServerJS"))).handle(<?=json_encode(\dobron\BigPipe\BigPipe::jsmods())?>);
    });
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

The module is resolved by the loader set with `setModuleLoader()`, see
[Getting started](getting_started.md#2-set-up-the-entrypoint).

- Without a method, the module is called as a constructor with the arguments: `new UserLoggedInAlert('Marvin')`.
  An [instance](#instances) is only created, if it was not yet.
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

## Instances

A call with a method creates a new object of a class every time. To keep one object and talk to it from more calls,
the server defines an instance in `jsmods.instances`, a list of `[id, module, args]`:

```json
{
  "instances": [["__inst_u_0_1", "ChartRenderer", [{"__e": "chart"}, [10, 20, 30]]]],
  "require": [
    ["__inst_u_0_1", "render"],
    ["Dashboard", "add", [{"__m": "__inst_u_0_1"}]]
  ]
}
```

The instance is created with `new ChartRenderer(element, [10, 20, 30])` the first time something requires it, by its
id in `require` or in a `__m` [transport marker](#transport-markers), and every later use gets the same object, also
in the following responses.

In PHP:

```php
$chart = $response->bigPipe()->instance('ChartRenderer', [
    \dobron\BigPipe\TransportMarker::transportElement('chart'),
    [10, 20, 30],
]);

$chart->call('render');
$response->bigPipe()->require("require('Dashboard').add()", [$chart]);
```

## Defining modules

The server can send data as a module, e.g. the configuration of the page or the current user, in `jsmods.define`, a
list of `[name, exports]`:

```json
{
  "define": [["SiteData", {"locale": "sk_SK", "user": {"id": 7}}]]
}
```

The module is required like any other, `requireModule('SiteData')`, or passed to a call with a `__m`
[transport marker](#transport-markers). Its transport markers are replaced when it is required for the first time.
Defines are handled before the instances and calls of the same `jsmods`, and a module defined again, e.g. by a later
response, replaces the previous one.

In PHP:

```php
$response->bigPipe()->define('SiteData', [
    'locale' => 'sk_SK',
    'user' => ['id' => 7],
]);
```

## Errors

Every define, instance and call runs on its own: when one fails, e.g. a module that doesn't exist or a method that
throws, the others still run and the pagelet still finishes. The error is thrown again asynchronously, so it shows
in the console and reaches `window.onerror` and error trackers.

## Transport markers

Arguments are JSON, so values that JSON can't express are sent as markers and replaced before the module is
called:

| Marker    | Replaced with                                      | PHP                                   |
|-----------|----------------------------------------------------|---------------------------------------|
| `__e`     | The element with this `id`.                        | `TransportMarker::element()`          |
| `__m`     | The module, resolved the same way as `require`.    | `TransportMarker::module()`           |
| `__rel`   | The element that sent the request, e.g. the link of the [Primer](primer.md), or `null`. | `TransportMarker::relative()` |
| `__map`   | A `Map` created from the list of `[key, value]`.   | `TransportMarker::map()`              |
| `__set`   | A `Set` created from the list of values.           | `TransportMarker::set()`              |
| `__html`  | Used for the HTML content of DOM operations; a module gets the object. | `TransportMarker::html()` |

Markers are replaced at any depth of the arguments. `handle(jsmods, relativeTo)` takes the element of `__rel`;
`AsyncResponse` passes the relative element of the request.
