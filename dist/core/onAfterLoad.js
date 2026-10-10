"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = onAfterLoad;
function onAfterLoad(callback) {
  if (document.readyState === 'complete') {
    setTimeout(callback, 0);
  } else {
    window.addEventListener('load', () => callback(), {
      capture: true,
      once: true
    });
  }
}