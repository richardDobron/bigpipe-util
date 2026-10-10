---
id: layer
title: Layer
sidebar_label: Layer
---

`Layer` is the base of everything that floats above the page: a menu, a tooltip, a dialog. It shows and hides a DOM
element, tells what happens through events, and gets its behaviour from [behaviors](#behaviors) that you enable per
layer. It does not depend on a CSS framework: it sets no class names and only the inline styles it needs to work, so
the element can be styled with Bootstrap, Tailwind or your own CSS.

```javascript
import Layer from 'bigpipe-util/dist/core/layer/Layer';

const layer = new Layer('<div class="menu">Menu</div>', {
  classNames: ['shadow-lg'],        // added to the root, with any classes of your own
  attributes: { role: 'menu' },
  causalElement: button,            // what opened it
  insertParent: document.body,      // where the root is put when it's shown, the body by default
  behaviors: [HideOnEscape]
});

layer.show();
layer.hide();
layer.destroy();                    // removes the root and disables the behaviors
```

The first argument is a DOM element or an HTML string with a single root element. A root that is hidden is hidden with
`display: none` while the layer is not shown.

## Events

Subscribe with `layer.subscribe(name, callback)`, or an array of names. The callback gets the data of the event and the
name of the event, and `remove()` of the returned subscription unsubscribes. A callback that returns `false` stops what
the event is about, where it says so.

| Event        | When                                                                                            |
|--------------|-------------------------------------------------------------------------------------------------|
| `beforeshow` | The layer is about to be shown.                                                                 |
| `show`       | It is shown.                                                                                    |
| `aftershow`  | It is shown and positioned.                                                                     |
| `beforehide` | `hide()` was called, with the source. Returning `false` keeps the layer open.                   |
| `starthide`  | The layer starts to hide. Returning `false` postpones it: call `finishHide()` when ready, e.g. after a fade. |
| `hide`       | It is hidden.                                                                                   |
| `destroy`    | It is destroyed.                                                                                |
| `key`        | A key was pressed while it is open, with the `KeyboardEvent`, topmost layer first. Returning `false` handles the key. |
| `blur`       | The user clicked outside of the layer, with `{ target }`. Returning `false` stops it from reaching the layers below. |

`Layer.subscribe(name, callback)` listens to `show`, `hide` and `destroy` of all layers, with the layer as the data.
`Layer.getTopmostLayer()` is the layer that was shown last, and `Layer.getLayerOf(element)` the layer of a root.

A click counts as a click outside only when the mouse was pressed and released on the same element outside of the
layer and of the layers opened from inside it (their `causalElement` is inside it).

## Behaviors

A behavior is a class with a constructor that gets the layer, and `enable()` and `disable()`. Pass them in
`behaviors`, or use `layer.enableBehaviors([...])` and `layer.disableBehaviors([...])`. Every behavior is enabled once
per layer.

```javascript
class LogOnShow {
  constructor(layer) {
    this.layer = layer;
  }

  enable() {
    this.subscription = this.layer.subscribe('show', () => console.log('shown'));
  }

  disable() {
    this.subscription.remove();
  }
}
```
