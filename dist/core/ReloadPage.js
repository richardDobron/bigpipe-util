"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class ReloadPage {
  now() {
    window.location.reload();
  }
  delay(delay) {
    setTimeout(this.now.bind(this), delay);
  }
}
exports.default = ReloadPage;