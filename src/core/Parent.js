import CSSCore from "fbjs/lib/CSSCore";

export function byTag(node, tagName) {
  tagName = tagName.toUpperCase();
  node = find(node, function (el) {
    return el.nodeName === tagName;
  });

  return node instanceof Element ? node : null;
}

export function byClass(node, className) {
  node = find(node, function (el) {
    return el instanceof Element && CSSCore.hasClass(el, className);
  });

  return node instanceof Element ? node : null;
}

export function byAttribute(node, attribute) {
  node = find(node, function (el) {
    return el instanceof Element && el.hasAttribute(attribute);
  });

  return node instanceof Element ? node : null;
}

export function find(node, callback) {
  while (node) {
    if (callback(node)) {
      return node;
    }

    node = node.parentNode;
  }

  return null;
}
