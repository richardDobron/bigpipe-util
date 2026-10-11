import Modal from 'modal-vanilla/lib/modal';
import DOM from './DOM';
import AutoFocus from './layer/AutoFocus';
import DialogLayer from './layer/DialogLayer';
import HideOnSuccess from './layer/HideOnSuccess';
import HideOnTransition from './layer/HideOnTransition';
import RefocusOnHide from './layer/RefocusOnHide';
import TabIsolation from './layer/TabIsolation';
import { addToStack, removeFromStack, updateStack } from './layer/overlayStack';
import requireModule from './requireModule';

// The z-index of the backdrop of the first dialog, the dialog is 1 above. The modal layers and the
// dialogs share one stacking order, see overlayStack.
const DEFAULT_Z_INDEX = 1049;

let stack = [];
let dialogId = 1;
let originalBodyPad = null;

const handleKeydownEvent = Modal.prototype._handleKeydownEvent;

// The Escape of a dialog goes through the layers (DialogLayer), so that the topmost layer, e.g. a
// menu opened inside of the dialog, gets it first.
Modal.prototype._handleKeydownEvent = function (event) {
  if (!this.layer) {
    handleKeydownEvent.call(this, event);
  }
};

function layerConfig(source) {
  const enabled = (name, fallback) =>
    source[name] !== null && source[name] !== undefined ? source[name] : fallback;
  const behaviors = [];

  if (enabled('autoFocus', true)) {
    behaviors.push(AutoFocus);
  }
  if (enabled('trapFocus', true)) {
    behaviors.push(TabIsolation);
  }
  if (enabled('refocus', true)) {
    behaviors.push(RefocusOnHide);
  }
  if (enabled('hideOnTransition', true)) {
    behaviors.push(HideOnTransition);
  }
  if (source.hideOnSuccess) {
    behaviors.push(HideOnSuccess);
  }

  // The element that sent the request may be a form: the focused element inside of it is closer.
  let { causalElement } = source;
  const active = document.activeElement;
  if (
    causalElement instanceof Element &&
    active &&
    active !== causalElement &&
    causalElement.contains(active)
  ) {
    causalElement = active;
  }

  return {
    behaviors,
    causalElement,
    hideOnSuccess: source.hideOnSuccess,
    position: source.position
  };
}

export default class Dialog {
  close(limit = -1) {
    let modals;
    if (limit > -1) {
      modals = stack.slice(Math.max(stack.length - limit, 0));
    } else {
      modals = stack.slice();
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
        args,
        layerConfig(options)
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
        args,
        layerConfig(model)
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

  _show(options, controller, args = [], layerOptions = {}) {
    if (originalBodyPad === null) {
      originalBodyPad = document.body.style.paddingRight;
    }

    const _modal = new Modal(options);
    stack.push(_modal);
    new DialogLayer(_modal, layerOptions);

    if (controller) {
      if (typeof controller === 'string') {
        new (requireModule(controller))(_modal, ...args);
      } else if (typeof controller === 'function') {
        controller(_modal, ...args);
      }
    }

    const entry = {
      zIndex: DEFAULT_Z_INDEX,
      root: _modal.el,
      getBackdrop: () => _modal._html.backdrop || null
    };

    return _modal
      .on('show', () => addToStack(entry))
      .on('showBackdrop', updateStack)
      .on('hidden', function ({ el }) {
        stack = stack.filter(modal => {
          return modal.el !== el;
        });

        if (stack.length) {
          document.body.classList.add('modal-open');
        }

        document.body.style.paddingRight = originalBodyPad;

        removeFromStack(entry);
        DOM.remove(el);
      })
      .show();
  }

  _makeDialog(content, className = '') {
    this.id = `js_${dialogId.toString(16)}`;
    return `
      <div id="${this.id}" class="modal fade ${className}" tabindex="-1" role="dialog">
  ${content}
</div>`;
  }
}
