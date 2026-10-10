"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _DOM = _interopRequireDefault(require("../core/DOM"));
var _warning = _interopRequireDefault(require("../core/warning"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
class AsyncDOM {
  invoke(domOps, element) {
    for (let i = 0; i < domOps.length; ++i) {
      let [type, selector, enableTarget, content] = domOps[i];
      let node = enableTarget && element || null;
      if (selector) {
        node = (node || document.documentElement).querySelector(selector);
      }
      (0, _warning.default)(node, "Selector '%s' does not match anything!", selector);
      if (!node) {
        continue;
      }
      switch (type) {
        case 'eval':
          (0, _warning.default)(false, 'The eval DOM operation is deprecated: a Content Security Policy without ' + "'unsafe-eval' blocks it. Call a module with jsmods instead.");
          new Function(content).apply(node);
          break;
        case 'hide':
          node.style.display = 'none';
          break;
        case 'show':
          node.style.display = '';
          break;
        case 'setContent':
          _DOM.default.setContent(node, content.__html);
          break;
        case 'appendContent':
          _DOM.default.appendContent(node, content.__html);
          break;
        case 'prependContent':
          _DOM.default.prependContent(node, content.__html);
          break;
        case 'insertAfter':
          _DOM.default.insertAfter(node, content.__html);
          break;
        case 'insertBefore':
          _DOM.default.insertBefore(node, content.__html);
          break;
        case 'remove':
          _DOM.default.remove(node);
          break;
        case 'replace':
          _DOM.default.replace(node, content.__html);
          break;
        case 'morph':
          _DOM.default.morph(node, content.__html);
          break;
        case 'morphContent':
          _DOM.default.morphContent(node, content.__html);
          break;
      }
    }
  }
}
exports.default = AsyncDOM;