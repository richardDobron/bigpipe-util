"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Primer;
var _AsyncRequest = _interopRequireDefault(require("./async/AsyncRequest"));
var _Parent = require("./core/Parent");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function Primer() {
  const rootElement = document.documentElement;
  const RELATIONSHIP_REGEX = /async(?:-post)?|dialog/;
  rootElement.addEventListener('click', function (event) {
    event = event || window.event;
    const elementOnClicked = event.target || event.srcElement;
    const linkNodeOnClicked = (0, _Parent.byTag)(elementOnClicked, 'A');
    if (!linkNodeOnClicked) {
      return;
    }
    const ajaxHref = linkNodeOnClicked.getAttribute('ajaxify');
    const realHref = linkNodeOnClicked.href;
    let relationship = linkNodeOnClicked.rel && linkNodeOnClicked.rel.match(RELATIONSHIP_REGEX);
    relationship = relationship && relationship[0];
    if (ajaxHref && realHref && !/#$/.test(realHref)) {
      const isMiddleMouseButton = event.which && event.which === 2;
      const hasModifierKey = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      if (isMiddleMouseButton || hasModifierKey) {
        return;
      }
    }
    if (linkNodeOnClicked.classList.contains('async-saving')) {
      event.preventDefault();
      return;
    }
    switch (relationship) {
      case 'async':
      case 'async-post':
        event.preventDefault();
        new _AsyncRequest.default(ajaxHref).setRelative(linkNodeOnClicked).setInitialHandler(() => {
          linkNodeOnClicked.classList.add('async-saving');
        }).setHandler(() => {
          linkNodeOnClicked.classList.remove('async-saving');
        }).setErrorHandler(() => {
          linkNodeOnClicked.classList.remove('async-saving');
        }).setMethod(relationship === 'async-post' ? 'POST' : 'GET').send();
        break;
      case 'dialog':
        event.preventDefault();
        new _AsyncRequest.default(linkNodeOnClicked.getAttribute('ajaxify')).setRelative(linkNodeOnClicked).setInitialHandler(() => {
          linkNodeOnClicked.classList.add('async-saving');
        }).setHandler(() => {
          linkNodeOnClicked.classList.remove('async-saving');
        }).setErrorHandler(() => {
          linkNodeOnClicked.classList.remove('async-saving');
        }).setMethod('POST').send();
        break;
    }
  });
  rootElement.addEventListener('submit', function (event) {
    event = event || window.event;
    const eventTarget = event.target || event.srcElement;
    if (eventTarget && eventTarget.nodeName === 'FORM' && eventTarget.getAttribute('rel') === 'async') {
      event.preventDefault();
      const formData = new FormData(eventTarget);
      const submitter = event.submitter || eventTarget.querySelector("button[type='submit']");
      const activeControls = eventTarget.querySelectorAll('input:not([readonly]),select:not([readonly]),textarea:not([readonly])');
      if (submitter && submitter.name) {
        formData.append(submitter.name, submitter.value);
      }
      new _AsyncRequest.default(eventTarget.getAttribute('ajaxify') || eventTarget.getAttribute('action')).setMethod(eventTarget.method || 'POST').setRelative(eventTarget).setData(formData).setInitialHandler(function () {
        eventTarget.classList.add('async-saving');
        if (!eventTarget.classList.contains('disable-prevent-form')) {
          activeControls.forEach(function (control) {
            control.setAttribute('readonly', 'readonly');
          });
          if (submitter) {
            submitter.disabled = true;
          }
        }
        if (eventTarget) {
          const loader = eventTarget.querySelector('.form-loader');
          if (loader) {
            loader.classList.add('loading');
          }
        }
      }).setHandler(function () {
        eventTarget.classList.remove('async-saving');
        activeControls.forEach(function (control) {
          control.removeAttribute('readonly');
        });
        if (submitter) {
          submitter.disabled = false;
        }
        if (eventTarget) {
          const loader = eventTarget.querySelector('.small-loader');
          if (loader) {
            loader.classList.remove('loading');
          }
        }
      }).setErrorHandler(function () {
        eventTarget.classList.remove('async-saving');
        activeControls.forEach(function (control) {
          control.removeAttribute('readonly');
        });
        if (submitter) {
          submitter.disabled = false;
        }
        if (eventTarget) {
          const loader = eventTarget.querySelector('.small-loader');
          if (loader) {
            loader.classList.remove('loading');
          }
        }
      }).send();
    }
  });
}