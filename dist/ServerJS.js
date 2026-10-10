"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _Bootloader = _interopRequireDefault(require("./Bootloader"));
var _invariant = _interopRequireDefault(require("./core/invariant"));
var _replaceTransportMarkers = _interopRequireDefault(require("./core/replaceTransportMarkers"));
var _reportError = _interopRequireDefault(require("./core/reportError"));
var _requireModule = _interopRequireWildcard(require("./core/requireModule"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function handler(dependencies, guard, context) {
  dependencies.forEach(args => {
    try {
      guard.apply(context, args);
    } catch (error) {
      (0, _reportError.default)(error);
    }
  });
}
class ServerJS {
  get _relativeTo() {
    return document.body;
  }
  handle(jsMods) {
    handler(jsMods.define || [], this._handleDefine, this);
    handler(jsMods.instances || [], this._handleInstance, this);
    handler(jsMods.require || [], this._handleRequireLazy, this);
  }
  _handleDefine(name, exports) {
    (0, _requireModule.defineModule)(name, () => {
      const holder = [exports];
      (0, _replaceTransportMarkers.default)(this._relativeTo, holder);
      return holder[0];
    });
  }
  _handleInstance(id, modulePath, marker) {
    (0, _requireModule.defineInstance)(id, () => {
      if (marker) {
        (0, _replaceTransportMarkers.default)(this._relativeTo, marker);
      }
      const Constructor = (0, _requireModule.default)(modulePath);
      (0, _invariant.default)(typeof Constructor === 'function', 'BigPipe: instance "%s" needs a class, module "%s" is not one.', id, modulePath);
      return new Constructor(...(marker || []));
    });
  }
  _handleRequireLazy(modulePath, method, marker) {
    if (_Bootloader.default.isBootloadable(modulePath)) {
      _Bootloader.default.loadModules([modulePath], () => this._handleRequire(modulePath, method, marker));
    } else {
      this._handleRequire(modulePath, method, marker);
    }
  }
  _handleRequire(modulePath, method, marker) {
    if (method && typeof method === 'string') {
      if (marker) {
        (0, _replaceTransportMarkers.default)(this._relativeTo, marker);
      }
      const factory = (0, _requireModule.default)(modulePath);
      const context = typeof factory === 'function' ? new factory() : factory;
      if (!context[method]) {
        throw new TypeError(`Module ${modulePath} has no method "${method}"`);
      }
      context[method].apply(context, marker || []);
    } else {
      if (marker) {
        (0, _replaceTransportMarkers.default)(this._relativeTo, marker);
      }
      const factory = (0, _requireModule.default)(modulePath);
      if (typeof factory === 'function') {
        new factory(...(marker || []));
      }
    }
  }
}
exports.default = ServerJS;