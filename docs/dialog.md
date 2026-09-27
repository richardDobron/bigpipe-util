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

## Closing dialogs

```javascript
const dialog = new Dialog();

dialog.closeCurrent(); // the topmost dialog
dialog.close(2); // the last two dialogs
dialog.close(); // all dialogs
```
