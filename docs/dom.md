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
| `remove(node)`                  | Removes the node.                              |
| `empty(node)`                   | Removes all children of the node.              |

:::caution

The HTML is inserted as is. Escape any user input on the server.

:::

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
