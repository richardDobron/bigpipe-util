import Modal from "modal-vanilla/lib/modal";
import DOM from "./DOM";

const DEFAULT_Z_INDEX = 1040;

let stack = [];
let dialogId = 1;
let zIndex;
let originalBodyPad = null;

Modal.prototype._handleKeydownEvent = function(event) {
  if (event.which === 27 && this._options.keyboard) {
    const currentModal = stack[stack.length - 1];
    if (currentModal.el.isEqualNode(this.el)) {
      this.emit('dismiss', this, event, null);
      this.hide();
    }
  }
}

export default class Dialog {
  close() {
    stack.forEach((dialog) => dialog.hide())
  }

  closeCurrent() {
    const dialog = stack[stack.length - 1];

    if (dialog) {
      dialog.hide();
    }
  }

  render(options, args) {
    DOM.appendContent(document.body, this._makeDialog(options.content));

    dialogId++;

    const dialog = this._show({
      el: document.getElementById(this.id),
      animate: false,
      keyboard: options.keyboard ?? true,
      backdrop: options.backdrop ?? true,
      transition: options.transition ?? 0,
      backdropTransition: options.backdropTransition ?? 0,
    }, options.controller, args);

    stack.push(dialog);

    return dialog;
  }

  showFromModel(model, args) {
    const dialog = this._show({
      title: model.title || '',
      content: model.body,
      footer: model.footer || false,
      animate: false,
      keyboard: model.keyboard ?? true,
      backdrop: model.backdrop ?? true,
      transition: model.transition ?? 0,
      backdropTransition: model.backdropTransition ?? 0,
    }, model.controller, args);

    stack.push(dialog);

    return dialog;
  }

  _show(options, controller, args) {
    if (originalBodyPad === null) {
      originalBodyPad = document.body.style.paddingRight;
    }

    const _modal = new Modal(options);

    if (controller) {
      if (typeof controller === 'string') {
        (new (window.require(controller, ...args)));
      } else if (typeof controller === 'function') {
        controller(_modal, ...args);
      }
    }

    const self = this;

    return _modal.on('shown', function ({el}) {
      zIndex = DEFAULT_Z_INDEX + (10 * stack.length);
      el.style.zIndex = zIndex;
      setTimeout(() => document.querySelector('.modal-backdrop').style.zIndex = zIndex - 1);
    }).on('showBackdrop', this._fixBackdrop).on('hidden', function ({el}) {
      stack = stack.filter((modal) => {
        return ! modal.el.isEqualNode(el);
      });

      if (stack.length) {
        document.body.classList.add('modal-open');
      }

      document.body.style.paddingRight = originalBodyPad;

      zIndex -= 10;
      self._fixBackdrop();
      DOM.remove(el);
    }).show();
  }

  _fixBackdrop() {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    let shown = false;

    backdrops.forEach((backdrop, index) => {
      if (shown || index > 0 && index === backdrops.length - 1) {
        backdrop.style.display = 'none';
      } else {
        backdrop.style.zIndex = zIndex - 1;
        backdrop.style.display = '';
        shown = true;
      }
    });
  }

  _makeDialog(content) {
    this.id = `js_${dialogId.toString(16)}`;
    return `<div id="${this.id}" class="modal fade" tabindex="-1" role="dialog">
  ${content}
</div>`;
  }
}
