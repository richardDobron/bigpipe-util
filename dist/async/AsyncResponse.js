"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _AsyncDOM2 = _interopRequireDefault(require("./AsyncDOM"));
var _BigPipe = _interopRequireDefault(require("../BigPipe"));
var _Bootloader = _interopRequireDefault(require("../Bootloader"));
var _ServerJS2 = _interopRequireDefault(require("../ServerJS"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const _AsyncDOM = new _AsyncDOM2.default();
const _ServerJS = new _ServerJS2.default();
class AsyncResponse {
  handle(response, element) {
    const {
      domops,
      pagelets,
      jsmods
    } = response;
    if (typeof response === 'object') {
      const bigPipe = new _BigPipe.default();
      if (response.resource_map) {
        _Bootloader.default.setResourceMap(response.resource_map);
      }
      if (response.bootloadable) {
        _Bootloader.default.enableBootload(response.bootloadable);
      }
      if (domops) {
        _AsyncDOM.invoke(domops, element);
        bigPipe.destroyDetachedPagelets();
      }
      if (pagelets) {
        pagelets.forEach(pagelet => bigPipe.onPageletArrive(pagelet));
      }
      if (jsmods) {
        _ServerJS.handle(jsmods);
      }
    }
  }
}
exports.default = AsyncResponse;