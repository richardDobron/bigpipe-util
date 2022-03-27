export function byTag(node, tagName) {
  tagName = tagName.toUpperCase();

  while (node && node.nodeName !== tagName) {
    node = node.parentNode;
  }

  return node;
}
