"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class ServerRedirect {
  redirectPageTo(url, delay = 0) {
    setTimeout(function () {
      window.location = url;
    }, delay);
  }
}
exports.default = ServerRedirect;