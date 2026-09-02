"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
function removeNode(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}
var _default = exports.default = {
  prependContent(node, content) {
    node.insertAdjacentHTML('afterbegin', content);
  },
  insertAfter(node, content) {
    node.insertAdjacentHTML('afterend', content);
  },
  insertBefore(node, content) {
    node.insertAdjacentHTML('beforebegin', content);
  },
  setContent(node, content) {
    node.innerHTML = content;
  },
  appendContent(node, content) {
    node.insertAdjacentHTML('beforeend', content);
  },
  replace(node, content) {
    node.outerHTML = content;
  },
  remove(node) {
    removeNode(node);
  },
  empty(node) {
    while (node.firstChild) {
      removeNode(node.firstChild);
    }
  }
};