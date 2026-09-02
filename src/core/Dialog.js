import Modal from 'modal-vanilla/lib/modal';
import DOM from './DOM';

const DEFAULT_Z_INDEX = 1040;

let stack = [];
let dialogId = 1;
let zIndex;
let originalBodyPad = null;

Modal.prototype._handleKeydownEvent = function (event) {
  if (event.which === 27 && this._options.keyboard) {
    const currentModal = stack[stack.length - 1];
    if (currentModal.el.isEqualNode(this.el)) {
      this.emit('dismiss', this, event, null);
      this.hide();
    }
  }
};

export default class Dialog {
  close(limit = -1) {
    let modals;
    if (limit > -1) {
      modals = stack.slice(-limit);
    } else {
      modals = stack;
    }
    modals.forEach(dialog => dialog.hide());
  }

  closeCurrent() {
    const dialog = stack.pop();

    if (dialog) {
      dialog.hide();
    }
  }

  render(options, args) {
    DOM.appendContent(document.body, this._makeDialog(options.content, options.dialogClassName));

    dialogId++;

    return this._maybeWithTimeout(options.timeout, () =>
      this._show(
        {
          el: document.getElementById(this.id),
          animate: this._getOption(options, 'animate', false),
          keyboard: this._getOption(options, 'keyboard', true),
          backdrop: this._getOption(options, 'backdrop', true),
          transition: this._getOption(options, 'transition', 0),
          backdropTransition: this._getOption(options, 'backdropTransition', 0)
        },
        options.controller,
        args
      )
    );
  }

  showFromModel(model, args) {
    return this._maybeWithTimeout(model.timeout, () =>
      this._show(
        {
          title: model.title || '',
          content: model.body,
          footer: model.footer || false,
          animate: this._getOption(model, 'animate', false),
          keyboard: this._getOption(model, 'keyboard', true),
          backdrop: this._getOption(model, 'backdrop', true),
          transition: this._getOption(model, 'transition', 0),
          backdropTransition: this._getOption(model, 'backdropTransition', 0)
        },
        model.controller,
        args
      )
    );
  }

  _maybeWithTimeout(timeout, callback) {
    if (typeof timeout === 'number') {
      return new Promise(resolve => setTimeout(() => resolve(callback()), timeout));
    }
    return callback();
  }

  _getOption(obj, key, defaultVal) {
    return obj[key] !== null && obj[key] !== undefined ? obj[key] : defaultVal;
  }

  _show(options, controller, args) {
    if (originalBodyPad === null) {
      originalBodyPad = document.body.style.paddingRight;
    }

    const _modal = new Modal(options);
    stack.push(_modal);

    if (controller) {
      if (typeof controller === 'string') {
        new (window.require(controller))(_modal, ...args);
      } else if (typeof controller === 'function') {
        controller(_modal, ...args);
      }
    }

    const self = this;

    return _modal
      .on('shown', function ({ el }) {
        zIndex = DEFAULT_Z_INDEX + 10 * stack.length;
        el.style.zIndex = zIndex;
        setTimeout(() => (document.querySelector('.modal-backdrop').style.zIndex = zIndex - 1));
      })
      .on('showBackdrop', this._fixBackdrop)
      .on('hidden', function ({ el }) {
        stack = stack.filter(modal => {
          return !modal.el.isEqualNode(el);
        });

        if (stack.length) {
          document.body.classList.add('modal-open');
        }

        document.body.style.paddingRight = originalBodyPad;

        zIndex -= 10;
        self._fixBackdrop();
        DOM.remove(el);
      })
      .show();
  }

  _fixBackdrop() {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    let shown = false;

    backdrops.forEach((backdrop, index) => {
      if (shown || (index > 0 && index === backdrops.length - 1)) {
        backdrop.style.display = 'none';
      } else {
        backdrop.style.zIndex = zIndex - 1;
        backdrop.style.display = '';
        shown = true;
      }
    });
  }

  _makeDialog(content, className = '') {
    this.id = `js_${dialogId.toString(16)}`;
    return `
      <div id="${this.id}" class="modal fade ${className}" tabindex="-1" role="dialog">
  ${content}
</div>`;
  }
}
