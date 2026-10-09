---
id: dom
title: DOM utilities
sidebar_label: DOM utilities
---

The helpers that the DOM operations are built on. Use them to change the page from your own modules the same way
the server does.

## DOM

```javascript
import DOM from 'bigpipe-util/dist/core/DOM';

const list = document.querySelector('ul.logs');

DOM.appendContent(list, '<li>appended line</li>');
```

| Method                          | Description                                    |
|---------------------------------|------------------------------------------------|
| `setContent(node, html)`        | Replaces the content of the node.              |
| `appendContent(node, html)`     | Inserts HTML as the last child.                |
| `prependContent(node, html)`    | Inserts HTML as the first child.               |
| `insertAfter(node, html)`       | Inserts HTML after the node.                   |
| `insertBefore(node, html)`      | Inserts HTML before the node.                  |
| `replace(node, html)`           | Replaces the node with HTML.                   |
| `morph(node, html)`             | Updates the node to match the HTML, keeping the elements that stay. |
| `morphContent(node, html)`      | Like `morph()`, for the children of the node only. |
| `remove(node)`                  | Removes the node.                              |
| `empty(node)`                   | Removes all children of the node.              |

:::caution

The HTML is inserted as is. Escape any user input on the server.

:::

### Morphing

`replace()` and `setContent()` throw the old elements away, so focus, typed text, scroll positions and the state of
your modules are lost. `morph()` and `morphContent()` change only what differs: the elements that stay are the same
DOM nodes, with their attributes and text updated. They use the morph algorithm of Alpine and Livewire, adapted from
[`@alpinejs/morph`](https://alpinejs.dev/plugins/morph) (MIT) and shipped with this package, without a dependency.

- Elements are matched by their position and tag. Give the items of a list a `key` attribute or an `id` to keep them
  when they are reordered, added or removed.
- Render the same markup, including whitespace, that the page was rendered with, e.g. the same template.
- `morph()` needs HTML with a single root element. Other HTML, e.g. an empty string, replaces the node.
- A value typed into an input is kept, the `value` attribute only changes its default.
- Attributes with `@` in their name, like `@click`, are supported. The Alpine integration of `@alpinejs/morph` is
  left out, so the state of Alpine components in the morphed HTML isn't kept.

## Parent

Find the closest ancestor of a node, including the node itself:

```javascript
import { byTag, byClass, byAttribute, find } from 'bigpipe-util/dist/core/Parent';

byTag(event.target, 'a');
byClass(event.target, 'card');
byAttribute(event.target, 'data-id');
find(event.target, (node) => node.dataset?.id === '123');
```

## $

A shortcut for `document.getElementById()`:

```javascript
import $ from 'bigpipe-util/dist/core/$';

$('chart').classList.add('ready');
```
