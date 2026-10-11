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
`Layer.getTopmostLayer()` is the layer that was shown last, `Layer.getLayerOf(element)` the layer of a root,
`Layer.getLayerContaining(element)` the innermost layer an element is in, and
`Layer.containsIncludingLayers(root, element)` tells whether an element is inside of `root` or of a layer opened from
inside of it, at any depth.

A click counts as a click outside only when the mouse was pressed and released on the same element outside of the
layer and of the layers opened from inside it (their `causalElement`, or the context of a `ContextualLayer`, is inside
it), at any depth.

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

## Hiding

The `hide()` of a layer takes the source of the request, one of `HideSources` (`blur`, `escape`, `transition`), which
`beforehide` and `starthide` get as their data.

| Behavior           | Does                                                                                              |
|--------------------|---------------------------------------------------------------------------------------------------|
| `HideOnEscape`     | Hides the topmost layer when <kbd>Esc</kbd> is pressed, and handles the key.                       |
| `HideOnBlur`       | Hides the layer on a click outside of it. Layers below stay open.                                  |
| `HideOnTransition` | Hides the layer before a [page transition](page_transitions.md). Override `isTransitionRelevant({ from, to })` to hide only for some. |
| `DestroyOnHide`    | Destroys the layer after it was hidden.                                                            |
| `RemoveOnHide`     | Removes the root from the page when the layer is hidden. `show()` puts it back.                    |

```javascript
import Layer from 'bigpipe-util/dist/core/layer/Layer';
import HideOnBlur from 'bigpipe-util/dist/core/layer/HideOnBlur';
import HideOnEscape from 'bigpipe-util/dist/core/layer/HideOnEscape';

new Layer(menuElement, { behaviors: [HideOnBlur, HideOnEscape] }).show();
```

## Focus

| Behavior         | Does                                                                                                        |
|------------------|-------------------------------------------------------------------------------------------------------------|
| `AutoFocus`      | Moves the focus into the layer when it is shown: to the element with `autofocus`, else the first control (not a link), else the root. A control inside that already has the focus keeps it. |
| `TabIsolation`   | Keeps <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> inside of the topmost layer.                        |
| `RefocusOnHide`  | Gives the focus back to the `causalElement`, or else the element that had it before the layer was shown, when the focus was in the layer. |

`focusWithinLayer(element)` from `core/layer/focusWithinLayer` is the focus logic of `AutoFocus`, and `getTabbable(element)`
lists the elements <kbd>Tab</kbd> reaches: not disabled, not hidden (`hidden`, `display: none`) and visible.

## Fading

`FadeOnShow` and `FadeOnHide` fade the root with an inline `opacity` transition, so they work with any CSS. They take
100 and 150 ms, and `FadeOnShow.forDuration(300)` and `FadeOnHide.forDuration(300)` return behaviors with another
duration. Users who prefer reduced motion get no animation. `FadeOnHide` postpones the hiding with `starthide` and
calls `finishHide()` when the fade is over.

## ModalLayer

`ModalLayer` makes a layer modal: it puts a backdrop before the root, locks the scrolling of the page, centers the
root and stacks modals so that the last one shown is on top, with the only visible backdrop. Modals and
[dialogs](dialog.md) share one stacking order, so a modal opened from a dialog is above it, and the other way round. Combine it with
`HideOnBlur` to hide on a click on the backdrop and `HideOnEscape` for <kbd>Esc</kbd>.

```javascript
import ModalLayer from 'bigpipe-util/dist/core/layer/ModalLayer';

new Layer(dialogElement, { behaviors: [ModalLayer, HideOnBlur, HideOnEscape, AutoFocus, TabIsolation] }).show();
```

It styles the backdrop and centers the root with inline styles, so it works without any CSS. To use your own,
`ModalLayer.configure()` returns a behavior with other options:

```javascript
const Modal = ModalLayer.configure({
  backdropClassName: 'fixed inset-0 bg-black/50', // no default look is applied when set
  backdropStyle: { backdropFilter: 'blur(2px)' },
  zIndex: 50,                                     // of the backdrop, the root is 1 above; a modal shown
                                                  // over another one is at least 10 above it
  center: false,                                  // position the root with your CSS
  lockScroll: false
});
```

With `center: false` the root has to be positioned (e.g. `fixed`) by your CSS for the `z-index` to apply.

## ContextualLayer

`ContextualLayer` is a `Layer` that is positioned next to an element, for menus, tooltips and popovers. It is placed with
`position: absolute` in the page, or in its `insertParent` when that is (or is inside of) a positioned or transformed
element.

```javascript
import ContextualLayer from 'bigpipe-util/dist/core/layer/ContextualLayer';

const menu = new ContextualLayer(menuElement, {
  context: button,       // an element, or a function that returns one
  position: 'below',     // above, below, left or right
  alignment: 'start',    // start, center or end of the context
  offsetX: 0,
  offsetY: 4,
  autoFlip: true,        // the other side when it doesn't fit in the viewport
  keepInViewport: true,
  behaviors: [HideOnBlur, HideOnEscape]
});

menu.show();
menu.getPosition();      // the side it was placed on after flipping
menu.setPosition('right');
```

It is positioned again while it is shown when the window is resized or scrolled and informs `reposition` with the
side and alignment. A layer whose context is inside of another layer, e.g. a submenu, is hidden with that layer, and its
context is its `causalElement` unless one is set. A layer whose context is not on the page or not displayed (`display: none`) is not shown. When the context is inside of a modal or a
dialog (a positioned ancestor with a `z-index`), the layer gets a `z-index` 1 above it.

## Dialogs

[Dialogs](dialog.md) are layers: `DialogLayer` wraps a `modal-vanilla` modal, keeps its events and markup, and adds the
layer events and behaviors (`AutoFocus`, `TabIsolation`, `RefocusOnHide`, `HideOnTransition`, and `HideOnSuccess` which hides
the layer when a request sent from inside succeeds, see the [success event](async_request.md#success-event)). A dialog
is always shown through the modal, so it does not use `ModalLayer` and the fades, which the modal has built in.

`calculateTopMargin(height, options)` from `core/layer/DialogPosition` is the top margin of a dialog for the `position`
option: `options.top` when it is set, else a third of the free height of the window (half with `centered`), at least 40.
