"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = onAfterLoad;
var _EventListener = _interopRequireDefault(require("fbjs/lib/EventListener"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function onAfterLoad(callback) {
  if (document.readyState === 'complete') {
    setTimeout(callback, 0);
  } else {
    const event = _EventListener.default.capture(window, 'load', () => {
      event.remove();
      callback();
    });
  }
}