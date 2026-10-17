---
id: dialog
title: Dialog
sidebar_label: Dialog
---

`Dialog` shows modal dialogs with the built-in [`Modal`](#modal), which has no dependencies. Its markup and classes
are those of Bootstrap modals by default, and can be replaced for Tailwind or your own CSS, see [Styling](#styling).
Dialogs can be stacked: each new one is shown above the previous one, and above a [`ModalLayer`](layer.md#modallayer)
shown before it, and <kbd>Esc</kbd> closes only the topmost.

The server usually opens dialogs with `DialogResponse`, see
[Dialogs API](https://richarddobron.github.io/bigpipe-php/docs/dialogs). You can also open them from JavaScript.

## showFromModel

Builds the dialog from a title, body and footer:

```javascript
import Dialog from 'bigpipe-util/dist/core/Dialog';

new Dialog().showFromModel({
  title: 'Dialog title',
  body: 'html <strong>content</strong>',
  footer: '<button data-close>Close</button>',
  controller: 'ModalLogger',
  backdrop: 'static',
});
```

## render

Shows a dialog from your own markup, the content of `.modal`:

```javascript
new Dialog().render({
  content: `<div class="modal-dialog"><div class="modal-content">...</div></div>`,
  dialogClassName: 'modal-lg',
});
```

## Options

| Option               | Default | Description                                                             |
|----------------------|---------|-------------------------------------------------------------------------|
| `controller`         |         | A module name or a function called with the dialog, see below.          |
| `backdrop`           | `true`  | `false` for no backdrop, `'static'` for one that doesn't close it.     |
| `keyboard`           | `true`  | Close the dialog with <kbd>Esc</kbd>.                                   |
| `animate`            | `false` | Animate showing and hiding.                                             |
| `transition`         | `0`     | Duration of the dialog transition in ms.                                |
| `backdropTransition` | `0`     | Duration of the backdrop transition in ms.                              |
| `timeout`            |         | Show the dialog after this many ms. The method then returns a `Promise`. |
| `label`              |         | `showFromModel` only: the `aria-label` of a dialog without a title. A title labels the dialog itself. |
| `autoFocus`          | `true`  | Move the focus into the dialog when it is shown, see [Layer behaviors](#layer-behaviors). |
| `trapFocus`          | `true`  | Keep <kbd>Tab</kbd> inside of the dialog.                                |
| `refocus`            | `true`  | Give the focus back to the element that opened the dialog when it closes. |
| `causalElement`      |         | The element to give the focus back to. The focused element when the dialog is shown by default. |
| `hideOnTransition`   | `true`  | Close the dialog before a [page transition](page_transitions.md).         |
| `hideOnSuccess`      | `false` | Close the dialog when a request sent from inside of it succeeds: `true` for any, or a selector for the elements that sent it. |
| `position`           | `false` | Set the top margin of the dialog: `true`, or `{ top, centered, ignoreTopInShortViewport }`. |

## Controllers

A controller is called with the modal and the arguments passed to the method. Use it to react to the events of the
dialog: `show`, `shown`, `hide`, `hidden` and `dismiss`, which gets the modal, the DOM event and the
`data-close` element that closed it (`null` for the backdrop and <kbd>Esc</kbd>). `on()`, `once()` and `off()` add
and remove listeners.

```javascript title="ModalLogger.js"
export default class ModalLogger {
  constructor(modal, ...args) {
    modal.on('shown', () => console.log('shown', args));
    modal.on('hidden', () => console.log('hidden'));
  }
}
```

## Layer behaviors

Every dialog is a [Layer](layer.md) too, available as `modal.layer`. The events of the modal stay as they are, the
layer adds its own and the [behaviors](layer.md#behaviors) above:

```javascript
new Dialog().showFromModel({
  title: 'Unsaved changes',
  body: '<form>...</form>',
  hideOnSuccess: true,         // close it when the form was saved
  controller: modal => {
    modal.layer.subscribe('beforehide', () => formIsDirty());  // return false to keep it open
  }
});
```

`hideOnSuccess` listens to the [`success` event](async_request.md#success-event) of requests whose link or form is inside of
the dialog. `modal.hide()`, the close button, a click on the backdrop and <kbd>Esc</kbd> all go through
`layer.hide()`, so `beforehide` can keep the dialog open for all of them.

## Styling

The modal brings no CSS. It only sets `display` (`block` only when your CSS hides it, so a `flex` or `grid` container
stays as it is), the `z-index` of the stacking, and locks the scrolling of the page with inline styles. Everything
else is classes, which your CSS styles:

| Part                 | Default markup                                              |
|----------------------|-------------------------------------------------------------|
| `container`          | `<div class="modal" tabindex="-1">`                         |
| `dialog`             | `<div class="modal-dialog">`                                |
| `content`            | `<div class="modal-content">`                               |
| `header`             | `<div class="modal-header">`                                |
| `title`              | `<h4 class="modal-title">`                                  |
| `headerClose`        | `<button type="button" class="close" data-close>`           |
| `body`               | `<div class="modal-body">`                                  |
| `footer`             | `<div class="modal-footer">`                                |
| `backdrop`           | `<div class="modal-backdrop">`                              |

While hidden the container and the backdrop have `fade`, while shown also `show`, and the body has `modal-open` while
a dialog is open. A click outside of `content` (or the backdrop) closes the dialog, as does any element with
`data-close` inside of it:

```html
<button type="button" data-close>Cancel</button>
```

`data-dismiss="modal"` of older markup still works.

### Bootstrap

Bootstrap 4 and 5 style the default markup as it is. For the Bootstrap 5 close button, and to keep
`data-bs-dismiss` of existing Bootstrap 5 markup working:

```javascript
import Modal from 'bigpipe-util/dist/core/Modal';

Modal.templates = {
  headerClose: '<button type="button" class="btn-close" data-close aria-label="Close"></button>',
  title: '<h5 class="modal-title"></h5>'
};

Modal.selectors = {
  dismiss: '[data-close], [data-dismiss="modal"], [data-bs-dismiss="modal"]'
};
```

### Tailwind

Replace the templates and the class names once, in the entrypoint. Class names can be lists:

```javascript title="app.js"
import Modal from 'bigpipe-util/dist/core/Modal';

Modal.templates = {
  container: '<div class="fixed inset-0 overflow-y-auto p-4 sm:p-6" tabindex="-1"></div>',
  dialog: '<div class="mx-auto my-8 w-full max-w-lg"></div>',
  content: '<div class="overflow-hidden rounded-xl bg-white shadow-xl"></div>',
  header: '<div class="flex items-center justify-between border-b px-6 py-4"></div>',
  title: '<h2 class="text-lg font-semibold text-gray-900"></h2>',
  headerClose: '<button type="button" class="text-gray-400 hover:text-gray-600" data-close aria-label="Close">✕</button>',
  body: '<div class="px-6 py-4"></div>',
  footer: '<div class="flex justify-end gap-2 border-t bg-gray-50 px-6 py-3"></div>',
  backdrop: '<div class="fixed inset-0 bg-gray-900/50"></div>'
};

Modal.options = {
  animateClass: 'opacity-0 transition-opacity duration-200',
  animateInClass: 'opacity-100',
  openClass: '' // the scroll lock doesn't need a class
};
```

`Modal.templates`, `Modal.options` and `Modal.selectors` merge with the defaults, and the `templates`, `selectors` and
the class name options can also be passed to one `new Modal({...})`. With `animate`, the dialog waits `transition` ms
(the backdrop `backdropTransition` ms) for your CSS transition before it emits `shown` and `hidden`.

### Your own markup

`render()` puts your markup into the `container` template. It finds the parts of it by `Modal.selectors`, so your
markup can use other classes too:

```javascript
Modal.selectors = {
  content: '[data-modal-content]', // a click outside of it closes the dialog
  body: '[data-modal-body]',       // the dialog moves the focus into it
  title: '[data-modal-title]'      // labels the dialog
};
```

The layer only adds behaviour: it does not add classes, and sets the top margin of the dialog only when you ask for
`position`.

## Modal

`Modal` can be used on its own, without the layer behaviors of a dialog:

```javascript
import Modal from 'bigpipe-util/dist/core/Modal';

const modal = new Modal({
  title: 'Delete the post?',
  content: '<p>This can not be undone.</p>',
  footer: '<button data-close>Cancel</button> <button class="js-delete">Delete</button>',
  backdrop: 'static'
});

modal.on('hidden', () => console.log('closed')).show();
```

`el` shows markup that is on the page instead (an element or a selector). `title`, `content` and `footer` take HTML
or an element, which is moved into the modal as it is. `show()`, `hide()`, `toggle()` and `isShown()` control it,
and `Modal.getTopmost()` returns the topmost open one. It closes with <kbd>Esc</kbd> when it is the topmost.

## Closing dialogs

```javascript
const dialog = new Dialog();

dialog.closeCurrent(); // the topmost dialog
dialog.close(2); // the last two dialogs
dialog.close(); // all dialogs
```
