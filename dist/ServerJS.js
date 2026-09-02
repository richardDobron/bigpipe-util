"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _replaceTransportMarkers = _interopRequireDefault(require("./core/replaceTransportMarkers"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function handler(dependencies, guard, context) {
  return dependencies.map(function (args) {
    return guard.apply(context, args);
  });
}
class ServerJS {
  get _relativeTo() {
    return document.body;
  }
  handle(jsMods) {
    handler(jsMods.require || [], this._handleRequire, this);
  }
  _handleRequire(modulePath, method, marker) {
    if (method && typeof method === 'string') {
      if (marker) {
        (0, _replaceTransportMarkers.default)(this._relativeTo, marker);
      }
      const factory = window.require(modulePath);
      const context = typeof factory === 'function' ? new factory() : factory;
      if (!context[method]) {
        throw new TypeError(`Module ${modulePath} has no method "${method}"`);
      }
      context[method].apply(context, marker || []);
    } else {
      if (marker) {
        (0, _replaceTransportMarkers.default)(this._relativeTo, marker);
      }
      new (window.require(modulePath))(...(marker || []));
    }
  }
}
exports.default = ServerJS;