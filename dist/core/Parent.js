"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.byAttribute = byAttribute;
exports.byClass = byClass;
exports.byTag = byTag;
exports.find = find;
function byTag(node, tagName) {
  tagName = tagName.toUpperCase();
  node = find(node, function (el) {
    return el.nodeName === tagName;
  });
  return node instanceof Element ? node : null;
}
function byClass(node, className) {
  node = find(node, function (el) {
    return el instanceof Element && el.classList.contains(className);
  });
  return node instanceof Element ? node : null;
}
function byAttribute(node, attribute) {
  node = find(node, function (el) {
    return el instanceof Element && el.hasAttribute(attribute);
  });
  return node instanceof Element ? node : null;
}
function find(node, callback) {
  while (node) {
    if (callback(node)) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}