import DOM from './DOM';
import Modal from './Modal';
import AutoFocus from './layer/AutoFocus';
import DialogLayer from './layer/DialogLayer';
import HideOnSuccess from './layer/HideOnSuccess';
import HideOnTransition from './layer/HideOnTransition';
import RefocusOnHide from './layer/RefocusOnHide';
import TabIsolation from './layer/TabIsolation';
import { addToStack, removeFromStack, updateStack } from './layer/overlayStack';
import requireModule from './requireModule';
import { trustedHTML } from './trustedTypes';

// The z-index of the backdrop of the first dialog, the dialog is 1 above. The modal layers and the
// dialogs share one stacking order, see overlayStack.
const DEFAULT_Z_INDEX = 1049;

let stack = [];
let dialogId = 1;

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
    const el = this._makeDialog(options.content, options.dialogClassName);

    return this._maybeWithTimeout(options.timeout, () =>
      this._show(
        {
          el,
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
          label: model.label || '',
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
    const modal = new Modal(options);
    stack.push(modal);
    new DialogLayer(modal, layerOptions);

    if (controller) {
      if (typeof controller === 'string') {
        new (requireModule(controller))(modal, ...args);
      } else if (typeof controller === 'function') {
        controller(modal, ...args);
      }
    }

    const entry = {
      zIndex: DEFAULT_Z_INDEX,
      root: modal.el,
      getBackdrop: () => modal.backdrop
    };

    return modal
      .on('show', () => addToStack(entry))
      .on('showBackdrop', updateStack)
      .on('hidden', () => {
        stack = stack.filter(item => item !== modal);
        removeFromStack(entry);
        DOM.remove(modal.el);
      })
      .show();
  }

  // The container of the markup is the one of `Modal.templates`, so your templates apply here too.
  _makeDialog(content, className = '') {
    const template = document.createElement('template');
    template.innerHTML = trustedHTML(Modal.templates.container.trim());
    const container = template.content.firstElementChild;

    this.id = `js_${(dialogId++).toString(16)}`;
    container.id = this.id;
    // The animation class makes Modal animate it, as before.
    `${Modal.options.animateClass} ${className}`
      .split(/\s+/)
      .filter(Boolean)
      .forEach(name => container.classList.add(name));
    container.setAttribute('role', 'dialog');
    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }

    document.body.appendChild(container);
    DOM.appendContent(container, content);
    return container;
  }
}
