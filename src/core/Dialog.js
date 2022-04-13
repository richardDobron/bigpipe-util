import Modal from "modal-vanilla/lib/modal";
import DOM from "./DOM";

const stack = [];
let modalId = 1;
let zIndex = 1040;
let originalBodyPad = null;

export default class Dialog {
  close() {
    stack.forEach((dialog) => dialog.hide())
  }

  render(options) {
    DOM.appendContent(document.body, this._makeDialog(options.content));

    modalId++;

    const _dialog = this._show({
      el: document.getElementById(this.id),
      animate: false,
      backdrop: options.backdrop ?? true,
      transition: options.transition ?? 0,
      backdropTransition: options.backdropTransition ?? 0,
    }, options.controller);

    stack.push(_dialog);
  }

  showFromModel(model) {
    const _dialog = this._show({
      title: model.title || '',
      content: model.body,
      footer: model.footer || false,
      animate: false,
      backdrop: model.backdrop ?? true,
      transition: model.transition ?? 0,
      backdropTransition: model.backdropTransition ?? 0,
    }, model.controller);

    stack.push(_dialog);
  }

  _show(options, controller) {
    if (originalBodyPad === null) {
      originalBodyPad = document.body.style.paddingRight;
    }

    const _modal = new Modal(options);

    if (controller) {
      (new (window.require(controller))(_modal));
    }

    const self = this;

    return _modal.on('shown', function ({el}) {
      zIndex = 10 * stack.length;
      el.style.zIndex = zIndex;
      setTimeout(() => document.querySelector('.modal-backdrop').style.zIndex = zIndex - 1);
    }).on('showBackdrop', this._fixBackdrop).on('hidden', function ({el}) {
      stack.pop();

      if (stack.length) {
        document.body.classList.add('modal-open');
      }

      document.body.style.paddingRight = originalBodyPad;

      zIndex -= 10;
      self._fixBackdrop();
      DOM.remove(el);
    }).show();
  }

  _fixBackdrop(content) {
    const backdrops = document.querySelectorAll('.modal-backdrop');

    backdrops.forEach((backdrop, index) => {
      if (index > 0 && index === backdrops.length - 1) {
        backdrop.style.display = 'none';
      } else {
        backdrop.style.zIndex = zIndex - 1;
        backdrop.style.display = '';
      }
    });
  }

  _makeDialog(content) {
    this.id = `js_${modalId.toString(16)}`;
    return `<div id="${this.id}" class="modal fade" tabindex="-1" role="dialog">
  ${content}
</div>`;
  }
}
