---
id: dialog
title: Dialog
sidebar_label: Dialog
---

`Dialog` shows modal dialogs with [modal-vanilla](https://github.com/KaneCohen/modal-vanilla), which uses the same
markup and classes as Bootstrap modals. Dialogs can be stacked: each new one is shown above the previous one and
<kbd>Esc</kbd> closes only the topmost.

The server usually opens dialogs with `DialogResponse`, see
[Dialogs API](https://richarddobron.github.io/bigpipe-php/docs/dialogs). You can also open them from JavaScript.

## showFromModel

Builds the dialog from a title, body and footer:

```javascript
import Dialog from 'bigpipe-util/dist/core/Dialog';

new Dialog().showFromModel({
  title: 'Dialog title',
  body: 'html <strong>content</strong>',
  footer: '<button data-dismiss="modal">Close</button>',
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
| `autoFocus`          | `true`  | Move the focus into the dialog when it is shown, see [Layer behaviors](#layer-behaviors). |
| `trapFocus`          | `true`  | Keep <kbd>Tab</kbd> inside of the dialog.                                |
| `refocus`            | `true`  | Give the focus back to the element that opened the dialog when it closes. |
| `causalElement`      |         | The element to give the focus back to. The focused element when the dialog is shown by default. |
| `hideOnTransition`   | `true`  | Close the dialog before a [page transition](page_transitions.md).         |
| `hideOnSuccess`      | `false` | Close the dialog when a request sent from inside of it succeeds: `true` for any, or a selector for the elements that sent it. |
| `position`           | `false` | Set the top margin of the dialog: `true`, or `{ top, centered, ignoreTopInShortViewport }`. |

## Controllers

A controller is called with the modal and the arguments passed to the method. Use it to react to the events of the
dialog: `show`, `shown`, `hide`, `hidden` and `dismiss`.

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

The markup and the classes (`modal`, `modal-dialog`, `modal-backdrop`, `fade`, ...) are those of
[modal-vanilla](https://github.com/KaneCohen/modal-vanilla), compatible with Bootstrap. Your own CSS, or another
framework, can style them, and `Modal.templates` of `modal-vanilla/lib/modal` replaces the markup. The layer only
adds behaviour: it does not add classes, and sets the top margin of the dialog only when you ask for `position`.

## Closing dialogs

```javascript
const dialog = new Dialog();

dialog.closeCurrent(); // the topmost dialog
dialog.close(2); // the last two dialogs
dialog.close(); // all dialogs
```
