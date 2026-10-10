"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _modal2 = _interopRequireDefault(require("modal-vanilla/lib/modal"));
var _DOM = _interopRequireDefault(require("./DOM"));
var _AutoFocus = _interopRequireDefault(require("./layer/AutoFocus"));
var _DialogLayer = _interopRequireDefault(require("./layer/DialogLayer"));
var _HideOnSuccess = _interopRequireDefault(require("./layer/HideOnSuccess"));
var _HideOnTransition = _interopRequireDefault(require("./layer/HideOnTransition"));
var _RefocusOnHide = _interopRequireDefault(require("./layer/RefocusOnHide"));
var _TabIsolation = _interopRequireDefault(require("./layer/TabIsolation"));
var _requireModule = _interopRequireDefault(require("./requireModule"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const DEFAULT_Z_INDEX = 1040;
let stack = [];
let dialogId = 1;
let zIndex;
let originalBodyPad = null;
_modal2.default.prototype._handleKeydownEvent = function (event) {
  if (event.which === 27 && this._options.keyboard) {
    const currentModal = stack[stack.length - 1];
    if (currentModal.el.isEqualNode(this.el)) {
      this.emit('dismiss', this, event, null);
      this.hide();
    }
  }
};
function layerConfig(source) {
  const enabled = (name, fallback) => source[name] !== null && source[name] !== undefined ? source[name] : fallback;
  const behaviors = [];
  if (enabled('autoFocus', true)) {
    behaviors.push(_AutoFocus.default);
  }
  if (enabled('trapFocus', true)) {
    behaviors.push(_TabIsolation.default);
  }
  if (enabled('refocus', true)) {
    behaviors.push(_RefocusOnHide.default);
  }
  if (enabled('hideOnTransition', true)) {
    behaviors.push(_HideOnTransition.default);
  }
  if (source.hideOnSuccess) {
    behaviors.push(_HideOnSuccess.default);
  }
  return {
    behaviors,
    causalElement: source.causalElement,
    hideOnSuccess: source.hideOnSuccess,
    position: source.position
  };
}
class Dialog {
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
    _DOM.default.appendContent(document.body, this._makeDialog(options.content, options.dialogClassName));
    dialogId++;
    return this._maybeWithTimeout(options.timeout, () => this._show({
      el: document.getElementById(this.id),
      animate: this._getOption(options, 'animate', false),
      keyboard: this._getOption(options, 'keyboard', true),
      backdrop: this._getOption(options, 'backdrop', true),
      transition: this._getOption(options, 'transition', 0),
      backdropTransition: this._getOption(options, 'backdropTransition', 0)
    }, options.controller, args, layerConfig(options)));
  }
  showFromModel(model, args) {
    return this._maybeWithTimeout(model.timeout, () => this._show({
      title: model.title || '',
      content: model.body,
      footer: model.footer || false,
      animate: this._getOption(model, 'animate', false),
      keyboard: this._getOption(model, 'keyboard', true),
      backdrop: this._getOption(model, 'backdrop', true),
      transition: this._getOption(model, 'transition', 0),
      backdropTransition: this._getOption(model, 'backdropTransition', 0)
    }, model.controller, args, layerConfig(model)));
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
    const _modal = new _modal2.default(options);
    stack.push(_modal);
    new _DialogLayer.default(_modal, layerOptions);
    if (controller) {
      if (typeof controller === 'string') {
        new ((0, _requireModule.default)(controller))(_modal, ...args);
      } else if (typeof controller === 'function') {
        controller(_modal, ...args);
      }
    }
    const self = this;
    return _modal.on('shown', function ({
      el
    }) {
      zIndex = DEFAULT_Z_INDEX + 10 * stack.length;
      el.style.zIndex = zIndex;
      setTimeout(() => {
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
          backdrop.style.zIndex = zIndex - 1;
        }
      });
    }).on('showBackdrop', this._fixBackdrop).on('hidden', function ({
      el
    }) {
      stack = stack.filter(modal => {
        return !modal.el.isEqualNode(el);
      });
      if (stack.length) {
        document.body.classList.add('modal-open');
      }
      document.body.style.paddingRight = originalBodyPad;
      zIndex -= 10;
      self._fixBackdrop();
      _DOM.default.remove(el);
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
  _makeDialog(content, className = '') {
    this.id = `js_${dialogId.toString(16)}`;
    return `
      <div id="${this.id}" class="modal fade ${className}" tabindex="-1" role="dialog">
  ${content}
</div>`;
  }
}
exports.default = Dialog;