"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _AsyncDOM2 = _interopRequireDefault(require("./AsyncDOM"));
var _ServerJS2 = _interopRequireDefault(require("../ServerJS"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const _AsyncDOM = new _AsyncDOM2.default();
const _ServerJS = new _ServerJS2.default();
class AsyncResponse {
  handle(response, element) {
    const {
      domops,
      jsmods
    } = response;
    if (typeof response === 'object') {
      if (domops) {
        _AsyncDOM.invoke(domops, element);
      }
      if (jsmods) {
        _ServerJS.handle(jsmods);
      }
    }
  }
}
exports.default = AsyncResponse;