"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Primer;
var _Bootloader = _interopRequireDefault(require("./Bootloader"));
var _Form = _interopRequireDefault(require("./core/Form"));
var _Parent = require("./core/Parent");
var _reportError = _interopRequireDefault(require("./core/reportError"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const ASYNC_REQUEST = 'bigpipe-util/dist/async/AsyncRequest';
const pending = new WeakSet();
function reportUploadProgress(form, event) {
  if (!event.lengthComputable) {
    return;
  }
  const ratio = event.total ? event.loaded / event.total : 0;
  form.style.setProperty('--upload-progress', String(ratio));
  form.querySelectorAll('progress').forEach(progress => {
    progress.max = event.total;
    progress.value = event.loaded;
  });
  form.dispatchEvent(new CustomEvent('uploadprogress', {
    bubbles: true,
    detail: {
      loaded: event.loaded,
      total: event.total,
      ratio
    }
  }));
}
function clearUploadProgress(form) {
  form.style.removeProperty('--upload-progress');
  form.querySelectorAll('progress').forEach(progress => {
    progress.value = 0;
  });
}
function withAsyncRequest(element, callback, onError) {
  pending.add(element);
  _Bootloader.default.loadModules([ASYNC_REQUEST], AsyncRequest => {
    pending.delete(element);
    callback(AsyncRequest);
  }, error => {
    pending.delete(element);
    if (onError) {
      onError();
    }
    (0, _reportError.default)(error);
  });
}
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
    if (linkNodeOnClicked.classList.contains('async-saving') || pending.has(linkNodeOnClicked)) {
      event.preventDefault();
      return;
    }
    if (relationship) {
      event.preventDefault();
      withAsyncRequest(linkNodeOnClicked, AsyncRequest => {
        // No error handler: errors go to the default one, see AsyncRequest.setDefaultErrorHandler().
        new AsyncRequest(ajaxHref).setRelative(linkNodeOnClicked).setStatusElement(linkNodeOnClicked).setMethod(relationship === 'async' ? 'GET' : 'POST').send();
      });
    }
  });
  rootElement.addEventListener('submit', function (event) {
    event = event || window.event;
    const eventTarget = event.target || event.srcElement;
    if (eventTarget && eventTarget.nodeName === 'FORM' && eventTarget.getAttribute('rel') === 'async') {
      event.preventDefault();
      if (pending.has(eventTarget)) {
        return;
      }
      const formData = new FormData(eventTarget);
      const hasFiles = _Form.default.hasFiles(eventTarget);
      const submitter = event.submitter || eventTarget.querySelector("button[type='submit']");
      const activeControls = eventTarget.querySelectorAll('input:not([readonly]),select:not([readonly]),textarea:not([readonly])');
      if (submitter && submitter.name) {
        formData.append(submitter.name, submitter.value);
      }
      withAsyncRequest(eventTarget, AsyncRequest => {
        new AsyncRequest(eventTarget.getAttribute('ajaxify') || eventTarget.getAttribute('action')).setMethod(eventTarget.method || 'POST').setRelative(eventTarget).setData(formData).setStatusElement(eventTarget).setUploadProgressHandler(hasFiles ? progressEvent => reportUploadProgress(eventTarget, progressEvent) : null).setInitialHandler(function () {
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
        }).setFinallyHandler(function () {
          if (hasFiles) {
            clearUploadProgress(eventTarget);
          }
          activeControls.forEach(function (control) {
            control.removeAttribute('readonly');
          });
          if (submitter) {
            submitter.disabled = false;
          }
          if (eventTarget) {
            const loader = eventTarget.querySelector('.form-loader');
            if (loader) {
              loader.classList.remove('loading');
            }
          }
        }).send();
      });
    }
  });
}