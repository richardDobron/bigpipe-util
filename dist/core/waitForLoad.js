"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = waitForLoad;
var _onAfterLoad = _interopRequireDefault(require("./onAfterLoad"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
let loadingCounter = 0;
let originalCursor = '';
function waitForLoad(elementOnClicked, event, callback = () => {}) {
  const boundCallback = callback.bind(elementOnClicked, event);
  const body = document.body;
  if (document.readyState === 'complete') {
    return boundCallback();
  }
  const type = (event || window.event).type;
  loadingCounter++;
  if (loadingCounter === 1) {
    originalCursor = body.style.cursor;
    body.style.cursor = 'progress';
  }
  switch (type) {
    case 'load':
    case 'focus':
      (0, _onAfterLoad.default)(boundCallback);
      return;
    case 'click':
      elementOnClicked.style.cursor = 'progress';
      (0, _onAfterLoad.default)(() => {
        loadingCounter--;
        if (loadingCounter === 0) {
          body.style.cursor = originalCursor;
        }
        elementOnClicked.style.cursor = '';
        const result = boundCallback();
        const href = elementOnClicked.getAttribute('href');
        if (elementOnClicked.tagName.toLowerCase() === 'a' && result !== false && href) {
          window.location.href = href;
        } else {
          elementOnClicked.click();
        }
      });
  }
  return false;
}